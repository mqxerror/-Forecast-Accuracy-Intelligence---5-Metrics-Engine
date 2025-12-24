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

/**
 * Generate naive forecast (previous period = next period)
 * Used as a baseline for comparison
 */
export function naiveForecast(actual: number[]): number[] {
  if (actual.length === 0) return []
  return [actual[0], ...actual.slice(0, -1)]
}

/**
 * Calculate all metrics at once
 */
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
 * Get interpretation for metric value
 */
export function interpretMAPE(value: number): string {
  if (value < 10) return 'Excellent'
  if (value < 20) return 'Good'
  if (value < 30) return 'Acceptable'
  if (value < 50) return 'Poor'
  return 'Very Poor'
}

export function interpretWASE(value: number): string {
  if (value < 0.8) return 'Much better than naive'
  if (value < 1.0) return 'Better than naive'
  if (value === 1.0) return 'Same as naive'
  if (value < 1.2) return 'Slightly worse than naive'
  return 'Worse than naive'
}

export function interpretBias(value: number, avgActual: number): string {
  const biasPercent = (value / avgActual) * 100
  if (Math.abs(biasPercent) < 5) return 'Well balanced'
  if (biasPercent > 0) return `Over-forecasting by ${biasPercent.toFixed(1)}%`
  return `Under-forecasting by ${Math.abs(biasPercent).toFixed(1)}%`
}
