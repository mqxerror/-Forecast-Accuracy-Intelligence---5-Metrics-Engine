import { z } from 'zod'

/**
 * IP API Variant schema (from Inventory Planner)
 */
export const ipVariantSchema = z.object({
  id: z.string(),
  sku: z.string(),
  title: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  product_type: z.string().nullable().optional(),
  image: z.string().nullable().optional(),

  // Pricing
  price: z.number().nullable().optional(),
  cost_price: z.number().nullable().optional(),

  // Inventory
  in_stock: z.number().default(0),
  purchase_orders_qty: z.number().default(0),

  // Sales velocity
  last_7_days_sales: z.number().default(0),
  last_30_days_sales: z.number().default(0),
  last_90_days_sales: z.number().default(0),
  last_180_days_sales: z.number().default(0),
  last_365_days_sales: z.number().default(0),
  total_sales: z.number().default(0),

  // Historical data (JSONB)
  orders_by_month: z.record(z.string(), z.record(z.string(), z.number())).nullable().optional(),
  forecast_by_period: z.record(z.string(), z.record(z.string(), z.number())).nullable().optional(),

  // Forecasting
  forecasted_stock: z.number().nullable().optional(),
  current_forecast: z.number().nullable().optional(),

  // Replenishment
  replenishment: z.number().default(0),
  to_order: z.number().default(0),
  minimum_stock: z.number().nullable().optional(),
  lead_time: z.number().nullable().optional(),

  // OOS
  oos: z.number().default(0),
  oos_last_60_days: z.number().default(0),
  forecasted_lost_revenue_lead_time: z.number().nullable().optional(),
})

export type IPVariant = z.infer<typeof ipVariantSchema>

/**
 * Database variant schema (for inserts/updates)
 */
export const dbVariantSchema = z.object({
  id: z.string(),
  sku: z.string(),
  title: z.string().nullable(),
  barcode: z.string().nullable(),
  brand: z.string().nullable(),
  product_type: z.string().nullable(),
  image: z.string().nullable(),
  price: z.number().nullable(),
  cost_price: z.number().nullable(),
  in_stock: z.number(),
  purchase_orders_qty: z.number(),
  last_7_days_sales: z.number(),
  last_30_days_sales: z.number(),
  last_90_days_sales: z.number(),
  last_180_days_sales: z.number(),
  last_365_days_sales: z.number(),
  total_sales: z.number(),
  orders_by_month: z.any().nullable(),
  forecast_by_period: z.any().nullable(),
  forecasted_stock: z.number().nullable(),
  current_forecast: z.number().nullable(),
  replenishment: z.number(),
  to_order: z.number(),
  minimum_stock: z.number().nullable(),
  lead_time: z.number().nullable(),
  oos: z.number(),
  oos_last_60_days: z.number(),
  forecasted_lost_revenue: z.number().nullable(),
  raw_data: z.any().nullable(),
})

export type DbVariant = z.infer<typeof dbVariantSchema>

/**
 * Transform IP variant to database format
 */
export function transformIPVariantToDb(ipVariant: IPVariant): DbVariant {
  return {
    id: ipVariant.id,
    sku: ipVariant.sku,
    title: ipVariant.title ?? null,
    barcode: ipVariant.barcode ?? null,
    brand: ipVariant.brand ?? null,
    product_type: ipVariant.product_type ?? null,
    image: ipVariant.image ?? null,
    price: ipVariant.price ?? null,
    cost_price: ipVariant.cost_price ?? null,
    in_stock: ipVariant.in_stock,
    purchase_orders_qty: ipVariant.purchase_orders_qty,
    last_7_days_sales: ipVariant.last_7_days_sales,
    last_30_days_sales: ipVariant.last_30_days_sales,
    last_90_days_sales: ipVariant.last_90_days_sales,
    last_180_days_sales: ipVariant.last_180_days_sales,
    last_365_days_sales: ipVariant.last_365_days_sales,
    total_sales: ipVariant.total_sales,
    orders_by_month: ipVariant.orders_by_month ?? null,
    forecast_by_period: ipVariant.forecast_by_period ?? null,
    forecasted_stock: ipVariant.forecasted_stock ?? null,
    current_forecast: ipVariant.current_forecast ?? null,
    replenishment: ipVariant.replenishment,
    to_order: ipVariant.to_order,
    minimum_stock: ipVariant.minimum_stock ?? null,
    lead_time: ipVariant.lead_time ?? null,
    oos: ipVariant.oos,
    oos_last_60_days: ipVariant.oos_last_60_days,
    forecasted_lost_revenue: ipVariant.forecasted_lost_revenue_lead_time ?? null,
    raw_data: ipVariant,
  }
}
