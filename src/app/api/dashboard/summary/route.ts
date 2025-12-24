import { NextResponse } from 'next/server'
import { getBusinessSummary, getLatestSyncStatus } from '@/lib/supabase/queries/summary'
import { getInventoryStats, getTopPriorityItems } from '@/lib/supabase/queries/variants'
import { getAverageAccuracy } from '@/lib/supabase/queries/metrics'

export async function GET() {
  try {
    // Fetch all data in parallel
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
