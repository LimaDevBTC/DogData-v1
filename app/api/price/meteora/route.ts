import { NextResponse } from 'next/server'
import { buildPriceResponse } from '@/lib/price-normalizer'

const METEORA_META = { exchange: 'meteora', type: 'dex' as const, chain: 'solana' as const, pair: 'DOG/SOL' }

function meteoraPayload(
  d: { price: number; change24h: number | null; tvl: number; pool: string | null },
  fetchedAt: number,
  cached: boolean,
  stale = false
) {
  return buildPriceResponse({
    ...METEORA_META,
    price_usd: d.price,
    change_24h_pct: d.change24h,
    liquidity_usd: d.tvl,
    fetched_at: new Date(fetchedAt).toISOString(),
    cached,
    stale,
    cache_age_s: cached ? Math.floor((Date.now() - fetchedAt) / 1000) : undefined,
    legacy: {
      price: d.price,
      change24h: d.change24h,
      tvl: d.tvl,
      pool: d.pool,
      source: 'meteora',
      timestamp: new Date(fetchedAt).toISOString(),
    },
  })
}

export const dynamic = 'force-dynamic'

const DOG_MINT = 'dog1viwbb2vWDpER5FrJ4YFG6gq6XuyFohUe9TXN65u'
const SOL_MINT = 'So11111111111111111111111111111111111111112'

// Cache persistente em memória
let cachedData: {
  price: number
  change24h: number | null
  tvl: number
  pool: string
  timestamp: number
  lastSuccessfulFetch: number
} | null = null

const REFRESH_INTERVAL = 30000 // 30 segundos
const API_TIMEOUT = 8000

interface MeteoraPool {
  pool_name: string
  pool_token_mints: string[]
  pool_token_amounts: string[]
  pool_tvl: string
}

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
    console.log('📦 Using cached Meteora data (fresh)')
    return NextResponse.json(meteoraPayload(cachedData, cachedData.lastSuccessfulFetch, true))
  }

  try {
    // Buscar pool DOG-SOL, preço live do SOL e variação 24h em paralelo
    const [poolRes, solRes, change24h] = await Promise.all([
      fetch(
        `https://damm-api.meteora.ag/pools/search?page=0&size=5&include_token_mints=${DOG_MINT}`,
        { cache: 'no-store', signal: AbortSignal.timeout(API_TIMEOUT), headers: { 'Accept': 'application/json' } }
      ),
      fetch(
        `https://api.orca.so/v2/solana/tokens/${SOL_MINT}`,
        { cache: 'no-store', signal: AbortSignal.timeout(API_TIMEOUT), headers: { 'Accept': 'application/json' } }
      ),
      fetchJupiterChange()
    ])

    if (!poolRes.ok) throw new Error(`Meteora API error: ${poolRes.status}`)
    if (!solRes.ok) throw new Error(`SOL price error: ${solRes.status}`)

    const [poolJson, solJson] = await Promise.all([poolRes.json(), solRes.json()])

    const pools: MeteoraPool[] = poolJson.data
    if (!pools || pools.length === 0) throw new Error('No DOG pools found on Meteora')

    // Pool com maior TVL que contenha ambos os tokens
    const pool = pools
      .filter(p => p.pool_token_mints.includes(DOG_MINT) && p.pool_token_mints.includes(SOL_MINT))
      .reduce((best, p) => parseFloat(p.pool_tvl) > parseFloat(best.pool_tvl) ? p : best)

    const dogIdx = pool.pool_token_mints.indexOf(DOG_MINT)
    const solIdx = pool.pool_token_mints.indexOf(SOL_MINT)

    const dogAmount = parseFloat(pool.pool_token_amounts[dogIdx])
    const solAmount = parseFloat(pool.pool_token_amounts[solIdx])
    const solPrice = parseFloat(solJson.data?.priceUsdc)

    if (dogAmount <= 0) throw new Error('Invalid DOG amount in pool')
    if (isNaN(solPrice) || solPrice <= 0) throw new Error('Invalid SOL price')

    // Preço live: usa amounts brutos do pool + preço atual do SOL
    const price = (solAmount * solPrice) / dogAmount
    const tvl = parseFloat(pool.pool_tvl)

    if (isNaN(price) || price <= 0) throw new Error('Invalid price calculated from Meteora pool')

    console.log('📊 Meteora DOG Price:', {
      solAmount, dogAmount,
      solPrice: `$${solPrice.toFixed(2)}`,
      price: `$${price.toFixed(8)}`,
      pool: pool.pool_name,
      change24h
    })

    const fetchTime = Date.now()
    cachedData = { price, change24h, tvl, pool: pool.pool_name, timestamp: fetchTime, lastSuccessfulFetch: fetchTime }

    console.log('✅ Meteora cache updated')

    return NextResponse.json(meteoraPayload(
      { price, change24h, tvl, pool: pool.pool_name },
      fetchTime,
      false
    ))

  } catch (error) {
    console.error('❌ Meteora API error:', error)

    if (cachedData) {
      console.log('📦 Using stale cache as fallback')
      return NextResponse.json(meteoraPayload(cachedData, cachedData.lastSuccessfulFetch, true, true))
    }

    return NextResponse.json({
      ...meteoraPayload({ price: 0, change24h: null, tvl: 0, pool: null }, Date.now(), false),
      error: 'Meteora API unavailable',
    }, { status: 503 })
  }
}
