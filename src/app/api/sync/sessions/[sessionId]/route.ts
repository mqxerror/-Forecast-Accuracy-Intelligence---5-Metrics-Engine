import { NextRequest, NextResponse } from 'next/server'
import { sessionManager, SyncErrorLogger } from '@/lib/sync'

interface RouteParams {
  params: Promise<{ sessionId: string }>
}

/**
 * GET /api/sync/sessions/[sessionId] - Get session details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId } = await params

    const { session, chunks } = await sessionManager.getSessionWithChunks(sessionId)

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Get error summary
    const errorSummary = await SyncErrorLogger.getErrorSummary(sessionId)

    return NextResponse.json({
      session,
      chunks,
      errorSummary,
      progress: session.total_expected_records
        ? Math.round((session.records_processed / session.total_expected_records) * 100)
        : null
    })

  } catch (error) {
    console.error('Failed to get session:', error)
    return NextResponse.json(
      { error: 'Failed to get session', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/sync/sessions/[sessionId] - Update session (pause/cancel)
 *
 * Request body:
 * {
 *   action: 'pause' | 'cancel'
 * }
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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
    const body = await request.json()

    const session = await sessionManager.getSession(sessionId)
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    switch (body.action) {
      case 'pause':
        await sessionManager.pauseSession(sessionId)
        return NextResponse.json({ success: true, message: 'Session paused' })

      case 'cancel':
        await sessionManager.cancelSession(sessionId)
        return NextResponse.json({ success: true, message: 'Session cancelled' })

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: pause, cancel' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Failed to update session:', error)
    return NextResponse.json(
      { error: 'Failed to update session', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/sync/sessions/[sessionId] - Delete session and related data
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    // Cancel session (CASCADE will delete chunks and errors)
    await sessionManager.cancelSession(sessionId)

    return NextResponse.json({
      success: true,
      message: 'Session deleted'
    })

  } catch (error) {
    console.error('Failed to delete session:', error)
    return NextResponse.json(
      { error: 'Failed to delete session', details: String(error) },
      { status: 500 }
    )
  }
}
