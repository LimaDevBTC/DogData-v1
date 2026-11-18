/**
 * GET /api/dogcity/referral-items?address=<endereço>   (pública, sem segredo, cache curto)
 *   -> 200 { address, lotsReferred, items: ["quad" | "jet" | "m4", ...] }
 * Contrato: /dogcity/docs#referrals. Itens por QUANTIDADE de lotes indicados e creditados ao dono (3 quad, 10 jet, 25 m4); ficam
 * com a carteira que os conquistou (lot_referral_items, migração 043). Endereço inválido: 400. Sem dado, ou migração ainda não
 * aplicada: { lotsReferred: 0, items: [] }. Banco fora: 503.
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { normalizeAddress } from '@/lib/dog/licence-btc'
import { ITEM_TIERS, type RefItem } from '@/lib/lot-referral/rules'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 10

const CACHE = { 'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=20' }
const NO_STORE = { 'Cache-Control': 'no-store' }
const MISSING = ['42P01', '42703', '42883', 'PGRST205', 'PGRST202']

export async function GET(req: NextRequest) {
  const address = normalizeAddress(req.nextUrl.searchParams.get('address'))
  if (!address) return NextResponse.json({ error: 'invalid Bitcoin address' }, { status: 400, headers: NO_STORE })
  const [items, count] = await Promise.all([
    supabase.from('lot_referral_items').select('item').eq('wallet', address),
    supabase.from('lot_referral_rewards').select('order_id', { count: 'exact', head: true }).eq('wallet', address).eq('side', 'owner').eq('status', 'credited'),
  ])
  for (const e of [items.error, count.error]) {
    if (!e) continue
    if (MISSING.includes(String(e.code ?? ''))) return NextResponse.json({ address, lotsReferred: 0, items: [] }, { headers: CACHE })
    return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: NO_STORE })
  }
  const have = new Set(((items.data ?? []) as Array<{ item: string }>).map((r) => r.item))
  const ordered: RefItem[] = ITEM_TIERS.filter((t) => have.has(t.item)).map((t) => t.item)
  return NextResponse.json({ address, lotsReferred: count.count ?? 0, items: ordered }, { headers: CACHE })
}
