-- Inventory Intelligence MVP - Sync Metrics
-- Migration: 004_sync_metrics.sql
-- Purpose: Track sync job performance and status

CREATE TABLE IF NOT EXISTS sync_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT,                -- 'full', 'incremental', 'manual'
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  records_fetched INTEGER,
  records_updated INTEGER,
  duration_ms INTEGER,
  status TEXT,                   -- 'running', 'completed', 'failed'
  error_message TEXT,
  metadata JSONB,                -- Additional context
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for status monitoring
CREATE INDEX IF NOT EXISTS idx_sync_metrics_status ON sync_metrics(status);
CREATE INDEX IF NOT EXISTS idx_sync_metrics_started ON sync_metrics(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_metrics_type ON sync_metrics(sync_type);
