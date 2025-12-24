'use client'

import { useState, useEffect } from 'react'
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
import { Header } from '@/components/layout/header'
import { TableSkeleton } from '@/components/shared/loading-skeleton'
import { formatCurrency } from '@/lib/utils/format-currency'
import { formatNumber } from '@/lib/utils/format-number'
import { Search, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react'
import type { Variant } from '@/types/database'

interface InventoryResponse {
  variants: Variant[]
  count: number
  limit: number
  offset: number
  hasMore: boolean
}

type SortField = 'sku' | 'in_stock' | 'replenishment' | 'oos' | 'last_30_days_sales'
type SortDirection = 'asc' | 'desc'

export default function InventoryPage() {
  const [data, setData] = useState<InventoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState<SortField>('replenishment')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const pageSize = 25

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
    async function fetchData() {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          limit: String(pageSize),
          offset: String(page * pageSize),
          orderBy: sortField,
          orderDirection: sortDirection,
        })
        if (debouncedSearch) {
          params.append('search', debouncedSearch)
        }

        const response = await fetch(`/api/inventory?${params}`)
        const json = await response.json()
        setData(json)
      } catch (error) {
        console.error('Failed to fetch inventory:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [page, debouncedSearch, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
    setPage(0)
  }

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
        <ArrowUpDown className="h-3 w-3 text-gray-400" />
      </div>
    </TableHead>
  )

  const getStockStatus = (variant: Variant) => {
    if (variant.oos > 0) {
      return <Badge variant="destructive">OOS {variant.oos}d</Badge>
    }
    if (variant.replenishment > 0) {
      return (
        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
          Reorder
        </Badge>
      )
    }
    return (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
        In Stock
      </Badge>
    )
  }

  const totalPages = data ? Math.ceil(data.count / pageSize) : 0

  return (
    <div className="flex flex-col">
      <Header
        title="Inventory"
        subtitle={data ? `${formatNumber(data.count)} products` : 'Loading...'}
        showSyncButton={false}
      />

      <div className="p-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>All Products</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search SKU or product..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading && !data ? (
              <TableSkeleton rows={10} />
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortHeader field="sku">SKU</SortHeader>
                        <TableHead>Product</TableHead>
                        <SortHeader field="in_stock">In Stock</SortHeader>
                        <SortHeader field="last_30_days_sales">
                          30d Sales
                        </SortHeader>
                        <SortHeader field="replenishment">Reorder Qty</SortHeader>
                        <SortHeader field="oos">Status</SortHeader>
                        <TableHead className="text-right">Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.variants.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="py-8 text-center text-gray-500">
                            No products found
                          </TableCell>
                        </TableRow>
                      ) : (
                        data?.variants.map((variant) => (
                          <TableRow key={variant.id}>
                            <TableCell className="font-mono text-sm">
                              {variant.sku}
                            </TableCell>
                            <TableCell>
                              <div className="max-w-[200px] truncate">
                                {variant.title || '-'}
                              </div>
                              {variant.brand && (
                                <div className="text-xs text-gray-500">
                                  {variant.brand}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>{formatNumber(variant.in_stock)}</TableCell>
                            <TableCell>
                              {formatNumber(variant.last_30_days_sales)}
                            </TableCell>
                            <TableCell>
                              {variant.replenishment > 0
                                ? formatNumber(variant.replenishment)
                                : '-'}
                            </TableCell>
                            <TableCell>{getStockStatus(variant)}</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(
                                (variant.in_stock || 0) * (variant.cost_price || 0)
                              )}
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
                      Showing {page * pageSize + 1}-
                      {Math.min((page + 1) * pageSize, data?.count || 0)} of{' '}
                      {formatNumber(data?.count || 0)}
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
                        disabled={!data?.hasMore}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
