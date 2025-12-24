import { NextRequest, NextResponse } from 'next/server'
import { getMetricsBySku } from '@/lib/supabase/queries/metrics'
import { getVariantBySku } from '@/lib/supabase/queries/variants'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sku: string }> }
) {
  try {
    const { sku } = await params

    const [metricsResult, variantResult] = await Promise.all([
      getMetricsBySku(sku),
      getVariantBySku(sku),
    ])

    if (!metricsResult.metric && !variantResult.variant) {
      return NextResponse.json(
        { error: 'SKU not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      sku,
      metrics: metricsResult.metric,
      variant: variantResult.variant
        ? {
            title: variantResult.variant.title,
            brand: variantResult.variant.brand,
            orders_by_month: variantResult.variant.orders_by_month,
            forecast_by_period: variantResult.variant.forecast_by_period,
          }
        : null,
    })
  } catch (error) {
    console.error('Forecast detail error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch forecast details' },
      { status: 500 }
    )
  }
}
