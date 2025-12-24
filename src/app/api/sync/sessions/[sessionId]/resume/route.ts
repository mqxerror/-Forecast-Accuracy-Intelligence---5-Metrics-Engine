import { NextRequest, NextResponse } from 'next/server'
import { sessionManager } from '@/lib/sync'

interface RouteParams {
  params: Promise<{ sessionId: string }>
}

/**
 * POST /api/sync/sessions/[sessionId]/resume - Resume a failed/paused session
 *
 * Returns the list of missing chunks that need to be re-sent.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Verify webhook secret
    const secret = request.headers.get('x-webhook-secret')
    if (secret !== process.env.N8N_WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: 'Invalid webhook secret' },
        { status: 401 }
      )
    }

    const { sessionId } = await params

    const session = await sessionManager.getSession(sessionId)
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Only allow resume for failed or paused sessions
    if (!['failed', 'paused'].includes(session.status)) {
      return NextResponse.json(
        { error: `Cannot resume session with status: ${session.status}` },
        { status: 400 }
      )
    }

    // Get missing chunks
    const missingChunks = await sessionManager.getMissingChunks(sessionId)

    // Update session status to in_progress
    await sessionManager.startSession(sessionId)

    return NextResponse.json({
      success: true,
      sessionId,
      status: 'resuming',
      missingChunks,
      totalMissing: missingChunks.length,
      message: missingChunks.length > 0
        ? `Re-send ${missingChunks.length} chunk(s) to complete the sync`
        : 'All chunks received, session resuming'
    })

  } catch (error) {
    console.error('Failed to resume session:', error)
    return NextResponse.json(
      { error: 'Failed to resume session', details: String(error) },
      { status: 500 }
    )
  }
}
