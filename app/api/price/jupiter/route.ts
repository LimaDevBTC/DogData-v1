import { NextResponse } from 'next/server'
import { buildPriceResponse } from '@/lib/price-normalizer'

const JUPITER_META = { exchange: 'jupiter', type: 'aggregator' as const, chain: 'solana' as const, pair: 'DOG/USD' }

function jupiterPayload(
  d: { price: number; change24h: number; liquidity: number },
  fetchedAt: number,
  cached: boolean,
  stale = false
) {
  return buildPriceResponse({
    ...JUPITER_META,
    price_usd: d.price,
    change_24h_pct: d.change24h,
    liquidity_usd: d.liquidity,
    fetched_at: new Date(fetchedAt).toISOString(),
    cached,
    stale,
    cache_age_s: cached ? Math.floor((Date.now() - fetchedAt) / 1000) : undefined,
    legacy: {
      price: d.price,
      change24h: d.change24h,
      liquidity: d.liquidity,
      source: 'jupiter',
      timestamp: new Date(fetchedAt).toISOString(),
    },
  })
}

export const dynamic = 'force-dynamic'

const DOG_MINT = 'dog1viwbb2vWDpER5FrJ4YFG6gq6XuyFohUe9TXN65u'

// Cache persistente em memória
let cachedData: {
  price: number
  change24h: number
  liquidity: number
  timestamp: number
  lastSuccessfulFetch: number
} | null = null

const REFRESH_INTERVAL = 30000 // 30 segundos
const API_TIMEOUT = 8000

export async function GET() {
  const now = Date.now()

  // Retornar cache se ainda está fresco
  if (cachedData && (now - cachedData.lastSuccessfulFetch) < REFRESH_INTERVAL) {
    console.log('📦 Using cached Jupiter data (fresh)')
    return NextResponse.json(jupiterPayload(cachedData, cachedData.lastSuccessfulFetch, true))
  }

  try {
    const response = await fetch(
      `https://api.jup.ag/price/v3?ids=${DOG_MINT}`,
      {
        cache: 'no-store',
        signal: AbortSignal.timeout(API_TIMEOUT),
        headers: {
          'Accept': 'application/json'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Jupiter API error: ${response.status}`)
    }

    const data = await response.json()
    const tokenData = data[DOG_MINT]

    if (!tokenData || tokenData.usdPrice == null) {
      throw new Error('No DOG price data from Jupiter')
    }

    const price = tokenData.usdPrice as number
    const change24h = tokenData.priceChange24h as number ?? 0
    const liquidity = tokenData.liquidity as number ?? 0

    console.log('📊 Jupiter DOG Price:', {
      price: `$${price.toFixed(8)}`,
      change24h: `${change24h.toFixed(2)}%`,
      liquidity: `$${liquidity.toFixed(2)}`
    })

    const fetchTime = Date.now()
    cachedData = {
      price,
      change24h,
      liquidity,
      timestamp: fetchTime,
      lastSuccessfulFetch: fetchTime
    }

    console.log('✅ Jupiter cache updated')

    return NextResponse.json(jupiterPayload({ price, change24h, liquidity }, fetchTime, false))

  } catch (error) {
    console.error('❌ Jupiter API error:', error)

    if (cachedData) {
      console.log('📦 Using stale cache as fallback')
      return NextResponse.json(jupiterPayload(cachedData, cachedData.lastSuccessfulFetch, true, true))
    }

    return NextResponse.json({
      ...jupiterPayload({ price: 0, change24h: 0, liquidity: 0 }, Date.now(), false),
      error: 'Jupiter API unavailable',
    }, { status: 503 })
  }
}
