import { NextResponse } from 'next/server'
import { buildPriceResponse } from '@/lib/price-normalizer'

const MEXC_META = { exchange: 'mexc', type: 'cex' as const, chain: null, pair: 'DOG/USDT' }

function mexcPayload(
  d: { price: number; change24h: number; volume24h: number },
  fetchedAt: number,
  cached: boolean,
  stale = false
) {
  return buildPriceResponse({
    ...MEXC_META,
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
    console.log('📦 Using cached MEXC data (fresh)')
    return NextResponse.json(mexcPayload(cachedData, cachedData.lastSuccessfulFetch, true))
  }

  try {
    // Buscar dados da MEXC
    const response = await fetch(
      'https://api.mexc.com/api/v3/ticker/24hr?symbol=DOGUSDT',
      {
        cache: 'no-store',
        signal: AbortSignal.timeout(API_TIMEOUT),
        headers: {
          'Accept': 'application/json'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`MEXC API error: ${response.status}`)
    }

    const data = await response.json()
    
    const currentPrice = parseFloat(data.lastPrice)
    // MEXC API retorna em formato decimal (0.07 = 7%), precisa multiplicar por 100
    const changePercent = parseFloat(data.priceChangePercent) * 100
    const volume24h = parseFloat(data.quoteVolume)

    console.log('📊 MEXC DOG Price:', {
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

    console.log('✅ MEXC cache updated')

    return NextResponse.json(mexcPayload(
      { price: currentPrice, change24h: changePercent, volume24h: volume24h },
      fetchTime,
      false
    ))

  } catch (error) {
    console.error('❌ MEXC API error:', error)

    // Se temos cache, retornar (mesmo que antigo)
    if (cachedData) {
      console.log('📦 Using stale cache as fallback')
      return NextResponse.json(mexcPayload(cachedData, cachedData.lastSuccessfulFetch, true, true))
    }

    return NextResponse.json({
      ...mexcPayload({ price: 0.00163, change24h: 0, volume24h: 0 }, Date.now(), false),
      error: 'MEXC API unavailable',
    }, { status: 503 })
  }
}

