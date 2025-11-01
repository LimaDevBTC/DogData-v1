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
    console.log('📦 Using cached Pionex data (fresh)')
    return NextResponse.json({
      price: cachedData.price,
      change24h: cachedData.change24h,
      volume24h: cachedData.volume24h,
      cached: true,
      cacheAge: Math.floor((now - cachedData.lastSuccessfulFetch) / 1000)
    })
  }

  try {
    // Buscar dados da Pionex
    const response = await fetch(
      'https://api.pionex.com/api/v1/market/tickers',
      {
        cache: 'no-store',
        signal: AbortSignal.timeout(API_TIMEOUT),
        headers: {
          'Accept': 'application/json'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Pionex API error: ${response.status}`)
    }

    const result = await response.json()
    
    if (!result.data || !result.data.tickers) {
      throw new Error('No data from Pionex')
    }

    // Procurar pelo par DOG_USDT
    const dogTicker = result.data.tickers.find((t: any) => t.symbol === 'DOG_USDT')
    
    if (!dogTicker) {
      throw new Error('DOG_USDT not found on Pionex')
    }

    const currentPrice = parseFloat(dogTicker.close)
    const openPrice = parseFloat(dogTicker.open)
    // Calcular mudança percentual manualmente
    const changePercent = ((currentPrice - openPrice) / openPrice) * 100
    const volume24h = parseFloat(dogTicker.amount || dogTicker.quoteVolume || 0)

    console.log('📊 Pionex DOG Price:', {
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

    console.log('✅ Pionex cache updated')

    return NextResponse.json({
      price: currentPrice,
      change24h: changePercent,
      volume24h: volume24h,
      cached: false,
      timestamp: new Date(fetchTime).toISOString()
    })

  } catch (error) {
    console.error('❌ Pionex API error:', error)

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
      error: 'Pionex API unavailable',
      cached: false
    }, { status: 503 })
  }
}

