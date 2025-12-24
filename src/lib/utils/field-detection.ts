/**
 * Field Detection Utility
 *
 * Auto-detects which field names from Inventory Planner
 * should map to our database columns.
 */

export interface FieldDetectionResult {
  detectedField: string | null
  coverage: number
  alternatives: { field: string; count: number; coverage: number; sample: unknown }[]
}

export interface FieldMappingDetection {
  cost: FieldDetectionResult
  lostRevenue: FieldDetectionResult
  needsConfirmation: boolean
  summary: string
}

/**
 * Possible field names for cost in Inventory Planner exports
 */
const COST_FIELD_NAMES = [
  'cost_price',
  'cost',
  'unit_cost',
  'average_cost',
  'cogs',
  'purchase_price',
  'landed_cost'
]

/**
 * Possible field names for lost revenue
 */
const LOST_REVENUE_FIELD_NAMES = [
  'forecasted_lost_revenue_lead_time',
  'forecasted_lost_revenue',
  'lost_revenue',
  'potential_lost_revenue',
  'oos_lost_revenue'
]

/**
 * Detect which field contains cost data
 */
export function detectCostField(variants: Record<string, unknown>[]): FieldDetectionResult {
  return detectFieldFromCandidates(variants, COST_FIELD_NAMES)
}

/**
 * Detect which field contains lost revenue data
 */
export function detectLostRevenueField(variants: Record<string, unknown>[]): FieldDetectionResult {
  return detectFieldFromCandidates(variants, LOST_REVENUE_FIELD_NAMES)
}

/**
 * Generic field detection from a list of candidates
 */
function detectFieldFromCandidates(
  variants: Record<string, unknown>[],
  candidates: string[]
): FieldDetectionResult {
  if (variants.length === 0) {
    return {
      detectedField: null,
      coverage: 0,
      alternatives: []
    }
  }

  const results = candidates.map(field => {
    const withValue = variants.filter(v => {
      const value = v[field]
      return value != null && !isNaN(Number(value)) && Number(value) !== 0
    })

    return {
      field,
      count: withValue.length,
      coverage: withValue.length / variants.length,
      sample: withValue[0]?.[field]
    }
  })

  // Sort by coverage (highest first)
  const sorted = results.sort((a, b) => b.count - a.count)

  // Pick field with highest coverage
  const best = sorted[0]

  return {
    detectedField: best.count > 0 ? best.field : null,
    coverage: best.coverage,
    alternatives: sorted.filter(r => r.count > 0)
  }
}

/**
 * Detect all field mappings for a variant import
 */
export function detectFieldMappings(variants: Record<string, unknown>[]): FieldMappingDetection {
  const cost = detectCostField(variants)
  const lostRevenue = detectLostRevenueField(variants)

  // Need confirmation if cost coverage is below 80% or multiple alternatives exist
  const needsConfirmation =
    cost.coverage < 0.8 ||
    (cost.alternatives.length > 1 && cost.alternatives[1].coverage > 0.1)

  // Build summary message
  const summaryParts: string[] = []

  if (cost.detectedField) {
    summaryParts.push(
      `Cost field: "${cost.detectedField}" (${(cost.coverage * 100).toFixed(0)}% coverage)`
    )
  } else {
    summaryParts.push('Cost field: Not detected')
  }

  if (lostRevenue.detectedField) {
    summaryParts.push(
      `Lost revenue: "${lostRevenue.detectedField}" (${(lostRevenue.coverage * 100).toFixed(0)}% coverage)`
    )
  }

  return {
    cost,
    lostRevenue,
    needsConfirmation,
    summary: summaryParts.join('; ')
  }
}

/**
 * Get cost value from a variant using detected or configured field
 */
export function getCostValue(
  variant: Record<string, unknown>,
  configuredField?: string
): number | null {
  // Use configured field if provided
  if (configuredField && variant[configuredField] != null) {
    const value = Number(variant[configuredField])
    return isNaN(value) ? null : value
  }

  // Fall back to checking all possible fields
  for (const field of COST_FIELD_NAMES) {
    if (variant[field] != null) {
      const value = Number(variant[field])
      if (!isNaN(value)) return value
    }
  }

  return null
}

/**
 * Get lost revenue value from a variant
 */
export function getLostRevenueValue(
  variant: Record<string, unknown>,
  configuredField?: string
): number | null {
  if (configuredField && variant[configuredField] != null) {
    const value = Number(variant[configuredField])
    return isNaN(value) ? null : value
  }

  for (const field of LOST_REVENUE_FIELD_NAMES) {
    if (variant[field] != null) {
      const value = Number(variant[field])
      if (!isNaN(value)) return value
    }
  }

  return null
}

/**
 * Discover all unique field names in a variant dataset
 * Useful for debugging and field mapping UI
 */
export function discoverAllFields(variants: Record<string, unknown>[]): {
  field: string
  type: string
  nonNullCount: number
  sampleValue: unknown
}[] {
  if (variants.length === 0) return []

  const fieldStats: Record<string, { type: Set<string>; nonNullCount: number; sample: unknown }> = {}

  for (const variant of variants) {
    for (const [field, value] of Object.entries(variant)) {
      if (!fieldStats[field]) {
        fieldStats[field] = { type: new Set(), nonNullCount: 0, sample: undefined }
      }

      if (value != null) {
        fieldStats[field].nonNullCount++
        fieldStats[field].type.add(typeof value)
        if (fieldStats[field].sample === undefined) {
          fieldStats[field].sample = value
        }
      }
    }
  }

  return Object.entries(fieldStats)
    .map(([field, stats]) => ({
      field,
      type: Array.from(stats.type).join('|'),
      nonNullCount: stats.nonNullCount,
      sampleValue: stats.sample
    }))
    .sort((a, b) => b.nonNullCount - a.nonNullCount)
}
