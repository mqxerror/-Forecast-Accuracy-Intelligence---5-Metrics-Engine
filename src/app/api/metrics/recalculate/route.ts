import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
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
import type { Database } from '@/types/database'

type MetricInsert = Database['public']['Tables']['forecast_metrics']['Insert']
type Variant = Database['public']['Tables']['variants']['Row']

interface ExtendedMetricInsert extends MetricInsert {
  forecast_source?: ForecastSource
  data_tier?: string
  period_count?: number
  zero_periods?: number
  primary_metric?: string
}

export const maxDuration = 300 // 5 minutes

/**
 * POST /api/metrics/recalculate - Recalculate forecast metrics for all variants
 */
export async function POST() {
  const startTime = Date.now()

  try {
    const supabase = createAdminClient()

    // Get all variants with orders_by_month data
    const { data: variantsWithData, error: fetchError } = await supabase
      .from('variants')
      .select('id, sku, orders_by_month, forecast_by_period')
      .not('orders_by_month', 'is', null)

    if (fetchError) throw fetchError

    if (!variantsWithData || variantsWithData.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No variants with historical data found',
        stats: { processed: 0, calculated: 0, skipped: 0 }
      })
    }

    console.log(`Recalculating metrics for ${variantsWithData.length} variants`)

    const metricsToInsert: ExtendedMetricInsert[] = []
    let skipped = 0

    for (const variant of variantsWithData as {
      id: string
      sku: string
      orders_by_month: Variant['orders_by_month']
      forecast_by_period: Variant['forecast_by_period']
    }[]) {
      try {
        const ordersByMonth = variant.orders_by_month as Record<string, Record<string, number>>
        const forecastByPeriod = variant.forecast_by_period as Record<string, Record<string, number>> | null

        if (!ordersByMonth) {
          skipped++
          continue
        }

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

        // Check data tier (minimum 3 periods)
        const dataTier = getDataTier(actualData.length)
        if (dataTier.tier === 'insufficient') {
          skipped++
          continue
        }

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
            calculated_at: new Date().toISOString()
          })
        }
      } catch {
        skipped++
        continue
      }
    }

    // Insert metrics in batches
    let metricsCalculated = 0
    for (let i = 0; i < metricsToInsert.length; i += 500) {
      const batch = metricsToInsert.slice(i, i + 500)
      const { error } = await supabase
        .from('forecast_metrics')
        .upsert(batch, { onConflict: 'variant_id' })

      if (!error) {
        metricsCalculated += batch.length
      } else {
        console.error('Batch insert error:', error)
      }
    }

    // Update business summary
    await updateBusinessSummary(supabase)

    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      message: 'Metrics recalculation completed',
      stats: {
        processed: variantsWithData.length,
        calculated: metricsCalculated,
        skipped,
        durationMs: duration
      }
    })

  } catch (error) {
    console.error('Metrics recalculation error:', error)
    return NextResponse.json(
      { error: 'Recalculation failed', details: String(error) },
      { status: 500 }
    )
  }
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
