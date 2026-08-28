import { NextRequest, NextResponse } from 'next/server'
import { redisClient } from '@/lib/upstash'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/price/candles?range=4h|24h
 *
 * O intradiário do DOG, que o histórico do disco não tem: aquele arquivo é
 * fechamento DIÁRIO (scripts/build_price_history.py), então 24h nele são um
 * ponto só e 4h, nenhum.
 *
 * ⚠️ A KRAKEN VEM PRIMEIRO, e não é preferência: é o preço que a home já
 * publica no topo (app/page.tsx tenta Kraken, depois Gate.io, depois MEXC).
 * Um gráfico que desenhasse a vela de outra corretora mostraria uma linha que
 * não termina no número grande logo acima dela. A Gate.io fica de reserva,
 * porque é a fonte do histórico diário e nunca some junto.
 *
 * ⚠️ PASSA PELO SERVIDOR DE PROPÓSITO: o navegador não fala com a Gate.io
 * direto (CORS, e um terceiro a mais na página), e aqui a resposta é cacheada
 * por 60s no Redis mais o cache da borda. Cem visitantes na home custam uma
 * chamada por minuto, não cem.
 */

const FAIXAS = {
  // gate usa "5m"/"15m", kraken usa minutos em número
  '4h': { gate: '5m', kraken: 5, limit: 48 },
  '24h': { gate: '15m', kraken: 15, limit: 96 },
} as const

type Faixa = keyof typeof FAIXAS

export interface Vela {
  t: string
  c: number
}

async function comPrazo(url: string, ms = 8_000): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
  } finally {
    clearTimeout(t)
  }
}

/** Kraken: [tempo, abertura, máxima, mínima, FECHAMENTO, vwap, volume, trades] */
async function velasKraken(minutos: number, limite: number): Promise<Vela[]> {
  const res = await comPrazo(`https://api.kraken.com/0/public/OHLC?pair=DOGUSD&interval=${minutos}`)
  if (!res.ok) throw new Error(`kraken ${res.status}`)
  const j = await res.json()
  if (j?.error?.length) throw new Error(`kraken ${j.error.join(',')}`)
  const chave = Object.keys(j?.result ?? {}).find((k) => k !== 'last')
  const linhas: any[][] = chave ? j.result[chave] : []
  return linhas
    .slice(-limite)
    .map((v) => ({ t: new Date(Number(v[0]) * 1000).toISOString(), c: Number(v[4]) }))
    .filter((p) => Number.isFinite(p.c) && p.c > 0)
}

/** Gate.io: [tempo, volume_quote, FECHAMENTO, máxima, mínima, abertura, ...] */
async function velasGate(intervalo: string, limite: number): Promise<Vela[]> {
  const res = await comPrazo(
    `https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=DOG_USDT&interval=${intervalo}&limit=${limite}`,
  )
  if (!res.ok) throw new Error(`gate ${res.status}`)
  const cru = (await res.json()) as string[][]
  return cru
    .map((v) => ({ t: new Date(Number(v[0]) * 1000).toISOString(), c: Number(v[2]) }))
    .filter((p) => Number.isFinite(p.c) && p.c > 0)
}

export async function GET(req: NextRequest) {
  const bruto = (req.nextUrl.searchParams.get('range') ?? '24h').toLowerCase()
  const faixa = (bruto in FAIXAS ? bruto : '24h') as Faixa
  const chave = `dogcandles:${faixa}`

  try {
    const hit = await redisClient.get<{ points: Vela[]; source: string }>(chave)
    if (hit?.points?.length) {
      return NextResponse.json(
        { range: faixa, points: hit.points, source: hit.source, cached: true },
        { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } },
      )
    }
  } catch {
    /* cache é otimização */
  }

  let points: Vela[] = []
  let source = 'Kraken'
  try {
    points = await velasKraken(FAIXAS[faixa].kraken, FAIXAS[faixa].limit)
  } catch (e: any) {
    console.error('[api/price/candles kraken]', e?.message)
  }
  if (points.length < 2) {
    try {
      points = await velasGate(FAIXAS[faixa].gate, FAIXAS[faixa].limit)
      source = 'Gate.io'
    } catch (e: any) {
      console.error('[api/price/candles gate]', e?.message)
    }
  }

  if (points.length < 2) {
    return NextResponse.json({ error: 'Intraday price unavailable right now.' }, { status: 502 })
  }

  try {
    await redisClient.set(chave, { points, source }, { ex: 60 })
  } catch {
    /* idem */
  }

  return NextResponse.json(
    { range: faixa, points, source, cached: false },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } },
  )
}
