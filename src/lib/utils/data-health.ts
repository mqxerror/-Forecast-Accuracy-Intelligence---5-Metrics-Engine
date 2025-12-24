import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Data Health Score System
 *
 * Calculates an overall data quality score based on:
 * - Field completeness
 * - Cost data coverage
 * - Forecast data coverage
 * - Data freshness
 */

export interface DataHealthScore {
  overall: number // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  components: {
    fieldCompleteness: {
      score: number
      details: Record<string, { count: number; total: number; percentage: number }>
    }
    costDataCoverage: {
      score: number
      skusWithCost: number
      total: number
    }
    forecastDataCoverage: {
      score: number
      skusWithForecast: number
      skusWithOrders: number
      total: number
    }
    metricsCalculated: {
      score: number
      skusWithMetrics: number
      total: number
    }
    dataFreshness: {
      score: number
      lastSync: string | null
      hoursSinceSync: number
    }
    stockHealth: {
      score: number
      negativeStock: number
      zeroStock: number
      healthyStock: number
    }
  }
  issues: { severity: 'critical' | 'warning' | 'info'; message: string; action: string }[]
  recommendations: string[]
}

/**
 * Calculate comprehensive data health score
 */
export async function calculateDataHealth(): Promise<DataHealthScore> {
  const supabase = createAdminClient()

  // Fetch all variants with relevant fields
  const { data: variants, error: variantsError } = await supabase
    .from('variants')
    .select('id, sku, title, price, cost_price, in_stock, orders_by_month, forecast_by_period')

  if (variantsError || !variants) {
    throw new Error(`Failed to fetch variants: ${variantsError?.message}`)
  }

  // Fetch metrics count
  const { count: metricsCount } = await supabase
    .from('forecast_metrics')
    .select('*', { count: 'exact', head: true })

  // Fetch last sync
  const { data: lastSync } = await supabase
    .from('sync_metrics')
    .select('completed_at, status')
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .single()

  const total = variants.length

  if (total === 0) {
    return createEmptyHealthScore()
  }

  // Calculate field completeness
  const requiredFields = ['sku', 'title', 'price', 'cost_price', 'in_stock']
  const fieldDetails: DataHealthScore['components']['fieldCompleteness']['details'] = {}

  for (const field of requiredFields) {
    const count = variants.filter(v => v[field as keyof typeof v] != null).length
    fieldDetails[field] = {
      count,
      total,
      percentage: (count / total) * 100
    }
  }

  const completenessScore =
    Object.values(fieldDetails).reduce((sum, f) => sum + f.percentage, 0) / requiredFields.length

  // Cost coverage
  const skusWithCost = variants.filter(v => v.cost_price != null && Number(v.cost_price) > 0).length
  const costScore = (skusWithCost / total) * 100

  // Forecast/orders coverage
  const skusWithForecast = variants.filter(v =>
    v.forecast_by_period && Object.keys(v.forecast_by_period as object).length > 0
  ).length
  const skusWithOrders = variants.filter(v =>
    v.orders_by_month && Object.keys(v.orders_by_month as object).length > 0
  ).length
  const forecastScore = ((skusWithForecast + skusWithOrders) / (total * 2)) * 100

  // Metrics calculated
  const skusWithMetrics = metricsCount || 0
  const metricsScore = total > 0 ? (skusWithMetrics / total) * 100 : 0

  // Freshness
  const hoursSinceSync = lastSync?.completed_at
    ? (Date.now() - new Date(lastSync.completed_at).getTime()) / (1000 * 60 * 60)
    : 999
  const freshnessScore = Math.max(0, 100 - hoursSinceSync * 2) // Lose 2 points per hour

  // Stock health
  const negativeStock = variants.filter(v => Number(v.in_stock) < 0).length
  const zeroStock = variants.filter(v => Number(v.in_stock) === 0).length
  const healthyStock = total - negativeStock - zeroStock
  const stockScore = (healthyStock / total) * 100

  // Calculate overall score (weighted)
  const overall =
    completenessScore * 0.2 +
    costScore * 0.25 +
    forecastScore * 0.2 +
    metricsScore * 0.15 +
    freshnessScore * 0.1 +
    stockScore * 0.1

  // Determine grade
  const grade = getGrade(overall)

  // Generate issues and recommendations
  const issues: DataHealthScore['issues'] = []
  const recommendations: string[] = []

  // Cost issues
  if (costScore < 50) {
    issues.push({
      severity: 'critical',
      message: `Only ${costScore.toFixed(0)}% of SKUs have cost data`,
      action: 'Check field mapping in Admin > Field Mapping'
    })
    recommendations.push('Verify cost_price field name matches your Inventory Planner export')
  } else if (costScore < 80) {
    issues.push({
      severity: 'warning',
      message: `${(100 - costScore).toFixed(0)}% of SKUs missing cost data`,
      action: 'Review data quality in Inventory Planner'
    })
  }

  // Forecast issues
  if (skusWithForecast < total * 0.3) {
    issues.push({
      severity: 'warning',
      message: 'Most SKUs missing forecast data from Inventory Planner',
      action: 'Ensure forecast_by_period is exported'
    })
    recommendations.push('Configure Inventory Planner to export forecast_by_period field')
  }

  // Sales history issues
  if (skusWithOrders < total * 0.5) {
    issues.push({
      severity: 'warning',
      message: `Only ${((skusWithOrders / total) * 100).toFixed(0)}% have sales history`,
      action: 'Needed for accuracy metrics'
    })
  }

  // Freshness issues
  if (hoursSinceSync > 48) {
    issues.push({
      severity: 'warning',
      message: `Data is ${Math.round(hoursSinceSync)} hours old`,
      action: 'Run a new sync'
    })
    recommendations.push('Set up automated daily sync via n8n webhook')
  } else if (hoursSinceSync > 24) {
    issues.push({
      severity: 'info',
      message: `Last sync was ${Math.round(hoursSinceSync)} hours ago`,
      action: 'Consider more frequent syncs'
    })
  }

  // Stock issues
  if (negativeStock > 0) {
    issues.push({
      severity: 'info',
      message: `${negativeStock} SKUs have negative stock (backorders)`,
      action: 'Review order fulfillment'
    })
  }

  // Add recommendations based on metrics
  if (metricsScore < 50 && skusWithOrders > total * 0.5) {
    recommendations.push('Run a sync to calculate forecast accuracy metrics')
  }

  return {
    overall,
    grade,
    components: {
      fieldCompleteness: {
        score: completenessScore,
        details: fieldDetails
      },
      costDataCoverage: {
        score: costScore,
        skusWithCost,
        total
      },
      forecastDataCoverage: {
        score: forecastScore,
        skusWithForecast,
        skusWithOrders,
        total
      },
      metricsCalculated: {
        score: metricsScore,
        skusWithMetrics,
        total
      },
      dataFreshness: {
        score: freshnessScore,
        lastSync: lastSync?.completed_at || null,
        hoursSinceSync
      },
      stockHealth: {
        score: stockScore,
        negativeStock,
        zeroStock,
        healthyStock
      }
    },
    issues,
    recommendations
  }
}

function getGrade(score: number): DataHealthScore['grade'] {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

function createEmptyHealthScore(): DataHealthScore {
  return {
    overall: 0,
    grade: 'F',
    components: {
      fieldCompleteness: { score: 0, details: {} },
      costDataCoverage: { score: 0, skusWithCost: 0, total: 0 },
      forecastDataCoverage: { score: 0, skusWithForecast: 0, skusWithOrders: 0, total: 0 },
      metricsCalculated: { score: 0, skusWithMetrics: 0, total: 0 },
      dataFreshness: { score: 0, lastSync: null, hoursSinceSync: 999 },
      stockHealth: { score: 0, negativeStock: 0, zeroStock: 0, healthyStock: 0 }
    },
    issues: [
      {
        severity: 'critical',
        message: 'No data imported yet',
        action: 'Import data from Inventory Planner'
      }
    ],
    recommendations: ['Import your first dataset using the Upload JSON button or n8n webhook']
  }
}

/**
 * Quick health check - returns just the overall score and critical issues
 */
export async function getQuickHealthCheck(): Promise<{
  score: number
  grade: DataHealthScore['grade']
  criticalIssues: number
  warnings: number
}> {
  const health = await calculateDataHealth()
  return {
    score: health.overall,
    grade: health.grade,
    criticalIssues: health.issues.filter(i => i.severity === 'critical').length,
    warnings: health.issues.filter(i => i.severity === 'warning').length
  }
}
