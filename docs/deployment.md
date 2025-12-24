# Deployment Guide

## Prerequisites

- Docker installed
- Access to Dokploy at http://38.97.60.181:3000
- Supabase running at https://sb.pixelcraftedmedia.com

## Database Setup

### Run Migrations

Connect to PostgreSQL and run the migration files:

```bash
# Connect to database
psql postgresql://postgres:postgres123@38.97.60.181:5433/postgres

# Run migrations in order
\i supabase/migrations/001_initial_schema.sql
\i supabase/migrations/002_forecast_metrics.sql
\i supabase/migrations/003_business_summary.sql
\i supabase/migrations/004_sync_metrics.sql
\i supabase/migrations/005_auth_profiles.sql
```

Or use a single command:

```bash
cat supabase/migrations/*.sql | psql postgresql://postgres:postgres123@38.97.60.181:5433/postgres
```

### Get Supabase Keys

1. Go to Supabase Studio at http://38.97.60.181:3002
2. Navigate to Settings > API
3. Copy:
   - `anon` key (for `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   - `service_role` key (for `SUPABASE_SERVICE_ROLE_KEY`)

### Create First User

In Supabase Studio:
1. Go to Authentication > Users
2. Click "Add User"
3. Enter email and password
4. Click "Create User"

## Deploy to Dokploy

### 1. Create Application

1. Open Dokploy at http://38.97.60.181:3000
2. Click "Create Application"
3. Name: `inventory-intelligence`
4. Source: Git or Upload

### 2. Configure Build

If using Git:
- Repository URL: Your git repo
- Branch: main
- Build Pack: Dockerfile

If uploading:
- Zip the project folder
- Upload via Dokploy UI

### 3. Set Environment Variables

In Dokploy, add these environment variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://sb.pixelcraftedmedia.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
DATABASE_URL=postgresql://postgres:postgres123@38.97.60.181:5433/postgres
IP_API_URL=https://app.inventory-planner.com/api/v1
IP_API_KEY=your-ip-api-key
IP_ACCOUNT_ID=your-ip-account-id
N8N_WEBHOOK_SECRET=inventory-intelligence-sync-2024
```

### 4. Configure Port

- Container Port: 5050
- Public Port: 5050

### 5. Deploy

Click "Deploy" and wait for the build to complete.

## Local Development

### Setup

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local

# Edit .env.local with your credentials
```

### Run Migrations

```bash
# Run all migrations
cat supabase/migrations/*.sql | psql $DATABASE_URL
```

### Start Development Server

```bash
npm run dev
```

Open http://localhost:5050

## Docker Build (Local)

```bash
# Build image
docker build -t inventory-intelligence .

# Run container
docker run -p 5050:5050 \
  -e NEXT_PUBLIC_SUPABASE_URL=https://sb.pixelcraftedmedia.com \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \
  -e SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
  inventory-intelligence
```

## Post-Deployment Checklist

- [ ] Verify app is accessible at deployed URL
- [ ] Test login with created user
- [ ] Verify database connection (dashboard loads)
- [ ] Set up n8n workflow (see n8n-workflow-setup.md)
- [ ] Run initial sync
- [ ] Verify data appears in dashboard

## Troubleshooting

### App won't start

Check logs in Dokploy. Common issues:
- Missing environment variables
- Database connection refused (check firewall)
- Wrong Supabase keys

### Auth not working

- Verify Supabase URL is correct (https://sb.pixelcraftedmedia.com)
- Check that anon key matches
- Ensure user exists in Supabase Auth

### No data showing

- Run n8n sync workflow
- Check sync_metrics table for errors
- Verify IP API credentials

### Sync failing

- Check n8n workflow logs
- Verify IP API key is valid
- Check database connectivity from n8n
