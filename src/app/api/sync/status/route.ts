import { NextResponse } from 'next/server'
import { getLatestSyncStatus, getSyncHistory } from '@/lib/supabase/queries/summary'

export async function GET() {
  try {
    const [latestResult, historyResult] = await Promise.all([
      getLatestSyncStatus(),
      getSyncHistory(5),
    ])

    return NextResponse.json({
      current: latestResult.sync,
      history: historyResult.syncs,
    })
  } catch (error) {
    console.error('Sync status error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sync status' },
      { status: 500 }
    )
  }
}
