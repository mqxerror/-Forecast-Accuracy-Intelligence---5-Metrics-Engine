'use client'

import { memo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ChevronDown,
  ChevronUp,
  Code,
  Database,
  Calculator,
  FileJson,
  Shield,
} from 'lucide-react'

interface AdminFormulasPanelProps {
  metrics: {
    mape: number | null
    wape: number | null
    rmse: number | null
    wase: number | null
    bias: number | null
    naiveMape: number | null
    skuCount: number
  }
}

const formulas = {
  mape: {
    name: 'MAPE (Mean Absolute Percentage Error)',
    formula: 'MAPE = (1/n) * SUM(|Actual - Forecast| / Actual) * 100',
    sql: `SELECT
  AVG(ABS(actual_value - forecast_value) / NULLIF(actual_value, 0) * 100) as mape
FROM forecast_metrics
WHERE actual_value > 0`,
    jsCode: `function calculateMAPE(actual: number[], forecast: number[]): number {
  const errors = actual.map((a, i) => Math.abs(a - forecast[i]) / a);
  return (errors.reduce((sum, e) => sum + e, 0) / errors.length) * 100;
}`,
    dataSource: 'forecast_metrics.actual_values, forecast_metrics.forecast_values',
    notes: 'Excludes periods where actual = 0 to avoid division by zero',
  },
  wape: {
    name: 'WAPE (Weighted Absolute Percentage Error)',
    formula: 'WAPE = SUM(|Actual - Forecast|) / SUM(Actual) * 100',
    sql: `SELECT
  SUM(ABS(actual_value - forecast_value)) / NULLIF(SUM(actual_value), 0) * 100 as wape
FROM forecast_metrics`,
    jsCode: `function calculateWAPE(actual: number[], forecast: number[]): number {
  const totalError = actual.reduce((sum, a, i) => sum + Math.abs(a - forecast[i]), 0);
  const totalActual = actual.reduce((sum, a) => sum + a, 0);
  return (totalError / totalActual) * 100;
}`,
    dataSource: 'forecast_metrics.actual_values, forecast_metrics.forecast_values',
    notes: 'Volume-weighted - high-volume SKUs contribute more to the score',
  },
  rmse: {
    name: 'RMSE (Root Mean Square Error)',
    formula: 'RMSE = SQRT((1/n) * SUM((Actual - Forecast)^2))',
    sql: `SELECT
  SQRT(AVG(POWER(actual_value - forecast_value, 2))) as rmse
FROM forecast_metrics`,
    jsCode: `function calculateRMSE(actual: number[], forecast: number[]): number {
  const squaredErrors = actual.map((a, i) => Math.pow(a - forecast[i], 2));
  return Math.sqrt(squaredErrors.reduce((sum, e) => sum + e, 0) / squaredErrors.length);
}`,
    dataSource: 'forecast_metrics.actual_values, forecast_metrics.forecast_values',
    notes: 'Same units as the data - penalizes large errors more heavily',
  },
  wase: {
    name: 'WASE (Weighted Absolute Scaled Error)',
    formula: 'WASE = SUM(|Actual - Forecast|) / SUM(|Actual_t - Actual_{t-1}|)',
    sql: `-- Calculated in application code
-- Compares forecast errors to naive forecast errors
-- Naive forecast: use previous period as prediction

SELECT
  SUM(ABS(actual_value - forecast_value)) /
  NULLIF(SUM(ABS(actual_value - LAG(actual_value) OVER (ORDER BY period))), 0) as wase
FROM forecast_metrics`,
    jsCode: `function calculateWASE(actual: number[], forecast: number[]): number {
  const forecastErrors = actual.reduce((sum, a, i) => sum + Math.abs(a - forecast[i]), 0);
  const naiveErrors = actual.reduce((sum, a, i) =>
    i > 0 ? sum + Math.abs(a - actual[i-1]) : sum, 0);
  return forecastErrors / naiveErrors;
}`,
    dataSource: 'forecast_metrics.actual_values, forecast_metrics.forecast_values',
    notes: '< 1 means better than naive forecast, > 1 means worse',
  },
  bias: {
    name: 'Forecast Bias',
    formula: 'Bias = (1/n) * SUM((Forecast - Actual) / Actual) * 100',
    sql: `SELECT
  AVG((forecast_value - actual_value) / NULLIF(actual_value, 0)) * 100 as bias
FROM forecast_metrics
WHERE actual_value > 0`,
    jsCode: `function calculateBias(actual: number[], forecast: number[]): number {
  const biases = actual.map((a, i) => (forecast[i] - a) / a);
  return (biases.reduce((sum, b) => sum + b, 0) / biases.length) * 100;
}`,
    dataSource: 'forecast_metrics.actual_values, forecast_metrics.forecast_values',
    notes: 'Positive = over-forecasting, Negative = under-forecasting',
  },
  naiveMape: {
    name: 'Naive MAPE (Benchmark)',
    formula: 'Naive MAPE = (1/n) * SUM(|Actual_t - Actual_{t-1}| / Actual_t) * 100',
    sql: `-- Calculated by using previous period as the forecast
SELECT
  AVG(ABS(actual_value - LAG(actual_value) OVER (ORDER BY period)) /
      NULLIF(actual_value, 0)) * 100 as naive_mape
FROM forecast_metrics`,
    jsCode: `function calculateNaiveMAPE(actual: number[]): number {
  const errors = actual.slice(1).map((a, i) => Math.abs(a - actual[i]) / a);
  return (errors.reduce((sum, e) => sum + e, 0) / errors.length) * 100;
}`,
    dataSource: 'forecast_metrics.actual_values (historical)',
    notes: 'Baseline benchmark - your forecast should beat this',
  },
}

const aggregationQueries = {
  averages: {
    name: 'Portfolio Averages',
    sql: `-- Get average metrics across all SKUs
SELECT
  AVG(mape) as avg_mape,
  AVG(wape) as avg_wape,
  AVG(rmse) as avg_rmse,
  AVG(wase) as avg_wase,
  AVG(bias) as avg_bias,
  AVG(naive_mape) as avg_naive_mape,
  COUNT(*) as sku_count
FROM forecast_metrics
WHERE mape IS NOT NULL`,
    notes: 'Simple average - all SKUs weighted equally',
  },
  distribution: {
    name: 'Accuracy Distribution',
    sql: `-- Bucket SKUs by MAPE accuracy
SELECT
  CASE
    WHEN mape < 10 THEN 'Excellent (<10%)'
    WHEN mape < 20 THEN 'Good (10-20%)'
    WHEN mape < 30 THEN 'Acceptable (20-30%)'
    WHEN mape < 50 THEN 'Poor (30-50%)'
    ELSE 'Very Poor (>50%)'
  END as accuracy_bucket,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM forecast_metrics
WHERE mape IS NOT NULL
GROUP BY 1
ORDER BY
  CASE accuracy_bucket
    WHEN 'Excellent (<10%)' THEN 1
    WHEN 'Good (10-20%)' THEN 2
    WHEN 'Acceptable (20-30%)' THEN 3
    WHEN 'Poor (30-50%)' THEN 4
    ELSE 5
  END`,
    notes: 'Groups SKUs into performance tiers',
  },
  bestWorst: {
    name: 'Best/Worst Performers',
    sql: `-- Best performers (lowest MAPE)
SELECT sku, mape, wape
FROM forecast_metrics
WHERE mape IS NOT NULL
ORDER BY mape ASC
LIMIT 5;

-- Worst performers (highest MAPE)
SELECT sku, mape, wape
FROM forecast_metrics
WHERE mape IS NOT NULL
ORDER BY mape DESC
LIMIT 5;`,
    notes: 'Identifies SKUs needing attention',
  },
}

export const AdminFormulasPanel = memo(function AdminFormulasPanel({
  metrics,
}: AdminFormulasPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <Card className="border-purple-200 bg-purple-50/30">
      <CardHeader
        className="cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-purple-600" />
            <CardTitle className="text-base">Admin: Formulas & Data Sources</CardTitle>
            <Badge variant="outline" className="border-purple-300 text-purple-700">
              Developer Reference
            </Badge>
          </div>
          <Button variant="ghost" size="sm">
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent>
          <Tabs defaultValue="formulas">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="formulas" className="gap-1">
                <Calculator className="h-4 w-4" />
                Metric Formulas
              </TabsTrigger>
              <TabsTrigger value="queries" className="gap-1">
                <Database className="h-4 w-4" />
                SQL Queries
              </TabsTrigger>
              <TabsTrigger value="current" className="gap-1">
                <FileJson className="h-4 w-4" />
                Current Values
              </TabsTrigger>
            </TabsList>

            <TabsContent value="formulas" className="mt-4 space-y-4">
              {Object.entries(formulas).map(([key, formula]) => (
                <FormulaCard key={key} formula={formula} />
              ))}
            </TabsContent>

            <TabsContent value="queries" className="mt-4 space-y-4">
              <div className="rounded-lg border bg-gray-900 p-4 text-sm">
                <p className="mb-2 text-gray-400">Database: Supabase PostgreSQL</p>
                <p className="text-gray-400">Table: forecast_metrics</p>
              </div>
              {Object.entries(aggregationQueries).map(([key, query]) => (
                <div key={key} className="rounded-lg border p-4">
                  <h4 className="mb-2 font-medium">{query.name}</h4>
                  <pre className="overflow-x-auto rounded bg-gray-900 p-3 text-xs text-green-400">
                    {query.sql}
                  </pre>
                  <p className="mt-2 text-xs text-gray-500">{query.notes}</p>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="current" className="mt-4">
              <div className="rounded-lg border p-4">
                <h4 className="mb-4 font-medium">Current Calculated Values</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  {Object.entries(metrics).map(([key, value]) => (
                    <div key={key} className="flex justify-between rounded bg-gray-50 p-3">
                      <span className="font-mono text-sm">{key}</span>
                      <span className="font-bold">
                        {value !== null ? (
                          typeof value === 'number' && key !== 'skuCount'
                            ? value.toFixed(2)
                            : value
                        ) : (
                          'null'
                        )}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-lg border bg-yellow-50 p-4">
                  <h5 className="mb-2 flex items-center gap-2 font-medium text-yellow-800">
                    <Code className="h-4 w-4" />
                    Verification Steps
                  </h5>
                  <ol className="list-inside list-decimal space-y-1 text-sm text-yellow-700">
                    <li>Check that MAPE aligns with actual vs forecast data in DB</li>
                    <li>Verify WASE &lt; 1 indicates forecast beats naive method</li>
                    <li>Confirm Bias sign matches over/under-forecasting trend</li>
                    <li>Compare MAPE vs Naive MAPE to validate forecast value</li>
                    <li>Cross-check SKU count with total variants in database</li>
                  </ol>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      )}
    </Card>
  )
})

function FormulaCard({
  formula,
}: {
  formula: typeof formulas.mape
}) {
  const [showCode, setShowCode] = useState(false)

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">{formula.name}</h4>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowCode(!showCode)}
        >
          <Code className="mr-1 h-3 w-3" />
          {showCode ? 'Hide Code' : 'Show Code'}
        </Button>
      </div>

      <div className="mt-2">
        <code className="block rounded bg-blue-50 p-2 text-sm font-mono">
          {formula.formula}
        </code>
      </div>

      {showCode && (
        <div className="mt-3 space-y-3">
          <div>
            <span className="text-xs font-medium text-gray-500">SQL Implementation</span>
            <pre className="mt-1 overflow-x-auto rounded bg-gray-900 p-2 text-xs text-green-400">
              {formula.sql}
            </pre>
          </div>
          <div>
            <span className="text-xs font-medium text-gray-500">TypeScript Implementation</span>
            <pre className="mt-1 overflow-x-auto rounded bg-gray-900 p-2 text-xs text-blue-400">
              {formula.jsCode}
            </pre>
          </div>
        </div>
      )}

      <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
        <span>
          <strong>Data Source:</strong> {formula.dataSource}
        </span>
      </div>
      <p className="mt-1 text-xs text-gray-500">{formula.notes}</p>
    </div>
  )
}
