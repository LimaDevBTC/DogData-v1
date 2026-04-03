/**
 * Resilient Stacks data layer.
 *
 * Three-tier strategy:
 *   1. Memory cache  (in-process, 5 min TTL — instant)
 *   2. Redis / Upstash (shared across instances, 1 h TTL — fast)
 *   3. Tenero API → Hiro API fallback (origin fetch — slow)
 *
 * Every successful origin fetch writes back to both Redis and memory.
 * If Tenero is down, Hiro provides the same data (minus pricing).
 * If both origins are down, Redis serves stale-but-valid data for up to 1 h.
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

const MEMORY_TTL = 5 * 60 * 1000     // 5 min
const REDIS_TTL_SEC = 60 * 60         // 1 h — stale-while-revalidate window
const REDIS_PREFIX = 'stacks:'

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

async function redisSet<T>(key: string, data: T): Promise<void> {
  try {
    await redisClient.set(`${REDIS_PREFIX}${key}`, JSON.stringify(data), { ex: REDIS_TTL_SEC })
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
  // 1. Memory cache
  const mem = memoryCache.get<T>(cacheKey)
  if (mem) return mem

  // 2. Try primary origin (Tenero)
  try {
    const data = await primaryFn()
    memoryCache.set(cacheKey, data, MEMORY_TTL)
    redisSet(cacheKey, data) // fire-and-forget
    return data
  } catch (primaryErr) {
    console.warn(`[stacks-resilient] Primary (Tenero) failed for ${cacheKey}:`, (primaryErr as Error).message)
  }

  // 3. Try fallback origin (Hiro)
  try {
    const data = await fallbackFn()
    memoryCache.set(cacheKey, data, MEMORY_TTL)
    redisSet(cacheKey, data)
    return data
  } catch (fallbackErr) {
    console.warn(`[stacks-resilient] Fallback (Hiro) failed for ${cacheKey}:`, (fallbackErr as Error).message)
  }

  // 4. Last resort — Redis stale cache
  const redisData = await redisGet<T>(cacheKey)
  if (redisData) {
    console.warn(`[stacks-resilient] Serving stale Redis cache for ${cacheKey}`)
    memoryCache.set(cacheKey, redisData, 60_000) // short memory TTL for stale
    return redisData
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
