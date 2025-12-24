-- Inventory Intelligence MVP - Business Summary
-- Migration: 003_business_summary.sql
-- Purpose: Pre-aggregated dashboard data for fast loading

CREATE TABLE IF NOT EXISTS business_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE DEFAULT CURRENT_DATE,

  -- Inventory counts
  total_skus INTEGER,
  total_in_stock INTEGER,
  total_value DECIMAL(12,2),

  -- Status breakdown
  items_needing_reorder INTEGER,
  items_overstocked INTEGER,
  items_out_of_stock INTEGER,

  -- Forecast performance
  avg_forecast_accuracy DECIMAL(10,4),  -- Average MAPE across all SKUs

  -- Financial impact
  total_lost_revenue DECIMAL(12,2),     -- Sum of forecasted_lost_revenue

  -- Top priority items for quick access
  top_priority_items JSONB,  -- Array of {sku, title, reason, value}

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for date-based queries
CREATE INDEX IF NOT EXISTS idx_business_summary_date ON business_summary(snapshot_date DESC);

-- Unique constraint to prevent duplicate daily snapshots
CREATE UNIQUE INDEX IF NOT EXISTS idx_business_summary_unique_date ON business_summary(snapshot_date);
