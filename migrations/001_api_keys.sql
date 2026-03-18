-- Create api_keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  name TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise')),
  permissions TEXT[] NOT NULL DEFAULT ARRAY['read'],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys (key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_email ON api_keys (owner_email);
CREATE INDEX IF NOT EXISTS idx_api_keys_tier ON api_keys (tier);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys (is_active);

-- Create api_usage table for tracking
CREATE TABLE IF NOT EXISTS api_usage (
  id BIGSERIAL PRIMARY KEY,
  api_key_id UUID REFERENCES api_keys(id),
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'GET',
  status_code INT,
  response_time_ms INT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT
);

-- Index for usage queries
CREATE INDEX IF NOT EXISTS idx_api_usage_key_time ON api_usage (api_key_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_api_usage_endpoint ON api_usage (endpoint, timestamp);

-- Row Level Security
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

-- Policy: service role can do everything
CREATE POLICY "Service role full access on api_keys" ON api_keys
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on api_usage" ON api_usage
  FOR ALL USING (true) WITH CHECK (true);
