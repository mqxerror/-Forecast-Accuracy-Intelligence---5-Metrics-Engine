'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Header } from '@/components/layout/header'
import { formatCurrency } from '@/lib/utils/format-currency'
import { formatNumber, formatPercentage } from '@/lib/utils/format-number'
import {
  ArrowLeft,
  Package,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  DollarSign,
  Calendar,
  BarChart3,
  Truck,
  Clock,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts'
import type { Variant, ForecastMetric } from '@/types/database'

interface PageProps {
  params: Promise<{ sku: string }>
}

interface VariantDetail {
  variant: Variant
  metrics: ForecastMetric | null
}

export default function SKUDetailPage({ params }: PageProps) {
  const { sku } = use(params)
  const router = useRouter()
  const [data, setData] = useState<VariantDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`/api/inventory/${encodeURIComponent(sku)}`)
        if (!response.ok) {
          if (response.status === 404) {
            setError('Product not found')
          } else {
            setError('Failed to load product')
          }
          return
        }
        const json = await response.json()
        setData(json)
      } catch (err) {
        setError('Failed to load product')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [sku])

  if (loading) {
    return (
      <div className="flex flex-col">
        <Header title="Loading..." showSyncButton={false} />
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-64 bg-gray-200 rounded" />
            <div className="grid gap-4 md:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 bg-gray-200 rounded" />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col">
        <Header title="Error" showSyncButton={false} />
        <div className="p-6">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500 mb-4">{error || 'Product not found'}</p>
              <Button onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go Back
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const { variant, metrics } = data

  // Process orders_by_month for chart
  const salesData = processSalesData(variant.orders_by_month)
  const forecastAccuracy = metrics?.mape !== null ? 100 - (metrics?.mape || 0) : null

  // Calculate trend (compare last 30 days to previous 30 days)
  const salesTrend = variant.last_30_days_sales > 0 && variant.last_90_days_sales > 0
    ? ((variant.last_30_days_sales - (variant.last_90_days_sales - variant.last_30_days_sales) / 2) /
       ((variant.last_90_days_sales - variant.last_30_days_sales) / 2) * 100)
    : 0

  const getStockStatusBadge = () => {
    if (variant.in_stock <= 0) {
      return <Badge variant="destructive">Out of Stock</Badge>
    }
    if (variant.oos > 0) {
      return <Badge variant="destructive">OOS {variant.oos} days</Badge>
    }
    if (variant.replenishment > 0) {
      return <Badge className="bg-yellow-100 text-yellow-800">Needs Reorder</Badge>
    }
    return <Badge className="bg-green-100 text-green-800">Healthy</Badge>
  }

  return (
    <div className="flex flex-col">
      <Header
        title={variant.sku}
        subtitle={variant.title || 'Untitled Product'}
        showSyncButton={false}
      />

      <div className="p-6 space-y-6">
        {/* Back button and status */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Inventory
          </Button>
          <div className="flex items-center gap-2">
            {getStockStatusBadge()}
            {variant.brand && (
              <Badge variant="outline">{variant.brand}</Badge>
            )}
            {variant.product_type && (
              <Badge variant="outline">{variant.product_type}</Badge>
            )}
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="In Stock"
            value={formatNumber(variant.in_stock)}
            subtitle={variant.in_stock < 0 ? 'Oversold' : 'units available'}
            icon={Package}
            variant={variant.in_stock <= 0 ? 'danger' : variant.in_stock < 10 ? 'warning' : 'success'}
          />
          <MetricCard
            title="30-Day Sales"
            value={formatNumber(variant.last_30_days_sales)}
            subtitle={
              salesTrend !== 0 ? (
                <span className={salesTrend > 0 ? 'text-green-600' : 'text-red-600'}>
                  {salesTrend > 0 ? '↑' : '↓'} {Math.abs(salesTrend).toFixed(0)}% vs prev
                </span>
              ) : 'units sold'
            }
            icon={salesTrend >= 0 ? TrendingUp : TrendingDown}
            variant={salesTrend >= 0 ? 'success' : 'warning'}
          />
          <MetricCard
            title="Reorder Qty"
            value={variant.replenishment > 0 ? formatNumber(variant.replenishment) : '-'}
            subtitle={variant.replenishment > 0 ? 'units to order' : 'No reorder needed'}
            icon={Truck}
            variant={variant.replenishment > 0 ? 'warning' : 'default'}
          />
          <MetricCard
            title="Inventory Value"
            value={formatCurrency((variant.in_stock || 0) * (variant.cost_price || 0))}
            subtitle={`@ ${formatCurrency(variant.cost_price)} cost`}
            icon={DollarSign}
            variant="default"
          />
        </div>

        {/* Sales Chart & Details */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Sales History Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Sales History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {salesData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={salesData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value) => [formatNumber(Number(value) || 0), 'Units Sold']}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                    />
                    <Bar dataKey="sales" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-gray-500">
                  No historical sales data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Product Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Product Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <DetailRow label="SKU" value={variant.sku} mono />
              <DetailRow label="Barcode" value={variant.barcode || '-'} mono />
              <DetailRow label="Price" value={formatCurrency(variant.price)} />
              <DetailRow label="Cost" value={formatCurrency(variant.cost_price)} />
              <DetailRow
                label="Lead Time"
                value={variant.lead_time ? `${variant.lead_time} days` : '-'}
              />
              <DetailRow
                label="Min Stock"
                value={variant.minimum_stock ? formatNumber(variant.minimum_stock) : '-'}
              />
              <DetailRow
                label="Last Synced"
                value={new Date(variant.synced_at).toLocaleDateString()}
              />
            </CardContent>
          </Card>
        </div>

        {/* Sales Breakdown & Forecast */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Sales Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Sales Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <SalesRow period="Last 7 days" value={variant.last_7_days_sales} />
                <SalesRow period="Last 30 days" value={variant.last_30_days_sales} />
                <SalesRow period="Last 90 days" value={variant.last_90_days_sales} />
                <SalesRow period="Last 180 days" value={variant.last_180_days_sales} />
                <SalesRow period="Last 365 days" value={variant.last_365_days_sales} />
                <div className="border-t pt-3">
                  <SalesRow period="Total (all time)" value={variant.total_sales} bold />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Forecast Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Forecast Accuracy
              </CardTitle>
            </CardHeader>
            <CardContent>
              {metrics ? (
                <div className="space-y-4">
                  <div className="text-center py-4">
                    <div className="text-4xl font-bold">
                      {forecastAccuracy !== null ? formatPercentage(forecastAccuracy, 1) : '-'}
                    </div>
                    <p className="text-sm text-gray-500">Overall Accuracy</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <MetricPill label="MAPE" value={formatPercentage(metrics.mape, 1)} />
                    <MetricPill label="WAPE" value={formatPercentage(metrics.wape, 1)} />
                    <MetricPill label="RMSE" value={metrics.rmse?.toFixed(1) || '-'} />
                    <MetricPill label="Bias" value={formatPercentage(metrics.bias, 1)} />
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-gray-500">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p>No forecast metrics calculated yet</p>
                  <p className="text-xs mt-1">Metrics require historical sales data</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Lost Revenue Alert */}
        {variant.forecasted_lost_revenue && variant.forecasted_lost_revenue > 0 && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-red-100">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="font-semibold text-red-800">
                    Estimated Lost Revenue: {formatCurrency(variant.forecasted_lost_revenue)}
                  </p>
                  <p className="text-sm text-red-700">
                    This product has been out of stock for {variant.oos} days, resulting in potential lost sales.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Raw Data Inspector (Admin) */}
        {variant.raw_data && (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-base text-gray-500">Raw JSON Data (Admin)</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-gray-50 p-4 rounded-lg overflow-auto max-h-[300px] text-gray-600">
                {JSON.stringify(variant.raw_data, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

// Helper Components
function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'default',
}: {
  title: string
  value: string
  subtitle: React.ReactNode
  icon: React.ElementType
  variant?: 'default' | 'success' | 'warning' | 'danger'
}) {
  const variantStyles = {
    default: 'bg-blue-50 text-blue-600',
    success: 'bg-green-50 text-green-600',
    warning: 'bg-yellow-50 text-yellow-600',
    danger: 'bg-red-50 text-red-600',
  }

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-500">{title}</span>
          <div className={`p-2 rounded-lg ${variantStyles[variant]}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </CardContent>
    </Card>
  )
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={mono ? 'font-mono' : 'font-medium'}>{value}</span>
    </div>
  )
}

function SalesRow({ period, value, bold }: { period: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between text-sm ${bold ? 'font-semibold' : ''}`}>
      <span className="text-gray-600">{period}</span>
      <span>{formatNumber(value)}</span>
    </div>
  )
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 text-center">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  )
}

// Process orders_by_month JSON into chart data
function processSalesData(ordersJson: unknown): { month: string; sales: number }[] {
  if (!ordersJson || typeof ordersJson !== 'object') return []

  const orders = ordersJson as Record<string, Record<string, number>>
  const data: { month: string; sales: number; sortKey: string }[] = []

  for (const year of Object.keys(orders).sort()) {
    const months = orders[year]
    if (typeof months !== 'object') continue

    for (const month of Object.keys(months).sort((a, b) => Number(a) - Number(b))) {
      const monthNum = Number(month)
      const monthName = new Date(2000, monthNum - 1).toLocaleString('default', { month: 'short' })
      data.push({
        month: `${monthName} '${year.slice(-2)}`,
        sales: Number(months[month]) || 0,
        sortKey: `${year}-${month.padStart(2, '0')}`,
      })
    }
  }

  // Sort and take last 12 months
  return data
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .slice(-12)
    .map(({ month, sales }) => ({ month, sales }))
}
