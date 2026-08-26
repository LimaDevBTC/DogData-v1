import { NextResponse } from 'next/server'
import { buildPriceResponse } from '@/lib/price-normalizer'

export const dynamic = 'force-dynamic'

// Cache persistente em memória
let cachedData: {
  result: {
    DOGUSD: {
      c: [string]
      o: string
      h: [string]
      l: [string]
      v: string
      p: string
    }
  }
  timestamp: number
  lastSuccessfulFetch: number
} | null = null

const REFRESH_INTERVAL = 30000 // 30 segundos
const API_TIMEOUT = 8000

const KRAKEN_META = { exchange: 'kraken', type: 'cex' as const, chain: null, pair: 'DOG/USD' }

function krakenPayload(
  result: NonNullable<typeof cachedData>['result'],
  fetchedAt: number,
  cached: boolean,
  stale = false
) {
  const ticker = result.DOGUSD
  const price = parseFloat(ticker.c[0])
  const open = parseFloat(ticker.o)
  const high = parseFloat(ticker.h[0])
  const low = parseFloat(ticker.l[0])
  const volumeDog = parseFloat(ticker.v)
  const change_24h_pct = open > 0 ? ((price - open) / open) * 100 : null

  return buildPriceResponse({
    ...KRAKEN_META,
    price_usd: price,
    change_24h_pct,
    volume_24h_usd: Number.isFinite(volumeDog) ? volumeDog * price : null,
    high_24h: Number.isFinite(high) ? high : null,
    low_24h: Number.isFinite(low) ? low : null,
    fetched_at: new Date(fetchedAt).toISOString(),
    cached,
    stale,
    cache_age_s: cached ? Math.floor((Date.now() - fetchedAt) / 1000) : undefined,
    legacy: {
      result, // kraken raw shape preserved for existing consumers
      timestamp: new Date(fetchedAt).toISOString(),
    },
  })
}

export async function GET() {
  const now = Date.now()

  // Retornar cache se ainda está fresco
  if (cachedData && (now - cachedData.lastSuccessfulFetch) < REFRESH_INTERVAL) {
    console.log('📦 Using cached Kraken data (fresh)')
    return NextResponse.json(krakenPayload(cachedData.result, cachedData.lastSuccessfulFetch, true))
  }

  try {
    // Buscar dados da Kraken
    const response = await fetch(
      'https://api.kraken.com/0/public/Ticker?pair=DOGUSD',
      {
        cache: 'no-store',
        signal: AbortSignal.timeout(API_TIMEOUT),
        headers: {
          'Accept': 'application/json'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Kraken API error: ${response.status}`)
    }

    const data = await response.json()
    
    // Verificar se há erro na resposta
    if (data.error && data.error.length > 0) {
      throw new Error(`Kraken API error: ${data.error.join(', ')}`)
    }

    if (!data.result || !data.result.DOGUSD) {
      throw new Error('No DOGUSD data from Kraken')
    }

    const currentPrice = parseFloat(data.result.DOGUSD.c[0])
    const openPrice = parseFloat(data.result.DOGUSD.o)
    const changePercent = ((currentPrice - openPrice) / openPrice) * 100

    console.log('📊 Kraken DOG Price:', {
      price: `$${currentPrice.toFixed(8)}`,
      change24h: `${changePercent.toFixed(2)}%`,
      high: `$${parseFloat(data.result.DOGUSD.h[0]).toFixed(8)}`,
      low: `$${parseFloat(data.result.DOGUSD.l[0]).toFixed(8)}`
    })

    // Atualizar cache
    const fetchTime = Date.now()
    cachedData = {
      result: data.result,
      timestamp: fetchTime,
      lastSuccessfulFetch: fetchTime
    }

    console.log('✅ Kraken cache updated')

    return NextResponse.json(krakenPayload(data.result, fetchTime, false))

  } catch (error) {
    console.error('❌ Kraken API error:', error)

    // Tentar buscar do CoinGecko como fallback
    try {
      console.log('🔄 Trying CoinGecko as fallback for Kraken data...')
      
      const cgResponse = await fetch(
        'https://api.coingecko.com/api/v3/coins/dog-go-to-the-moon-rune/tickers',
        {
          cache: 'no-store',
          signal: AbortSignal.timeout(API_TIMEOUT),
          headers: {
            'Accept': 'application/json'
          }
        }
      )
      
      if (!cgResponse.ok) {
        throw new Error(`CoinGecko API error: ${cgResponse.status}`)
      }
      
        const cgData = await cgResponse.json()
      console.log('📊 CoinGecko response received, searching for Kraken ticker...')
        
      // Procurar ticker da Kraken no CoinGecko (case-insensitive)
      const krakenTicker = cgData.tickers?.find((t: any) => {
        const marketName = t.market?.name?.toLowerCase() || ''
        const isKraken = marketName === 'kraken'
        const isUSD = t.target === 'USD'
        return isKraken && isUSD
      })
        
        if (krakenTicker) {
        const price = krakenTicker.last
        console.log('✅ Found Kraken price on CoinGecko:', {
          price: `$${price.toFixed(8)}`,
          volume: krakenTicker.volume,
          market: krakenTicker.market.name
        })
          
          // Criar resposta no formato da Kraken
          const krakenFormat = {
            DOGUSD: {
            c: [price.toString()] as [string],
            o: price.toString(),
            h: [price.toString()] as [string],
            l: [price.toString()] as [string],
              v: krakenTicker.volume?.toString() || '0',
              p: '0'
            }
          }
          
          // Atualizar cache com dados do CoinGecko
          const fetchTime = Date.now()
          cachedData = {
            result: krakenFormat,
            timestamp: fetchTime,
            lastSuccessfulFetch: fetchTime
          }
          
          return NextResponse.json({
            ...krakenPayload(krakenFormat, fetchTime, false),
            source: 'coingecko',
          })
      } else {
        console.warn('⚠️ Kraken ticker not found in CoinGecko response')
      }
    } catch (cgError) {
      console.error('⚠️ CoinGecko fallback failed:', cgError)
    }

    // Se temos cache antigo, retornar
    if (cachedData) {
      const cacheAge = Math.floor((now - cachedData.lastSuccessfulFetch) / 1000)
      console.log('📦 Using stale cache as last resort')
      return NextResponse.json(krakenPayload(cachedData.result, cachedData.lastSuccessfulFetch, true, true))
    }

    // Sem cache e sem fallback, retornar erro
    return NextResponse.json({
      error: ['Kraken API unavailable'],
      result: null
    }, { status: 503 })
  }
}

