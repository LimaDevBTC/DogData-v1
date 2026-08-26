import { NextResponse } from 'next/server'
import { buildPriceResponse } from '@/lib/price-normalizer'

const ORCA_META = { exchange: 'orca', type: 'dex' as const, chain: 'solana' as const, pair: 'DOG/SOL' }

function orcaPayload(
  d: { price: number; change24h: number | null },
  fetchedAt: number,
  cached: boolean,
  stale = false
) {
  return buildPriceResponse({
    ...ORCA_META,
    price_usd: d.price,
    change_24h_pct: d.change24h,
    fetched_at: new Date(fetchedAt).toISOString(),
    cached,
    stale,
    cache_age_s: cached ? Math.floor((Date.now() - fetchedAt) / 1000) : undefined,
    legacy: {
      price: d.price,
      change24h: d.change24h,
      source: 'orca',
      timestamp: new Date(fetchedAt).toISOString(),
    },
  })
}

export const dynamic = 'force-dynamic'

const DOG_MINT = 'dog1viwbb2vWDpER5FrJ4YFG6gq6XuyFohUe9TXN65u'
const SOL_MINT = 'So11111111111111111111111111111111111111112'
// Main SOL/DOG Orca Whirlpool (highest TVL)
const SOL_DOG_POOL = '96P9KSNysfTADDzfxgsSrfyfgy47omctoCZPgJsj93ML'

// Cache persistente em memória
let cachedData: {
  price: number
  change24h: number | null
  solPrice: number
  timestamp: number
  lastSuccessfulFetch: number
} | null = null

const REFRESH_INTERVAL = 30000 // 30 segundos
const API_TIMEOUT = 8000

async function fetchJupiterChange(): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.jup.ag/price/v3?ids=${DOG_MINT}`,
      { cache: 'no-store', signal: AbortSignal.timeout(API_TIMEOUT), headers: { 'Accept': 'application/json' } }
    )
    if (!res.ok) return null
    const json = await res.json()
    const change = json[DOG_MINT]?.priceChange24h
    return typeof change === 'number' ? change : null
  } catch {
    return null
  }
}

export async function GET() {
  const now = Date.now()

  // Retornar cache se ainda está fresco
  if (cachedData && (now - cachedData.lastSuccessfulFetch) < REFRESH_INTERVAL) {
    console.log('📦 Using cached Orca data (fresh)')
    return NextResponse.json(orcaPayload(cachedData, cachedData.lastSuccessfulFetch, true))
  }

  try {
    // Buscar preço do SOL, pool SOL/DOG e variação 24h em paralelo
    const [solRes, poolRes, change24h] = await Promise.all([
      fetch(`https://api.orca.so/v2/solana/tokens/${SOL_MINT}`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(API_TIMEOUT),
        headers: { 'Accept': 'application/json' }
      }),
      fetch(`https://api.orca.so/v2/solana/pools/${SOL_DOG_POOL}`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(API_TIMEOUT),
        headers: { 'Accept': 'application/json' }
      }),
      fetchJupiterChange()
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
      dogPrice: `$${price.toFixed(8)}`,
      change24h
    })

    const fetchTime = Date.now()
    cachedData = {
      price,
      change24h,
      solPrice,
      timestamp: fetchTime,
      lastSuccessfulFetch: fetchTime
    }

    console.log('✅ Orca cache updated')

    return NextResponse.json(orcaPayload({ price, change24h }, fetchTime, false))

  } catch (error) {
    console.error('❌ Orca API error:', error)

    if (cachedData) {
      console.log('📦 Using stale cache as fallback')
      return NextResponse.json(orcaPayload(cachedData, cachedData.lastSuccessfulFetch, true, true))
    }

    return NextResponse.json({
      ...orcaPayload({ price: 0, change24h: null }, Date.now(), false),
      error: 'Orca API unavailable',
    }, { status: 503 })
  }
}
