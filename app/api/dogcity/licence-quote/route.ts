/**
 * POST /api/dogcity/licence-quote   { tier, ordinalsAddress, paymentAddress }
 *   -> { id, tier, dogAmount, sats, dogUsd, btcUsd, sources, expiresAt, payTo }
 *
 * A licença continua valendo em $DOG (Personal 10.000, Commercial 50.000, Patron 500.000).
 * Em BTC paga-se o equivalente pela MEDIANA de corretoras (lib/dog/price-sources.ts), travada
 * por 15 minutos. Sem pelo menos 2 fontes independentes para DOG/USD e para BTC/USD que
 * concordem entre si, a rota responde 503 e NÃO grava nada: não existe cotação "no chute".
 *
 * A cotação liga o endereço de PAGAMENTO ao endereço ORDINALS da mesma carteira
 * (dogcity_licence_quotes, migração 034). É assim que o BTC pago por um endereço se soma ao
 * DOG recebido pelo outro, no degrau da licença. Quem credita é a varredura
 * /api/cron/licence-btc; BTC nunca entra em total_received nem no bloco B.
 *
 * GET (sem corpo) é só a PRÉVIA para os cartões: os sats de cada degrau agora, sem gravar
 * nada e sem travar nada. Cache de 30 s na CDN.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { LICENCE_DOG, LICENCE_TIERS, satsForDog, type Quote } from '@/lib/dog/licence-btc'
import { createQuote, type QuoteStore } from '@/lib/dog/licence-quote'
import { spotMedians, type FetchLike, type Medians } from '@/lib/dog/price-sources'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 15

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } },
)

const nofetch = (u: string, i?: any) => fetch(u, i) as ReturnType<FetchLike>

// A mediana de 10 s serve a rajada de cartões e cliques sem martelar as corretoras. A idade
// máxima do preço de uma cotação travada é, portanto, 10 segundos.
const MEDIAN_TTL_MS = 10_000
let memo: { at: number; m: Medians } | null = null
async function medians(): Promise<Medians> {
  if (memo && Date.now() - memo.at < MEDIAN_TTL_MS) return memo.m
  const m = await spotMedians(nofetch)
  memo = { at: Date.now(), m }
  return m
}

const store: QuoteStore = {
  async countSince(paymentAddress, sinceMs) {
    const { count, error } = await supabase
      .from('dogcity_licence_quotes')
      .select('id', { count: 'exact', head: true })
      .eq('payment_address', paymentAddress)
      .gte('created_at', new Date(sinceMs).toISOString())
    if (error) throw new Error(error.message)
    return count ?? 0
  },
  async insert(q: Quote) {
    const { error } = await supabase.from('dogcity_licence_quotes').insert({
      id: q.id,
      tier: q.tier,
      ordinals_address: q.ordinalsAddress,
      payment_address: q.paymentAddress,
      dog_amount: q.dogAmount,
      sats: q.sats,
      dog_usd: q.dogUsd,
      btc_usd: q.btcUsd,
      sources: q.sources,
      created_at: new Date(q.createdAtMs).toISOString(),
      expires_at: new Date(q.expiresAtMs).toISOString(),
    })
    if (error) throw new Error(error.message)
  },
}

const NO_STORE = { 'Cache-Control': 'no-store' }

export async function POST(req: NextRequest) {
  let body: unknown = null
  try { body = await req.json() } catch { /* corpo inválido: createQuote devolve 400 */ }
  try {
    const r = await createQuote({ store, medians, nowMs: Date.now(), newId: () => randomUUID() }, body)
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status, headers: NO_STORE })
    return NextResponse.json(r.quote, { headers: NO_STORE })
  } catch (err) {
    console.error('[dogcity/licence-quote] error:', err)
    return NextResponse.json({ error: 'no reliable quote right now' }, { status: 503, headers: NO_STORE })
  }
}

export async function GET() {
  try {
    const m = await medians()
    if (!m.dog.ok || !m.btc.ok) {
      return NextResponse.json({ error: 'no reliable quote right now' }, { status: 503, headers: { 'Cache-Control': 'public, s-maxage=10' } })
    }
    const tiers: Record<string, number> = {}
    for (const t of LICENCE_TIERS) {
      const sats = satsForDog(LICENCE_DOG[t], m.dog.price, m.btc.price)
      if (sats === null) return NextResponse.json({ error: 'no reliable quote right now' }, { status: 503, headers: { 'Cache-Control': 'public, s-maxage=10' } })
      tiers[t] = sats
    }
    return NextResponse.json(
      { tiers, dogUsd: m.dog.price, btcUsd: m.btc.price, sources: [...m.dog.sources, ...m.btc.sources], asOf: new Date().toISOString(), lockMinutes: 15 },
      { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=30' } },
    )
  } catch (err) {
    console.error('[dogcity/licence-quote] preview error:', err)
    return NextResponse.json({ error: 'no reliable quote right now' }, { status: 503, headers: { 'Cache-Control': 'public, s-maxage=10' } })
  }
}
