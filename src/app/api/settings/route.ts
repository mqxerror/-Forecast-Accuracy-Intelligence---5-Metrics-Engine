import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/settings - Get app settings
 *
 * Query params:
 * - keys: comma-separated list of setting keys (optional, returns all if not specified)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const keysParam = searchParams.get('keys')

    const supabase = createAdminClient()

    let query = supabase
      .from('app_settings')
      .select('key, value, description, updated_at')

    if (keysParam) {
      const keys = keysParam.split(',').map(k => k.trim())
      query = query.in('key', keys)
    }

    const { data, error } = await query

    if (error) throw error

    // Convert to key-value object for easier use
    const settings: Record<string, string> = {}
    data?.forEach(row => {
      settings[row.key] = row.value || ''
    })

    return NextResponse.json({ settings, raw: data })

  } catch (error) {
    console.error('Failed to get settings:', error)
    return NextResponse.json(
      { error: 'Failed to get settings', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * POST /api/settings - Update app settings
 *
 * Body: { settings: { key: value, ... } }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { settings } = body

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json(
        { error: 'Invalid settings object' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Update each setting
    const updates = Object.entries(settings).map(([key, value]) => ({
      key,
      value: String(value),
      updated_at: new Date().toISOString()
    }))

    for (const update of updates) {
      const { error } = await supabase
        .from('app_settings')
        .upsert(update, { onConflict: 'key' })

      if (error) throw error
    }

    return NextResponse.json({
      success: true,
      updated: Object.keys(settings)
    })

  } catch (error) {
    console.error('Failed to update settings:', error)
    return NextResponse.json(
      { error: 'Failed to update settings', details: String(error) },
      { status: 500 }
    )
  }
}
