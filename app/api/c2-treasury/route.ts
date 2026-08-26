import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const C2_BASE = 'https://www.c2dog.com'
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutos
const FETCH_TIMEOUT_MS = 15_000

interface C2Data {
  treasuryDog: number
  goalDog: number
  progressPct: number
  costBasisUsd: number
  priceUsd: number
  treasuryValueUsd: number
  unrealizedPnlUsd: number
  unrealizedPnlPct: number
  timestamp: number
}

let cache: { data: C2Data; fetchedAt: number } | null = null

async function fetchWithTimeout(url: string, timeout = FETCH_TIMEOUT_MS) {
  const res = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(timeout),
    headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`)
  return res
}

// Extrai URL do bundle da página principal (/_next/static/chunks/app/page-*.js)
async function getPageBundleUrl(): Promise<string> {
  const res = await fetchWithTimeout(C2_BASE + '/')
  const html = await res.text()
  const match = html.match(/src="(\/_next\/static\/chunks\/app\/page-[^"]+\.js[^"]*)"/);
  if (!match) throw new Error('Page bundle URL not found in c2dog HTML')
  return C2_BASE + match[1]
}

// Extrai tesouraria e custo base do bundle minificado
async function extractFromBundle(bundleUrl: string): Promise<{ treasuryDog: number; costBasisUsd: number }> {
  const res = await fetchWithTimeout(bundleUrl)
  const js = await res.text()

  // O bundle contém o padrão: }(1088582952) e b=g?g-2112939.509832
  // Regex para o treasury: função animadora recebe o valor final como argumento
  const treasuryMatch = js.match(/\}\((\d{9,10})\)/)
  if (!treasuryMatch) throw new Error('Treasury amount not found in bundle')
  const treasuryDog = parseInt(treasuryMatch[1], 10)

  // Custo base: g-2112939.509832 (valor investido em USD)
  const costMatch = js.match(/g\?g-([\d]+\.[\d]+)/)
  if (!costMatch) throw new Error('Cost basis not found in bundle')
  const costBasisUsd = parseFloat(costMatch[1])

  return { treasuryDog, costBasisUsd }
}

async function fetchC2Data(): Promise<C2Data> {
  const [bundleUrl, priceRes] = await Promise.all([
    getPageBundleUrl(),
    fetchWithTimeout(C2_BASE + '/api/dog-price'),
  ])

  const [{ treasuryDog, costBasisUsd }, priceJson] = await Promise.all([
    extractFromBundle(bundleUrl),
    priceRes.json() as Promise<{ price: number; timestamp: number }>,
  ])

  const GOAL_DOG = 1_500_000_000
  const priceUsd = priceJson.price
  const treasuryValueUsd = treasuryDog * priceUsd
  const unrealizedPnlUsd = treasuryValueUsd - costBasisUsd
  const unrealizedPnlPct = (unrealizedPnlUsd / costBasisUsd) * 100

  return {
    treasuryDog,
    goalDog: GOAL_DOG,
    progressPct: (treasuryDog / GOAL_DOG) * 100,
    costBasisUsd,
    priceUsd,
    treasuryValueUsd,
    unrealizedPnlUsd,
    unrealizedPnlPct,
    timestamp: Date.now(),
  }
}

export async function GET() {
  const now = Date.now()

  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json({ ...cache.data, cached: true })
  }

  try {
    const data = await fetchC2Data()
    cache = { data, fetchedAt: now }
    console.log(`✅ C2 treasury fetched: ${data.treasuryDog.toLocaleString()} DOG @ $${data.priceUsd}`)
    return NextResponse.json({ ...data, cached: false })
  } catch (err) {
    console.error('❌ C2 treasury fetch error:', err)

    if (cache) {
      const staleAgeS = Math.floor((now - cache.fetchedAt) / 1000)
      console.warn(`⚠️ Returning stale C2 cache (${staleAgeS}s old)`)
      return NextResponse.json({ ...cache.data, cached: true, stale: true, staleAgeS })
    }

    return NextResponse.json(
      { error: 'Failed to fetch C2 treasury data', details: String(err) },
      { status: 503 }
    )
  }
}
