import { NextResponse } from 'next/server'
import { getUniqueBrands } from '@/lib/supabase/queries/variants'

export async function GET() {
  try {
    const { brands, error } = await getUniqueBrands()

    if (error) {
      return NextResponse.json({ error }, { status: 500 })
    }

    return NextResponse.json({ brands })
  } catch (error) {
    console.error('Brands API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch brands' },
      { status: 500 }
    )
  }
}
