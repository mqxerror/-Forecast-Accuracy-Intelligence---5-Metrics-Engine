import { NextRequest, NextResponse } from 'next/server'
import { getTopPriorityItems, getOutOfStockItems } from '@/lib/supabase/queries/variants'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'reorder'
    const limit = parseInt(searchParams.get('limit') || '10')

    let result

    if (type === 'oos') {
      result = await getOutOfStockItems(limit)
    } else {
      result = await getTopPriorityItems(limit)
    }

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      items: result.items,
      type,
    })
  } catch (error) {
    console.error('Priority items error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch priority items' },
      { status: 500 }
    )
  }
}
