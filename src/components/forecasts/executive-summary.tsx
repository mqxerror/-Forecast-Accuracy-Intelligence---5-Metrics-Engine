'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Target,
  DollarSign,
} from 'lucide-react'

interface ExecutiveSummaryProps {
  metrics: {
    mape: number | null
    wape: number | null
    rmse: number | null
    wase: number | null
    bias: number | null
    naiveMape: number | null
    skuCount: number
  }
  distribution: Array<{
    name: string
    count: number
    percentage: number
  }>
}

export const ExecutiveSummary = memo(function ExecutiveSummary({
  metrics,
  distribution,
}: ExecutiveSummaryProps) {
  const { mape, wape, wase, bias, naiveMape, skuCount } = metrics

  // Calculate key insights
  const excellentCount = distribution.find((d) => d.name.includes('Excellent'))?.count || 0
  const poorCount = distribution.find((d) => d.name.includes('Poor') && !d.name.includes('Very'))?.count || 0
  const veryPoorCount = distribution.find((d) => d.name.includes('Very Poor'))?.count || 0
  const totalProblematic = poorCount + veryPoorCount

  const accuracyRating = getOverallRating(mape)
  const beatsNaive = wase !== null && wase < 1
  const forecastBias = getBiasInsight(bias)
  const volumeAccuracy = getVolumeAccuracyInsight(mape, wape)

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Executive Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Overall Accuracy */}
          <InsightCard
            icon={accuracyRating.icon}
            title="Overall Accuracy"
            value={mape !== null ? `${mape.toFixed(1)}% MAPE` : 'N/A'}
            badge={accuracyRating.badge}
            badgeVariant={accuracyRating.variant}
            insight={accuracyRating.insight}
          />

          {/* Forecast Value Add */}
          <InsightCard
            icon={
              wase === null || wase === 0
                ? <AlertTriangle className="h-5 w-5 text-gray-400" />
                : beatsNaive
                  ? <CheckCircle className="h-5 w-5 text-green-500" />
                  : <AlertTriangle className="h-5 w-5 text-yellow-500" />
            }
            title="Forecast Value"
            value={
              wase === null
                ? 'N/A'
                : wase === 0
                  ? 'Data Issue'
                  : `${((1 - wase) * 100).toFixed(0)}% ${wase < 1 ? 'better' : 'worse'}`
            }
            badge={
              wase === null || wase === 0
                ? 'Check Data'
                : beatsNaive
                  ? 'Adding Value'
                  : 'Review Needed'
            }
            badgeVariant={
              wase === null || wase === 0
                ? 'secondary'
                : beatsNaive
                  ? 'success'
                  : 'warning'
            }
            insight={
              wase === null || wase === 0
                ? 'WASE calculation may have data quality issues'
                : beatsNaive
                  ? `Forecasts are ${((1 - wase) * 100).toFixed(0)}% more accurate than naive method`
                  : `Forecasts are ${((wase - 1) * 100).toFixed(0)}% worse than just using last period`
            }
          />

          {/* Bias Analysis */}
          <InsightCard
            icon={forecastBias.icon}
            title="Forecast Bias"
            value={bias !== null ? `${bias > 0 ? '+' : ''}${bias.toFixed(1)}%` : 'N/A'}
            badge={forecastBias.badge}
            badgeVariant={forecastBias.variant}
            insight={forecastBias.insight}
          />

          {/* SKU Health */}
          <InsightCard
            icon={totalProblematic > skuCount * 0.2
              ? <AlertTriangle className="h-5 w-5 text-red-500" />
              : <CheckCircle className="h-5 w-5 text-green-500" />
            }
            title="SKU Health"
            value={`${excellentCount} excellent`}
            badge={`${totalProblematic} need attention`}
            badgeVariant={totalProblematic > skuCount * 0.2 ? 'destructive' : 'secondary'}
            insight={`${((excellentCount / skuCount) * 100).toFixed(0)}% of SKUs have excellent forecasts`}
          />
        </div>

        {/* Key Recommendations */}
        <div className="mt-6 border-t pt-4">
          <h4 className="mb-3 font-medium">Key Recommendations</h4>
          <div className="grid gap-2 md:grid-cols-2">
            {getRecommendations(metrics, distribution).map((rec, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 rounded-lg p-3 ${rec.priority === 'high' ? 'bg-red-50' : rec.priority === 'medium' ? 'bg-yellow-50' : 'bg-blue-50'}`}
              >
                <span className={`mt-0.5 text-lg ${rec.priority === 'high' ? 'text-red-500' : rec.priority === 'medium' ? 'text-yellow-500' : 'text-blue-500'}`}>
                  {rec.priority === 'high' ? '!' : rec.priority === 'medium' ? '~' : 'i'}
                </span>
                <div>
                  <p className="text-sm font-medium">{rec.title}</p>
                  <p className="text-xs text-gray-600">{rec.action}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
})

// Helper component for insight cards
function InsightCard({
  icon,
  title,
  value,
  badge,
  badgeVariant,
  insight,
}: {
  icon: React.ReactNode
  title: string
  value: string
  badge: string
  badgeVariant: 'success' | 'warning' | 'destructive' | 'secondary'
  insight: string
}) {
  const badgeClasses = {
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    destructive: 'bg-red-100 text-red-800',
    secondary: 'bg-gray-100 text-gray-800',
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-medium text-gray-500">{title}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <Badge className={badgeClasses[badgeVariant]}>{badge}</Badge>
      <p className="text-xs text-gray-600">{insight}</p>
    </div>
  )
}

// Rating helper - uses 5-tier system consistent with chart
function getOverallRating(mape: number | null) {
  if (mape === null) {
    return {
      icon: <AlertTriangle className="h-5 w-5 text-gray-400" />,
      badge: 'No Data',
      variant: 'secondary' as const,
      insight: 'Run a sync to calculate forecast accuracy',
    }
  }
  if (mape < 10) {
    return {
      icon: <CheckCircle className="h-5 w-5 text-green-500" />,
      badge: 'Excellent',
      variant: 'success' as const,
      insight: 'Forecasts are highly reliable for planning',
    }
  }
  if (mape < 20) {
    return {
      icon: <TrendingUp className="h-5 w-5 text-lime-500" />,
      badge: 'Good',
      variant: 'success' as const,
      insight: 'Solid forecasting with room for improvement',
    }
  }
  if (mape < 30) {
    return {
      icon: <TrendingDown className="h-5 w-5 text-yellow-500" />,
      badge: 'Acceptable',
      variant: 'warning' as const,
      insight: 'Consider reviewing forecast settings for key SKUs',
    }
  }
  if (mape < 50) {
    return {
      icon: <AlertTriangle className="h-5 w-5 text-orange-500" />,
      badge: 'Poor',
      variant: 'warning' as const,
      insight: 'Forecasts need attention - review methodology',
    }
  }
  return {
    icon: <AlertTriangle className="h-5 w-5 text-red-500" />,
    badge: 'Very Poor',
    variant: 'destructive' as const,
    insight: 'High error rate - significant review needed',
  }
}

// Bias insight helper
function getBiasInsight(bias: number | null) {
  if (bias === null) {
    return {
      icon: <AlertTriangle className="h-5 w-5 text-gray-400" />,
      badge: 'No Data',
      variant: 'secondary' as const,
      insight: 'No bias data available',
    }
  }
  if (Math.abs(bias) < 5) {
    return {
      icon: <CheckCircle className="h-5 w-5 text-green-500" />,
      badge: 'Balanced',
      variant: 'success' as const,
      insight: 'Forecasts are well balanced - no systematic error',
    }
  }
  if (bias > 0) {
    return {
      icon: <TrendingUp className="h-5 w-5 text-yellow-500" />,
      badge: 'Over-forecasting',
      variant: 'warning' as const,
      insight: 'Risk of excess inventory and carrying costs',
    }
  }
  return {
    icon: <TrendingDown className="h-5 w-5 text-red-500" />,
    badge: 'Under-forecasting',
    variant: 'destructive' as const,
    insight: 'Risk of stockouts and lost sales',
  }
}

// Volume accuracy insight
function getVolumeAccuracyInsight(mape: number | null, wape: number | null) {
  if (mape === null || wape === null) return null
  const diff = mape - wape
  if (diff > 5) {
    return 'Low-volume items are dragging down accuracy'
  }
  if (diff < -5) {
    return 'High-volume items need more attention'
  }
  return 'Accuracy is consistent across volume levels'
}

// Recommendations generator
function getRecommendations(
  metrics: ExecutiveSummaryProps['metrics'],
  distribution: ExecutiveSummaryProps['distribution']
) {
  const recommendations: Array<{ title: string; action: string; priority: 'high' | 'medium' | 'low' }> = []

  const { mape, wape, wase, bias, skuCount } = metrics
  const veryPoorCount = distribution.find((d) => d.name.includes('Very Poor'))?.count || 0

  // High priority recommendations
  if (mape !== null && mape > 30) {
    recommendations.push({
      title: 'Review Forecast Model',
      action: 'MAPE exceeds 30% - consider adjusting forecast parameters or methodology',
      priority: 'high',
    })
  }

  if (wase !== null && wase > 1) {
    recommendations.push({
      title: 'Forecasts Not Adding Value',
      action: 'Simple naive forecast would be more accurate - review data quality',
      priority: 'high',
    })
  }

  if (veryPoorCount > skuCount * 0.1) {
    recommendations.push({
      title: `${veryPoorCount} SKUs with Very Poor Accuracy`,
      action: 'Review these items for data issues or unusual demand patterns',
      priority: 'high',
    })
  }

  // Medium priority
  if (bias !== null && Math.abs(bias) > 10) {
    recommendations.push({
      title: bias > 0 ? 'Systematic Over-forecasting' : 'Systematic Under-forecasting',
      action: bias > 0 ? 'Reduce safety stock or adjust demand signals' : 'Increase safety stock or review lead times',
      priority: 'medium',
    })
  }

  if (mape !== null && wape !== null && mape - wape > 10) {
    recommendations.push({
      title: 'Low-Volume SKU Accuracy Issue',
      action: 'Consider different forecast methods for slow-moving items',
      priority: 'medium',
    })
  }

  // Low priority / positive
  if (mape !== null && mape < 15) {
    recommendations.push({
      title: 'Maintain Current Approach',
      action: 'Forecast accuracy is strong - continue monitoring for changes',
      priority: 'low',
    })
  }

  return recommendations.slice(0, 4)
}
