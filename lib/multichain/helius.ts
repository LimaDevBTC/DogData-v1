import { Redis } from '@upstash/redis'
import { memoryCache } from '@/lib/cache'
import { ChainHolder, ChainTransaction, ChainTransfer, DOG_TOKENS } from './types'
import fs from 'fs'
import path from 'path'

/**
 * Solana data layer for DOG (SPL mint dog1viwb…).
 *
 * Two kinds of upstream:
 *   - Standard JSON-RPC (getTokenSupply, getTokenLargestAccounts, getAccountInfo,
 *     getSignaturesForAddress): provider-agnostic. Served by a CHAIN of endpoints
 *     (SOLANA_RPC_URL → free public nodes → Helius as last resort) with per-endpoint
 *     cooldown, so one provider changing its terms (PublicNode started requiring a
 *     token on 2026-08, Ankr/dRPC went paid) no longer blanks the holders page.
 *   - Helius-only: DAS getTokenAccounts (holder count, 10 credits/call) and the
 *     Enhanced Transactions API (100 credits/call). Free plan = 1M credits/month.
 *
 * Every upstream result goes through a SHARED cache (memory → Upstash Redis) with a
 * fresh TTL, a long-lived stale copy and a refresh lock. On Vercel each lambda
 * instance and each SSE connection used to refetch on its own, which is how the
 * Helius quota died twice (2026-06 and 2026-08). Now the whole deployment makes at
 * most one origin call per key per fresh TTL, and a quota/provider outage serves
 * the stale copy instead of an empty list.
 *
 * Budget at the defaults (Free plan): transactions ≤ 288 Enhanced calls/day
 * (≈ 864k credits/month worst case, typically far less thanks to the change probe),
 * holder count 12 DAS pages/day (≈ 3.6k/month), RPC on public nodes (0 credits).
 */

const TOKEN_MINT = DOG_TOKENS.solana.address

// --- Cache TTLs -------------------------------------------------------------------

const MIN = 60_000
const HOUR = 60 * MIN

const HOLDERS_MEMORY_MS = 5 * MIN
const HOLDERS_FRESH_SEC = 5 * 60
const HOLDERS_STALE_SEC = 24 * 3600

// Enhanced API refresh cadence. 300 s → ≤ 288 calls/day → ≤ 864k credits/month on a
// busy day; the getSignaturesForAddress probe skips the call whenever nothing new
// touched the mint. Tune with SOLANA_TX_REFRESH_SEC (never below 60).
const TX_FRESH_SEC = Math.max(60, parseInt(process.env.SOLANA_TX_REFRESH_SEC || '300', 10) || 300)
const TX_MEMORY_MS = MIN
const TX_STALE_SEC = 24 * 3600
const TX_FETCH_LIMIT = 100 // one Enhanced call serves every caller (10 / 30 / 50 / 100)

const COUNT_MEMORY_MS = HOUR
const COUNT_FRESH_SEC = 24 * 3600
const COUNT_STALE_SEC = 7 * 24 * 3600
const COUNT_FALLBACK_MS = 2 * HOUR // retry DAS after 2 h when we had to use the json file

const LOCK_SEC = 30
const ENDPOINT_COOLDOWN_MS = 5 * MIN

// --- Shared cache: memory → Upstash Redis (fresh + stale + lock) --------------------

const REDIS_PREFIX = 'sol:'

// Built here (not imported from lib/upstash) so a missing Upstash env degrades to
// memory-only caching instead of throwing at import time.
const redis: Redis | null = (() => {
  const url = process.env.UPSTASH_KV_REST_API_URL
  const token = process.env.UPSTASH_KV_REST_API_TOKEN
  return url && token ? new Redis({ url, token }) : null
})()

async function redisGet<T>(key: string): Promise<T | null> {
  if (!redis) return null
  try {
    const v = await redis.get<T | string>(`${REDIS_PREFIX}${key}`)
    if (v === null || v === undefined) return null
    return (typeof v === 'string' ? JSON.parse(v) : v) as T
  } catch {
    return null
  }
}

async function redisSet<T>(key: string, data: T, ttlSec: number): Promise<void> {
  if (!redis) return
  try {
    await redis.set(`${REDIS_PREFIX}${key}`, JSON.stringify(data), { ex: ttlSec })
  } catch {
    // best-effort
  }
}

// Returns true when this instance won the right to refresh `key`. Without Redis every
// instance refreshes on its own (same as before, memory cache still applies).
async function redisLock(key: string, ttlSec: number): Promise<boolean> {
  if (!redis) return true
  try {
    const r = await redis.set(`${REDIS_PREFIX}${key}:lock`, '1', { nx: true, ex: ttlSec })
    return r === 'OK'
  } catch {
    return true
  }
}

interface CacheOpts<T> {
  memoryMs: number
  freshSec: number
  staleSec: number
  // Optional cheap probe: given the stale copy, return true when the origin has not
  // changed — the stale copy is then re-published as fresh without hitting the origin.
  unchanged?: (stale: T) => Promise<boolean>
}

async function publish<T>(key: string, value: T, opts: CacheOpts<T>): Promise<void> {
  memoryCache.set(`${REDIS_PREFIX}${key}`, value, opts.memoryMs)
  await Promise.all([
    redisSet(key, value, opts.freshSec),
    redisSet(`${key}:stale`, value, opts.staleSec),
  ])
}

async function cachedFetch<T>(key: string, opts: CacheOpts<T>, origin: () => Promise<T>): Promise<T> {
  const memKey = `${REDIS_PREFIX}${key}`
  const mem = memoryCache.get<T>(memKey)
  if (mem !== null) return mem

  const fresh = await redisGet<T>(key)
  if (fresh !== null) {
    memoryCache.set(memKey, fresh, opts.memoryMs)
    return fresh
  }

  const stale = await redisGet<T>(`${key}:stale`)

  // Someone else is refreshing right now — serve the stale copy rather than piling on.
  if (!(await redisLock(key, LOCK_SEC))) {
    if (stale !== null) {
      memoryCache.set(memKey, stale, 15_000)
      return stale
    }
  }

  if (stale !== null && opts.unchanged) {
    try {
      if (await opts.unchanged(stale)) {
        await publish(key, stale, opts)
        return stale
      }
    } catch {
      // probe failed — fall through to the origin
    }
  }

  try {
    const value = await origin()
    await publish(key, value, opts)
    return value
  } catch (err) {
    if (stale !== null) {
      console.warn(`[helius] ${key}: origin failed (${(err as Error).message}); serving stale copy`)
      memoryCache.set(memKey, stale, MIN)
      return stale
    }
    throw err
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// --- Standard JSON-RPC over an endpoint chain -------------------------------------

function heliusRpcUrl(): string | null {
  const key = process.env.HELIUS_API_KEY
  return key ? `https://mainnet.helius-rpc.com/?api-key=${key}` : null
}

function requireHeliusRpcUrl(): string {
  const url = heliusRpcUrl()
  if (!url) throw new Error('HELIUS_API_KEY is not set')
  return url
}

// Free public nodes verified 2026-08-26 for getTokenSupply / getTokenLargestAccounts /
// getAccountInfo. Helius goes last so its credits are only spent when the free ones
// fail. Override/prepend with SOLANA_RPC_URL.
function rpcEndpoints(): string[] {
  const list: string[] = []
  if (process.env.SOLANA_RPC_URL) list.push(process.env.SOLANA_RPC_URL)
  list.push(
    'https://public.rpc.solanavibestation.com',
    'https://solana.leorpc.com/?api_key=FREE',
    'https://api.mainnet-beta.solana.com',
  )
  const helius = heliusRpcUrl()
  if (helius) list.push(helius)
  return list
}

const endpointDownUntil = new Map<string, number>()

function endpointLabel(url: string): string {
  return url.split('?')[0]
}

class RpcError extends Error {
  constructor(message: string, readonly transient: boolean) {
    super(message)
  }
}

// One JSON-RPC call against ONE endpoint. Retries transient failures (HTTP 429,
// -32005 rate limit, empty body, network/timeout) with backoff; throws immediately on
// hard errors (auth/plan errors, "max usage reached", -32602 "personal token").
async function rpcCallAt<T>(url: string, method: string, params: any, attempts = 2): Promise<T> {
  let lastErr = new RpcError(`RPC ${method}: failed`, true)
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) await sleep(300 * attempt)
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: AbortSignal.timeout(10_000),
      })
      const text = await resp.text()
      if (resp.status === 429) {
        // Helius returns 429 "max usage reached" for a SPENT monthly quota — that is
        // not transient, retrying only wastes time.
        const spent = /max usage/i.test(text)
        throw new RpcError(`RPC ${method}: HTTP 429 ${text.slice(0, 80)}`, !spent)
      }
      if (!resp.ok) throw new RpcError(`RPC ${method}: HTTP ${resp.status} ${text.slice(0, 80)}`, false)
      if (!text) throw new RpcError(`RPC ${method}: empty body`, true)
      const json = JSON.parse(text)
      if (json.error) {
        const code = json.error.code
        throw new RpcError(`RPC ${method}: ${json.error.message}`, code === -32005 || code === 429)
      }
      return json.result as T
    } catch (e: any) {
      if (e instanceof RpcError) {
        lastErr = e
      } else {
        const isAbort = e?.name === 'AbortError' || e?.name === 'TimeoutError'
        const transient = isAbort || e instanceof TypeError || /Unexpected (token|end)/i.test(String(e?.message))
        lastErr = new RpcError(`RPC ${method}: ${e?.message || e}`, transient)
      }
      if (!lastErr.transient) throw lastErr
    }
  }
  throw lastErr
}

// Standard JSON-RPC call across the endpoint chain: skips endpoints on cooldown, puts
// an endpoint on cooldown after a hard error, moves on after exhausted retries.
async function rpcCall<T>(method: string, params: any): Promise<T> {
  const now = Date.now()
  const endpoints = rpcEndpoints()
  let lastErr: Error = new Error(`RPC ${method}: no endpoint available`)
  for (const url of endpoints) {
    if ((endpointDownUntil.get(url) ?? 0) > now) continue
    try {
      return await rpcCallAt<T>(url, method, params)
    } catch (e: any) {
      lastErr = e
      if (e instanceof RpcError && !e.transient) {
        endpointDownUntil.set(url, now + ENDPOINT_COOLDOWN_MS)
        console.warn(`[helius] ${endpointLabel(url)} down for ${method}: ${e.message} — cooling off`)
      }
    }
  }
  throw lastErr
}

// Run an async fn over items with bounded concurrency — public nodes reject bursts.
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

// === Supply ===

interface TokenSupplyResult {
  context: { slot: number }
  value: {
    amount: string
    decimals: number
    uiAmountString: string
  }
}

export async function getSolanaSupply(): Promise<number> {
  return cachedFetch<number>(
    'supply',
    { memoryMs: HOLDERS_MEMORY_MS, freshSec: HOLDERS_FRESH_SEC, staleSec: HOLDERS_STALE_SEC },
    async () => {
      const result = await rpcCall<TokenSupplyResult>('getTokenSupply', [TOKEN_MINT])
      return parseFloat(result.value.uiAmountString) || 0
    },
  )
}

// === Top Holders (largest accounts) ===

interface LargestAccount {
  address: string // token account address
  amount: string
  decimals: number
  uiAmountString: string
}

interface TokenAccountInfo {
  parsed: {
    info: {
      owner: string
      mint: string
      tokenAmount: {
        uiAmountString: string
      }
    }
  }
}

async function resolveOwner(tokenAccount: string): Promise<string> {
  try {
    const result = await rpcCall<{ value: TokenAccountInfo }>('getAccountInfo', [
      tokenAccount,
      { encoding: 'jsonParsed' },
    ])
    return result.value?.parsed?.info?.owner || tokenAccount
  } catch {
    return tokenAccount
  }
}

// Owner wallets for a list of token accounts. One getMultipleAccounts round-trip
// (≤100 accounts) instead of N getAccountInfo calls — public nodes throttle the burst
// version hard (48 calls / 23 s for 20 accounts measured 2026-08-26). Falls back to
// per-account resolution when the batch method is unavailable.
async function resolveOwners(tokenAccounts: string[]): Promise<string[]> {
  if (tokenAccounts.length === 0) return []
  try {
    const result = await rpcCall<{ value: Array<{ data?: TokenAccountInfo } | null> }>('getMultipleAccounts', [
      tokenAccounts,
      { encoding: 'jsonParsed' },
    ])
    const values = result.value || []
    if (values.length !== tokenAccounts.length) throw new Error('getMultipleAccounts: length mismatch')
    return tokenAccounts.map((addr, i) => values[i]?.data?.parsed?.info?.owner || addr)
  } catch (err) {
    console.warn('[helius] getMultipleAccounts failed, resolving owners one by one:', (err as Error).message)
    return mapLimit(tokenAccounts, 3, a => resolveOwner(a))
  }
}

interface SolanaHoldersResult {
  holders: ChainHolder[]
  total_count: number
  bridgeSupply: number
  circulatingOnChain: number
}

export async function getSolanaHolders(limit = 20): Promise<SolanaHoldersResult> {
  return cachedFetch<SolanaHoldersResult>(
    `holders:${limit}`,
    { memoryMs: HOLDERS_MEMORY_MS, freshSec: HOLDERS_FRESH_SEC, staleSec: HOLDERS_STALE_SEC },
    async () => {
      const totalSupply = await getSolanaSupply()

      const result = await rpcCall<{ context: { slot: number }; value: LargestAccount[] }>(
        'getTokenLargestAccounts',
        [TOKEN_MINT],
      )
      const accounts = result.value || []

      // The largest account (~97%) is the bridge/treasury — real circulating = total − bridge
      const largestBalance = accounts.length > 0 ? parseFloat(accounts[0].uiAmountString) : 0
      const isBridge = largestBalance > totalSupply * 0.5
      const bridgeSupply = isBridge ? largestBalance : 0
      const circulatingOnSolana = totalSupply - bridgeSupply

      const holdersToProcess = isBridge ? accounts.slice(1) : accounts
      const holdersSlice = holdersToProcess.slice(0, limit)

      const owners = await resolveOwners(holdersSlice.map(a => a.address))

      const holders: ChainHolder[] = holdersSlice.map((a, i) => {
        const balance = parseFloat(a.uiAmountString)
        return {
          chain: 'solana' as const,
          address: owners[i],
          balance,
          balance_usd: null, // enriched by the caller with the price
          percentage_of_supply: circulatingOnSolana > 0 ? (balance / circulatingOnSolana) * 100 : 0,
          rank: i + 1,
          last_active: null,
        }
      })

      const holderCount = await getSolanaHolderCount()

      return {
        holders,
        total_count: holderCount,
        bridgeSupply,
        // Full SPL supply minus the bridge account, from the live RPC — never Birdeye.
        circulatingOnChain: circulatingOnSolana > 0 ? circulatingOnSolana : 0,
      }
    },
  )
}

// === Total Holder Count via Helius DAS (pagination) ===
// DAS does not return a global total — we paginate until a partial page. ~11.3k holders
// = 12 pages × 10 credits, once per 24 h thanks to the shared cache.

const PAGE_SIZE = 1000

// Last-known holder count from data/external_holders.json — used only when DAS is
// unavailable (no key / over quota) AND Redis has no stale copy. Returns 0 if unreadable.
function readExternalHolderCount(chain: 'solana' | 'stacks'): number {
  try {
    const filePath = path.join(process.cwd(), 'data', 'external_holders.json')
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    const n = data?.[chain]?.holders
    return typeof n === 'number' && n > 0 ? n : 0
  } catch {
    return 0
  }
}

async function fetchHolderCountDAS(): Promise<number> {
  const url = requireHeliusRpcUrl()
  let page = 1
  let total = 0
  while (true) {
    const result = await rpcCallAt<{ token_accounts: any[] }>(
      url,
      'getTokenAccounts',
      { mint: TOKEN_MINT, page, limit: PAGE_SIZE },
    )
    const accounts = result.token_accounts ?? []
    total += accounts.length
    if (accounts.length < PAGE_SIZE) break
    page++
    if (page > 50) break // safety cap: 50k holders
  }
  if (total <= 0) throw new Error('DAS returned no token accounts')
  return total
}

export async function getSolanaHolderCount(): Promise<number> {
  const fbKey = `${REDIS_PREFIX}holder_count:fb`
  const fb = memoryCache.get<number>(fbKey)
  if (fb !== null) return fb

  try {
    return await cachedFetch<number>(
      'holder_count',
      { memoryMs: COUNT_MEMORY_MS, freshSec: COUNT_FRESH_SEC, staleSec: COUNT_STALE_SEC },
      fetchHolderCountDAS,
    )
  } catch (err) {
    console.error('[helius] getSolanaHolderCount failed, using fallback:', (err as Error).message)
  }

  const fallback = readExternalHolderCount('solana')
  console.warn(`[helius] holder count fallback → ${fallback} (external_holders.json)`)
  if (fallback > 0) memoryCache.set(fbKey, fallback, COUNT_FALLBACK_MS)
  return fallback
}

// === Transactions (Enhanced API) ===

interface HeliusTransaction {
  description: string
  type: string
  source: string
  fee: number
  feePayer: string
  signature: string
  slot: number
  timestamp: number
  tokenTransfers: Array<{
    fromUserAccount: string
    toUserAccount: string
    tokenAmount: number
    mint: string
  }>
  nativeTransfers: Array<{
    fromUserAccount: string
    toUserAccount: string
    amount: number
  }>
}

// Normalize Helius source names to human-readable protocol labels
function normalizeSource(source: string): string | undefined {
  const map: Record<string, string> = {
    RAYDIUM: 'Raydium',
    JUPITER: 'Jupiter',
    ORCA: 'Orca',
    METEORA: 'Meteora',
    MAGIC_EDEN: 'Magic Eden',
    TENSOR: 'Tensor',
    DRIFT: 'Drift',
    MANGO: 'Mango',
    OPENBOOK: 'OpenBook',
    PHOENIX: 'Phoenix',
    LIFINITY: 'Lifinity',
    ALDRIN: 'Aldrin',
    CREMA: 'Crema',
    STEP: 'Step Finance',
    COINFRA: 'Coinfra',
    OKX_DEX_ROUTER: 'OKX DEX',
    TITAN: 'Titan',
    ASSOCIATED_TOKEN_PROGRAM: '',
    SYSTEM_PROGRAM: '',
    UNKNOWN: '',
  }
  const mapped = map[source]
  if (mapped !== undefined) return mapped || undefined
  return source && source !== 'UNKNOWN' ? source : undefined
}

function parseEnhancedTransaction(tx: HeliusTransaction): ChainTransaction | null {
  const dogTransfers = (tx.tokenTransfers || []).filter(t => t.mint === TOKEN_MINT)
  if (dogTransfers.length === 0) return null

  // Largest DOG leg is the primary from/to; amount = every DOG leg summed
  const mainTransfer = dogTransfers.reduce((a, b) => a.tokenAmount > b.tokenAmount ? a : b)
  const totalAmount = dogTransfers.reduce((sum, t) => sum + t.tokenAmount, 0)

  const txType = tx.type === 'SWAP' ? 'swap' as const : 'transfer' as const

  const allTransfers: ChainTransfer[] = dogTransfers.map(t => ({
    from: t.fromUserAccount,
    to: t.toUserAccount,
    amount: t.tokenAmount,
  }))

  // Helius fee is in lamports
  const feeInSol = tx.fee > 0 ? tx.fee / 1_000_000_000 : undefined

  const description = tx.description && tx.description.length > 0 && tx.description !== 'Unknown'
    ? tx.description
    : undefined

  return {
    chain: 'solana',
    tx_id: tx.signature,
    type: txType,
    from_address: mainTransfer.fromUserAccount || tx.feePayer,
    to_address: mainTransfer.toUserAccount || '',
    amount: totalAmount,
    amount_usd: null,
    timestamp: new Date(tx.timestamp * 1000).toISOString(),
    block_height: tx.slot,
    protocol: normalizeSource(tx.source),
    description,
    fee: feeInSol,
    fee_token: 'SOL',
    all_transfers: allTransfers.length > 1 ? allTransfers : undefined,
  }
}

interface TxFeed {
  // Newest signature touching the mint (before the DOG-transfer filter) — the change
  // probe compares against it so a quiet chain costs 1 free RPC call, not 100 credits.
  newest: string | null
  transactions: ChainTransaction[]
}

async function fetchEnhancedTransactions(): Promise<TxFeed> {
  const key = process.env.HELIUS_API_KEY
  if (!key) throw new Error('HELIUS_API_KEY is not set')

  const url = `https://api-mainnet.helius-rpc.com/v0/addresses/${TOKEN_MINT}/transactions?api-key=${key}&limit=${TX_FETCH_LIMIT}`
  const resp = await fetch(url, { signal: AbortSignal.timeout(20_000) })
  const text = await resp.text()
  if (!resp.ok) throw new Error(`Helius Enhanced API: HTTP ${resp.status} ${text.slice(0, 80)}`)

  const data: HeliusTransaction[] = JSON.parse(text)
  const transactions: ChainTransaction[] = []
  for (const tx of data) {
    const parsed = parseEnhancedTransaction(tx)
    if (parsed) transactions.push(parsed)
  }
  return { newest: data[0]?.signature ?? null, transactions }
}

// Cheap change probe (standard RPC, free on public nodes): has anything new touched the
// mint since the cached feed was built?
async function txFeedUnchanged(stale: TxFeed): Promise<boolean> {
  if (!stale.newest) return false
  const sigs = await rpcCall<Array<{ signature: string }>>('getSignaturesForAddress', [
    TOKEN_MINT,
    { limit: 1 },
  ])
  return sigs?.[0]?.signature === stale.newest
}

export async function getSolanaTransactions(limit = 30): Promise<{
  transactions: ChainTransaction[]
  total_count: number
}> {
  const feed = await cachedFetch<TxFeed>(
    'txs',
    { memoryMs: TX_MEMORY_MS, freshSec: TX_FRESH_SEC, staleSec: TX_STALE_SEC, unchanged: txFeedUnchanged },
    fetchEnhancedTransactions,
  )
  const transactions = feed.transactions.slice(0, limit)
  return { transactions, total_count: transactions.length }
}
