import { createAdminClient } from '../admin'
import type { Variant } from '@/types/database'

// Columns for list views (excludes heavy JSON fields)
const VARIANT_LIST_COLUMNS = `
  id, sku, title, barcode, brand, product_type, image,
  price, cost_price, in_stock, purchase_orders_qty,
  last_7_days_sales, last_30_days_sales, last_90_days_sales,
  last_180_days_sales, last_365_days_sales, total_sales,
  forecasted_stock, current_forecast, replenishment, to_order,
  minimum_stock, lead_time, oos, oos_last_60_days,
  forecasted_lost_revenue, synced_at, created_at, updated_at
` as const

// Full columns including JSON data (for detail views only)
const VARIANT_DETAIL_COLUMNS = '*'

export interface VariantQueryOptions {
  limit?: number
  offset?: number
  orderBy?: keyof Variant
  orderDirection?: 'asc' | 'desc'
  search?: string
  brand?: string
  productType?: string
  minOOS?: number
}

/**
 * Get variants with filtering and pagination
 */
export async function getVariants(options: VariantQueryOptions = {}) {
  const {
    limit = 50,
    offset = 0,
    orderBy = 'replenishment',
    orderDirection = 'desc',
    search,
    brand,
    productType,
    minOOS,
  } = options

  const supabase = createAdminClient()

  let query = supabase
    .from('variants')
    .select(VARIANT_LIST_COLUMNS, { count: 'exact' })

  // Search filter
  if (search) {
    query = query.or(`sku.ilike.%${search}%,title.ilike.%${search}%`)
  }

  // Brand filter
  if (brand) {
    query = query.eq('brand', brand)
  }

  // Product type filter
  if (productType) {
    query = query.eq('product_type', productType)
  }

  // OOS filter
  if (minOOS !== undefined) {
    query = query.gte('oos', minOOS)
  }

  // Ordering
  query = query.order(orderBy, { ascending: orderDirection === 'asc' })

  // Pagination
  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    console.error('Error fetching variants:', error)
    return { variants: [], count: 0, error: error.message }
  }

  return { variants: data || [], count: count || 0, error: null }
}

/**
 * Get a single variant by SKU
 */
export async function getVariantBySku(sku: string): Promise<{ variant: Variant | null; error: string | null }> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('variants')
    .select('*')
    .eq('sku', sku)
    .single()

  if (error) {
    return { variant: null, error: error.message }
  }

  return { variant: data, error: null }
}

/**
 * Get a single variant by ID
 */
export async function getVariantById(id: string) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('variants')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    return { variant: null, error: error.message }
  }

  return { variant: data, error: null }
}

/**
 * Get top priority items (highest replenishment needs)
 */
export async function getTopPriorityItems(limit = 10) {
  const supabase = createAdminClient()

  // Get total count first
  const { count: totalCount } = await supabase
    .from('variants')
    .select('*', { count: 'exact', head: true })
    .gt('replenishment', 0)

  const { data, error } = await supabase
    .from('variants')
    .select('id, sku, title, brand, in_stock, replenishment, to_order, lead_time, oos, forecasted_lost_revenue')
    .gt('replenishment', 0)
    .order('replenishment', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching priority items:', error)
    return { items: [], totalCount: 0, error: error.message }
  }

  return { items: data || [], totalCount: totalCount || 0, error: null }
}

/**
 * Get out-of-stock items (in_stock <= 0)
 * Ordered by days OOS (oos field) to show longest OOS items first
 */
export async function getOutOfStockItems(limit = 50) {
  const supabase = createAdminClient()

  // Get total count of currently out of stock items (in_stock <= 0)
  const { count: totalCount } = await supabase
    .from('variants')
    .select('*', { count: 'exact', head: true })
    .lte('in_stock', 0)

  // Get items ordered by how long they've been OOS
  const { data, error } = await supabase
    .from('variants')
    .select('id, sku, title, brand, in_stock, oos, oos_last_60_days, forecasted_lost_revenue, replenishment, to_order, lead_time')
    .lte('in_stock', 0)
    .order('oos', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching OOS items:', error)
    return { items: [], totalCount: 0, error: error.message }
  }

  return { items: data || [], totalCount: totalCount || 0, error: null }
}

/**
 * Get unique brands for filtering
 */
export async function getUniqueBrands() {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('variants')
    .select('brand')
    .not('brand', 'is', null)
    .order('brand')

  if (error) {
    return { brands: [], error: error.message }
  }

  // Get unique values
  const uniqueBrands = [...new Set(data?.map((v) => v.brand).filter(Boolean))]
  return { brands: uniqueBrands as string[], error: null }
}

/**
 * Get unique product types for filtering
 */
export async function getUniqueProductTypes() {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('variants')
    .select('product_type')
    .not('product_type', 'is', null)
    .order('product_type')

  if (error) {
    return { productTypes: [], error: error.message }
  }

  const uniqueTypes = [...new Set(data?.map((v) => v.product_type).filter(Boolean))]
  return { productTypes: uniqueTypes as string[], error: null }
}

/**
 * Get inventory stats
 */
export async function getInventoryStats() {
  const supabase = createAdminClient()

  // Get total count
  const { count: totalSkus } = await supabase
    .from('variants')
    .select('*', { count: 'exact', head: true })

  // Get CURRENTLY out of stock items (in_stock <= 0)
  // This is what users expect "Out of Stock" to mean
  const { count: oosCount } = await supabase
    .from('variants')
    .select('*', { count: 'exact', head: true })
    .lte('in_stock', 0)

  // Get items needing reorder (replenishment > 0)
  const { count: reorderCount } = await supabase
    .from('variants')
    .select('*', { count: 'exact', head: true })
    .gt('replenishment', 0)

  // Get total value (in_stock * cost_price)
  const { data: valueData } = await supabase
    .from('variants')
    .select('in_stock, cost_price')

  const totalValue = valueData?.reduce((sum, v) => {
    return sum + (v.in_stock || 0) * (v.cost_price || 0)
  }, 0) || 0

  // Get total lost revenue
  const { data: lostRevenueData } = await supabase
    .from('variants')
    .select('forecasted_lost_revenue')
    .not('forecasted_lost_revenue', 'is', null)

  const totalLostRevenue = lostRevenueData?.reduce((sum, v) => {
    return sum + (v.forecasted_lost_revenue || 0)
  }, 0) || 0

  return {
    totalSkus: totalSkus || 0,
    oosCount: oosCount || 0,
    reorderCount: reorderCount || 0,
    totalValue,
    totalLostRevenue,
  }
}
