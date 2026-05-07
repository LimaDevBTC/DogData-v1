/**
 * Fetches the latest snapshot row from `dog_metrics_history`.
 *
 * Why: file-based metric routes (utxo, realized-cap, supply-profit-loss,
 * holder-concentration) read public/data/dog_holders.json, which is bundled
 * at deploy time. Their freshness is bounded by Vercel deploy cadence (~30
 * min average lag from the underlying snapshotter run). Supabase is written
 * directly by collect_metrics_history.ts at minute :35 of every hour, with
 * no deploy step in between — so reading from there cuts the lag by ~6×.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js'

export interface MetricsSnapshot {
  recorded_at: string
  total_utxos: number
  total_holders: number
  gini_coefficient: number
  top10_supply_pct: number
  top100_supply_pct: number
  top1000_supply_pct: number
  avg_age_days: number
  median_age_days: number
  sth_percentage: number
  lth_percentage: number
  realized_cap: number
  market_cap: number
  mvrv_ratio: number
  supply_in_profit_pct: number
  supply_in_loss_pct: number
  current_price: number
}

let cached: { snap: MetricsSnapshot; fetchedAt: number } | null = null
const CACHE_MS = 60_000 // 1 minute — snapshotter writes hourly, fast cache cuts DB load

let client: SupabaseClient | null = null
function getClient(): SupabaseClient | null {
  if (client) return client
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY
  if (!url || !key) return null
  client = createClient(url, key)
  return client
}

export async function getLatestMetricsSnapshot(): Promise<MetricsSnapshot | null> {
  const now = Date.now()
  if (cached && now - cached.fetchedAt < CACHE_MS) return cached.snap

  const sb = getClient()
  if (!sb) return null

  const { data, error } = await sb
    .from('dog_metrics_history')
    .select('*')
    .order('recorded_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return null

  cached = { snap: data as MetricsSnapshot, fetchedAt: now }
  return cached.snap
}
