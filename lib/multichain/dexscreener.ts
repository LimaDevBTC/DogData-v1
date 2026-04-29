/**
 * DexScreener — free, no API key, no rate limits for public use.
 * Used as primary source for Solana DOG price/market data.
 * Holder count comes from Helius DAS (see helius.ts).
 */

import { memoryCache } from '@/lib/cache'
import { ChainTokenInfo, DOG_TOKENS } from './types'

const TOKEN_ADDRESS = DOG_TOKENS.solana.address
const CACHE_TTL = 5 * 60 * 1000 // 5 min

interface DexScreenerPair {
  chainId: string
  pairAddress: string
  baseToken: { address: string; name: string; symbol: string }
  priceUsd: string
  priceChange: { h24: number }
  volume: { h24: number }
  liquidity: { usd: number }
  marketCap: number
  fdv: number
}

export async function getSolanaTokenInfoFromDexScreener(): Promise<ChainTokenInfo> {
  const cacheKey = 'dexscreener:solana:dog'
  const cached = memoryCache.get<ChainTokenInfo>(cacheKey)
  if (cached) return cached

  const resp = await fetch(
    `https://api.dexscreener.com/tokens/v1/solana/${TOKEN_ADDRESS}`,
    { cache: 'no-store' }
  )

  if (!resp.ok) {
    throw new Error(`DexScreener: ${resp.status} ${resp.statusText}`)
  }

  const pairs: DexScreenerPair[] = await resp.json()

  if (!pairs?.length) {
    throw new Error('DexScreener: no pairs found for DOG')
  }

  // Pick the pair with highest liquidity
  const best = pairs.sort(
    (a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
  )[0]

  const info: ChainTokenInfo = {
    chain: 'solana',
    address: TOKEN_ADDRESS,
    symbol: best.baseToken?.symbol || 'DOG',
    name: best.baseToken?.name || 'Dog (Bitcoin)',
    decimals: 5,
    price_usd: parseFloat(best.priceUsd) || 0,
    price_change_24h: best.priceChange?.h24 ?? 0,
    market_cap_usd: best.marketCap || best.fdv || 0,
    volume_24h_usd: best.volume?.h24 || 0,
    liquidity_usd: best.liquidity?.usd || null,
    holder_count: 0, // always filled by Helius in stats route
    total_supply: 0,
    circulating_supply: 0,
    last_updated: new Date().toISOString(),
  }

  memoryCache.set(cacheKey, info, CACHE_TTL)
  return info
}
