/**
 * A PROPRIEDADE UNIDA, OPT-IN (desenho final do fundador, 19/11/2026): "Expand your house".
 *
 *   GET  /api/dogcity/property
 *        -> { tier, lots, properties, options, canExpand, dissolvedNow, cooldownDays, amenitiesByArea }
 *   POST /api/dogcity/property { action: 'merge', lots: [lot_id, ...] }   une os lotes escolhidos (vizinhos, da carteira)
 *   POST /api/dogcity/property { action: 'split', id }                    desfaz por vontade ("Restore separate lots")
 *
 * Só no JOGO e de graça: na cadeia cada lote segue a sua escritura e a sua licença. A carteira é a da SESSÃO assinada
 * (`dg_wallet`), nunca a do corpo; o mint confirma a posse de CADA lote; mesma origem; freio por IP e por carteira; uma
 * consolidação OU um desfazer por propriedade a cada 21 dias (o desfazer forçado por venda não conta). Regras em
 * lib/dog/property-merge.ts; banco na migração 044 (sem ela: 503 "not open yet").
 */
import { NextRequest, NextResponse } from 'next/server'
import { getWalletSession } from '@/lib/identity/session'
import { tooFast } from '@/lib/identity/throttle'
import { lerJsonComTeto, passouDoTeto, respostaFreio } from '@/lib/seguranca/freio'
import { normalizeAddress } from '@/lib/dog/licence-btc'
import { consolidar, desfazer, vistaDaCarteira } from '@/lib/dog/property-merge-service'
import { propertyDeps } from '@/lib/dog/property-merge-deps'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 10

const NO_STORE = { 'Cache-Control': 'no-store' }
const TETO_CORPO = 2048

const erro = (status: number, error: string, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ error, ...extra }, { status, headers: NO_STORE })

async function enderecoDaSessao(req: NextRequest): Promise<string | null> {
  const s = await getWalletSession(req).catch(() => null)
  return s ? normalizeAddress(s.address) : null
}

const MSG: Record<string, [number, string]> = {
  not_open: [503, 'Expanding a house is not open yet.'],
  unknown: [503, 'Could not confirm your lots right now. Try again in a moment.'],
  stale: [409, 'Something changed while saving. Reload and try again.'],
  too_few: [422, 'Pick at least two lots.'],
  too_many: [422, 'That is too many lots for one property.'],
  invalid_lot: [422, 'Invalid lot.'],
  sector_8: [422, 'Financial District lots cannot be joined.'],
  not_holder: [403, 'This wallet does not hold every lot you picked.'],
  not_connected: [422, 'The lots you picked must sit side by side in the same block.'],
  no_licence: [422, 'At least one of the lots needs a building licence.'],
  already_merged: [409, 'One of these lots is already part of a property.'],
  cooldown: [429, 'A property can be joined or restored once every 21 days.'],
  not_found: [404, 'Property not found.'],
  not_owner: [403, 'This property belongs to another wallet.'],
  not_active: [409, 'This property is already restored to separate lots.'],
}

export async function GET(req: NextRequest) {
  const address = await enderecoDaSessao(req)
  if (!address) return erro(401, 'Sign with your wallet first.')
  const v = await vistaDaCarteira(propertyDeps, address)
  if ('ok' in v) { const [s, m] = MSG[v.why]; return erro(s, m, { why: v.why }) }
  return NextResponse.json(v, { headers: NO_STORE })
}

export async function POST(req: NextRequest) {
  if (req.headers.get('sec-fetch-site') === 'cross-site') return erro(403, 'Cross-site request refused.')
  if (!(req.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) return erro(415, 'Send JSON.')
  if (await passouDoTeto(req, 'property', 20)) return respostaFreio()
  const address = await enderecoDaSessao(req)
  if (!address) return erro(401, 'Sign with your wallet first.')
  if (await tooFast(`property:${address}`, 3)) return erro(429, 'Slow down, try again in a moment.')
  const corpo = await lerJsonComTeto(req, TETO_CORPO)
  if (!corpo.ok) return erro(corpo.status, 'Invalid request.')
  const b = (corpo.valor ?? {}) as Record<string, unknown>
  if (b.action === 'merge') {
    const r = await consolidar(propertyDeps, address, b.lots)
    if (!r.ok) { const [s, m] = MSG[r.why]; return erro(s, m, { why: r.why, ...(r.until ? { until: r.until } : {}) }) }
    return NextResponse.json(r, { headers: NO_STORE })
  }
  if (b.action === 'split') {
    if (typeof b.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(b.id)) return erro(422, 'Invalid property.')
    const r = await desfazer(propertyDeps, address, b.id)
    if (!r.ok) { const [s, m] = MSG[r.why]; return erro(s, m, { why: r.why, ...(r.until ? { until: r.until } : {}) }) }
    return NextResponse.json(r, { headers: NO_STORE })
  }
  return erro(422, 'Unknown action.')
}
