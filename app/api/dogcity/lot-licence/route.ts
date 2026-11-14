/**
 * GET /api/dogcity/lot-licence?lot=<lot_id>          -> { lot, tier, totalDog }
 * GET /api/dogcity/lot-licence?lots=<id>,<id>,...    -> { lots: [{ lot, tier, totalDog }] }   (até 100)
 *        tier  personal | commercial | patron | null (null = o lote não tem licença)
 *
 * LICENÇA NO LOTE (12/11, LICENCA_NO_LOTE_CONTRATO.md): a licença de construção pertence ao lote. É esta
 * rota que o jogo lê para a casa de cada lote, e o mint para a página do lote: a soma do que foi APLICADO
 * ao lote (dogcity_lot_licence, migração 037), de quem quer que tenha pago. Nada se soma entre lotes.
 * Lote do setor 8 (empresa) nunca leva licença: tier null.
 *
 * Só leitura, CORS aberto (dado público, como /api/status), cache curto na borda: a licença muda quando
 * um pagamento é aplicado, nunca por segundo. Id fora da forma: 400. Sem as tabelas da 037 ou banco
 * fora: 503, e quem lê não afirma nada (nunca "sem licença" por engano).
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { atomsOf, dogOfAtoms, lotTakesLicence, normalizeLotId, tierOfLot, type LotLicence } from '@/lib/dog/licence-lot'
import { lotLicenceStore } from '@/lib/dog/licence-lot-supabase'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 10

const MAX_LOTS = 100
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' }
const OK_CACHE = { ...CORS, 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' }
const ERR_CACHE = { ...CORS, 'Cache-Control': 'public, s-maxage=5' }
const store = lotLicenceStore(supabase)

const erro = (error: string, status: number) => NextResponse.json({ error }, { status, headers: ERR_CACHE })

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const um = sp.get('lot')
  const varios = sp.get('lots')
  if ((um === null) === (varios === null)) return erro('pass lot=<id> or lots=<id,id,...>', 400)
  const pedidos = um !== null ? [um] : (varios ?? '').split(',').filter((s) => s.trim() !== '')
  if (pedidos.length === 0 || pedidos.length > MAX_LOTS) return erro(`between 1 and ${MAX_LOTS} lots`, 400)
  const ids = pedidos.map(normalizeLotId)
  if (ids.some((i) => i === null)) return erro('bad lot id', 400)
  const lotes = [...new Set(ids as string[])]

  let totals: Map<string, number>
  try {
    const comLicenca = lotes.filter(lotTakesLicence)
    totals = comLicenca.length ? await store.lotTotals(comLicenca, AbortSignal.timeout(5_000)) : new Map()
  } catch (e) {
    console.error('[dogcity/lot-licence] unavailable:', (e as Error)?.message)
    return erro('lot licences are not available right now', 503)
  }
  const de = (lot: string): LotLicence => {
    // o setor 8 é só de empresa: nunca leva licença, diga o banco o que disser
    const a = lotTakesLicence(lot) ? atomsOf(totals.get(lot)) : 0
    return { lot, tier: tierOfLot(dogOfAtoms(a)), totalDog: dogOfAtoms(a) }
  }
  if (um !== null) return NextResponse.json(de(lotes[0]), { headers: OK_CACHE })
  return NextResponse.json({ lots: lotes.map(de) }, { headers: OK_CACHE })
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...CORS, 'Access-Control-Max-Age': '86400' } })
}
