'use client'

import { memo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/empty-state'
import { formatCurrency } from '@/lib/utils/format-currency'
import { formatNumber } from '@/lib/utils/format-number'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface PriorityItem {
  id: string
  sku: string
  title: string | null
  brand: string | null
  in_stock: number
  replenishment: number
  to_order: number
  lead_time: number | null
  oos: number
  forecasted_lost_revenue: number | null
}

interface PriorityTableProps {
  items: PriorityItem[]
  type: 'reorder' | 'oos'
}

// Memoized priority badge component
const PriorityBadge = memo(function PriorityBadge({ value }: { value: number }) {
  if (value > 100) {
    return <Badge variant="destructive">Critical</Badge>
  }
  if (value > 50) {
    return (
      <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
        High
      </Badge>
    )
  }
  return (
    <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
      Medium
    </Badge>
  )
})

// Memoized table row to prevent re-renders
const MemoizedTableRow = memo(function MemoizedTableRow({
  item,
  type,
}: {
  item: PriorityItem
  type: 'reorder' | 'oos'
}) {
  return (
    <TableRow className="hover:bg-gray-50 transition-colors">
      <TableCell className="font-mono text-sm">{item.sku}</TableCell>
      <TableCell>
        <div className="max-w-[200px] truncate">{item.title || '-'}</div>
        {item.brand && <div className="text-xs text-gray-500">{item.brand}</div>}
      </TableCell>
      <TableCell className="text-right">
        {item.in_stock < 0 ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded cursor-help">
                  {formatNumber(item.in_stock)}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Backorder or oversold quantity</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          formatNumber(item.in_stock)
        )}
      </TableCell>
      {type === 'reorder' ? (
        <>
          <TableCell className="text-right font-medium">
            {formatNumber(item.to_order || item.replenishment)}
          </TableCell>
          <TableCell className="text-right">
            {item.lead_time ? `${item.lead_time}d` : '-'}
          </TableCell>
        </>
      ) : (
        <>
          <TableCell className="text-right font-medium">{item.oos} days</TableCell>
          <TableCell className="text-right">
            {item.forecasted_lost_revenue && item.forecasted_lost_revenue > 0 ? (
              <span className="text-red-600">{formatCurrency(item.forecasted_lost_revenue)}</span>
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-gray-400 cursor-help">$0</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs max-w-[200px]">
                      Lost revenue not calculated. May be a new item or missing sales history.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </TableCell>
        </>
      )}
      <TableCell>
        <PriorityBadge value={type === 'reorder' ? item.replenishment : item.oos} />
      </TableCell>
    </TableRow>
  )
})

export const PriorityTable = memo(function PriorityTable({ items, type }: PriorityTableProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        type="no-data"
        title={type === 'reorder' ? 'No Reorder Needed' : 'All Items In Stock'}
        description={
          type === 'reorder'
            ? 'Great news! All items are above their reorder points.'
            : 'No products are currently out of stock.'
        }
        className="py-6"
      />
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>SKU</TableHead>
          <TableHead>Product</TableHead>
          <TableHead className="text-right">In Stock</TableHead>
          {type === 'reorder' ? (
            <>
              <TableHead className="text-right">To Order</TableHead>
              <TableHead className="text-right">Lead Time</TableHead>
            </>
          ) : (
            <>
              <TableHead className="text-right">Days OOS</TableHead>
              <TableHead className="text-right">Lost Revenue</TableHead>
            </>
          )}
          <TableHead>Priority</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <MemoizedTableRow key={item.id} item={item} type={type} />
        ))}
      </TableBody>
    </Table>
  )
})
