/**
 * GET /api/cron/licence-btc   (Vercel Cron, a cada 2 minutos)
 *
 * A varredura dos pagamentos em BTC ao endereço Bitcoin do fundo: lê o endereço no
 * mempool.space, grava cada pagamento em dogcity_btc_payments e credita (ou não) à carteira
 * ordinals ligada pela cotação (lib/dog/licence-btc-sweep.ts). Regras de crédito:
 * lib/dog/licence-btc.ts. Falha fechada: sem cotação confiável o pagamento fica em revisão.
 *
 * LICENÇA NO LOTE (12/11, LICENCA_NO_LOTE_CONTRATO.md): depois da varredura, a MESMA volta aplica o crédito
 * livre aos lotes (lib/dog/licence-lot-service.ts, passeDosLotes): primeiro os pagamentos em BTC cuja cotação
 * nomeou o lote (o crédito que esta volta acabou de gravar já cai no lote), depois a automática, perguntando
 * ao mint quem guarda o quê (até 20 carteiras por volta, em rodízio). Fica aqui e não num cron novo porque é
 * a continuação do crédito em BTC, roda a cada 2 minutos com o mesmo segredo, e não pede mudança na Vercel.
 * Uma falha nesta parte não derruba a varredura: sai em `lots.error` e a próxima volta tenta de novo.
 *
 * Protegida por CRON_SECRET (Authorization: Bearer ...), como o cron da Vercel manda quando
 * a variável existe. Sem CRON_SECRET configurada a rota recusa TUDO: nada de segredo no repo.
 * Não toca em dog_transactions, no livro dos founders, em total_received nem no bloco B.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'node:crypto'
import { LINK_WINDOW_AFTER_EXPIRY_MS, normalizeAddress, type Quote } from '@/lib/dog/licence-btc'
import { readChain, sweepOnce, keyOf, type StoredPayment, type SweepStore } from '@/lib/dog/licence-btc-sweep'
import { priceAtTime, type FetchLike } from '@/lib/dog/price-sources'
import { normalizeLotId } from '@/lib/dog/licence-lot'
import { passeDosLotes } from '@/lib/dog/licence-lot-service'
import { holderDoMint, lotLicenceStore } from '@/lib/dog/licence-lot-supabase'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } },
)

const nofetch = (u: string, i?: any) => fetch(u, i) as ReturnType<FetchLike>

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const got = Buffer.from(req.headers.get('authorization') ?? '')
  const want = Buffer.from(`Bearer ${secret}`)
  return got.length === want.length && timingSafeEqual(got, want)
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}
const ms = (v: unknown): number | null => (typeof v === 'string' ? (Number.isFinite(Date.parse(v)) ? Date.parse(v) : null) : null)

function fromDb(r: any): StoredPayment {
  return {
    txid: r.txid, vout: Number(r.vout), sats: Number(r.sats), payerAddresses: r.payer_addresses ?? [],
    firstSeenMs: ms(r.first_seen_at) ?? Date.now(), blockHeight: num(r.block_height), blockTimeMs: ms(r.block_time),
    status: r.status, reviewReason: r.review_reason ?? null, ordinalsAddress: r.ordinals_address ?? null, quoteId: r.quote_id ?? null,
    creditDog: num(r.credit_dog), basis: r.basis ?? null, dogUsd: num(r.dog_usd), btcUsd: num(r.btc_usd),
  }
}

function toDb(r: StoredPayment) {
  return {
    txid: r.txid, vout: r.vout, sats: r.sats, payer_addresses: r.payerAddresses,
    first_seen_at: new Date(r.firstSeenMs).toISOString(),
    block_height: r.blockHeight, block_time: r.blockTimeMs ? new Date(r.blockTimeMs).toISOString() : null,
    status: r.status, review_reason: r.reviewReason, ordinals_address: r.ordinalsAddress, quote_id: r.quoteId,
    credit_dog: r.creditDog, basis: r.basis, dog_usd: r.dogUsd, btc_usd: r.btcUsd,
    credited_at: r.status === 'credited' ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }
}

function fromQuoteDb(r: any): Quote | null {
  const created = ms(r.created_at), expires = ms(r.expires_at)
  const normOrd = normalizeAddress(r.ordinals_address), normPay = normalizeAddress(r.payment_address)
  if (created === null || expires === null || !normOrd || !normPay) return null
  const lotId = normalizeLotId(r.lot_id)
  return {
    id: r.id, tier: r.tier, ordinalsAddress: normOrd, paymentAddress: normPay, dogAmount: Number(r.dog_amount), sats: Number(r.sats),
    dogUsd: Number(r.dog_usd), btcUsd: Number(r.btc_usd), createdAtMs: created, expiresAtMs: expires, sources: Array.isArray(r.sources) ? r.sources : [],
    ...(lotId ? { lotId } : {}),
  }
}

const store: SweepStore = {
  async loadRows(txids) {
    const out = new Map<string, StoredPayment>()
    for (let i = 0; i < txids.length; i += 100) {
      const { data, error } = await supabase.from('dogcity_btc_payments').select('*').in('txid', txids.slice(i, i + 100))
      if (error) throw new Error(error.message)
      for (const r of data ?? []) { const p = fromDb(r); out.set(keyOf(p.txid, p.vout), p) }
    }
    return out
  },
  async loadQuotes(payers) {
    if (payers.length === 0) return []
    // cotação que ainda pode ligar um pagamento: venceu há menos de 30 dias (a janela real é de 2 h)
    const since = new Date(Date.now() - 30 * 24 * 3_600_000 - LINK_WINDOW_AFTER_EXPIRY_MS).toISOString()
    const { data, error } = await supabase.from('dogcity_licence_quotes').select('*').in('payment_address', payers).gte('expires_at', since)
    if (error) throw new Error(error.message)
    return (data ?? []).flatMap((r) => { const q = fromQuoteDb(r); return q ? [q] : [] })
  },
  async saveRow(row) {
    const { error } = await supabase.from('dogcity_btc_payments').upsert(toDb(row), { onConflict: 'txid,vout' })
    if (error) throw new Error(error.message)
  },
}

// a licença no lote: roda com ou sem a varredura (o crédito em $DOG não depende do mempool.space), e a
// falha dela não desfaz nem esconde a varredura
const lotsPass = () =>
  passeDosLotes({ store: lotLicenceStore(supabase), holder: (a) => holderDoMint(a), nowMs: Date.now() })
    .catch((e) => { console.error('[cron/licence-btc] lots pass failed:', e); return { error: 'lots pass failed' } })

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  try {
    const chain = await readChain(nofetch)
    const result = await sweepOnce({ nowMs: Date.now(), chain, store, priceAtBlock: (t) => priceAtTime(nofetch, t) })
    const lots = await lotsPass()
    return NextResponse.json({ ok: true, tip: chain.tip, seen: chain.payments.length, ...result, lots }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('[cron/licence-btc] error:', err)
    const lots = await lotsPass()
    return NextResponse.json({ ok: false, error: 'sweep failed', lots }, { status: 502, headers: { 'Cache-Control': 'no-store' } })
  }
}
