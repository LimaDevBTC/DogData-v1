import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface MarketTicker {
  market: {
    name: string
  }
  base: string
  target: string
  last: number
  volume: number
  bid_ask_spread_percentage: number
  trust_score: string
  trade_url: string
  converted_volume: {
    usd: number
  }
}

interface MarketData {
  current_price: { usd: number }
  total_volume: { usd: number }
  market_cap: { usd: number }
  price_change_percentage_24h: number
}

// Cache persistente - NUNCA expira, só atualiza quando consegue dados novos
let cachedData: {
  tickers: any[]
  marketData: {
    price: number
    totalVolume: number
    marketCap: number
    priceChange24h: number
  }
  timestamp: number
  lastSuccessfulFetch: number
} | null = {
  // Cache inicial completo com todas as 22 exchanges (21 CoinGecko + 1 Bitflow)
  tickers: [
    // Bitflow DEX (sempre no topo)
    { market: 'Bitflow', pair: 'DOG/pBTC', price: 0.00176, volumeUsd: 50, volume: 28000, spread: 0.50, trustScore: 'green', tradeUrl: 'https://btflw.link/brl' },
    // Green trust score (15 exchanges)
    { market: 'MEXC', pair: 'DOG/USDT', price: 0.00163, volumeUsd: 443000, volume: 271000000, spread: 0.55, trustScore: 'green', tradeUrl: 'https://www.mexc.com/exchange/DOG_USDT' },
    { market: 'Pionex', pair: 'DOG/USDT', price: 0.00162, volumeUsd: 495000, volume: 305000000, spread: 0.25, trustScore: 'green', tradeUrl: 'https://www.pionex.com/en/trade/DOG_USDT/Bot' },
    { market: 'Gate', pair: 'DOG/USDT', price: 0.00163, volumeUsd: 538000, volume: 329700000, spread: 0.13, trustScore: 'green', tradeUrl: 'https://www.gate.com/trade/DOG_USDT' },
    { market: 'Hotcoin', pair: 'DOG/USDT', price: 0.00162, volumeUsd: 484000, volume: 298000000, spread: 0.26, trustScore: 'green', tradeUrl: 'https://www.hotcoin.com/currencyExchange/dog_usdt' },
    { market: 'Bitget', pair: 'DOG/USDT', price: 0.00163, volumeUsd: 401000, volume: 245000000, spread: 0.24, trustScore: 'green', tradeUrl: 'https://www.bitget.com/spot/DOGUSDT' },
    { market: 'DigiFinex', pair: 'DOG/USDT', price: 0.00163, volumeUsd: 281000, volume: 172000000, spread: 0.30, trustScore: 'green', tradeUrl: 'https://www.digifinex.com/en-ww/trade/USDT/DOG' },
    { market: 'WEEX', pair: 'DOG/USDT', price: 0.00160, volumeUsd: 36000, volume: 22000000, spread: 0.50, trustScore: 'green', tradeUrl: 'https://www.weex.com/trade/dog_usdt' },
    { market: 'Kraken', pair: 'DOG/USD', price: 0.00164, volumeUsd: 214000, volume: 130000000, spread: 0.61, trustScore: 'green', tradeUrl: 'https://pro.kraken.com/app/trade/DOG-USD' },
    { market: 'CoinEx', pair: 'DOG/USDT', price: 0.00159, volumeUsd: 55000, volume: 34000000, spread: 0.38, trustScore: 'green', tradeUrl: 'https://www.coinex.com/exchange/dog-usdt' },
    { market: 'Ourbit', pair: 'DOG/USDT', price: 0.00163, volumeUsd: 75000, volume: 45000000, spread: 0.18, trustScore: 'green', tradeUrl: 'https://www.ourbit.com/exchange/DOG_USDT' },
    { market: 'XT.COM', pair: 'DOG/USDT', price: 0.00162, volumeUsd: 133000, volume: 82000000, spread: 0.37, trustScore: 'green', tradeUrl: 'https://www.xt.com/en/trade/dog_usdt' },
    { market: 'BingX', pair: 'DOG/USDT', price: 0.00163, volumeUsd: 76000, volume: 46000000, spread: 0.06, trustScore: 'green', tradeUrl: 'https://bingx.com/en-us/spot/DOGUSDT' },
    { market: 'BitKan', pair: 'DOG/USDT', price: 0.00158, volumeUsd: 43000, volume: 27000000, spread: 0.28, trustScore: 'green', tradeUrl: 'https://www.bitkan.com/trade/dog-usdt' },
    { market: 'Kraken', pair: 'DOG/EUR', price: 0.00135, volumeUsd: 45000, volume: 29000000, spread: 0.74, trustScore: 'green', tradeUrl: 'https://pro.kraken.com/app/trade/DOG-EUR' },
    { market: 'Tapbit', pair: 'DOG/USDT', price: 0.00159, volumeUsd: 60000, volume: 37000000, spread: 1.21, trustScore: 'green', tradeUrl: 'https://www.tapbit.com/trade/dog-usdt' },
    // Yellow trust score (6 exchanges)
    { market: 'Hibt', pair: 'DOG/USDT', price: 0.00158, volumeUsd: 33000, volume: 20000000, spread: 0.45, trustScore: 'yellow', tradeUrl: 'https://www.hibt.com/trade/dog_usdt' },
    { market: 'BitMart', pair: 'DOG/USDT', price: 0.00161, volumeUsd: 29000, volume: 18000000, spread: 1.74, trustScore: 'yellow', tradeUrl: 'https://www.bitmart.com/trade/dog-usdt' },
    { market: 'Bitrue', pair: 'DOG/USDT', price: 0.00160, volumeUsd: 25000, volume: 15000000, spread: 0.85, trustScore: 'yellow', tradeUrl: 'https://www.bitrue.com/trade/dog_usdt' },
    { market: 'CoinW', pair: 'DOG/USDT', price: 0.00162, volumeUsd: 22000, volume: 13000000, spread: 2.02, trustScore: 'yellow', tradeUrl: 'https://www.coinw.com/trade/dog-usdt' },
    { market: 'NovaDAX', pair: 'DOG/BRL', price: 0.00852, volumeUsd: 15000, volume: 9000000, spread: 1.17, trustScore: 'yellow', tradeUrl: 'https://www.novadax.com.br/trade/dog-brl' },
    { market: 'Mercado Bitcoin', pair: 'DOG/BRL', price: 0.00850, volumeUsd: 12000, volume: 7000000, spread: 1.50, trustScore: 'yellow', tradeUrl: 'https://www.mercadobitcoin.com.br/trade/dog-brl' }
  ],
  marketData: {
    price: 0.00163,
    totalVolume: 3890000,
    marketCap: 162360000,
    priceChange24h: 0
  },
  timestamp: Date.now(),
  lastSuccessfulFetch: Date.now() - 600000 // 10 min atrás
}

const REFRESH_INTERVAL = 60000 // 60 segundos
const API_TIMEOUT = 10000 // 10 segundos

export async function GET() {
  const now = Date.now()
  
  // Se temos cache E ainda não passou o intervalo de refresh, retornar cache
  if (cachedData && (now - cachedData.lastSuccessfulFetch) < REFRESH_INTERVAL) {
    console.log('📦 Using cached markets data (fresh)')
    return NextResponse.json({
      ...cachedData,
      cached: true,
      cacheAge: Math.floor((now - cachedData.lastSuccessfulFetch) / 1000)
    })
  }

  try {
    // Buscar dados do CoinGecko com timeout
    const response = await fetch(
      'https://api.coingecko.com/api/v3/coins/dog-go-to-the-moon-rune/tickers',
      {
        cache: 'no-store',
        signal: AbortSignal.timeout(API_TIMEOUT),
        headers: {
          'Accept': 'application/json'
        }
      }
    )

    if (!response.ok) {
      console.warn(`⚠️ CoinGecko API returned ${response.status}`)
      throw new Error(`CoinGecko API error: ${response.status}`)
    }

    const data = await response.json()
    
    // Processar tickers - filtrar apenas exchanges relevantes
    const tickers = data.tickers
      .filter((t: MarketTicker) => {
        // Filtrar apenas pares relevantes (DOG/USDT, DOG/USD, DOG/EUR, DOG/BRL)
        const validPairs = ['USDT', 'USD', 'EUR', 'BRL']
        const isValidPair = validPairs.includes(t.target)
        
        // Filtrar preços absurdos (muito diferentes da média)
        const isReasonablePrice = t.last > 0.00001 && t.last < 0.01
        
        // Apenas exchanges com trust score válido
        const hasTrustScore = t.trust_score && ['green', 'yellow'].includes(t.trust_score)
        
        return isValidPair && isReasonablePrice && hasTrustScore
      })
      .map((t: MarketTicker) => ({
        market: t.market.name,
        pair: `${t.base}/${t.target}`,
        price: t.last,
        volumeUsd: t.converted_volume.usd,
        volume: t.volume,
        spread: t.bid_ask_spread_percentage,
        trustScore: t.trust_score,
        tradeUrl: t.trade_url
      }))
      .sort((a: any, b: any) => b.volumeUsd - a.volumeUsd) // Ordenar por volume
      .slice(0, 20) // Top 20 exchanges principais

    // Buscar dados gerais de mercado
    const marketResponse = await fetch(
      'https://api.coingecko.com/api/v3/coins/dog-go-to-the-moon-rune',
      {
        cache: 'no-store',
        signal: AbortSignal.timeout(API_TIMEOUT),
        headers: {
          'Accept': 'application/json'
        }
      }
    )

    let marketData = cachedData?.marketData || {
      price: 0.00163,
      totalVolume: 3890000,
      marketCap: 162360000,
      priceChange24h: 0
    }

    if (marketResponse.ok) {
      const marketJson = await marketResponse.json()
      const md: MarketData = marketJson.market_data
      
      marketData = {
        price: md.current_price.usd,
        totalVolume: md.total_volume.usd,
        marketCap: md.market_cap.usd,
        priceChange24h: md.price_change_percentage_24h || 0
      }
    }

    // Adicionar Bitflow manualmente (sempre presente)
    try {
      const bitflowRes = await fetch('https://bitflow-sdk-api-gateway-7owjsmt8.uc.gateway.dev/ticker', {
        cache: 'no-store',
        signal: AbortSignal.timeout(API_TIMEOUT)
      })
      
      if (bitflowRes.ok) {
        const bitflowData = await bitflowRes.json()
        const dogTicker = bitflowData.find((t: any) => 
          t.ticker_id?.toUpperCase().includes('PBTC') && t.ticker_id?.toUpperCase().includes('DOG')
        )
        
        if (dogTicker) {
          // Buscar preço do BTC
          const btcRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd', {
            cache: 'no-store',
            signal: AbortSignal.timeout(API_TIMEOUT)
          })
          const btcData = await btcRes.json()
          const btcPrice = btcData.bitcoin?.usd || 0
          
          if (btcPrice > 0) {
            const btcDogRate = parseFloat(dogTicker.last_price) || 0
            const dogUsdPrice = btcPrice / btcDogRate
            const volumeDog = parseFloat(dogTicker.target_volume) || 0
            const volumeUsd = volumeDog * dogUsdPrice
            
            const bitflowTicker = {
              market: 'Bitflow',
              pair: 'DOG/pBTC',
              price: dogUsdPrice,
              volumeUsd: volumeUsd,
              volume: volumeDog,
              spread: 0.50,
              trustScore: 'green',
              tradeUrl: 'https://btflw.link/brl'
            }
            
            // Adicionar Bitflow no topo
            tickers.unshift(bitflowTicker)
            console.log('✅ Bitflow added to markets:', { price: dogUsdPrice.toFixed(8), volumeDog, volumeUsd: volumeUsd.toFixed(2) })
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to fetch Bitflow for markets, using cache value')
    }

    console.log('📊 Markets data updated:', {
      exchanges: tickers.length,
      totalVolume: `$${marketData.totalVolume.toFixed(0)}`,
      price: `$${marketData.price.toFixed(8)}`
    })

    // Atualizar cache com dados frescos (incluindo Bitflow)
    const fetchTime = Date.now()
    cachedData = {
      tickers,
      marketData,
      timestamp: fetchTime,
      lastSuccessfulFetch: fetchTime
    }

    console.log('✅ Markets cache updated with fresh data')

    return NextResponse.json({
      ...cachedData,
      cached: false
    })

  } catch (error) {
    console.error('❌ Markets API Error:', error)
    
    // SEMPRE retornar cache se existir - NUNCA mostrar erro ao usuário
    if (cachedData) {
      const cacheAge = Math.floor((Date.now() - cachedData.lastSuccessfulFetch) / 1000)
      console.log(`⚠️ API failed, using cache from ${cacheAge}s ago`)
      
      return NextResponse.json({
        ...cachedData,
        cached: true,
        stale: true,
        cacheAge: cacheAge
      })
    }
    
    // Só retorna erro se NÃO tiver cache nenhum (primeira requisição)
    console.error('💥 No cache available, returning error')
    return NextResponse.json(
      { 
        error: 'Failed to fetch markets data',
        details: 'Service temporarily unavailable'
      },
      { status: 503 }
    )
  }
}

