import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createSyncRecord, completeSyncRecord } from '@/lib/supabase/queries/summary'
import {
  calculateMAPE,
  calculateWAPE,
  calculateRMSE,
  calculateBias,
  calculateSmoothedMAPE,
  getDataTier,
  selectPrimaryMetric,
  type ForecastSource
} from '@/lib/utils/calculate-metrics'
import { validateVariants, getErrorSummary, getWarningSummary } from '@/lib/validation/variant-schema'
import { detectFieldMappings, getCostValue, getLostRevenueValue } from '@/lib/utils/field-detection'
import type { Database } from '@/types/database'

// Route segment config for large file uploads
export const maxDuration = 300 // 5 minutes
export const dynamic = 'force-dynamic'

type VariantInsert = Database['public']['Tables']['variants']['Insert']
type MetricInsert = Database['public']['Tables']['forecast_metrics']['Insert']
type Variant = Database['public']['Tables']['variants']['Row']

interface ExtendedMetricInsert extends MetricInsert {
  forecast_source?: ForecastSource
  data_tier?: string
  period_count?: number
  zero_periods?: number
  primary_metric?: string
}

/**
 * POST /api/upload/json - Upload variant data as JSON body
 *
 * This endpoint accepts raw JSON in the request body (not multipart form data)
 * to avoid size limitations with formData parsing.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const supabase = createAdminClient()
  let syncId: string | undefined

  try {
    // Create sync record
    const { sync } = await createSyncRecord('file_upload')
    syncId = sync?.id

    console.log('Reading request body stream...')

    // Read body as stream to bypass default size limits
    const reader = request.body?.getReader()
    if (!reader) {
      if (syncId) await completeSyncRecord(syncId, 'failed', 0, 0, 'No request body')
      return NextResponse.json({ error: 'No request body' }, { status: 400 })
    }

    const chunks: Uint8Array[] = []
    let totalSize = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        chunks.push(value)
        totalSize += value.length
      }
    }

    console.log(`Total body size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`)

    // Concatenate chunks
    const bodyBuffer = new Uint8Array(totalSize)
    let offset = 0
    for (const chunk of chunks) {
      bodyBuffer.set(chunk, offset)
      offset += chunk.length
    }

    const bodyText = new TextDecoder().decode(bodyBuffer)

    // Parse JSON
    let rawData: unknown
    try {
      rawData = JSON.parse(bodyText)
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      if (syncId) await completeSyncRecord(syncId, 'failed', 0, 0, 'Invalid JSON')
      return NextResponse.json({ error: 'Invalid JSON format' }, { status: 400 })
    }

    // Extract variants from various possible structures
    let variants: Record<string, unknown>[] = []

    if (Array.isArray(rawData)) {
      // Check if it's n8n format: [{ json: { variants: [...] } }]
      for (const item of rawData) {
        if (typeof item === 'object' && item !== null) {
          const obj = item as Record<string, unknown>
          if (obj.json && typeof obj.json === 'object') {
            const jsonObj = obj.json as Record<string, unknown>
            if (Array.isArray(jsonObj.variants)) {
              variants = variants.concat(jsonObj.variants as Record<string, unknown>[])
            }
          } else if (Array.isArray(obj.variants)) {
            variants = variants.concat(obj.variants as Record<string, unknown>[])
          } else if (obj.id && obj.sku) {
            // Direct variant object
            variants.push(obj)
          }
        }
      }
    } else if (typeof rawData === 'object' && rawData !== null) {
      const obj = rawData as Record<string, unknown>
      if (Array.isArray(obj.variants)) {
        variants = obj.variants as Record<string, unknown>[]
      }
    }

    if (variants.length === 0) {
      if (syncId) await completeSyncRecord(syncId, 'failed', 0, 0, 'No variants found')
      return NextResponse.json(
        { error: 'No variants found in data' },
        { status: 400 }
      )
    }

    console.log(`Processing ${variants.length} variants`)

    // STEP 1: Validate all variants
    const validation = validateVariants(variants)
    console.log(`Validation: ${validation.summary.passed} passed, ${validation.summary.failed} failed`)

    // STEP 2: Detect field mappings
    const fieldMappings = detectFieldMappings(variants)
    console.log(`Field detection: ${fieldMappings.summary}`)

    // Use validated variants
    const validVariants = validation.valid

    // Transform and insert in batches
    const batchSize = 500
    let imported = 0
    let errors = 0

    for (let i = 0; i < validVariants.length; i += batchSize) {
      const batch = validVariants.slice(i, i + batchSize)

      const transformedBatch = batch.map((v): VariantInsert | null => {
        const variantId = v.id ? String(v.id) : null
        const sku = v.sku ? String(v.sku) : ''

        if (!variantId || !sku) return null

        // Use detected field mappings
        const costValue = getCostValue(v as Record<string, unknown>, fieldMappings.cost.detectedField || undefined)
        const lostRevenueValue = getLostRevenueValue(v as Record<string, unknown>, fieldMappings.lostRevenue.detectedField || undefined)

        return {
          id: variantId,
          sku: sku,
          title: v.title ? String(v.title) : undefined,
          barcode: v.barcode ? String(v.barcode) : undefined,
          brand: v.brand ? String(v.brand) : undefined,
          product_type: v.product_type ? String(v.product_type) : undefined,
          image: v.image ? String(v.image) : undefined,
          price: v.price != null ? Number(v.price) : undefined,
          cost_price: costValue ?? undefined,
          in_stock: Number(v.in_stock) || 0,
          purchase_orders_qty: Number(v.purchase_orders_qty) || 0,
          last_7_days_sales: Number(v.last_7_days_sales) || 0,
          last_30_days_sales: Number(v.last_30_days_sales) || 0,
          last_90_days_sales: Number(v.last_90_days_sales) || 0,
          last_180_days_sales: Number(v.last_180_days_sales) || 0,
          last_365_days_sales: Number(v.last_365_days_sales) || 0,
          total_sales: Number(v.total_sales) || 0,
          orders_by_month: v.orders_by_month as Variant['orders_by_month'],
          forecast_by_period: v.forecast_by_period as Variant['forecast_by_period'],
          forecasted_stock: v.forecasted_stock != null ? Number(v.forecasted_stock) : undefined,
          current_forecast: v.current_forecast != null ? Number(v.current_forecast) : undefined,
          replenishment: Number(v.replenishment) || 0,
          to_order: Number(v.to_order) || 0,
          minimum_stock: v.minimum_stock != null ? Number(v.minimum_stock) : undefined,
          lead_time: v.lead_time != null ? Number(v.lead_time) : undefined,
          oos: Number(v.oos) || 0,
          oos_last_60_days: Number(v.oos_last_60_days) || 0,
          forecasted_lost_revenue: lostRevenueValue ?? undefined,
          raw_data: v as Variant['raw_data'],
          synced_at: new Date().toISOString()
        }
      }).filter((v): v is VariantInsert => v !== null)

      if (transformedBatch.length > 0) {
        const { error } = await supabase
          .from('variants')
          // @ts-ignore - Supabase types are too strict
        .upsert(transformedBatch, { onConflict: 'id' })

        if (error) {
          console.error(`Batch error:`, error.message)
          errors += transformedBatch.length
        } else {
          imported += transformedBatch.length
        }
      }

      // Log progress
      console.log(`Progress: ${Math.min(i + batchSize, validVariants.length)}/${validVariants.length}`)
    }

    // Calculate forecast metrics with enhanced tracking
    const metricsCalculated = await calculateAllMetricsEnhanced(supabase)

    // Update business summary
    await updateBusinessSummary(supabase)

    // Complete sync record
    const duration = Date.now() - startTime
    if (syncId) {
      await completeSyncRecord(syncId, 'completed', variants.length, imported)
    }

    return NextResponse.json({
      success: true,
      message: 'Import completed',
      stats: {
        received: variants.length,
        imported,
        rejected: validation.summary.failed,
        warnings: validation.summary.withWarnings,
        errors,
        metricsCalculated,
        durationMs: duration
      },
      validation: {
        passed: validation.summary.passed,
        failed: validation.summary.failed,
        errorSummary: getErrorSummary(validation),
        warningSummary: getWarningSummary(validation),
        sampleErrors: validation.invalid.slice(0, 3)
      },
      fieldDetection: {
        cost: {
          detected: fieldMappings.cost.detectedField,
          coverage: Math.round(fieldMappings.cost.coverage * 100),
          alternatives: fieldMappings.cost.alternatives.map(a =>
            `${a.field} (${Math.round(a.coverage * 100)}%)`
          ).slice(0, 3)
        },
        needsConfirmation: fieldMappings.needsConfirmation
      }
    })

  } catch (error) {
    console.error('Upload error:', error)
    if (syncId) {
      await completeSyncRecord(syncId, 'failed', 0, 0, String(error))
    }
    return NextResponse.json(
      { error: 'Upload failed', details: String(error) },
      { status: 500 }
    )
  }
}

async function calculateAllMetricsEnhanced(supabase: ReturnType<typeof createAdminClient>): Promise<number> {
  const { data: variantsWithData } = await supabase
    .from('variants')
    .select('id, sku, orders_by_month, forecast_by_period')
    .not('orders_by_month', 'is', null)

  if (!variantsWithData || variantsWithData.length === 0) {
    return 0
  }

  const metricsToInsert: ExtendedMetricInsert[] = []

  for (const variant of variantsWithData as {
    id: string
    sku: string
    orders_by_month: Variant['orders_by_month']
    forecast_by_period: Variant['forecast_by_period']
  }[]) {
    try {
      const ordersByMonth = variant.orders_by_month as Record<string, Record<string, number>>
      const forecastByPeriod = variant.forecast_by_period as Record<string, Record<string, number>> | null

      if (!ordersByMonth) continue

      // Parse actual sales data
      const actualData: { key: string; value: number }[] = []
      for (const year of Object.keys(ordersByMonth).sort()) {
        const months = ordersByMonth[year]
        if (typeof months !== 'object') continue
        for (const month of Object.keys(months).sort((a, b) => Number(a) - Number(b))) {
          actualData.push({
            key: `${year}-${month.padStart(2, '0')}`,
            value: Number(months[month]) || 0
          })
        }
      }

      // Use tiered requirements (minimum 3 periods)
      const dataTier = getDataTier(actualData.length)
      if (dataTier.tier === 'insufficient') continue

      // Parse forecast data if available
      const forecastData: { key: string; value: number }[] = []
      let hasIPForecast = false
      if (forecastByPeriod && typeof forecastByPeriod === 'object') {
        for (const year of Object.keys(forecastByPeriod).sort()) {
          const months = forecastByPeriod[year]
          if (typeof months !== 'object') continue
          for (const month of Object.keys(months).sort((a, b) => Number(a) - Number(b))) {
            forecastData.push({
              key: `${year}-${month.padStart(2, '0')}`,
              value: Number(months[month]) || 0
            })
          }
        }
        hasIPForecast = forecastData.some(f => f.value > 0)
      }

      const recentActual = actualData.slice(-12)
      const actual = recentActual.map(d => d.value)
      const primaryMetric = selectPrimaryMetric(actual)
      const zeroPeriods = actual.filter(v => v === 0).length

      // Use actual forecasts if available, otherwise naive
      let forecast: number[]
      let forecastSource: ForecastSource = 'inventory_planner'

      if (hasIPForecast && forecastData.length > 0) {
        const forecastMap = new Map(forecastData.map(f => [f.key, f.value]))
        forecast = recentActual.map(a => forecastMap.get(a.key) ?? 0)
        if (!forecast.some(v => v > 0)) {
          forecast = [actual[0], ...actual.slice(0, -1)]
          forecastSource = 'naive_benchmark'
        }
      } else {
        forecast = [actual[0], ...actual.slice(0, -1)]
        forecastSource = 'naive_benchmark'
      }

      const naiveForecast = [actual[0], ...actual.slice(0, -1)]
      const naiveMape = calculateMAPE(actual, naiveForecast)
      const smoothedResult = calculateSmoothedMAPE(actual, forecast)
      const mape = smoothedResult.value

      const wape = calculateWAPE(actual, forecast)
      const rmse = dataTier.metricsAvailable.includes('rmse') ? calculateRMSE(actual, forecast) : null
      const bias = calculateBias(actual, forecast)

      let wase: number | null = null
      if (dataTier.metricsAvailable.includes('wase') && naiveMape !== null && naiveMape > 0) {
        const forecastError = actual.reduce((sum, a, i) => sum + Math.abs(a - forecast[i]), 0)
        const naiveError = actual.reduce((sum, a, i) => sum + Math.abs(a - naiveForecast[i]), 0)
        wase = naiveError > 0 ? forecastError / naiveError : null
      }

      if (mape !== null) {
        metricsToInsert.push({
          variant_id: variant.id,
          sku: variant.sku,
          mape,
          wape,
          rmse,
          wase,
          bias,
          naive_mape: naiveMape,
          actual_values: actual,
          forecast_values: forecast,
          calculated_at: new Date().toISOString(),
          forecast_source: forecastSource,
          data_tier: dataTier.tier,
          period_count: actual.length,
          zero_periods: zeroPeriods,
          primary_metric: primaryMetric
        })
      }
    } catch {
      continue
    }
  }

  let metricsCalculated = 0
  for (let i = 0; i < metricsToInsert.length; i += 500) {
    const batch = metricsToInsert.slice(i, i + 500)
    const { error } = await supabase
      .from('forecast_metrics')
      // @ts-ignore - Supabase types are too strict
      .upsert(batch, { onConflict: 'variant_id' })

    if (!error) {
      metricsCalculated += batch.length
    }
  }

  return metricsCalculated
}

async function updateBusinessSummary(supabase: ReturnType<typeof createAdminClient>) {
  const { data: stats } = await supabase
    .from('variants')
    .select('in_stock, price, cost_price, oos, replenishment, forecasted_lost_revenue')

  const { data: metrics } = await supabase
    .from('forecast_metrics')
    .select('mape')

  if (!stats) return

  const totalSkus = stats.length
  const totalInStock = (stats as { in_stock: number }[]).reduce((sum, v) => sum + (v.in_stock || 0), 0)
  const totalValue = (stats as { in_stock: number; cost_price: number }[]).reduce(
    (sum, v) => sum + ((v.in_stock || 0) * (v.cost_price || 0)), 0
  )
  const itemsNeedingReorder = (stats as { replenishment: number }[]).filter(v => (v.replenishment || 0) > 0).length
  const itemsOutOfStock = (stats as { in_stock: number }[]).filter(v => (v.in_stock || 0) === 0).length
  const itemsOverstocked = (stats as { oos: number }[]).filter(v => (v.oos || 0) > 30).length
  const totalLostRevenue = (stats as { forecasted_lost_revenue: number }[]).reduce(
    (sum, v) => sum + (v.forecasted_lost_revenue || 0), 0
  )

  const validMape = (metrics as { mape: number }[] || []).filter(m => m.mape !== null).map(m => m.mape)
  const avgForecastAccuracy = validMape.length > 0
    ? 100 - (validMape.reduce((a, b) => a + b, 0) / validMape.length)
    : null

  // @ts-ignore - Supabase types are too strict
  await supabase
    .from('business_summary')
    .upsert({
      id: 'current',
      snapshot_date: new Date().toISOString().split('T')[0],
      total_skus: totalSkus,
      total_in_stock: totalInStock,
      total_value: totalValue,
      items_needing_reorder: itemsNeedingReorder,
      items_overstocked: itemsOverstocked,
      items_out_of_stock: itemsOutOfStock,
      avg_forecast_accuracy: avgForecastAccuracy,
      total_lost_revenue: totalLostRevenue,
      top_priority_items: null
    }, { onConflict: 'id' })
}
