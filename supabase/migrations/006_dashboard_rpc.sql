-- Migration: Dashboard optimization RPC functions
-- Purpose: Replace N+1 queries with single SQL aggregations

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS get_dashboard_summary();
DROP FUNCTION IF EXISTS get_inventory_stats();
DROP FUNCTION IF EXISTS get_average_accuracy();

-- Function to get all dashboard stats in one query
CREATE OR REPLACE FUNCTION get_dashboard_summary()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'stats', (
      SELECT json_build_object(
        'total_skus', COUNT(*),
        'oos_count', COUNT(*) FILTER (WHERE oos > 0),
        'reorder_count', COUNT(*) FILTER (WHERE replenishment > 0),
        'out_of_stock_count', COUNT(*) FILTER (WHERE in_stock = 0),
        'overstocked_count', COUNT(*) FILTER (WHERE oos > 30),
        'total_value', COALESCE(SUM(in_stock * COALESCE(cost_price, 0)), 0),
        'total_lost_revenue', COALESCE(SUM(forecasted_lost_revenue), 0)
      )
      FROM variants
    ),
    'accuracy', (
      SELECT json_build_object(
        'avg_mape', COALESCE(AVG(mape), 0),
        'avg_wape', COALESCE(AVG(wape), 0),
        'avg_rmse', COALESCE(AVG(rmse), 0),
        'avg_bias', COALESCE(AVG(bias), 0),
        'count', COUNT(*)
      )
      FROM forecast_metrics
      WHERE mape IS NOT NULL
    ),
    'priority_items', (
      SELECT COALESCE(json_agg(items), '[]'::json)
      FROM (
        SELECT id, sku, title, brand, in_stock, replenishment, to_order,
               lead_time, oos, forecasted_lost_revenue
        FROM variants
        WHERE replenishment > 0
        ORDER BY replenishment DESC
        LIMIT 10
      ) items
    ),
    'oos_items', (
      SELECT COALESCE(json_agg(items), '[]'::json)
      FROM (
        SELECT id, sku, title, brand, oos, oos_last_60_days, forecasted_lost_revenue
        FROM variants
        WHERE oos > 0
        ORDER BY oos DESC
        LIMIT 10
      ) items
    ),
    'last_sync', (
      SELECT json_build_object(
        'id', id,
        'source', sync_type,
        'status', status,
        'records_fetched', records_fetched,
        'records_updated', records_updated,
        'started_at', started_at,
        'completed_at', completed_at
      )
      FROM sync_metrics
      ORDER BY started_at DESC
      LIMIT 1
    ),
    'mape_distribution', (
      SELECT json_build_object(
        'excellent', COUNT(*) FILTER (WHERE mape < 10),
        'good', COUNT(*) FILTER (WHERE mape >= 10 AND mape < 20),
        'acceptable', COUNT(*) FILTER (WHERE mape >= 20 AND mape < 30),
        'poor', COUNT(*) FILTER (WHERE mape >= 30 AND mape < 50),
        'very_poor', COUNT(*) FILTER (WHERE mape >= 50)
      )
      FROM forecast_metrics
      WHERE mape IS NOT NULL
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- Grant access to the function
GRANT EXECUTE ON FUNCTION get_dashboard_summary() TO anon, authenticated;

-- Create index for faster dashboard queries
CREATE INDEX IF NOT EXISTS idx_variants_replenishment ON variants(replenishment DESC) WHERE replenishment > 0;
CREATE INDEX IF NOT EXISTS idx_variants_oos ON variants(oos DESC) WHERE oos > 0;
CREATE INDEX IF NOT EXISTS idx_variants_in_stock ON variants(in_stock) WHERE in_stock = 0;
CREATE INDEX IF NOT EXISTS idx_forecast_metrics_mape ON forecast_metrics(mape) WHERE mape IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sync_metrics_started_at ON sync_metrics(started_at DESC);
