-- Migration: 007_sync_sessions.sql
-- Purpose: Add tables for chunked sync sessions, progress tracking, and error logging

-- ============================================
-- 1. Sync Sessions - Manages chunked uploads
-- ============================================
CREATE TABLE IF NOT EXISTS sync_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token TEXT UNIQUE NOT NULL,
  source TEXT DEFAULT 'n8n',                    -- n8n, manual, api
  total_expected_chunks INTEGER,
  chunks_received INTEGER DEFAULT 0,
  total_expected_records INTEGER,
  records_processed INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  records_skipped INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'paused', 'cancelled')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sync_sessions_token ON sync_sessions(session_token);
CREATE INDEX idx_sync_sessions_status ON sync_sessions(status);
CREATE INDEX idx_sync_sessions_started ON sync_sessions(started_at DESC);

-- ============================================
-- 2. Sync Chunks - Tracks individual chunks
-- ============================================
CREATE TABLE IF NOT EXISTS sync_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sync_sessions(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  records_in_chunk INTEGER DEFAULT 0,
  records_processed INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  processing_time_ms INTEGER,
  UNIQUE(session_id, chunk_index)
);

CREATE INDEX idx_sync_chunks_session ON sync_chunks(session_id);
CREATE INDEX idx_sync_chunks_status ON sync_chunks(status);

-- ============================================
-- 3. Sync Errors - Per-record error tracking
-- ============================================
CREATE TABLE IF NOT EXISTS sync_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sync_sessions(id) ON DELETE CASCADE,
  chunk_index INTEGER,
  record_index INTEGER,
  sku TEXT,
  variant_id TEXT,
  error_type TEXT CHECK (error_type IN ('validation', 'transform', 'database', 'unknown')),
  error_code TEXT,
  error_message TEXT NOT NULL,
  field_name TEXT,
  raw_value TEXT,
  raw_record JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sync_errors_session ON sync_errors(session_id);
CREATE INDEX idx_sync_errors_sku ON sync_errors(sku);
CREATE INDEX idx_sync_errors_type ON sync_errors(error_type);
CREATE INDEX idx_sync_errors_created ON sync_errors(created_at DESC);

-- ============================================
-- 4. Sync Progress - Realtime updates (single row)
-- ============================================
CREATE TABLE IF NOT EXISTS sync_progress (
  id TEXT PRIMARY KEY DEFAULT 'current',
  session_id UUID REFERENCES sync_sessions(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'syncing', 'processing', 'completed', 'failed')),
  current_batch INTEGER DEFAULT 0,
  total_batches INTEGER DEFAULT 0,
  current_chunk INTEGER DEFAULT 0,
  total_chunks INTEGER DEFAULT 0,
  records_processed INTEGER DEFAULT 0,
  total_records INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  current_sku TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  estimated_completion TIMESTAMP WITH TIME ZONE,
  last_update TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  message TEXT DEFAULT 'Ready for sync'
);

-- Insert the default progress row
INSERT INTO sync_progress (id, status, message)
VALUES ('current', 'idle', 'Ready for sync')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 5. Enable Realtime for progress table
-- ============================================
-- Note: Run this in Supabase Dashboard if it fails
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE sync_progress;
EXCEPTION
  WHEN duplicate_object THEN
    NULL; -- Already added
END $$;

-- ============================================
-- 6. Add session_id to existing sync_metrics
-- ============================================
ALTER TABLE sync_metrics ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES sync_sessions(id);
ALTER TABLE sync_metrics ADD COLUMN IF NOT EXISTS validation_errors INTEGER DEFAULT 0;
ALTER TABLE sync_metrics ADD COLUMN IF NOT EXISTS transform_errors INTEGER DEFAULT 0;
ALTER TABLE sync_metrics ADD COLUMN IF NOT EXISTS database_errors INTEGER DEFAULT 0;
ALTER TABLE sync_metrics ADD COLUMN IF NOT EXISTS warnings_count INTEGER DEFAULT 0;
ALTER TABLE sync_metrics ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER;

CREATE INDEX IF NOT EXISTS idx_sync_metrics_session ON sync_metrics(session_id);

-- ============================================
-- 7. Helper function to update progress
-- ============================================
CREATE OR REPLACE FUNCTION update_sync_progress(
  p_session_id UUID,
  p_status TEXT,
  p_records_processed INTEGER,
  p_total_records INTEGER,
  p_current_batch INTEGER DEFAULT 0,
  p_total_batches INTEGER DEFAULT 0,
  p_message TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE sync_progress
  SET
    session_id = p_session_id,
    status = p_status,
    records_processed = p_records_processed,
    total_records = p_total_records,
    current_batch = p_current_batch,
    total_batches = p_total_batches,
    message = COALESCE(p_message, message),
    last_update = NOW(),
    estimated_completion = CASE
      WHEN p_records_processed > 0 AND p_total_records > p_records_processed THEN
        NOW() + (
          (NOW() - started_at) *
          ((p_total_records - p_records_processed)::float / p_records_processed::float)
        )
      ELSE NULL
    END
  WHERE id = 'current';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. Function to reset progress to idle
-- ============================================
CREATE OR REPLACE FUNCTION reset_sync_progress()
RETURNS void AS $$
BEGIN
  UPDATE sync_progress
  SET
    session_id = NULL,
    status = 'idle',
    current_batch = 0,
    total_batches = 0,
    current_chunk = 0,
    total_chunks = 0,
    records_processed = 0,
    total_records = 0,
    errors_count = 0,
    current_sku = NULL,
    started_at = NULL,
    estimated_completion = NULL,
    last_update = NOW(),
    message = 'Ready for sync'
  WHERE id = 'current';
END;
$$ LANGUAGE plpgsql;
