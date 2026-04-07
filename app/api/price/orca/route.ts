import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const DOG_MINT = 'dog1viwbb2vWDpER5FrJ4YFG6gq6XuyFohUe9TXN65u'

// Cache persistente em memória
let cachedData: {
  price: number
  symbol: string
  timestamp: number
  lastSuccessfulFetch: number
} | null = null

const REFRESH_INTERVAL = 30000 // 30 segundos
const API_TIMEOUT = 8000

export async function GET() {
  const now = Date.now()

  // Retornar cache se ainda está fresco
  if (cachedData && (now - cachedData.lastSuccessfulFetch) < REFRESH_INTERVAL) {
    console.log('📦 Using cached Orca data (fresh)')
    return NextResponse.json({
      price: cachedData.price,
      change24h: null,
      symbol: cachedData.symbol,
      source: 'orca',
      cached: true,
      cacheAge: Math.floor((now - cachedData.lastSuccessfulFetch) / 1000)
    })
  }

  try {
    const response = await fetch(
      `https://api.orca.so/v2/solana/tokens/${DOG_MINT}`,
      {
        cache: 'no-store',
        signal: AbortSignal.timeout(API_TIMEOUT),
        headers: {
          'Accept': 'application/json'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Orca API error: ${response.status}`)
    }

    const json = await response.json()
    const tokenData = json.data

    if (!tokenData || !tokenData.priceUsdc) {
      throw new Error('No DOG price data from Orca')
    }

    const price = parseFloat(tokenData.priceUsdc)
    const symbol = tokenData.symbol as string ?? 'DOG'

    if (isNaN(price) || price <= 0) {
      throw new Error('Invalid price from Orca')
    }

    console.log('📊 Orca DOG Price:', {
      price: `$${price.toFixed(8)}`,
      symbol
    })

    const fetchTime = Date.now()
    cachedData = {
      price,
      symbol,
      timestamp: fetchTime,
      lastSuccessfulFetch: fetchTime
    }

    console.log('✅ Orca cache updated')

    return NextResponse.json({
      price,
      change24h: null,
      symbol,
      source: 'orca',
      cached: false,
      timestamp: new Date(fetchTime).toISOString()
    })

  } catch (error) {
    console.error('❌ Orca API error:', error)

    if (cachedData) {
      console.log('📦 Using stale cache as fallback')
      return NextResponse.json({
        price: cachedData.price,
        change24h: null,
        symbol: cachedData.symbol,
        source: 'orca',
        cached: true,
        stale: true,
        cacheAge: Math.floor((now - cachedData.lastSuccessfulFetch) / 1000)
      })
    }

    return NextResponse.json({
      price: 0,
      change24h: null,
      symbol: 'DOG',
      source: 'orca',
      error: 'Orca API unavailable',
      cached: false
    }, { status: 503 })
  }
}
