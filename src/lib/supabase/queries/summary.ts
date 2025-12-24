import { createClient } from '../server'
import type { SyncMetric } from '@/types/database'

/**
 * Get latest business summary
 */
export async function getBusinessSummary() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('business_summary')
    .select('*')
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    // Might not exist yet, return defaults
    return {
      summary: {
        id: null,
        snapshot_date: new Date().toISOString().split('T')[0],
        total_skus: 0,
        total_in_stock: 0,
        total_value: 0,
        items_needing_reorder: 0,
        items_overstocked: 0,
        items_out_of_stock: 0,
        avg_forecast_accuracy: null,
        total_lost_revenue: 0,
        top_priority_items: [],
        created_at: new Date().toISOString(),
      },
      error: null,
    }
  }

  return { summary: data, error: null }
}

/**
 * Get summary history for trend charts
 */
export async function getSummaryHistory(days = 30) {
  const supabase = await createClient()

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const { data, error } = await supabase
    .from('business_summary')
    .select('snapshot_date, total_skus, items_out_of_stock, items_needing_reorder, avg_forecast_accuracy')
    .gte('snapshot_date', startDate.toISOString().split('T')[0])
    .order('snapshot_date', { ascending: true })

  if (error) {
    return { history: [], error: error.message }
  }

  return { history: data || [], error: null }
}

/**
 * Get latest sync status
 */
export async function getLatestSyncStatus() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('sync_metrics')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    return {
      sync: {
        id: null,
        status: 'unknown',
        started_at: null,
        completed_at: null,
        records_fetched: 0,
        records_updated: 0,
        duration_ms: 0,
        error_message: null,
      },
      error: null,
    }
  }

  return { sync: data, error: null }
}

/**
 * Get sync history
 */
export async function getSyncHistory(limit = 10) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('sync_metrics')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit)

  if (error) {
    return { syncs: [], error: error.message }
  }

  return { syncs: data || [], error: null }
}

/**
 * Create a new sync record (for tracking)
 */
export async function createSyncRecord(syncType: string): Promise<{ sync: SyncMetric | null; error: string | null }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('sync_metrics')
    .insert({
      sync_type: syncType,
      started_at: new Date().toISOString(),
      status: 'running',
    })
    .select()
    .single()

  if (error) {
    return { sync: null, error: error.message }
  }

  return { sync: data, error: null }
}

/**
 * Update sync record on completion
 */
export async function completeSyncRecord(
  syncId: string,
  status: 'completed' | 'failed',
  recordsFetched: number,
  recordsUpdated: number,
  errorMessage?: string
) {
  const supabase = await createClient()

  const { data: currentSync } = await supabase
    .from('sync_metrics')
    .select('started_at')
    .eq('id', syncId)
    .single()

  const startTime = currentSync?.started_at
    ? new Date(currentSync.started_at).getTime()
    : Date.now()
  const durationMs = Date.now() - startTime

  const { error } = await supabase
    .from('sync_metrics')
    .update({
      status,
      completed_at: new Date().toISOString(),
      records_fetched: recordsFetched,
      records_updated: recordsUpdated,
      duration_ms: durationMs,
      error_message: errorMessage || null,
    })
    .eq('id', syncId)

  if (error) {
    return { error: error.message }
  }

  return { error: null }
}
