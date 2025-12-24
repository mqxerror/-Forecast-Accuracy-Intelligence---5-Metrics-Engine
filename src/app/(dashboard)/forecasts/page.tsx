'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FiveMetricsGrid } from '@/components/forecasts/five-metrics-grid'
import { CalculationExplainer } from '@/components/forecasts/calculation-explainer'
import { ExecutiveSummary } from '@/components/forecasts/executive-summary'
import { AdminFormulasPanel } from '@/components/forecasts/admin-formulas-panel'
import { SkuMetricsBrowser } from '@/components/forecasts/sku-metrics-browser'
import { DataTable } from '@/components/shared/data-table'
import { MetricGridSkeleton, TableSkeleton } from '@/components/shared/loading-skeleton'
import { Header } from '@/components/layout/header'
import { formatPercentage } from '@/lib/utils/format-number'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { LayoutDashboard, List, Settings } from 'lucide-react'
import { OOSDefinitions } from '@/components/data-quality'

interface ForecastData {
  averages: {
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
  best: Array<{ sku: string; mape: number; wape: number }>
  worst: Array<{ sku: string; mape: number; wape: number }>
}

const DISTRIBUTION_COLORS = {
  'Excellent (<10%)': '#22c55e',
  'Good (10-20%)': '#3b82f6',
  'Acceptable (20-30%)': '#eab308',
  'Poor (30-50%)': '#f97316',
  'Very Poor (>50%)': '#ef4444',
}

export default function ForecastsPage() {
  const [data, setData] = useState<ForecastData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/forecasts?view=overview')
        const json = await response.json()
        setData(json)
      } catch (error) {
        console.error('Failed to fetch forecast data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleMetricClick = (metric: string) => {
    setSelectedMetric(selectedMetric === metric ? null : metric)
  }

  const getAccuracyBadge = (mape: number) => {
    if (mape < 10) return <Badge className="bg-green-100 text-green-800">Excellent</Badge>
    if (mape < 20) return <Badge className="bg-lime-100 text-lime-800">Good</Badge>
    if (mape < 30) return <Badge className="bg-yellow-100 text-yellow-800">Acceptable</Badge>
    if (mape < 50) return <Badge className="bg-orange-100 text-orange-800">Poor</Badge>
    return <Badge variant="destructive">Very Poor</Badge>
  }

  return (
    <div className="flex flex-col">
      <Header
        title="Forecast Intelligence"
        subtitle="Accuracy analysis, insights, and decision support"
        showSyncButton={false}
      />

      <div className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="skus" className="gap-2">
              <List className="h-4 w-4" />
              SKU Details
            </TabsTrigger>
            <TabsTrigger value="admin" className="gap-2">
              <Settings className="h-4 w-4" />
              Admin
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {loading ? (
              <MetricGridSkeleton />
            ) : data ? (
              <>
                {/* Executive Summary */}
                <ExecutiveSummary
                  metrics={data.averages}
                  distribution={data.distribution}
                />

                {/* Metrics Grid */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Accuracy Metrics</CardTitle>
                    <p className="text-sm text-gray-500">
                      Click any metric to see the formula and calculation details
                    </p>
                  </CardHeader>
                  <CardContent>
                    <FiveMetricsGrid
                      metrics={{
                        mape: data.averages.mape,
                        wape: data.averages.wape,
                        rmse: data.averages.rmse,
                        wase: data.averages.wase,
                        bias: data.averages.bias,
                        naiveMape: data.averages.naiveMape,
                      }}
                      onMetricClick={handleMetricClick}
                    />

                    {selectedMetric && (
                      <CalculationExplainer
                        metric={selectedMetric}
                        onClose={() => setSelectedMetric(null)}
                      />
                    )}
                  </CardContent>
                </Card>

                {/* Distribution Chart */}
                {data.distribution && data.distribution.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Accuracy Distribution</CardTitle>
                      <p className="text-sm text-gray-500">
                        How are your SKUs distributed across accuracy tiers?
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-6 lg:grid-cols-2">
                        {/* Bar Chart */}
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={data.distribution} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                            <XAxis type="number" tick={{ fontSize: 11 }} />
                            <YAxis
                              type="category"
                              dataKey="name"
                              width={120}
                              tick={{ fontSize: 11 }}
                            />
                            <Tooltip
                              formatter={(value) => [Number(value), 'SKUs']}
                              contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                            />
                            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                              {data.distribution.map((entry) => (
                                <Cell
                                  key={entry.name}
                                  fill={DISTRIBUTION_COLORS[entry.name as keyof typeof DISTRIBUTION_COLORS] || '#94a3b8'}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>

                        {/* Progress Bars */}
                        <div className="space-y-3">
                          {data.distribution.map((bucket) => (
                            <div key={bucket.name} className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span>{bucket.name}</span>
                                <span className="font-medium">
                                  {bucket.count} ({bucket.percentage.toFixed(0)}%)
                                </span>
                              </div>
                              <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
                                <div
                                  className="h-full transition-all"
                                  style={{
                                    width: `${bucket.percentage}%`,
                                    backgroundColor: DISTRIBUTION_COLORS[bucket.name as keyof typeof DISTRIBUTION_COLORS] || '#94a3b8',
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Best and Worst Performers */}
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <span className="text-green-500">*</span>
                        Best Performers
                      </CardTitle>
                      <p className="text-sm text-gray-500">SKUs with most accurate forecasts</p>
                    </CardHeader>
                    <CardContent>
                      {loading ? (
                        <TableSkeleton rows={5} />
                      ) : data?.best?.length ? (
                        <DataTable
                          data={data.best}
                          columns={[
                            { key: 'sku', header: 'SKU', className: 'font-mono' },
                            {
                              key: 'mape',
                              header: 'MAPE',
                              render: (value) => formatPercentage(value as number),
                            },
                            {
                              key: 'wape',
                              header: 'WAPE',
                              render: (value) => formatPercentage(value as number),
                            },
                            {
                              key: 'mape',
                              header: 'Rating',
                              render: (value) => getAccuracyBadge(value as number),
                            },
                          ]}
                        />
                      ) : (
                        <p className="py-4 text-center text-gray-500">No data</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <span className="text-red-500">!</span>
                        Needs Improvement
                      </CardTitle>
                      <p className="text-sm text-gray-500">SKUs requiring attention</p>
                    </CardHeader>
                    <CardContent>
                      {loading ? (
                        <TableSkeleton rows={5} />
                      ) : data?.worst?.length ? (
                        <DataTable
                          data={data.worst}
                          columns={[
                            { key: 'sku', header: 'SKU', className: 'font-mono' },
                            {
                              key: 'mape',
                              header: 'MAPE',
                              render: (value) => formatPercentage(value as number),
                            },
                            {
                              key: 'wape',
                              header: 'WAPE',
                              render: (value) => formatPercentage(value as number),
                            },
                            {
                              key: 'mape',
                              header: 'Rating',
                              render: (value) => getAccuracyBadge(value as number),
                            },
                          ]}
                        />
                      ) : (
                        <p className="py-4 text-center text-gray-500">No data</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-gray-500">
                    No forecast data available. Run a sync to calculate metrics.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="skus">
            <SkuMetricsBrowser />
          </TabsContent>

          <TabsContent value="admin" className="space-y-6">
            {data && (
              <AdminFormulasPanel metrics={data.averages} />
            )}

            {/* Additional Admin Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Data Quality Checks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-lg border p-4">
                    <h4 className="font-medium">SKUs with Metrics</h4>
                    <p className="mt-1 text-2xl font-bold">{data?.averages.skuCount || 0}</p>
                    <p className="text-xs text-gray-500">
                      SKUs with calculated forecast accuracy
                    </p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <h4 className="font-medium">Data Completeness</h4>
                    <p className="mt-1 text-2xl font-bold">
                      {data?.averages.mape !== null ? 'Complete' : 'Incomplete'}
                    </p>
                    <p className="text-xs text-gray-500">
                      All required metrics calculated
                    </p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <h4 className="font-medium">Forecast Value</h4>
                    <p className="mt-1 text-2xl font-bold">
                      {data?.averages?.wase != null && data.averages.wase < 1
                        ? 'Positive'
                        : 'Review Needed'}
                    </p>
                    <p className="text-xs text-gray-500">
                      WASE {data?.averages.wase?.toFixed(2) || 'N/A'} (should be &lt;1)
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Interpretation Guide</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <h4 className="font-medium">When MAPE is high:</h4>
                    <ul className="list-inside list-disc space-y-1 text-sm text-gray-600">
                      <li>Check for demand volatility or seasonality</li>
                      <li>Review forecast model parameters</li>
                      <li>Look for data quality issues (returns, transfers)</li>
                      <li>Consider using different forecast methods for slow-movers</li>
                    </ul>
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-medium">When Bias is significant:</h4>
                    <ul className="list-inside list-disc space-y-1 text-sm text-gray-600">
                      <li>Positive bias: Forecasts consistently too high</li>
                      <li>Negative bias: Forecasts consistently too low</li>
                      <li>Review lead time assumptions</li>
                      <li>Check for systematic data collection issues</li>
                    </ul>
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-medium">When WASE {'>'} 1:</h4>
                    <ul className="list-inside list-disc space-y-1 text-sm text-gray-600">
                      <li>Naive forecast would be more accurate</li>
                      <li>Forecasting model may be over-complicated</li>
                      <li>Consider simpler methods for stable demand</li>
                    </ul>
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-medium">Best practices:</h4>
                    <ul className="list-inside list-disc space-y-1 text-sm text-gray-600">
                      <li>Review worst performers monthly</li>
                      <li>Track metrics over time for trends</li>
                      <li>Segment by product category for insights</li>
                      <li>Use WAPE for volume-weighted accuracy</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stock Status Definitions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Stock Status Reference</CardTitle>
                <p className="text-sm text-gray-500">
                  Understanding the different out-of-stock metrics
                </p>
              </CardHeader>
              <CardContent>
                <OOSDefinitions />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
