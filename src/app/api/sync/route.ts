import { NextRequest, NextResponse } from 'next/server'
import { createSyncRecord, getLatestSyncStatus, completeSyncRecord } from '@/lib/supabase/queries/summary'

/**
 * POST /api/sync - Trigger a manual sync
 *
 * This triggers the n8n workflow which:
 * 1. Fetches variants from Inventory Planner API
 * 2. Sends the data back to /api/sync/webhook
 * 3. Updates sync status on completion/failure
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const syncType = body.type || 'manual'

    // Check if a sync is already running
    const { sync: currentSync } = await getLatestSyncStatus()
    if (currentSync?.status === 'running') {
      return NextResponse.json(
        { error: 'A sync is already in progress', syncId: currentSync.id },
        { status: 409 }
      )
    }

    // Create a new sync record
    const { sync, error } = await createSyncRecord(syncType)

    if (error) {
      return NextResponse.json({ error }, { status: 500 })
    }

    // Trigger n8n workflow
    const n8nUrl = process.env.N8N_WEBHOOK_URL || process.env.N8N_URL
    if (n8nUrl) {
      try {
        const webhookUrl = n8nUrl.includes('/webhook/')
          ? n8nUrl
          : `${n8nUrl}/webhook/inventory-sync`

        console.log(`Triggering n8n workflow: ${webhookUrl}`)

        const n8nResponse = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Secret': process.env.N8N_WEBHOOK_SECRET || '',
          },
          body: JSON.stringify({
            sync_id: sync?.id,
            trigger: 'manual',
            callback_url: `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/sync/webhook`
          }),
        })

        if (!n8nResponse.ok) {
          const errorText = await n8nResponse.text()
          console.error(`n8n trigger failed: ${n8nResponse.status} - ${errorText}`)

          // Mark sync as failed if n8n trigger failed
          if (sync?.id) {
            await completeSyncRecord(sync.id, 'failed', 0, 0, `n8n trigger failed: ${n8nResponse.status}`)
          }

          return NextResponse.json({
            error: 'Failed to trigger sync workflow',
            details: errorText,
            syncId: sync?.id,
          }, { status: 502 })
        }

        console.log('n8n workflow triggered successfully')
      } catch (n8nError) {
        console.error('n8n connection error:', n8nError)

        // Mark sync as failed
        if (sync?.id) {
          await completeSyncRecord(sync.id, 'failed', 0, 0, `n8n connection failed: ${String(n8nError)}`)
        }

        return NextResponse.json({
          error: 'Failed to connect to sync workflow',
          details: String(n8nError),
          syncId: sync?.id,
        }, { status: 502 })
      }
    } else {
      console.warn('N8N_WEBHOOK_URL not configured - sync recorded but not triggered')
    }

    return NextResponse.json({
      message: 'Sync initiated',
      syncId: sync?.id,
      status: 'running',
    })
  } catch (error) {
    console.error('Sync trigger error:', error)
    return NextResponse.json(
      { error: 'Failed to trigger sync' },
      { status: 500 }
    )
  }
}
