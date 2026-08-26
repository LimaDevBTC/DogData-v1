import { NextResponse } from 'next/server'
import { buildPriceResponse } from '@/lib/price-normalizer'

const BITFLOW_META = { exchange: 'bitflow', type: 'dex' as const, chain: 'stacks' as const, pair: 'DOG/sBTC' }

const COINGECKO_DOG_TICKERS = 'https://api.coingecko.com/api/v3/coins/dog-go-to-the-moon-rune/tickers'
const COINGECKO_BTC_PRICE = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'
const BITFLOW_GATEWAY = 'https://bitflow-sdk-api-gateway-7owjsmt8.uc.gateway.dev/ticker'
const KRAKEN_TICKER = 'https://api.kraken.com/0/public/Ticker?pair=DOGUSD'

function bitflowPayload(
  d: { price: number; priceSats: number; change24h: number; volume?: number; liquidity?: number; tradeUrl?: string },
  fetchedAt: number,
  cached: boolean,
  stale = false
) {
  return buildPriceResponse({
    ...BITFLOW_META,
    price_usd: d.price,
    price_sats: d.priceSats || null,
    change_24h_pct: d.change24h,
    volume_24h_usd: d.volume ?? null,
    liquidity_usd: d.liquidity ?? null,
    fetched_at: new Date(fetchedAt).toISOString(),
    cached,
    stale,
    cache_age_s: cached ? Math.floor((Date.now() - fetchedAt) / 1000) : undefined,
    legacy: {
      price: d.price,
      lastPrice: d.price.toFixed(8),
      priceSats: d.priceSats,
      change24h: d.change24h,
      volume: d.volume ?? 0,
      volume24h: d.volume ?? 0,
      tradeUrl: d.tradeUrl,
    },
  })
}

export const dynamic = 'force-dynamic'

let cachedData: {
  price: number
  priceSats: number
  change24h: number
  volume: number
  liquidity: number
  tradeUrl?: string
  timestamp: number
  lastSuccessfulFetch: number
  source: 'coingecko' | 'bitflow-gateway'
} | null = null

const REFRESH_INTERVAL = 30000

async function fetchKrakenChange24h(): Promise<number | null> {
  try {
    const res = await fetch(KRAKEN_TICKER, { cache: 'no-store', signal: AbortSignal.timeout(5000) })
    const data = await res.json()
    const t = data?.result?.DOGUSD
    if (!t) return null
    const last = parseFloat(t.c[0])
    const open = parseFloat(t.o)
    if (!open) return null
    return ((last - open) / open) * 100
  } catch {
    return null
  }
}

async function fetchFromCoinGecko() {
  const res = await fetch(COINGECKO_DOG_TICKERS, {
    cache: 'no-store',
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`CoinGecko tickers ${res.status}`)
  const data = await res.json()
  const tickers: any[] = data?.tickers ?? []
  // Prefer sBTC base; CoinGecko returns one Bitflow ticker today (sBTC/DOG via Pontis bridge).
  const bitflow = tickers.find((t) => t?.market?.identifier === 'bitflow' && parseFloat(t?.converted_last?.usd) > 0)
  if (!bitflow) throw new Error('No active Bitflow ticker on CoinGecko')

  const price = parseFloat(bitflow.converted_last.usd) // USD per 1 DOG
  const last = parseFloat(bitflow.last) || 0           // DOG per 1 sBTC (target per base)
  const priceSats = last > 0 ? 100_000_000 / last : 0
  const volumeBaseSbtc = parseFloat(bitflow.volume) || 0
  const volume24hUsd = parseFloat(bitflow?.converted_volume?.usd) || 0
  // DOG volume = sBTC volume * (DOG per sBTC)
  const volumeDog = last > 0 ? volumeBaseSbtc * last : 0

  return {
    price,
    priceSats,
    volume: volume24hUsd,
    volumeDog,
    liquidity: 0, // CoinGecko doesn't expose pool liquidity in this payload
    tradeUrl: bitflow.trade_url as string | undefined,
  }
}

async function fetchFromBitflowGateway() {
  const [btcRes, tickerRes] = await Promise.all([
    fetch(COINGECKO_BTC_PRICE, { cache: 'no-store', signal: AbortSignal.timeout(5000) }),
    fetch(BITFLOW_GATEWAY, { cache: 'no-store', signal: AbortSignal.timeout(5000) }),
  ])
  if (!btcRes.ok) throw new Error(`BTC ${btcRes.status}`)
  if (!tickerRes.ok) throw new Error(`Bitflow gateway ${tickerRes.status}`)
  const btcPrice = (await btcRes.json())?.bitcoin?.usd
  if (!btcPrice) throw new Error('BTC price missing')
  const data = await tickerRes.json()
  if (!Array.isArray(data) || data.length === 0) throw new Error('Bitflow gateway returned empty')

  const upper = (s: string | undefined) => (s || '').toUpperCase()
  // Pontis bridge token contracts contain "DOG" (e.g. pontis-bridge-DOG). The docs sample
  // showed "BDC" — treat both as DOG aliases.
  const matchesDog = (id: string) => /DOG|BDC/.test(upper(id))

  let ticker =
    data.find((t: any) => upper(t.ticker_id).includes('SBTC') && matchesDog(t.ticker_id) && parseFloat(t.last_price) > 0) ||
    data.find((t: any) => upper(t.ticker_id).includes('PBTC') && matchesDog(t.ticker_id) && parseFloat(t.last_price) > 0)

  if (!ticker) throw new Error('No active DOG/BTC pool on Bitflow gateway')

  const rate = parseFloat(ticker.last_price) // DOG per BTC
  const price = btcPrice / rate
  const priceSats = 100_000_000 / rate
  return {
    price,
    priceSats,
    volume: parseFloat(ticker.target_volume) * price || 0,
    volumeDog: parseFloat(ticker.target_volume) || 0,
    liquidity: parseFloat(ticker.liquidity_in_usd) || 0,
    tradeUrl: undefined as string | undefined,
  }
}

export async function GET() {
  const now = Date.now()

  if (cachedData && (now - cachedData.lastSuccessfulFetch) < REFRESH_INTERVAL) {
    return NextResponse.json(bitflowPayload(cachedData, cachedData.lastSuccessfulFetch, true))
  }

  let result: Awaited<ReturnType<typeof fetchFromCoinGecko>> | null = null
  let source: 'coingecko' | 'bitflow-gateway' = 'coingecko'
  let firstError: unknown = null

  try {
    result = await fetchFromCoinGecko()
  } catch (e) {
    firstError = e
    try {
      result = await fetchFromBitflowGateway()
      source = 'bitflow-gateway'
    } catch (e2) {
      console.error('❌ Bitflow price: both sources failed', { coingecko: firstError, gateway: e2 })
      if (cachedData) {
        return NextResponse.json({
          ...bitflowPayload(cachedData, cachedData.lastSuccessfulFetch, true, true),
          error: 'Upstream sources unavailable, showing cached data',
        })
      }
      return NextResponse.json(
        { error: 'Failed to fetch Bitflow price', details: 'Service temporarily unavailable. Please try again in a moment.' },
        { status: 503 }
      )
    }
  }

  const change24h = (await fetchKrakenChange24h()) ?? cachedData?.change24h ?? 0

  const fetchTime = Date.now()
  cachedData = {
    price: result.price,
    priceSats: result.priceSats,
    change24h,
    volume: result.volume,
    liquidity: result.liquidity,
    tradeUrl: result.tradeUrl,
    timestamp: fetchTime,
    lastSuccessfulFetch: fetchTime,
    source,
  }

  return NextResponse.json({
    ...bitflowPayload(
      { price: result.price, priceSats: result.priceSats, change24h, volume: result.volume, liquidity: result.liquidity, tradeUrl: result.tradeUrl },
      fetchTime,
      false
    ),
    source,
    change24hSource: 'Kraken',
  })
}
