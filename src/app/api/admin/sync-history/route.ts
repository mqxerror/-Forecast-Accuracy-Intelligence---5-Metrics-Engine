import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: records, error } = await supabase
      .from('sync_metrics')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(20)

    if (error) {
      console.error('Error fetching sync history:', error)
      return NextResponse.json({ records: [], error: error.message }, { status: 500 })
    }

    return NextResponse.json({ records: records || [] })
  } catch (error) {
    console.error('Sync history error:', error)
    return NextResponse.json(
      { records: [], error: 'Failed to fetch sync history' },
      { status: 500 }
    )
  }
}
