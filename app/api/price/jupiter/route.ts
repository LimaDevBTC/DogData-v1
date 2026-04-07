import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

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
    return NextResponse.json({
      price: cachedData.price,
      change24h: cachedData.change24h,
      liquidity: cachedData.liquidity,
      source: 'jupiter',
      cached: true,
      cacheAge: Math.floor((now - cachedData.lastSuccessfulFetch) / 1000)
    })
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

    return NextResponse.json({
      price,
      change24h,
      liquidity,
      source: 'jupiter',
      cached: false,
      timestamp: new Date(fetchTime).toISOString()
    })

  } catch (error) {
    console.error('❌ Jupiter API error:', error)

    if (cachedData) {
      console.log('📦 Using stale cache as fallback')
      return NextResponse.json({
        price: cachedData.price,
        change24h: cachedData.change24h,
        liquidity: cachedData.liquidity,
        source: 'jupiter',
        cached: true,
        stale: true,
        cacheAge: Math.floor((now - cachedData.lastSuccessfulFetch) / 1000)
      })
    }

    return NextResponse.json({
      price: 0,
      change24h: 0,
      liquidity: 0,
      source: 'jupiter',
      error: 'Jupiter API unavailable',
      cached: false
    }, { status: 503 })
  }
}
