-- Migration: 008_app_settings.sql
-- Purpose: Add settings table for app configuration including n8n webhook URL

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings
INSERT INTO app_settings (key, value, description)
VALUES
  ('n8n_webhook_url', '', 'n8n webhook URL to trigger inventory sync'),
  ('n8n_webhook_secret', '', 'Secret to authenticate with n8n (if required)'),
  ('sync_enabled', 'true', 'Whether automatic sync is enabled'),
  ('sync_interval_hours', '6', 'Hours between automatic syncs')
ON CONFLICT (key) DO NOTHING;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(key);
