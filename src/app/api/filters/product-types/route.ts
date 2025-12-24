import { NextResponse } from 'next/server'
import { getUniqueProductTypes } from '@/lib/supabase/queries/variants'

export async function GET() {
  try {
    const { productTypes, error } = await getUniqueProductTypes()

    if (error) {
      return NextResponse.json({ error }, { status: 500 })
    }

    return NextResponse.json({ productTypes })
  } catch (error) {
    console.error('Product types API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch product types' },
      { status: 500 }
    )
  }
}
