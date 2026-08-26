import { NextResponse } from 'next/server'
import { buildPriceResponse } from '@/lib/price-normalizer'

const GATEIO_META = { exchange: 'gateio', type: 'cex' as const, chain: null, pair: 'DOG/USDT' }

function gateioPayload(
  d: { price: number; change24h: number; volume24h: number },
  fetchedAt: number,
  cached: boolean,
  stale = false
) {
  return buildPriceResponse({
    ...GATEIO_META,
    price_usd: d.price,
    change_24h_pct: d.change24h,
    volume_24h_usd: d.volume24h,
    fetched_at: new Date(fetchedAt).toISOString(),
    cached,
    stale,
    cache_age_s: cached ? Math.floor((Date.now() - fetchedAt) / 1000) : undefined,
    legacy: {
      price: d.price,
      change24h: d.change24h,
      volume24h: d.volume24h,
      timestamp: new Date(fetchedAt).toISOString(),
    },
  })
}

export const dynamic = 'force-dynamic'

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
    return NextResponse.json(gateioPayload(cachedData, cachedData.lastSuccessfulFetch, true))
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

    return NextResponse.json(gateioPayload(
      { price: currentPrice, change24h: changePercent, volume24h: volume24h },
      fetchTime,
      false
    ))

  } catch (error) {
    console.error('❌ Gate.io API error:', error)

    // Se temos cache, retornar (mesmo que antigo)
    if (cachedData) {
      console.log('📦 Using stale cache as fallback')
      return NextResponse.json(gateioPayload(cachedData, cachedData.lastSuccessfulFetch, true, true))
    }

    // Sem cache, retornar erro com preço default
    return NextResponse.json({
      ...gateioPayload({ price: 0.00163, change24h: 0, volume24h: 0 }, Date.now(), false),
      error: 'Gate.io API unavailable',
    }, { status: 503 })
  }
}

