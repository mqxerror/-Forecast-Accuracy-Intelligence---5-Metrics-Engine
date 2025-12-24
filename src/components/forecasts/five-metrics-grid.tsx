'use client'

import { MetricCard } from './metric-card'
import { interpretMAPE, interpretWASE } from '@/lib/utils/calculate-metrics'

interface FiveMetricsGridProps {
  metrics: {
    mape: number | null
    wape: number | null
    rmse: number | null
    wase: number | null
    bias: number | null
    naiveMape: number | null
  }
  onMetricClick?: (metric: string) => void
}

const metricDefinitions = {
  mape: {
    name: 'MAPE',
    description: 'Mean Absolute Percentage Error',
  },
  wape: {
    name: 'WAPE',
    description: 'Weighted by volume (better for varying SKU sizes)',
  },
  rmse: {
    name: 'RMSE',
    description: 'Penalizes large errors more heavily',
  },
  wase: {
    name: 'WASE',
    description: 'Compared to naive forecast (<1 is better)',
  },
  bias: {
    name: 'Bias',
    description: 'Systematic over/under forecasting',
  },
}

export function FiveMetricsGrid({ metrics, onMetricClick }: FiveMetricsGridProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      <MetricCard
        name={metricDefinitions.mape.name}
        value={metrics.mape}
        description={metricDefinitions.mape.description}
        interpretation={metrics.mape !== null ? interpretMAPE(metrics.mape) : undefined}
        benchmark={
          metrics.naiveMape !== null
            ? { value: metrics.naiveMape, label: 'Naive benchmark' }
            : undefined
        }
        onClick={() => onMetricClick?.('mape')}
      />

      <MetricCard
        name={metricDefinitions.wape.name}
        value={metrics.wape}
        description={metricDefinitions.wape.description}
        onClick={() => onMetricClick?.('wape')}
      />

      <MetricCard
        name={metricDefinitions.rmse.name}
        value={metrics.rmse}
        description={metricDefinitions.rmse.description}
        onClick={() => onMetricClick?.('rmse')}
      />

      <MetricCard
        name={metricDefinitions.wase.name}
        value={metrics.wase}
        description={metricDefinitions.wase.description}
        interpretation={metrics.wase !== null ? interpretWASE(metrics.wase) : undefined}
        onClick={() => onMetricClick?.('wase')}
      />

      <MetricCard
        name={metricDefinitions.bias.name}
        value={metrics.bias}
        description={metricDefinitions.bias.description}
        interpretation={
          metrics.bias !== null
            ? metrics.bias > 0
              ? 'Over-forecasting'
              : metrics.bias < 0
              ? 'Under-forecasting'
              : 'Well balanced'
            : undefined
        }
        onClick={() => onMetricClick?.('bias')}
      />
    </div>
  )
}
