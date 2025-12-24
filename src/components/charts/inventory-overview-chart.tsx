'use client'

import { memo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Sector,
} from 'recharts'

interface InventoryStats {
  totalSkus: number
  oosCount: number
  reorderCount: number
}

interface InventoryOverviewChartProps {
  stats: InventoryStats | undefined
  isLoading?: boolean
}

const COLORS = {
  healthy: '#22c55e',      // green-500
  needsReorder: '#f97316', // orange-500
  outOfStock: '#ef4444',   // red-500
}

const LINKS = {
  'Healthy Stock': '/inventory?status=in_stock',
  'Needs Reorder': '/inventory?status=low_stock',
  'Out of Stock': '/inventory?status=out_of_stock',
}

// Custom active shape for hover effect
const renderActiveShape = (props: any) => {
  const {
    cx, cy, innerRadius, outerRadius, startAngle, endAngle,
    fill, payload, percent, value
  } = props

  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 2}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
      />
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 2}
        outerRadius={innerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <text x={cx} y={cy - 8} textAnchor="middle" fill="#374151" fontSize={12} fontWeight={500}>
        {payload.name}
      </text>
      <text x={cx} y={cy + 8} textAnchor="middle" fill="#6b7280" fontSize={11}>
        {value.toLocaleString()} ({(percent * 100).toFixed(0)}%)
      </text>
    </g>
  )
}

export const InventoryOverviewChart = memo(function InventoryOverviewChart({
  stats,
  isLoading,
}: InventoryOverviewChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined)
  const router = useRouter()

  if (isLoading) {
    return (
      <div className="h-[200px] flex items-center justify-center">
        <div className="animate-pulse bg-gray-200 rounded-full w-40 h-40" />
      </div>
    )
  }

  if (!stats || stats.totalSkus === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-gray-500">
        No inventory data available
      </div>
    )
  }

  // Calculate healthy items (total - oos - reorder, avoiding double count)
  const healthyCount = Math.max(0, stats.totalSkus - stats.oosCount - stats.reorderCount)

  const data = [
    { name: 'Healthy Stock', value: healthyCount, color: COLORS.healthy },
    { name: 'Needs Reorder', value: stats.reorderCount, color: COLORS.needsReorder },
    { name: 'Out of Stock', value: stats.oosCount, color: COLORS.outOfStock },
  ].filter((d) => d.value > 0)

  const total = data.reduce((sum, d) => sum + d.value, 0)

  const handlePieClick = (data: any) => {
    const link = LINKS[data.name as keyof typeof LINKS]
    if (link) router.push(link)
  }

  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width="50%" height={180}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={70}
            paddingAngle={2}
            dataKey="value"
            activeIndex={activeIndex}
            activeShape={renderActiveShape}
            onMouseEnter={(_, index) => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(undefined)}
            onClick={handlePieClick}
            style={{ cursor: 'pointer' }}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color}
                style={{ transition: 'all 0.2s ease' }}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => [
              `${Number(value).toLocaleString()} SKUs`,
              'Count',
            ]}
            contentStyle={{
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend with percentages - avoids overlap */}
      <div className="flex-1 space-y-2">
        {data.map((entry, index) => {
          const percentage = ((entry.value / total) * 100).toFixed(0)
          const isActive = activeIndex === index
          return (
            <div
              key={entry.name}
              className={`flex items-center justify-between text-sm rounded-md px-2 py-1 transition-all cursor-pointer hover:bg-gray-50 ${isActive ? 'bg-gray-100' : ''}`}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(undefined)}
              onClick={() => {
                const link = LINKS[entry.name as keyof typeof LINKS]
                if (link) router.push(link)
              }}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`w-3 h-3 rounded-full transition-transform ${isActive ? 'scale-125' : ''}`}
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-gray-600">{entry.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{entry.value.toLocaleString()}</span>
                <span className="text-gray-400 text-xs">({percentage}%)</span>
              </div>
            </div>
          )
        })}
        <div className="pt-2 border-t mt-2">
          <div className="flex items-center justify-between text-sm font-medium px-2">
            <span>Total</span>
            <span>{total.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  )
})
