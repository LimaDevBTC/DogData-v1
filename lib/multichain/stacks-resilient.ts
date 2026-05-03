/**
 * Resilient Stacks data layer.
 *
 * Primary (Tenero) and fallback (Hiro) data are cached under SEPARATE keys
 * with different TTLs, so a transient Tenero failure does not contaminate
 * the primary cache with degraded fallback values (Hiro lacks price/volume).
 *
 *   - Primary cache: 5 min memory / 15 min Redis
 *   - Fallback cache: 30 s memory / 60 s Redis (short — primary retried fast)
 *
 * Read order: memory primary → primary origin → memory fallback →
 *   fallback origin → Redis primary (stale) → Redis fallback (stale).
 */

import { memoryCache } from '@/lib/cache'
import { redisClient } from '@/lib/upstash'
import {
  ChainTokenInfo,
  ChainHolder,
  ChainTransaction,
} from './types'

// Tenero (primary)
import {
  getStacksTokenInfo as teneroTokenInfo,
  getStacksHolders as teneroHolders,
  getStacksHolderStats as teneroHolderStats,
  getStacksHolderPercentages as teneroHolderPercentages,
  getStacksTransactions as teneroTransactions,
} from './tenero'

// Hiro (fallback)
import {
  getHiroTokenInfo,
  getHiroHolders,
  getHiroTransactions,
} from './hiro'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MEMORY_TTL_PRIMARY = 5 * 60 * 1000     // 5 min — fresh primary
const MEMORY_TTL_FALLBACK = 30 * 1000        // 30 s — short so primary is retried quickly
const REDIS_TTL_PRIMARY_SEC = 15 * 60        // 15 min — stale-while-revalidate
const REDIS_TTL_FALLBACK_SEC = 60            // 1 min
const REDIS_PREFIX = 'stacks:'
const FALLBACK_SUFFIX = ':fb'

// ---------------------------------------------------------------------------
// Redis helpers (fail-open — never crash on Redis errors)
// ---------------------------------------------------------------------------

async function redisGet<T>(key: string): Promise<T | null> {
  try {
    const data = await redisClient.get<T>(`${REDIS_PREFIX}${key}`)
    return data ?? null
  } catch {
    return null
  }
}

async function redisSet<T>(key: string, data: T, ttlSec: number): Promise<void> {
  try {
    await redisClient.set(`${REDIS_PREFIX}${key}`, JSON.stringify(data), { ex: ttlSec })
  } catch {
    // silent — Redis is best-effort
  }
}

// ---------------------------------------------------------------------------
// Generic fetch-with-fallback wrapper
// ---------------------------------------------------------------------------

async function resilientFetch<T>(
  cacheKey: string,
  primaryFn: () => Promise<T>,
  fallbackFn: () => Promise<T>,
): Promise<T> {
  const fallbackKey = `${cacheKey}${FALLBACK_SUFFIX}`

  // 1. Memory cache (primary) — fresh primary data short-circuits everything
  const memPrimary = memoryCache.get<T>(cacheKey)
  if (memPrimary) return memPrimary

  // 2. Try primary origin (Tenero)
  try {
    const data = await primaryFn()
    memoryCache.set(cacheKey, data, MEMORY_TTL_PRIMARY)
    redisSet(cacheKey, data, REDIS_TTL_PRIMARY_SEC) // fire-and-forget
    return data
  } catch (primaryErr) {
    console.warn(`[stacks-resilient] Primary (Tenero) failed for ${cacheKey}:`, (primaryErr as Error).message)
  }

  // 3. Memory cache (fallback) — short-lived buffer to avoid hammering Hiro
  //    while Tenero is down. Short TTL (30 s) means primary recovers quickly.
  const memFallback = memoryCache.get<T>(fallbackKey)
  if (memFallback) return memFallback

  // 4. Try fallback origin (Hiro) — cached under :fb suffix, never under primary key
  try {
    const data = await fallbackFn()
    memoryCache.set(fallbackKey, data, MEMORY_TTL_FALLBACK)
    redisSet(fallbackKey, data, REDIS_TTL_FALLBACK_SEC)
    return data
  } catch (fallbackErr) {
    console.warn(`[stacks-resilient] Fallback (Hiro) failed for ${cacheKey}:`, (fallbackErr as Error).message)
  }

  // 5. Last resort — Redis stale cache (prefer primary, then fallback)
  const redisPrimary = await redisGet<T>(cacheKey)
  if (redisPrimary) {
    console.warn(`[stacks-resilient] Serving stale Redis primary for ${cacheKey}`)
    memoryCache.set(cacheKey, redisPrimary, 60_000)
    return redisPrimary
  }
  const redisFallback = await redisGet<T>(fallbackKey)
  if (redisFallback) {
    console.warn(`[stacks-resilient] Serving stale Redis fallback for ${cacheKey}`)
    memoryCache.set(fallbackKey, redisFallback, 60_000)
    return redisFallback
  }

  throw new Error(`[stacks-resilient] All data sources failed for ${cacheKey}`)
}

// ---------------------------------------------------------------------------
// Public API — drop-in replacements for direct Tenero calls
// ---------------------------------------------------------------------------

export async function getStacksTokenInfoResilient(): Promise<ChainTokenInfo> {
  return resilientFetch(
    'token_info',
    teneroTokenInfo,
    getHiroTokenInfo,
  )
}

export async function getStacksHoldersResilient(limit = 50): Promise<{
  holders: ChainHolder[]
  total_count: number
}> {
  return resilientFetch(
    `holders:${limit}`,
    () => teneroHolders(limit),
    () => getHiroHolders(limit),
  )
}

export async function getStacksHolderStatsResilient() {
  return resilientFetch(
    'holder_stats',
    teneroHolderStats,
    // Hiro doesn't have holder stats — return sensible defaults
    async () => ({
      holder_count: '0',
      whale_wallets: '0',
      fresh_1w: '0',
      fresh_1m: '0',
      active_1w: '0',
      active_1m: '0',
      inactive_6m: '0',
      trader_wallets: '0',
      frequent_traders: '0',
      high_volume_traders: '0',
    }),
  )
}

export async function getStacksHolderPercentagesResilient(): Promise<{
  top_10: number
  top_25: number
  top_50: number
}> {
  return resilientFetch(
    'holder_pct',
    teneroHolderPercentages,
    // Calculate from Hiro holders if Tenero is down
    async () => {
      const { holders } = await getHiroHolders(50)
      const totalBalance = holders.reduce((s, h) => s + h.balance, 0)
      if (totalBalance === 0) return { top_10: 0, top_25: 0, top_50: 0 }
      const pct = (n: number) =>
        holders.slice(0, n).reduce((s, h) => s + h.balance, 0) / totalBalance * 100
      return { top_10: pct(10), top_25: pct(25), top_50: pct(50) }
    },
  )
}

export async function getStacksTransactionsResilient(limit = 50): Promise<{
  transactions: ChainTransaction[]
  total_count: number
}> {
  return resilientFetch(
    `txs:${limit}`,
    () => teneroTransactions(limit),
    () => getHiroTransactions(limit),
  )
}
