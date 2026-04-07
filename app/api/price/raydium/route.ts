import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const DOG_MINT = 'dog1viwbb2vWDpER5FrJ4YFG6gq6XuyFohUe9TXN65u'

// Cache persistente em memória
let cachedData: {
  price: number
  change24h: number | null
  timestamp: number
  lastSuccessfulFetch: number
} | null = null

const REFRESH_INTERVAL = 30000 // 30 segundos
const API_TIMEOUT = 8000

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

  if (cachedData && (now - cachedData.lastSuccessfulFetch) < REFRESH_INTERVAL) {
    console.log('📦 Using cached Raydium data (fresh)')
    return NextResponse.json({
      price: cachedData.price,
      change24h: cachedData.change24h,
      source: 'raydium',
      cached: true,
      cacheAge: Math.floor((now - cachedData.lastSuccessfulFetch) / 1000)
    })
  }

  try {
    const [response, change24h] = await Promise.all([
      fetch(
        `https://api-v3.raydium.io/mint/price?mints=${DOG_MINT}`,
        {
          cache: 'no-store',
          signal: AbortSignal.timeout(API_TIMEOUT),
          headers: { 'Accept': 'application/json' }
        }
      ),
      fetchJupiterChange()
    ])

    if (!response.ok) throw new Error(`Raydium API error: ${response.status}`)

    const data = await response.json()

    if (!data.success) throw new Error('Raydium API returned success=false')

    const price = parseFloat(data.data?.[DOG_MINT])
    if (isNaN(price) || price <= 0) throw new Error('Invalid DOG price from Raydium')

    console.log('📊 Raydium DOG Price:', { price: `$${price.toFixed(8)}`, change24h })

    const fetchTime = Date.now()
    cachedData = { price, change24h, timestamp: fetchTime, lastSuccessfulFetch: fetchTime }

    console.log('✅ Raydium cache updated')

    return NextResponse.json({
      price,
      change24h,
      source: 'raydium',
      cached: false,
      timestamp: new Date(fetchTime).toISOString()
    })

  } catch (error) {
    console.error('❌ Raydium API error:', error)

    if (cachedData) {
      console.log('📦 Using stale cache as fallback')
      return NextResponse.json({
        price: cachedData.price,
        change24h: cachedData.change24h,
        source: 'raydium',
        cached: true,
        stale: true,
        cacheAge: Math.floor((now - cachedData.lastSuccessfulFetch) / 1000)
      })
    }

    return NextResponse.json({
      price: 0,
      change24h: null,
      source: 'raydium',
      error: 'Raydium API unavailable',
      cached: false
    }, { status: 503 })
  }
}
