import { createAdminClient } from '@/lib/supabase/admin'
import { v4 as uuidv4 } from 'uuid'
import type { SyncSession, SyncSessionInsert, SyncChunk, SyncChunkInsert } from '@/types/database'

/**
 * SyncSessionManager - Manages sync sessions for chunked uploads
 *
 * A session groups multiple chunk uploads together and tracks overall progress.
 * Enables resume capability if a sync fails partway through.
 */
export class SyncSessionManager {
  private supabase = createAdminClient()

  /**
   * Create a new sync session
   */
  async createSession(options: {
    totalChunks?: number
    totalRecords?: number
    source?: string
    metadata?: Record<string, unknown>
  } = {}): Promise<{ session: SyncSession; token: string }> {
    const token = uuidv4()

    const sessionData: SyncSessionInsert = {
      session_token: token,
      source: options.source || 'n8n',
      total_expected_chunks: options.totalChunks,
      total_expected_records: options.totalRecords,
      status: 'pending',
      metadata: options.metadata || {}
    }

    const { data, error } = await this.supabase
      .from('sync_sessions')
      .insert(sessionData)
      .select()
      .single()

    if (error || !data) {
      throw new Error(`Failed to create session: ${error?.message || 'Unknown error'}`)
    }

    return { session: data, token }
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<SyncSession | null> {
    const { data } = await this.supabase
      .from('sync_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    return data
  }

  /**
   * Get session by token
   */
  async getSessionByToken(token: string): Promise<SyncSession | null> {
    const { data } = await this.supabase
      .from('sync_sessions')
      .select('*')
      .eq('session_token', token)
      .single()

    return data
  }

  /**
   * Start a session (mark as in_progress)
   */
  async startSession(sessionId: string): Promise<void> {
    await this.supabase
      .from('sync_sessions')
      .update({
        status: 'in_progress',
        started_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString()
      })
      .eq('id', sessionId)
  }

  /**
   * Update session progress
   */
  async updateSession(
    sessionId: string,
    updates: {
      chunksReceived?: number
      recordsProcessed?: number
      recordsFailed?: number
      recordsSkipped?: number
    }
  ): Promise<void> {
    const updateData: Partial<SyncSession> = {
      last_activity_at: new Date().toISOString()
    }

    if (updates.chunksReceived !== undefined) {
      updateData.chunks_received = updates.chunksReceived
    }
    if (updates.recordsProcessed !== undefined) {
      updateData.records_processed = updates.recordsProcessed
    }
    if (updates.recordsFailed !== undefined) {
      updateData.records_failed = updates.recordsFailed
    }
    if (updates.recordsSkipped !== undefined) {
      updateData.records_skipped = updates.recordsSkipped
    }

    await this.supabase
      .from('sync_sessions')
      .update(updateData)
      .eq('id', sessionId)
  }

  /**
   * Complete a session
   */
  async completeSession(
    sessionId: string,
    stats: {
      recordsProcessed: number
      recordsFailed: number
      recordsSkipped?: number
    }
  ): Promise<void> {
    await this.supabase
      .from('sync_sessions')
      .update({
        status: 'completed',
        records_processed: stats.recordsProcessed,
        records_failed: stats.recordsFailed,
        records_skipped: stats.recordsSkipped || 0,
        completed_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString()
      })
      .eq('id', sessionId)
  }

  /**
   * Fail a session
   */
  async failSession(sessionId: string, errorMessage: string): Promise<void> {
    await this.supabase
      .from('sync_sessions')
      .update({
        status: 'failed',
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString()
      })
      .eq('id', sessionId)
  }

  /**
   * Pause a session
   */
  async pauseSession(sessionId: string): Promise<void> {
    await this.supabase
      .from('sync_sessions')
      .update({
        status: 'paused',
        last_activity_at: new Date().toISOString()
      })
      .eq('id', sessionId)
  }

  /**
   * Cancel a session
   */
  async cancelSession(sessionId: string): Promise<void> {
    await this.supabase
      .from('sync_sessions')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString()
      })
      .eq('id', sessionId)
  }

  // ==================== CHUNK MANAGEMENT ====================

  /**
   * Create or update a chunk record
   */
  async upsertChunk(
    sessionId: string,
    chunkIndex: number,
    recordCount: number
  ): Promise<SyncChunk> {
    const chunkData: SyncChunkInsert = {
      session_id: sessionId,
      chunk_index: chunkIndex,
      records_in_chunk: recordCount,
      status: 'processing',
      started_at: new Date().toISOString()
    }

    const { data, error } = await this.supabase
      .from('sync_chunks')
      .upsert(chunkData, { onConflict: 'session_id,chunk_index' })
      .select()
      .single()

    if (error || !data) {
      throw new Error(`Failed to create chunk: ${error?.message || 'Unknown error'}`)
    }

    return data
  }

  /**
   * Complete a chunk
   */
  async completeChunk(
    sessionId: string,
    chunkIndex: number,
    stats: {
      recordsProcessed: number
      recordsFailed: number
      processingTimeMs: number
    }
  ): Promise<void> {
    await this.supabase
      .from('sync_chunks')
      .update({
        status: 'completed',
        records_processed: stats.recordsProcessed,
        records_failed: stats.recordsFailed,
        processing_time_ms: stats.processingTimeMs,
        completed_at: new Date().toISOString()
      })
      .eq('session_id', sessionId)
      .eq('chunk_index', chunkIndex)
  }

  /**
   * Fail a chunk
   */
  async failChunk(
    sessionId: string,
    chunkIndex: number,
    errorMessage: string
  ): Promise<void> {
    await this.supabase
      .from('sync_chunks')
      .update({
        status: 'failed',
        error_message: errorMessage,
        completed_at: new Date().toISOString()
      })
      .eq('session_id', sessionId)
      .eq('chunk_index', chunkIndex)
  }

  /**
   * Get chunks for a session
   */
  async getSessionChunks(sessionId: string): Promise<SyncChunk[]> {
    const { data } = await this.supabase
      .from('sync_chunks')
      .select('*')
      .eq('session_id', sessionId)
      .order('chunk_index', { ascending: true })

    return data || []
  }

  /**
   * Get missing/failed chunks for resume
   */
  async getMissingChunks(sessionId: string): Promise<number[]> {
    const session = await this.getSession(sessionId)
    if (!session || !session.total_expected_chunks) {
      return []
    }

    const chunks = await this.getSessionChunks(sessionId)
    const completedIndexes = new Set(
      chunks
        .filter(c => c.status === 'completed')
        .map(c => c.chunk_index)
    )

    const missing: number[] = []
    for (let i = 0; i < session.total_expected_chunks; i++) {
      if (!completedIndexes.has(i)) {
        missing.push(i)
      }
    }

    return missing
  }

  // ==================== HISTORY & QUERIES ====================

  /**
   * List recent sessions
   */
  async listSessions(options: {
    limit?: number
    offset?: number
    status?: string
  } = {}): Promise<{ sessions: SyncSession[]; total: number }> {
    let query = this.supabase
      .from('sync_sessions')
      .select('*', { count: 'exact' })
      .order('started_at', { ascending: false })

    if (options.status) {
      query = query.eq('status', options.status)
    }

    if (options.limit) {
      query = query.limit(options.limit)
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 20) - 1)
    }

    const { data, count } = await query

    return {
      sessions: data || [],
      total: count || 0
    }
  }

  /**
   * Get session with chunks
   */
  async getSessionWithChunks(sessionId: string): Promise<{
    session: SyncSession | null
    chunks: SyncChunk[]
  }> {
    const [session, chunks] = await Promise.all([
      this.getSession(sessionId),
      this.getSessionChunks(sessionId)
    ])

    return { session, chunks }
  }

  /**
   * Clean up old sessions (older than X days)
   */
  async cleanupOldSessions(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    const { count } = await this.supabase
      .from('sync_sessions')
      .delete()
      .lt('started_at', cutoffDate.toISOString())
      .in('status', ['completed', 'failed', 'cancelled'])

    return count || 0
  }
}

// Export singleton instance
export const sessionManager = new SyncSessionManager()
