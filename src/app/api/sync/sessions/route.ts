import { NextRequest, NextResponse } from 'next/server'
import { sessionManager } from '@/lib/sync'

/**
 * POST /api/sync/sessions - Create a new sync session
 *
 * Request body:
 * {
 *   totalChunks?: number,    // Expected number of chunks
 *   totalRecords?: number,   // Expected total records
 *   source?: string,         // Source identifier (default: 'n8n')
 *   metadata?: object        // Additional metadata
 * }
 *
 * Returns:
 * {
 *   sessionId: string,       // Use in x-sync-session-id header
 *   sessionToken: string,    // Alternative identifier
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret
    const secret = request.headers.get('x-webhook-secret')
    if (secret !== process.env.N8N_WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: 'Invalid webhook secret' },
        { status: 401 }
      )
    }

    const body = await request.json()

    const { session, token } = await sessionManager.createSession({
      totalChunks: body.totalChunks,
      totalRecords: body.totalRecords,
      source: body.source || 'n8n',
      metadata: body.metadata
    })

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      sessionToken: token,
      message: 'Session created. Use sessionId in x-sync-session-id header for chunk uploads.'
    })

  } catch (error) {
    console.error('Failed to create session:', error)
    return NextResponse.json(
      { error: 'Failed to create session', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * GET /api/sync/sessions - List recent sync sessions
 *
 * Query params:
 * - limit: number (default 20)
 * - offset: number (default 0)
 * - status: string (filter by status)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    const status = searchParams.get('status') || undefined

    const { sessions, total } = await sessionManager.listSessions({
      limit,
      offset,
      status
    })

    return NextResponse.json({
      sessions,
      total,
      limit,
      offset,
      hasMore: offset + sessions.length < total
    })

  } catch (error) {
    console.error('Failed to list sessions:', error)
    return NextResponse.json(
      { error: 'Failed to list sessions', details: String(error) },
      { status: 500 }
    )
  }
}
