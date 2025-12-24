'use client'

import { Sparkline } from '@/components/charts/sparkline'

interface KPISparklineProps {
  data: number[]
  color?: string
}

export function KPISparkline({ data, color }: KPISparklineProps) {
  return <Sparkline data={data} color={color} height={28} />
}
