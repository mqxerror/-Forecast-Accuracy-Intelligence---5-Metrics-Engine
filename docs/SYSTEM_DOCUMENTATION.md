# Inventory Intelligence - System Documentation

## Table of Contents
1. [Application Overview](#1-application-overview)
2. [Architecture](#2-architecture)
3. [Data Flow from n8n/Inventory Planner](#3-data-flow-from-n8ninventory-planner)
4. [Database Schema](#4-database-schema)
5. [Pages and Their Roles](#5-pages-and-their-roles)
6. [Metrics and Calculations](#6-metrics-and-calculations)
7. [Field Mappings](#7-field-mappings)
8. [API Endpoints](#8-api-endpoints)
9. [Debugging Tools](#9-debugging-tools)

---

## 1. Application Overview

**Inventory Intelligence** is a Next.js 15 application that provides real-time inventory analytics, forecast accuracy measurement, and decision support for inventory management. It integrates with **Inventory Planner** via n8n workflows or direct API calls.

### Tech Stack
- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes (Server-side)
- **Database**: Supabase (PostgreSQL)
- **Charts**: Recharts
- **UI Components**: shadcn/ui
- **Data Source**: Inventory Planner (via n8n or direct API)

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     INVENTORY PLANNER                            │
│                    (Source of Truth)                             │
└─────────────────────┬───────────────────────────────────────────┘
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│      n8n        │     │  Direct Upload  │
│   Workflow      │     │  (JSON File)    │
└────────┬────────┘     └────────┬────────┘
         │                       │
         ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│              NEXT.JS API ENDPOINTS                               │
│  /api/sync/webhook     /api/upload/json    /api/sync/inv-planner│
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SUPABASE DATABASE                            │
│  ┌───────────┐ ┌────────────────┐ ┌────────────────┐            │
│  │ variants  │ │forecast_metrics│ │business_summary│            │
│  └───────────┘ └────────────────┘ └────────────────┘            │
│  ┌───────────────┐ ┌─────────┐                                  │
│  │ sync_metrics  │ │profiles │                                  │
│  └───────────────┘ └─────────┘                                  │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   NEXT.JS FRONTEND                               │
│  Dashboard │ Inventory │ Forecasts │ Admin │ SKU Detail         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Flow from n8n/Inventory Planner

### 3.1 Data Import Methods

There are **3 ways** to import data into the system:

#### Method 1: n8n Webhook
**Endpoint**: `POST /api/sync/webhook`

n8n sends data to this endpoint with:
- Header: `x-webhook-secret` (must match `N8N_WEBHOOK_SECRET` env var)
- Body: `{ event: "import_variants", variants: [...] }`

#### Method 2: Direct JSON Upload
**Endpoint**: `POST /api/upload/json`

Users upload a JSON file directly from the UI. Supports:
- n8n export format: `[{ json: { variants: [...] } }]`
- Direct array: `{ variants: [...] }`
- Plain array of variants

#### Method 3: Direct Inventory Planner API
**Endpoint**: `POST /api/sync/inventory-planner`

Calls Inventory Planner API directly using:
- `IP_API_KEY` - API key for authentication
- `IP_ACCOUNT_ID` - Account identifier

### 3.2 Import Process Flow

```
1. Receive JSON data
2. Validate structure (must have id + sku)
3. Transform fields (map IP fields to database columns)
4. Upsert to variants table (batch of 500)
5. Calculate forecast metrics (MAPE, WAPE, RMSE, WASE, Bias)
6. Update business_summary table
7. Record sync in sync_metrics table
```

### 3.3 JSON Structure from Inventory Planner

```json
{
  "id": "variant_unique_id",
  "sku": "SKU-12345",
  "title": "Product Name",
  "barcode": "1234567890",
  "brand": "Brand Name",
  "product_type": "Category",
  "image": "https://...",
  "price": 29.99,
  "cost_price": 15.00,
  "in_stock": 150,
  "purchase_orders_qty": 50,
  "last_7_days_sales": 12,
  "last_30_days_sales": 45,
  "last_90_days_sales": 120,
  "last_180_days_sales": 250,
  "last_365_days_sales": 500,
  "total_sales": 1200,
  "replenishment": 25,
  "to_order": 30,
  "minimum_stock": 20,
  "lead_time": 14,
  "oos": 5,
  "oos_last_60_days": 8,
  "forecasted_lost_revenue_lead_time": 450.00,
  "orders_by_month": {
    "2024": { "1": 10, "2": 12, "3": 15, ... },
    "2025": { "1": 20, "2": 18, ... }
  },
  "forecast_by_period": {
    "2024": { "1": 11, "2": 13, "3": 14, ... },
    "2025": { "1": 22, "2": 19, ... }
  }
}
```

---

## 4. Database Schema

### 4.1 `variants` Table
Primary table storing all product/SKU data.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key (from Inventory Planner) |
| `sku` | text | Stock Keeping Unit (unique identifier) |
| `title` | text | Product name |
| `barcode` | text | Product barcode |
| `brand` | text | Brand name |
| `product_type` | text | Product category |
| `image` | text | Image URL |
| `price` | numeric | Selling price |
| `cost_price` | numeric | Cost/purchase price |
| `in_stock` | integer | Current inventory quantity |
| `purchase_orders_qty` | integer | Quantity on order |
| `last_7_days_sales` | integer | Sales in last 7 days |
| `last_30_days_sales` | integer | Sales in last 30 days |
| `last_90_days_sales` | integer | Sales in last 90 days |
| `last_180_days_sales` | integer | Sales in last 180 days |
| `last_365_days_sales` | integer | Sales in last 365 days |
| `total_sales` | integer | All-time sales |
| `orders_by_month` | jsonb | Monthly sales history `{year: {month: qty}}` |
| `forecast_by_period` | jsonb | Monthly forecast data `{year: {month: qty}}` |
| `forecasted_stock` | numeric | Projected future stock |
| `current_forecast` | numeric | Current period forecast |
| `replenishment` | integer | Units needed to reach optimal stock |
| `to_order` | integer | Recommended order quantity |
| `minimum_stock` | integer | Minimum stock threshold |
| `lead_time` | integer | Supplier lead time in days |
| `oos` | integer | **Days** item has been out of stock |
| `oos_last_60_days` | integer | OOS days in last 60 days |
| `forecasted_lost_revenue` | numeric | Estimated lost sales revenue |
| `raw_data` | jsonb | Original JSON from Inventory Planner |
| `synced_at` | timestamp | Last sync timestamp |
| `created_at` | timestamp | Record creation time |
| `updated_at` | timestamp | Last update time |

### 4.2 `forecast_metrics` Table
Stores calculated forecast accuracy metrics per SKU.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `variant_id` | uuid | Foreign key to variants |
| `sku` | text | SKU for reference |
| `period_start` | date | Calculation period start |
| `period_end` | date | Calculation period end |
| `mape` | numeric | Mean Absolute Percentage Error |
| `wape` | numeric | Weighted Absolute Percentage Error |
| `rmse` | numeric | Root Mean Square Error |
| `wase` | numeric | Weighted Absolute Scaled Error |
| `bias` | numeric | Forecast bias |
| `naive_mape` | numeric | MAPE of naive forecast (benchmark) |
| `actual_values` | jsonb | Array of actual sales values |
| `forecast_values` | jsonb | Array of forecast values |
| `calculated_at` | timestamp | When metrics were calculated |

### 4.3 `business_summary` Table
Daily snapshot of key business metrics.

| Column | Type | Description |
|--------|------|-------------|
| `id` | text | Primary key (e.g., 'current') |
| `snapshot_date` | date | Date of snapshot |
| `total_skus` | integer | Total number of SKUs |
| `total_in_stock` | integer | Sum of all inventory |
| `total_value` | numeric | Total inventory value (cost) |
| `items_needing_reorder` | integer | SKUs with replenishment > 0 |
| `items_overstocked` | integer | SKUs with excess stock |
| `items_out_of_stock` | integer | SKUs with in_stock <= 0 |
| `avg_forecast_accuracy` | numeric | Average accuracy (100 - MAPE) |
| `total_lost_revenue` | numeric | Sum of all lost revenue |
| `top_priority_items` | jsonb | Top items needing attention |

### 4.4 `sync_metrics` Table
Tracks data synchronization history.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `sync_type` | text | Source: 'webhook', 'file_upload', 'api' |
| `started_at` | timestamp | Sync start time |
| `completed_at` | timestamp | Sync completion time |
| `records_fetched` | integer | Records received |
| `records_updated` | integer | Records successfully imported |
| `duration_ms` | integer | Total duration in milliseconds |
| `status` | text | 'running', 'completed', 'failed' |
| `error_message` | text | Error details if failed |

### 4.5 `profiles` Table
User authentication profiles (via Supabase Auth).

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | User ID from Supabase Auth |
| `email` | text | User email |
| `full_name` | text | Display name |
| `created_at` | timestamp | Account creation time |

---

## 5. Pages and Their Roles

### 5.1 Dashboard (`/`)
**Role**: Executive overview of inventory health and key metrics.

**Features**:
- **KPI Cards**: Total SKUs, Inventory Value, Needs Reorder, Forecast Accuracy
- **Sparkline Trends**: 14-day historical trend for each KPI
- **Inventory Overview Chart**: Pie chart showing Healthy/Needs Reorder/Out of Stock distribution
- **Forecast Accuracy Chart**: Bar chart showing MAPE distribution (Excellent/Good/Acceptable/Poor/Very Poor)
- **Priority Tables**: Top 10 items needing reorder + Top 10 OOS items

**Data Sources**:
- `getInventoryStats()` - Stats from variants table
- `getAverageAccuracy()` - Average MAPE from forecast_metrics
- `getSummaryHistory()` - 14-day trend from business_summary
- `getTopPriorityItems()` - Top replenishment items
- `getOutOfStockItems()` - Items with in_stock <= 0

### 5.2 Inventory (`/inventory`)
**Role**: Full product listing with filtering, search, and export.

**Features**:
- **Data Table**: All SKUs with sortable columns
- **Filters**: Search, Brand, Product Type, Stock Status
- **Sales Sparklines**: Visual trend indicator per row
- **Stock Status Badges**: Oversold/OOS/Reorder/In Stock
- **CSV Export**: Export filtered data
- **Pagination**: 50 items per page

**Columns Displayed**:
- SKU, Product Title, In Stock, Reorder Qty, Status, Trend, Value

**Click Action**: Navigate to SKU Detail page

### 5.3 SKU Detail (`/inventory/[sku]`)
**Role**: Deep dive into a single product's data and metrics.

**Features**:
- **Key Metrics Grid**: In Stock, 30-Day Sales, Reorder Qty, Inventory Value
- **Sales History Chart**: Bar chart of last 12 months
- **Product Details**: SKU, Barcode, Price, Cost, Lead Time, Min Stock
- **Sales Breakdown**: 7/30/90/180/365-day and all-time sales
- **Forecast Accuracy**: MAPE, WAPE, RMSE, Bias for this SKU
- **Lost Revenue Alert**: Warning if OOS with revenue impact
- **Raw JSON Inspector**: View original data from Inventory Planner

### 5.4 Forecasts (`/forecasts`)
**Role**: Forecast accuracy analysis and insights.

**Tabs**:

#### Overview Tab
- **Executive Summary**: Overall accuracy assessment and recommendations
- **5 Metrics Grid**: MAPE, WAPE, RMSE, WASE, Bias averages
- **Calculation Explainer**: Click any metric to see formula
- **Distribution Chart**: How SKUs are distributed across accuracy tiers
- **Best/Worst Performers**: Top 5 most and least accurate SKUs

#### SKU Details Tab
- **SKU Metrics Browser**: Search and view metrics for any SKU
- **Actual vs Forecast Comparison**: Period-by-period breakdown

#### Admin Tab
- **Data Quality Checks**: SKUs with metrics, completeness status
- **Interpretation Guide**: How to read and act on metrics
- **Formula Reference**: All metric formulas with explanations

### 5.5 Admin (`/admin`)
**Role**: Data inspection, debugging, and system health monitoring.

**Tabs**:

#### Overview Tab
- **Data Quality Score**: Field completeness percentage
- **SKUs with Metrics**: Count of calculated metrics
- **Missing Cost Data**: Alert for pricing issues
- **Last Sync Status**: When data was last updated
- **Issues Panel**: Active data problems requiring attention

#### Data Quality Tab
- **Field Completeness Bars**: Visual progress for each field
- **Stock Status Distribution**: Negative/Zero/Positive counts

#### Calculation Debugger Tab
- **SKU Search**: Debug specific SKU's calculations
- **Actual vs Forecast Table**: Side-by-side comparison
- **Period-by-Period Error**: Error and % Error for each period
- **Raw Data Preview**: orders_by_month and forecast_by_period JSON

#### JSON Inspector Tab
- **Field Name Check**: Verify cost field mapping
- **All Fields Table**: Every field from raw JSON
- **Full Raw JSON**: Complete original data

#### Sync History Tab
- **Sync Records Table**: All import/sync operations
- **Status/Duration/Records**: Details for each sync

### 5.6 SKU Inspector (`/admin/inspector`)
**Role**: Compare database data with live Inventory Planner API.

**Features**:
- **Side-by-Side Comparison**: Database vs API values
- **Field-by-Field Match Status**: Highlight differences
- **Mismatch Counter**: Count of differing fields
- **Severity Indicators**: Critical vs minor differences
- **Field Discovery**: List all available IP fields

---

## 6. Metrics and Calculations

### 6.1 Forecast Accuracy Metrics

All metrics are calculated by comparing **actual sales** (`orders_by_month`) with **forecasted sales** (`forecast_by_period`). The app uses actual forecast data from Inventory Planner when available, otherwise falls back to a naive forecast.

#### MAPE - Mean Absolute Percentage Error
```
Formula: (1/n) * Σ|actual - forecast| / actual * 100

Interpretation:
- < 10%: Excellent
- 10-20%: Good
- 20-30%: Acceptable
- 30-50%: Poor
- > 50%: Very Poor

Limitation: Undefined when actual = 0
```

**Code**: `src/lib/utils/calculate-metrics.ts:22-37`

#### WAPE - Weighted Absolute Percentage Error
```
Formula: Σ|actual - forecast| / Σ actual * 100

Use Case: Better than MAPE when SKU volumes vary significantly
High-volume items weighted more heavily
```

**Code**: `src/lib/utils/calculate-metrics.ts:47-59`

#### RMSE - Root Mean Square Error
```
Formula: √[(1/n) * Σ(actual - forecast)²]

Use Case: Penalizes large errors heavily
Good when big misses are much worse than small ones
Units: Same as sales (not percentage)
```

**Code**: `src/lib/utils/calculate-metrics.ts:69-78`

#### WASE - Weighted Absolute Scaled Error
```
Formula: Σ|actual - forecast| / Σ|actual_t - actual_{t-1}|

Interpretation:
- < 1.0: Better than naive forecast
- = 1.0: Same as naive forecast
- > 1.0: Worse than naive forecast

Use Case: Compare forecast quality across different SKUs fairly
```

**Code**: `src/lib/utils/calculate-metrics.ts:88-105`

#### Bias - Forecast Bias
```
Formula: (1/n) * Σ(forecast - actual)

Interpretation:
- Positive: Over-forecasting (forecasts too high)
- Negative: Under-forecasting (forecasts too low)
- Near 0: Balanced forecasting
```

**Code**: `src/lib/utils/calculate-metrics.ts:115-120`

#### Naive Benchmark
```
Formula: Next period forecast = Previous period actual

Purpose: Baseline comparison - if your model can't beat this,
it's not adding value. Compare model MAPE vs Naive MAPE.
```

### 6.2 Inventory Status Definitions

| Status | Condition | Description |
|--------|-----------|-------------|
| **Out of Stock** | `in_stock <= 0` | Currently zero or negative inventory |
| **Needs Reorder** | `replenishment > 0` | Below optimal stock level |
| **Oversold** | `in_stock < 0` | Negative inventory (backorder) |
| **OOS Days** | `oos` field | Days item has been out of stock (from IP) |
| **Healthy** | `in_stock > 0 AND replenishment = 0` | Adequate stock |

### 6.3 Metric Calculation Process

**Location**: `src/app/api/sync/webhook/route.ts:219-343`

```
1. Fetch variants with orders_by_month
2. For each variant:
   a. Parse orders_by_month JSON -> actual sales array
   b. Parse forecast_by_period JSON -> forecast array
   c. Align periods (match forecast to actual by year-month)
   d. If no forecast data, use naive forecast as fallback
   e. Calculate all 5 metrics
   f. Calculate naive MAPE for benchmarking
3. Upsert to forecast_metrics table
4. Return count of calculated metrics
```

---

## 7. Field Mappings

### 7.1 Direct Mappings (Same Field Name)

| Inventory Planner Field | Database Column |
|------------------------|-----------------|
| `id` | `id` |
| `sku` | `sku` |
| `title` | `title` |
| `barcode` | `barcode` |
| `brand` | `brand` |
| `product_type` | `product_type` |
| `image` | `image` |
| `price` | `price` |
| `in_stock` | `in_stock` |
| `purchase_orders_qty` | `purchase_orders_qty` |
| `last_7_days_sales` | `last_7_days_sales` |
| `last_30_days_sales` | `last_30_days_sales` |
| `last_90_days_sales` | `last_90_days_sales` |
| `last_180_days_sales` | `last_180_days_sales` |
| `last_365_days_sales` | `last_365_days_sales` |
| `total_sales` | `total_sales` |
| `replenishment` | `replenishment` |
| `to_order` | `to_order` |
| `minimum_stock` | `minimum_stock` |
| `lead_time` | `lead_time` |
| `oos` | `oos` |
| `oos_last_60_days` | `oos_last_60_days` |
| `orders_by_month` | `orders_by_month` |
| `forecast_by_period` | `forecast_by_period` |
| `forecasted_stock` | `forecasted_stock` |
| `current_forecast` | `current_forecast` |

### 7.2 Mapped Fields (Different Names)

| Inventory Planner Field | Database Column | Notes |
|------------------------|-----------------|-------|
| `cost_price` OR `cost` OR `unit_cost` OR `average_cost` OR `cogs` | `cost_price` | Checked in priority order |
| `forecasted_lost_revenue_lead_time` | `forecasted_lost_revenue` | Renamed for clarity |

### 7.3 Special JSON Fields

#### `orders_by_month`
```json
{
  "2024": {
    "1": 10,   // January 2024: 10 units sold
    "2": 12,   // February 2024: 12 units sold
    "3": 15
  },
  "2025": {
    "1": 20,
    "2": 18
  }
}
```

#### `forecast_by_period`
```json
{
  "2024": {
    "1": 11,   // January 2024 forecast: 11 units
    "2": 13,
    "3": 14
  },
  "2025": {
    "1": 22,
    "2": 19
  }
}
```

---

## 8. API Endpoints

### 8.1 Data Import Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/sync/webhook` | Receive data from n8n workflow |
| POST | `/api/upload/json` | Direct JSON file upload |
| POST | `/api/sync/inventory-planner` | Sync from IP API directly |
| POST | `/api/sync` | Trigger sync (legacy) |
| GET | `/api/sync/status` | Get current sync status |

### 8.2 Data Query Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/inventory` | List variants with pagination/filtering |
| GET | `/api/inventory/[sku]` | Get single variant by SKU |
| GET | `/api/inventory/priorities` | Get priority items |
| GET | `/api/forecasts` | Get forecast metrics overview |
| GET | `/api/forecasts/[sku]` | Get forecast metrics for SKU |
| GET | `/api/dashboard/summary` | Dashboard summary data |

### 8.3 Filter Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/filters/brands` | List unique brands |
| GET | `/api/filters/product-types` | List unique product types |

### 8.4 Admin/Debug Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/admin/sync-history` | Get sync records |
| GET | `/api/admin/data-quality` | Get data quality stats |
| GET | `/api/admin/variants-debug` | Debug variant data |
| GET | `/api/admin/fetch-ip-variant` | Fetch from IP API directly |
| GET | `/api/debug/data-audit` | Compare definitions and stats |
| GET | `/api/health` | System health check |

---

## 9. Debugging Tools

### 9.1 Data Audit Endpoint
**URL**: `GET /api/debug/data-audit`

Returns:
- Count by different OOS definitions
- Field completeness statistics
- Sample items with raw vs stored values
- Field mapping documentation

### 9.2 SKU Inspector Page
**URL**: `/admin/inspector`

Compare database record with live Inventory Planner API:
- Field-by-field comparison
- Mismatch highlighting
- All available IP fields
- Raw JSON inspection

### 9.3 Admin Calculation Debugger
**URL**: `/admin` (Calculator tab)

Debug forecast calculations:
- Actual vs Forecast arrays
- Per-period error calculation
- MAPE verification
- Source JSON inspection

### 9.4 Common Issues Checklist

1. **Missing Cost Data**
   - Check JSON for `cost_price`, `cost`, `unit_cost`, `average_cost`, `cogs`
   - Use Admin > JSON Inspector to find correct field name

2. **Missing Forecast Metrics**
   - Requires `orders_by_month` with at least 6 periods
   - Requires non-zero sales data
   - Check if `forecast_by_period` is being exported

3. **Data Discrepancies**
   - Use `/api/debug/data-audit` to compare definitions
   - Use SKU Inspector to compare with live API

4. **Sync Failures**
   - Check Admin > Sync History for error messages
   - Verify `N8N_WEBHOOK_SECRET` is set correctly
   - Check Supabase service role key permissions

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2024-12 | 1.0 | Initial documentation |

---

*Document generated from codebase analysis. All implementations reference actual source files in the repository.*
