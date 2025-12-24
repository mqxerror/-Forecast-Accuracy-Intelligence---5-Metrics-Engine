export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Dashboard Summary RPC Response Type
export interface DashboardSummaryResponse {
  stats: {
    total_skus: number
    oos_count: number
    reorder_count: number
    out_of_stock_count: number
    overstocked_count: number
    total_value: number
    total_lost_revenue: number
  }
  accuracy: {
    avg_mape: number
    avg_wape: number
    avg_rmse: number
    avg_bias: number
    count: number
  }
  priority_items: {
    id: string
    sku: string
    title: string | null
    brand: string | null
    in_stock: number
    replenishment: number
    to_order: number
    lead_time: number | null
    oos: number
    forecasted_lost_revenue: number | null
  }[]
  oos_items: {
    id: string
    sku: string
    title: string | null
    brand: string | null
    oos: number
    oos_last_60_days: number
    forecasted_lost_revenue: number | null
  }[]
  last_sync: {
    id: string
    source: string | null
    status: string | null
    records_fetched: number | null
    records_updated: number | null
    started_at: string | null
    completed_at: string | null
  } | null
  mape_distribution: {
    excellent: number
    good: number
    acceptable: number
    poor: number
    very_poor: number
  }
}

export interface Database {
  public: {
    Tables: {
      variants: {
        Row: {
          id: string
          sku: string
          title: string | null
          barcode: string | null
          brand: string | null
          product_type: string | null
          image: string | null
          price: number | null
          cost_price: number | null
          in_stock: number
          purchase_orders_qty: number
          last_7_days_sales: number
          last_30_days_sales: number
          last_90_days_sales: number
          last_180_days_sales: number
          last_365_days_sales: number
          total_sales: number
          orders_by_month: Json | null
          forecast_by_period: Json | null
          forecasted_stock: number | null
          current_forecast: number | null
          replenishment: number
          to_order: number
          minimum_stock: number | null
          lead_time: number | null
          oos: number
          oos_last_60_days: number
          forecasted_lost_revenue: number | null
          raw_data: Json | null
          synced_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          sku: string
          title?: string | null
          barcode?: string | null
          brand?: string | null
          product_type?: string | null
          image?: string | null
          price?: number | null
          cost_price?: number | null
          in_stock?: number
          purchase_orders_qty?: number
          last_7_days_sales?: number
          last_30_days_sales?: number
          last_90_days_sales?: number
          last_180_days_sales?: number
          last_365_days_sales?: number
          total_sales?: number
          orders_by_month?: Json | null
          forecast_by_period?: Json | null
          forecasted_stock?: number | null
          current_forecast?: number | null
          replenishment?: number
          to_order?: number
          minimum_stock?: number | null
          lead_time?: number | null
          oos?: number
          oos_last_60_days?: number
          forecasted_lost_revenue?: number | null
          raw_data?: Json | null
          synced_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          sku?: string
          title?: string | null
          barcode?: string | null
          brand?: string | null
          product_type?: string | null
          image?: string | null
          price?: number | null
          cost_price?: number | null
          in_stock?: number
          purchase_orders_qty?: number
          last_7_days_sales?: number
          last_30_days_sales?: number
          last_90_days_sales?: number
          last_180_days_sales?: number
          last_365_days_sales?: number
          total_sales?: number
          orders_by_month?: Json | null
          forecast_by_period?: Json | null
          forecasted_stock?: number | null
          current_forecast?: number | null
          replenishment?: number
          to_order?: number
          minimum_stock?: number | null
          lead_time?: number | null
          oos?: number
          oos_last_60_days?: number
          forecasted_lost_revenue?: number | null
          raw_data?: Json | null
          synced_at?: string
          created_at?: string
          updated_at?: string
        }
      }
      forecast_metrics: {
        Row: {
          id: string
          variant_id: string | null
          sku: string
          period_start: string | null
          period_end: string | null
          mape: number | null
          wape: number | null
          rmse: number | null
          wase: number | null
          bias: number | null
          naive_mape: number | null
          actual_values: Json | null
          forecast_values: Json | null
          calculated_at: string
        }
        Insert: {
          id?: string
          variant_id?: string | null
          sku: string
          period_start?: string | null
          period_end?: string | null
          mape?: number | null
          wape?: number | null
          rmse?: number | null
          wase?: number | null
          bias?: number | null
          naive_mape?: number | null
          actual_values?: Json | null
          forecast_values?: Json | null
          calculated_at?: string
        }
        Update: {
          id?: string
          variant_id?: string | null
          sku?: string
          period_start?: string | null
          period_end?: string | null
          mape?: number | null
          wape?: number | null
          rmse?: number | null
          wase?: number | null
          bias?: number | null
          naive_mape?: number | null
          actual_values?: Json | null
          forecast_values?: Json | null
          calculated_at?: string
        }
      }
      business_summary: {
        Row: {
          id: string
          snapshot_date: string
          total_skus: number | null
          total_in_stock: number | null
          total_value: number | null
          items_needing_reorder: number | null
          items_overstocked: number | null
          items_out_of_stock: number | null
          avg_forecast_accuracy: number | null
          total_lost_revenue: number | null
          top_priority_items: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          snapshot_date?: string
          total_skus?: number | null
          total_in_stock?: number | null
          total_value?: number | null
          items_needing_reorder?: number | null
          items_overstocked?: number | null
          items_out_of_stock?: number | null
          avg_forecast_accuracy?: number | null
          total_lost_revenue?: number | null
          top_priority_items?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          snapshot_date?: string
          total_skus?: number | null
          total_in_stock?: number | null
          total_value?: number | null
          items_needing_reorder?: number | null
          items_overstocked?: number | null
          items_out_of_stock?: number | null
          avg_forecast_accuracy?: number | null
          total_lost_revenue?: number | null
          top_priority_items?: Json | null
          created_at?: string
        }
      }
      sync_metrics: {
        Row: {
          id: string
          sync_type: string | null
          started_at: string | null
          completed_at: string | null
          records_fetched: number | null
          records_updated: number | null
          duration_ms: number | null
          status: string | null
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          sync_type?: string | null
          started_at?: string | null
          completed_at?: string | null
          records_fetched?: number | null
          records_updated?: number | null
          duration_ms?: number | null
          status?: string | null
          error_message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          sync_type?: string | null
          started_at?: string | null
          completed_at?: string | null
          records_fetched?: number | null
          records_updated?: number | null
          duration_ms?: number | null
          status?: string | null
          error_message?: string | null
          created_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          created_at: string
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string | null
          created_at?: string
        }
      }
      sync_sessions: {
        Row: {
          id: string
          session_token: string
          source: string | null
          total_expected_chunks: number | null
          chunks_received: number
          total_expected_records: number | null
          records_processed: number
          records_failed: number
          records_skipped: number
          status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'paused' | 'cancelled'
          started_at: string
          last_activity_at: string
          completed_at: string | null
          error_message: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          session_token: string
          source?: string | null
          total_expected_chunks?: number | null
          chunks_received?: number
          total_expected_records?: number | null
          records_processed?: number
          records_failed?: number
          records_skipped?: number
          status?: 'pending' | 'in_progress' | 'completed' | 'failed' | 'paused' | 'cancelled'
          started_at?: string
          last_activity_at?: string
          completed_at?: string | null
          error_message?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          session_token?: string
          source?: string | null
          total_expected_chunks?: number | null
          chunks_received?: number
          total_expected_records?: number | null
          records_processed?: number
          records_failed?: number
          records_skipped?: number
          status?: 'pending' | 'in_progress' | 'completed' | 'failed' | 'paused' | 'cancelled'
          started_at?: string
          last_activity_at?: string
          completed_at?: string | null
          error_message?: string | null
          metadata?: Json | null
          created_at?: string
        }
      }
      sync_chunks: {
        Row: {
          id: string
          session_id: string
          chunk_index: number
          records_in_chunk: number
          records_processed: number
          records_failed: number
          status: 'pending' | 'processing' | 'completed' | 'failed'
          received_at: string
          started_at: string | null
          completed_at: string | null
          error_message: string | null
          processing_time_ms: number | null
        }
        Insert: {
          id?: string
          session_id: string
          chunk_index: number
          records_in_chunk?: number
          records_processed?: number
          records_failed?: number
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          received_at?: string
          started_at?: string | null
          completed_at?: string | null
          error_message?: string | null
          processing_time_ms?: number | null
        }
        Update: {
          id?: string
          session_id?: string
          chunk_index?: number
          records_in_chunk?: number
          records_processed?: number
          records_failed?: number
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          received_at?: string
          started_at?: string | null
          completed_at?: string | null
          error_message?: string | null
          processing_time_ms?: number | null
        }
      }
      sync_errors: {
        Row: {
          id: string
          session_id: string | null
          chunk_index: number | null
          record_index: number | null
          sku: string | null
          variant_id: string | null
          error_type: 'validation' | 'transform' | 'database' | 'unknown'
          error_code: string | null
          error_message: string
          field_name: string | null
          raw_value: string | null
          raw_record: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          session_id?: string | null
          chunk_index?: number | null
          record_index?: number | null
          sku?: string | null
          variant_id?: string | null
          error_type: 'validation' | 'transform' | 'database' | 'unknown'
          error_code?: string | null
          error_message: string
          field_name?: string | null
          raw_value?: string | null
          raw_record?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string | null
          chunk_index?: number | null
          record_index?: number | null
          sku?: string | null
          variant_id?: string | null
          error_type?: 'validation' | 'transform' | 'database' | 'unknown'
          error_code?: string | null
          error_message?: string
          field_name?: string | null
          raw_value?: string | null
          raw_record?: Json | null
          created_at?: string
        }
      }
      sync_progress: {
        Row: {
          id: string
          session_id: string | null
          status: 'idle' | 'syncing' | 'processing' | 'completed' | 'failed'
          current_batch: number
          total_batches: number
          current_chunk: number
          total_chunks: number
          records_processed: number
          total_records: number
          errors_count: number
          current_sku: string | null
          started_at: string | null
          estimated_completion: string | null
          last_update: string
          message: string | null
        }
        Insert: {
          id?: string
          session_id?: string | null
          status?: 'idle' | 'syncing' | 'processing' | 'completed' | 'failed'
          current_batch?: number
          total_batches?: number
          current_chunk?: number
          total_chunks?: number
          records_processed?: number
          total_records?: number
          errors_count?: number
          current_sku?: string | null
          started_at?: string | null
          estimated_completion?: string | null
          last_update?: string
          message?: string | null
        }
        Update: {
          id?: string
          session_id?: string | null
          status?: 'idle' | 'syncing' | 'processing' | 'completed' | 'failed'
          current_batch?: number
          total_batches?: number
          current_chunk?: number
          total_chunks?: number
          records_processed?: number
          total_records?: number
          errors_count?: number
          current_sku?: string | null
          started_at?: string | null
          estimated_completion?: string | null
          last_update?: string
          message?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_dashboard_summary: {
        Args: Record<string, never>
        Returns: DashboardSummaryResponse
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Helper types
export type Variant = Database['public']['Tables']['variants']['Row']
export type ForecastMetric = Database['public']['Tables']['forecast_metrics']['Row']
export type BusinessSummary = Database['public']['Tables']['business_summary']['Row']
export type SyncMetric = Database['public']['Tables']['sync_metrics']['Row']
export type Profile = Database['public']['Tables']['profiles']['Row']
export type SyncSession = Database['public']['Tables']['sync_sessions']['Row']
export type SyncChunk = Database['public']['Tables']['sync_chunks']['Row']
export type SyncError = Database['public']['Tables']['sync_errors']['Row']
export type SyncProgress = Database['public']['Tables']['sync_progress']['Row']

// Insert types
export type SyncSessionInsert = Database['public']['Tables']['sync_sessions']['Insert']
export type SyncChunkInsert = Database['public']['Tables']['sync_chunks']['Insert']
export type SyncErrorInsert = Database['public']['Tables']['sync_errors']['Insert']
export type SyncProgressUpdate = Database['public']['Tables']['sync_progress']['Update']
