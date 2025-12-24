import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { DashboardSummaryResponse } from '@/types/database'

// Fallback queries for when RPC is not yet deployed
import { getBusinessSummary, getLatestSyncStatus } from '@/lib/supabase/queries/summary'
import { getInventoryStats, getTopPriorityItems } from '@/lib/supabase/queries/variants'
import { getAverageAccuracy } from '@/lib/supabase/queries/metrics'

export async function GET() {
  try {
    const supabase = await createClient()

    // Try optimized RPC first (single query for all dashboard data)
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_dashboard_summary')

    if (!rpcError && rpcData) {
      // RPC succeeded - return optimized response
      const summary = rpcData as DashboardSummaryResponse
      return NextResponse.json({
        summary: null, // RPC includes everything needed
        sync: summary.last_sync,
        stats: {
          totalSkus: summary.stats.total_skus,
          oosCount: summary.stats.oos_count,
          reorderCount: summary.stats.reorder_count,
          totalValue: summary.stats.total_value,
          totalLostRevenue: summary.stats.total_lost_revenue,
        },
        priorityItems: summary.priority_items,
        accuracy: {
          avgMape: summary.accuracy.avg_mape,
          avgWape: summary.accuracy.avg_wape,
          skuCount: summary.accuracy.count,
        },
        mapeDistribution: summary.mape_distribution,
        oosItems: summary.oos_items,
      })
    }

    // Fallback to original queries if RPC not available
    console.log('RPC not available, using fallback queries:', rpcError?.message)

    const [summaryResult, syncResult, statsResult, priorityResult, accuracyResult] =
      await Promise.all([
        getBusinessSummary(),
        getLatestSyncStatus(),
        getInventoryStats(),
        getTopPriorityItems(10),
        getAverageAccuracy(),
      ])

    return NextResponse.json({
      summary: summaryResult.summary,
      sync: syncResult.sync,
      stats: statsResult,
      priorityItems: priorityResult.items,
      accuracy: {
        avgMape: accuracyResult.avgMape,
        avgWape: accuracyResult.avgWape,
        skuCount: accuracyResult.count,
      },
    })
  } catch (error) {
    console.error('Dashboard summary error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard summary' },
      { status: 500 }
    )
  }
}
