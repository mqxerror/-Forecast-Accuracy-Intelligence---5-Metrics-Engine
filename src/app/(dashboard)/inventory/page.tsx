'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { AdvancedFilters } from '@/components/filters/advanced-filters'
import { RowActions } from '@/components/inventory/row-actions'
import { formatCurrency } from '@/lib/utils/format-currency'
import { formatNumber } from '@/lib/utils/format-number'
import { exportInventoryToCsv } from '@/lib/utils/export-csv'
import { ChevronLeft, ChevronRight, ArrowUpDown, Eye } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useInventory, type InventoryFilters } from '@/hooks/use-inventory'
import { useWatchList } from '@/hooks/use-watch-list'
import { SalesSparkline } from '@/components/charts/sales-sparkline'

type SortField = 'sku' | 'in_stock' | 'replenishment' | 'oos' | 'last_30_days_sales'

export default function InventoryPage() {
  const router = useRouter()
  const [isExporting, setIsExporting] = useState(false)
  const { isWatched, toggleWatch, watchCount } = useWatchList()

  const {
    items,
    totalCount,
    isLoading,
    filters,
    page,
    totalPages,
    updateFilters,
    goToPage,
  } = useInventory()

  const handleRowClick = (sku: string) => {
    router.push(`/inventory/${encodeURIComponent(sku)}`)
  }

  const handleFilterChange = useCallback((newFilters: Partial<InventoryFilters>) => {
    updateFilters(newFilters)
  }, [updateFilters])

  const handleExport = useCallback(async () => {
    setIsExporting(true)
    try {
      // Fetch all items for export (up to 10000)
      const params = new URLSearchParams({ limit: '10000', offset: '0' })
      if (filters.search) params.set('search', filters.search)
      if (filters.brand) params.set('brand', filters.brand)
      if (filters.productType) params.set('productType', filters.productType)

      const response = await fetch(`/api/inventory?${params}`)
      const data = await response.json()
      exportInventoryToCsv(data.variants)
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setIsExporting(false)
    }
  }, [filters])

  const SortHeader = ({
    field,
    children,
  }: {
    field: SortField
    children: React.ReactNode
  }) => (
    <TableHead className="cursor-pointer hover:bg-gray-50">
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className="h-3 w-3 text-gray-400" />
      </div>
    </TableHead>
  )

  const getStockStatus = (item: typeof items[0]) => {
    // Critical: Negative inventory (oversold)
    if (item.in_stock < 0) {
      return (
        <Badge variant="destructive" className="bg-red-600 text-white animate-pulse">
          Oversold
        </Badge>
      )
    }
    if (item.oos > 0) {
      return <Badge variant="destructive">OOS {item.oos}d</Badge>
    }
    if (item.replenishment > 0) {
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

  return (
    <div className="flex flex-col">
      <Header
        title="Inventory"
        subtitle={
          watchCount > 0
            ? `${formatNumber(totalCount)} products | ${watchCount} watched`
            : `${formatNumber(totalCount)} products`
        }
        showSyncButton={false}
      />

      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="mb-4">All Products</CardTitle>
            <AdvancedFilters
              filters={filters}
              onFilterChange={handleFilterChange}
              onExport={handleExport}
              isExporting={isExporting}
              totalCount={totalCount}
            />
          </CardHeader>
          <CardContent>
            {isLoading && items.length === 0 ? (
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
                        <SortHeader field="replenishment">Reorder Qty</SortHeader>
                        <SortHeader field="oos">Status</SortHeader>
                        <TableHead>Trend</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="py-8 text-center text-gray-500">
                            No products found
                          </TableCell>
                        </TableRow>
                      ) : (
                        items.map((item) => (
                          <TableRow
                            key={item.id}
                            className={`cursor-pointer transition-colors group ${
                              item.in_stock < 0
                                ? 'bg-red-50 hover:bg-red-100 border-l-4 border-l-red-500'
                                : 'hover:bg-blue-50'
                            }`}
                            onClick={() => handleRowClick(item.sku)}
                          >
                            <TableCell className="font-mono text-sm">
                              <div className="flex items-center gap-1">
                                {isWatched(item.sku) && (
                                  <Eye className="h-3 w-3 text-blue-500" />
                                )}
                                {item.sku}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="max-w-[200px] truncate">
                                {item.title || '-'}
                              </div>
                              {item.brand && (
                                <div className="text-xs text-gray-500">
                                  {item.brand}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              {item.in_stock < 0 ? (
                                <span className="font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">
                                  {formatNumber(item.in_stock)}
                                </span>
                              ) : item.in_stock === 0 ? (
                                <span className="text-gray-400">0</span>
                              ) : (
                                formatNumber(item.in_stock)
                              )}
                            </TableCell>
                            <TableCell>
                              {item.replenishment > 0
                                ? formatNumber(item.replenishment)
                                : '-'}
                            </TableCell>
                            <TableCell>{getStockStatus(item)}</TableCell>
                            <TableCell>
                              <SalesSparkline
                                last7Days={item.last_7_days_sales || 0}
                                last30Days={item.last_30_days_sales || 0}
                                last90Days={item.last_90_days_sales || 0}
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(
                                (item.in_stock || 0) * (item.cost_price || 0)
                              )}
                            </TableCell>
                            <TableCell>
                              <RowActions
                                item={item}
                                isWatched={isWatched(item.sku)}
                                onWatchToggle={toggleWatch}
                              />
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
                      Page {page} of {totalPages} ({formatNumber(totalCount)} total)
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToPage(page - 1)}
                        disabled={page <= 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="flex items-center px-2 text-sm">
                        Page {page} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToPage(page + 1)}
                        disabled={page >= totalPages}
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
