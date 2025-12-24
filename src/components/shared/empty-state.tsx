'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Package,
  BarChart3,
  RefreshCw,
  Search,
  AlertCircle,
  Database,
  TrendingUp,
  FileQuestion
} from 'lucide-react'

type EmptyStateType =
  | 'no-data'
  | 'no-results'
  | 'error'
  | 'sync-needed'
  | 'no-inventory'
  | 'no-forecasts'

interface EmptyStateProps {
  type?: EmptyStateType
  title?: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

const STATES: Record<EmptyStateType, {
  icon: typeof Package
  title: string
  description: string
  iconColor: string
}> = {
  'no-data': {
    icon: Database,
    title: 'No Data Available',
    description: 'There is no data to display yet. Import or sync your inventory to get started.',
    iconColor: 'text-gray-400',
  },
  'no-results': {
    icon: Search,
    title: 'No Results Found',
    description: 'Try adjusting your search or filter criteria to find what you\'re looking for.',
    iconColor: 'text-blue-400',
  },
  'error': {
    icon: AlertCircle,
    title: 'Something Went Wrong',
    description: 'We encountered an error loading this data. Please try again.',
    iconColor: 'text-red-400',
  },
  'sync-needed': {
    icon: RefreshCw,
    title: 'Sync Required',
    description: 'Import your inventory data from Inventory Planner to see insights and analytics.',
    iconColor: 'text-orange-400',
  },
  'no-inventory': {
    icon: Package,
    title: 'No Products Found',
    description: 'Your inventory is empty. Sync with Inventory Planner to import your products.',
    iconColor: 'text-purple-400',
  },
  'no-forecasts': {
    icon: TrendingUp,
    title: 'No Forecast Data',
    description: 'Forecast metrics haven\'t been calculated yet. Sync your data to generate accuracy metrics.',
    iconColor: 'text-green-400',
  },
}

export function EmptyState({
  type = 'no-data',
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const state = STATES[type]
  const Icon = state.icon

  return (
    <div className={cn(
      'flex flex-col items-center justify-center py-12 px-4 text-center',
      className
    )}>
      {/* Decorative background pattern */}
      <div className="relative">
        <div className="absolute inset-0 -m-4 rounded-full bg-gray-50 animate-pulse" />
        <div className={cn(
          'relative flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm border',
          state.iconColor
        )}>
          <Icon className="h-8 w-8" />
        </div>
      </div>

      <h3 className="mt-6 text-lg font-semibold text-gray-900">
        {title || state.title}
      </h3>

      <p className="mt-2 max-w-sm text-sm text-gray-500">
        {description || state.description}
      </p>

      {action && (
        <Button
          onClick={action.onClick}
          className="mt-6"
          variant="outline"
        >
          {action.label}
        </Button>
      )}
    </div>
  )
}

// Specialized empty states for common scenarios
export function NoInventoryState({ onSync }: { onSync?: () => void }) {
  return (
    <EmptyState
      type="no-inventory"
      action={onSync ? { label: 'Sync Inventory', onClick: onSync } : undefined}
    />
  )
}

export function NoForecastsState({ onSync }: { onSync?: () => void }) {
  return (
    <EmptyState
      type="no-forecasts"
      action={onSync ? { label: 'Calculate Metrics', onClick: onSync } : undefined}
    />
  )
}

export function NoSearchResultsState({ onClear }: { onClear?: () => void }) {
  return (
    <EmptyState
      type="no-results"
      action={onClear ? { label: 'Clear Filters', onClick: onClear } : undefined}
    />
  )
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <EmptyState
      type="error"
      action={onRetry ? { label: 'Try Again', onClick: onRetry } : undefined}
    />
  )
}
