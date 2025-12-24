import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/debug/data-audit - Audit data accuracy and field mappings
 *
 * This endpoint compares raw JSON data with stored database values
 * to help identify any data transformation issues.
 */
export async function GET() {
  const supabase = createAdminClient()

  try {
    // Get overall counts with different definitions
    const [
      { count: totalSkus },
      { count: reorderCount },
      { count: oosCount },
      { count: zeroStockCount },
      { count: negativeStockCount },
      { count: withReplenishment },
    ] = await Promise.all([
      // Total SKUs
      supabase.from('variants').select('*', { count: 'exact', head: true }),

      // Items where replenishment > 0 (needs reorder)
      supabase.from('variants').select('*', { count: 'exact', head: true }).gt('replenishment', 0),

      // Items where oos > 0 (has been out of stock for X days)
      supabase.from('variants').select('*', { count: 'exact', head: true }).gt('oos', 0),

      // Items where in_stock = 0 (currently zero inventory)
      supabase.from('variants').select('*', { count: 'exact', head: true }).eq('in_stock', 0),

      // Items where in_stock < 0 (oversold/backorder)
      supabase.from('variants').select('*', { count: 'exact', head: true }).lt('in_stock', 0),

      // Items that have a non-zero replenishment value
      supabase.from('variants').select('*', { count: 'exact', head: true }).neq('replenishment', 0),
    ])

    // Get sample items to verify field mapping
    const { data: sampleItems } = await supabase
      .from('variants')
      .select('id, sku, in_stock, replenishment, to_order, oos, raw_data')
      .limit(5)

    // Get field distribution (how many items have each field populated)
    const { data: allVariants } = await supabase
      .from('variants')
      .select('in_stock, replenishment, to_order, oos, cost_price, price')

    const fieldStats = {
      total: allVariants?.length || 0,
      with_in_stock: allVariants?.filter(v => v.in_stock !== null && v.in_stock !== 0).length || 0,
      with_replenishment: allVariants?.filter(v => v.replenishment !== null && v.replenishment > 0).length || 0,
      with_to_order: allVariants?.filter(v => v.to_order !== null && v.to_order > 0).length || 0,
      with_oos: allVariants?.filter(v => v.oos !== null && v.oos > 0).length || 0,
      with_cost_price: allVariants?.filter(v => v.cost_price !== null && v.cost_price > 0).length || 0,
      with_price: allVariants?.filter(v => v.price !== null && v.price > 0).length || 0,
      negative_stock: allVariants?.filter(v => v.in_stock !== null && v.in_stock < 0).length || 0,
      zero_stock: allVariants?.filter(v => v.in_stock === 0).length || 0,
    }

    // Check raw_data field names in first sample
    const rawDataFields = sampleItems?.[0]?.raw_data
      ? Object.keys(sampleItems[0].raw_data as Record<string, unknown>)
      : []

    return NextResponse.json({
      summary: {
        totalSkus,
        definitions: {
          'Needs Reorder (replenishment > 0)': reorderCount,
          'OOS Days (oos > 0)': oosCount,
          'Currently Zero Stock (in_stock = 0)': zeroStockCount,
          'Negative/Backorder (in_stock < 0)': negativeStockCount,
          'Has Any Replenishment': withReplenishment,
        },
      },
      fieldStats,
      rawDataFields: rawDataFields.sort(),
      sampleItems: sampleItems?.map(item => ({
        sku: item.sku,
        stored: {
          in_stock: item.in_stock,
          replenishment: item.replenishment,
          to_order: item.to_order,
          oos: item.oos,
        },
        raw: item.raw_data ? {
          in_stock: (item.raw_data as any).in_stock,
          replenishment: (item.raw_data as any).replenishment,
          to_order: (item.raw_data as any).to_order,
          oos: (item.raw_data as any).oos,
        } : null,
      })),
      fieldMappingNotes: {
        in_stock: 'Current inventory quantity from Inventory Planner',
        replenishment: 'Units needed to reach optimal stock level',
        to_order: 'Quantity recommended to order',
        oos: 'Number of DAYS item has been out of stock (NOT a boolean)',
        oos_last_60_days: 'OOS days in last 60 days',
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Audit failed', details: String(error) },
      { status: 500 }
    )
  }
}
