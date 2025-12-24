import { createAdminClient } from '@/lib/supabase/admin'
import type { SyncProgressUpdate } from '@/types/database'

/**
 * SyncProgressTracker - Manages real-time progress updates for sync operations
 *
 * Updates the sync_progress table which clients subscribe to via Supabase Realtime.
 * Uses a single-row pattern (id='current') for efficient updates.
 */
export class SyncProgressTracker {
  private supabase = createAdminClient()
  private sessionId: string | null
  private totalRecords: number
  private startTime: number
  private lastUpdateTime: number = 0
  private updateThrottleMs: number = 500 // Throttle updates to reduce DB writes

  constructor(sessionId: string | null, totalRecords: number) {
    this.sessionId = sessionId
    this.totalRecords = totalRecords
    this.startTime = Date.now()
  }

  /**
   * Initialize progress tracking - call at start of sync
   */
  async start(message: string = 'Starting sync...'): Promise<void> {
    const update: SyncProgressUpdate = {
      session_id: this.sessionId,
      status: 'syncing',
      current_batch: 0,
      total_batches: Math.ceil(this.totalRecords / 500),
      current_chunk: 0,
      total_chunks: 1,
      records_processed: 0,
      total_records: this.totalRecords,
      errors_count: 0,
      current_sku: null,
      started_at: new Date().toISOString(),
      estimated_completion: null,
      last_update: new Date().toISOString(),
      message
    }

    await this.supabase
      .from('sync_progress')
      .update(update)
      .eq('id', 'current')
  }

  /**
   * Update progress during sync
   */
  async updateProgress(
    recordsProcessed: number,
    options: {
      currentBatch?: number
      currentChunk?: number
      totalChunks?: number
      errorsCount?: number
      currentSku?: string
      message?: string
    } = {}
  ): Promise<void> {
    // Throttle updates to reduce database writes
    const now = Date.now()
    if (now - this.lastUpdateTime < this.updateThrottleMs) {
      return
    }
    this.lastUpdateTime = now

    // Calculate ETA
    const elapsed = now - this.startTime
    const rate = recordsProcessed / (elapsed / 1000) // records per second
    const remaining = this.totalRecords - recordsProcessed
    const etaMs = rate > 0 ? (remaining / rate) * 1000 : null
    const estimatedCompletion = etaMs ? new Date(now + etaMs).toISOString() : null

    const update: SyncProgressUpdate = {
      status: 'processing',
      current_batch: options.currentBatch,
      current_chunk: options.currentChunk,
      total_chunks: options.totalChunks,
      records_processed: recordsProcessed,
      errors_count: options.errorsCount,
      current_sku: options.currentSku,
      estimated_completion: estimatedCompletion,
      last_update: new Date().toISOString(),
      message: options.message || `Processing ${recordsProcessed} of ${this.totalRecords} records...`
    }

    await this.supabase
      .from('sync_progress')
      .update(update)
      .eq('id', 'current')
  }

  /**
   * Mark sync as complete
   */
  async complete(
    recordsProcessed: number,
    errorsCount: number = 0,
    message?: string
  ): Promise<void> {
    const duration = Date.now() - this.startTime
    const finalMessage = message ||
      `Sync complete: ${recordsProcessed} records processed${errorsCount > 0 ? `, ${errorsCount} errors` : ''} in ${(duration / 1000).toFixed(1)}s`

    const update: SyncProgressUpdate = {
      status: 'completed',
      records_processed: recordsProcessed,
      errors_count: errorsCount,
      current_sku: null,
      estimated_completion: null,
      last_update: new Date().toISOString(),
      message: finalMessage
    }

    await this.supabase
      .from('sync_progress')
      .update(update)
      .eq('id', 'current')

    // Reset to idle after a delay (so UI can show completion)
    setTimeout(() => this.reset(), 5000)
  }

  /**
   * Mark sync as failed
   */
  async fail(error: string): Promise<void> {
    const update: SyncProgressUpdate = {
      status: 'failed',
      current_sku: null,
      estimated_completion: null,
      last_update: new Date().toISOString(),
      message: `Sync failed: ${error}`
    }

    await this.supabase
      .from('sync_progress')
      .update(update)
      .eq('id', 'current')
  }

  /**
   * Reset progress to idle state
   */
  async reset(): Promise<void> {
    await this.supabase.rpc('reset_sync_progress')
  }

  /**
   * Update total records (useful when actual count differs from expected)
   */
  setTotalRecords(total: number): void {
    this.totalRecords = total
  }

  /**
   * Static method to get current progress
   */
  static async getCurrent(): Promise<SyncProgressUpdate | null> {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('sync_progress')
      .select('*')
      .eq('id', 'current')
      .single()

    return data
  }

  /**
   * Static method to check if a sync is in progress
   */
  static async isActive(): Promise<boolean> {
    const progress = await SyncProgressTracker.getCurrent()
    return progress?.status === 'syncing' || progress?.status === 'processing'
  }
}

/**
 * Helper function for simple progress tracking without class instantiation
 */
export async function updateSyncProgress(
  sessionId: string | null,
  recordsProcessed: number,
  totalRecords: number,
  message?: string
): Promise<void> {
  const supabase = createAdminClient()

  await supabase
    .from('sync_progress')
    .update({
      session_id: sessionId,
      status: 'processing',
      records_processed: recordsProcessed,
      total_records: totalRecords,
      last_update: new Date().toISOString(),
      message: message || `Processing ${recordsProcessed} of ${totalRecords}...`
    })
    .eq('id', 'current')
}
