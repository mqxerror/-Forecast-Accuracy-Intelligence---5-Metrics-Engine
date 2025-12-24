import { NextRequest, NextResponse } from 'next/server'
import { SyncErrorLogger } from '@/lib/sync'

interface RouteParams {
  params: Promise<{ syncId: string }>
}

/**
 * GET /api/sync/history/[syncId]/errors - Get errors for a sync session
 *
 * Query params:
 * - limit: number (default 50)
 * - offset: number (default 0)
 * - errorType: 'validation' | 'transform' | 'database' | 'unknown'
 * - sku: string (filter by SKU)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { syncId } = await params
    const { searchParams } = new URL(request.url)

    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    const errorType = searchParams.get('errorType') || undefined

    const { errors, total } = await SyncErrorLogger.getSessionErrors(syncId, {
      limit,
      offset,
      errorType
    })

    // Get summary
    const summary = await SyncErrorLogger.getErrorSummary(syncId)

    return NextResponse.json({
      errors,
      total,
      limit,
      offset,
      hasMore: offset + errors.length < total,
      summary
    })

  } catch (error) {
    console.error('Failed to get errors:', error)
    return NextResponse.json(
      { error: 'Failed to get errors', details: String(error) },
      { status: 500 }
    )
  }
}
