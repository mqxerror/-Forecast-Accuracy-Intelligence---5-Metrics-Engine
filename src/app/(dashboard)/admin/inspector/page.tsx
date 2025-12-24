'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Header } from '@/components/layout/header'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Database,
  Cloud,
  ArrowLeftRight,
  Copy,
  ExternalLink,
} from 'lucide-react'
import Link from 'next/link'

interface DatabaseVariant {
  id: string
  sku: string
  title: string | null
  cost_price: number | null
  price: number | null
  in_stock: number
  replenishment: number
  orders_by_month: Record<string, unknown> | null
  forecast_by_period: Record<string, unknown> | null
  raw_data: Record<string, unknown> | null
  synced_at: string
}

interface IPVariant {
  [key: string]: unknown
}

interface ComparisonResult {
  field: string
  database: unknown
  inventoryPlanner: unknown
  match: boolean
  severity: 'ok' | 'warning' | 'error'
}

export default function InspectorPage() {
  const [searchSku, setSearchSku] = useState('')
  const [loading, setLoading] = useState(false)
  const [dbVariant, setDbVariant] = useState<DatabaseVariant | null>(null)
  const [ipVariant, setIpVariant] = useState<IPVariant | null>(null)
  const [comparison, setComparison] = useState<ComparisonResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [apiConfigured, setApiConfigured] = useState(true)

  async function searchVariant() {
    if (!searchSku.trim()) return

    setLoading(true)
    setError(null)
    setDbVariant(null)
    setIpVariant(null)
    setComparison([])

    try {
      // Fetch from both sources in parallel
      const [dbRes, ipRes] = await Promise.all([
        fetch(`/api/admin/variants-debug?sku=${encodeURIComponent(searchSku)}`),
        fetch(`/api/admin/fetch-ip-variant?sku=${encodeURIComponent(searchSku)}`),
      ])

      const dbData = await dbRes.json()
      const ipData = await ipRes.json()

      // Check if API is configured
      if (ipData.configured === false) {
        setApiConfigured(false)
      }

      // Set database variant
      if (dbData.variants?.length > 0) {
        setDbVariant(dbData.variants[0])
      }

      // Set Inventory Planner variant
      if (ipData.variant) {
        setIpVariant(ipData.variant)
      }

      // Generate comparison if we have both
      if (dbData.variants?.[0] && ipData.variant) {
        const comp = generateComparison(dbData.variants[0], ipData.variant)
        setComparison(comp)
      }

      if (!dbData.variants?.length && !ipData.variant) {
        setError(`SKU "${searchSku}" not found in database or Inventory Planner`)
      }
    } catch (err) {
      console.error('Search error:', err)
      setError('Failed to fetch data. Check console for details.')
    } finally {
      setLoading(false)
    }
  }

  function generateComparison(db: DatabaseVariant, ip: IPVariant): ComparisonResult[] {
    const keyFields = [
      { field: 'sku', dbKey: 'sku', ipKey: 'sku' },
      { field: 'title', dbKey: 'title', ipKey: 'title' },
      { field: 'cost_price', dbKey: 'cost_price', ipKey: 'cost_price', altIpKeys: ['cost', 'unit_cost', 'average_cost'] },
      { field: 'price', dbKey: 'price', ipKey: 'price' },
      { field: 'in_stock', dbKey: 'in_stock', ipKey: 'in_stock' },
      { field: 'replenishment', dbKey: 'replenishment', ipKey: 'replenishment' },
      { field: 'lead_time', dbKey: 'lead_time', ipKey: 'lead_time' },
      { field: 'last_7_days_sales', dbKey: 'last_7_days_sales', ipKey: 'last_7_days_sales' },
      { field: 'last_30_days_sales', dbKey: 'last_30_days_sales', ipKey: 'last_30_days_sales' },
      { field: 'oos', dbKey: 'oos', ipKey: 'oos' },
      { field: 'forecast_by_period', dbKey: 'forecast_by_period', ipKey: 'forecast_by_period' },
      { field: 'orders_by_month', dbKey: 'orders_by_month', ipKey: 'orders_by_month' },
    ]

    return keyFields.map(({ field, dbKey, ipKey, altIpKeys }) => {
      const dbValue = (db as Record<string, unknown>)[dbKey]
      let ipValue = ip[ipKey]

      // Check alternative keys for IP
      if (ipValue === undefined && altIpKeys) {
        for (const altKey of altIpKeys) {
          if (ip[altKey] !== undefined) {
            ipValue = ip[altKey]
            break
          }
        }
      }

      // Determine match
      let match = false
      if (typeof dbValue === 'object' && typeof ipValue === 'object') {
        match = JSON.stringify(dbValue) === JSON.stringify(ipValue)
      } else if (typeof dbValue === 'number' && typeof ipValue === 'number') {
        match = Math.abs(dbValue - ipValue) < 0.01
      } else {
        match = dbValue === ipValue
      }

      // Determine severity
      let severity: 'ok' | 'warning' | 'error' = 'ok'
      if (!match) {
        if (field === 'cost_price' || field === 'in_stock' || field === 'forecast_by_period') {
          severity = 'error'
        } else {
          severity = 'warning'
        }
      }

      return {
        field,
        database: dbValue,
        inventoryPlanner: ipValue,
        match,
        severity,
      }
    })
  }

  function formatValue(value: unknown): string {
    if (value === null || value === undefined) return 'null'
    if (typeof value === 'object') {
      const str = JSON.stringify(value)
      return str.length > 50 ? str.substring(0, 50) + '...' : str
    }
    if (typeof value === 'number') return value.toFixed(2)
    return String(value)
  }

  const mismatchCount = comparison.filter(c => !c.match).length
  const errorCount = comparison.filter(c => c.severity === 'error').length

  return (
    <div className="flex flex-col">
      <Header
        title="SKU Inspector"
        subtitle="Compare database data with live Inventory Planner API"
        showSyncButton={false}
      />

      <div className="p-6 space-y-6">
        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Input
                placeholder="Enter SKU to inspect..."
                value={searchSku}
                onChange={(e) => setSearchSku(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchVariant()}
                className="max-w-md font-mono"
              />
              <Button onClick={searchVariant} disabled={loading}>
                {loading ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Compare
              </Button>
              <Link href="/admin">
                <Button variant="outline">
                  Back to Admin
                </Button>
              </Link>
            </div>

            {!apiConfigured && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-800">Inventory Planner API Not Configured</p>
                    <p className="text-sm text-yellow-700 mt-1">
                      Add <code className="bg-yellow-100 px-1 rounded">IP_API_KEY</code> and{' '}
                      <code className="bg-yellow-100 px-1 rounded">IP_ACCOUNT_ID</code> to your{' '}
                      <code className="bg-yellow-100 px-1 rounded">.env.local</code> file to enable live API comparison.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700">{error}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        {(dbVariant || ipVariant) && (
          <>
            {/* Summary */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card className={dbVariant ? 'border-green-200' : 'border-red-200'}>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Database className="h-5 w-5 text-blue-500" />
                    <span className="font-medium">Database</span>
                    {dbVariant ? (
                      <CheckCircle className="h-4 w-4 text-green-500 ml-auto" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500 ml-auto" />
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    {dbVariant ? `Found: ${dbVariant.sku}` : 'Not found in database'}
                  </p>
                  {dbVariant && (
                    <p className="text-xs text-gray-400 mt-1">
                      Synced: {new Date(dbVariant.synced_at).toLocaleString()}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className={ipVariant ? 'border-green-200' : 'border-yellow-200'}>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Cloud className="h-5 w-5 text-purple-500" />
                    <span className="font-medium">Inventory Planner</span>
                    {ipVariant ? (
                      <CheckCircle className="h-4 w-4 text-green-500 ml-auto" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-yellow-500 ml-auto" />
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    {ipVariant
                      ? `Found: ${ipVariant.sku}`
                      : apiConfigured
                        ? 'Not found in IP'
                        : 'API not configured'
                    }
                  </p>
                </CardContent>
              </Card>

              <Card className={mismatchCount === 0 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowLeftRight className="h-5 w-5 text-gray-500" />
                    <span className="font-medium">Comparison</span>
                  </div>
                  {comparison.length > 0 ? (
                    <>
                      <p className={`text-2xl font-bold ${mismatchCount === 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {mismatchCount} mismatches
                      </p>
                      {errorCount > 0 && (
                        <p className="text-xs text-red-500">{errorCount} critical fields differ</p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">Need both sources to compare</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Comparison Table */}
            {comparison.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ArrowLeftRight className="h-5 w-5" />
                    Field-by-Field Comparison
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Field</TableHead>
                        <TableHead>Database</TableHead>
                        <TableHead></TableHead>
                        <TableHead>Inventory Planner</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comparison.map((row) => (
                        <TableRow
                          key={row.field}
                          className={!row.match ? (row.severity === 'error' ? 'bg-red-50' : 'bg-yellow-50') : ''}
                        >
                          <TableCell className="font-mono text-sm">{row.field}</TableCell>
                          <TableCell className="font-mono text-sm max-w-[200px] truncate">
                            {formatValue(row.database)}
                          </TableCell>
                          <TableCell className="text-center">
                            <ArrowRight className={`h-4 w-4 ${row.match ? 'text-green-500' : 'text-red-500'}`} />
                          </TableCell>
                          <TableCell className="font-mono text-sm max-w-[200px] truncate">
                            {formatValue(row.inventoryPlanner)}
                          </TableCell>
                          <TableCell>
                            {row.match ? (
                              <Badge className="bg-green-100 text-green-800">Match</Badge>
                            ) : row.severity === 'error' ? (
                              <Badge variant="destructive">Mismatch</Badge>
                            ) : (
                              <Badge className="bg-yellow-100 text-yellow-800">Differs</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Raw Data Side by Side */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Database Raw */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Database Record
                    {dbVariant && (
                      <Link href={`/inventory/${encodeURIComponent(dbVariant.sku)}`}>
                        <Button variant="ghost" size="sm" className="ml-auto">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </Link>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {dbVariant ? (
                    <pre className="text-xs bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto max-h-[500px]">
                      {JSON.stringify(dbVariant, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-gray-500 text-center py-8">Not found in database</p>
                  )}
                </CardContent>
              </Card>

              {/* Inventory Planner Raw */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Cloud className="h-4 w-4" />
                    Inventory Planner Live Data
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {ipVariant ? (
                    <pre className="text-xs bg-gray-900 text-blue-400 p-4 rounded-lg overflow-auto max-h-[500px]">
                      {JSON.stringify(ipVariant, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-gray-500 text-center py-8">
                      {apiConfigured ? 'Not found in Inventory Planner' : 'API not configured'}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Field Discovery - Show all IP fields */}
            {ipVariant && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    All Inventory Planner Fields ({Object.keys(ipVariant).length} fields)
                  </CardTitle>
                  <p className="text-sm text-gray-500">
                    Use this to identify correct field names for mapping
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                    {Object.entries(ipVariant)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([key, value]) => (
                        <div
                          key={key}
                          className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
                        >
                          <code className="text-blue-600">{key}</code>
                          <span className="text-gray-500 text-xs truncate max-w-[100px]">
                            {typeof value === 'object' ? 'Object' : String(value).substring(0, 20)}
                          </span>
                        </div>
                      ))
                    }
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  )
}
