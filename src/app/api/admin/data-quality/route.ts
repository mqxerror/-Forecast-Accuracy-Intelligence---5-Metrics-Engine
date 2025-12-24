import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Get all variants for analysis
    const { data: variants, error: variantsError } = await supabase
      .from('variants')
      .select('id, cost_price, price, orders_by_month, forecast_by_period, in_stock')

    if (variantsError) {
      console.error('Error fetching variants:', variantsError)
      return NextResponse.json({ error: variantsError.message }, { status: 500 })
    }

    // Get metrics count
    const { count: metricsCount, error: metricsError } = await supabase
      .from('forecast_metrics')
      .select('*', { count: 'exact', head: true })

    if (metricsError) {
      console.error('Error fetching metrics count:', metricsError)
    }

    const total = variants?.length || 0

    // Calculate quality metrics
    const quality = {
      totalVariants: total,
      withCost: variants?.filter(v => v.cost_price != null && v.cost_price > 0).length || 0,
      withPrice: variants?.filter(v => v.price != null && v.price > 0).length || 0,
      withForecasts: variants?.filter(v =>
        v.forecast_by_period != null &&
        typeof v.forecast_by_period === 'object' &&
        Object.keys(v.forecast_by_period).length > 0
      ).length || 0,
      withSalesHistory: variants?.filter(v =>
        v.orders_by_month != null &&
        typeof v.orders_by_month === 'object' &&
        Object.keys(v.orders_by_month).length > 0
      ).length || 0,
      withMetrics: metricsCount || 0,
      negativeStock: variants?.filter(v => (v.in_stock || 0) < 0).length || 0,
      zeroStock: variants?.filter(v => (v.in_stock || 0) === 0).length || 0,
      missingFields: [] as Array<{ field: string; count: number; percentage: number }>,
    }

    // Calculate missing fields breakdown
    const fields = [
      { field: 'cost_price', present: quality.withCost },
      { field: 'price', present: quality.withPrice },
      { field: 'forecast_by_period', present: quality.withForecasts },
      { field: 'orders_by_month', present: quality.withSalesHistory },
    ]

    quality.missingFields = fields.map(f => ({
      field: f.field,
      count: total - f.present,
      percentage: total > 0 ? ((total - f.present) / total) * 100 : 0,
    })).filter(f => f.count > 0)

    return NextResponse.json(quality)
  } catch (error) {
    console.error('Data quality error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze data quality' },
      { status: 500 }
    )
  }
}
