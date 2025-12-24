import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/sync/trigger - Trigger n8n webhook to start sync
 *
 * This endpoint calls the configured n8n webhook URL.
 * n8n will then fetch data from Inventory Planner and POST it back to /api/sync/webhook
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient()

    // Get the n8n webhook URL and app public URL from settings
    const { data: settings, error: settingsError } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['n8n_webhook_url', 'n8n_webhook_secret', 'app_public_url'])

    if (settingsError) throw settingsError

    const settingsMap: Record<string, string> = {}
    settings?.forEach(s => {
      settingsMap[s.key] = s.value || ''
    })

    const webhookUrl = settingsMap['n8n_webhook_url']
    const webhookSecret = settingsMap['n8n_webhook_secret']
    const appPublicUrl = settingsMap['app_public_url']

    if (!webhookUrl) {
      return NextResponse.json(
        { error: 'n8n webhook URL not configured. Go to Admin → n8n Sync to set it up.' },
        { status: 400 }
      )
    }

    if (!appPublicUrl) {
      return NextResponse.json(
        { error: 'App Public URL not configured. Go to Admin → n8n Sync to set your public URL.' },
        { status: 400 }
      )
    }

    // Validate URL formats
    try {
      new URL(webhookUrl)
    } catch {
      return NextResponse.json(
        { error: 'Invalid n8n webhook URL format' },
        { status: 400 }
      )
    }

    try {
      new URL(appPublicUrl)
    } catch {
      return NextResponse.json(
        { error: 'Invalid App Public URL format' },
        { status: 400 }
      )
    }

    // Call the n8n webhook
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    // Add secret if configured
    if (webhookSecret) {
      headers['x-webhook-secret'] = webhookSecret
    }

    // Use the configured public URL for the callback
    const callbackUrl = `${appPublicUrl.replace(/\/$/, '')}/api/sync/webhook`

    console.log(`Triggering n8n webhook: ${webhookUrl}`)
    console.log(`Callback URL: ${callbackUrl}`)

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'sync_inventory',
        callback_url: callbackUrl,
        triggered_at: new Date().toISOString(),
        // Pass our webhook secret so n8n can authenticate back to us
        callback_secret: process.env.N8N_WEBHOOK_SECRET || ''
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('n8n webhook error:', errorText)
      return NextResponse.json(
        {
          error: 'Failed to trigger n8n webhook',
          status: response.status,
          details: errorText.substring(0, 500)
        },
        { status: 502 }
      )
    }

    // Try to parse response
    let responseData: unknown = null
    try {
      responseData = await response.json()
    } catch {
      // Response might not be JSON
      responseData = await response.text()
    }

    return NextResponse.json({
      success: true,
      message: 'Sync triggered successfully. n8n will process and send data back.',
      webhookResponse: responseData,
      triggeredAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('Failed to trigger sync:', error)
    return NextResponse.json(
      { error: 'Failed to trigger sync', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * GET /api/sync/trigger - Check if n8n webhook is configured
 */
export async function GET() {
  try {
    const supabase = createAdminClient()

    const { data: settings } = await supabase
      .from('app_settings')
      .select('key, value')
      .eq('key', 'n8n_webhook_url')
      .single()

    const isConfigured = !!(settings?.value)

    return NextResponse.json({
      configured: isConfigured,
      webhookUrl: isConfigured ? settings.value : null
    })

  } catch (error) {
    return NextResponse.json({
      configured: false,
      error: String(error)
    })
  }
}
