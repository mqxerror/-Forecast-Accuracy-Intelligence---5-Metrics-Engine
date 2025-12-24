import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

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
}

const variantStyles = {
  default: 'bg-blue-50 text-blue-600',
  success: 'bg-green-50 text-green-600',
  warning: 'bg-yellow-50 text-yellow-600',
  danger: 'bg-red-50 text-red-600',
}

export function KPICard({
  title,
  value,
  subtitle,
  change,
  icon: Icon,
  variant = 'default',
}: KPICardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-500">
          {title}
        </CardTitle>
        {Icon && (
          <div className={cn('rounded-lg p-2', variantStyles[variant])}>
            <Icon className="h-4 w-4" />
          </div>
        )}
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
      </CardContent>
    </Card>
  )
}
