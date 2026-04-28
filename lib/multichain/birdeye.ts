import { memoryCache } from '@/lib/cache'
import { ChainTokenInfo, ChainTransaction, DOG_TOKENS } from './types'

const BASE_URL = 'https://public-api.birdeye.so'
const TOKEN_ADDRESS = DOG_TOKENS.solana.address
const CACHE_TTL = 5 * 60 * 1000 // 5 min — conserve free tier CUs

function getApiKey(): string {
  const key = process.env.BIRDEYE_API_KEY
  if (!key) throw new Error('BIRDEYE_API_KEY is not set')
  return key
}

async function birdeyeFetch<T>(path: string): Promise<T> {
  const resp = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'X-API-KEY': getApiKey(),
      'x-chain': 'solana',
      'accept': 'application/json',
    },
    cache: 'no-store', // Disable Next.js Data Cache — memoryCache handles TTL
  })

  if (!resp.ok) {
    throw new Error(`Birdeye ${path}: ${resp.status} ${resp.statusText}`)
  }

  const json = await resp.json()
  if (!json.success) {
    throw new Error(`Birdeye ${path}: ${json.message || 'Unknown error'}`)
  }

  return json.data as T
}

// === Token Overview (30 CU) ===

interface BirdeyeOverview {
  address: string
  symbol: string
  name: string
  decimals: number
  price: number
  priceChange24hPercent: number
  mc: number
  v24hUSD: number
  liquidity: number
  holder: number
  supply: number
  circulatingSupply: number
  lastTradeHumanTime: string
  // 24h trading
  trade24h: number
  buy24h: number
  sell24h: number
  uniqueWallet24h: number
  vBuy24hUSD: number
  vSell24hUSD: number
}

export async function getSolanaTokenInfo(): Promise<ChainTokenInfo> {
  const cacheKey = 'birdeye:token_overview'
  const cached = memoryCache.get<ChainTokenInfo>(cacheKey)
  if (cached) return cached

  const data = await birdeyeFetch<BirdeyeOverview>(
    `/defi/token_overview?address=${TOKEN_ADDRESS}`
  )

  const info: ChainTokenInfo = {
    chain: 'solana',
    address: TOKEN_ADDRESS,
    symbol: data.symbol || 'DOG',
    name: data.name || 'Dog (Bitcoin)',
    decimals: data.decimals ?? 5,
    price_usd: data.price ?? 0,
    price_change_24h: data.priceChange24hPercent ?? 0,
    market_cap_usd: data.mc ?? 0,
    volume_24h_usd: data.v24hUSD ?? 0,
    liquidity_usd: data.liquidity ?? null,
    holder_count: data.holder ?? 0,
    total_supply: 0, // Birdeye reports full SPL contract supply, not bridged amount
    circulating_supply: 0,
    last_updated: new Date().toISOString(),
  }

  memoryCache.set(cacheKey, info, CACHE_TTL)
  return info
}

// === Token Price (10 CU) — lightweight ===

interface BirdeyePrice {
  value: number
  updateUnixTime: number
  updateHumanTime: string
  priceChange24h: number
}

export async function getSolanaPrice(): Promise<{ price: number; change24h: number }> {
  const cacheKey = 'birdeye:price'
  const cached = memoryCache.get<{ price: number; change24h: number }>(cacheKey)
  if (cached) return cached

  const data = await birdeyeFetch<BirdeyePrice>(
    `/defi/price?address=${TOKEN_ADDRESS}`
  )

  const result = { price: data.value ?? 0, change24h: data.priceChange24h ?? 0 }
  memoryCache.set(cacheKey, result, 2 * 60 * 1000) // 2 min cache for price
  return result
}

// Note: Transactions and individual holder list are not available on free tier.
// We get holder count and trading stats from token_overview instead.
export async function getSolanaTransactions(): Promise<ChainTransaction[]> {
  // Not available on free Birdeye tier — return empty
  return []
}
