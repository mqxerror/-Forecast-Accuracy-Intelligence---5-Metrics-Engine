'use client'

import { memo } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface SalesSparklineProps {
  last7Days: number
  last30Days: number
  last90Days: number
}

export const SalesSparkline = memo(function SalesSparkline({
  last7Days,
  last30Days,
  last90Days,
}: SalesSparklineProps) {
  // Calculate daily averages for comparison
  const avg7d = last7Days / 7
  const avg30d = last30Days / 30
  const avg60d = (last90Days - last30Days) / 60 // Previous 60 days average

  // Calculate trend percentage (comparing recent vs previous period)
  const trendPercent = avg60d > 0 ? ((avg30d - avg60d) / avg60d) * 100 : 0

  // Create sparkline bars from the data (normalised)
  const data = [
    { period: '60d ago', value: avg60d },
    { period: '30d avg', value: avg30d },
    { period: '7d avg', value: avg7d },
  ]

  const maxValue = Math.max(...data.map((d) => d.value), 1)

  // Determine trend direction
  const getTrendIcon = () => {
    if (trendPercent > 5) {
      return <TrendingUp className="h-3 w-3 text-green-500" />
    }
    if (trendPercent < -5) {
      return <TrendingDown className="h-3 w-3 text-red-500" />
    }
    return <Minus className="h-3 w-3 text-gray-400" />
  }

  const getTrendColor = () => {
    if (trendPercent > 5) return 'text-green-600'
    if (trendPercent < -5) return 'text-red-600'
    return 'text-gray-500'
  }

  return (
    <div className="flex items-center gap-2">
      {/* Mini bar chart */}
      <div className="flex items-end gap-0.5 h-4">
        {data.map((d, i) => {
          const height = maxValue > 0 ? (d.value / maxValue) * 100 : 0
          const barColor = i === 2 ? 'bg-blue-500' : i === 1 ? 'bg-blue-300' : 'bg-gray-300'
          return (
            <div
              key={d.period}
              className={`w-1.5 ${barColor} rounded-t-sm`}
              style={{ height: `${Math.max(height, 10)}%` }}
              title={`${d.period}: ${d.value.toFixed(1)}/day`}
            />
          )
        })}
      </div>

      {/* Trend indicator */}
      <div className="flex items-center gap-0.5">
        {getTrendIcon()}
        {Math.abs(trendPercent) > 1 && (
          <span className={`text-xs ${getTrendColor()}`}>
            {trendPercent > 0 ? '+' : ''}{trendPercent.toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  )
})
