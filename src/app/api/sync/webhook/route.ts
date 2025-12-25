import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { completeSyncRecord, createSyncRecord } from '@/lib/supabase/queries/summary'
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
import { SyncProgressTracker, SyncErrorLogger, sessionManager } from '@/lib/sync'
import type { Database } from '@/types/database'

type VariantInsert = Database['public']['Tables']['variants']['Insert']
type MetricInsert = Database['public']['Tables']['forecast_metrics']['Insert']
type Variant = Database['public']['Tables']['variants']['Row']

// Extended metric insert with new fields
interface ExtendedMetricInsert extends MetricInsert {
  forecast_source?: ForecastSource
  data_tier?: string
  period_count?: number
  zero_periods?: number
  primary_metric?: string
}

// Increase timeout for large imports
export const maxDuration = 300 // 5 minutes

/**
 * POST /api/sync/webhook - Receive data and updates from n8n
 *
 * Supports two modes:
 * 1. Single-shot: Send all data at once (backward compatible)
 * 2. Chunked: Send data in chunks with session management
 *
 * Headers for chunked mode:
 * - x-sync-session-id: Session ID to add chunk to
 * - x-chunk-index: Chunk number (0-based)
 * - x-total-chunks: Total number of chunks expected
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Verify webhook secret
    const secret = request.headers.get('x-webhook-secret')
    if (secret !== process.env.N8N_WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: 'Invalid webhook secret' },
        { status: 401 }
      )
    }

    const body = await request.json()

    // Check for chunked mode headers
    const sessionId = request.headers.get('x-sync-session-id')
    const chunkIndexHeader = request.headers.get('x-chunk-index')
    const totalChunksHeader = request.headers.get('x-total-chunks')

    // Chunked mode: process as part of a session
    if (sessionId && chunkIndexHeader !== null) {
      const chunkIndex = parseInt(chunkIndexHeader, 10)
      const totalChunks = totalChunksHeader ? parseInt(totalChunksHeader, 10) : undefined
      return await handleChunkedImport(body, sessionId, chunkIndex, totalChunks, startTime)
    }

    // Single-shot mode (backward compatible)
    const event = body.event || 'import_variants'
    console.log(`Webhook received: ${event}`)

    switch (event) {
      case 'import_variants':
        return await handleVariantImport(body, startTime)

      case 'sync_started':
        console.log(`Sync started: ${body.sync_id}`)
        return NextResponse.json({ success: true })

      case 'sync_completed':
        if (body.sync_id) {
          await completeSyncRecord(
            body.sync_id,
            'completed',
            body.records_fetched || 0,
            body.records_updated || 0
          )
        }
        return NextResponse.json({ success: true })

      case 'sync_failed':
        if (body.sync_id) {
          await completeSyncRecord(
            body.sync_id,
            'failed',
            body.records_fetched || 0,
            body.records_updated || 0,
            body.error_message
          )
        }
        return NextResponse.json({ success: true })

      default:
        return NextResponse.json(
          { error: `Unknown event type: ${event}` },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * Extract variants from various payload formats:
 * - Raw array: [...variants]
 * - Wrapped: { variants: [...] }
 * - Double wrapped from n8n: { body: { variants: [...] } }
 * - Inventory Planner API: { data: [...] } or { variants: [...] }
 * - With event: { event: "import_variants", variants: [...] }
 */
function extractVariants(body: unknown): Record<string, unknown>[] {
  if (Array.isArray(body)) {
    return body as Record<string, unknown>[]
  }

  if (typeof body === 'object' && body !== null) {
    const obj = body as Record<string, unknown>

    // Check for double-wrapped body from n8n (body.body.variants)
    if (obj.body && typeof obj.body === 'object') {
      const innerBody = obj.body as Record<string, unknown>
      if (Array.isArray(innerBody.variants)) {
        return innerBody.variants as Record<string, unknown>[]
      }
      if (Array.isArray(innerBody.data)) {
        return innerBody.data as Record<string, unknown>[]
      }
    }

    // Check common wrapper keys
    if (Array.isArray(obj.variants)) {
      return obj.variants as Record<string, unknown>[]
    }
    if (Array.isArray(obj.data)) {
      return obj.data as Record<string, unknown>[]
    }
    if (Array.isArray(obj.items)) {
      return obj.items as Record<string, unknown>[]
    }
  }

  return []
}

/**
 * Handle chunked import as part of a session
 */
async function handleChunkedImport(
  body: unknown,
  sessionId: string,
  chunkIndex: number,
  totalChunks: number | undefined,
  startTime: number
) {
  const supabase = createAdminClient()

  // Verify session exists
  const session = await sessionManager.getSession(sessionId)
  if (!session) {
    return NextResponse.json(
      { error: 'Invalid session ID' },
      { status: 400 }
    )
  }

  // Extract variants from payload
  const rawVariants = extractVariants(body)
  if (rawVariants.length === 0) {
    return NextResponse.json(
      { error: 'No variants found in payload' },
      { status: 400 }
    )
  }

  // Create/update chunk record
  await sessionManager.upsertChunk(sessionId, chunkIndex, rawVariants.length)

  // Start session if this is first chunk
  if (session.status === 'pending') {
    await sessionManager.startSession(sessionId)
  }

  // Initialize error logger for this chunk
  const errorLogger = new SyncErrorLogger(sessionId, chunkIndex)

  try {
    // Process the chunk
    const result = await processVariantBatch(
      supabase,
      rawVariants,
      sessionId,
      errorLogger,
      chunkIndex
    )

    // Flush any remaining errors
    await errorLogger.flush()

    // Update chunk status
    const processingTime = Date.now() - startTime
    await sessionManager.completeChunk(sessionId, chunkIndex, {
      recordsProcessed: result.imported,
      recordsFailed: result.errors,
      processingTimeMs: processingTime
    })

    // Update session totals
    const currentSession = await sessionManager.getSession(sessionId)
    if (currentSession) {
      await sessionManager.updateSession(sessionId, {
        chunksReceived: (currentSession.chunks_received || 0) + 1,
        recordsProcessed: (currentSession.records_processed || 0) + result.imported,
        recordsFailed: (currentSession.records_failed || 0) + result.errors
      })

      // Check if all chunks received
      if (totalChunks && currentSession.chunks_received + 1 >= totalChunks) {
        // Calculate metrics for all imported variants
        await calculateAllMetricsEnhanced(supabase)
        await updateBusinessSummary(supabase)

        // Complete session
        await sessionManager.completeSession(sessionId, {
          recordsProcessed: currentSession.records_processed + result.imported,
          recordsFailed: currentSession.records_failed + result.errors
        })
      }
    }

    return NextResponse.json({
      success: true,
      chunk: chunkIndex,
      stats: {
        received: rawVariants.length,
        imported: result.imported,
        errors: result.errors,
        processingTimeMs: processingTime
      }
    })

  } catch (error) {
    await errorLogger.flush()
    await sessionManager.failChunk(sessionId, chunkIndex, String(error))

    return NextResponse.json(
      { error: 'Chunk processing failed', details: String(error) },
      { status: 500 }
    )
  }
}

async function handleVariantImport(body: { variants?: unknown[]; sync_id?: string }, startTime: number) {
  const supabase = createAdminClient()

  // Create sync record if not provided
  let syncId = body.sync_id
  if (!syncId) {
    const { sync } = await createSyncRecord('webhook')
    syncId = sync?.id
  }

  // Extract variants from various payload formats
  const rawVariants = extractVariants(body)

  if (rawVariants.length === 0) {
    return NextResponse.json(
      { error: 'No variants provided' },
      { status: 400 }
    )
  }

  // Initialize progress tracking
  const progressTracker = new SyncProgressTracker(syncId || null, rawVariants.length)
  await progressTracker.start('Processing import...')

  // Initialize error logger
  const errorLogger = new SyncErrorLogger(syncId || null)

  try {
    console.log(`Processing ${rawVariants.length} variants`)

    // STEP 1: Validate all variants
    const validation = validateVariants(rawVariants)
    console.log(`Validation: ${validation.summary.passed} passed, ${validation.summary.failed} failed, ${validation.summary.withWarnings} warnings`)

    // STEP 2: Detect field mappings
    const fieldMappings = detectFieldMappings(rawVariants)
    console.log(`Field detection: ${fieldMappings.summary}`)

    // Use validated variants for import
    const variants = validation.valid

    // Transform and insert in batches
    const batchSize = 500
    let imported = 0
    let errors = 0

    for (let i = 0; i < variants.length; i += batchSize) {
      const batch = variants.slice(i, i + batchSize)

      const transformedBatch = batch.map((v): VariantInsert | null => {
        const variantId = v.id ? String(v.id) : null
        const sku = v.sku ? String(v.sku) : ''

        if (!variantId || !sku) return null

        // Use detected field mappings for cost
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
          await errorLogger.logDatabaseError(
            batch as Record<string, unknown>[],
            { message: error.message, code: error.code, details: error.details }
          )
          errors += transformedBatch.length
        } else {
          imported += transformedBatch.length
        }

        // Update progress
        await progressTracker.updateProgress(imported + errors, {
          currentBatch: Math.floor(i / batchSize) + 1,
          errorsCount: errors + validation.summary.failed,
          message: `Processed ${imported + errors} of ${rawVariants.length} records...`
        })
      }
    }

    // Flush any remaining errors
    await errorLogger.flush()

    // Calculate forecast metrics with enhanced tracking
    const metricsCalculated = await calculateAllMetricsEnhanced(supabase)

    // Update business summary
    await updateBusinessSummary(supabase)

    // Complete sync record and progress
    const duration = Date.now() - startTime
    if (syncId) {
      await completeSyncRecord(syncId, 'completed', rawVariants.length, imported)
    }
    await progressTracker.complete(imported, errors + validation.summary.failed)

    return NextResponse.json({
      success: true,
      message: 'Import completed',
      stats: {
        received: rawVariants.length,
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
        sampleErrors: validation.invalid.slice(0, 3),
        sampleWarnings: validation.warnings.slice(0, 3)
      },
      fieldDetection: {
        cost: {
          detected: fieldMappings.cost.detectedField,
          coverage: Math.round(fieldMappings.cost.coverage * 100),
          alternatives: fieldMappings.cost.alternatives.map(a =>
            `${a.field} (${Math.round(a.coverage * 100)}%)`
          ).slice(0, 3)
        },
        lostRevenue: {
          detected: fieldMappings.lostRevenue.detectedField,
          coverage: Math.round(fieldMappings.lostRevenue.coverage * 100)
        },
        needsConfirmation: fieldMappings.needsConfirmation
      }
    })

  } catch (error) {
    console.error('Import error:', error)
    await errorLogger.flush()
    await progressTracker.fail(String(error))
    if (syncId) {
      await completeSyncRecord(syncId, 'failed', 0, 0, String(error))
    }
    return NextResponse.json(
      { error: 'Import failed', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * Process a batch of variants (used by chunked import)
 */
async function processVariantBatch(
  supabase: ReturnType<typeof createAdminClient>,
  rawVariants: Record<string, unknown>[],
  sessionId: string | null,
  errorLogger: SyncErrorLogger,
  chunkIndex?: number
): Promise<{ imported: number; errors: number }> {
  // Validate all variants
  const validation = validateVariants(rawVariants)

  // Log validation errors
  for (let i = 0; i < validation.invalid.length; i++) {
    const invalidItem = validation.invalid[i]
    if (invalidItem.error) {
      await errorLogger.logValidationError(
        rawVariants[i] || {},
        invalidItem.error,
        i
      )
    }
  }

  // Detect field mappings
  const fieldMappings = detectFieldMappings(rawVariants)

  // Use validated variants for import
  const variants = validation.valid

  // Transform and insert in batches
  const batchSize = 500
  let imported = 0
  let errors = 0

  for (let i = 0; i < variants.length; i += batchSize) {
    const batch = variants.slice(i, i + batchSize)

    const transformedBatch = batch.map((v): VariantInsert | null => {
      const variantId = v.id ? String(v.id) : null
      const sku = v.sku ? String(v.sku) : ''

      if (!variantId || !sku) return null

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
        await errorLogger.logDatabaseError(
          batch as Record<string, unknown>[],
          { message: error.message, code: error.code, details: error.details }
        )
        errors += transformedBatch.length
      } else {
        imported += transformedBatch.length
      }
    }
  }

  return { imported, errors: errors + validation.summary.failed }
}

/**
 * Enhanced metrics calculation with:
 * - Forecast source tracking (IP vs naive benchmark)
 * - Data tier classification
 * - Zero-period handling with smoothed MAPE
 * - Primary metric selection
 */
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

      // NEW: Use tiered data requirements (minimum 3 periods instead of 6)
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

      // Don't skip all-zero SKUs - they might have forecasts
      const primaryMetric = selectPrimaryMetric(actual)
      const zeroPeriods = actual.filter(v => v === 0).length

      // Use actual forecasts if available, otherwise naive
      let forecast: number[]
      let forecastSource: ForecastSource = 'inventory_planner'

      if (hasIPForecast && forecastData.length > 0) {
        const forecastMap = new Map(forecastData.map(f => [f.key, f.value]))
        forecast = recentActual.map(a => forecastMap.get(a.key) ?? 0)
        if (!forecast.some(v => v > 0)) {
          // Fallback to naive if aligned forecast is all zeros
          forecast = [actual[0], ...actual.slice(0, -1)]
          forecastSource = 'naive_benchmark'
        }
      } else {
        forecast = [actual[0], ...actual.slice(0, -1)]
        forecastSource = 'naive_benchmark'
      }

      const naiveForecast = [actual[0], ...actual.slice(0, -1)]
      const naiveMape = calculateMAPE(actual, naiveForecast)

      // Use smoothed MAPE for SKUs with zero periods
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

      // Include metrics even if MAPE is high (useful for data quality insights)
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
          // Extended fields
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

  // Insert metrics
  let metricsCalculated = 0
  for (let i = 0; i < metricsToInsert.length; i += 500) {
    const batch = metricsToInsert.slice(i, i + 500)
    const { error } = await supabase
      .from('forecast_metrics')
      // @ts-ignore - Supabase types are too strict for extended fields
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
