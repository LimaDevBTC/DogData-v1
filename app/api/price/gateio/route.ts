import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Cache persistente em memória
let cachedData: {
  price: number
  change24h: number
  volume24h: number
  timestamp: number
  lastSuccessfulFetch: number
} | null = null

const REFRESH_INTERVAL = 30000 // 30 segundos
const API_TIMEOUT = 8000

export async function GET() {
  const now = Date.now()
  
  // Retornar cache se ainda está fresco
  if (cachedData && (now - cachedData.lastSuccessfulFetch) < REFRESH_INTERVAL) {
    console.log('📦 Using cached Gate.io data (fresh)')
    return NextResponse.json({
      price: cachedData.price,
      change24h: cachedData.change24h,
      volume24h: cachedData.volume24h,
      cached: true,
      cacheAge: Math.floor((now - cachedData.lastSuccessfulFetch) / 1000)
    })
  }

  try {
    // Buscar dados da Gate.io
    const response = await fetch(
      'https://api.gateio.ws/api/v4/spot/tickers?currency_pair=DOG_USDT',
      {
        cache: 'no-store',
        signal: AbortSignal.timeout(API_TIMEOUT),
        headers: {
          'Accept': 'application/json'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Gate.io API error: ${response.status}`)
    }

    const data = await response.json()
    
    if (!data || data.length === 0) {
      throw new Error('No data from Gate.io')
    }

    const ticker = data[0]
    const currentPrice = parseFloat(ticker.last)
    const changePercent = parseFloat(ticker.change_percentage)
    const volume24h = parseFloat(ticker.quote_volume)

    console.log('📊 Gate.io DOG Price:', {
      price: `$${currentPrice.toFixed(8)}`,
      change24h: `${changePercent.toFixed(2)}%`,
      volume24h: `$${volume24h.toLocaleString()}`
    })

    // Atualizar cache
    const fetchTime = Date.now()
    cachedData = {
      price: currentPrice,
      change24h: changePercent,
      volume24h: volume24h,
      timestamp: fetchTime,
      lastSuccessfulFetch: fetchTime
    }

    console.log('✅ Gate.io cache updated')

    return NextResponse.json({
      price: currentPrice,
      change24h: changePercent,
      volume24h: volume24h,
      cached: false,
      timestamp: new Date(fetchTime).toISOString()
    })

  } catch (error) {
    console.error('❌ Gate.io API error:', error)

    // Se temos cache, retornar (mesmo que antigo)
    if (cachedData) {
      console.log('📦 Using stale cache as fallback')
      return NextResponse.json({
        price: cachedData.price,
        change24h: cachedData.change24h,
        volume24h: cachedData.volume24h,
        cached: true,
        stale: true,
        cacheAge: Math.floor((now - cachedData.lastSuccessfulFetch) / 1000)
      })
    }

    // Sem cache, retornar erro com preço default
    return NextResponse.json({
      price: 0.00163,
      change24h: 0,
      volume24h: 0,
      error: 'Gate.io API unavailable',
      cached: false
    }, { status: 503 })
  }
}

