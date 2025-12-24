import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatPercentage } from '@/lib/utils/format-number'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  name: string
  value: number | null
  description: string
  interpretation?: string
  benchmark?: {
    value: number | null
    label: string
  }
  lowerIsBetter?: boolean
  onClick?: () => void
}

export function MetricCard({
  name,
  value,
  description,
  interpretation,
  benchmark,
  lowerIsBetter = true,
  onClick,
}: MetricCardProps) {
  const getValueColor = () => {
    if (value === null) return 'text-gray-400'

    if (name === 'WASE') {
      // WASE < 1 is good, > 1 is bad
      if (value < 0.8) return 'text-green-600'
      if (value < 1.0) return 'text-blue-600'
      if (value < 1.2) return 'text-yellow-600'
      return 'text-red-600'
    }

    if (name === 'Bias') {
      // Bias close to 0 is good
      const absValue = Math.abs(value)
      if (absValue < 5) return 'text-green-600'
      if (absValue < 10) return 'text-blue-600'
      if (absValue < 20) return 'text-yellow-600'
      return 'text-red-600'
    }

    // For MAPE, WAPE, RMSE - lower is better
    if (value < 10) return 'text-green-600'
    if (value < 20) return 'text-blue-600'
    if (value < 30) return 'text-yellow-600'
    return 'text-red-600'
  }

  const formatValue = () => {
    if (value === null) return '-'

    if (name === 'WASE') {
      return value.toFixed(2)
    }

    if (name === 'Bias') {
      const sign = value > 0 ? '+' : ''
      return `${sign}${value.toFixed(1)}`
    }

    return formatPercentage(value)
  }

  return (
    <Card
      className={cn(
        'transition-shadow',
        onClick && 'cursor-pointer hover:shadow-md'
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-gray-500">
          {name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn('text-3xl font-bold', getValueColor())}>
          {formatValue()}
        </div>
        <p className="mt-1 text-xs text-gray-500">{description}</p>

        {interpretation && (
          <p className="mt-2 text-sm font-medium">{interpretation}</p>
        )}

        {benchmark && benchmark.value !== null && (
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="text-gray-500">{benchmark.label}:</span>
            <span
              className={cn(
                'font-medium',
                value !== null && value < benchmark.value
                  ? 'text-green-600'
                  : 'text-gray-600'
              )}
            >
              {formatPercentage(benchmark.value)}
            </span>
            {value !== null && value < benchmark.value && (
              <span className="text-green-600">
                ({formatPercentage(benchmark.value - value)} better)
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
