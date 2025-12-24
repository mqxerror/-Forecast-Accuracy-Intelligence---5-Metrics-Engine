export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
