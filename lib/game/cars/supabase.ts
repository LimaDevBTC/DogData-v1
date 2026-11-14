// ═══════════════════════════════════════════════════════════════════════════
// OS CARROS NO BANCO (migração 039): os stores de order.ts e sweep.ts e a leitura da garagem.
// Só fios: a conta mora em order.ts / payment.ts / sweep.ts, o crédito na função dogcity_car_credit.
// Toda leitura que decide dinheiro e falha LANÇA (a rota responde 503 ou a varredura conta erro); nunca se
// devolve "não tem" por engano.
// ═══════════════════════════════════════════════════════════════════════════
import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeAddress } from '@/lib/dog/licence-btc'
import { isCarModel } from './catalog'
import type { CarOrder, CarOrderStore, ModelRow } from './order'
import { keyOf, type CarSweepStore, type CreditOutcome, type StoredCarPayment } from './sweep'

const falha = (e: { message?: string } | null | undefined): never => { throw new Error(e?.message || 'database error') }
const ms = (v: unknown): number | null => (typeof v === 'string' && Number.isFinite(Date.parse(v)) ? Date.parse(v) : null)
/** inteiro seguro vindo do banco (bigint chega como número ou texto); qualquer outra coisa: null */
const int = (v: unknown): number | null => {
  const n = typeof v === 'string' && /^-?[0-9]+$/.test(v) ? Number(v) : v
  return typeof n === 'number' && Number.isSafeInteger(n) ? n : null
}
const num = (v: unknown): number | null => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

const iso = (t: number) => new Date(t).toISOString()

export function carOrderStore(db: SupabaseClient): CarOrderStore {
  return {
    async modelRow(model) {
      const { data, error } = await db.from('car_models').select('price_dog, active').eq('id', model).maybeSingle()
      if (error) falha(error)
      if (!data) return null
      const price = int((data as any).price_dog)
      return price === null ? null : ({ priceDog: price, active: (data as any).active === true } satisfies ModelRow)
    },
    async ownsModel(wallet, model) {
      const { data, error } = await db.rpc('dogcity_car_owned', { p_wallet: wallet, p_model: model })
      if (error) falha(error)
      if (typeof data !== 'boolean') throw new Error('dogcity_car_owned: unexpected answer')
      return data
    },
    async countByWalletSince(wallet, sinceMs) {
      const { count, error } = await db.from('car_orders').select('id', { count: 'exact', head: true }).eq('wallet', wallet).gte('created_at', iso(sinceMs))
      if (error) falha(error)
      return count ?? 0
    },
    async countByPayerSince(payer, sinceMs) {
      const { count, error } = await db.from('car_orders').select('id', { count: 'exact', head: true }).eq('payer_address', payer).gte('created_at', iso(sinceMs))
      if (error) falha(error)
      return count ?? 0
    },
    async dogAmountTaken(atoms, sinceMs) {
      const { count, error } = await db.from('car_orders').select('id', { count: 'exact', head: true })
        .eq('currency', 'dog').eq('dog_exact_atoms', atoms).gte('created_at', iso(sinceMs))
      if (error) falha(error)
      return (count ?? 0) > 0
    },
    async insert(o) {
      const { error } = await db.from('car_orders').insert({
        id: o.id, model: o.model, wallet: o.wallet, currency: o.currency, payer_address: o.payerAddress, pay_to: o.payTo,
        price_dog: o.priceDog, sats: o.sats, dog_exact_atoms: o.dogExactAtoms, dog_usd: o.dogUsd, btc_usd: o.btcUsd,
        sources: o.sources, created_at: iso(o.createdAtMs), expires_at: iso(o.expiresAtMs),
      })
      if (error) falha(error)
    },
  }
}

/** linha de car_orders -> CarOrder; linha torta não vira pedido (não casa com nada) */
export function orderFromDb(r: any): CarOrder | null {
  const created = ms(r?.created_at), expires = ms(r?.expires_at)
  const wallet = normalizeAddress(r?.wallet), payer = normalizeAddress(r?.payer_address)
  const price = int(r?.price_dog)
  if (created === null || expires === null || !wallet || !payer || price === null || !isCarModel(r?.model)) return null
  if (r.currency !== 'btc' && r.currency !== 'dog') return null
  const sats = r.sats == null ? null : int(r.sats)
  const atoms = r.dog_exact_atoms == null ? null : int(r.dog_exact_atoms)
  if (r.currency === 'btc' ? sats === null || sats <= 0 : atoms === null || atoms <= 0) return null
  return {
    id: String(r.id), model: r.model, wallet, currency: r.currency, payerAddress: payer, payTo: String(r.pay_to ?? ''),
    priceDog: price, sats: r.currency === 'btc' ? sats : null, dogExactAtoms: r.currency === 'dog' ? atoms : null,
    dogUsd: num(r.dog_usd), btcUsd: num(r.btc_usd), sources: Array.isArray(r.sources) ? r.sources : [],
    createdAtMs: created, expiresAtMs: expires,
  }
}

function rowFromDb(r: any): StoredCarPayment | null {
  const vout = int(r?.vout), amount = int(r?.amount)
  if (vout === null || amount === null || (r?.currency !== 'btc' && r?.currency !== 'dog')) return null
  return {
    currency: r.currency, txid: r.txid, vout, amount, payerAddresses: Array.isArray(r.payer_addresses) ? r.payer_addresses : [],
    firstSeenMs: ms(r.first_seen_at) ?? Date.now(), blockHeight: int(r.block_height), blockTimeMs: ms(r.block_time),
    status: r.status, reviewReason: r.review_reason ?? null,
  }
}

/** quantos pedidos a varredura aceita carregar de uma vez; mais que isto é anomalia e a volta falha fechada */
export const MAX_ORDERS_LOADED = 5_000

const CREDIT_OUTCOMES: ReadonlySet<string> = new Set(['credited', 'already_owned', 'order_already_paid', 'unmatched', 'pending_review'])

export function carSweepStore(db: SupabaseClient): CarSweepStore {
  return {
    async loadRows(currency, txids) {
      const out = new Map<string, StoredCarPayment>()
      for (let i = 0; i < txids.length; i += 100) {
        const { data, error } = await db.from('car_payments').select('*').eq('currency', currency).in('txid', txids.slice(i, i + 100))
        if (error) falha(error)
        for (const r of data ?? []) {
          const p = rowFromDb(r)
          // linha que não se lê não pode ser tratada como "nova": seria recontada. Falha a volta.
          if (!p) throw new Error('car_payments: unreadable row')
          out.set(keyOf(p.currency, p.txid, p.vout), p)
        }
      }
      return out
    },
    async loadOrders(sinceExpiresMs) {
      const { data, error } = await db.from('car_orders').select('*').gte('expires_at', iso(sinceExpiresMs))
        .order('created_at', { ascending: true }).limit(MAX_ORDERS_LOADED + 1)
      if (error) falha(error)
      const rows = data ?? []
      if (rows.length > MAX_ORDERS_LOADED) throw new Error('car_orders: too many open orders for one sweep')
      return rows.flatMap((r) => { const o = orderFromDb(r); return o ? [o] : [] })
    },
    async saveRow(row) {
      if (row.status === 'credited') throw new Error('a credit is written only by dogcity_car_credit')
      const { error } = await db.from('car_payments').upsert({
        currency: row.currency, txid: row.txid, vout: row.vout, amount: row.amount, payer_addresses: row.payerAddresses,
        first_seen_at: iso(row.firstSeenMs), block_height: row.blockHeight, block_time: row.blockTimeMs ? iso(row.blockTimeMs) : null,
        status: row.status, review_reason: row.reviewReason, updated_at: new Date().toISOString(),
      }, { onConflict: 'currency,txid,vout' })
      if (error) falha(error)
    },
    async credit(row, orderId) {
      const { data, error } = await db.rpc('dogcity_car_credit', {
        p_currency: row.currency, p_txid: row.txid, p_vout: row.vout, p_amount: row.amount, p_payers: row.payerAddresses,
        p_first_seen: iso(row.firstSeenMs), p_block_height: row.blockHeight, p_block_time: row.blockTimeMs ? iso(row.blockTimeMs) : null,
        p_order_id: orderId,
      })
      if (error) falha(error)
      if (typeof data !== 'string' || !CREDIT_OUTCOMES.has(data)) throw new Error('dogcity_car_credit: unexpected answer')
      return data as CreditOutcome
    },
  }
}

/** a ponta do índice do $DOG (a maior altura que o scanner já gravou) */
export async function dogIndexTip(db: SupabaseClient, signal?: AbortSignal): Promise<number> {
  let q = db.from('dog_transactions').select('block_height').order('block_height', { ascending: false }).limit(1)
  if (signal) q = q.abortSignal(signal)
  const { data, error } = await q
  if (error) falha(error)
  const h = int((data ?? [])[0]?.block_height)
  if (h === null || h <= 0) throw new Error('dog index tip unavailable')
  return h
}

/**
 * As linhas do índice do $DOG que tocam `address`, desde `sinceMs`, das MAIS NOVAS para as mais antigas, até
 * `maxRows`. Passar do teto não derruba a volta (poeira mandada ao endereço não pode travar a loja): as mais
 * antigas ficam para depois, e o que não foi lido nunca vira carro (falha fechada). `truncated` sai no log.
 */
export async function dogRowsTouching(db: SupabaseClient, address: string, sinceMs: number, maxRows = 2_000): Promise<{ rows: any[]; truncated: boolean }> {
  const PAGE = 500
  const rows: any[] = []
  for (let from = 0; from < maxRows; from += PAGE) {
    const { data, error } = await db.from('dog_transactions').select('txid, block_height, timestamp, senders, receivers')
      .contains('addresses', [address]).gte('timestamp', iso(sinceMs))
      .order('block_height', { ascending: false }).order('id', { ascending: false }).range(from, from + PAGE - 1)
    if (error) falha(error)
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) return { rows, truncated: false }
  }
  return { rows, truncated: true }
}

export interface OwnedCar { model: string; source: 'purchase' | 'prize'; since: string | null }

/** a garagem de uma carteira: a posse registrada mais os prêmios aprovados/entregues da corrida */
export async function carsOf(db: SupabaseClient, wallet: string, signal?: AbortSignal): Promise<OwnedCar[]> {
  let q = db.rpc('dogcity_cars_of', { p_wallet: wallet })
  if (signal) q = q.abortSignal(signal)
  const { data, error } = await q
  if (error) falha(error)
  if (!Array.isArray(data)) throw new Error('dogcity_cars_of: unexpected answer')
  const seen = new Set<string>()
  const out: OwnedCar[] = []
  for (const r of data as any[]) {
    if (!isCarModel(r?.model) || seen.has(r.model)) continue
    if (r.source !== 'purchase' && r.source !== 'prize') continue
    seen.add(r.model)
    out.push({ model: r.model, source: r.source, since: typeof r.since === 'string' ? r.since : null })
  }
  return out.sort((a, b) => (a.model < b.model ? -1 : a.model > b.model ? 1 : 0))
}
