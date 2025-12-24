# n8n Integration Setup Guide

## Quick Start

This guide helps you connect n8n to Inventory Intelligence for automatic data syncing from Inventory Planner.

**New in v2:** Real-time progress tracking, chunked uploads for large inventories, and detailed sync history.

---

## Step 1: Configure Environment Variables

Add these to your n8n environment:

```bash
# Your Inventory Intelligence app URL (no trailing slash)
INVENTORY_INTELLIGENCE_URL=https://your-app-domain.com

# Webhook secret (must match your app's .env.local)
N8N_WEBHOOK_SECRET=your-secure-secret-here
```

In your Inventory Intelligence app's `.env.local`:

```bash
N8N_WEBHOOK_SECRET=your-secure-secret-here
```

---

## Step 2: Create Inventory Planner API Credential

1. In n8n, go to **Credentials** → **Add Credential**
2. Select **Header Auth**
3. Configure:
   - **Name**: `Inventory Planner API Key`
   - **Header Name**: `Authorization`
   - **Header Value**: `YOUR_INVENTORY_PLANNER_API_KEY`

Get your API key from: Inventory Planner → Settings → API

---

## Step 3: Choose Your Sync Mode

### Mode A: Single-Shot (Simple, <2000 SKUs)

Best for smaller inventories. Sends all data in one request.

### Mode B: Chunked Upload (Recommended, 2000+ SKUs)

Best for large inventories. Features:
- Resume capability if interrupted
- Real-time progress tracking
- Detailed error logging per chunk
- Prevents timeout issues

---

## Mode A: Single-Shot Setup

### HTTP Request Configuration

| Field | Value |
|-------|-------|
| **Method** | POST |
| **URL** | `{{ $env.INVENTORY_INTELLIGENCE_URL }}/api/sync/webhook` |
| **Authentication** | None |

### Headers

| Header | Value |
|--------|-------|
| `Content-Type` | `application/json` |
| `x-webhook-secret` | `{{ $env.N8N_WEBHOOK_SECRET }}` |

### Body (JSON)

Send raw Inventory Planner API response:

```json
={{ $json }}
```

Or wrapped format:

```json
{
  "event": "import_variants",
  "variants": {{ $json.variants || $json }}
}
```

### Expected Response

```json
{
  "success": true,
  "stats": {
    "received": 1250,
    "imported": 1248,
    "rejected": 2,
    "warnings": 15,
    "metricsCalculated": 1100
  },
  "sessionId": "uuid-here"
}
```

---

## Mode B: Chunked Upload Setup (Recommended)

### Workflow Overview

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│ Fetch from IP   │ ──▶ │ Create       │ ──▶ │ Split into      │
│ (HTTP Request)  │     │ Session      │     │ Chunks          │
└─────────────────┘     └──────────────┘     └─────────────────┘
                                                      │
                                                      ▼
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│ Complete        │ ◀── │ Send Each    │ ◀── │ Loop through    │
│ Session         │     │ Chunk        │     │ Chunks          │
└─────────────────┘     └──────────────┘     └─────────────────┘
```

### Step 1: Fetch Data from Inventory Planner

**HTTP Request Node:**
- Method: GET
- URL: `https://app.inventory-planner.com/api/v1/variants`
- Add query params: `limit=10000`, `include=orders_by_month,forecast_by_period`

### Step 2: Create Sync Session

**HTTP Request Node:**
- Method: POST
- URL: `{{ $env.INVENTORY_INTELLIGENCE_URL }}/api/sync/sessions`

Headers:
```
Content-Type: application/json
x-webhook-secret: {{ $env.N8N_WEBHOOK_SECRET }}
```

Body:
```json
{
  "source": "n8n",
  "totalChunks": {{ Math.ceil($json.length / 1000) }},
  "totalRecords": {{ $json.length }},
  "metadata": {
    "workflow": "inventory-sync",
    "startedBy": "scheduled"
  }
}
```

Response will contain:
```json
{
  "session": {
    "id": "uuid-here",
    "session_token": "token-here",
    "status": "pending"
  }
}
```

### Step 3: Split Data into Chunks

**Code Node:**
```javascript
const chunkSize = 1000;
const variants = $input.first().json;
const chunks = [];

for (let i = 0; i < variants.length; i += chunkSize) {
  chunks.push({
    index: Math.floor(i / chunkSize),
    data: variants.slice(i, i + chunkSize)
  });
}

return chunks.map(chunk => ({ json: chunk }));
```

### Step 4: Send Each Chunk

**HTTP Request Node (in Loop):**
- Method: POST
- URL: `{{ $env.INVENTORY_INTELLIGENCE_URL }}/api/sync/webhook`

Headers:
```
Content-Type: application/json
x-webhook-secret: {{ $env.N8N_WEBHOOK_SECRET }}
x-sync-session-id: {{ $('Create Session').item.json.session.id }}
x-chunk-index: {{ $json.index }}
x-total-chunks: {{ Math.ceil($('Fetch Variants').item.json.length / 1000) }}
```

Body:
```json
={{ $json.data }}
```

### Step 5: Handle Failures (Optional)

If a chunk fails, you can resume:

**HTTP Request Node:**
- Method: POST
- URL: `{{ $env.INVENTORY_INTELLIGENCE_URL }}/api/sync/sessions/{{ sessionId }}/resume`

Response includes missing chunks to retry:
```json
{
  "session": { ... },
  "missingChunks": [2, 5, 7]
}
```

---

## API Endpoints Reference

### Session Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sync/sessions` | Create new sync session |
| GET | `/api/sync/sessions` | List recent sessions |
| GET | `/api/sync/sessions/[id]` | Get session details |
| PATCH | `/api/sync/sessions/[id]` | Update session (pause/cancel) |
| POST | `/api/sync/sessions/[id]/resume` | Resume failed session |

### Webhook (Data Import)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sync/webhook` | Import variants (single or chunked) |

**Headers for Chunked Mode:**

| Header | Required | Description |
|--------|----------|-------------|
| `x-webhook-secret` | Yes | Authentication secret |
| `x-sync-session-id` | For chunks | Session ID from create |
| `x-chunk-index` | For chunks | 0-based chunk number |
| `x-total-chunks` | Optional | Total chunks expected |

### Progress & History

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sync/progress` | Current sync progress (for polling) |
| GET | `/api/sync/history` | Paginated sync history |
| GET | `/api/sync/history/[id]/errors` | Errors for a specific sync |

---

## Real-Time Progress Tracking

The app provides real-time progress updates via Supabase Realtime.

### Progress Response Structure

```json
{
  "status": "syncing",
  "sessionId": "uuid",
  "recordsProcessed": 2500,
  "totalRecords": 5000,
  "percentage": 50,
  "currentBatch": 5,
  "totalBatches": 10,
  "errorsCount": 2,
  "message": "Processing batch 5 of 10...",
  "estimatedCompletion": "2024-01-15T10:35:00Z",
  "timeRemaining": "2m 30s"
}
```

### Status Values

| Status | Description |
|--------|-------------|
| `idle` | No sync in progress |
| `syncing` | Currently importing data |
| `processing` | Processing metrics |
| `completed` | Sync finished successfully |
| `failed` | Sync failed with error |

---

## Sync History

### GET /api/sync/history

Query parameters:
- `limit` (default: 20)
- `offset` (default: 0)
- `status` (filter by status)

Response:
```json
{
  "history": [
    {
      "id": "uuid",
      "type": "session",
      "source": "n8n",
      "status": "completed",
      "recordsFetched": 5000,
      "recordsUpdated": 4998,
      "recordsFailed": 2,
      "startedAt": "2024-01-15T10:00:00Z",
      "completedAt": "2024-01-15T10:05:00Z",
      "chunksReceived": 5,
      "totalChunks": 5
    }
  ],
  "total": 50,
  "hasMore": true
}
```

### GET /api/sync/history/[id]/errors

Query parameters:
- `limit` (default: 50)
- `offset` (default: 0)
- `errorType` (validation, transform, database)

Response:
```json
{
  "errors": [
    {
      "id": "uuid",
      "sku": "SKU-001",
      "errorType": "validation",
      "errorMessage": "Invalid stock value: -5",
      "fieldName": "in_stock",
      "createdAt": "2024-01-15T10:02:00Z"
    }
  ],
  "total": 2,
  "summary": {
    "validation": 1,
    "transform": 0,
    "database": 1,
    "unknown": 0
  }
}
```

---

## Complete n8n Workflow JSON

### Single-Shot Mode

```json
{
  "name": "Inventory Sync - Single Shot",
  "nodes": [
    {
      "name": "Schedule",
      "type": "n8n-nodes-base.scheduleTrigger",
      "position": [250, 300],
      "parameters": {
        "rule": {
          "interval": [{ "field": "hours", "hoursInterval": 6 }]
        }
      }
    },
    {
      "name": "Fetch Variants",
      "type": "n8n-nodes-base.httpRequest",
      "position": [450, 300],
      "parameters": {
        "method": "GET",
        "url": "https://app.inventory-planner.com/api/v1/variants",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "options": {
          "timeout": 120000
        }
      }
    },
    {
      "name": "Send to App",
      "type": "n8n-nodes-base.httpRequest",
      "position": [650, 300],
      "parameters": {
        "method": "POST",
        "url": "={{ $env.INVENTORY_INTELLIGENCE_URL }}/api/sync/webhook",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            { "name": "Content-Type", "value": "application/json" },
            { "name": "x-webhook-secret", "value": "={{ $env.N8N_WEBHOOK_SECRET }}" }
          ]
        },
        "sendBody": true,
        "bodyParameters": {
          "parameters": []
        },
        "jsonBody": "={{ JSON.stringify($json) }}",
        "options": {
          "timeout": 300000
        }
      }
    }
  ],
  "connections": {
    "Schedule": { "main": [[{ "node": "Fetch Variants", "type": "main", "index": 0 }]] },
    "Fetch Variants": { "main": [[{ "node": "Send to App", "type": "main", "index": 0 }]] }
  }
}
```

---

## Troubleshooting

### 401 Unauthorized
- Check `x-webhook-secret` header matches `N8N_WEBHOOK_SECRET` in app
- Ensure header name is exactly `x-webhook-secret` (lowercase)

### 400 Bad Request - No variants provided
- Check the request body structure
- Ensure body contains array of variants (raw or wrapped)
- Supported formats: `[...]`, `{ variants: [...] }`, `{ data: [...] }`

### Timeout Errors
- Use chunked mode for large inventories (2000+ SKUs)
- Increase timeout in HTTP Request node (Options → Timeout → 300000)
- Split into 1000 records per chunk

### Chunk Failed
- Check session status at `/api/sync/sessions/[id]`
- Resume with `/api/sync/sessions/[id]/resume`
- Retry only the missing chunks

### Missing Cost Data
- Inventory Planner may use different field names
- The app auto-detects: `cost`, `cost_price`, `unit_cost`, `average_cost`
- Check API response to verify field names

---

## Recommended Settings

| Inventory Size | Sync Mode | Chunk Size | Frequency |
|---------------|-----------|------------|-----------|
| < 500 SKUs | Single-shot | N/A | Every 4 hours |
| 500-2000 SKUs | Single-shot | N/A | Every 6 hours |
| 2000-5000 SKUs | Chunked | 1000 | Every 6 hours |
| 5000+ SKUs | Chunked | 1000 | Every 12 hours |

---

## Your Endpoints

Based on your setup:

- **n8n Base URL:** `https://automator.pixelcraftedmedia.com`
- **App Webhook:** `https://your-inventory-intelligence-app.com/api/sync/webhook`
- **Create Session:** `https://your-inventory-intelligence-app.com/api/sync/sessions`
- **Check Progress:** `https://your-inventory-intelligence-app.com/api/sync/progress`
- **View History:** `https://your-inventory-intelligence-app.com/api/sync/history`
