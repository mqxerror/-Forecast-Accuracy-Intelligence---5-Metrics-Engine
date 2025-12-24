'use client'

import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts'

interface SparklineProps {
  data: number[]
  color?: string
  height?: number
}

export function Sparkline({ data, color = '#3b82f6', height = 32 }: SparklineProps) {
  if (!data || data.length < 2) {
    return null
  }

  const chartData = data.map((value, index) => ({ value, index }))

  // Calculate min/max for proper scaling
  const min = Math.min(...data)
  const max = Math.max(...data)
  const padding = (max - min) * 0.1 || 1

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <YAxis domain={[min - padding, max + padding]} hide />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
