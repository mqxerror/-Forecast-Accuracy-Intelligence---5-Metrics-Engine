# n8n Inventory Sync Workflow Setup

This document describes how to set up the n8n workflow for syncing data from Inventory Planner.

## Prerequisites

- n8n installed and running at http://38.97.60.181:5680
- Inventory Planner API credentials
- Next.js app deployed and accessible

## Workflow Overview

The workflow runs every 4 hours and:
1. Fetches all variants from Inventory Planner API
2. Transforms data for our database schema
3. Upserts variants to Supabase
4. Calculates forecast accuracy metrics
5. Updates business summary
6. Notifies the Next.js app via webhook

## Step-by-Step Setup

### 1. Create New Workflow

1. Open n8n at http://38.97.60.181:5680
2. Click "New Workflow"
3. Name it "Inventory Intelligence Sync"

### 2. Add Schedule Trigger

1. Add a "Schedule Trigger" node
2. Configure:
   - Trigger Interval: Hours
   - Hours Between Triggers: 4
   - Trigger at Hour: 0 (midnight)

### 3. Add Manual Trigger (for testing)

1. Add a "Webhook" node
2. Configure:
   - HTTP Method: POST
   - Path: inventory-sync
   - Authentication: Header Auth
   - Header Name: x-webhook-secret
   - Header Value: `inventory-intelligence-sync-2024`

### 4. Add HTTP Request Node (Fetch from IP)

1. Add an "HTTP Request" node
2. Configure:
   - Method: GET
   - URL: `https://app.inventory-planner.com/api/v1/variants`
   - Authentication: None (use headers)
   - Headers:
     - `Authorization`: `Bearer YOUR_IP_API_KEY`
     - `X-Account-Id`: `YOUR_IP_ACCOUNT_ID`
   - Response: JSON

### 5. Add Code Node (Transform Data)

1. Add a "Code" node
2. Paste this code:

```javascript
// Transform IP variants to our database schema
const variants = $input.all()[0].json.variants || $input.all()[0].json;

const transformedVariants = variants.map(v => ({
  id: v.id,
  sku: v.sku,
  title: v.title || null,
  barcode: v.barcode || null,
  brand: v.brand || null,
  product_type: v.product_type || null,
  image: v.image || null,
  price: v.price || null,
  cost_price: v.cost_price || null,
  in_stock: v.in_stock || 0,
  purchase_orders_qty: v.purchase_orders_qty || 0,
  last_7_days_sales: v.last_7_days_sales || 0,
  last_30_days_sales: v.last_30_days_sales || 0,
  last_90_days_sales: v.last_90_days_sales || 0,
  last_180_days_sales: v.last_180_days_sales || 0,
  last_365_days_sales: v.last_365_days_sales || 0,
  total_sales: v.total_sales || 0,
  orders_by_month: v.orders_by_month || null,
  forecast_by_period: v.forecast_by_period || null,
  forecasted_stock: v.forecasted_stock || null,
  current_forecast: v.current_forecast || null,
  replenishment: v.replenishment || 0,
  to_order: v.to_order || 0,
  minimum_stock: v.minimum_stock || null,
  lead_time: v.lead_time || null,
  oos: v.oos || 0,
  oos_last_60_days: v.oos_last_60_days || 0,
  forecasted_lost_revenue: v.forecasted_lost_revenue_lead_time || null,
  raw_data: v,
  synced_at: new Date().toISOString()
}));

return transformedVariants.map(v => ({ json: v }));
```

### 6. Add Supabase Node (Upsert Variants)

1. Add a "Supabase" node
2. Configure credentials with:
   - Host: `38.97.60.181`
   - Port: `5433`
   - Database: `postgres`
   - User: `postgres`
   - Password: `postgres123`
3. Configure operation:
   - Operation: Upsert
   - Table: `variants`
   - Conflict Column: `id`

### 7. Add Code Node (Calculate Metrics)

1. Add a "Code" node
2. Paste this code:

```javascript
// Calculate forecast accuracy metrics for each variant
const variants = $input.all().map(i => i.json);

function calculateMAPE(actual, forecast) {
  const validPairs = actual
    .map((a, i) => ({ actual: a, forecast: forecast[i] }))
    .filter(p => p.actual !== 0);

  if (validPairs.length === 0) return null;

  const sum = validPairs.reduce((acc, { actual, forecast }) => {
    return acc + Math.abs((actual - forecast) / actual);
  }, 0);

  return (sum / validPairs.length) * 100;
}

function calculateWAPE(actual, forecast) {
  const sumAbsError = actual.reduce((sum, a, i) => sum + Math.abs(a - forecast[i]), 0);
  const sumActual = actual.reduce((sum, a) => sum + a, 0);
  if (sumActual === 0) return null;
  return (sumAbsError / sumActual) * 100;
}

function calculateRMSE(actual, forecast) {
  const sumSquaredErrors = actual.reduce((sum, a, i) => sum + Math.pow(a - forecast[i], 2), 0);
  return Math.sqrt(sumSquaredErrors / actual.length);
}

function calculateBias(actual, forecast) {
  const sum = actual.reduce((acc, a, i) => acc + (forecast[i] - a), 0);
  return sum / actual.length;
}

const metrics = variants
  .filter(v => v.orders_by_month && v.forecast_by_period)
  .map(v => {
    // Extract monthly data
    const months = Object.keys(v.orders_by_month || {}).sort().slice(-12);
    const actual = months.map(m => {
      const yearData = v.orders_by_month[m] || {};
      return Object.values(yearData).reduce((sum, val) => sum + (val || 0), 0);
    });
    const forecast = months.map(m => {
      const yearData = v.forecast_by_period[m] || {};
      return Object.values(yearData).reduce((sum, val) => sum + (val || 0), 0);
    });

    if (actual.length < 3) return null;

    return {
      variant_id: v.id,
      sku: v.sku,
      mape: calculateMAPE(actual, forecast),
      wape: calculateWAPE(actual, forecast),
      rmse: calculateRMSE(actual, forecast),
      bias: calculateBias(actual, forecast),
      actual_values: actual,
      forecast_values: forecast,
      calculated_at: new Date().toISOString()
    };
  })
  .filter(m => m !== null);

return metrics.map(m => ({ json: m }));
```

### 8. Add Supabase Node (Insert Metrics)

1. Add a "Supabase" node
2. Configure:
   - Operation: Insert
   - Table: `forecast_metrics`

### 9. Add HTTP Request Node (Notify App)

1. Add an "HTTP Request" node
2. Configure:
   - Method: POST
   - URL: `YOUR_APP_URL/api/sync/webhook`
   - Headers:
     - `x-webhook-secret`: `inventory-intelligence-sync-2024`
   - Body: JSON
   ```json
   {
     "event": "sync_completed",
     "records_fetched": {{ $node["HTTP Request"].json.length }},
     "records_updated": {{ $node["Supabase"].json.length }}
   }
   ```

### 10. Add Error Handler

1. Add an "Error Trigger" node
2. Connect it to an HTTP Request that notifies of failures:
   ```json
   {
     "event": "sync_failed",
     "error_message": "{{ $execution.error.message }}"
   }
   ```

## Testing

1. Click "Execute Workflow" to test manually
2. Check Supabase to verify data was inserted
3. Check the Next.js app to see updated dashboard

## Credentials Required

Store these in n8n credentials:

1. **Inventory Planner API**
   - API Key: `[Get from IP dashboard]`
   - Account ID: `[Get from IP dashboard]`

2. **Supabase/PostgreSQL**
   - Host: `38.97.60.181`
   - Port: `5433`
   - Database: `postgres`
   - User: `postgres`
   - Password: `postgres123`

3. **Webhook Secret**
   - `inventory-intelligence-sync-2024`

## Monitoring

- Check n8n execution history for failures
- Check `sync_metrics` table in database
- Dashboard shows last sync time and status
