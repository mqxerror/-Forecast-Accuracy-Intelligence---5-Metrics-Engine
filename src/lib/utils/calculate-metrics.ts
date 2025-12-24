/**
 * Forecast Accuracy Metrics
 *
 * All metrics measure forecast error - lower is better.
 * These are calculated by comparing forecasted values to actual values.
 */

export interface MetricResult {
  value: number
  interpretation: string
  formula: string
}

// ============================================================================
// FORECAST SOURCE TRACKING
// ============================================================================

/**
 * Source of forecast data
 * - inventory_planner: Using actual forecasts from IP
 * - naive_benchmark: No IP forecast, using naive (previous = next)
 * - insufficient_data: Not enough periods to calculate
 */
export type ForecastSource = 'inventory_planner' | 'naive_benchmark' | 'insufficient_data'

/**
 * Data tier based on available periods
 */
export interface DataTier {
  tier: 'full' | 'limited' | 'minimal' | 'insufficient'
  periods: number
  metricsAvailable: string[]
  confidence: 'high' | 'medium' | 'low' | 'none'
  message: string
}

/**
 * Determine data tier based on period count
 */
export function getDataTier(periodCount: number): DataTier {
  if (periodCount >= 12) {
    return {
      tier: 'full',
      periods: periodCount,
      metricsAvailable: ['mape', 'wape', 'rmse', 'wase', 'bias'],
      confidence: 'high',
      message: 'Full historical data available'
    }
  }
  if (periodCount >= 6) {
    return {
      tier: 'limited',
      periods: periodCount,
      metricsAvailable: ['mape', 'wape', 'rmse', 'bias'],
      confidence: 'medium',
      message: 'Limited history - WASE may be unreliable'
    }
  }
  if (periodCount >= 3) {
    return {
      tier: 'minimal',
      periods: periodCount,
      metricsAvailable: ['mape', 'wape', 'bias'],
      confidence: 'low',
      message: 'Minimal data - metrics are directional only'
    }
  }
  return {
    tier: 'insufficient',
    periods: periodCount,
    metricsAvailable: [],
    confidence: 'none',
    message: 'Insufficient data for reliable metrics'
  }
}

/**
 * Select primary metric based on data characteristics
 * - Use WAPE for SKUs with many zero-sales periods
 * - Use MAPE for normal SKUs
 */
export function selectPrimaryMetric(actuals: number[]): 'mape' | 'wape' {
  const zeroCount = actuals.filter(a => a === 0).length
  const zeroRatio = zeroCount / actuals.length

  // If more than 30% zeros, use WAPE as primary
  return zeroRatio > 0.3 ? 'wape' : 'mape'
}

// ============================================================================
// MAPE - Mean Absolute Percentage Error
// ============================================================================

/**
 * MAPE - Mean Absolute Percentage Error
 * Average of absolute percentage errors
 * Good for: Easy interpretation as a percentage
 * Limitation: Undefined when actual = 0, can be skewed by small values
 *
 * Formula: (1/n) * Σ|actual - forecast| / actual * 100
 */
export function calculateMAPE(actual: number[], forecast: number[]): number | null {
  if (actual.length !== forecast.length || actual.length === 0) return null

  // Filter out periods where actual is 0 (undefined MAPE)
  const validPairs = actual
    .map((a, i) => ({ actual: a, forecast: forecast[i] }))
    .filter((pair) => pair.actual !== 0)

  if (validPairs.length === 0) return null

  const sum = validPairs.reduce((acc, { actual, forecast }) => {
    return acc + Math.abs((actual - forecast) / actual)
  }, 0)

  return (sum / validPairs.length) * 100
}

/**
 * Smoothed MAPE that handles zero-sales periods
 * - Perfect prediction of zero counts as 0% error
 * - Actual=0 with non-zero forecast caps at 100% error per period
 *
 * Returns value, periods excluded, and method used
 */
export interface SmoothedMAPEResult {
  value: number | null
  periodsExcluded: number
  zeroPeriods: number
  method: 'standard' | 'smoothed'
}

export function calculateSmoothedMAPE(
  actuals: number[],
  forecasts: number[],
  smoothingFactor: number = 1
): SmoothedMAPEResult {
  if (actuals.length !== forecasts.length || actuals.length === 0) {
    return { value: null, periodsExcluded: 0, zeroPeriods: 0, method: 'standard' }
  }

  let totalError = 0
  let validPeriods = 0
  let excludedPeriods = 0
  let zeroPeriods = 0

  for (let i = 0; i < actuals.length; i++) {
    const actual = actuals[i]
    const forecast = forecasts[i]

    if (actual === 0 && forecast === 0) {
      // Perfect prediction of zero - count as 0% error
      validPeriods++
      zeroPeriods++
      continue
    }

    if (actual === 0) {
      // Use absolute error capped at 100%
      totalError += Math.min(Math.abs(forecast) / smoothingFactor, 1)
      validPeriods++
      excludedPeriods++
      zeroPeriods++
    } else {
      totalError += Math.abs(actual - forecast) / actual
      validPeriods++
    }
  }

  return {
    value: validPeriods > 0 ? (totalError / validPeriods) * 100 : null,
    periodsExcluded: excludedPeriods,
    zeroPeriods,
    method: excludedPeriods > 0 ? 'smoothed' : 'standard'
  }
}

// ============================================================================
// WAPE - Weighted Absolute Percentage Error
// ============================================================================

/**
 * WAPE - Weighted Absolute Percentage Error
 * Total absolute error divided by total actual
 * Good for: Varying SKU volumes (high-volume items weighted more)
 * Better than MAPE when values vary significantly
 *
 * Formula: Σ|actual - forecast| / Σ actual * 100
 */
export function calculateWAPE(actual: number[], forecast: number[]): number | null {
  if (actual.length !== forecast.length || actual.length === 0) return null

  const sumAbsError = actual.reduce(
    (sum, a, i) => sum + Math.abs(a - forecast[i]),
    0
  )
  const sumActual = actual.reduce((sum, a) => sum + a, 0)

  if (sumActual === 0) return null

  return (sumAbsError / sumActual) * 100
}

// ============================================================================
// RMSE - Root Mean Square Error
// ============================================================================

/**
 * RMSE - Root Mean Square Error
 * Square root of average squared errors
 * Good for: Penalizing large errors heavily
 * Use when big misses are much worse than small ones
 *
 * Formula: √[(1/n) * Σ(actual - forecast)²]
 */
export function calculateRMSE(actual: number[], forecast: number[]): number | null {
  if (actual.length !== forecast.length || actual.length === 0) return null

  const sumSquaredErrors = actual.reduce(
    (sum, a, i) => sum + Math.pow(a - forecast[i], 2),
    0
  )

  return Math.sqrt(sumSquaredErrors / actual.length)
}

// ============================================================================
// WASE - Weighted Absolute Scaled Error
// ============================================================================

/**
 * WASE - Weighted Absolute Scaled Error
 * Error scaled by naive forecast error (previous period = next period)
 * Good for: Comparing across different SKUs fairly
 * Value < 1 means better than naive, > 1 means worse
 *
 * Formula: Σ|actual - forecast| / Σ|actual_t - actual_{t-1}|
 */
export function calculateWASE(actual: number[], forecast: number[]): number | null {
  if (actual.length !== forecast.length || actual.length < 2) return null

  // Calculate naive forecast error (sum of |actual_t - actual_{t-1}|)
  let naiveError = 0
  for (let i = 1; i < actual.length; i++) {
    naiveError += Math.abs(actual[i] - actual[i - 1])
  }

  if (naiveError === 0) return null

  const forecastError = actual.reduce(
    (sum, a, i) => sum + Math.abs(a - forecast[i]),
    0
  )

  return forecastError / naiveError
}

// ============================================================================
// Bias - Forecast Bias
// ============================================================================

/**
 * Bias - Forecast Bias
 * Average of (forecast - actual)
 * Positive = over-forecasting, Negative = under-forecasting
 * Good for: Understanding systematic errors
 *
 * Formula: (1/n) * Σ(forecast - actual)
 */
export function calculateBias(actual: number[], forecast: number[]): number | null {
  if (actual.length !== forecast.length || actual.length === 0) return null

  const sum = actual.reduce((acc, a, i) => acc + (forecast[i] - a), 0)
  return sum / actual.length
}

// ============================================================================
// Naive Forecast
// ============================================================================

/**
 * Generate naive forecast (previous period = next period)
 * Used as a baseline for comparison
 */
export function naiveForecast(actual: number[]): number[] {
  if (actual.length === 0) return []
  return [actual[0], ...actual.slice(0, -1)]
}

// ============================================================================
// Combined Metrics Calculation
// ============================================================================

export interface AllMetrics {
  mape: number | null
  wape: number | null
  rmse: number | null
  wase: number | null
  bias: number | null
  naiveMape: number | null
}

export function calculateAllMetrics(
  actual: number[],
  forecast: number[]
): AllMetrics {
  const naive = naiveForecast(actual)

  return {
    mape: calculateMAPE(actual, forecast),
    wape: calculateWAPE(actual, forecast),
    rmse: calculateRMSE(actual, forecast),
    wase: calculateWASE(actual, forecast),
    bias: calculateBias(actual, forecast),
    naiveMape: calculateMAPE(actual, naive),
  }
}

/**
 * Extended metrics calculation with source tracking and data quality
 */
export interface ExtendedMetricsResult {
  metrics: AllMetrics
  source: ForecastSource
  dataTier: DataTier
  primaryMetric: 'mape' | 'wape'
  dataQuality: {
    actualPeriods: number
    forecastPeriods: number
    alignedPeriods: number
    zeroPeriods: number
    mapeMethod: 'standard' | 'smoothed'
  }
}

export function calculateExtendedMetrics(
  actuals: number[],
  forecasts: number[],
  hasIPForecast: boolean
): ExtendedMetricsResult {
  const dataTier = getDataTier(actuals.length)
  const primaryMetric = selectPrimaryMetric(actuals)
  const zeroPeriods = actuals.filter(a => a === 0).length

  // Determine source
  let source: ForecastSource = 'inventory_planner'
  if (dataTier.tier === 'insufficient') {
    source = 'insufficient_data'
  } else if (!hasIPForecast) {
    source = 'naive_benchmark'
  }

  // Calculate smoothed MAPE if there are zero periods
  const smoothedResult = calculateSmoothedMAPE(actuals, forecasts)

  const metrics: AllMetrics = {
    mape: smoothedResult.value,
    wape: calculateWAPE(actuals, forecasts),
    rmse: dataTier.metricsAvailable.includes('rmse') ? calculateRMSE(actuals, forecasts) : null,
    wase: dataTier.metricsAvailable.includes('wase') ? calculateWASE(actuals, forecasts) : null,
    bias: calculateBias(actuals, forecasts),
    naiveMape: calculateMAPE(actuals, naiveForecast(actuals)),
  }

  return {
    metrics,
    source,
    dataTier,
    primaryMetric,
    dataQuality: {
      actualPeriods: actuals.length,
      forecastPeriods: forecasts.length,
      alignedPeriods: Math.min(actuals.length, forecasts.length),
      zeroPeriods,
      mapeMethod: smoothedResult.method
    }
  }
}

// ============================================================================
// Interpretation Helpers
// ============================================================================

export function interpretMAPE(value: number): string {
  if (value < 10) return 'Excellent'
  if (value < 20) return 'Good'
  if (value < 30) return 'Acceptable'
  if (value < 50) return 'Poor'
  return 'Very Poor'
}

export function getMAPETier(value: number): 'excellent' | 'good' | 'acceptable' | 'poor' | 'very_poor' {
  if (value < 10) return 'excellent'
  if (value < 20) return 'good'
  if (value < 30) return 'acceptable'
  if (value < 50) return 'poor'
  return 'very_poor'
}

export function interpretWASE(value: number): string {
  if (value < 0.8) return 'Much better than naive'
  if (value < 1.0) return 'Better than naive'
  if (value === 1.0) return 'Same as naive'
  if (value < 1.2) return 'Slightly worse than naive'
  return 'Worse than naive'
}

export function interpretBias(value: number, avgActual: number): string {
  if (avgActual === 0) return 'Cannot interpret (no sales)'
  const biasPercent = (value / avgActual) * 100
  if (Math.abs(biasPercent) < 5) return 'Well balanced'
  if (biasPercent > 0) return `Over-forecasting by ${biasPercent.toFixed(1)}%`
  return `Under-forecasting by ${Math.abs(biasPercent).toFixed(1)}%`
}

/**
 * Get display label for forecast source
 */
export function getForecastSourceLabel(source: ForecastSource): {
  label: string
  variant: 'default' | 'warning' | 'secondary'
  tooltip: string
} {
  switch (source) {
    case 'inventory_planner':
      return {
        label: 'IP Forecast',
        variant: 'default',
        tooltip: 'Accuracy measured against Inventory Planner forecasts'
      }
    case 'naive_benchmark':
      return {
        label: 'Benchmark Only',
        variant: 'warning',
        tooltip: 'No IP forecast data available. Showing naive benchmark (previous period = next forecast) for reference only.'
      }
    case 'insufficient_data':
      return {
        label: 'Limited Data',
        variant: 'secondary',
        tooltip: 'Fewer than 3 periods of data. Metrics may be unreliable.'
      }
  }
}

/**
 * Get confidence label for data tier
 */
export function getConfidenceLabel(confidence: DataTier['confidence']): {
  label: string
  bars: number
  color: string
} {
  switch (confidence) {
    case 'high':
      return { label: 'High confidence', bars: 4, color: 'bg-green-500' }
    case 'medium':
      return { label: 'Medium confidence', bars: 3, color: 'bg-yellow-500' }
    case 'low':
      return { label: 'Low confidence', bars: 2, color: 'bg-orange-500' }
    case 'none':
      return { label: 'Insufficient data', bars: 0, color: 'bg-gray-300' }
  }
}
