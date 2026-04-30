-- Migration: system_health_log — passive uptime/health log
-- Run in Supabase SQL Editor.
--
-- Each row is a single observation of a component (cron job, external API,
-- infra dependency). The /status page reads from here to compute 30/90-day
-- uptime per component and render the latest state.

CREATE TABLE IF NOT EXISTS system_health_log (
  id              BIGSERIAL PRIMARY KEY,
  component       TEXT NOT NULL,        -- e.g. 'cron:update-transactions', 'external:xverse', 'infra:redis'
  component_type  TEXT NOT NULL,        -- 'cron' | 'external_api' | 'infra' | 'data_source'
  status          TEXT NOT NULL,        -- 'ok' | 'degraded' | 'down'
  latency_ms      INTEGER,
  http_status     INTEGER,
  error_message   TEXT,
  metadata        JSONB,
  checked_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_health_component_time
  ON system_health_log (component, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_health_time
  ON system_health_log (checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_health_type_time
  ON system_health_log (component_type, checked_at DESC);
