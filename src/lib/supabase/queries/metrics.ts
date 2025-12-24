import { createAdminClient } from '../admin'
import type { ForecastMetric } from '@/types/database'

export interface MetricsQueryOptions {
  limit?: number
  offset?: number
  orderBy?: 'mape' | 'wape' | 'rmse' | 'calculated_at'
  orderDirection?: 'asc' | 'desc'
  search?: string
}

/**
 * Get forecast metrics with filtering and pagination
 */
export async function getForecastMetrics(options: MetricsQueryOptions = {}) {
  const {
    limit = 50,
    offset = 0,
    orderBy = 'mape',
    orderDirection = 'asc',
    search,
  } = options

  const supabase = createAdminClient()

  let query = supabase
    .from('forecast_metrics')
    .select('*', { count: 'exact' })

  // Search filter
  if (search) {
    query = query.ilike('sku', `%${search}%`)
  }

  // Ordering
  query = query.order(orderBy, { ascending: orderDirection === 'asc' })

  // Pagination
  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    console.error('Error fetching metrics:', error)
    return { metrics: [], count: 0, error: error.message }
  }

  return { metrics: data || [], count: count || 0, error: null }
}

/**
 * Get metrics for a specific variant
 */
export async function getVariantMetrics(variantId: string) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('forecast_metrics')
    .select('*')
    .eq('variant_id', variantId)
    .order('calculated_at', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    return { metric: null, error: error.message }
  }

  return { metric: data, error: null }
}

/**
 * Get metrics by SKU
 */
export async function getMetricsBySku(sku: string) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('forecast_metrics')
    .select('*')
    .eq('sku', sku)
    .order('calculated_at', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    return { metric: null, error: error.message }
  }

  return { metric: data, error: null }
}

/**
 * Get average accuracy across all SKUs
 */
export async function getAverageAccuracy() {
  const supabase = createAdminClient()

  // Get latest metric for each variant
  const { data, error } = await supabase
    .from('forecast_metrics')
    .select('mape, wape, rmse, wase, bias, naive_mape')
    .not('mape', 'is', null)

  if (error) {
    console.error('Error fetching average accuracy:', error)
    return {
      avgMape: null,
      avgWape: null,
      avgRmse: null,
      avgWase: null,
      avgBias: null,
      avgNaiveMape: null,
      count: 0,
      error: error.message,
    }
  }

  if (!data || data.length === 0) {
    return {
      avgMape: null,
      avgWape: null,
      avgRmse: null,
      avgWase: null,
      avgBias: null,
      avgNaiveMape: null,
      count: 0,
      error: null,
    }
  }

  const count = data.length

  return {
    avgMape: data.reduce((sum, v) => sum + (v.mape || 0), 0) / count,
    avgWape: data.reduce((sum, v) => sum + (v.wape || 0), 0) / count,
    avgRmse: data.reduce((sum, v) => sum + (v.rmse || 0), 0) / count,
    avgWase: data.reduce((sum, v) => sum + (v.wase || 0), 0) / count,
    avgBias: data.reduce((sum, v) => sum + (v.bias || 0), 0) / count,
    avgNaiveMape: data.reduce((sum, v) => sum + (v.naive_mape || 0), 0) / count,
    count,
    error: null,
  }
}

/**
 * Get best and worst performing SKUs by MAPE
 */
export async function getAccuracyExtremes(limit = 5) {
  const supabase = createAdminClient()

  // Best performers (lowest MAPE)
  const { data: bestData, error: bestError } = await supabase
    .from('forecast_metrics')
    .select('sku, mape, wape')
    .not('mape', 'is', null)
    .order('mape', { ascending: true })
    .limit(limit)

  // Worst performers (highest MAPE)
  const { data: worstData, error: worstError } = await supabase
    .from('forecast_metrics')
    .select('sku, mape, wape')
    .not('mape', 'is', null)
    .order('mape', { ascending: false })
    .limit(limit)

  return {
    best: bestData || [],
    worst: worstData || [],
    error: bestError?.message || worstError?.message || null,
  }
}

/**
 * Get metrics distribution for charts
 */
export async function getMetricsDistribution() {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('forecast_metrics')
    .select('mape')
    .not('mape', 'is', null)

  if (error || !data) {
    return { distribution: [], error: error?.message || 'No data' }
  }

  // Bucket the MAPE values
  const buckets = {
    'Excellent (<10%)': 0,
    'Good (10-20%)': 0,
    'Acceptable (20-30%)': 0,
    'Poor (30-50%)': 0,
    'Very Poor (>50%)': 0,
  }

  data.forEach((v) => {
    const mape = v.mape!
    if (mape < 10) buckets['Excellent (<10%)']++
    else if (mape < 20) buckets['Good (10-20%)']++
    else if (mape < 30) buckets['Acceptable (20-30%)']++
    else if (mape < 50) buckets['Poor (30-50%)']++
    else buckets['Very Poor (>50%)']++
  })

  const distribution = Object.entries(buckets).map(([name, count]) => ({
    name,
    count,
    percentage: (count / data.length) * 100,
  }))

  return { distribution, error: null }
}
