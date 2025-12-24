'use client'

import useSWR from 'swr'
import { useCallback, useState } from 'react'

export interface InventoryFilters {
  search?: string
  brand?: string
  productType?: string
  stockStatus?: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock'
  minOOS?: number
}

export interface InventoryItem {
  id: string
  sku: string
  title: string | null
  barcode: string | null
  brand: string | null
  product_type: string | null
  image: string | null
  price: number | null
  cost_price: number | null
  in_stock: number
  replenishment: number
  to_order: number
  oos: number
  forecasted_lost_revenue: number | null
  synced_at: string
  last_7_days_sales: number
  last_30_days_sales: number
  last_90_days_sales: number
  last_180_days_sales: number
  last_365_days_sales: number
}

export interface InventoryResponse {
  variants: InventoryItem[]
  count: number
  error: string | null
}

function buildQueryString(
  filters: InventoryFilters,
  page: number,
  pageSize: number
): string {
  const params = new URLSearchParams()
  params.set('limit', String(pageSize))
  params.set('offset', String((page - 1) * pageSize))

  if (filters.search) params.set('search', filters.search)
  if (filters.brand) params.set('brand', filters.brand)
  if (filters.productType) params.set('productType', filters.productType)
  if (filters.minOOS !== undefined) params.set('minOOS', String(filters.minOOS))

  return params.toString()
}

export function useInventory(initialFilters: InventoryFilters = {}) {
  const [filters, setFilters] = useState<InventoryFilters>(initialFilters)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  const queryString = buildQueryString(filters, page, pageSize)
  const { data, error, isLoading, mutate } = useSWR<InventoryResponse>(
    `/api/inventory?${queryString}`,
    {
      keepPreviousData: true, // Keep showing old data while loading new
      revalidateOnFocus: false,
    }
  )

  const updateFilters = useCallback((newFilters: Partial<InventoryFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }))
    setPage(1) // Reset to first page on filter change
  }, [])

  const goToPage = useCallback((newPage: number) => {
    setPage(newPage)
  }, [])

  const updatePageSize = useCallback((newSize: number) => {
    setPageSize(newSize)
    setPage(1) // Reset to first page on page size change
  }, [])

  return {
    items: data?.variants ?? [],
    totalCount: data?.count ?? 0,
    isLoading,
    isError: !!error,
    error: data?.error || error?.message,
    filters,
    page,
    pageSize,
    totalPages: Math.ceil((data?.count ?? 0) / pageSize),
    updateFilters,
    goToPage,
    updatePageSize,
    refresh: mutate,
  }
}

export function useFilterOptions() {
  const { data: brandsData } = useSWR<{ brands: string[] }>('/api/filters/brands', {
    revalidateOnFocus: false,
    revalidateIfStale: false, // Brands don't change often
  })

  const { data: typesData } = useSWR<{ productTypes: string[] }>(
    '/api/filters/product-types',
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
    }
  )

  return {
    brands: brandsData?.brands ?? [],
    productTypes: typesData?.productTypes ?? [],
  }
}
