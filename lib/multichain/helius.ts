import { memoryCache } from '@/lib/cache'
import { ChainHolder, ChainTransaction, ChainTransfer, DOG_TOKENS } from './types'
import fs from 'fs'
import path from 'path'

const TOKEN_MINT = DOG_TOKENS.solana.address
const DECIMALS = DOG_TOKENS.solana.decimals
const CACHE_TTL = 5 * 60 * 1000 // 5 min

// Standard Solana JSON-RPC methods (getTokenSupply, getTokenLargestAccounts,
// getAccountInfo) work on ANY RPC node — they are not Helius-specific. Default to a
// free public endpoint so Solana holder data keeps working even when the Helius plan
// is over quota. Override with SOLANA_RPC_URL. Helius (HELIUS_API_KEY) is only needed
// for DAS-only features (full holder count) and the Enhanced transactions API.
const PUBLIC_RPC_URL = process.env.SOLANA_RPC_URL || 'https://solana-rpc.publicnode.com'

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function getApiKey(): string {
  const key = process.env.HELIUS_API_KEY
  if (!key) throw new Error('HELIUS_API_KEY is not set')
  return key
}

function heliusRpcUrl(): string {
  return `https://mainnet.helius-rpc.com/?api-key=${getApiKey()}`
}

function enhancedUrl(): string {
  return `https://api-mainnet.helius-rpc.com`
}

// Standard JSON-RPC call. Defaults to the public RPC; pass `url` for Helius-only (DAS)
// methods. Retries transient rate-limit / empty-body / network failures with backoff —
// public nodes throttle bursts (HTTP 429 / JSON-RPC -32005). Hard RPC errors (e.g.
// Helius -32429 "max usage reached") fail fast so callers can fall back immediately.
async function rpcCall<T>(method: string, params: any, url: string = PUBLIC_RPC_URL): Promise<T> {
  let lastErr: Error = new Error(`RPC ${method}: failed`)
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await sleep(200 * attempt)
    let retryable = false
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      })
      if (resp.status === 429) { retryable = true; throw new Error(`RPC ${method}: HTTP 429`) }
      if (!resp.ok) throw new Error(`RPC ${method}: HTTP ${resp.status}`)
      const text = await resp.text()
      if (!text) { retryable = true; throw new Error(`RPC ${method}: empty body`) }
      const json = JSON.parse(text)
      if (json.error) {
        if (json.error.code === -32005) retryable = true // public-node rate limit
        throw new Error(`RPC ${method}: ${json.error.message}`)
      }
      return json.result as T
    } catch (e: any) {
      lastErr = e instanceof Error ? e : new Error(String(e))
      // Retry rate-limits, empty bodies, network errors (TypeError from fetch) and
      // partial-body parse errors; rethrow genuine RPC errors immediately.
      const transient = retryable || e instanceof TypeError || /Unexpected (token|end)/i.test(lastErr.message)
      if (!transient) throw lastErr
    }
  }
  throw lastErr
}

// Run an async fn over items with bounded concurrency — public RPC nodes reject
// large parallel bursts, so owner resolution is throttled instead of Promise.all'd.
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
  const cacheKey = 'helius:supply'
  const cached = memoryCache.get<number>(cacheKey)
  if (cached !== null) return cached

  const result = await rpcCall<TokenSupplyResult>('getTokenSupply', [TOKEN_MINT])
  const supply = parseFloat(result.value.uiAmountString) || 0
  memoryCache.set(cacheKey, supply, CACHE_TTL)
  return supply
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

export async function getSolanaHolders(limit = 20): Promise<{
  holders: ChainHolder[]
  total_count: number
  bridgeSupply: number
  circulatingOnChain: number
}> {
  const cacheKey = `helius:holders:${limit}`
  const cached = memoryCache.get<{ holders: ChainHolder[]; total_count: number; bridgeSupply: number; circulatingOnChain: number }>(cacheKey)
  if (cached) return cached

  const totalSupply = await getSolanaSupply()

  // Get largest accounts
  const result = await rpcCall<{ context: { slot: number }; value: LargestAccount[] }>(
    'getTokenLargestAccounts',
    [TOKEN_MINT]
  )

  const accounts = result.value || []

  // The largest account (~97.9%) is the bridge/treasury — real circulating = total - bridge
  const largestBalance = accounts.length > 0 ? parseFloat(accounts[0].uiAmountString) : 0
  const isBridge = largestBalance > totalSupply * 0.5 // if holds >50%, it's the bridge
  const bridgeSupply = isBridge ? largestBalance : 0
  const circulatingOnSolana = totalSupply - bridgeSupply

  // Resolve owner wallets and build holder list (skip bridge account)
  const holdersToProcess = isBridge ? accounts.slice(1) : accounts
  const holdersSlice = holdersToProcess.slice(0, limit)

  // Resolve owners with bounded concurrency (public RPC throttles parallel bursts)
  const owners = await mapLimit(holdersSlice, 3, a => resolveOwner(a.address))

  const holders: ChainHolder[] = holdersSlice.map((a, i) => {
    const balance = parseFloat(a.uiAmountString)
    return {
      chain: 'solana' as const,
      address: owners[i],
      balance,
      balance_usd: null, // will be enriched by caller with price
      percentage_of_supply: circulatingOnSolana > 0 ? (balance / circulatingOnSolana) * 100 : 0,
      rank: i + 1,
      last_active: null,
    }
  })

  const holderCount = await getSolanaHolderCount()

  const res = {
    holders,
    total_count: holderCount,
    bridgeSupply,
    // Circulating on Solana = full SPL supply minus the bridge/treasury account.
    // Computed from the live RPC supply so it never depends on Birdeye (over-quota).
    circulatingOnChain: circulatingOnSolana > 0 ? circulatingOnSolana : 0,
  }
  memoryCache.set(cacheKey, res, CACHE_TTL)
  return res
}

// === Total Holder Count via Helius DAS (pagination) ===
// Helius DAS does not return a global total — we paginate until a partial page is found.
// Result is cached for 30 min to avoid hammering the API on every stats request.

const HOLDER_COUNT_TTL = 30 * 60 * 1000 // 30 min — fresh count from Helius DAS
const FALLBACK_COUNT_TTL = 10 * 60 * 1000 // 10 min — short so Helius is retried sooner
const PAGE_SIZE = 1000

// Last-known holder count from data/external_holders.json — fallback for when the live
// source (Helius DAS) is unavailable (no key / over quota). Returns 0 if unreadable.
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

export async function getSolanaHolderCount(): Promise<number> {
  const cacheKey = 'helius:holder_count'
  const cached = memoryCache.get<number>(cacheKey)
  if (cached !== null) return cached

  // Primary: Helius DAS getTokenAccounts (paginated) — the only API that returns the
  // true on-chain holder count. Requires a Helius key with available quota.
  if (process.env.HELIUS_API_KEY) {
    try {
      let page = 1
      let total = 0

      while (true) {
        const result = await rpcCall<{ token_accounts: any[] }>(
          'getTokenAccounts',
          { mint: TOKEN_MINT, page, limit: PAGE_SIZE },
          heliusRpcUrl()
        )
        const accounts = result.token_accounts ?? []
        total += accounts.length

        if (accounts.length < PAGE_SIZE) break // last page
        page++

        // Safety cap — stop after 50 pages (50k holders) to avoid infinite loops
        if (page > 50) break
      }

      if (total > 0) {
        memoryCache.set(cacheKey, total, HOLDER_COUNT_TTL)
        return total
      }
    } catch {
      // fall through to the offline fallback below
    }
  }

  // Fallback: last-known count from data/external_holders.json (cached briefly so the
  // live Helius count is picked up again as soon as quota recovers).
  const fallback = readExternalHolderCount('solana')
  if (fallback > 0) memoryCache.set(cacheKey, fallback, FALLBACK_COUNT_TTL)
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
    UNKNOWN: '',
  }
  const mapped = map[source]
  if (mapped !== undefined) return mapped || undefined
  return source && source !== 'UNKNOWN' ? source : undefined
}

export async function getSolanaTransactions(limit = 30): Promise<{
  transactions: ChainTransaction[]
  total_count: number
}> {
  const cacheKey = `helius:txs:${limit}`
  const cached = memoryCache.get<{ transactions: ChainTransaction[]; total_count: number }>(cacheKey)
  if (cached) return cached

  const url = `${enhancedUrl()}/v0/addresses/${TOKEN_MINT}/transactions?api-key=${getApiKey()}&limit=${limit}`
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Helius Enhanced API: ${resp.status}`)

  const data: HeliusTransaction[] = await resp.json()

  const transactions: ChainTransaction[] = []

  for (const tx of data) {
    // Find all DOG token transfers in this transaction
    const dogTransfers = (tx.tokenTransfers || []).filter(t => t.mint === TOKEN_MINT)
    if (dogTransfers.length === 0) continue

    // Use the largest DOG transfer as the primary from/to
    const mainTransfer = dogTransfers.reduce((a, b) => a.tokenAmount > b.tokenAmount ? a : b)

    // Total DOG moved = sum of all outgoing DOG transfers
    const totalAmount = dogTransfers.reduce((sum, t) => sum + t.tokenAmount, 0)

    const txType = tx.type === 'SWAP' ? 'swap' as const
      : tx.type === 'TRANSFER' ? 'transfer' as const
      : 'transfer' as const

    // All individual DOG transfers (for multi-hop / multi-output visibility)
    const allTransfers: ChainTransfer[] = dogTransfers.map(t => ({
      from: t.fromUserAccount,
      to: t.toUserAccount,
      amount: t.tokenAmount,
    }))

    // Fee: Helius returns lamports — convert to SOL (1 SOL = 1e9 lamports)
    const feeInSol = tx.fee > 0 ? tx.fee / 1_000_000_000 : undefined

    const protocol = normalizeSource(tx.source)

    // Description: use Helius description when meaningful, otherwise omit
    const description = tx.description && tx.description.length > 0 && tx.description !== 'Unknown'
      ? tx.description
      : undefined

    transactions.push({
      chain: 'solana',
      tx_id: tx.signature,
      type: txType,
      from_address: mainTransfer.fromUserAccount || tx.feePayer,
      to_address: mainTransfer.toUserAccount || '',
      amount: totalAmount,
      amount_usd: null,
      timestamp: new Date(tx.timestamp * 1000).toISOString(),
      block_height: tx.slot,
      protocol,
      description,
      fee: feeInSol,
      fee_token: 'SOL',
      all_transfers: allTransfers.length > 1 ? allTransfers : undefined,
    })
  }

  const result = { transactions, total_count: transactions.length }
  memoryCache.set(cacheKey, result, CACHE_TTL)
  return result
}
