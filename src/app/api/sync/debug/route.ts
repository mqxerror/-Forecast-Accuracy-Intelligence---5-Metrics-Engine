import { NextRequest, NextResponse } from 'next/server'

/**
 * Debug endpoint to capture and log incoming webhook data structure
 * POST /api/sync/debug - logs the exact structure received
 */
export async function POST(request: NextRequest) {
  try {
    const secret = request.headers.get('x-webhook-secret')
    if (secret !== process.env.N8N_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
    }

    const body = await request.json()

    // Analyze the structure
    const analysis = {
      receivedAt: new Date().toISOString(),
      topLevelType: typeof body,
      isArray: Array.isArray(body),
      topLevelKeys: typeof body === 'object' && body !== null ? Object.keys(body) : [],
      structure: {} as Record<string, unknown>
    }

    // Analyze each top-level key
    if (typeof body === 'object' && body !== null && !Array.isArray(body)) {
      for (const key of Object.keys(body)) {
        const value = body[key]
        analysis.structure[key] = {
          type: typeof value,
          isArray: Array.isArray(value),
          length: Array.isArray(value) ? value.length : undefined,
          sampleKeys: Array.isArray(value) && value.length > 0 && typeof value[0] === 'object'
            ? Object.keys(value[0])
            : undefined,
          sample: Array.isArray(value) && value.length > 0
            ? JSON.stringify(value[0]).slice(0, 500)
            : typeof value === 'object'
              ? JSON.stringify(value).slice(0, 500)
              : String(value).slice(0, 100)
        }
      }
    } else if (Array.isArray(body) && body.length > 0) {
      analysis.structure['[0]'] = {
        type: typeof body[0],
        keys: typeof body[0] === 'object' ? Object.keys(body[0]) : [],
        sample: JSON.stringify(body[0]).slice(0, 500)
      }
    }

    console.log('=== DEBUG WEBHOOK DATA ===')
    console.log(JSON.stringify(analysis, null, 2))
    console.log('=== RAW BODY (first 2000 chars) ===')
    console.log(JSON.stringify(body).slice(0, 2000))

    return NextResponse.json({
      success: true,
      message: 'Data structure captured - check server logs',
      analysis
    })
  } catch (error) {
    return NextResponse.json({
      error: 'Debug failed',
      details: String(error)
    }, { status: 500 })
  }
}
