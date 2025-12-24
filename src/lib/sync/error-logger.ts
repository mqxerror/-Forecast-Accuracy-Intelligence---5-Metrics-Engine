import { createAdminClient } from '@/lib/supabase/admin'
import type { SyncErrorInsert } from '@/types/database'
import type { ZodError } from 'zod'

/**
 * SyncErrorLogger - Logs per-record errors during sync operations
 *
 * Buffers errors and batch inserts them for performance.
 * Provides methods for different error types (validation, transform, database).
 */
export class SyncErrorLogger {
  private supabase = createAdminClient()
  private sessionId: string | null
  private buffer: SyncErrorInsert[] = []
  private bufferSize: number = 100 // Batch insert every 100 errors
  private chunkIndex: number | null = null

  constructor(sessionId: string | null, chunkIndex: number | null = null) {
    this.sessionId = sessionId
    this.chunkIndex = chunkIndex
  }

  /**
   * Log a validation error from Zod
   */
  async logValidationError(
    record: Record<string, unknown>,
    zodError: ZodError,
    recordIndex?: number
  ): Promise<void> {
    const sku = record.sku ? String(record.sku) : null
    const variantId = record.id ? String(record.id) : null

    // Create an error entry for each validation issue
    for (const issue of zodError.issues) {
      const error: SyncErrorInsert = {
        session_id: this.sessionId,
        chunk_index: this.chunkIndex,
        record_index: recordIndex,
        sku,
        variant_id: variantId,
        error_type: 'validation',
        error_code: issue.code,
        error_message: issue.message,
        field_name: issue.path.join('.'),
        raw_value: this.truncateValue(this.getNestedValue(record, issue.path)),
        raw_record: this.shouldStoreRawRecord(record) ? record : null
      }

      this.buffer.push(error)
    }

    if (this.buffer.length >= this.bufferSize) {
      await this.flush()
    }
  }

  /**
   * Log a validation error with simple message
   */
  async logValidationErrorSimple(
    record: Record<string, unknown>,
    message: string,
    fieldName?: string,
    recordIndex?: number
  ): Promise<void> {
    const error: SyncErrorInsert = {
      session_id: this.sessionId,
      chunk_index: this.chunkIndex,
      record_index: recordIndex,
      sku: record.sku ? String(record.sku) : null,
      variant_id: record.id ? String(record.id) : null,
      error_type: 'validation',
      error_code: 'custom_validation',
      error_message: message,
      field_name: fieldName,
      raw_value: fieldName ? this.truncateValue(record[fieldName]) : null
    }

    this.buffer.push(error)

    if (this.buffer.length >= this.bufferSize) {
      await this.flush()
    }
  }

  /**
   * Log a transform error (data transformation failed)
   */
  async logTransformError(
    record: Record<string, unknown>,
    error: Error,
    fieldName?: string,
    recordIndex?: number
  ): Promise<void> {
    const errorEntry: SyncErrorInsert = {
      session_id: this.sessionId,
      chunk_index: this.chunkIndex,
      record_index: recordIndex,
      sku: record.sku ? String(record.sku) : null,
      variant_id: record.id ? String(record.id) : null,
      error_type: 'transform',
      error_code: 'transform_failed',
      error_message: error.message,
      field_name: fieldName,
      raw_value: fieldName ? this.truncateValue(record[fieldName]) : null,
      raw_record: this.shouldStoreRawRecord(record) ? record : null
    }

    this.buffer.push(errorEntry)

    if (this.buffer.length >= this.bufferSize) {
      await this.flush()
    }
  }

  /**
   * Log a database error (insert/update failed)
   */
  async logDatabaseError(
    records: Record<string, unknown>[],
    error: { message: string; code?: string; details?: string },
    recordIndex?: number
  ): Promise<void> {
    // For batch errors, log against the first record with details
    const record = records[0] || {}

    const errorEntry: SyncErrorInsert = {
      session_id: this.sessionId,
      chunk_index: this.chunkIndex,
      record_index: recordIndex,
      sku: record.sku ? String(record.sku) : null,
      variant_id: record.id ? String(record.id) : null,
      error_type: 'database',
      error_code: error.code || 'db_error',
      error_message: `${error.message}${error.details ? ` - ${error.details}` : ''}`,
      field_name: null,
      raw_value: null,
      raw_record: records.length <= 3 ? { batch_size: records.length, skus: records.map(r => r.sku) } : null
    }

    this.buffer.push(errorEntry)

    if (this.buffer.length >= this.bufferSize) {
      await this.flush()
    }
  }

  /**
   * Log a generic error
   */
  async logError(
    sku: string | null,
    variantId: string | null,
    errorType: 'validation' | 'transform' | 'database' | 'unknown',
    message: string,
    options: {
      fieldName?: string
      rawValue?: unknown
      recordIndex?: number
    } = {}
  ): Promise<void> {
    const error: SyncErrorInsert = {
      session_id: this.sessionId,
      chunk_index: this.chunkIndex,
      record_index: options.recordIndex,
      sku,
      variant_id: variantId,
      error_type: errorType,
      error_code: `${errorType}_error`,
      error_message: message,
      field_name: options.fieldName,
      raw_value: options.rawValue ? this.truncateValue(options.rawValue) : null
    }

    this.buffer.push(error)

    if (this.buffer.length >= this.bufferSize) {
      await this.flush()
    }
  }

  /**
   * Flush buffered errors to database
   */
  async flush(): Promise<number> {
    if (this.buffer.length === 0) {
      return 0
    }

    const toInsert = [...this.buffer]
    this.buffer = []

    const { error } = await this.supabase
      .from('sync_errors')
      .insert(toInsert)

    if (error) {
      console.error('Failed to log sync errors:', error)
      // Don't throw - error logging should not break the sync
    }

    return toInsert.length
  }

  /**
   * Get error count in buffer (not yet flushed)
   */
  getBufferCount(): number {
    return this.buffer.length
  }

  /**
   * Set chunk index for subsequent errors
   */
  setChunkIndex(index: number): void {
    this.chunkIndex = index
  }

  // Helper: Get nested value from object using path array
  private getNestedValue(obj: Record<string, unknown>, path: (string | number)[]): unknown {
    let current: unknown = obj
    for (const key of path) {
      if (current == null || typeof current !== 'object') return undefined
      current = (current as Record<string, unknown>)[key]
    }
    return current
  }

  // Helper: Truncate value for storage
  private truncateValue(value: unknown): string | null {
    if (value === undefined || value === null) return null
    const str = typeof value === 'string' ? value : JSON.stringify(value)
    return str.length > 500 ? str.slice(0, 500) + '...' : str
  }

  // Helper: Decide if we should store the raw record (for debugging)
  private shouldStoreRawRecord(record: Record<string, unknown>): boolean {
    // Only store small records to save space
    const str = JSON.stringify(record)
    return str.length < 10000
  }

  /**
   * Static: Get errors for a session
   */
  static async getSessionErrors(
    sessionId: string,
    options: { limit?: number; offset?: number; errorType?: string } = {}
  ): Promise<{ errors: SyncErrorInsert[]; total: number }> {
    const supabase = createAdminClient()

    let query = supabase
      .from('sync_errors')
      .select('*', { count: 'exact' })
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })

    if (options.errorType) {
      query = query.eq('error_type', options.errorType)
    }

    if (options.limit) {
      query = query.limit(options.limit)
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1)
    }

    const { data, count } = await query

    return {
      errors: data || [],
      total: count || 0
    }
  }

  /**
   * Static: Get error summary for a session
   */
  static async getErrorSummary(sessionId: string): Promise<Record<string, number>> {
    const supabase = createAdminClient()

    const { data } = await supabase
      .from('sync_errors')
      .select('error_type')
      .eq('session_id', sessionId)

    const summary: Record<string, number> = {}
    for (const row of data || []) {
      const type = row.error_type || 'unknown'
      summary[type] = (summary[type] || 0) + 1
    }

    return summary
  }
}
