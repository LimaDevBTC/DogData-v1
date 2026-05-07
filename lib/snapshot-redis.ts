/**
 * Reads the live holders/UTXO snapshot from Upstash Redis.
 *
 * Producer: scripts/collect_metrics_history.ts (writes `dog:snapshot:latest`
 * after each automated_update.py run, ~minute :35 of each hour). The payload
 * mirrors the parts of dog_holders.json that file-bound API routes consume,
 * letting them serve fresh data without waiting for a Vercel deploy.
 *
 * If the key is missing / Redis is down, callers must fall back to the
 * bundled file (public/data/dog_holders.json).
 */

import { redisClient } from './upstash'

export interface UtxoAgeStats {
  total_supply?: number
  avg_age_days?: number
  median_age_days?: number
  sth_supply?: number
  lth_supply?: number
  sth_percentage?: number
  lth_percentage?: number
  age_distribution?: Record<string, number>
  size_distribution?: Record<string, { count: number; supply: number; percentage: number }>
  realized_cap?: number
  market_cap?: number
  mvrv_ratio?: number
  current_price?: number
  supply_in_profit?: number
  supply_in_loss?: number
  supply_in_profit_pct?: number
  supply_in_loss_pct?: number
}

export interface Top10Holder {
  rank: number
  address: string
  total_amount: number
  total_dog: number
  utxo_count?: number
}

export interface LiveSnapshot {
  timestamp: string
  published_at: string
  total_holders: number
  total_utxos: number
  circulating_supply: number
  burned: number
  burned_pct: number
  top10_holders: Top10Holder[]
  utxo_age_stats: UtxoAgeStats
  gini_coefficient: number
  top10_supply_pct: number
  top100_supply_pct: number
  top1000_supply_pct: number
}

let cached: { snap: LiveSnapshot; fetchedAt: number } | null = null
const CACHE_MS = 30_000 // 30s — snapshotter runs hourly; short cache cuts redis hops

const SNAPSHOT_KEY = 'dog:snapshot:latest'

export async function getLiveSnapshot(): Promise<LiveSnapshot | null> {
  const now = Date.now()
  if (cached && now - cached.fetchedAt < CACHE_MS) return cached.snap

  try {
    const raw = await redisClient.get(SNAPSHOT_KEY)
    if (!raw) return null
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : (raw as LiveSnapshot)
    cached = { snap: parsed, fetchedAt: now }
    return parsed
  } catch (err) {
    console.error('[snapshot-redis] read failed:', err)
    return null
  }
}
