import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Cache em memória com TTL de 30 segundos
let cachedData: {
  price: number
  change24h: number
  timestamp: number
} | null = null

const CACHE_TTL = 30000 // 30 segundos

export async function GET() {
  // Verificar cache primeiro
  const now = Date.now()
  if (cachedData && (now - cachedData.timestamp) < CACHE_TTL) {
    console.log('📦 Using cached Bitflow data')
    return NextResponse.json({
      lastPrice: cachedData.price.toFixed(8),
      change24h: cachedData.change24h.toString(),
      volume: '0',
      cached: true,
      cacheAge: Math.floor((now - cachedData.timestamp) / 1000)
    })
  }
  try {
    // 1. Buscar preço do Bitcoin do CoinGecko (mais confiável para API routes)
    const btcResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd', {
      cache: 'no-store',
      headers: {
        'Accept': 'application/json'
      }
    })
    
    if (!btcResponse.ok) {
      throw new Error(`Failed to fetch BTC price: ${btcResponse.status}`)
    }
    
    const btcData = await btcResponse.json()
    const btcPrice = btcData.bitcoin?.usd || 0

    if (!btcPrice) {
      throw new Error('BTC price not available')
    }
    
    console.log('📊 BTC Price:', btcPrice)

    // 2. Buscar ticker da Bitflow
    const response = await fetch(
      'https://bitflow-sdk-api-gateway-7owjsmt8.uc.gateway.dev/ticker',
      {
        cache: 'no-store',
        headers: {
          'Accept': 'application/json'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Bitflow API error: ${response.status}`)
    }

    const data = await response.json()
    
    // Procurar pelo par pBTC/DOG (Bitcoin/DOG)
    const dogTicker = data.find((ticker: any) => {
      const tickerIdUpper = ticker.ticker_id?.toUpperCase() || ''
      return tickerIdUpper.includes('PBTC') && tickerIdUpper.includes('DOG')
    })

    if (!dogTicker) {
      console.warn('⚠️ DOG/BTC ticker not found on Bitflow')
      return NextResponse.json(
        { error: 'DOG ticker not found' },
        { status: 404 }
      )
    }

    // 3. Converter pBTC/DOG para USD/DOG
    // O last_price representa quantos DOG você recebe por 1 BTC
    // Se pBTC/DOG = 64,099,926 (você recebe 64M DOG por 1 BTC)
    // Então 1 DOG = BTC_USD / pBTC_DOG
    // Exemplo: $97,000 / 64,099,926 = $0.00151
    const btcDogRate = parseFloat(dogTicker.last_price) || 0
    
    if (btcDogRate === 0) {
      throw new Error('Invalid BTC/DOG rate')
    }

    // Preço simples: quanto vale 1 DOG em USD
    const dogUsdPrice = btcPrice / btcDogRate
    
    // Extrair outros dados
    const volume = parseFloat(dogTicker.base_volume) || 0
    const high = parseFloat(dogTicker.high) || 0
    const low = parseFloat(dogTicker.low) || 0
    
    // Calcular mudança 24h com base no high/low em USD
    let change24h = 0
    if (high > 0 && low > 0) {
      const highUsd = btcPrice / high
      const lowUsd = btcPrice / low
      const midPrice = (highUsd + lowUsd) / 2
      change24h = ((dogUsdPrice - midPrice) / midPrice) * 100
    }

    console.log('📊 Bitflow DOG Price Calculation:', {
      step1_btcPrice: `$${btcPrice.toFixed(2)}`,
      step2_btcDogRate: btcDogRate.toLocaleString(),
      step3_dogUsdPrice: dogUsdPrice.toFixed(8),
      step4_change24h: change24h.toFixed(2) + '%',
      ticker: dogTicker.ticker_id
    })

    // Atualizar cache
    cachedData = {
      price: dogUsdPrice,
      change24h: change24h,
      timestamp: Date.now()
    }

    return NextResponse.json({
      lastPrice: dogUsdPrice.toFixed(8),
      change24h: change24h.toString(),
      volume: volume.toString(),
      high: high.toString(),
      low: low.toString(),
      ticker_id: dogTicker.ticker_id,
      liquidity: dogTicker.liquidity_in_usd || 0,
      btcPrice: btcPrice,
      cached: false
    })

  } catch (error) {
    console.error('❌ Bitflow API Error:', error)
    
    // Se temos cache antigo, usar como fallback
    if (cachedData) {
      console.log('⚠️ Using stale cache as fallback')
      return NextResponse.json({
        lastPrice: cachedData.price.toFixed(8),
        change24h: cachedData.change24h.toString(),
        volume: '0',
        cached: true,
        stale: true,
        cacheAge: Math.floor((Date.now() - cachedData.timestamp) / 1000)
      })
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch Bitflow price',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

