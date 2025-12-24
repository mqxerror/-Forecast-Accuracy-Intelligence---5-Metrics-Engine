'use client'

import { memo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, ExternalLink, Download, Eye, EyeOff } from 'lucide-react'
import { exportToCsv } from '@/lib/utils/export-csv'
import { toast } from 'sonner'

interface RowActionsProps {
  item: {
    id: string
    sku: string
    title: string | null
    brand: string | null
    product_type?: string | null
    in_stock: number
    replenishment: number
    to_order: number
    oos: number
    price?: number | null
    cost_price?: number | null
    forecasted_lost_revenue: number | null
  }
  isWatched?: boolean
  onWatchToggle?: (sku: string, watched: boolean) => void
}

export const RowActions = memo(function RowActions({
  item,
  isWatched = false,
  onWatchToggle,
}: RowActionsProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const handleViewDetails = () => {
    router.push(`/inventory/${encodeURIComponent(item.sku)}`)
    setOpen(false)
  }

  const handleExport = () => {
    exportToCsv({
      data: [item],
      filename: `sku-${item.sku}`,
      columns: [
        { key: 'sku', header: 'SKU' },
        { key: 'title', header: 'Title' },
        { key: 'brand', header: 'Brand' },
        { key: 'product_type', header: 'Product Type' },
        { key: 'in_stock', header: 'In Stock' },
        { key: 'replenishment', header: 'Replenishment' },
        { key: 'to_order', header: 'To Order' },
        { key: 'oos', header: 'Days OOS' },
        { key: 'price', header: 'Price', format: (v) => v ?? '' },
        { key: 'cost_price', header: 'Cost', format: (v) => v ?? '' },
        { key: 'forecasted_lost_revenue', header: 'Lost Revenue', format: (v) => v ?? '' },
      ],
    })
    toast.success(`Exported ${item.sku} to CSV`)
    setOpen(false)
  }

  const handleWatchToggle = () => {
    onWatchToggle?.(item.sku, !isWatched)
    toast.success(isWatched ? `Removed ${item.sku} from watch list` : `Added ${item.sku} to watch list`)
    setOpen(false)
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={handleViewDetails}>
          <ExternalLink className="mr-2 h-4 w-4" />
          View Details
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Export to CSV
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleWatchToggle}>
          {isWatched ? (
            <>
              <EyeOff className="mr-2 h-4 w-4" />
              Remove from Watch List
            </>
          ) : (
            <>
              <Eye className="mr-2 h-4 w-4" />
              Add to Watch List
            </>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
})
