/**
 * Stacks metrics history — Supabase persistence.
 *
 * Captures periodic snapshots of Stacks DOG metrics so that agents
 * can query trends (e.g. "holder count over 30 days").
 *
 * Table: stacks_metrics_history (create via migration below)
 *
 * -- SQL migration (run once in Supabase SQL editor) --
 *
 * CREATE TABLE IF NOT EXISTS stacks_metrics_history (
 *   id            BIGSERIAL PRIMARY KEY,
 *   snapshot_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
 *   holder_count  INTEGER,
 *   price_usd     DOUBLE PRECISION,
 *   market_cap_usd DOUBLE PRECISION,
 *   volume_24h_usd DOUBLE PRECISION,
 *   liquidity_usd  DOUBLE PRECISION,
 *   circulating_supply DOUBLE PRECISION,
 *   top_10_pct    DOUBLE PRECISION,
 *   top_25_pct    DOUBLE PRECISION,
 *   top_50_pct    DOUBLE PRECISION,
 *   whale_wallets INTEGER,
 *   active_1w     INTEGER,
 *   fresh_1w      INTEGER,
 *   source        TEXT DEFAULT 'tenero'
 * );
 *
 * CREATE INDEX idx_stacks_metrics_snapshot ON stacks_metrics_history (snapshot_at DESC);
 *
 * -- Optional: auto-cleanup older than 1 year
 * -- CREATE OR REPLACE FUNCTION cleanup_old_stacks_metrics() RETURNS trigger AS $$
 * -- BEGIN DELETE FROM stacks_metrics_history WHERE snapshot_at < now() - interval '365 days'; RETURN NULL; END;
 * -- $$ LANGUAGE plpgsql;
 */

import { createClient } from '@supabase/supabase-js'
import {
  getStacksTokenInfoResilient,
  getStacksHolderStatsResilient,
  getStacksHolderPercentagesResilient,
} from './stacks-resilient'

// Service-role for writes; anon is fine for reads. The snapshot insert
// fails the check below loudly so we don't silently fall back to anon —
// that path used to surface as a confusing RLS error from the insert.
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
)

const TABLE = 'stacks_metrics_history'

// ---------------------------------------------------------------------------
// Snapshot — called by cron endpoint
// ---------------------------------------------------------------------------

export interface StacksMetricsSnapshot {
  snapshot_at: string
  holder_count: number
  price_usd: number
  market_cap_usd: number
  volume_24h_usd: number
  liquidity_usd: number | null
  circulating_supply: number
  top_10_pct: number
  top_25_pct: number
  top_50_pct: number
  whale_wallets: number
  active_1w: number
  fresh_1w: number
  source: string
}

export async function captureStacksSnapshot(): Promise<StacksMetricsSnapshot> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is required to persist Stacks snapshots ' +
      '(RLS blocks the anon key from writing to stacks_metrics_history). ' +
      'Set it in Vercel: Settings → Environment Variables.'
    )
  }

  const [tokenInfo, holderStats, holderPct] = await Promise.all([
    getStacksTokenInfoResilient(),
    getStacksHolderStatsResilient(),
    getStacksHolderPercentagesResilient(),
  ])

  const snapshot: StacksMetricsSnapshot = {
    snapshot_at: new Date().toISOString(),
    holder_count: tokenInfo.holder_count,
    price_usd: tokenInfo.price_usd,
    market_cap_usd: tokenInfo.market_cap_usd,
    volume_24h_usd: tokenInfo.volume_24h_usd,
    liquidity_usd: tokenInfo.liquidity_usd,
    circulating_supply: tokenInfo.circulating_supply,
    top_10_pct: holderPct.top_10,
    top_25_pct: holderPct.top_25,
    top_50_pct: holderPct.top_50,
    whale_wallets: parseInt(holderStats.whale_wallets) || 0,
    active_1w: parseInt(holderStats.active_1w) || 0,
    fresh_1w: parseInt(holderStats.fresh_1w) || 0,
    source: tokenInfo.price_usd > 0 ? 'tenero' : 'hiro',
  }

  const { error } = await supabase.from(TABLE).insert(snapshot)

  if (error) {
    console.error('[stacks-history] Supabase insert error:', error.message)
    throw new Error(`Failed to persist snapshot: ${error.message}`)
  }

  return snapshot
}

// ---------------------------------------------------------------------------
// Query — used by API routes and agents
// ---------------------------------------------------------------------------

export interface StacksHistoryQuery {
  days?: number     // lookback window (default 30)
  limit?: number    // max rows (default 720 = 30 days hourly)
}

export async function getStacksMetricsHistory(opts: StacksHistoryQuery = {}) {
  const days = opts.days ?? 30
  const limit = opts.limit ?? 720
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .gte('snapshot_at', since)
    .order('snapshot_at', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('[stacks-history] Supabase query error:', error.message)
    throw new Error(`Failed to query history: ${error.message}`)
  }

  return {
    snapshots: data || [],
    count: data?.length ?? 0,
    range: { from: since, to: new Date().toISOString() },
  }
}

export async function getStacksLatestSnapshot(): Promise<StacksMetricsSnapshot | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('snapshot_at', { ascending: false })
    .limit(1)

  if (error || !data?.length) return null
  return data[0] as StacksMetricsSnapshot
}
