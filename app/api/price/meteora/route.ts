import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const DOG_MINT = 'dog1viwbb2vWDpER5FrJ4YFG6gq6XuyFohUe9TXN65u'

// Cache persistente em memória
let cachedData: {
  price: number
  change24h: number | null
  tvl: number
  pool: string
  timestamp: number
  lastSuccessfulFetch: number
} | null = null

const REFRESH_INTERVAL = 30000 // 30 segundos
const API_TIMEOUT = 8000

interface MeteoraPool {
  pool_name: string
  pool_token_mints: string[]
  pool_token_amounts: string[]
  pool_token_usd_amounts: string[]
  pool_tvl: string
}

async function fetchJupiterChange(): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.jup.ag/price/v3?ids=${DOG_MINT}`,
      { cache: 'no-store', signal: AbortSignal.timeout(API_TIMEOUT), headers: { 'Accept': 'application/json' } }
    )
    if (!res.ok) return null
    const json = await res.json()
    const change = json[DOG_MINT]?.priceChange24h
    return typeof change === 'number' ? change : null
  } catch {
    return null
  }
}

export async function GET() {
  const now = Date.now()

  // Retornar cache se ainda está fresco
  if (cachedData && (now - cachedData.lastSuccessfulFetch) < REFRESH_INTERVAL) {
    console.log('📦 Using cached Meteora data (fresh)')
    return NextResponse.json({
      price: cachedData.price,
      change24h: cachedData.change24h,
      tvl: cachedData.tvl,
      pool: cachedData.pool,
      source: 'meteora',
      cached: true,
      cacheAge: Math.floor((now - cachedData.lastSuccessfulFetch) / 1000)
    })
  }

  try {
    const [response, change24h] = await Promise.all([
      fetch(
        `https://damm-api.meteora.ag/pools/search?page=0&size=5&include_token_mints=${DOG_MINT}`,
        {
          cache: 'no-store',
          signal: AbortSignal.timeout(API_TIMEOUT),
          headers: { 'Accept': 'application/json' }
        }
      ),
      fetchJupiterChange()
    ])

    if (!response.ok) {
      throw new Error(`Meteora API error: ${response.status}`)
    }

    const json = await response.json()
    const pools: MeteoraPool[] = json.data

    if (!pools || pools.length === 0) {
      throw new Error('No DOG pools found on Meteora')
    }

    // Usar o pool com maior TVL
    const pool = pools.reduce((best, p) =>
      parseFloat(p.pool_tvl) > parseFloat(best.pool_tvl) ? p : best
    )

    const dogIdx = pool.pool_token_mints.indexOf(DOG_MINT)
    if (dogIdx === -1) {
      throw new Error('DOG mint not found in pool token mints')
    }

    const dogUsdAmount = parseFloat(pool.pool_token_usd_amounts[dogIdx])
    const dogTokenAmount = parseFloat(pool.pool_token_amounts[dogIdx])

    if (dogTokenAmount <= 0) {
      throw new Error('Invalid DOG token amount in pool')
    }

    const price = dogUsdAmount / dogTokenAmount
    const tvl = parseFloat(pool.pool_tvl)

    if (isNaN(price) || price <= 0) {
      throw new Error('Invalid price calculated from Meteora pool')
    }

    console.log('📊 Meteora DOG Price:', {
      price: `$${price.toFixed(8)}`,
      pool: pool.pool_name,
      tvl: `$${tvl.toFixed(2)}`,
      change24h
    })

    const fetchTime = Date.now()
    cachedData = {
      price,
      change24h,
      tvl,
      pool: pool.pool_name,
      timestamp: fetchTime,
      lastSuccessfulFetch: fetchTime
    }

    console.log('✅ Meteora cache updated')

    return NextResponse.json({
      price,
      change24h,
      tvl,
      pool: pool.pool_name,
      source: 'meteora',
      cached: false,
      timestamp: new Date(fetchTime).toISOString()
    })

  } catch (error) {
    console.error('❌ Meteora API error:', error)

    if (cachedData) {
      console.log('📦 Using stale cache as fallback')
      return NextResponse.json({
        price: cachedData.price,
        change24h: cachedData.change24h,
        tvl: cachedData.tvl,
        pool: cachedData.pool,
        source: 'meteora',
        cached: true,
        stale: true,
        cacheAge: Math.floor((now - cachedData.lastSuccessfulFetch) / 1000)
      })
    }

    return NextResponse.json({
      price: 0,
      change24h: null,
      tvl: 0,
      pool: null,
      source: 'meteora',
      error: 'Meteora API unavailable',
      cached: false
    }, { status: 503 })
  }
}
