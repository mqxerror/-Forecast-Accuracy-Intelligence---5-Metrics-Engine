import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const sku = searchParams.get('sku')
    const limit = parseInt(searchParams.get('limit') || '20')

    // Build query for variants
    let query = supabase
      .from('variants')
      .select(`
        id,
        sku,
        title,
        cost_price,
        price,
        in_stock,
        orders_by_month,
        forecast_by_period,
        raw_data
      `)
      .order('synced_at', { ascending: false })

    if (sku) {
      query = query.ilike('sku', `%${sku}%`)
    }

    query = query.limit(limit)

    const { data: variants, error: variantsError } = await query

    if (variantsError) {
      console.error('Error fetching variants:', variantsError)
      return NextResponse.json({ variants: [], error: variantsError.message }, { status: 500 })
    }

    // Get metrics for these variants
    const skus = variants?.map(v => v.sku) || []

    let metricsMap: Record<string, {
      mape: number | null
      wape: number | null
      actual_values: number[] | null
      forecast_values: number[] | null
    }> = {}

    if (skus.length > 0) {
      const { data: metrics } = await supabase
        .from('forecast_metrics')
        .select('sku, mape, wape, actual_values, forecast_values')
        .in('sku', skus)

      if (metrics) {
        metricsMap = metrics.reduce((acc, m) => {
          acc[m.sku] = {
            mape: m.mape,
            wape: m.wape,
            actual_values: m.actual_values as number[] | null,
            forecast_values: m.forecast_values as number[] | null,
          }
          return acc
        }, {} as typeof metricsMap)
      }
    }

    // Combine variants with metrics
    const enrichedVariants = variants?.map(v => ({
      ...v,
      metrics: metricsMap[v.sku] || null,
    })) || []

    return NextResponse.json({ variants: enrichedVariants })
  } catch (error) {
    console.error('Variants debug error:', error)
    return NextResponse.json(
      { variants: [], error: 'Failed to fetch variants' },
      { status: 500 }
    )
  }
}
