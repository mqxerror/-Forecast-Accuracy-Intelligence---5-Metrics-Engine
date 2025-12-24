'use client'

import { memo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

interface MapeDistribution {
  excellent: number
  good: number
  acceptable: number
  poor: number
  very_poor: number
}

interface ForecastAccuracyChartProps {
  distribution: MapeDistribution | undefined
  isLoading?: boolean
}

const COLORS = {
  excellent: '#22c55e',   // green-500
  good: '#84cc16',        // lime-500
  acceptable: '#eab308',  // yellow-500
  poor: '#f97316',        // orange-500
  very_poor: '#ef4444',   // red-500
}

const LABELS = {
  excellent: '<10%',
  good: '10-20%',
  acceptable: '20-30%',
  poor: '30-50%',
  very_poor: '>50%',
}

export const ForecastAccuracyChart = memo(function ForecastAccuracyChart({
  distribution,
  isLoading,
}: ForecastAccuracyChartProps) {
  const [activeBar, setActiveBar] = useState<string | null>(null)
  const router = useRouter()

  if (isLoading) {
    return (
      <div className="h-[200px] flex items-center justify-center">
        <div className="animate-pulse bg-gray-200 rounded w-full h-full" />
      </div>
    )
  }

  if (!distribution) {
    return (
      <div className="h-[200px] flex items-center justify-center text-gray-500">
        No forecast data available
      </div>
    )
  }

  const data = [
    { name: LABELS.excellent, value: distribution.excellent, key: 'excellent' },
    { name: LABELS.good, value: distribution.good, key: 'good' },
    { name: LABELS.acceptable, value: distribution.acceptable, key: 'acceptable' },
    { name: LABELS.poor, value: distribution.poor, key: 'poor' },
    { name: LABELS.very_poor, value: distribution.very_poor, key: 'very_poor' },
  ]

  const total = data.reduce((sum, d) => sum + d.value, 0)

  const handleBarClick = (data: any) => {
    // Navigate to forecasts page with filter (could be implemented)
    router.push('/forecasts')
  }

  return (
    <div className="space-y-2">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          onMouseLeave={() => setActiveBar(null)}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            formatter={(value: number) => [
              `${value} SKUs (${((value / total) * 100).toFixed(1)}%)`,
              'Count',
            ]}
            contentStyle={{
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }}
            cursor={{ fill: 'rgba(0,0,0,0.05)' }}
          />
          <Bar
            dataKey="value"
            radius={[4, 4, 0, 0]}
            onClick={handleBarClick}
            style={{ cursor: 'pointer' }}
            onMouseEnter={(data) => setActiveBar(data.key)}
          >
            {data.map((entry) => (
              <Cell
                key={entry.key}
                fill={COLORS[entry.key as keyof typeof COLORS]}
                fillOpacity={activeBar === null || activeBar === entry.key ? 1 : 0.5}
                style={{ transition: 'all 0.2s ease' }}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.excellent }} />
          Excellent
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.good }} />
          Good
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.acceptable }} />
          Acceptable
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.poor }} />
          Poor
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.very_poor }} />
          Very Poor
        </span>
      </div>
    </div>
  )
})
