import { z } from 'zod'

/**
 * Sync webhook payload from n8n
 */
export const syncWebhookSchema = z.object({
  event: z.enum(['sync_started', 'sync_completed', 'sync_failed']),
  sync_id: z.string().uuid().optional(),
  sync_type: z.enum(['full', 'incremental', 'manual']).default('full'),
  records_fetched: z.number().optional(),
  records_updated: z.number().optional(),
  duration_ms: z.number().optional(),
  error_message: z.string().optional(),
  timestamp: z.string().datetime().optional(),
})

export type SyncWebhookPayload = z.infer<typeof syncWebhookSchema>

/**
 * Sync trigger request
 */
export const syncTriggerSchema = z.object({
  type: z.enum(['full', 'incremental']).default('full'),
  force: z.boolean().default(false),
})

export type SyncTriggerRequest = z.infer<typeof syncTriggerSchema>

/**
 * Sync status response
 */
export const syncStatusSchema = z.object({
  id: z.string().uuid(),
  sync_type: z.string().nullable(),
  status: z.string().nullable(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  records_fetched: z.number().nullable(),
  records_updated: z.number().nullable(),
  duration_ms: z.number().nullable(),
  error_message: z.string().nullable(),
})

export type SyncStatus = z.infer<typeof syncStatusSchema>
