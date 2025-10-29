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
} | null = {
  // Cache inicial com dados default para evitar erro na primeira vez
  price: 0.00000181,
  priceSats: 1.81,
  change24h: 0,
  timestamp: Date.now(),
  lastSuccessfulFetch: Date.now() - 600000 // 10 min atrás para forçar tentativa de atualização
}

const REFRESH_INTERVAL = 30000 // Tentar atualizar a cada 30 segundos
const API_TIMEOUT = 8000 // Timeout de 8 segundos para APIs

export async function GET() {
  const now = Date.now()
  
  // Se temos cache E ainda não passou o intervalo de refresh, retornar cache
  if (cachedData && (now - cachedData.lastSuccessfulFetch) < REFRESH_INTERVAL) {
    console.log('📦 Using cached Magic Eden data (fresh)')
    return NextResponse.json({
      lastPrice: cachedData.price.toString(),
      priceSats: cachedData.priceSats.toFixed(4),
      change24h: cachedData.change24h.toString(),
      cached: true,
      cacheAge: Math.floor((now - cachedData.lastSuccessfulFetch) / 1000)
    })
  }

  try {
    // Buscar dados do Magic Eden com timeout
    const response = await fetch(
      'https://api-mainnet.magiceden.dev/v2/ord/btc/runes/market/DOGGOTOTHEMOON/info',
      {
        cache: 'no-store',
        signal: AbortSignal.timeout(API_TIMEOUT),
        headers: {
          'Accept': 'application/json'
        }
      }
    )

    if (!response.ok) {
      console.warn(`⚠️ Magic Eden API returned ${response.status}`)
      throw new Error(`Magic Eden API error: ${response.status}`)
    }

    const data = await response.json()

    // Extrair floor price em sats
    const floorSats = parseFloat(data.floorUnitPrice?.formatted || '0')
    
    // Converter sats para USD (1 sat = preço do BTC / 100M)
    // Buscar preço do BTC com timeout
    const btcResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd', {
      cache: 'no-store',
      signal: AbortSignal.timeout(API_TIMEOUT)
    })
    const btcData = await btcResponse.json()
    const btcPrice = btcData.bitcoin?.usd || 0
    
    // Converter: (floor_sats / 100,000,000) * btc_price
    const dogUsdPrice = (floorSats / 100000000) * btcPrice
    
    // Extrair variação 24h do floor
    // deltaFloor.1d vem como decimal (ex: 0.9726 = -2.74%)
    const deltaFloor = parseFloat(data.deltaFloor?.['1d'] || '1')
    const change24h = (deltaFloor - 1) * 100
    
    console.log('📊 Magic Eden DOG Floor Price:', {
      floorSats: floorSats,
      btcPrice: `$${btcPrice.toFixed(2)}`,
      dogUsdPrice: `$${dogUsdPrice.toFixed(8)}`,
      deltaFloor: deltaFloor,
      change24h: change24h.toFixed(2) + '%',
      volume24h: data.volume?.['1d'] || 0,
      txnCount24h: data.txnCount?.['1d'] || 0
    })

    // Atualizar cache com dados frescos
    const fetchTime = Date.now()
    cachedData = {
      price: dogUsdPrice,
      priceSats: floorSats,
      change24h: change24h,
      timestamp: fetchTime,
      lastSuccessfulFetch: fetchTime
    }

    console.log('✅ Magic Eden cache updated with fresh data')

    return NextResponse.json({
      lastPrice: dogUsdPrice.toFixed(8),
      priceSats: floorSats.toFixed(4), // Floor price já vem em sats corretos
      change24h: change24h.toString(),
      volume24h: data.volume?.['1d'] || 0,
      txnCount24h: data.txnCount?.['1d'] || 0,
      cached: false
    })

  } catch (error) {
    console.error('❌ Magic Eden API Error:', error)
    
    // SEMPRE retornar cache se existir - NUNCA mostrar erro ao usuário
    if (cachedData) {
      const cacheAge = Math.floor((Date.now() - cachedData.lastSuccessfulFetch) / 1000)
      console.log(`⚠️ API failed, using cache from ${cacheAge}s ago`)
      
      return NextResponse.json({
        lastPrice: cachedData.price.toFixed(8),
        priceSats: cachedData.priceSats.toFixed(4),
        change24h: cachedData.change24h.toString(),
        cached: true,
        stale: true,
        cacheAge: cacheAge
      })
    }
    
    // Só retorna erro se NÃO tiver cache nenhum (primeira requisição)
    console.error('💥 No cache available, returning error')
    return NextResponse.json(
      { 
        error: 'Failed to fetch Magic Eden price',
        details: 'Service temporarily unavailable'
      },
      { status: 503 }
    )
  }
}

