import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    // 1. Buscar preço do Bitcoin da nossa própria API
    const btcResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/bitcoin/price`, {
      cache: 'no-store'
    })
    const btcData = await btcResponse.json()
    const btcPrice = btcData.price || 0

    if (!btcPrice) {
      throw new Error('Failed to fetch BTC price from our API')
    }

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
    // O last_price está em satoshis (1 BTC = 100,000,000 satoshis)
    // Se pBTC/DOG = 64,099,926 satoshis de DOG por 1 BTC
    // Então DOG/USD = (BTC_USD / pBTC_DOG) * 100,000,000
    const btcDogRate = parseFloat(dogTicker.last_price) || 0
    
    if (btcDogRate === 0) {
      throw new Error('Invalid BTC/DOG rate')
    }

    // Converter para o preço correto considerando satoshis
    const dogUsdPrice = (btcPrice / btcDogRate) * 100000000
    
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

    console.log('📊 Bitflow DOG Price:', {
      btcPrice: `$${btcPrice.toFixed(2)}`,
      btcDogRate: btcDogRate,
      dogUsdPrice: `$${dogUsdPrice.toFixed(8)}`,
      change24h: change24h.toFixed(2) + '%',
      ticker: dogTicker.ticker_id
    })

    return NextResponse.json({
      lastPrice: dogUsdPrice.toFixed(8),
      change24h: change24h.toString(),
      volume: volume.toString(),
      high: high.toString(),
      low: low.toString(),
      ticker_id: dogTicker.ticker_id,
      liquidity: dogTicker.liquidity_in_usd || 0,
      btcPrice: btcPrice
    })

  } catch (error) {
    console.error('❌ Bitflow API Error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch Bitflow price',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

