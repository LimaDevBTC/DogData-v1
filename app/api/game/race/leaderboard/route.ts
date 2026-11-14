import { NextRequest, NextResponse } from 'next/server'
import { comPrazo, falhaPublica } from '@/lib/api/prazo'
import { ranking } from '@/lib/game/race/service'
import { PRAZO_MS, deps } from '@/lib/game/race/rota'
import { PISTA_PADRAO } from '@/lib/game/race/track'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET ?track=an7-v1&model=<m>&limit=50 -> { track, model, opening: { drivers, needed, open }, entries: [{ rank, wallet, handle, lapMs, at, splits }] }.
// `opening.open` = o modelo ainda esta em abertura (junta pilotos; Cyber e Moto2 nunca). PUBLICO: sem cookie,
// CORS aberto (como /api/dogcity/lot-licence), cache de 60 s na borda. Mostra a melhor volta valida de cada carteira no modelo; os
// splits (ms desde a largada em cada portao) so' na primeira linha, o que o jogo usa para o delta do recorde.
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' }
const OK_CACHE = { ...CORS, 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' }
const ERR_CACHE = { ...CORS, 'Cache-Control': 'public, s-maxage=5' }

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const limite = sp.get('limit') === null ? Number.NaN : Number(sp.get('limit'))
  return comPrazo(
    async () => {
      const r = await ranking(deps, sp.get('track') ?? PISTA_PADRAO, sp.get('model'), limite)
      return NextResponse.json(r.body, { status: r.status, headers: r.status === 200 ? OK_CACHE : ERR_CACHE })
    },
    {
      ms: PRAZO_MS.leitura,
      falha: () => {
        const f = falhaPublica()
        f.headers.set('Access-Control-Allow-Origin', '*')
        return f
      },
    },
  )
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...CORS, 'Access-Control-Max-Age': '86400' } })
}
