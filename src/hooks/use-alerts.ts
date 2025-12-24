'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useDashboard } from './use-dashboard'

interface AlertConfig {
  lowStockThreshold: number
  accuracyWarningThreshold: number // MAPE percentage
  enabled: boolean
}

const DEFAULT_CONFIG: AlertConfig = {
  lowStockThreshold: 10,
  accuracyWarningThreshold: 30,
  enabled: true,
}

export function useAlerts(config: Partial<AlertConfig> = {}) {
  const { data, isLoading } = useDashboard()
  const previousDataRef = useRef<typeof data>(null)
  const alertConfig = { ...DEFAULT_CONFIG, ...config }

  useEffect(() => {
    if (!alertConfig.enabled || isLoading || !data) return

    const prevData = previousDataRef.current
    previousDataRef.current = data

    // Skip alerts on initial load
    if (!prevData) return

    // Check for new out-of-stock items
    if (
      data.stats.oosCount > prevData.stats.oosCount
    ) {
      const newOosCount = data.stats.oosCount - prevData.stats.oosCount
      toast.error(`${newOosCount} new item${newOosCount > 1 ? 's' : ''} out of stock`, {
        description: 'Check the inventory page for details',
        duration: 5000,
      })
    }

    // Check for items needing reorder
    if (
      data.stats.reorderCount > prevData.stats.reorderCount
    ) {
      const newReorderCount = data.stats.reorderCount - prevData.stats.reorderCount
      toast.warning(`${newReorderCount} item${newReorderCount > 1 ? 's' : ''} need reordering`, {
        description: 'Review priority items on the dashboard',
        duration: 5000,
      })
    }

    // Check forecast accuracy
    if (data.accuracy.avgMape !== null && data.accuracy.avgMape > alertConfig.accuracyWarningThreshold) {
      const prevMape = prevData.accuracy.avgMape
      if (prevMape === null || prevMape <= alertConfig.accuracyWarningThreshold) {
        toast.warning('Forecast accuracy below threshold', {
          description: `Average MAPE is ${data.accuracy.avgMape.toFixed(1)}% (threshold: ${alertConfig.accuracyWarningThreshold}%)`,
          duration: 8000,
        })
      }
    }
  }, [data, isLoading, alertConfig])

  return {
    hasAlerts: (data?.stats.oosCount ?? 0) > 0 || (data?.stats.reorderCount ?? 0) > 0,
    oosCount: data?.stats.oosCount ?? 0,
    reorderCount: data?.stats.reorderCount ?? 0,
  }
}

// Manual alert triggers for use in components
export function showSuccessAlert(title: string, description?: string) {
  toast.success(title, { description, duration: 4000 })
}

export function showErrorAlert(title: string, description?: string) {
  toast.error(title, { description, duration: 6000 })
}

export function showWarningAlert(title: string, description?: string) {
  toast.warning(title, { description, duration: 5000 })
}

export function showInfoAlert(title: string, description?: string) {
  toast.info(title, { description, duration: 4000 })
}
