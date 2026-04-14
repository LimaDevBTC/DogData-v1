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

// ─── Solana DEX trade URLs ────────────────────────────────────────
const DOG_MINT = 'dog1viwbb2vWDpER5FrJ4YFG6gq6XuyFohUe9TXN65u'

const SOLANA_DEXS = [
  {
    market: 'Jupiter',
    pair: 'DOG/SOL',
    route: '/api/price/jupiter',
    tradeUrl: `https://jup.ag/swap/SOL-${DOG_MINT}`,
  },
  {
    market: 'Meteora',
    pair: 'DOG/SOL',
    route: '/api/price/meteora',
    tradeUrl: 'https://app.meteora.ag/',
  },
  {
    market: 'Orca',
    pair: 'DOG/SOL',
    route: '/api/price/orca',
    tradeUrl: `https://www.orca.so/?inputMint=So11111111111111111111111111111111111111112&outputMint=${DOG_MINT}`,
  },
  {
    market: 'Raydium',
    pair: 'DOG/SOL',
    route: '/api/price/raydium',
    tradeUrl: `https://raydium.io/swap/?inputMint=sol&outputMint=${DOG_MINT}`,
  },
]

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
  // Cache inicial com CEX + Bitflow (Solana DEXs são buscadas dinamicamente)
  tickers: [
    // Bitflow DEX (sempre no topo)
    { market: 'Bitflow', pair: 'DOG/sBTC', price: 0.00176, volumeUsd: 50, volume: 28000, spread: 0.50, trustScore: 'green', tradeUrl: 'https://btflw.link/brl' },
    // Solana DEXs (placeholders — substituídos na primeira busca real)
    { market: 'Jupiter',  pair: 'DOG/SOL', price: 0, volumeUsd: 0, volume: 0, spread: null, trustScore: 'green', tradeUrl: `https://jup.ag/swap/SOL-${DOG_MINT}` },
    { market: 'Meteora',  pair: 'DOG/SOL', price: 0, volumeUsd: 0, volume: 0, spread: null, trustScore: 'green', tradeUrl: 'https://app.meteora.ag/' },
    { market: 'Orca',     pair: 'DOG/SOL', price: 0, volumeUsd: 0, volume: 0, spread: null, trustScore: 'green', tradeUrl: `https://www.orca.so/?inputMint=So11111111111111111111111111111111111111112&outputMint=${DOG_MINT}` },
    { market: 'Raydium',  pair: 'DOG/SOL', price: 0, volumeUsd: 0, volume: 0, spread: null, trustScore: 'green', tradeUrl: `https://raydium.io/swap/?inputMint=sol&outputMint=${DOG_MINT}` },
    // CEX — green trust score
    { market: 'BingX',    pair: 'DOG/USDT', price: 0.00163, volumeUsd: 76000,  volume: 46000000,  spread: 0.06, trustScore: 'green',  tradeUrl: 'https://bingx.com/en-us/spot/DOGUSDT' },
    { market: 'BitKan',   pair: 'DOG/USDT', price: 0.00158, volumeUsd: 43000,  volume: 27000000,  spread: 0.28, trustScore: 'green',  tradeUrl: 'https://www.bitkan.com/trade/dog-usdt' },
    { market: 'Bitget',   pair: 'DOG/USDT', price: 0.00163, volumeUsd: 401000, volume: 245000000, spread: 0.24, trustScore: 'green',  tradeUrl: 'https://www.bitget.com/spot/DOGUSDT' },
    { market: 'CoinEx',   pair: 'DOG/USDT', price: 0.00159, volumeUsd: 55000,  volume: 34000000,  spread: 0.38, trustScore: 'green',  tradeUrl: 'https://www.coinex.com/exchange/dog-usdt' },
    { market: 'DigiFinex',pair: 'DOG/USDT', price: 0.00163, volumeUsd: 281000, volume: 172000000, spread: 0.30, trustScore: 'green',  tradeUrl: 'https://www.digifinex.com/en-ww/trade/USDT/DOG' },
    { market: 'Gate',     pair: 'DOG/USDT', price: 0.00163, volumeUsd: 538000, volume: 329700000, spread: 0.13, trustScore: 'green',  tradeUrl: 'https://www.gate.com/trade/DOG_USDT' },
    { market: 'Hotcoin',  pair: 'DOG/USDT', price: 0.00162, volumeUsd: 484000, volume: 298000000, spread: 0.26, trustScore: 'green',  tradeUrl: 'https://www.hotcoin.com/currencyExchange/dog_usdt' },
    { market: 'Kraken',   pair: 'DOG/USD',  price: 0.00164, volumeUsd: 214000, volume: 130000000, spread: 0.61, trustScore: 'green',  tradeUrl: 'https://pro.kraken.com/app/trade/DOG-USD' },
    { market: 'Kraken',   pair: 'DOG/EUR',  price: 0.00135, volumeUsd: 45000,  volume: 29000000,  spread: 0.74, trustScore: 'green',  tradeUrl: 'https://pro.kraken.com/app/trade/DOG-EUR' },
    { market: 'MEXC',     pair: 'DOG/USDT', price: 0.00163, volumeUsd: 443000, volume: 271000000, spread: 0.55, trustScore: 'green',  tradeUrl: 'https://www.mexc.com/exchange/DOG_USDT' },
    { market: 'Ourbit',   pair: 'DOG/USDT', price: 0.00163, volumeUsd: 75000,  volume: 45000000,  spread: 0.18, trustScore: 'green',  tradeUrl: 'https://www.ourbit.com/exchange/DOG_USDT' },
    { market: 'Tapbit',   pair: 'DOG/USDT', price: 0.00159, volumeUsd: 60000,  volume: 37000000,  spread: 1.21, trustScore: 'green',  tradeUrl: 'https://www.tapbit.com/trade/dog-usdt' },
    { market: 'WEEX',     pair: 'DOG/USDT', price: 0.00160, volumeUsd: 36000,  volume: 22000000,  spread: 0.50, trustScore: 'green',  tradeUrl: 'https://www.weex.com/trade/dog_usdt' },
    { market: 'XT.COM',   pair: 'DOG/USDT', price: 0.00162, volumeUsd: 133000, volume: 82000000,  spread: 0.37, trustScore: 'green',  tradeUrl: 'https://www.xt.com/en/trade/dog_usdt' },
    // CEX — yellow trust score
    { market: 'BitMart',        pair: 'DOG/USDT', price: 0.00161, volumeUsd: 29000, volume: 18000000, spread: 1.74, trustScore: 'yellow', tradeUrl: 'https://www.bitmart.com/trade/dog-usdt' },
    { market: 'Bitrue',         pair: 'DOG/USDT', price: 0.00160, volumeUsd: 25000, volume: 15000000, spread: 0.85, trustScore: 'yellow', tradeUrl: 'https://www.bitrue.com/trade/dog_usdt' },
    { market: 'CoinW',          pair: 'DOG/USDT', price: 0.00162, volumeUsd: 22000, volume: 13000000, spread: 2.02, trustScore: 'yellow', tradeUrl: 'https://www.coinw.com/trade/dog-usdt' },
    { market: 'Hibt',           pair: 'DOG/USDT', price: 0.00158, volumeUsd: 33000, volume: 20000000, spread: 0.45, trustScore: 'yellow', tradeUrl: 'https://www.hibt.com/trade/dog_usdt' },
    { market: 'Mercado Bitcoin', pair: 'DOG/BRL', price: 0.00850, volumeUsd: 12000, volume: 7000000,  spread: 1.50, trustScore: 'yellow', tradeUrl: 'https://www.mercadobitcoin.com.br/trade/dog-brl' },
    { market: 'NovaDAX',        pair: 'DOG/BRL',  price: 0.00852, volumeUsd: 15000, volume: 9000000,  spread: 1.17, trustScore: 'yellow', tradeUrl: 'https://www.novadax.com.br/trade/dog-brl' },
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
        
        // Filtrar exchanges com trust score ruim (red), mas aceitar null/undefined
        const isNotUntrusted = t.trust_score !== 'red'

        return isValidPair && isReasonablePrice && isNotUntrusted
      })
      .map((t: MarketTicker) => ({
        market: t.market.name,
        pair: `${t.base}/${t.target}`,
        price: t.last,
        volumeUsd: t.converted_volume.usd,
        volume: t.volume,
        spread: t.bid_ask_spread_percentage,
        trustScore: t.trust_score || 'green',
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
    // Usar sBTC/DOG como pool padrão (tem liquidez)
    try {
      const bitflowRes = await fetch('https://bitflow-sdk-api-gateway-7owjsmt8.uc.gateway.dev/ticker', {
        cache: 'no-store',
        signal: AbortSignal.timeout(API_TIMEOUT)
      })
      
      if (bitflowRes.ok) {
        const bitflowData = await bitflowRes.json()
        
        // Buscar pool sBTC/DOG (pool padrão com liquidez)
        const dogTicker = bitflowData.find((t: any) => 
          t.ticker_id?.toUpperCase().includes('SBTC') && t.ticker_id?.toUpperCase().includes('DOG')
        )
        
        if (dogTicker && parseFloat(dogTicker.last_price) > 0) {
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
              pair: 'DOG/sBTC',
              price: dogUsdPrice,
              volumeUsd: volumeUsd,
              volume: volumeDog,
              spread: parseFloat(dogTicker.bid_ask_spread_percentage) || 0.50,
              trustScore: 'green',
              tradeUrl: 'https://btflw.link/brl'
            }
            
            // Adicionar Bitflow no topo
            tickers.unshift(bitflowTicker)
            console.log('✅ Bitflow (sBTC/DOG) added to markets:', { 
              price: dogUsdPrice.toFixed(8), 
              volumeDog: volumeDog.toFixed(2), 
              volumeUsd: volumeUsd.toFixed(2),
              liquidity: parseFloat(dogTicker.liquidity_in_usd || 0).toFixed(2)
            })
          }
        } else {
          console.warn('⚠️ sBTC/DOG pool not found or has no liquidity on Bitflow')
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to fetch Bitflow for markets, using cache value')
    }

    // Buscar as 4 Solana DEXs em paralelo via routes internas
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

    await Promise.allSettled(
      SOLANA_DEXS.map(async (dex) => {
        try {
          const res = await fetch(`${baseUrl}${dex.route}`, {
            cache: 'no-store',
            signal: AbortSignal.timeout(API_TIMEOUT),
          })
          if (!res.ok) return
          const d = await res.json()
          const price = d.price as number
          if (!price || price <= 0) return
          // Remover placeholder (price=0) e adicionar com preço real
          const existing = tickers.findIndex((t: any) => t.market === dex.market && t.pair === dex.pair)
          const ticker = {
            market: dex.market,
            pair: dex.pair,
            price,
            volumeUsd: 0,
            volume: 0,
            spread: null,
            trustScore: 'green',
            tradeUrl: dex.tradeUrl,
          }
          if (existing >= 0) tickers[existing] = ticker
          else tickers.push(ticker)
          console.log(`✅ ${dex.market} price added to markets: $${price.toFixed(8)}`)
        } catch {
          console.warn(`⚠️ Failed to fetch ${dex.market} price for markets`)
        }
      })
    )

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

