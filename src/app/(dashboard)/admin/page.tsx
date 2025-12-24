'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Header } from '@/components/layout/header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Database,
  FileJson,
  Calculator,
  History,
  AlertTriangle,
  CheckCircle,
  Search,
  RefreshCw,
  Download,
  Eye,
  Settings,
  Activity,
  ArrowLeftRight,
  Webhook,
  Copy,
  Check,
  ExternalLink,
  Play,
  Save,
  Loader2,
} from 'lucide-react'
import { SyncProgressPanel, SyncHistoryTable } from '@/components/sync'
import Link from 'next/link'
import { formatNumber, formatPercentage } from '@/lib/utils/format-number'

interface SyncRecord {
  id: string
  sync_type: string | null
  status: string | null
  records_fetched: number | null
  records_updated: number | null
  started_at: string | null
  completed_at: string | null
  error_message: string | null
}

interface DataQuality {
  totalVariants: number
  withCost: number
  withPrice: number
  withForecasts: number
  withSalesHistory: number
  withMetrics: number
  negativeStock: number
  zeroStock: number
  missingFields: Array<{ field: string; count: number; percentage: number }>
}

interface VariantDebug {
  id: string
  sku: string
  title: string | null
  cost_price: number | null
  price: number | null
  in_stock: number
  orders_by_month: Record<string, Record<string, number>> | null
  forecast_by_period: Record<string, Record<string, number>> | null
  raw_data: Record<string, unknown> | null
  metrics: {
    mape: number | null
    wape: number | null
    actual_values: number[] | null
    forecast_values: number[] | null
  } | null
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [syncHistory, setSyncHistory] = useState<SyncRecord[]>([])
  const [dataQuality, setDataQuality] = useState<DataQuality | null>(null)
  const [variants, setVariants] = useState<VariantDebug[]>([])
  const [selectedVariant, setSelectedVariant] = useState<VariantDebug | null>(null)
  const [searchSku, setSearchSku] = useState('')
  const [loading, setLoading] = useState(true)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [n8nWebhookUrl, setN8nWebhookUrl] = useState('')
  const [appPublicUrl, setAppPublicUrl] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)
  const [triggeringSyncN8n, setTriggeringSyncN8n] = useState(false)
  const [settingsMessage, setSettingsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Get the app URL for webhook display
  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  // Fetch n8n settings
  const fetchN8nSettings = async () => {
    try {
      const res = await fetch('/api/settings?keys=n8n_webhook_url,app_public_url')
      if (res.ok) {
        const data = await res.json()
        setN8nWebhookUrl(data.settings?.n8n_webhook_url || '')
        setAppPublicUrl(data.settings?.app_public_url || '')
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error)
    }
  }

  // Save n8n settings
  const saveN8nSettings = async () => {
    setSavingSettings(true)
    setSettingsMessage(null)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            n8n_webhook_url: n8nWebhookUrl,
            app_public_url: appPublicUrl
          }
        })
      })
      if (res.ok) {
        setSettingsMessage({ type: 'success', text: 'Settings saved!' })
      } else {
        throw new Error('Failed to save')
      }
    } catch (error) {
      setSettingsMessage({ type: 'error', text: 'Failed to save settings' })
    } finally {
      setSavingSettings(false)
      setTimeout(() => setSettingsMessage(null), 3000)
    }
  }

  // Get the effective callback URL (public URL if set, otherwise current origin)
  const callbackBaseUrl = appPublicUrl || appUrl

  // Trigger n8n sync
  const triggerN8nSync = async () => {
    if (!n8nWebhookUrl) {
      setSettingsMessage({ type: 'error', text: 'Please enter and save the n8n webhook URL first' })
      return
    }
    setTriggeringSyncN8n(true)
    setSettingsMessage(null)
    try {
      const res = await fetch('/api/sync/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await res.json()
      if (res.ok) {
        setSettingsMessage({ type: 'success', text: 'Sync triggered! n8n will send data shortly.' })
      } else {
        throw new Error(data.error || 'Failed to trigger sync')
      }
    } catch (error) {
      setSettingsMessage({ type: 'error', text: String(error) })
    } finally {
      setTriggeringSyncN8n(false)
      setTimeout(() => setSettingsMessage(null), 5000)
    }
  }

  useEffect(() => {
    fetchAdminData()
    fetchN8nSettings()
  }, [])

  async function fetchAdminData() {
    setLoading(true)
    try {
      const [syncRes, qualityRes, variantsRes] = await Promise.all([
        fetch('/api/admin/sync-history'),
        fetch('/api/admin/data-quality'),
        fetch('/api/admin/variants-debug?limit=20'),
      ])

      const [syncData, qualityData, variantsData] = await Promise.all([
        syncRes.json(),
        qualityRes.json(),
        variantsRes.json(),
      ])

      setSyncHistory(syncData.records || [])
      setDataQuality(qualityData)
      setVariants(variantsData.variants || [])
    } catch (error) {
      console.error('Failed to fetch admin data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function searchVariant() {
    if (!searchSku.trim()) return
    try {
      const res = await fetch(`/api/admin/variants-debug?sku=${encodeURIComponent(searchSku)}`)
      const data = await res.json()
      if (data.variants?.length) {
        setSelectedVariant(data.variants[0])
      }
    } catch (error) {
      console.error('Search failed:', error)
    }
  }

  return (
    <div className="flex flex-col">
      <Header
        title="Admin Dashboard"
        subtitle="Data inspection, calculation debugging & system health"
        showSyncButton={false}
      />

      <div className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between mb-6">
          <TabsList>
            <TabsTrigger value="overview" className="gap-2">
              <Activity className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="data-quality" className="gap-2">
              <Database className="h-4 w-4" />
              Data Quality
            </TabsTrigger>
            <TabsTrigger value="calculator" className="gap-2">
              <Calculator className="h-4 w-4" />
              Calculation Debugger
            </TabsTrigger>
            <TabsTrigger value="json-inspector" className="gap-2">
              <FileJson className="h-4 w-4" />
              JSON Inspector
            </TabsTrigger>
            <TabsTrigger value="sync-history" className="gap-2">
              <History className="h-4 w-4" />
              Sync History
            </TabsTrigger>
            <TabsTrigger value="n8n-sync" className="gap-2">
              <Webhook className="h-4 w-4" />
              n8n Sync
            </TabsTrigger>
          </TabsList>
          <Link href="/admin/inspector">
            <Button variant="outline" className="gap-2">
              <ArrowLeftRight className="h-4 w-4" />
              SKU Inspector
            </Button>
          </Link>
        </div>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <OverviewCard
                title="Data Quality Score"
                value={dataQuality ? `${Math.round(
                  ((dataQuality.withCost + dataQuality.withForecasts + dataQuality.withSalesHistory) /
                  (dataQuality.totalVariants * 3)) * 100
                )}%` : '-'}
                subtitle="Based on field completeness"
                icon={<Database className="h-5 w-5" />}
                status={dataQuality && dataQuality.withCost < dataQuality.totalVariants * 0.5 ? 'warning' : 'success'}
              />
              <OverviewCard
                title="SKUs with Metrics"
                value={dataQuality ? formatNumber(dataQuality.withMetrics) : '-'}
                subtitle={`of ${formatNumber(dataQuality?.totalVariants || 0)} total`}
                icon={<Calculator className="h-5 w-5" />}
                status={dataQuality && dataQuality.withMetrics < dataQuality.totalVariants * 0.5 ? 'warning' : 'success'}
              />
              <OverviewCard
                title="Missing Cost Data"
                value={dataQuality ? formatNumber(dataQuality.totalVariants - dataQuality.withCost) : '-'}
                subtitle="SKUs without cost"
                icon={<AlertTriangle className="h-5 w-5" />}
                status={dataQuality && dataQuality.withCost < dataQuality.totalVariants * 0.8 ? 'error' : 'success'}
              />
              <OverviewCard
                title="Last Sync"
                value={syncHistory[0]?.completed_at
                  ? new Date(syncHistory[0].completed_at).toLocaleDateString()
                  : 'Never'}
                subtitle={syncHistory[0]?.status || 'No sync yet'}
                icon={<RefreshCw className="h-5 w-5" />}
                status={syncHistory[0]?.status === 'completed' ? 'success' : 'warning'}
              />
            </div>

            {/* Quick Issues */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  Data Issues Detected
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dataQuality && dataQuality.withCost < dataQuality.totalVariants && (
                    <IssueRow
                      severity="high"
                      title="Missing Cost Data"
                      description={`${formatNumber(dataQuality.totalVariants - dataQuality.withCost)} SKUs have no cost_price value`}
                      action="Check JSON field mapping - cost field may be named differently"
                    />
                  )}
                  {dataQuality && dataQuality.negativeStock > 0 && (
                    <IssueRow
                      severity="medium"
                      title="Negative Inventory"
                      description={`${formatNumber(dataQuality.negativeStock)} SKUs show negative stock (oversold)`}
                      action="Review these SKUs for order fulfillment issues"
                    />
                  )}
                  {dataQuality && dataQuality.withForecasts < dataQuality.totalVariants * 0.5 && (
                    <IssueRow
                      severity="high"
                      title="Missing Forecast Data"
                      description={`Only ${formatNumber(dataQuality.withForecasts)} SKUs have forecast_by_period data`}
                      action="Verify Inventory Planner is exporting forecast data"
                    />
                  )}
                  {dataQuality && dataQuality.withSalesHistory < dataQuality.totalVariants * 0.5 && (
                    <IssueRow
                      severity="high"
                      title="Missing Sales History"
                      description={`Only ${formatNumber(dataQuality.withSalesHistory)} SKUs have orders_by_month data`}
                      action="Sales history needed for metric calculations"
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Data Quality Tab */}
          <TabsContent value="data-quality" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Field Completeness</CardTitle>
                <p className="text-sm text-gray-500">
                  How many SKUs have each required field populated
                </p>
              </CardHeader>
              <CardContent>
                {dataQuality && (
                  <div className="space-y-4">
                    <FieldBar label="cost_price" value={dataQuality.withCost} total={dataQuality.totalVariants} />
                    <FieldBar label="price" value={dataQuality.withPrice} total={dataQuality.totalVariants} />
                    <FieldBar label="orders_by_month" value={dataQuality.withSalesHistory} total={dataQuality.totalVariants} />
                    <FieldBar label="forecast_by_period" value={dataQuality.withForecasts} total={dataQuality.totalVariants} />
                    <FieldBar label="forecast_metrics" value={dataQuality.withMetrics} total={dataQuality.totalVariants} />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Stock Status</CardTitle>
              </CardHeader>
              <CardContent>
                {dataQuality && (
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="p-4 bg-red-50 rounded-lg">
                      <p className="text-2xl font-bold text-red-600">{formatNumber(dataQuality.negativeStock)}</p>
                      <p className="text-sm text-red-700">Negative Stock (Oversold)</p>
                    </div>
                    <div className="p-4 bg-yellow-50 rounded-lg">
                      <p className="text-2xl font-bold text-yellow-600">{formatNumber(dataQuality.zeroStock)}</p>
                      <p className="text-sm text-yellow-700">Zero Stock</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">
                        {formatNumber(dataQuality.totalVariants - dataQuality.negativeStock - dataQuality.zeroStock)}
                      </p>
                      <p className="text-sm text-green-700">Positive Stock</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Calculation Debugger Tab */}
          <TabsContent value="calculator" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Debug SKU Calculations
                </CardTitle>
                <p className="text-sm text-gray-500">
                  Inspect the actual vs forecast values used in metric calculations
                </p>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-6">
                  <Input
                    placeholder="Enter SKU to debug..."
                    value={searchSku}
                    onChange={(e) => setSearchSku(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && searchVariant()}
                    className="max-w-md"
                  />
                  <Button onClick={searchVariant}>
                    <Search className="h-4 w-4 mr-2" />
                    Debug
                  </Button>
                </div>

                {selectedVariant && (
                  <div className="space-y-6">
                    {/* SKU Info */}
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-semibold text-blue-800">SKU: {selectedVariant.sku}</h4>
                      <p className="text-sm text-blue-600">{selectedVariant.title || 'No title'}</p>
                    </div>

                    {/* Metrics Comparison */}
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <h4 className="font-medium mb-2">Calculated Metrics</h4>
                        <div className="space-y-2 text-sm">
                          <p>MAPE: <span className="font-mono">{selectedVariant.metrics?.mape?.toFixed(2) || 'N/A'}%</span></p>
                          <p>WAPE: <span className="font-mono">{selectedVariant.metrics?.wape?.toFixed(2) || 'N/A'}%</span></p>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">Array Lengths</h4>
                        <div className="space-y-2 text-sm">
                          <p>Actual Values: <span className="font-mono">{selectedVariant.metrics?.actual_values?.length || 0} periods</span></p>
                          <p>Forecast Values: <span className="font-mono">{selectedVariant.metrics?.forecast_values?.length || 0} periods</span></p>
                        </div>
                      </div>
                    </div>

                    {/* Actual vs Forecast Table */}
                    {selectedVariant.metrics?.actual_values && selectedVariant.metrics?.forecast_values && (
                      <div>
                        <h4 className="font-medium mb-2">Actual vs Forecast Comparison</h4>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Period</TableHead>
                                <TableHead className="text-right">Actual</TableHead>
                                <TableHead className="text-right">Forecast</TableHead>
                                <TableHead className="text-right">Error</TableHead>
                                <TableHead className="text-right">% Error</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {selectedVariant.metrics.actual_values.map((actual, i) => {
                                const forecast = selectedVariant.metrics?.forecast_values?.[i] || 0
                                const error = Math.abs(actual - forecast)
                                const pctError = actual !== 0 ? (error / actual) * 100 : 0
                                return (
                                  <TableRow key={i}>
                                    <TableCell className="font-mono">Period {i + 1}</TableCell>
                                    <TableCell className="text-right font-mono">{actual}</TableCell>
                                    <TableCell className="text-right font-mono">{forecast}</TableCell>
                                    <TableCell className="text-right font-mono">{error.toFixed(1)}</TableCell>
                                    <TableCell className="text-right">
                                      <span className={pctError > 50 ? 'text-red-600 font-semibold' : ''}>
                                        {pctError.toFixed(1)}%
                                      </span>
                                    </TableCell>
                                  </TableRow>
                                )
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}

                    {/* Raw Data Preview */}
                    <div>
                      <h4 className="font-medium mb-2">orders_by_month (Source for Actuals)</h4>
                      <pre className="text-xs bg-gray-50 p-4 rounded-lg overflow-auto max-h-[200px]">
                        {JSON.stringify(selectedVariant.orders_by_month, null, 2) || 'No data'}
                      </pre>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">forecast_by_period (Source for Forecasts)</h4>
                      <pre className="text-xs bg-gray-50 p-4 rounded-lg overflow-auto max-h-[200px]">
                        {JSON.stringify(selectedVariant.forecast_by_period, null, 2) || 'No data'}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Recent SKUs Table */}
                <div className="mt-6">
                  <h4 className="font-medium mb-3">Recent SKUs (Click to Debug)</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead className="text-right">MAPE</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                        <TableHead>Has Data</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {variants.map((v) => (
                        <TableRow key={v.id} className="cursor-pointer hover:bg-blue-50">
                          <TableCell className="font-mono">{v.sku}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{v.title || '-'}</TableCell>
                          <TableCell className="text-right">
                            {v.metrics?.mape ? `${v.metrics.mape.toFixed(1)}%` : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {v.cost_price ? `$${v.cost_price.toFixed(2)}` :
                              <span className="text-red-500">Missing</span>
                            }
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {v.orders_by_month && <Badge variant="outline" className="text-xs">Sales</Badge>}
                              {v.forecast_by_period && <Badge variant="outline" className="text-xs">Forecast</Badge>}
                              {v.metrics && <Badge variant="outline" className="text-xs">Metrics</Badge>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedVariant(v)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* JSON Inspector Tab */}
          <TabsContent value="json-inspector" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileJson className="h-5 w-5" />
                  Raw JSON Inspector
                </CardTitle>
                <p className="text-sm text-gray-500">
                  View the original data from Inventory Planner imports
                </p>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-6">
                  <Input
                    placeholder="Enter SKU to inspect raw JSON..."
                    value={searchSku}
                    onChange={(e) => setSearchSku(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && searchVariant()}
                    className="max-w-md"
                  />
                  <Button onClick={searchVariant}>
                    <Search className="h-4 w-4 mr-2" />
                    Inspect
                  </Button>
                </div>

                {selectedVariant?.raw_data && (
                  <div className="space-y-4">
                    <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                      <h4 className="font-semibold text-yellow-800 mb-2">Field Name Check</h4>
                      <div className="grid gap-2 text-sm">
                        <p>
                          <span className="font-medium">cost_price:</span>{' '}
                          {selectedVariant.raw_data.cost_price !== undefined
                            ? <span className="text-green-600">{String(selectedVariant.raw_data.cost_price)}</span>
                            : <span className="text-red-600">NOT FOUND</span>
                          }
                        </p>
                        <p>
                          <span className="font-medium">cost:</span>{' '}
                          {selectedVariant.raw_data.cost !== undefined
                            ? <span className="text-green-600">{String(selectedVariant.raw_data.cost)}</span>
                            : <span className="text-gray-400">not present</span>
                          }
                        </p>
                        <p>
                          <span className="font-medium">unit_cost:</span>{' '}
                          {selectedVariant.raw_data.unit_cost !== undefined
                            ? <span className="text-green-600">{String(selectedVariant.raw_data.unit_cost)}</span>
                            : <span className="text-gray-400">not present</span>
                          }
                        </p>
                        <p>
                          <span className="font-medium">average_cost:</span>{' '}
                          {selectedVariant.raw_data.average_cost !== undefined
                            ? <span className="text-green-600">{String(selectedVariant.raw_data.average_cost)}</span>
                            : <span className="text-gray-400">not present</span>
                          }
                        </p>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">All Fields in Raw JSON</h4>
                      <div className="bg-gray-50 rounded-lg p-4 max-h-[500px] overflow-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2">Field Name</th>
                              <th className="text-left py-2">Value</th>
                              <th className="text-left py-2">Type</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(selectedVariant.raw_data)
                              .sort(([a], [b]) => a.localeCompare(b))
                              .map(([key, value]) => (
                                <tr key={key} className="border-b">
                                  <td className="py-1 font-mono text-blue-600">{key}</td>
                                  <td className="py-1 font-mono max-w-[300px] truncate">
                                    {typeof value === 'object'
                                      ? JSON.stringify(value).substring(0, 100) + '...'
                                      : String(value)
                                    }
                                  </td>
                                  <td className="py-1 text-gray-500">{typeof value}</td>
                                </tr>
                              ))
                            }
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Full Raw JSON</h4>
                      <pre className="text-xs bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto max-h-[400px]">
                        {JSON.stringify(selectedVariant.raw_data, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sync History Tab */}
          <TabsContent value="sync-history">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Sync History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Records</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {syncHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                          No sync history available
                        </TableCell>
                      </TableRow>
                    ) : (
                      syncHistory.map((sync) => (
                        <TableRow key={sync.id}>
                          <TableCell className="text-sm">
                            {sync.started_at
                              ? new Date(sync.started_at).toLocaleString()
                              : '-'
                            }
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{sync.sync_type || 'Unknown'}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                sync.status === 'completed'
                                  ? 'bg-green-100 text-green-800'
                                  : sync.status === 'failed'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-yellow-100 text-yellow-800'
                              }
                            >
                              {sync.status || 'Unknown'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {sync.records_updated || 0} / {sync.records_fetched || 0}
                          </TableCell>
                          <TableCell>
                            {sync.started_at && sync.completed_at
                              ? `${Math.round((new Date(sync.completed_at).getTime() - new Date(sync.started_at).getTime()) / 1000)}s`
                              : '-'
                            }
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-red-500 text-sm">
                            {sync.error_message || '-'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* n8n Sync Tab */}
          <TabsContent value="n8n-sync" className="space-y-6">
            {/* n8n Webhook Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Webhook className="h-5 w-5" />
                  n8n Webhook Configuration
                </CardTitle>
                <p className="text-sm text-gray-500">
                  Enter your n8n webhook URL to trigger inventory syncs from this app
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* n8n Webhook URL Input */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">n8n Webhook URL (to trigger sync)</label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://your-n8n.com/webhook/xxxxx"
                      value={n8nWebhookUrl}
                      onChange={(e) => setN8nWebhookUrl(e.target.value)}
                      className="flex-1 font-mono text-sm"
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    Get this from n8n: Webhook node → Production URL (e.g., https://automator.pixelcraftedmedia.com/webhook/inventory-planner)
                  </p>
                </div>

                {/* App Public URL Input */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">App Public URL (for n8n to call back)</label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://your-app.vercel.app"
                      value={appPublicUrl}
                      onChange={(e) => setAppPublicUrl(e.target.value)}
                      className="flex-1 font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      onClick={saveN8nSettings}
                      disabled={savingSettings}
                    >
                      {savingSettings ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Your app&apos;s public URL that n8n can reach (e.g., https://inventory.yourdomain.com)
                  </p>
                </div>

                {/* Status Message */}
                {settingsMessage && (
                  <div className={`p-3 rounded-lg text-sm ${
                    settingsMessage.type === 'success'
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    {settingsMessage.text}
                  </div>
                )}

                {/* Trigger Sync Button */}
                <div className="pt-4 border-t">
                  <Button
                    onClick={triggerN8nSync}
                    disabled={triggeringSyncN8n || !n8nWebhookUrl}
                    className="w-full gap-2"
                    size="lg"
                  >
                    {triggeringSyncN8n ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Triggering Sync...
                      </>
                    ) : (
                      <>
                        <Play className="h-5 w-5" />
                        Trigger Inventory Sync
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    This will call your n8n webhook, which fetches data from Inventory Planner and sends it back here
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* App Endpoints for n8n */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  App Endpoints (for n8n to call back)
                </CardTitle>
                <p className="text-sm text-gray-500">
                  Configure these URLs in your n8n workflow to send data to this app
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Webhook URL */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Webhook URL (n8n sends data here)</label>
                  {!appPublicUrl && (
                    <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
                      Set your App Public URL above so n8n can reach this endpoint
                    </div>
                  )}
                  <div className="flex gap-2">
                    <code className={`flex-1 p-3 rounded-lg text-sm font-mono break-all ${
                      appPublicUrl ? 'bg-green-50 border border-green-200' : 'bg-gray-100'
                    }`}>
                      {callbackBaseUrl}/api/sync/webhook
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(`${callbackBaseUrl}/api/sync/webhook`, 'webhook')}
                      disabled={!appPublicUrl}
                    >
                      {copiedField === 'webhook' ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Required Headers */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Required Headers (in n8n HTTP Request)</label>
                  <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm font-mono">
                    <div className="flex justify-between items-center">
                      <span>Content-Type: application/json</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard('Content-Type: application/json', 'ct')}
                      >
                        {copiedField === 'ct' ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>x-webhook-secret: <span className="text-gray-400">[from .env.local]</span></span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard('x-webhook-secret', 'secret')}
                      >
                        {copiedField === 'secret' ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Setup Guide */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">How It Works</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold">
                      1
                    </div>
                    <div>
                      <p className="font-medium">You click &quot;Trigger Inventory Sync&quot;</p>
                      <p className="text-sm text-gray-500">
                        This app calls your n8n webhook URL
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold">
                      2
                    </div>
                    <div>
                      <p className="font-medium">n8n fetches from Inventory Planner</p>
                      <p className="text-sm text-gray-500">
                        Your n8n workflow calls the Inventory Planner API
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold">
                      3
                    </div>
                    <div>
                      <p className="font-medium">n8n sends data to this app</p>
                      <p className="text-sm text-gray-500">
                        n8n POSTs the data to our webhook URL above
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-green-100 text-green-700 rounded-full flex items-center justify-center font-bold">
                      4
                    </div>
                    <div>
                      <p className="font-medium">Data is processed and stored</p>
                      <p className="text-sm text-gray-500">
                        Watch progress below in real-time
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <span className="font-medium">n8n Workflow:</span> Your n8n should have a Webhook trigger,
                    HTTP Request to Inventory Planner, then HTTP Request to POST data back to this app&apos;s webhook URL.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Real-time Progress */}
            <SyncProgressPanel />

            {/* Sync History */}
            <SyncHistoryTable limit={10} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

// Helper Components
function OverviewCard({
  title,
  value,
  subtitle,
  icon,
  status,
}: {
  title: string
  value: string
  subtitle: string
  icon: React.ReactNode
  status: 'success' | 'warning' | 'error'
}) {
  const statusColors = {
    success: 'text-green-600 bg-green-50',
    warning: 'text-yellow-600 bg-yellow-50',
    error: 'text-red-600 bg-red-50',
  }

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-500">{title}</span>
          <div className={`p-2 rounded-lg ${statusColors[status]}`}>
            {icon}
          </div>
        </div>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </CardContent>
    </Card>
  )
}

function IssueRow({
  severity,
  title,
  description,
  action,
}: {
  severity: 'high' | 'medium' | 'low'
  title: string
  description: string
  action: string
}) {
  const severityStyles = {
    high: 'border-l-red-500 bg-red-50',
    medium: 'border-l-yellow-500 bg-yellow-50',
    low: 'border-l-blue-500 bg-blue-50',
  }

  return (
    <div className={`border-l-4 rounded-r-lg p-4 ${severityStyles[severity]}`}>
      <div className="flex items-start gap-3">
        <AlertTriangle className={`h-5 w-5 mt-0.5 ${
          severity === 'high' ? 'text-red-500' : severity === 'medium' ? 'text-yellow-500' : 'text-blue-500'
        }`} />
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-sm text-gray-600">{description}</p>
          <p className="text-xs text-gray-500 mt-1">
            <span className="font-medium">Action:</span> {action}
          </p>
        </div>
      </div>
    </div>
  )
}

function FieldBar({
  label,
  value,
  total,
}: {
  label: string
  value: number
  total: number
}) {
  const percentage = total > 0 ? (value / total) * 100 : 0
  const color = percentage > 80 ? 'bg-green-500' : percentage > 50 ? 'bg-yellow-500' : 'bg-red-500'

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="font-mono">{label}</span>
        <span>
          {formatNumber(value)} / {formatNumber(total)} ({percentage.toFixed(0)}%)
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${color}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
