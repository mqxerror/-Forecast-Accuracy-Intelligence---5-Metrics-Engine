import { z } from 'zod'

/**
 * Zod schema for validating variant data from Inventory Planner imports
 *
 * Validation rules:
 * - id and sku are required
 * - Prices/costs cannot be negative
 * - in_stock can be negative (backorders allowed)
 * - Sales figures must be non-negative
 * - Lead time has reasonable bounds (0-365 days)
 */
export const variantSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(v => String(v)),
  sku: z.string().min(1, 'SKU is required'),
  title: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  product_type: z.string().nullable().optional(),
  image: z.string().nullable().optional(),

  // Price validation - cannot be negative
  price: z.number().min(0, 'Price cannot be negative').nullable().optional(),
  cost_price: z.number().min(0, 'Cost cannot be negative').nullable().optional(),
  cost: z.number().min(0).nullable().optional(),
  unit_cost: z.number().min(0).nullable().optional(),
  average_cost: z.number().min(0).nullable().optional(),
  cogs: z.number().min(0).nullable().optional(),

  // Stock validation - negative allowed for backorders
  in_stock: z.number().default(0),
  purchase_orders_qty: z.number().min(0, 'PO quantity cannot be negative').default(0),

  // Sales validation - must be non-negative
  last_7_days_sales: z.number().min(0).default(0),
  last_30_days_sales: z.number().min(0).default(0),
  last_90_days_sales: z.number().min(0).default(0),
  last_180_days_sales: z.number().min(0).default(0),
  last_365_days_sales: z.number().min(0).default(0),
  total_sales: z.number().min(0).default(0),

  // Replenishment fields
  replenishment: z.number().default(0),
  to_order: z.number().default(0),
  minimum_stock: z.number().min(0).nullable().optional(),

  // Lead time validation - reasonable bounds
  lead_time: z.number().min(0).max(365, 'Lead time over 365 days is suspicious').nullable().optional(),

  // OOS validation
  oos: z.number().min(0).default(0),
  oos_last_60_days: z.number().min(0).max(60).default(0),

  // Revenue
  forecasted_lost_revenue_lead_time: z.number().nullable().optional(),
  forecasted_lost_revenue: z.number().nullable().optional(),

  // Forecast fields
  forecasted_stock: z.number().nullable().optional(),
  current_forecast: z.number().nullable().optional(),

  // JSON fields - allow any structure, validate in business logic
  orders_by_month: z.record(z.record(z.number())).nullable().optional(),
  forecast_by_period: z.record(z.record(z.number())).nullable().optional(),
}).passthrough() // Allow extra fields for raw_data storage

export type ValidatedVariant = z.infer<typeof variantSchema>

/**
 * Validation result for a batch of variants
 */
export interface ValidationResult {
  valid: ValidatedVariant[]
  invalid: {
    index: number
    sku: string
    errors: { field: string; message: string; value: unknown }[]
  }[]
  warnings: {
    index: number
    sku: string
    warnings: { field: string; message: string; value: unknown }[]
  }[]
  summary: {
    total: number
    passed: number
    failed: number
    withWarnings: number
  }
}

/**
 * Validate an array of variant data
 * Returns valid records, invalid records with errors, and warnings
 */
export function validateVariants(data: unknown[]): ValidationResult {
  const result: ValidationResult = {
    valid: [],
    invalid: [],
    warnings: [],
    summary: { total: data.length, passed: 0, failed: 0, withWarnings: 0 }
  }

  for (let i = 0; i < data.length; i++) {
    const item = data[i] as Record<string, unknown>
    const sku = item?.sku ? String(item.sku) : `index-${i}`

    // Schema validation
    const parseResult = variantSchema.safeParse(item)

    if (!parseResult.success) {
      result.invalid.push({
        index: i,
        sku,
        errors: parseResult.error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
          value: item?.[e.path[0] as string]
        }))
      })
      result.summary.failed++
      continue
    }

    // Business logic warnings
    const warnings: ValidationResult['warnings'][0]['warnings'] = []
    const validItem = parseResult.data

    // Check sales consistency - 30-day shouldn't exceed 90-day
    if (validItem.last_30_days_sales > validItem.last_90_days_sales && validItem.last_90_days_sales > 0) {
      warnings.push({
        field: 'last_30_days_sales',
        message: '30-day sales exceeds 90-day sales',
        value: validItem.last_30_days_sales
      })
    }

    // Check margin sanity - cost shouldn't exceed price
    const costValue = validItem.cost_price || validItem.cost || validItem.unit_cost || validItem.average_cost || validItem.cogs
    if (validItem.price && costValue && costValue > validItem.price) {
      warnings.push({
        field: 'cost_price',
        message: 'Cost exceeds selling price (negative margin)',
        value: costValue
      })
    }

    // Check for future dates in orders_by_month
    if (validItem.orders_by_month) {
      const currentYear = new Date().getFullYear()
      const currentMonth = new Date().getMonth() + 1

      for (const [year, months] of Object.entries(validItem.orders_by_month)) {
        if (typeof months === 'object' && months !== null) {
          for (const month of Object.keys(months)) {
            if (Number(year) > currentYear ||
              (Number(year) === currentYear && Number(month) > currentMonth)) {
              warnings.push({
                field: 'orders_by_month',
                message: `Future date in sales history: ${year}-${month}`,
                value: `${year}-${month}`
              })
            }
          }
        }
      }
    }

    // Check for extremely high values that might indicate data issues
    if (validItem.in_stock > 1000000) {
      warnings.push({
        field: 'in_stock',
        message: 'Unusually high stock quantity (over 1M units)',
        value: validItem.in_stock
      })
    }

    if (warnings.length > 0) {
      result.warnings.push({ index: i, sku, warnings })
      result.summary.withWarnings++
    }

    result.valid.push(validItem)
    result.summary.passed++
  }

  return result
}

/**
 * Get a summary of validation errors grouped by error type
 */
export function getErrorSummary(result: ValidationResult): Record<string, number> {
  const summary: Record<string, number> = {}

  for (const invalid of result.invalid) {
    for (const error of invalid.errors) {
      const key = `${error.field}: ${error.message}`
      summary[key] = (summary[key] || 0) + 1
    }
  }

  return summary
}

/**
 * Get a summary of warnings grouped by warning type
 */
export function getWarningSummary(result: ValidationResult): Record<string, number> {
  const summary: Record<string, number> = {}

  for (const warned of result.warnings) {
    for (const warning of warned.warnings) {
      const key = `${warning.field}: ${warning.message}`
      summary[key] = (summary[key] || 0) + 1
    }
  }

  return summary
}
