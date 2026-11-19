/**
 * A ESCOLHA DO DONO (fundador, 19/11/2026): em que lote o crédito livre da licença cai.
 *
 *   GET  /api/dogcity/licence-choice
 *        -> { address, tier, unassignedDog, lotsFrom, canChoose, lots, properties }
 *           lots        [{ lot, tier, totalDog }] os lotes que a carteira guarda agora (o mint)
 *           properties  [{ id, lots: [{ lot, tier, totalDog }], tier, licenceLot }] os lotes vizinhos juntos
 *                       (lib/dog/lot-property.ts): no jogo uma propriedade é um terreno só
 *           canChoose   true quando há crédito livre e a lista de lotes veio do mint
 *   POST /api/dogcity/licence-choice { lotId, amountDog? }
 *        aplica o crédito livre (inteiro, ou `amountDog`) no lote escolhido; escolher uma propriedade é mandar
 *        o lote dela onde a licença fica (a tela manda o `licenceLot`, ou o lote que o dono apontou)
 *        -> 200 { ok, lotId, lotTotalDog, unassignedDog, applied }
 *           401 sem sessão · 403 lote que a carteira não guarda · 409 nada livre / outra escolha no meio
 *           422 lote ou valor inválido · 503 banco, mint ou prazo
 *
 * A CARTEIRA É A DA SESSÃO ASSINADA (cookie `dg_wallet`, lib/identity/session.ts), nunca a do corpo. O caminho de
 * escrita é o mesmo da aplicação automática (dogcity_licence_apply da 037: troca condicional por carteira), então
 * dois cliques ao mesmo tempo nunca aplicam o mesmo crédito duas vezes. Sem migração nova.
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getWalletSession } from '@/lib/identity/session'
import { tooFast } from '@/lib/identity/throttle'
import { lerJsonComTeto, passouDoTeto, respostaFreio } from '@/lib/seguranca/freio'
import { normalizeAddress } from '@/lib/dog/licence-btc'
import { normalizeLotId, propertiesOfLots } from '@/lib/dog/licence-lot'
import { aplicarEscolha, standingDaCarteira, type ChoiceResult } from '@/lib/dog/licence-lot-service'
import { holderDoMint, lotLicenceStore } from '@/lib/dog/licence-lot-supabase'
import { snapshotDoRegistro } from '@/lib/dog/licence-lot-registro'
import { agruparPropriedades } from '@/lib/dog/lot-property'
import { vizinhancaDosLotes } from '@/lib/city/lot-vizinhos'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 10

const NO_STORE = { 'Cache-Control': 'no-store' }
const store = lotLicenceStore(supabase)
const TETO_CORPO = 1024

const erro = (status: number, error: string, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ error, ...extra }, { status, headers: NO_STORE })

async function enderecoDaSessao(req: NextRequest): Promise<string | null> {
  const s = await getWalletSession(req).catch(() => null)
  return s ? normalizeAddress(s.address) : null
}

export async function GET(req: NextRequest) {
  const address = await enderecoDaSessao(req)
  if (!address) return erro(401, 'Sign with your wallet first.')
  const origin = req.nextUrl.origin || null
  const [s, viz] = await Promise.all([
    standingDaCarteira({ store, holder: (a) => holderDoMint(a), snapshotLot: snapshotDoRegistro(origin) }, address, { ms: 4000 }).catch(() => null),
    vizinhancaDosLotes().catch(() => null),
  ])
  if (!s) return erro(503, 'Data backend busy, retry shortly.')
  const lots = s.lots ?? []
  const properties = propertiesOfLots(agruparPropriedades(lots.map((l) => l.lot), viz), lots)
  const livre = s.unassignedDog ?? 0
  return NextResponse.json(
    {
      address, tier: s.tier, unassignedDog: livre, lotsFrom: s.lotsFrom,
      canChoose: s.lotsFrom === 'mint' && livre > 0 && lots.length > 0,
      lots, properties, neighbours: viz !== null,
    },
    { headers: NO_STORE },
  )
}

const STATUS: Record<Exclude<ChoiceResult, { ok: true }>['why'], [number, string]> = {
  not_holder: [403, 'This wallet does not hold that lot.'],
  nothing_free: [409, 'There is no free licence credit left to apply.'],
  stale: [409, 'Something changed while applying. Reload and try again.'],
  invalid_lot: [422, 'That lot cannot take a building licence.'],
  too_much: [422, 'That is more than the free credit.'],
  invalid_amount: [422, 'Invalid amount.'],
  old_mode: [503, 'Lot licences are not open yet.'],
  unknown: [503, 'Could not confirm the lots right now. Try again in a moment.'],
}

export async function POST(req: NextRequest) {
  // cross-site nunca: o cookie é sameSite lax e o corpo tem de ser JSON (força o preflight de CORS)
  if (req.headers.get('sec-fetch-site') === 'cross-site') return erro(403, 'Cross-site request refused.')
  if (!(req.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) return erro(415, 'Send JSON.')
  if (await passouDoTeto(req, 'lchoice', 20)) return respostaFreio()
  const address = await enderecoDaSessao(req)
  if (!address) return erro(401, 'Sign with your wallet first.')
  if (await tooFast(`lchoice:${address}`, 3)) return erro(429, 'Slow down, try again in a moment.')

  const corpo = await lerJsonComTeto(req, TETO_CORPO)
  if (!corpo.ok) return erro(corpo.status, 'Invalid request.')
  const b = (corpo.valor ?? {}) as Record<string, unknown>
  const lotId = normalizeLotId(b.lotId)
  if (!lotId) return erro(422, 'Invalid lot.')
  let amountDog: number | null = null
  if (b.amountDog !== undefined && b.amountDog !== null) {
    if (typeof b.amountDog !== 'number' || !Number.isFinite(b.amountDog) || b.amountDog <= 0) return erro(422, 'Invalid amount.')
    amountDog = b.amountDog
  }

  const r = await aplicarEscolha({ store, holder: (a) => holderDoMint(a) }, address, lotId, { amountDog, ms: 6000 })
  if (!r.ok) {
    const [status, msg] = STATUS[r.why]
    return erro(status, msg, { why: r.why })
  }
  return NextResponse.json(
    { ok: true, lotId: r.lotId, lotTotalDog: r.lotTotalDog, unassignedDog: r.unassignedDog, applied: r.applied },
    { headers: NO_STORE },
  )
}
