import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateMAPE, calculateWAPE, calculateRMSE, calculateBias } from '@/lib/utils/calculate-metrics'
import type { Database } from '@/types/database'
import fs from 'fs'
import path from 'path'

type VariantInsert = Database['public']['Tables']['variants']['Insert']
type MetricInsert = Database['public']['Tables']['forecast_metrics']['Insert']
type Variant = Database['public']['Tables']['variants']['Row']

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _unused = (req: NextRequest) => req // Keep NextRequest import

/**
 * POST /api/import - Import variants from local JSON file
 *
 * This reads the variants.json file and imports into database
 */
export async function POST(request: NextRequest) {
  const supabase = createAdminClient()

  try {
    // Path to the variants.json file
    const variantsPath = path.join(process.cwd(), '..', 'warehouse', 'variants.json')

    // Check if file exists
    if (!fs.existsSync(variantsPath)) {
      return NextResponse.json({ error: 'variants.json file not found' }, { status: 404 })
    }

    // Read and parse the file
    const fileContent = fs.readFileSync(variantsPath, 'utf-8')
    const rawData = JSON.parse(fileContent)

    // Extract variants from the nested structure
    // The file is an array of objects with { json: { variants: [...] } }
    let allVariants: Record<string, unknown>[] = []

    if (Array.isArray(rawData)) {
      for (const item of rawData) {
        if (item.json?.variants) {
          allVariants = allVariants.concat(item.json.variants)
        } else if (item.variants) {
          allVariants = allVariants.concat(item.variants)
        }
      }
    } else if (rawData.variants) {
      allVariants = rawData.variants
    }

    console.log(`Found ${allVariants.length} variants to import`)

    // Transform and insert in batches
    const batchSize = 500
    let imported = 0
    let errors = 0

    for (let i = 0; i < allVariants.length; i += batchSize) {
      const batch = allVariants.slice(i, i + batchSize)

      const transformedBatch = batch.map((v: Record<string, unknown>): VariantInsert | null => {
        // Data comes directly on the variant object
        const variantId = v.id ? String(v.id) : null
        const sku = v.sku ? String(v.sku) : ''

        if (!variantId || !sku) return null

        return {
          id: variantId,
          sku: sku,
          title: v.title ? String(v.title) : undefined,
          barcode: v.barcode ? String(v.barcode) : undefined,
          brand: v.brand ? String(v.brand) : undefined,
          product_type: v.product_type ? String(v.product_type) : undefined,
          image: v.image ? String(v.image) : undefined,
          price: v.price != null ? Number(v.price) : undefined,
          // Check multiple possible cost field names from Inventory Planner
          cost_price: v.cost_price != null ? Number(v.cost_price)
            : v.cost != null ? Number(v.cost)
            : v.unit_cost != null ? Number(v.unit_cost)
            : v.average_cost != null ? Number(v.average_cost)
            : v.cogs != null ? Number(v.cogs)
            : undefined,
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
          forecasted_lost_revenue: v.forecasted_lost_revenue_lead_time != null ? Number(v.forecasted_lost_revenue_lead_time) : undefined,
          raw_data: v as Variant['raw_data'],
          synced_at: new Date().toISOString()
        }
      }).filter((v): v is VariantInsert => v !== null)

      if (transformedBatch.length === 0) {
        console.log(`Batch ${i / batchSize}: No valid variants to insert`)
        continue
      }

      console.log(`Batch ${i / batchSize}: Inserting ${transformedBatch.length} variants`)
      console.log('Sample variant:', JSON.stringify(transformedBatch[0], null, 2))

      const { error, data } = await supabase
        .from('variants')
        // @ts-ignore - Supabase types are too strict
        .upsert(transformedBatch, { onConflict: 'id' })
        .select('id')

      if (error) {
        console.error(`Batch ${i / batchSize} error:`, error.message, error.details, error.hint)
        errors += transformedBatch.length
      } else {
        imported += data?.length || transformedBatch.length
        console.log(`Batch ${i / batchSize}: Inserted ${data?.length || transformedBatch.length} variants`)
      }

      console.log(`Progress: ${i + batch.length}/${allVariants.length}`)
    }

    // Now calculate forecast metrics using naive forecast approach
    // (Since we don't have historical forecast data, we use previous period as forecast)
    console.log('Calculating forecast metrics...')

    // Get variants with historical sales data
    const { data: variantsWithSales, error: fetchError } = await supabase
      .from('variants')
      .select('id, sku, orders_by_month')
      .not('orders_by_month', 'is', null)

    console.log(`Found ${variantsWithSales?.length || 0} variants with orders_by_month data`)
    if (fetchError) {
      console.error('Error fetching variants:', fetchError)
    }

    let metricsCalculated = 0

    if (variantsWithSales && variantsWithSales.length > 0) {
      const metricsToInsert: MetricInsert[] = []

      for (const variant of variantsWithSales as { id: string; sku: string; orders_by_month: Variant['orders_by_month'] }[]) {
        try {
          const ordersByMonth = variant.orders_by_month as Record<string, Record<string, number>>
          if (!ordersByMonth) {
            console.log(`Variant ${variant.sku}: no orders_by_month`)
            continue
          }

          // Flatten to monthly values chronologically
          const monthlyData: { year: string; month: string; value: number }[] = []
          for (const year of Object.keys(ordersByMonth).sort()) {
            const months = ordersByMonth[year]
            if (typeof months !== 'object') continue
            for (const month of Object.keys(months).sort((a, b) => Number(a) - Number(b))) {
              monthlyData.push({ year, month, value: Number(months[month]) || 0 })
            }
          }

          // Need at least 6 months for meaningful metrics
          if (monthlyData.length < 6) {
            console.log(`Variant ${variant.sku}: only ${monthlyData.length} months of data`)
            continue
          }

          // Take last 12 months of data
          const recentData = monthlyData.slice(-12)
          const actual = recentData.map(d => d.value)

          // Skip if no actual sales
          if (actual.every(v => v === 0)) {
            console.log(`Variant ${variant.sku}: all zero sales`)
            continue
          }

          // Use naive forecast (previous month = next month's forecast)
          const naiveForecast = [actual[0], ...actual.slice(0, -1)]

          const mape = calculateMAPE(actual, naiveForecast)
          const wape = calculateWAPE(actual, naiveForecast)
          const rmse = calculateRMSE(actual, naiveForecast)
          const bias = calculateBias(actual, naiveForecast)

          console.log(`Variant ${variant.sku}: MAPE=${mape}, WAPE=${wape}`)

          if (mape !== null && mape < 500) { // Filter out extreme outliers
            metricsToInsert.push({
              variant_id: variant.id,
              sku: variant.sku,
              mape,
              wape,
              rmse,
              bias,
              actual_values: actual,
              forecast_values: naiveForecast,
              calculated_at: new Date().toISOString()
            })
          }
        } catch (e) {
          console.error(`Variant ${variant.sku} error:`, e)
          continue
        }
      }

      console.log(`Metrics to insert: ${metricsToInsert.length}`)

      // Insert metrics in batches
      for (let i = 0; i < metricsToInsert.length; i += 500) {
        const batch = metricsToInsert.slice(i, i + 500)
        console.log(`Inserting batch of ${batch.length} metrics`)
        const { error, data } = await supabase
          .from('forecast_metrics')
          // @ts-ignore - Supabase types are too strict
          .upsert(batch, { onConflict: 'variant_id' })
          .select('variant_id')

        if (error) {
          console.error('Metrics insert error:', error.message, error.details)
        } else {
          console.log(`Inserted ${data?.length || batch.length} metrics`)
          metricsCalculated += data?.length || batch.length
        }
      }
    }

    // Update business summary
    await updateBusinessSummary(supabase)

    return NextResponse.json({
      success: true,
      message: 'Import completed',
      stats: {
        totalVariants: allVariants.length,
        imported,
        errors,
        metricsCalculated
      }
    })

  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json(
      { error: 'Import failed', details: String(error) },
      { status: 500 }
    )
  }
}

async function updateBusinessSummary(supabase: ReturnType<typeof createAdminClient>) {
  // Get summary statistics
  const { data: stats } = await supabase
    .from('variants')
    .select('in_stock, price, cost_price, oos, replenishment, forecasted_lost_revenue')

  const { data: metrics } = await supabase
    .from('forecast_metrics')
    .select('mape')

  if (!stats) return

  const totalSkus = stats.length
  const totalInStock = stats.reduce((sum, v) => sum + (v.in_stock || 0), 0)
  const totalValue = stats.reduce((sum, v) => sum + ((v.in_stock || 0) * (v.cost_price || 0)), 0)
  const itemsNeedingReorder = stats.filter(v => (v.replenishment || 0) > 0).length
  const itemsOutOfStock = stats.filter(v => (v.in_stock || 0) === 0).length
  const itemsOverstocked = stats.filter(v => (v.oos || 0) > 30).length
  const totalLostRevenue = stats.reduce((sum, v) => sum + (v.forecasted_lost_revenue || 0), 0)

  const validMape = metrics?.filter(m => m.mape !== null).map(m => m.mape as number) || []
  const avgForecastAccuracy = validMape.length > 0
    ? 100 - (validMape.reduce((a, b) => a + b, 0) / validMape.length)
    : null

  const summaryData: Database['public']['Tables']['business_summary']['Insert'] = {
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
  }

  // @ts-ignore - Supabase types are too strict
  await supabase
    .from('business_summary')
    .upsert(summaryData, { onConflict: 'id' })
}

// GET endpoint to check import status
export async function GET() {
  const supabase = createAdminClient()

  const { count: variantCount } = await supabase
    .from('variants')
    .select('*', { count: 'exact', head: true })

  const { count: metricsCount } = await supabase
    .from('forecast_metrics')
    .select('*', { count: 'exact', head: true })

  const { data: summary } = await supabase
    .from('business_summary')
    .select('*')
    .eq('id', 'current')
    .single()

  return NextResponse.json({
    variants: variantCount || 0,
    metricsCalculated: metricsCount || 0,
    summary
  })
}
