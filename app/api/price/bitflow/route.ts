import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Cache persistente em memória - NUNCA expira, só atualiza quando consegue dados novos
let cachedData: {
  price: number
  priceSats: number
  change24h: number
  timestamp: number
  lastSuccessfulFetch: number
} | null = null

const REFRESH_INTERVAL = 30000 // Tentar atualizar a cada 30 segundos

export async function GET() {
  const now = Date.now()
  
  // Se temos cache E ainda não passou o intervalo de refresh, retornar cache
  if (cachedData && (now - cachedData.lastSuccessfulFetch) < REFRESH_INTERVAL) {
    console.log('📦 Using cached Bitflow data (fresh)')
    return NextResponse.json({
      lastPrice: cachedData.price.toFixed(8),
      priceSats: cachedData.priceSats.toFixed(2),
      change24h: cachedData.change24h.toString(),
      volume: '0',
      cached: true,
      cacheAge: Math.floor((now - cachedData.lastSuccessfulFetch) / 1000)
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

    // Preço em USD: quanto vale 1 DOG em USD
    const dogUsdPrice = btcPrice / btcDogRate
    
    // Preço em satoshis: 1 BTC = 100,000,000 sats
    // Se 1 BTC = 64,099,926 DOG
    // Então 1 DOG = 100,000,000 / 64,099,926 = 1.56 sats
    const dogSatsPrice = 100000000 / btcDogRate
    
    // Extrair volume
    const volume = parseFloat(dogTicker.base_volume) || 0
    
    // Buscar variação 24h da Kraken como referência (mais confiável)
    let change24h = cachedData?.change24h || 0 // Usar cache anterior se disponível
    try {
      const krakenResponse = await fetch('https://api.kraken.com/0/public/Ticker?pair=DOGUSD', {
        cache: 'no-store',
        signal: AbortSignal.timeout(5000) // Timeout de 5 segundos
      })
      const krakenData = await krakenResponse.json()
      
      if (krakenData.result && krakenData.result.DOGUSD) {
        const krakenPrice = parseFloat(krakenData.result.DOGUSD.c[0])
        const krakenOpen = parseFloat(krakenData.result.DOGUSD.o)
        change24h = ((krakenPrice - krakenOpen) / krakenOpen) * 100
        console.log('📊 Using Kraken change24h as reference:', change24h.toFixed(2) + '%')
      } else if (cachedData) {
        console.log('📊 Using cached change24h:', cachedData.change24h.toFixed(2) + '%')
      }
    } catch (error) {
      if (cachedData) {
        console.warn('⚠️ Kraken fetch failed, using cached change24h:', cachedData.change24h.toFixed(2) + '%')
      } else {
        console.warn('⚠️ Could not fetch Kraken change24h and no cache, using 0%')
      }
    }

    console.log('📊 Bitflow DOG Price Calculation:', {
      step1_btcPrice: `$${btcPrice.toFixed(2)}`,
      step2_btcDogRate: btcDogRate.toLocaleString(),
      step3_dogUsdPrice: `$${dogUsdPrice.toFixed(8)}`,
      step4_dogSatsPrice: `${dogSatsPrice.toFixed(2)} sats`,
      step5_change24h: change24h.toFixed(2) + '%',
      ticker: dogTicker.ticker_id
    })

    // Atualizar cache com dados frescos
    const fetchTime = Date.now()
    cachedData = {
      price: dogUsdPrice,
      priceSats: dogSatsPrice,
      change24h: change24h,
      timestamp: fetchTime,
      lastSuccessfulFetch: fetchTime
    }

    console.log('✅ Cache updated with fresh data')

    return NextResponse.json({
      lastPrice: dogUsdPrice.toFixed(8),
      priceSats: dogSatsPrice.toFixed(2),
      change24h: change24h.toString(),
      volume: volume.toString(),
      ticker_id: dogTicker.ticker_id,
      liquidity: dogTicker.liquidity_in_usd || 0,
      btcPrice: btcPrice,
      cached: false,
      change24hSource: 'Kraken'
    })

  } catch (error) {
    console.error('❌ Bitflow API Error:', error)
    
    // SEMPRE retornar cache se existir - NUNCA mostrar erro ao usuário
    if (cachedData) {
      const cacheAge = Math.floor((Date.now() - cachedData.lastSuccessfulFetch) / 1000)
      console.log(`⚠️ API failed, using cache from ${cacheAge}s ago`)
      
      return NextResponse.json({
        lastPrice: cachedData.price.toFixed(8),
        priceSats: cachedData.priceSats.toFixed(2),
        change24h: cachedData.change24h.toString(),
        volume: '0',
        cached: true,
        stale: true,
        cacheAge: cacheAge,
        error: 'API temporarily unavailable, showing cached data'
      })
    }
    
    // Só retorna erro se NÃO tiver cache nenhum (primeira requisição)
    console.error('💥 No cache available, returning error')
    return NextResponse.json(
      { 
        error: 'Failed to fetch Bitflow price',
        details: 'Service temporarily unavailable. Please try again in a moment.'
      },
      { status: 503 } // Service Unavailable, não 500
    )
  }
}

