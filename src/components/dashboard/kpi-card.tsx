import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { KPISparkline } from './kpi-sparkline'
import { cn } from '@/lib/utils'
import { LucideIcon, ChevronRight } from 'lucide-react'

interface KPICardProps {
  title: string
  value: string | number
  subtitle?: string
  change?: {
    value: number
    label: string
  }
  icon?: LucideIcon
  variant?: 'default' | 'success' | 'warning' | 'danger'
  trend?: number[]
  href?: string
}

const variantStyles = {
  default: 'bg-blue-50 text-blue-600',
  success: 'bg-green-50 text-green-600',
  warning: 'bg-yellow-50 text-yellow-600',
  danger: 'bg-red-50 text-red-600',
}

const trendColors = {
  default: '#3b82f6',
  success: '#22c55e',
  warning: '#eab308',
  danger: '#ef4444',
}

export function KPICard({
  title,
  value,
  subtitle,
  change,
  icon: Icon,
  variant = 'default',
  trend,
  href,
}: KPICardProps) {
  const CardWrapper = href ? Link : 'div'
  const cardProps = href ? { href } : {}

  return (
    <CardWrapper {...cardProps} className={cn(href && 'block')}>
      <Card className={cn(
        'transition-all duration-200',
        href && 'cursor-pointer hover:shadow-md hover:border-gray-300 group'
      )}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">
            {title}
          </CardTitle>
          <div className="flex items-center gap-2">
            {Icon && (
              <div className={cn('rounded-lg p-2', variantStyles[variant])}>
                <Icon className="h-4 w-4" />
              </div>
            )}
            {href && (
              <ChevronRight className="h-4 w-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{value}</div>
          {subtitle && (
            <p className="text-xs text-gray-500">{subtitle}</p>
          )}
          {change && (
            <p
              className={cn(
                'mt-1 text-xs',
                change.value > 0 ? 'text-green-600' : 'text-red-600'
              )}
            >
              {change.value > 0 ? '+' : ''}
              {change.value}% {change.label}
            </p>
          )}
          {trend && trend.length > 1 && (
            <div className="mt-2">
              <KPISparkline data={trend} color={trendColors[variant]} />
            </div>
          )}
        </CardContent>
      </Card>
    </CardWrapper>
  )
}
