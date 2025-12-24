'use client'

import useSWR from 'swr'

export interface DashboardStats {
  totalSkus: number
  oosCount: number
  reorderCount: number
  totalValue: number
  totalLostRevenue: number
}

export interface PriorityItem {
  id: string
  sku: string
  title: string | null
  brand: string | null
  in_stock: number
  replenishment: number
  to_order: number
  lead_time: number | null
  oos: number
  forecasted_lost_revenue: number | null
}

export interface SyncStatus {
  id: string
  source: string | null
  status: string | null
  records_fetched: number | null
  records_updated: number | null
  started_at: string | null
  completed_at: string | null
}

export interface DashboardAccuracy {
  avgMape: number | null
  avgWape: number | null
  skuCount: number
}

export interface MapeDistribution {
  excellent: number
  good: number
  acceptable: number
  poor: number
  very_poor: number
}

export interface DashboardData {
  stats: DashboardStats
  priorityItems: PriorityItem[]
  sync: SyncStatus | null
  accuracy: DashboardAccuracy
  mapeDistribution?: MapeDistribution
  oosItems?: PriorityItem[]
}

export function useDashboard() {
  const { data, error, isLoading, mutate } = useSWR<DashboardData>(
    '/api/dashboard/summary',
    {
      refreshInterval: 60000, // Refresh every 60 seconds (not 3 seconds!)
      revalidateOnMount: true,
    }
  )

  return {
    data,
    isLoading,
    isError: !!error,
    error,
    refresh: mutate,
  }
}

export function useSyncStatus() {
  const { data, error, isLoading, mutate } = useSWR<{ sync: SyncStatus }>(
    '/api/sync/status',
    {
      refreshInterval: 5000, // Check sync status every 5 seconds (only during active sync)
      revalidateOnFocus: true,
    }
  )

  return {
    sync: data?.sync,
    isLoading,
    isError: !!error,
    refresh: mutate,
  }
}
