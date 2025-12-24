import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createSyncRecord, completeSyncRecord } from '@/lib/supabase/queries/summary'
import type { Database } from '@/types/database'

export const maxDuration = 300 // 5 minutes
export const dynamic = 'force-dynamic'

type VariantInsert = Database['public']['Tables']['variants']['Insert']
type Variant = Database['public']['Tables']['variants']['Row']

const IP_API_URL = process.env.IP_API_URL || 'https://app.inventory-planner.com/api/v1'
const IP_API_KEY = process.env.IP_API_KEY
const IP_ACCOUNT_ID = process.env.IP_ACCOUNT_ID

/**
 * POST /api/sync/inventory-planner - Fetch all variants from Inventory Planner API
 *
 * This endpoint fetches all variants with pagination and imports them to the database.
 */
export async function POST() {
  const startTime = Date.now()
  const supabase = createAdminClient()
  let syncId: string | undefined

  if (!IP_API_KEY || !IP_ACCOUNT_ID) {
    return NextResponse.json(
      { error: 'Inventory Planner API credentials not configured' },
      { status: 500 }
    )
  }

  try {
    // Create sync record
    const { sync } = await createSyncRecord('inventory_planner_api')
    syncId = sync?.id

    console.log('Fetching variants from Inventory Planner API...')

    // Fetch and process variants page by page to avoid memory issues
    let page = 0
    const limit = 250 // Smaller batches to reduce memory usage
    let hasMore = true
    let totalFetched = 0
    let imported = 0
    let errors = 0

    while (hasMore) {
      const url = `${IP_API_URL}/variants?limit=${limit}&page=${page}`
      console.log(`Fetching page ${page}...`)

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': IP_API_KEY,
          'Account': IP_ACCOUNT_ID,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`API error: ${response.status} - ${errorText}`)
        throw new Error(`Inventory Planner API error: ${response.status}`)
      }

      const data = await response.json()
      const variants: Record<string, unknown>[] = data.variants || []

      console.log(`Page ${page}: Got ${variants.length} variants`)
      totalFetched += variants.length

      // Process and insert this page immediately (don't accumulate)
      if (variants.length > 0) {
        const transformedBatch = variants.map((v): VariantInsert | null => {
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
          cost_price: v.cost_price != null ? Number(v.cost_price) : undefined,
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
          forecasted_lost_revenue: v.forecasted_lost_revenue_lead_time != null
            ? Number(v.forecasted_lost_revenue_lead_time)
            : undefined,
          raw_data: v as Variant['raw_data'],
          synced_at: new Date().toISOString()
        }
        }).filter((v): v is VariantInsert => v !== null)

        if (transformedBatch.length > 0) {
          const { error } = await supabase
            .from('variants')
            .upsert(transformedBatch as never[], { onConflict: 'id' })

          if (error) {
            console.error(`Batch error:`, error.message)
            errors += transformedBatch.length
          } else {
            imported += transformedBatch.length
          }
        }

        console.log(`Progress: ${totalFetched} variants processed, ${imported} imported`)
      }

      // Check if there are more pages
      const meta = data.meta || {}
      const total = meta.total || 0
      const fetched = (page + 1) * limit

      if (variants.length < limit || fetched >= total) {
        hasMore = false
      } else {
        page++
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    console.log(`Sync complete: ${totalFetched} fetched, ${imported} imported`)

    if (totalFetched === 0) {
      if (syncId) await completeSyncRecord(syncId, 'completed', 0, 0, 'No variants found')
      return NextResponse.json({
        success: true,
        message: 'No variants found in Inventory Planner',
        stats: { fetched: 0, imported: 0 }
      })
    }

    // Update business summary
    await updateBusinessSummary(supabase)

    // Complete sync record
    const duration = Date.now() - startTime
    if (syncId) {
      await completeSyncRecord(syncId, 'completed', totalFetched, imported)
    }

    return NextResponse.json({
      success: true,
      message: 'Sync completed from Inventory Planner API',
      stats: {
        fetched: totalFetched,
        imported,
        errors,
        durationMs: duration,
        durationMinutes: (duration / 1000 / 60).toFixed(2)
      }
    })

  } catch (error) {
    console.error('Inventory Planner sync error:', error)
    if (syncId) {
      await completeSyncRecord(syncId, 'failed', 0, 0, String(error))
    }
    return NextResponse.json(
      { error: 'Sync failed', details: String(error) },
      { status: 500 }
    )
  }
}

async function updateBusinessSummary(supabase: ReturnType<typeof createAdminClient>) {
  const { data: stats } = await supabase
    .from('variants')
    .select('in_stock, price, cost_price, oos, replenishment, forecasted_lost_revenue')

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
      total_lost_revenue: totalLostRevenue,
      top_priority_items: null
    } as never, { onConflict: 'id' })
}
