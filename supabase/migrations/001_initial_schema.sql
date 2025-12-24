-- Inventory Intelligence MVP - Initial Schema
-- Migration: 001_initial_schema.sql
-- Created: 2024-12-23

-- Variants table (synced from Inventory Planner API)
CREATE TABLE IF NOT EXISTS variants (
  id TEXT PRIMARY KEY,
  sku TEXT NOT NULL,
  title TEXT,
  barcode TEXT,
  brand TEXT,
  product_type TEXT,
  image TEXT,
  price DECIMAL(10,2),
  cost_price DECIMAL(10,2),
  in_stock INTEGER DEFAULT 0,
  purchase_orders_qty INTEGER DEFAULT 0,
  last_7_days_sales INTEGER DEFAULT 0,
  last_30_days_sales INTEGER DEFAULT 0,
  last_90_days_sales INTEGER DEFAULT 0,
  last_180_days_sales INTEGER DEFAULT 0,
  last_365_days_sales INTEGER DEFAULT 0,
  total_sales INTEGER DEFAULT 0,
  orders_by_month JSONB,
  forecast_by_period JSONB,
  forecasted_stock DECIMAL(10,2),
  current_forecast INTEGER,
  replenishment INTEGER DEFAULT 0,
  to_order INTEGER DEFAULT 0,
  minimum_stock DECIMAL(10,2),
  lead_time INTEGER,
  oos INTEGER DEFAULT 0,
  oos_last_60_days INTEGER DEFAULT 0,
  forecasted_lost_revenue DECIMAL(10,2),
  raw_data JSONB,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_variants_sku ON variants(sku);
CREATE INDEX IF NOT EXISTS idx_variants_brand ON variants(brand);
CREATE INDEX IF NOT EXISTS idx_variants_product_type ON variants(product_type);
CREATE INDEX IF NOT EXISTS idx_variants_replenishment ON variants(replenishment DESC);
CREATE INDEX IF NOT EXISTS idx_variants_oos ON variants(oos DESC);
CREATE INDEX IF NOT EXISTS idx_variants_in_stock ON variants(in_stock);
CREATE INDEX IF NOT EXISTS idx_variants_synced_at ON variants(synced_at DESC);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_variants_updated_at
  BEFORE UPDATE ON variants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
