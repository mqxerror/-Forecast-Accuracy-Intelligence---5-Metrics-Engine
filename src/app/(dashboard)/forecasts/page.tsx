'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FiveMetricsGrid } from '@/components/forecasts/five-metrics-grid'
import { CalculationExplainer } from '@/components/forecasts/calculation-explainer'
import { DataTable } from '@/components/shared/data-table'
import { MetricGridSkeleton, TableSkeleton } from '@/components/shared/loading-skeleton'
import { Header } from '@/components/layout/header'
import { formatPercentage } from '@/lib/utils/format-number'
import { Badge } from '@/components/ui/badge'

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

export default function ForecastsPage() {
  const [data, setData] = useState<ForecastData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null)

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
    if (mape < 20) return <Badge className="bg-blue-100 text-blue-800">Good</Badge>
    if (mape < 30) return <Badge className="bg-yellow-100 text-yellow-800">Acceptable</Badge>
    return <Badge variant="destructive">Poor</Badge>
  }

  return (
    <div className="flex flex-col">
      <Header
        title="Forecast Accuracy"
        subtitle="How accurate are Inventory Planner's predictions?"
        showSyncButton={false}
      />

      <div className="space-y-6 p-6">
        {loading ? (
          <MetricGridSkeleton />
        ) : data ? (
          <>
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

            <p className="text-sm text-gray-500">
              Click on any metric card above to see how it&apos;s calculated
            </p>
          </>
        ) : (
          <p className="text-gray-500">No forecast data available. Run a sync to calculate metrics.</p>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Best Performers</CardTitle>
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
              <CardTitle className="text-lg">Needs Improvement</CardTitle>
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

        {data?.distribution && data.distribution.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Accuracy Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.distribution.map((bucket) => (
                  <div key={bucket.name} className="flex items-center gap-4">
                    <span className="w-32 text-sm">{bucket.name}</span>
                    <div className="flex-1">
                      <div className="h-6 w-full overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: `${bucket.percentage}%` }}
                        />
                      </div>
                    </div>
                    <span className="w-16 text-right text-sm text-gray-500">
                      {bucket.count} ({(bucket.percentage ?? 0).toFixed(0)}%)
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
