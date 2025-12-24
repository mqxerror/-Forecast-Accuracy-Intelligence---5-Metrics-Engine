'use client'

import { memo, useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatPercentage } from '@/lib/utils/format-number'
import { Search, ArrowUpDown, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface SkuMetric {
  id: string
  sku: string
  mape: number | null
  wape: number | null
  rmse: number | null
  wase: number | null
  bias: number | null
  calculated_at: string
}

type SortField = 'sku' | 'mape' | 'wape' | 'rmse' | 'bias'
type SortDirection = 'asc' | 'desc'

export const SkuMetricsBrowser = memo(function SkuMetricsBrowser() {
  const router = useRouter()
  const [metrics, setMetrics] = useState<SkuMetric[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [sortField, setSortField] = useState<SortField>('mape')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [accuracyFilter, setAccuracyFilter] = useState<string>('all')

  const pageSize = 20

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(0)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // Fetch data
  useEffect(() => {
    async function fetchMetrics() {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          view: 'list',
          limit: String(pageSize),
          offset: String(page * pageSize),
          orderBy: sortField,
          orderDirection: sortDirection,
        })
        if (debouncedSearch) {
          params.append('search', debouncedSearch)
        }

        const response = await fetch(`/api/forecasts?${params}`)
        const json = await response.json()
        setMetrics(json.metrics || [])
        setTotalCount(json.count || 0)
      } catch (error) {
        console.error('Failed to fetch metrics:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchMetrics()
  }, [page, debouncedSearch, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection(field === 'sku' ? 'asc' : 'desc')
    }
    setPage(0)
  }

  const handleRowClick = (sku: string) => {
    router.push(`/inventory/${encodeURIComponent(sku)}`)
  }

  const getAccuracyBadge = (mape: number | null) => {
    if (mape === null) return <Badge variant="outline">N/A</Badge>
    if (mape < 10) return <Badge className="bg-green-100 text-green-800">Excellent</Badge>
    if (mape < 20) return <Badge className="bg-blue-100 text-blue-800">Good</Badge>
    if (mape < 30) return <Badge className="bg-yellow-100 text-yellow-800">Acceptable</Badge>
    if (mape < 50) return <Badge className="bg-orange-100 text-orange-800">Poor</Badge>
    return <Badge variant="destructive">Very Poor</Badge>
  }

  const getBiasIndicator = (bias: number | null) => {
    if (bias === null) return '-'
    if (Math.abs(bias) < 5) return <span className="text-green-600">Balanced</span>
    if (bias > 0) return <span className="text-yellow-600">+{bias.toFixed(1)}%</span>
    return <span className="text-red-600">{bias.toFixed(1)}%</span>
  }

  const filteredMetrics = accuracyFilter === 'all'
    ? metrics
    : metrics.filter((m) => {
        if (m.mape === null) return false
        switch (accuracyFilter) {
          case 'excellent': return m.mape < 10
          case 'good': return m.mape >= 10 && m.mape < 20
          case 'acceptable': return m.mape >= 20 && m.mape < 30
          case 'poor': return m.mape >= 30
          default: return true
        }
      })

  const totalPages = Math.ceil(totalCount / pageSize)

  const SortHeader = ({
    field,
    children,
  }: {
    field: SortField
    children: React.ReactNode
  }) => (
    <TableHead
      className="cursor-pointer hover:bg-gray-50"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className={`h-3 w-3 ${sortField === field ? 'text-blue-500' : 'text-gray-400'}`} />
      </div>
    </TableHead>
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-lg">SKU-Level Metrics</CardTitle>
          <div className="flex gap-2">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={accuracyFilter} onValueChange={setAccuracyFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter accuracy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Accuracy</SelectItem>
                <SelectItem value="excellent">Excellent (&lt;10%)</SelectItem>
                <SelectItem value="good">Good (10-20%)</SelectItem>
                <SelectItem value="acceptable">Acceptable (20-30%)</SelectItem>
                <SelectItem value="poor">Poor (&gt;30%)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader field="sku">SKU</SortHeader>
                <SortHeader field="mape">MAPE</SortHeader>
                <SortHeader field="wape">WAPE</SortHeader>
                <SortHeader field="rmse">RMSE</SortHeader>
                <SortHeader field="bias">Bias</SortHeader>
                <TableHead>Rating</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}>
                      <div className="h-8 animate-pulse rounded bg-gray-100" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredMetrics.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-gray-500">
                    No metrics found
                  </TableCell>
                </TableRow>
              ) : (
                filteredMetrics.map((metric) => (
                  <TableRow
                    key={metric.id}
                    className="cursor-pointer hover:bg-blue-50 transition-colors"
                    onClick={() => handleRowClick(metric.sku)}
                  >
                    <TableCell className="font-mono text-sm">
                      {metric.sku}
                    </TableCell>
                    <TableCell>
                      {metric.mape !== null ? formatPercentage(metric.mape, 1) : '-'}
                    </TableCell>
                    <TableCell>
                      {metric.wape !== null ? formatPercentage(metric.wape, 1) : '-'}
                    </TableCell>
                    <TableCell>
                      {metric.rmse !== null ? metric.rmse.toFixed(1) : '-'}
                    </TableCell>
                    <TableCell>
                      {getBiasIndicator(metric.bias)}
                    </TableCell>
                    <TableCell>
                      {getAccuracyBadge(metric.mape)}
                    </TableCell>
                    <TableCell>
                      <ExternalLink className="h-4 w-4 text-gray-400" />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, totalCount)} of {totalCount}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="flex items-center px-2 text-sm">
                Page {page + 1} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
})
