import { NextRequest, NextResponse } from 'next/server'
import { getVariants } from '@/lib/supabase/queries/variants'
import type { Variant } from '@/types/database'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const orderBy = (searchParams.get('orderBy') || 'replenishment') as keyof Variant
    const orderDirection = (searchParams.get('orderDirection') || 'desc') as 'asc' | 'desc'
    const search = searchParams.get('search') || undefined
    const brand = searchParams.get('brand') || undefined
    const productType = searchParams.get('productType') || undefined
    const minOOS = searchParams.get('minOOS')
      ? parseInt(searchParams.get('minOOS')!)
      : undefined

    const { variants, count, error } = await getVariants({
      limit,
      offset,
      orderBy,
      orderDirection,
      search,
      brand,
      productType,
      minOOS,
    })

    if (error) {
      return NextResponse.json({ error }, { status: 500 })
    }

    return NextResponse.json({
      variants,
      count,
      limit,
      offset,
      hasMore: offset + limit < count,
    })
  } catch (error) {
    console.error('Inventory list error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch inventory' },
      { status: 500 }
    )
  }
}
