import { NextResponse } from 'next/server'
import { SyncProgressTracker } from '@/lib/sync'

/**
 * GET /api/sync/progress - Get current sync progress
 *
 * Returns the current sync progress for real-time updates.
 * Clients can poll this endpoint or use Supabase Realtime on sync_progress table.
 */
export async function GET() {
  try {
    const progress = await SyncProgressTracker.getCurrent()

    if (!progress) {
      return NextResponse.json({
        status: 'idle',
        message: 'No active sync'
      })
    }

    // Calculate percentage
    const percentage = progress.total_records && progress.total_records > 0
      ? Math.round((progress.records_processed / progress.total_records) * 100)
      : 0

    // Calculate time remaining
    let timeRemaining: string | null = null
    if (progress.estimated_completion) {
      const remaining = new Date(progress.estimated_completion).getTime() - Date.now()
      if (remaining > 0) {
        const minutes = Math.floor(remaining / 60000)
        const seconds = Math.floor((remaining % 60000) / 1000)
        timeRemaining = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
      }
    }

    return NextResponse.json({
      status: progress.status,
      sessionId: progress.session_id,
      progress: {
        current: progress.records_processed,
        total: progress.total_records,
        percentage,
        errors: progress.errors_count
      },
      batch: {
        current: progress.current_batch,
        total: progress.total_batches
      },
      chunk: {
        current: progress.current_chunk,
        total: progress.total_chunks
      },
      currentSku: progress.current_sku,
      startedAt: progress.started_at,
      estimatedCompletion: progress.estimated_completion,
      timeRemaining,
      message: progress.message,
      lastUpdate: progress.last_update
    })

  } catch (error) {
    console.error('Failed to get progress:', error)
    return NextResponse.json(
      { error: 'Failed to get progress', details: String(error) },
      { status: 500 }
    )
  }
}
