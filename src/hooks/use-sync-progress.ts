'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import type { SyncProgress } from '@/types/database'

interface SyncProgressState {
  status: SyncProgress['status']
  sessionId: string | null
  recordsProcessed: number
  totalRecords: number
  percentage: number
  errorsCount: number
  currentBatch: number
  totalBatches: number
  currentChunk: number
  totalChunks: number
  currentSku: string | null
  startedAt: string | null
  estimatedCompletion: string | null
  timeRemaining: string | null
  message: string | null
  lastUpdate: string
  isActive: boolean
}

const DEFAULT_STATE: SyncProgressState = {
  status: 'idle',
  sessionId: null,
  recordsProcessed: 0,
  totalRecords: 0,
  percentage: 0,
  errorsCount: 0,
  currentBatch: 0,
  totalBatches: 0,
  currentChunk: 0,
  totalChunks: 0,
  currentSku: null,
  startedAt: null,
  estimatedCompletion: null,
  timeRemaining: null,
  message: 'Ready for sync',
  lastUpdate: new Date().toISOString(),
  isActive: false
}

function calculateTimeRemaining(estimatedCompletion: string | null): string | null {
  if (!estimatedCompletion) return null

  const remaining = new Date(estimatedCompletion).getTime() - Date.now()
  if (remaining <= 0) return null

  const minutes = Math.floor(remaining / 60000)
  const seconds = Math.floor((remaining % 60000) / 1000)

  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
}

function transformProgress(data: SyncProgress | null): SyncProgressState {
  if (!data) return DEFAULT_STATE

  const percentage = data.total_records && data.total_records > 0
    ? Math.round((data.records_processed / data.total_records) * 100)
    : 0

  return {
    status: data.status,
    sessionId: data.session_id,
    recordsProcessed: data.records_processed,
    totalRecords: data.total_records,
    percentage,
    errorsCount: data.errors_count,
    currentBatch: data.current_batch,
    totalBatches: data.total_batches,
    currentChunk: data.current_chunk,
    totalChunks: data.total_chunks,
    currentSku: data.current_sku,
    startedAt: data.started_at,
    estimatedCompletion: data.estimated_completion,
    timeRemaining: calculateTimeRemaining(data.estimated_completion),
    message: data.message,
    lastUpdate: data.last_update,
    isActive: data.status === 'syncing' || data.status === 'processing'
  }
}

export function useSyncProgress() {
  const [state, setState] = useState<SyncProgressState>(DEFAULT_STATE)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create Supabase client
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Fetch initial state
  const fetchProgress = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('sync_progress')
        .select('*')
        .eq('id', 'current')
        .single()

      if (fetchError) {
        // If table doesn't exist yet, just use defaults
        if (fetchError.code === 'PGRST116') {
          setState(DEFAULT_STATE)
          return
        }
        throw fetchError
      }

      setState(transformProgress(data))
    } catch (err) {
      console.error('Failed to fetch progress:', err)
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [supabase])

  // Subscribe to realtime updates
  useEffect(() => {
    fetchProgress()

    // Subscribe to changes
    const channel = supabase
      .channel('sync_progress_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sync_progress',
          filter: 'id=eq.current'
        },
        (payload) => {
          if (payload.new) {
            setState(transformProgress(payload.new as SyncProgress))
          }
        }
      )
      .subscribe()

    // Update time remaining periodically when active
    const interval = setInterval(() => {
      setState(prev => {
        if (!prev.isActive) return prev
        return {
          ...prev,
          timeRemaining: calculateTimeRemaining(prev.estimatedCompletion)
        }
      })
    }, 1000)

    return () => {
      channel.unsubscribe()
      clearInterval(interval)
    }
  }, [fetchProgress, supabase])

  // Refresh function
  const refresh = useCallback(() => {
    setLoading(true)
    fetchProgress()
  }, [fetchProgress])

  return {
    ...state,
    loading,
    error,
    refresh
  }
}
