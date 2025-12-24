'use client'

import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { type ForecastSource, getForecastSourceLabel } from '@/lib/utils/calculate-metrics'
import { AlertCircle, CheckCircle, HelpCircle } from 'lucide-react'

interface ForecastSourceBadgeProps {
  source: ForecastSource
  showIcon?: boolean
  size?: 'sm' | 'default'
}

/**
 * Badge indicating the source of forecast data
 * - IP Forecast: Using actual Inventory Planner forecasts
 * - Benchmark Only: Using naive forecast (no IP data)
 * - Limited Data: Insufficient periods for reliable metrics
 */
export function ForecastSourceBadge({
  source,
  showIcon = true,
  size = 'default'
}: ForecastSourceBadgeProps) {
  const config = getForecastSourceLabel(source)

  const Icon = source === 'inventory_planner' ? CheckCircle
    : source === 'naive_benchmark' ? AlertCircle
    : HelpCircle

  const variantClass = config.variant === 'default'
    ? 'bg-green-100 text-green-800 hover:bg-green-200'
    : config.variant === 'warning'
    ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'

  const sizeClass = size === 'sm' ? 'text-xs px-1.5 py-0.5' : ''

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`cursor-help border-0 ${variantClass} ${sizeClass}`}
          >
            {showIcon && <Icon className={`${size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} mr-1`} />}
            {config.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p>{config.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

interface ConfidenceIndicatorProps {
  confidence: 'high' | 'medium' | 'low' | 'none'
  periodCount: number
  showLabel?: boolean
}

/**
 * Visual indicator of data confidence based on period count
 * Shows 0-4 bars indicating confidence level
 */
export function ConfidenceIndicator({
  confidence,
  periodCount,
  showLabel = false
}: ConfidenceIndicatorProps) {
  const bars = {
    high: 4,
    medium: 3,
    low: 2,
    none: 0
  }

  const colors = {
    high: 'bg-green-500',
    medium: 'bg-yellow-500',
    low: 'bg-orange-500',
    none: 'bg-gray-300'
  }

  const labels = {
    high: 'High confidence',
    medium: 'Medium confidence',
    low: 'Low confidence',
    none: 'Insufficient data'
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 cursor-help">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  className={`w-1 h-3 rounded-sm transition-colors ${
                    i <= bars[confidence] ? colors[confidence] : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
            {showLabel && (
              <span className="text-xs text-gray-500 ml-1">{labels[confidence]}</span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{labels[confidence]}</p>
          <p className="text-xs text-gray-400">Based on {periodCount} months of data</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

interface PrimaryMetricBadgeProps {
  primaryMetric: 'mape' | 'wape'
  zeroPeriods?: number
}

/**
 * Badge indicating which metric is recommended for this SKU
 */
export function PrimaryMetricBadge({ primaryMetric, zeroPeriods }: PrimaryMetricBadgeProps) {
  if (primaryMetric === 'mape') return null // MAPE is default, no badge needed

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
            Using WAPE
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p>WAPE is shown because this SKU has {zeroPeriods || 'many'} zero-sales periods where MAPE would be unreliable.</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
