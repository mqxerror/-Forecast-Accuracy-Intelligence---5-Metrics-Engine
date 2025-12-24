'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ChevronDown,
  ChevronUp,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle
} from 'lucide-react'

interface SyncHistoryItem {
  id: string
  type: 'session' | 'metric'
  source: string | null
  status: string | null
  recordsFetched: number | null
  recordsUpdated: number | null
  recordsFailed?: number | null
  startedAt: string | null
  completedAt: string | null
  errorMessage: string | null
  chunksReceived?: number
  totalChunks?: number
  durationMs?: number
}

interface SyncHistoryTableProps {
  limit?: number
  showTitle?: boolean
}

export function SyncHistoryTable({ limit = 10, showTitle = true }: SyncHistoryTableProps) {
  const [history, setHistory] = useState<SyncHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  useEffect(() => {
    fetchHistory()
  }, [limit])

  async function fetchHistory() {
    try {
      setLoading(true)
      const res = await fetch(`/api/sync/history?limit=${limit}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setHistory(data.history || [])
    } catch (error) {
      console.error('Failed to fetch sync history:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string | null) => {
    const config: Record<string, { class: string; icon: React.ElementType }> = {
      completed: { class: 'bg-green-100 text-green-700', icon: CheckCircle },
      failed: { class: 'bg-red-100 text-red-700', icon: XCircle },
      in_progress: { class: 'bg-blue-100 text-blue-700', icon: Clock },
      pending: { class: 'bg-gray-100 text-gray-700', icon: Clock },
      paused: { class: 'bg-yellow-100 text-yellow-700', icon: AlertTriangle }
    }

    const statusKey = status?.toLowerCase() || 'pending'
    const { class: className, icon: Icon } = config[statusKey] || config.pending

    return (
      <Badge className={className}>
        <Icon className="h-3 w-3 mr-1" />
        {status || 'Unknown'}
      </Badge>
    )
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDuration = (startedAt: string | null, completedAt: string | null, durationMs?: number) => {
    if (durationMs) {
      return `${(durationMs / 1000).toFixed(1)}s`
    }
    if (!startedAt || !completedAt) return '-'
    const duration = new Date(completedAt).getTime() - new Date(startedAt).getTime()
    return `${(duration / 1000).toFixed(1)}s`
  }

  const content = (
    <>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No sync history yet
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Records</TableHead>
              <TableHead className="text-right">Duration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.map((item) => (
              <>
                <TableRow
                  key={item.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedRow(expandedRow === item.id ? null : item.id)}
                >
                  <TableCell>
                    {expandedRow === item.id ? (
                      <ChevronUp className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(item.startedAt)}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(item.status)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    <span className="text-green-600">{item.recordsUpdated || 0}</span>
                    {item.recordsFailed && item.recordsFailed > 0 && (
                      <span className="text-red-600 ml-1">
                        / {item.recordsFailed} err
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm text-gray-500">
                    {formatDuration(item.startedAt, item.completedAt, item.durationMs)}
                  </TableCell>
                </TableRow>
                {expandedRow === item.id && (
                  <TableRow key={`${item.id}-details`}>
                    <TableCell colSpan={5} className="bg-gray-50">
                      <div className="p-3 space-y-2 text-sm">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-gray-500">Type:</span>{' '}
                            <span className="font-medium">{item.type}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Source:</span>{' '}
                            <span className="font-medium">{item.source || 'Unknown'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Records Fetched:</span>{' '}
                            <span className="font-medium">{item.recordsFetched || 0}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Records Updated:</span>{' '}
                            <span className="font-medium text-green-600">{item.recordsUpdated || 0}</span>
                          </div>
                          {item.chunksReceived !== undefined && (
                            <div>
                              <span className="text-gray-500">Chunks:</span>{' '}
                              <span className="font-medium">
                                {item.chunksReceived}/{item.totalChunks || '?'}
                              </span>
                            </div>
                          )}
                        </div>
                        {item.errorMessage && (
                          <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 mt-2">
                            {item.errorMessage}
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  )

  if (!showTitle) {
    return content
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Sync History</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchHistory}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {content}
      </CardContent>
    </Card>
  )
}
