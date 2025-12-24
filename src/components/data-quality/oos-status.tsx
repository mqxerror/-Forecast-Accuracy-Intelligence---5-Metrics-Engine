'use client'

import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { AlertTriangle, Package, TrendingDown, Calendar } from 'lucide-react'

interface OOSStatusProps {
  inStock: number
  oosDays?: number | null
  oosLast60Days?: number | null
  showDetails?: boolean
}

/**
 * Out of Stock Status Component
 *
 * Displays stock status with clear definitions:
 * - in_stock <= 0: Currently OOS (zero or negative inventory)
 * - in_stock < 0: Oversold (backorders exist)
 * - oos: Days item has been OOS (from Inventory Planner)
 * - oos_last_60_days: OOS days in last 60 days
 */
export function OOSStatus({
  inStock,
  oosDays,
  oosLast60Days,
  showDetails = true
}: OOSStatusProps) {
  const currentStatus = inStock < 0 ? 'oversold'
    : inStock === 0 ? 'oos'
    : 'in_stock'

  const statusConfig = {
    oversold: {
      label: 'Oversold',
      variant: 'destructive' as const,
      icon: TrendingDown,
      tooltip: 'Negative inventory - backorders exist',
      bgColor: 'bg-red-50 border-red-200'
    },
    oos: {
      label: 'Out of Stock',
      variant: 'destructive' as const,
      icon: AlertTriangle,
      tooltip: 'Currently zero inventory',
      bgColor: 'bg-red-50 border-red-200'
    },
    in_stock: {
      label: 'In Stock',
      variant: 'outline' as const,
      icon: Package,
      tooltip: 'Inventory available',
      bgColor: 'bg-green-50 border-green-200'
    }
  }

  const config = statusConfig[currentStatus]
  const Icon = config.icon

  return (
    <TooltipProvider>
      <div className="space-y-1">
        {/* Current Status */}
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant={config.variant} className="cursor-help">
                <Icon className="h-3 w-3 mr-1" />
                {config.label}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>{config.tooltip}</p>
            </TooltipContent>
          </Tooltip>
          <span className="text-sm text-gray-600">
            {inStock} units
          </span>
        </div>

        {/* Historical OOS Info */}
        {showDetails && oosDays != null && oosDays > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="text-xs text-gray-500 flex items-center gap-1 cursor-help">
                <Calendar className="h-3 w-3" />
                <span>
                  {oosDays} total OOS days
                  {oosLast60Days != null && ` (${oosLast60Days} in last 60d)`}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">Historical OOS Days</p>
              <p className="text-xs text-gray-400">
                Total days this item has been out of stock, tracked by Inventory Planner.
                This is different from current stock status.
              </p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  )
}

interface StockStatusBadgeProps {
  inStock: number
  replenishment?: number
  size?: 'sm' | 'default'
}

/**
 * Simple stock status badge for table displays
 */
export function StockStatusBadge({ inStock, replenishment, size = 'default' }: StockStatusBadgeProps) {
  const sizeClass = size === 'sm' ? 'text-xs px-1.5 py-0' : ''

  if (inStock < 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="destructive" className={`cursor-help ${sizeClass}`}>
              Oversold
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Negative inventory ({inStock} units)</p>
            <p className="text-xs text-gray-400">Backorders or fulfillment issues</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  if (inStock === 0) {
    return (
      <Badge variant="destructive" className={sizeClass}>
        OOS
      </Badge>
    )
  }

  if (replenishment != null && replenishment > 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge className={`bg-yellow-100 text-yellow-800 cursor-help ${sizeClass}`}>
              Reorder
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Below optimal stock level</p>
            <p className="text-xs text-gray-400">Order {replenishment} units</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <Badge className={`bg-green-100 text-green-800 ${sizeClass}`}>
      In Stock
    </Badge>
  )
}

/**
 * OOS definitions reference component
 * Use in admin/help pages to explain the different OOS metrics
 */
export function OOSDefinitions() {
  const definitions = [
    {
      term: 'Currently OOS',
      field: 'in_stock <= 0',
      description: 'Items with zero or negative current inventory. This is what users typically expect "Out of Stock" to mean.',
      color: 'bg-red-100 text-red-800'
    },
    {
      term: 'Oversold',
      field: 'in_stock < 0',
      description: 'Items with negative stock - backorders exist. More orders than available inventory.',
      color: 'bg-red-100 text-red-800'
    },
    {
      term: 'OOS Days (Total)',
      field: 'oos',
      description: 'Total days this item has been out of stock historically, as tracked by Inventory Planner. NOT the same as current status.',
      color: 'bg-orange-100 text-orange-800'
    },
    {
      term: 'OOS Days (60d)',
      field: 'oos_last_60_days',
      description: 'Days out of stock in the last 60 days only.',
      color: 'bg-yellow-100 text-yellow-800'
    },
    {
      term: 'Needs Reorder',
      field: 'replenishment > 0',
      description: 'Items below optimal stock level. The replenishment field indicates how many units to order.',
      color: 'bg-yellow-100 text-yellow-800'
    }
  ]

  return (
    <div className="space-y-3">
      <h4 className="font-medium">Stock Status Definitions</h4>
      <div className="space-y-2">
        {definitions.map((def) => (
          <div key={def.term} className="p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Badge className={def.color}>{def.term}</Badge>
              <code className="text-xs bg-gray-200 px-1.5 py-0.5 rounded">{def.field}</code>
            </div>
            <p className="text-sm text-gray-600">{def.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
