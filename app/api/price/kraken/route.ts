import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Cache persistente em memória
let cachedData: {
  result: {
    DOGUSD: {
      c: [string]
      o: string
      h: string
      l: string
      v: string
      p: string
    }
  }
  timestamp: number
  lastSuccessfulFetch: number
} | null = null

const REFRESH_INTERVAL = 30000 // 30 segundos
const API_TIMEOUT = 8000

export async function GET() {
  const now = Date.now()
  
  // Retornar cache se ainda está fresco
  if (cachedData && (now - cachedData.lastSuccessfulFetch) < REFRESH_INTERVAL) {
    console.log('📦 Using cached Kraken data (fresh)')
    return NextResponse.json({
      ...cachedData.result,
      cached: true,
      cacheAge: Math.floor((now - cachedData.lastSuccessfulFetch) / 1000)
    })
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

    return NextResponse.json({
      result: data.result,
      cached: false,
      timestamp: new Date(fetchTime).toISOString()
    })

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
      
      if (cgResponse.ok) {
        const cgData = await cgResponse.json()
        
        // Procurar ticker da Kraken no CoinGecko
        const krakenTicker = cgData.tickers?.find((t: any) => 
          t.market?.name?.toLowerCase().includes('kraken') && t.target === 'USD'
        )
        
        if (krakenTicker) {
          console.log('✅ Found Kraken price on CoinGecko:', krakenTicker.last)
          
          // Criar resposta no formato da Kraken
          const krakenFormat = {
            DOGUSD: {
              c: [krakenTicker.last.toString()],
              o: krakenTicker.last.toString(),
              h: [krakenTicker.last.toString()],
              l: [krakenTicker.last.toString()],
              v: [krakenTicker.volume?.toString() || '0'],
              p: ['0']
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
            result: krakenFormat,
            cached: false,
            source: 'coingecko',
            timestamp: new Date(fetchTime).toISOString()
          })
        }
      }
    } catch (cgError) {
      console.warn('⚠️ CoinGecko fallback also failed:', cgError)
    }

    // Se temos cache antigo, retornar
    if (cachedData) {
      console.log('📦 Using stale cache as last resort')
      return NextResponse.json({
        result: cachedData.result,
        cached: true,
        stale: true,
        cacheAge: Math.floor((now - cachedData.lastSuccessfulFetch) / 1000)
      })
    }

    // Sem cache e sem fallback, retornar erro
    return NextResponse.json({
      error: ['Kraken API unavailable'],
      result: null
    }, { status: 503 })
  }
}

