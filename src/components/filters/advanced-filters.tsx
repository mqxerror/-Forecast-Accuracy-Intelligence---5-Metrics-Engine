'use client'

import { memo, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Filter, X, Download, Search } from 'lucide-react'
import { useFilterOptions, type InventoryFilters } from '@/hooks/use-inventory'

interface AdvancedFiltersProps {
  filters: InventoryFilters
  onFilterChange: (filters: Partial<InventoryFilters>) => void
  onExport?: () => void
  isExporting?: boolean
  totalCount: number
}

const STOCK_STATUS_OPTIONS = [
  { value: 'all', label: 'All Items' },
  { value: 'in_stock', label: 'In Stock' },
  { value: 'low_stock', label: 'Low Stock' },
  { value: 'out_of_stock', label: 'Out of Stock' },
]

export const AdvancedFilters = memo(function AdvancedFilters({
  filters,
  onFilterChange,
  onExport,
  isExporting,
  totalCount,
}: AdvancedFiltersProps) {
  const { brands, productTypes } = useFilterOptions()
  const [searchValue, setSearchValue] = useState(filters.search || '')
  const [isOpen, setIsOpen] = useState(false)

  const activeFilterCount = [
    filters.brand,
    filters.productType,
    filters.stockStatus && filters.stockStatus !== 'all',
    filters.minOOS !== undefined,
  ].filter(Boolean).length

  const handleSearchSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      onFilterChange({ search: searchValue })
    },
    [searchValue, onFilterChange]
  )

  const handleClearFilters = useCallback(() => {
    setSearchValue('')
    onFilterChange({
      search: undefined,
      brand: undefined,
      productType: undefined,
      stockStatus: 'all',
      minOOS: undefined,
    })
  }, [onFilterChange])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search by SKU or title..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="mr-2 h-4 w-4" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Filter Inventory</SheetTitle>
                <SheetDescription>
                  Narrow down your inventory view
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                {/* Brand Filter */}
                <div className="space-y-2">
                  <Label>Brand</Label>
                  <Select
                    value={filters.brand || 'all'}
                    onValueChange={(value) =>
                      onFilterChange({ brand: value === 'all' ? undefined : value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All brands" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All brands</SelectItem>
                      {brands.map((brand) => (
                        <SelectItem key={brand} value={brand}>
                          {brand}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Product Type Filter */}
                <div className="space-y-2">
                  <Label>Product Type</Label>
                  <Select
                    value={filters.productType || 'all'}
                    onValueChange={(value) =>
                      onFilterChange({ productType: value === 'all' ? undefined : value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      {productTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Stock Status Filter */}
                <div className="space-y-2">
                  <Label>Stock Status</Label>
                  <Select
                    value={filters.stockStatus || 'all'}
                    onValueChange={(value) =>
                      onFilterChange({
                        stockStatus: value as InventoryFilters['stockStatus'],
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All items" />
                    </SelectTrigger>
                    <SelectContent>
                      {STOCK_STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Clear Filters */}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleClearFilters}
                >
                  <X className="mr-2 h-4 w-4" />
                  Clear All Filters
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          {onExport && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
              disabled={isExporting}
            >
              <Download className="mr-2 h-4 w-4" />
              {isExporting ? 'Exporting...' : 'Export CSV'}
            </Button>
          )}
        </div>
      </div>

      {/* Active Filters Display */}
      {(filters.search || activeFilterCount > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-500">
            {totalCount.toLocaleString()} results
          </span>
          {filters.search && (
            <Badge variant="secondary" className="gap-1">
              Search: {filters.search}
              <button
                onClick={() => {
                  setSearchValue('')
                  onFilterChange({ search: undefined })
                }}
                className="ml-1 hover:text-red-500"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.brand && (
            <Badge variant="secondary" className="gap-1">
              Brand: {filters.brand}
              <button
                onClick={() => onFilterChange({ brand: undefined })}
                className="ml-1 hover:text-red-500"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.productType && (
            <Badge variant="secondary" className="gap-1">
              Type: {filters.productType}
              <button
                onClick={() => onFilterChange({ productType: undefined })}
                className="ml-1 hover:text-red-500"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.stockStatus && filters.stockStatus !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              Status: {STOCK_STATUS_OPTIONS.find((o) => o.value === filters.stockStatus)?.label}
              <button
                onClick={() => onFilterChange({ stockStatus: 'all' })}
                className="ml-1 hover:text-red-500"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  )
})
