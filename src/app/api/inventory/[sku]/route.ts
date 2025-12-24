import { NextRequest, NextResponse } from 'next/server'
import { getVariantBySku } from '@/lib/supabase/queries/variants'
import { getMetricsBySku } from '@/lib/supabase/queries/metrics'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sku: string }> }
) {
  try {
    const { sku } = await params

    const [variantResult, metricsResult] = await Promise.all([
      getVariantBySku(sku),
      getMetricsBySku(sku),
    ])

    if (variantResult.error || !variantResult.variant) {
      return NextResponse.json(
        { error: 'Variant not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      variant: variantResult.variant,
      metrics: metricsResult.metric,
    })
  } catch (error) {
    console.error('Variant detail error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch variant' },
      { status: 500 }
    )
  }
}
