import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const DOG_MINT = 'dog1viwbb2vWDpER5FrJ4YFG6gq6XuyFohUe9TXN65u'
const SOL_MINT = 'So11111111111111111111111111111111111111112'
// Main SOL/DOG Orca Whirlpool (highest TVL)
const SOL_DOG_POOL = '96P9KSNysfTADDzfxgsSrfyfgy47omctoCZPgJsj93ML'

// Cache persistente em memória
let cachedData: {
  price: number
  solPrice: number
  timestamp: number
  lastSuccessfulFetch: number
} | null = null

const REFRESH_INTERVAL = 30000 // 30 segundos
const API_TIMEOUT = 8000

export async function GET() {
  const now = Date.now()

  // Retornar cache se ainda está fresco
  if (cachedData && (now - cachedData.lastSuccessfulFetch) < REFRESH_INTERVAL) {
    console.log('📦 Using cached Orca data (fresh)')
    return NextResponse.json({
      price: cachedData.price,
      change24h: null,
      source: 'orca',
      cached: true,
      cacheAge: Math.floor((now - cachedData.lastSuccessfulFetch) / 1000)
    })
  }

  try {
    // Buscar preço do SOL e do pool SOL/DOG em paralelo
    const [solRes, poolRes] = await Promise.all([
      fetch(`https://api.orca.so/v2/solana/tokens/${SOL_MINT}`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(API_TIMEOUT),
        headers: { 'Accept': 'application/json' }
      }),
      fetch(`https://api.orca.so/v2/solana/pools/${SOL_DOG_POOL}`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(API_TIMEOUT),
        headers: { 'Accept': 'application/json' }
      })
    ])

    if (!solRes.ok) throw new Error(`Orca SOL token error: ${solRes.status}`)
    if (!poolRes.ok) throw new Error(`Orca pool error: ${poolRes.status}`)

    const [solJson, poolJson] = await Promise.all([solRes.json(), poolRes.json()])

    const solPrice = parseFloat(solJson.data?.priceUsdc)
    // pool.price = "price of tokenA (SOL) in terms of tokenB (DOG)"
    // i.e. 1 SOL = pool.price DOG → DOG price = solPrice / pool.price
    const solDogRate = parseFloat(poolJson.data?.price)

    if (isNaN(solPrice) || solPrice <= 0) throw new Error('Invalid SOL price from Orca')
    if (isNaN(solDogRate) || solDogRate <= 0) throw new Error('Invalid SOL/DOG pool price from Orca')

    const price = solPrice / solDogRate

    console.log('📊 Orca DOG Price:', {
      solPrice: `$${solPrice.toFixed(2)}`,
      solDogRate: solDogRate.toFixed(0),
      dogPrice: `$${price.toFixed(8)}`
    })

    const fetchTime = Date.now()
    cachedData = {
      price,
      solPrice,
      timestamp: fetchTime,
      lastSuccessfulFetch: fetchTime
    }

    console.log('✅ Orca cache updated')

    return NextResponse.json({
      price,
      change24h: null,
      source: 'orca',
      cached: false,
      timestamp: new Date(fetchTime).toISOString()
    })

  } catch (error) {
    console.error('❌ Orca API error:', error)

    if (cachedData) {
      console.log('📦 Using stale cache as fallback')
      return NextResponse.json({
        price: cachedData.price,
        change24h: null,
        source: 'orca',
        cached: true,
        stale: true,
        cacheAge: Math.floor((now - cachedData.lastSuccessfulFetch) / 1000)
      })
    }

    return NextResponse.json({
      price: 0,
      change24h: null,
      source: 'orca',
      error: 'Orca API unavailable',
      cached: false
    }, { status: 503 })
  }
}
