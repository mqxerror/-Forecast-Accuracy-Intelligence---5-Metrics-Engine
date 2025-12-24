-- Inventory Intelligence MVP - Forecast Metrics
-- Migration: 002_forecast_metrics.sql
-- Purpose: Store calculated forecast accuracy metrics

CREATE TABLE IF NOT EXISTS forecast_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id TEXT REFERENCES variants(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  period_start DATE,
  period_end DATE,

  -- Core accuracy metrics (all percentages, lower is better except bias which should be near 0)
  mape DECIMAL(10,4),           -- Mean Absolute Percentage Error
  wape DECIMAL(10,4),           -- Weighted Absolute Percentage Error (better for varying volumes)
  rmse DECIMAL(10,4),           -- Root Mean Square Error (penalizes large errors)
  wase DECIMAL(10,4),           -- Weighted Absolute Scaled Error
  bias DECIMAL(10,4),           -- Forecast Bias (negative = under-forecast, positive = over-forecast)

  -- Benchmark comparison
  naive_mape DECIMAL(10,4),     -- MAPE of naive forecast (previous period = next period)

  -- Transparency: store the actual data used for calculations
  actual_values JSONB,          -- Historical actual sales: {"2024-01": 100, "2024-02": 150, ...}
  forecast_values JSONB,        -- Forecasted values: {"2024-01": 95, "2024-02": 160, ...}

  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for querying metrics
CREATE INDEX IF NOT EXISTS idx_forecast_metrics_variant ON forecast_metrics(variant_id);
CREATE INDEX IF NOT EXISTS idx_forecast_metrics_sku ON forecast_metrics(sku);
CREATE INDEX IF NOT EXISTS idx_forecast_metrics_period ON forecast_metrics(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_forecast_metrics_calculated ON forecast_metrics(calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_forecast_metrics_mape ON forecast_metrics(mape);
