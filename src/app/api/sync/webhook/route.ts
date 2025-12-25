import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { completeSyncRecord, createSyncRecord } from '@/lib/supabase/queries/summary'
import {
  calculateMAPE,
  calculateWAPE,
  calculateRMSE,
  calculateBias,
  calculateSmoothedMAPE,
  getDataTier,
  selectPrimaryMetric,
  type ForecastSource
} from '@/lib/utils/calculate-metrics'
import { validateVariants, getErrorSummary, getWarningSummary } from '@/lib/validation/variant-schema'
import { detectFieldMappings, getCostValue, getLostRevenueValue } from '@/lib/utils/field-detection'
import { SyncProgressTracker, SyncErrorLogger, sessionManager } from '@/lib/sync'
import type { Database } from '@/types/database'

type VariantInsert = Database['public']['Tables']['variants']['Insert']
type MetricInsert = Database['public']['Tables']['forecast_metrics']['Insert']
type Variant = Database['public']['Tables']['variants']['Row']

// Extended metric insert with new fields
interface ExtendedMetricInsert extends MetricInsert {
  forecast_source?: ForecastSource
  data_tier?: string
  period_count?: number
  zero_periods?: number
  primary_metric?: string
}

// Increase timeout for large imports
export const maxDuration = 300 // 5 minutes

/**
 * POST /api/sync/webhook - Receive data and updates from n8n
 *
 * Supports two modes:
 * 1. Single-shot: Send all data at once (backward compatible)
 * 2. Chunked: Send data in chunks with session management
 *
 * Headers for chunked mode:
 * - x-sync-session-id: Session ID to add chunk to
 * - x-chunk-index: Chunk number (0-based)
 * - x-total-chunks: Total number of chunks expected
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Verify webhook secret
    const secret = request.headers.get('x-webhook-secret')
    if (secret !== process.env.N8N_WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: 'Invalid webhook secret' },
        { status: 401 }
      )
    }

    const body = await request.json()

    // Check for chunked mode headers
    const sessionId = request.headers.get('x-sync-session-id')
    const chunkIndexHeader = request.headers.get('x-chunk-index')
    const totalChunksHeader = request.headers.get('x-total-chunks')

    // Chunked mode: process as part of a session
    if (sessionId && chunkIndexHeader !== null) {
      const chunkIndex = parseInt(chunkIndexHeader, 10)
      const totalChunks = totalChunksHeader ? parseInt(totalChunksHeader, 10) : undefined
      return await handleChunkedImport(body, sessionId, chunkIndex, totalChunks, startTime)
    }

    // Single-shot mode (backward compatible)
    const event = body.event || 'import_variants'
    console.log(`Webhook received: ${event}`)

    switch (event) {
      case 'import_variants':
        return await handleVariantImport(body, startTime)

      case 'sync_started':
        console.log(`Sync started: ${body.sync_id}`)
        return NextResponse.json({ success: true })

      case 'sync_completed':
        if (body.sync_id) {
          await completeSyncRecord(
            body.sync_id,
            'completed',
            body.records_fetched || 0,
            body.records_updated || 0
          )
        }
        return NextResponse.json({ success: true })

      case 'sync_failed':
        if (body.sync_id) {
          await completeSyncRecord(
            body.sync_id,
            'failed',
            body.records_fetched || 0,
            body.records_updated || 0,
            body.error_message
          )
        }
        return NextResponse.json({ success: true })

      default:
        return NextResponse.json(
          { error: `Unknown event type: ${event}` },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Webhook error:', error)
    const stack = error instanceof Error ? error.stack : undefined
    return NextResponse.json(
      { error: 'Webhook processing failed', details: String(error), stack },
      { status: 500 }
    )
  }
}

/**
 * Extract variants from various payload formats - BULLETPROOF VERSION
 * Handles all possible data structures from n8n and Inventory Planner
 */
function extractVariants(body: unknown): Record<string, unknown>[] {
  console.log('=== extractVariants START ===')
  console.log('Body type:', typeof body)
  console.log('Body is array:', Array.isArray(body))

  if (!body) {
    console.error('Body is null/undefined')
    return []
  }

  // Step 1: Find the raw variants array from various wrapper formats
  let rawVariants: unknown[] = []

  try {
    if (Array.isArray(body)) {
      console.log('Body is direct array with length:', body.length)
      rawVariants = body
    } else if (typeof body === 'object') {
      const obj = body as Record<string, unknown>
      const keys = Object.keys(obj)
      console.log('Body keys:', keys)

      // Try multiple possible locations for the variants array
      const possibleArrays = [
        obj.variants,
        obj.data,
        obj.items,
        obj.results,
        // n8n sometimes wraps in body
        (obj.body as Record<string, unknown>)?.variants,
        (obj.body as Record<string, unknown>)?.data,
        // Sometimes nested deeper
        (obj.json as Record<string, unknown>)?.variants,
      ]

      for (const arr of possibleArrays) {
        if (Array.isArray(arr) && arr.length > 0) {
          console.log('Found array with length:', arr.length)
          rawVariants = arr
          break
        }
      }

      // If still empty, check if body itself is a single variant or has connections
      if (rawVariants.length === 0) {
        if (obj.connections || obj.id || obj.sku) {
          console.log('Body appears to be a single variant, wrapping in array')
          rawVariants = [obj]
        }
      }
    }
  } catch (e) {
    console.error('Error finding variants array:', e)
    return []
  }

  if (!Array.isArray(rawVariants) || rawVariants.length === 0) {
    console.error('No variants found. Raw body sample:', JSON.stringify(body).slice(0, 500))
    return []
  }

  console.log(`Found ${rawVariants.length} raw variants`)

  // Step 2: Flatten each variant (handle IP nested structure)
  const flattened: Record<string, unknown>[] = []

  for (let i = 0; i < rawVariants.length; i++) {
    try {
      const variant = rawVariants[i]
      if (!variant || typeof variant !== 'object') {
        console.warn(`Variant ${i} is not an object:`, typeof variant)
        continue
      }

      const flat = flattenIPVariant(variant as Record<string, unknown>)
      if (flat) {
        flattened.push(flat)
      }
    } catch (e) {
      console.error(`Error flattening variant ${i}:`, e)
    }
  }

  console.log(`Extracted ${flattened.length} flattened variants`)
  return flattened
}

/**
 * Flatten Inventory Planner's nested variant structure - ROBUST VERSION
 * Handles multiple data formats from IP API
 */
function flattenIPVariant(variant: Record<string, unknown>): Record<string, unknown> | null {
  if (!variant || typeof variant !== 'object') {
    return null
  }

  // If already flat (has id and sku at root), return as-is
  if (variant.id && variant.sku) {
    console.log(`Variant already flat: ${variant.sku}`)
    return variant
  }

  // Check for Inventory Planner nested structure with connections[]
  const connections = variant.connections
  const warehouses = variant.warehouse || variant.warehouses

  // Handle case where connections is not an array or is empty
  if (!connections) {
    // Maybe the variant data is at root level but missing id - try to extract
    if (variant.sku) {
      console.log(`Variant has sku but no id: ${variant.sku}`)
      return { ...variant, id: variant.sku }
    }
    console.warn('No connections and no sku found in variant:', Object.keys(variant))
    return variant // Return as-is, let validation handle it
  }

  // Ensure connections is an array
  const connectionsArray = Array.isArray(connections)
    ? connections as Record<string, unknown>[]
    : [connections as Record<string, unknown>]

  if (connectionsArray.length === 0) {
    console.warn('Empty connections array')
    return variant
  }

  // Find the main connection (connection_main: true) or use first
  const mainConnection = connectionsArray.find(c => c?.connection_main === true) || connectionsArray[0]

  if (!mainConnection) {
    return null
  }

  // Find matching warehouse data (use 'combined' or first available)
  let warehouseData: Record<string, unknown> = {}
  if (warehouses) {
    // Handle both array and object formats
    const warehousesArray = Array.isArray(warehouses)
      ? warehouses as Record<string, unknown>[]
      : typeof warehouses === 'object'
        ? [warehouses as Record<string, unknown>]
        : []

    if (warehousesArray.length > 0) {
      const combined = warehousesArray.find(w =>
        w && (String(w.warehouse || '').includes('combined') || String(w.warehouse) === 'combined')
      )
      warehouseData = combined || warehousesArray[0] || {}
    }
  }

  // Merge connection data with warehouse data
  // Connection fields take priority, warehouse adds inventory-specific fields
  return {
    // Core identifiers from connection
    id: mainConnection.id,
    sku: mainConnection.sku,
    title: mainConnection.title || mainConnection.product_title,
    barcode: mainConnection.barcode,
    brand: mainConnection.brand,
    product_type: mainConnection.product_type,
    image: mainConnection.image,
    price: mainConnection.price,

    // Cost from vendors array or warehouse
    cost_price: extractCostPrice(mainConnection, warehouseData),

    // Inventory from warehouse
    in_stock: warehouseData.in_stock ?? 0,
    replenishment: warehouseData.replenishment ?? 0,
    to_order: warehouseData.to_order ?? 0,
    lead_time: warehouseData.lead_time,
    oos: warehouseData.oos ?? 0,

    // Sales data from warehouse
    last_7_days_sales: warehouseData.last_7_days ?? warehouseData.sales_last_7_days ?? 0,
    last_30_days_sales: warehouseData.last_30_days ?? warehouseData.sales_last_30_days ?? 0,
    last_90_days_sales: warehouseData.last_90_days ?? warehouseData.sales_last_90_days ?? 0,
    last_180_days_sales: warehouseData.last_180_days ?? warehouseData.sales_last_180_days ?? 0,
    last_365_days_sales: warehouseData.last_365_days ?? warehouseData.sales_last_365_days ?? 0,

    // Forecast data
    orders_by_month: warehouseData.orders_by_month ?? variant.orders_by_month,
    forecast_by_period: warehouseData.forecast_by_period ?? variant.forecast_by_period,
    current_forecast: warehouseData.current_forecast ?? warehouseData.forecast,

    // Lost revenue
    forecasted_lost_revenue: warehouseData.forecasted_lost_revenue ?? warehouseData.lost_revenue,

    // Keep raw data for debugging
    raw_data: variant
  }
}

/**
 * Extract cost price from various locations in IP data
 */
function extractCostPrice(connection: Record<string, unknown>, warehouse: Record<string, unknown>): number | undefined {
  // Try warehouse cost_price first
  if (warehouse.cost_price != null && Number(warehouse.cost_price) > 0) {
    return Number(warehouse.cost_price)
  }

  // Try connection's vendors array
  const vendors = connection.vendors as Record<string, unknown>[] | undefined
  if (vendors && Array.isArray(vendors) && vendors.length > 0) {
    const vendorCost = vendors[0].cost_price
    if (vendorCost != null && Number(vendorCost) > 0) {
      return Number(vendorCost)
    }
  }

  // Try direct cost_price on connection
  if (connection.cost_price != null && Number(connection.cost_price) > 0) {
    return Number(connection.cost_price)
  }

  return undefined
}

/**
 * Handle chunked import as part of a session
 */
async function handleChunkedImport(
  body: unknown,
  sessionId: string,
  chunkIndex: number,
  totalChunks: number | undefined,
  startTime: number
) {
  const supabase = createAdminClient()

  // Verify session exists
  const session = await sessionManager.getSession(sessionId)
  if (!session) {
    return NextResponse.json(
      { error: 'Invalid session ID' },
      { status: 400 }
    )
  }

  // Extract variants from payload
  const rawVariants = extractVariants(body)
  if (rawVariants.length === 0) {
    return NextResponse.json(
      { error: 'No variants found in payload' },
      { status: 400 }
    )
  }

  // Create/update chunk record
  await sessionManager.upsertChunk(sessionId, chunkIndex, rawVariants.length)

  // Start session if this is first chunk
  if (session.status === 'pending') {
    await sessionManager.startSession(sessionId)
  }

  // Initialize error logger for this chunk
  const errorLogger = new SyncErrorLogger(sessionId, chunkIndex)

  try {
    // Process the chunk
    const result = await processVariantBatch(
      supabase,
      rawVariants,
      sessionId,
      errorLogger,
      chunkIndex
    )

    // Flush any remaining errors
    await errorLogger.flush()

    // Update chunk status
    const processingTime = Date.now() - startTime
    await sessionManager.completeChunk(sessionId, chunkIndex, {
      recordsProcessed: result.imported,
      recordsFailed: result.errors,
      processingTimeMs: processingTime
    })

    // Update session totals
    const currentSession = await sessionManager.getSession(sessionId)
    if (currentSession) {
      await sessionManager.updateSession(sessionId, {
        chunksReceived: (currentSession.chunks_received || 0) + 1,
        recordsProcessed: (currentSession.records_processed || 0) + result.imported,
        recordsFailed: (currentSession.records_failed || 0) + result.errors
      })

      // Check if all chunks received
      if (totalChunks && currentSession.chunks_received + 1 >= totalChunks) {
        // Calculate metrics for all imported variants
        await calculateAllMetricsEnhanced(supabase)
        await updateBusinessSummary(supabase)

        // Complete session
        await sessionManager.completeSession(sessionId, {
          recordsProcessed: currentSession.records_processed + result.imported,
          recordsFailed: currentSession.records_failed + result.errors
        })
      }
    }

    return NextResponse.json({
      success: true,
      chunk: chunkIndex,
      stats: {
        received: rawVariants.length,
        imported: result.imported,
        errors: result.errors,
        processingTimeMs: processingTime
      }
    })

  } catch (error) {
    await errorLogger.flush()
    await sessionManager.failChunk(sessionId, chunkIndex, String(error))

    return NextResponse.json(
      { error: 'Chunk processing failed', details: String(error) },
      { status: 500 }
    )
  }
}

async function handleVariantImport(body: { variants?: unknown[]; sync_id?: string }, startTime: number) {
  const supabase = createAdminClient()
  let step = 'init'
  let syncId: string | undefined = body.sync_id
  let errorLogger: SyncErrorLogger | undefined
  let progressTracker: SyncProgressTracker | undefined

  try {
    // Create sync record if not provided
    step = 'create_sync_record'
    if (!syncId) {
      const { sync } = await createSyncRecord('webhook')
      syncId = sync?.id
    }

    // Extract variants from various payload formats
    step = 'extract_variants'
    const rawVariants = extractVariants(body)
    console.log(`Step ${step}: extracted ${rawVariants?.length ?? 'undefined'} variants`)

    if (!rawVariants || rawVariants.length === 0) {
      return NextResponse.json(
        { error: 'No variants provided', step },
        { status: 400 }
      )
    }

    // Initialize progress tracking
    step = 'init_progress_tracker'
    progressTracker = new SyncProgressTracker(syncId || null, rawVariants.length)
    await progressTracker.start('Processing import...')

    // Initialize error logger
    step = 'init_error_logger'
    errorLogger = new SyncErrorLogger(syncId || null)

    step = 'start_processing'
    console.log(`Processing ${rawVariants.length} variants`)

    // STEP 1: Validate all variants
    step = 'validate_variants'
    const validation = validateVariants(rawVariants)
    if (!validation || !validation.summary) {
      throw new Error(`Validation returned invalid result: ${JSON.stringify(validation)}`)
    }
    console.log(`Validation: ${validation.summary.passed} passed, ${validation.summary.failed} failed, ${validation.summary.withWarnings} warnings`)

    // STEP 2: Detect field mappings
    step = 'detect_field_mappings'
    const fieldMappings = detectFieldMappings(rawVariants)
    console.log(`Field detection: ${fieldMappings.summary}`)

    // Use validated variants for import
    step = 'get_valid_variants'
    const variants = validation.valid
    if (!variants || !Array.isArray(variants)) {
      throw new Error(`validation.valid is not an array: ${typeof variants}`)
    }
    console.log(`Valid variants count: ${variants.length}`)

    // Transform and insert in batches
    const batchSize = 500
    let imported = 0
    let errors = 0

    for (let i = 0; i < variants.length; i += batchSize) {
      const batch = variants.slice(i, i + batchSize)

      const transformedBatch = batch.map((v): VariantInsert | null => {
        const variantId = v.id ? String(v.id) : null
        const sku = v.sku ? String(v.sku) : ''

        if (!variantId || !sku) return null

        // Use detected field mappings for cost
        const costValue = getCostValue(v as Record<string, unknown>, fieldMappings.cost.detectedField || undefined)
        const lostRevenueValue = getLostRevenueValue(v as Record<string, unknown>, fieldMappings.lostRevenue.detectedField || undefined)

        return {
          id: variantId,
          sku: sku,
          title: v.title ? String(v.title) : undefined,
          barcode: v.barcode ? String(v.barcode) : undefined,
          brand: v.brand ? String(v.brand) : undefined,
          product_type: v.product_type ? String(v.product_type) : undefined,
          image: v.image ? String(v.image) : undefined,
          price: v.price != null ? Number(v.price) : undefined,
          cost_price: costValue ?? undefined,
          in_stock: Number(v.in_stock) || 0,
          purchase_orders_qty: Number(v.purchase_orders_qty) || 0,
          last_7_days_sales: Number(v.last_7_days_sales) || 0,
          last_30_days_sales: Number(v.last_30_days_sales) || 0,
          last_90_days_sales: Number(v.last_90_days_sales) || 0,
          last_180_days_sales: Number(v.last_180_days_sales) || 0,
          last_365_days_sales: Number(v.last_365_days_sales) || 0,
          total_sales: Number(v.total_sales) || 0,
          orders_by_month: v.orders_by_month as Variant['orders_by_month'],
          forecast_by_period: v.forecast_by_period as Variant['forecast_by_period'],
          forecasted_stock: v.forecasted_stock != null ? Number(v.forecasted_stock) : undefined,
          current_forecast: v.current_forecast != null ? Number(v.current_forecast) : undefined,
          replenishment: Number(v.replenishment) || 0,
          to_order: Number(v.to_order) || 0,
          minimum_stock: v.minimum_stock != null ? Number(v.minimum_stock) : undefined,
          lead_time: v.lead_time != null ? Number(v.lead_time) : undefined,
          oos: Number(v.oos) || 0,
          oos_last_60_days: Number(v.oos_last_60_days) || 0,
          forecasted_lost_revenue: lostRevenueValue ?? undefined,
          raw_data: v as Variant['raw_data'],
          synced_at: new Date().toISOString()
        }
      }).filter((v): v is VariantInsert => v !== null)

      if (transformedBatch.length > 0) {
        const { error } = await supabase
          .from('variants')
          // @ts-ignore - Supabase types are too strict
          .upsert(transformedBatch, { onConflict: 'id' })

        if (error) {
          console.error(`Batch error:`, error.message)
          await errorLogger.logDatabaseError(
            batch as Record<string, unknown>[],
            { message: error.message, code: error.code, details: error.details }
          )
          errors += transformedBatch.length
        } else {
          imported += transformedBatch.length
        }

        // Update progress
        await progressTracker.updateProgress(imported + errors, {
          currentBatch: Math.floor(i / batchSize) + 1,
          errorsCount: errors + validation.summary.failed,
          message: `Processed ${imported + errors} of ${rawVariants.length} records...`
        })
      }
    }

    // Flush any remaining errors
    await errorLogger.flush()

    // Calculate forecast metrics with enhanced tracking
    const metricsCalculated = await calculateAllMetricsEnhanced(supabase)

    // Update business summary
    await updateBusinessSummary(supabase)

    // Complete sync record and progress
    const duration = Date.now() - startTime
    if (syncId) {
      await completeSyncRecord(syncId, 'completed', rawVariants.length, imported)
    }
    await progressTracker.complete(imported, errors + validation.summary.failed)

    return NextResponse.json({
      success: true,
      message: 'Import completed',
      stats: {
        received: rawVariants.length,
        imported,
        rejected: validation.summary.failed,
        warnings: validation.summary.withWarnings,
        errors,
        metricsCalculated,
        durationMs: duration
      },
      validation: {
        passed: validation.summary.passed,
        failed: validation.summary.failed,
        errorSummary: getErrorSummary(validation),
        warningSummary: getWarningSummary(validation),
        sampleErrors: validation.invalid.slice(0, 3),
        sampleWarnings: validation.warnings.slice(0, 3)
      },
      fieldDetection: {
        cost: {
          detected: fieldMappings.cost.detectedField,
          coverage: Math.round(fieldMappings.cost.coverage * 100),
          alternatives: fieldMappings.cost.alternatives.map(a =>
            `${a.field} (${Math.round(a.coverage * 100)}%)`
          ).slice(0, 3)
        },
        lostRevenue: {
          detected: fieldMappings.lostRevenue.detectedField,
          coverage: Math.round(fieldMappings.lostRevenue.coverage * 100)
        },
        needsConfirmation: fieldMappings.needsConfirmation
      }
    })

  } catch (error) {
    console.error(`Import error at step "${step}":`, error)
    const stack = error instanceof Error ? error.stack : undefined
    console.error('Stack trace:', stack)

    // Try to flush and update records, but don't fail if these fail too
    try {
      if (errorLogger) {
        await errorLogger.flush()
      }
      if (progressTracker) {
        await progressTracker.fail(String(error))
      }
      if (syncId) {
        await completeSyncRecord(syncId, 'failed', 0, 0, String(error))
      }
    } catch (cleanupError) {
      console.error('Error during cleanup:', cleanupError)
    }

    return NextResponse.json(
      { error: 'Import failed', details: String(error), step, stack },
      { status: 500 }
    )
  }
}

/**
 * Process a batch of variants (used by chunked import)
 */
async function processVariantBatch(
  supabase: ReturnType<typeof createAdminClient>,
  rawVariants: Record<string, unknown>[],
  sessionId: string | null,
  errorLogger: SyncErrorLogger,
  chunkIndex?: number
): Promise<{ imported: number; errors: number }> {
  // Validate all variants
  const validation = validateVariants(rawVariants)

  // Log validation errors
  for (let i = 0; i < validation.invalid.length; i++) {
    const invalidItem = validation.invalid[i]
    if (invalidItem.error) {
      await errorLogger.logValidationError(
        rawVariants[i] || {},
        invalidItem.error,
        i
      )
    }
  }

  // Detect field mappings
  const fieldMappings = detectFieldMappings(rawVariants)

  // Use validated variants for import
  const variants = validation.valid

  // Transform and insert in batches
  const batchSize = 500
  let imported = 0
  let errors = 0

  for (let i = 0; i < variants.length; i += batchSize) {
    const batch = variants.slice(i, i + batchSize)

    const transformedBatch = batch.map((v): VariantInsert | null => {
      const variantId = v.id ? String(v.id) : null
      const sku = v.sku ? String(v.sku) : ''

      if (!variantId || !sku) return null

      const costValue = getCostValue(v as Record<string, unknown>, fieldMappings.cost.detectedField || undefined)
      const lostRevenueValue = getLostRevenueValue(v as Record<string, unknown>, fieldMappings.lostRevenue.detectedField || undefined)

      return {
        id: variantId,
        sku: sku,
        title: v.title ? String(v.title) : undefined,
        barcode: v.barcode ? String(v.barcode) : undefined,
        brand: v.brand ? String(v.brand) : undefined,
        product_type: v.product_type ? String(v.product_type) : undefined,
        image: v.image ? String(v.image) : undefined,
        price: v.price != null ? Number(v.price) : undefined,
        cost_price: costValue ?? undefined,
        in_stock: Number(v.in_stock) || 0,
        purchase_orders_qty: Number(v.purchase_orders_qty) || 0,
        last_7_days_sales: Number(v.last_7_days_sales) || 0,
        last_30_days_sales: Number(v.last_30_days_sales) || 0,
        last_90_days_sales: Number(v.last_90_days_sales) || 0,
        last_180_days_sales: Number(v.last_180_days_sales) || 0,
        last_365_days_sales: Number(v.last_365_days_sales) || 0,
        total_sales: Number(v.total_sales) || 0,
        orders_by_month: v.orders_by_month as Variant['orders_by_month'],
        forecast_by_period: v.forecast_by_period as Variant['forecast_by_period'],
        forecasted_stock: v.forecasted_stock != null ? Number(v.forecasted_stock) : undefined,
        current_forecast: v.current_forecast != null ? Number(v.current_forecast) : undefined,
        replenishment: Number(v.replenishment) || 0,
        to_order: Number(v.to_order) || 0,
        minimum_stock: v.minimum_stock != null ? Number(v.minimum_stock) : undefined,
        lead_time: v.lead_time != null ? Number(v.lead_time) : undefined,
        oos: Number(v.oos) || 0,
        oos_last_60_days: Number(v.oos_last_60_days) || 0,
        forecasted_lost_revenue: lostRevenueValue ?? undefined,
        raw_data: v as Variant['raw_data'],
        synced_at: new Date().toISOString()
      }
    }).filter((v): v is VariantInsert => v !== null)

    if (transformedBatch.length > 0) {
      const { error } = await supabase
        .from('variants')
        // @ts-ignore - Supabase types are too strict
        .upsert(transformedBatch, { onConflict: 'id' })

      if (error) {
        await errorLogger.logDatabaseError(
          batch as Record<string, unknown>[],
          { message: error.message, code: error.code, details: error.details }
        )
        errors += transformedBatch.length
      } else {
        imported += transformedBatch.length
      }
    }
  }

  return { imported, errors: errors + validation.summary.failed }
}

/**
 * Enhanced metrics calculation with:
 * - Forecast source tracking (IP vs naive benchmark)
 * - Data tier classification
 * - Zero-period handling with smoothed MAPE
 * - Primary metric selection
 */
async function calculateAllMetricsEnhanced(supabase: ReturnType<typeof createAdminClient>): Promise<number> {
  const { data: variantsWithData } = await supabase
    .from('variants')
    .select('id, sku, orders_by_month, forecast_by_period')
    .not('orders_by_month', 'is', null)

  if (!variantsWithData || variantsWithData.length === 0) {
    return 0
  }

  const metricsToInsert: ExtendedMetricInsert[] = []

  for (const variant of variantsWithData as {
    id: string
    sku: string
    orders_by_month: Variant['orders_by_month']
    forecast_by_period: Variant['forecast_by_period']
  }[]) {
    try {
      const ordersByMonth = variant.orders_by_month as Record<string, Record<string, number>>
      const forecastByPeriod = variant.forecast_by_period as Record<string, Record<string, number>> | null

      if (!ordersByMonth) continue

      // Parse actual sales data
      const actualData: { key: string; value: number }[] = []
      for (const year of Object.keys(ordersByMonth).sort()) {
        const months = ordersByMonth[year]
        if (typeof months !== 'object') continue
        for (const month of Object.keys(months).sort((a, b) => Number(a) - Number(b))) {
          actualData.push({
            key: `${year}-${month.padStart(2, '0')}`,
            value: Number(months[month]) || 0
          })
        }
      }

      // NEW: Use tiered data requirements (minimum 3 periods instead of 6)
      const dataTier = getDataTier(actualData.length)
      if (dataTier.tier === 'insufficient') continue

      // Parse forecast data if available
      const forecastData: { key: string; value: number }[] = []
      let hasIPForecast = false
      if (forecastByPeriod && typeof forecastByPeriod === 'object') {
        for (const year of Object.keys(forecastByPeriod).sort()) {
          const months = forecastByPeriod[year]
          if (typeof months !== 'object') continue
          for (const month of Object.keys(months).sort((a, b) => Number(a) - Number(b))) {
            forecastData.push({
              key: `${year}-${month.padStart(2, '0')}`,
              value: Number(months[month]) || 0
            })
          }
        }
        hasIPForecast = forecastData.some(f => f.value > 0)
      }

      const recentActual = actualData.slice(-12)
      const actual = recentActual.map(d => d.value)

      // Don't skip all-zero SKUs - they might have forecasts
      const primaryMetric = selectPrimaryMetric(actual)
      const zeroPeriods = actual.filter(v => v === 0).length

      // Use actual forecasts if available, otherwise naive
      let forecast: number[]
      let forecastSource: ForecastSource = 'inventory_planner'

      if (hasIPForecast && forecastData.length > 0) {
        const forecastMap = new Map(forecastData.map(f => [f.key, f.value]))
        forecast = recentActual.map(a => forecastMap.get(a.key) ?? 0)
        if (!forecast.some(v => v > 0)) {
          // Fallback to naive if aligned forecast is all zeros
          forecast = [actual[0], ...actual.slice(0, -1)]
          forecastSource = 'naive_benchmark'
        }
      } else {
        forecast = [actual[0], ...actual.slice(0, -1)]
        forecastSource = 'naive_benchmark'
      }

      const naiveForecast = [actual[0], ...actual.slice(0, -1)]
      const naiveMape = calculateMAPE(actual, naiveForecast)

      // Use smoothed MAPE for SKUs with zero periods
      const smoothedResult = calculateSmoothedMAPE(actual, forecast)
      const mape = smoothedResult.value

      const wape = calculateWAPE(actual, forecast)
      const rmse = dataTier.metricsAvailable.includes('rmse') ? calculateRMSE(actual, forecast) : null
      const bias = calculateBias(actual, forecast)

      let wase: number | null = null
      if (dataTier.metricsAvailable.includes('wase') && naiveMape !== null && naiveMape > 0) {
        const forecastError = actual.reduce((sum, a, i) => sum + Math.abs(a - forecast[i]), 0)
        const naiveError = actual.reduce((sum, a, i) => sum + Math.abs(a - naiveForecast[i]), 0)
        wase = naiveError > 0 ? forecastError / naiveError : null
      }

      // Include metrics even if MAPE is high (useful for data quality insights)
      if (mape !== null) {
        metricsToInsert.push({
          variant_id: variant.id,
          sku: variant.sku,
          mape,
          wape,
          rmse,
          wase,
          bias,
          naive_mape: naiveMape,
          actual_values: actual,
          forecast_values: forecast,
          calculated_at: new Date().toISOString(),
          // Extended fields
          forecast_source: forecastSource,
          data_tier: dataTier.tier,
          period_count: actual.length,
          zero_periods: zeroPeriods,
          primary_metric: primaryMetric
        })
      }
    } catch {
      continue
    }
  }

  // Insert metrics
  let metricsCalculated = 0
  for (let i = 0; i < metricsToInsert.length; i += 500) {
    const batch = metricsToInsert.slice(i, i + 500)
    const { error } = await supabase
      .from('forecast_metrics')
      // @ts-ignore - Supabase types are too strict for extended fields
      .upsert(batch, { onConflict: 'variant_id' })

    if (!error) {
      metricsCalculated += batch.length
    }
  }

  return metricsCalculated
}

async function updateBusinessSummary(supabase: ReturnType<typeof createAdminClient>) {
  const { data: stats } = await supabase
    .from('variants')
    .select('in_stock, price, cost_price, oos, replenishment, forecasted_lost_revenue')

  const { data: metrics } = await supabase
    .from('forecast_metrics')
    .select('mape')

  if (!stats) return

  const totalSkus = stats.length
  const totalInStock = (stats as { in_stock: number }[]).reduce((sum, v) => sum + (v.in_stock || 0), 0)
  const totalValue = (stats as { in_stock: number; cost_price: number }[]).reduce(
    (sum, v) => sum + ((v.in_stock || 0) * (v.cost_price || 0)), 0
  )
  const itemsNeedingReorder = (stats as { replenishment: number }[]).filter(v => (v.replenishment || 0) > 0).length
  const itemsOutOfStock = (stats as { in_stock: number }[]).filter(v => (v.in_stock || 0) === 0).length
  const itemsOverstocked = (stats as { oos: number }[]).filter(v => (v.oos || 0) > 30).length
  const totalLostRevenue = (stats as { forecasted_lost_revenue: number }[]).reduce(
    (sum, v) => sum + (v.forecasted_lost_revenue || 0), 0
  )

  const validMape = (metrics as { mape: number }[] || []).filter(m => m.mape !== null).map(m => m.mape)
  const avgForecastAccuracy = validMape.length > 0
    ? 100 - (validMape.reduce((a, b) => a + b, 0) / validMape.length)
    : null

  // @ts-ignore - Supabase types are too strict
  await supabase
    .from('business_summary')
    .upsert({
      id: 'current',
      snapshot_date: new Date().toISOString().split('T')[0],
      total_skus: totalSkus,
      total_in_stock: totalInStock,
      total_value: totalValue,
      items_needing_reorder: itemsNeedingReorder,
      items_overstocked: itemsOverstocked,
      items_out_of_stock: itemsOutOfStock,
      avg_forecast_accuracy: avgForecastAccuracy,
      total_lost_revenue: totalLostRevenue,
      top_priority_items: null
    }, { onConflict: 'id' })
}
