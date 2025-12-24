import { NextRequest, NextResponse } from 'next/server'
import { sessionManager } from '@/lib/sync'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/sync/history - Get sync history
 *
 * Combines both legacy sync_metrics and new sync_sessions data.
 *
 * Query params:
 * - limit: number (default 20)
 * - offset: number (default 0)
 * - status: string (filter by status)
 * - source: 'sessions' | 'metrics' | 'all' (default 'all')
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    const status = searchParams.get('status') || undefined
    const source = searchParams.get('source') || 'all'

    const supabase = createAdminClient()

    // Get sessions
    let sessions: unknown[] = []
    let sessionsTotal = 0
    if (source === 'all' || source === 'sessions') {
      const result = await sessionManager.listSessions({ limit, offset, status })
      sessions = result.sessions.map(s => ({
        id: s.id,
        type: 'session',
        source: s.source,
        status: s.status,
        recordsFetched: s.total_expected_records,
        recordsUpdated: s.records_processed,
        recordsFailed: s.records_failed,
        startedAt: s.started_at,
        completedAt: s.completed_at,
        errorMessage: s.error_message,
        chunksReceived: s.chunks_received,
        totalChunks: s.total_expected_chunks
      }))
      sessionsTotal = result.total
    }

    // Get legacy sync metrics
    let metrics: unknown[] = []
    let metricsTotal = 0
    if (source === 'all' || source === 'metrics') {
      let query = supabase
        .from('sync_metrics')
        .select('*', { count: 'exact' })
        .order('started_at', { ascending: false })

      if (status) {
        query = query.eq('status', status)
      }

      query = query.range(offset, offset + limit - 1)

      const { data, count } = await query

      metrics = (data || []).map(m => ({
        id: m.id,
        type: 'metric',
        source: m.sync_type,
        status: m.status,
        recordsFetched: m.records_fetched,
        recordsUpdated: m.records_updated,
        startedAt: m.started_at,
        completedAt: m.completed_at,
        errorMessage: m.error_message,
        durationMs: m.duration_ms
      }))
      metricsTotal = count || 0
    }

    // Combine and sort by date
    const combined = [...sessions, ...metrics]
      .sort((a, b) => {
        const aDate = (a as { startedAt: string }).startedAt || ''
        const bDate = (b as { startedAt: string }).startedAt || ''
        return bDate.localeCompare(aDate)
      })
      .slice(0, limit)

    return NextResponse.json({
      history: combined,
      total: sessionsTotal + metricsTotal,
      limit,
      offset,
      hasMore: offset + combined.length < sessionsTotal + metricsTotal
    })

  } catch (error) {
    console.error('Failed to get history:', error)
    return NextResponse.json(
      { error: 'Failed to get history', details: String(error) },
      { status: 500 }
    )
  }
}
