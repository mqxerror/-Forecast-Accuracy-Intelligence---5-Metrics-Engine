'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CalculationExplainerProps {
  metric: string
  onClose: () => void
}

const explanations: Record<
  string,
  {
    title: string
    formula: string
    description: string
    example: string
    interpretation: string[]
  }
> = {
  mape: {
    title: 'MAPE - Mean Absolute Percentage Error',
    formula: 'MAPE = (1/n) * SUM(|Actual - Forecast| / Actual) * 100',
    description:
      'MAPE calculates the average of absolute percentage errors across all periods. It tells you, on average, how far off forecasts are from actual values as a percentage.',
    example:
      'If Actual = 100, Forecast = 90, Error = |100-90|/100 = 10%\nIf Actual = 50, Forecast = 60, Error = |50-60|/50 = 20%\nMAPE = (10% + 20%) / 2 = 15%',
    interpretation: [
      '< 10%: Excellent forecasting',
      '10-20%: Good forecasting',
      '20-30%: Acceptable forecasting',
      '30-50%: Poor forecasting',
      '> 50%: Very poor forecasting',
    ],
  },
  wape: {
    title: 'WAPE - Weighted Absolute Percentage Error',
    formula: 'WAPE = SUM(|Actual - Forecast|) / SUM(Actual) * 100',
    description:
      'WAPE weights errors by volume, so high-volume SKUs contribute more to the overall error. This is more useful than MAPE when SKU volumes vary significantly.',
    example:
      'SKU A: Actual=1000, Forecast=900 (error=100)\nSKU B: Actual=10, Forecast=15 (error=5)\nWAPE = (100+5)/(1000+10) = 10.4%\n\nNote: MAPE would give equal weight to both SKUs, but WAPE focuses on where it matters most.',
    interpretation: [
      'Lower is better',
      'Better than MAPE for mixed-volume catalogs',
      'Compare to MAPE - if WAPE << MAPE, low-volume items are hurting accuracy',
    ],
  },
  rmse: {
    title: 'RMSE - Root Mean Square Error',
    formula: 'RMSE = SQRT((1/n) * SUM((Actual - Forecast)^2))',
    description:
      'RMSE squares errors before averaging, which heavily penalizes large errors. Use this when big misses are much more costly than small ones.',
    example:
      'Errors: [5, 5, 5, 50]\nMean error = 16.25\nRMSE = SQRT((25+25+25+2500)/4) = 25.5\n\nThe one large error (50) dramatically increases RMSE.',
    interpretation: [
      'Same units as the data (not a percentage)',
      'More sensitive to outliers than MAPE',
      'Use when stockouts from big misses are very costly',
    ],
  },
  wase: {
    title: 'WASE - Weighted Absolute Scaled Error',
    formula: 'WASE = SUM(|Actual - Forecast|) / SUM(|Actual_t - Actual_{t-1}|)',
    description:
      'WASE compares your forecast errors to a naive forecast (using the previous period as the prediction). A value < 1 means you\'re beating the naive approach.',
    example:
      'Month 1: Actual=100, Forecast=95 (error=5)\nMonth 2: Actual=120, Forecast=110 (error=10)\nNaive errors: |120-100| = 20\nWASE = (5+10) / 20 = 0.75\n\nYou\'re 25% better than naive!',
    interpretation: [
      '< 0.8: Much better than naive',
      '0.8-1.0: Better than naive',
      '= 1.0: Same as naive (no value added)',
      '> 1.0: Worse than just using last period',
    ],
  },
  bias: {
    title: 'Forecast Bias',
    formula: 'Bias = (1/n) * SUM(Forecast - Actual)',
    description:
      'Bias measures whether forecasts systematically over or under predict. A positive bias means over-forecasting, negative means under-forecasting.',
    example:
      'Month 1: Forecast=110, Actual=100 (diff=+10)\nMonth 2: Forecast=130, Actual=120 (diff=+10)\nBias = (10+10)/2 = +10\n\nThis shows consistent over-forecasting.',
    interpretation: [
      'Positive bias: Overstocking risk',
      'Negative bias: Stockout risk',
      'Near 0: Well balanced forecasts',
      'Large bias: Check for systematic issues in forecasting model',
    ],
  },
}

export function CalculationExplainer({
  metric,
  onClose,
}: CalculationExplainerProps) {
  const explanation = explanations[metric]

  if (!explanation) {
    return null
  }

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">{explanation.title}</CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="mb-1 text-sm font-medium text-gray-500">Formula</h4>
          <code className="block rounded bg-gray-100 p-3 text-sm">
            {explanation.formula}
          </code>
        </div>

        <div>
          <h4 className="mb-1 text-sm font-medium text-gray-500">
            What it means
          </h4>
          <p className="text-sm text-gray-700">{explanation.description}</p>
        </div>

        <div>
          <h4 className="mb-1 text-sm font-medium text-gray-500">Example</h4>
          <pre className="whitespace-pre-wrap rounded bg-gray-100 p-3 text-sm">
            {explanation.example}
          </pre>
        </div>

        <div>
          <h4 className="mb-1 text-sm font-medium text-gray-500">
            How to interpret
          </h4>
          <ul className="list-inside list-disc space-y-1 text-sm text-gray-700">
            {explanation.interpretation.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
