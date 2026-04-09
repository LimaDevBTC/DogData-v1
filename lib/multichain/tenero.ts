import { memoryCache } from '@/lib/cache'
import {
  ChainTokenInfo,
  ChainHolder,
  ChainTransaction,
  DOG_TOKENS,
} from './types'

const BASE_URL = 'https://api.tenero.io'
const TOKEN_ADDRESS = DOG_TOKENS.stacks.address
const CACHE_TTL = 5 * 60 * 1000 // 5 min

async function teneroFetch<T>(path: string): Promise<T> {
  const resp = await fetch(`${BASE_URL}${path}`, {
    headers: { accept: 'application/json' },
    next: { revalidate: 300 },
  })

  if (!resp.ok) {
    throw new Error(`Tenero ${path}: ${resp.status} ${resp.statusText}`)
  }

  const json = await resp.json()
  return json.data as T
}

// === Token Details ===

interface TeneroToken {
  address: string
  symbol: string
  name: string
  decimals: number
  holder_count: number
  circulating_supply: number
  total_supply: number
  price_usd: number
  marketcap_usd: number
  total_liquidity_usd: number
  pool_count: number
  metrics: {
    volume_1d_usd?: number
    swaps_1d?: number
    buys_1d?: number
    sells_1d?: number
    buy_volume_1d_usd?: number
    sell_volume_1d_usd?: number
  }
  price: {
    current_price: number
    price_1d_ago?: number
    price_change_1d_pct?: number
  }
}

export async function getStacksTokenInfo(): Promise<ChainTokenInfo> {
  const cacheKey = 'tenero:token_info'
  const cached = memoryCache.get<ChainTokenInfo>(cacheKey)
  if (cached) return cached

  const data = await teneroFetch<TeneroToken>(
    `/v1/stacks/tokens/${TOKEN_ADDRESS}`
  )

  const info: ChainTokenInfo = {
    chain: 'stacks',
    address: TOKEN_ADDRESS,
    symbol: data.symbol || 'DOG',
    name: data.name || 'DOG.GO.TO.THE.MOON',
    decimals: data.decimals ?? 5,
    price_usd: data.price_usd ?? data.price?.current_price ?? 0,
    price_change_24h: data.price?.price_change_1d_pct ?? 0,
    market_cap_usd: data.marketcap_usd ?? 0,
    volume_24h_usd: data.metrics?.volume_1d_usd ?? 0,
    liquidity_usd: data.total_liquidity_usd ?? null,
    holder_count: data.holder_count ?? 0,
    total_supply: data.total_supply ?? 0,
    circulating_supply: data.circulating_supply ?? 0,
    last_updated: new Date().toISOString(),
  }

  memoryCache.set(cacheKey, info, CACHE_TTL)
  return info
}

// === Holders ===

interface TeneroHolder {
  wallet_address: string
  balance: number
  credits: number
  debits: number
  start_holding_at: number
  last_active_at: number
  trade_stats?: {
    buy_tx_count: number
    sell_tx_count: number
    total_tx_count: number
    total_volume_usd: number
    realized_pnl_usd: number
  }
}

export async function getStacksHolders(limit = 50): Promise<{
  holders: ChainHolder[]
  total_count: number
}> {
  const cacheKey = `tenero:holders:${limit}`
  const cached = memoryCache.get<{ holders: ChainHolder[]; total_count: number }>(cacheKey)
  if (cached) return cached

  // Get token info for supply to calculate percentages
  const tokenInfo = await getStacksTokenInfo()
  const supply = tokenInfo.circulating_supply || 1

  const data = await teneroFetch<{ rows: TeneroHolder[] }>(
    `/v1/stacks/tokens/${TOKEN_ADDRESS}/holders?limit=${limit}`
  )

  const holders: ChainHolder[] = (data.rows || []).map((h, i) => ({
    chain: 'stacks' as const,
    address: h.wallet_address,
    balance: h.balance,
    balance_usd: h.balance * tokenInfo.price_usd,
    percentage_of_supply: (h.balance / supply) * 100,
    rank: i + 1,
    last_active: h.last_active_at ? new Date(h.last_active_at).toISOString() : null,
  }))

  const result = { holders, total_count: tokenInfo.holder_count }
  memoryCache.set(cacheKey, result, CACHE_TTL)
  return result
}

// === Holder Stats ===

interface TeneroHolderStats {
  holder_count: string
  whale_wallets: string
  fresh_1w: string
  fresh_1m: string
  active_1w: string
  active_1m: string
  inactive_6m: string
  trader_wallets: string
  frequent_traders: string
  high_volume_traders: string
}

export async function getStacksHolderStats(): Promise<TeneroHolderStats> {
  const cacheKey = 'tenero:holder_stats'
  const cached = memoryCache.get<TeneroHolderStats>(cacheKey)
  if (cached) return cached

  const data = await teneroFetch<TeneroHolderStats>(
    `/v1/stacks/tokens/${TOKEN_ADDRESS}/holder_stats`
  )

  memoryCache.set(cacheKey, data, CACHE_TTL)
  return data
}

// === Holder Percentages ===

export async function getStacksHolderPercentages(): Promise<{
  top_10: number
  top_25: number
  top_50: number
}> {
  const cacheKey = 'tenero:holder_pct'
  const cached = memoryCache.get<{ top_10: number; top_25: number; top_50: number }>(cacheKey)
  if (cached) return cached

  const data = await teneroFetch<{ top_10: number; top_25: number; top_50: number }>(
    `/v1/stacks/tokens/${TOKEN_ADDRESS}/holder_percentages`
  )

  memoryCache.set(cacheKey, data, CACHE_TTL)
  return data
}

// === Trades ===

interface TeneroTrade {
  tx_id: string
  event_type: string
  maker: string
  recipient: string
  base_token_amount: string
  amount_usd: number
  price_usd: number
  block_height: number
  block_time: number
  pool_platform: string
}

// === Transfers ===

interface TeneroTransfer {
  tx_id: string
  from_address: string
  to_address: string
  amount: number
  is_trade: boolean
  block_height: number
  block_time: number
  transfer_type: string
}

// Normalize Tenero pool platform names to human-readable labels
function normalizePlatform(platform: string): string {
  const map: Record<string, string> = {
    alex: 'ALEX',
    alexgo: 'ALEX',
    velar: 'Velar',
    arkadiko: 'Arkadiko',
    stackswap: 'StackSwap',
    bitflow: 'Bitflow',
    pontis: 'Pontis Bridge',
  }
  const key = platform.toLowerCase()
  return map[key] ?? platform
}

// Convert snake_case transfer_type to readable label
function capitalizeTransferType(type: string): string {
  return type
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export async function getStacksTransactions(limit = 50): Promise<{
  transactions: ChainTransaction[]
  total_count: number
}> {
  const cacheKey = `tenero:txs:${limit}`
  const cached = memoryCache.get<{ transactions: ChainTransaction[]; total_count: number }>(cacheKey)
  if (cached) return cached

  const tokenInfo = await getStacksTokenInfo()

  // Fetch both trades and transfers in parallel
  const [tradesData, transfersData] = await Promise.all([
    teneroFetch<{ rows: TeneroTrade[] }>(
      `/v1/stacks/tokens/${TOKEN_ADDRESS}/trades?limit=${limit}`
    ).catch(() => ({ rows: [] })),
    teneroFetch<{ rows: TeneroTransfer[] }>(
      `/v1/stacks/tokens/${TOKEN_ADDRESS}/transfers?limit=${limit}`
    ).catch(() => ({ rows: [] })),
  ])

  // Use a Map to deduplicate by tx_id, keeping the richest data source
  const txMap = new Map<string, ChainTransaction>()

  // Map trades first (have USD amounts from DEX)
  for (const t of tradesData.rows || []) {
    const protocol = t.pool_platform && t.pool_platform !== 'unknown'
      ? normalizePlatform(t.pool_platform)
      : undefined

    txMap.set(t.tx_id, {
      chain: 'stacks',
      tx_id: t.tx_id,
      type: 'swap',
      from_address: t.maker,
      to_address: t.recipient || t.maker,
      amount: parseFloat(t.base_token_amount) || 0,
      amount_usd: t.amount_usd ?? null,
      timestamp: new Date(t.block_time).toISOString(),
      block_height: t.block_height,
      protocol,
    })
  }

  // Map transfers — adds wallet-to-wallet txs and enriches trade txs with real from/to
  for (const t of transfersData.rows || []) {
    if (txMap.has(t.tx_id)) continue // trade already captured with better data
    txMap.set(t.tx_id, {
      chain: 'stacks',
      tx_id: t.tx_id,
      type: t.is_trade ? 'swap' : 'transfer',
      from_address: t.from_address,
      to_address: t.to_address,
      amount: t.amount ?? 0,
      amount_usd: (t.amount ?? 0) * tokenInfo.price_usd,
      timestamp: new Date(t.block_time).toISOString(),
      block_height: t.block_height,
      protocol: t.is_trade ? undefined : undefined, // transfers don't have pool info
      description: t.transfer_type && t.transfer_type !== 'transfer'
        ? capitalizeTransferType(t.transfer_type)
        : undefined,
    })
  }

  const transactions = Array.from(txMap.values())

  // Sort by timestamp desc
  transactions.sort((a, b) => b.timestamp.localeCompare(a.timestamp))

  const result = { transactions: transactions.slice(0, limit), total_count: transactions.length }
  memoryCache.set(cacheKey, result, CACHE_TTL)
  return result
}
