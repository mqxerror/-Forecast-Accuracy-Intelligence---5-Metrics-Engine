import { NextRequest, NextResponse } from 'next/server'
import { getForecastMetrics, getAverageAccuracy, getMetricsDistribution, getAccuracyExtremes } from '@/lib/supabase/queries/metrics'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const view = searchParams.get('view') || 'overview'

    if (view === 'overview') {
      // Get summary stats for the overview page
      const [avgResult, distributionResult, extremesResult] = await Promise.all([
        getAverageAccuracy(),
        getMetricsDistribution(),
        getAccuracyExtremes(5),
      ])

      return NextResponse.json({
        averages: {
          mape: avgResult.avgMape,
          wape: avgResult.avgWape,
          rmse: avgResult.avgRmse,
          wase: avgResult.avgWase,
          bias: avgResult.avgBias,
          naiveMape: avgResult.avgNaiveMape,
          skuCount: avgResult.count,
        },
        distribution: distributionResult.distribution,
        best: extremesResult.best,
        worst: extremesResult.worst,
      })
    }

    // List view with pagination
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const orderBy = (searchParams.get('orderBy') || 'mape') as 'mape' | 'wape' | 'rmse' | 'calculated_at'
    const orderDirection = (searchParams.get('orderDirection') || 'asc') as 'asc' | 'desc'
    const search = searchParams.get('search') || undefined

    const { metrics, count, error } = await getForecastMetrics({
      limit,
      offset,
      orderBy,
      orderDirection,
      search,
    })

    if (error) {
      return NextResponse.json({ error }, { status: 500 })
    }

    return NextResponse.json({
      metrics,
      count,
      limit,
      offset,
      hasMore: offset + limit < count,
    })
  } catch (error) {
    console.error('Forecasts error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch forecast metrics' },
      { status: 500 }
    )
  }
}
