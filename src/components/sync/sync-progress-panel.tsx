'use client'

import { useSyncProgress } from '@/hooks/use-sync-progress'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  AlertTriangle
} from 'lucide-react'

interface SyncProgressPanelProps {
  compact?: boolean
  onComplete?: () => void
}

export function SyncProgressPanel({ compact = false, onComplete }: SyncProgressPanelProps) {
  const {
    status,
    recordsProcessed,
    totalRecords,
    percentage,
    errorsCount,
    currentBatch,
    totalBatches,
    timeRemaining,
    message,
    isActive,
    loading,
    refresh
  } = useSyncProgress()

  // Don't render if idle and compact mode
  if (status === 'idle' && compact) {
    return null
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'syncing':
      case 'processing':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return <Clock className="h-5 w-5 text-gray-400" />
    }
  }

  const getStatusBadge = () => {
    const variants: Record<string, string> = {
      idle: 'bg-gray-100 text-gray-700',
      syncing: 'bg-blue-100 text-blue-700',
      processing: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700'
    }

    return (
      <Badge className={variants[status] || variants.idle}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  if (loading) {
    return (
      <Card className={compact ? 'border-0 shadow-none' : ''}>
        <CardContent className={compact ? 'p-3' : 'p-6'}>
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading sync status...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
        {getStatusIcon()}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            {isActive && (
              <span className="text-sm font-medium text-blue-700">
                {percentage}%
              </span>
            )}
          </div>
          <p className="text-xs text-gray-600 truncate mt-0.5">{message}</p>
        </div>
        {isActive && timeRemaining && (
          <span className="text-xs text-gray-500 whitespace-nowrap">
            ~{timeRemaining}
          </span>
        )}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {getStatusIcon()}
            Sync Progress
          </CardTitle>
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            <Button
              variant="ghost"
              size="sm"
              onClick={refresh}
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Progress Bar */}
        {isActive && (
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">
                {recordsProcessed.toLocaleString()} of {totalRecords.toLocaleString()} records
              </span>
              <span className="font-medium">{percentage}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300 ease-out"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center p-2 bg-gray-50 rounded-lg">
            <div className="text-lg font-bold text-gray-900">
              {recordsProcessed.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">Processed</div>
          </div>
          <div className="text-center p-2 bg-gray-50 rounded-lg">
            <div className="text-lg font-bold text-gray-900">
              {currentBatch}/{totalBatches || '-'}
            </div>
            <div className="text-xs text-gray-500">Batch</div>
          </div>
          <div className="text-center p-2 bg-gray-50 rounded-lg">
            <div className={`text-lg font-bold ${errorsCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>
              {errorsCount}
            </div>
            <div className="text-xs text-gray-500">Errors</div>
          </div>
        </div>

        {/* Status Message */}
        <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
          <div className="flex-1">
            <p className="text-sm text-gray-700">{message}</p>
            {isActive && timeRemaining && (
              <p className="text-xs text-gray-500 mt-1">
                Estimated: ~{timeRemaining} remaining
              </p>
            )}
          </div>
        </div>

        {/* Error Warning */}
        {errorsCount > 0 && status !== 'failed' && (
          <div className="mt-3 flex items-center gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0" />
            <span className="text-sm text-yellow-700">
              {errorsCount} record{errorsCount !== 1 ? 's' : ''} had errors during sync
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
