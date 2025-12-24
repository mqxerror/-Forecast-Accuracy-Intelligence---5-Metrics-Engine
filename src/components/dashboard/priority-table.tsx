'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils/format-currency'
import { formatNumber } from '@/lib/utils/format-number'

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

export function PriorityTable({ items, type }: PriorityTableProps) {
  if (items.length === 0) {
    return (
      <div className="py-8 text-center text-gray-500">
        No {type === 'reorder' ? 'items needing reorder' : 'out of stock items'}
      </div>
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
          <TableRow key={item.id}>
            <TableCell className="font-mono text-sm">{item.sku}</TableCell>
            <TableCell>
              <div className="max-w-[200px] truncate">
                {item.title || '-'}
              </div>
              {item.brand && (
                <div className="text-xs text-gray-500">{item.brand}</div>
              )}
            </TableCell>
            <TableCell className="text-right">
              {formatNumber(item.in_stock)}
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
                <TableCell className="text-right font-medium">
                  {item.oos}
                </TableCell>
                <TableCell className="text-right text-red-600">
                  {formatCurrency(item.forecasted_lost_revenue)}
                </TableCell>
              </>
            )}
            <TableCell>
              <PriorityBadge
                value={type === 'reorder' ? item.replenishment : item.oos}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function PriorityBadge({ value }: { value: number }) {
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
}
