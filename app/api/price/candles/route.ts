import { NextRequest, NextResponse } from 'next/server'
import { redisClient } from '@/lib/upstash'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/price/candles?range=4h|24h
 *
 * O intradiário do DOG, que o histórico do disco não tem: aquele arquivo é
 * fechamento DIÁRIO (scripts/build_price_history.py), então 24h nele são um
 * ponto só e 4h, nenhum. As velas vêm da mesma Gate.io que já é a fonte do
 * histórico, para as duas janelas contarem a mesma história.
 *
 * ⚠️ PASSA PELO SERVIDOR DE PROPÓSITO: o navegador não fala com a Gate.io
 * direto (CORS, e um terceiro a mais na página), e aqui a resposta é cacheada
 * por 60s no Redis mais o cache da borda. Cem visitantes na home custam uma
 * chamada por minuto, não cem.
 */

const FAIXAS = {
  '4h': { interval: '5m', limit: 48 },
  '24h': { interval: '15m', limit: 96 },
} as const

type Faixa = keyof typeof FAIXAS

export interface Vela {
  t: string
  c: number
}

export async function GET(req: NextRequest) {
  const bruto = (req.nextUrl.searchParams.get('range') ?? '24h').toLowerCase()
  const faixa = (bruto in FAIXAS ? bruto : '24h') as Faixa
  const { interval, limit } = FAIXAS[faixa]
  const chave = `dogcandles:${faixa}`

  try {
    const hit = await redisClient.get<Vela[]>(chave)
    if (hit?.length) {
      return NextResponse.json(
        { range: faixa, points: hit, cached: true },
        { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } },
      )
    }
  } catch {
    /* cache é otimização */
  }

  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 8_000)
    const res = await fetch(
      `https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=DOG_USDT&interval=${interval}&limit=${limit}`,
      { signal: ctrl.signal, headers: { Accept: 'application/json' } },
    )
    clearTimeout(t)
    if (!res.ok) throw new Error(`gate ${res.status}`)

    // Formato da Gate: [timestamp, volume_quote, close, high, low, open, ...],
    // mais antiga primeiro. Só o fechamento interessa para a linha.
    const cru = (await res.json()) as string[][]
    const points: Vela[] = cru
      .map((v) => ({ t: new Date(Number(v[0]) * 1000).toISOString(), c: Number(v[2]) }))
      .filter((p) => Number.isFinite(p.c) && p.c > 0)

    if (points.length < 2) throw new Error('série vazia')

    try {
      await redisClient.set(chave, points, { ex: 60 })
    } catch {
      /* idem */
    }

    return NextResponse.json(
      { range: faixa, points, cached: false },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } },
    )
  } catch (e: any) {
    console.error('[api/price/candles]', e?.message)
    return NextResponse.json({ error: 'Intraday price unavailable right now.' }, { status: 502 })
  }
}
