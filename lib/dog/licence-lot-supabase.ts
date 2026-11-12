// ═══════════════════════════════════════════════════════════════════════════
// A LICENÇA NO LOTE: os fios de verdade (banco e mint) por trás das interfaces de licence-lot-service.ts.
// Só servidor (chave de service role).
//
//   lotLicenceStore(db)   dogcity_licence_assignment, dogcity_lot_licence, dogcity_licence_apply (037),
//                         dog_transactions e dogcity_btc_payments (as mesmas consultas do placar)
//   holderDoMint(addr)    GET https://mint.dogcity.space/api/mint/holder/<address>, prazo curto
//   (a reserva do lote pelo registro selado mora em licence-lot-registro.ts, para o escrituras.bin de 3 MB
//    só entrar nas funções que o leem: standing e cotação, não o placar nem a varredura)
//
// SEM AS TABELAS DA 037 o store lança SemTabela, e o serviço cai no modo antigo (licença por carteira).
// ═══════════════════════════════════════════════════════════════════════════
import type { SupabaseClient } from '@supabase/supabase-js'
import type { TxRow } from './founders-ledger'
import { FUND_DOG_ADDRESS, isTier, normalizeAddress, type LicenceTier } from './licence-btc'
import {
  normalizeLotId, readMintHolder,
  type Assignment, type AssignmentSource, type CreditedPayment, type LicenceTierCount, type MintHolder,
} from './licence-lot'
import { SemTabela, type LotLicenceCronStore } from './licence-lot-service'
import { rowsOf } from './licence-wallet'

/** o mint (o mesmo host de /api/dogcity/lot-state). DOGCITY_MINT_URL só para ensaio local. */
export const MINT_ORIGIN = (process.env.DOGCITY_MINT_URL || 'https://mint.dogcity.space').replace(/\/+$/, '')
/** o mint chama o standing com prazo de 2,5 s: a pergunta de volta a ele tem de caber dentro disso */
export const HOLDER_MS = 1_500

const PAGE = 1000
const MAX_PAGES = 100
const CHUNK = 100

type PgErro = { message: string; code?: string } | null

/** tabela, coluna ou função da 037 que o banco ainda não tem */
export function ehSemTabela(e: PgErro | undefined): boolean {
  if (!e) return false
  if (['42P01', '42703', '42883', 'PGRST202', 'PGRST204', 'PGRST205'].includes(String(e.code ?? ''))) return true
  return /does not exist|schema cache|could not find the/i.test(e.message ?? '')
}

function falha(e: PgErro): never {
  if (ehSemTabela(e)) throw new SemTabela(e?.message)
  throw new Error(e?.message ?? 'database error')
}

const num = (v: unknown): number => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : 0
}
const fontes: AssignmentSource[] = ['dog', 'btc', 'migration']

function assignmentDe(r: any): Assignment | null {
  const lotId = normalizeLotId(r?.lot_id)
  const wallet = normalizeAddress(r?.wallet)
  if (!lotId || !wallet || !fontes.includes(r?.source)) return null
  return { lotId, wallet, amountDog: num(r.amount_dog), source: r.source, ref: typeof r.ref === 'string' ? r.ref : null }
}

function creditedDe(r: any): CreditedPayment | null {
  const ordinalsAddress = normalizeAddress(r?.ordinals_address)
  if (!ordinalsAddress || typeof r?.txid !== 'string') return null
  return { txid: r.txid, vout: Number(r.vout), ordinalsAddress, creditDog: num(r.credit_dog), quoteId: typeof r.quote_id === 'string' ? r.quote_id : null }
}

async function paginado<T>(ler: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: PgErro }>, de: (r: any) => T | null): Promise<T[]> {
  const out: T[] = []
  for (let p = 0; p < MAX_PAGES; p++) {
    const { data, error } = await ler(p * PAGE, p * PAGE + PAGE - 1)
    if (error) falha(error)
    for (const r of data ?? []) { const v = de(r); if (v) out.push(v) }
    if (!data || data.length < PAGE) return out
  }
  throw new Error('too many rows')
}

const pedacos = <T>(xs: T[]) => Array.from({ length: Math.ceil(xs.length / CHUNK) }, (_, i) => xs.slice(i * CHUNK, i * CHUNK + CHUNK))

export function lotLicenceStore(db: SupabaseClient): LotLicenceCronStore {
  const comSinal = <Q extends { abortSignal: (s: AbortSignal) => Q }>(q: Q, s?: AbortSignal) => (s ? q.abortSignal(s) : q)
  return {
    async fundRowsOf(address, signal) {
      return rowsOf(db, address, signal ?? new AbortController().signal)
    },
    async creditedOf(address, signal) {
      const { data, error } = await comSinal(
        db.from('dogcity_btc_payments').select('txid, vout, ordinals_address, credit_dog, quote_id').eq('status', 'credited').eq('ordinals_address', address),
        signal,
      )
      if (error) throw new Error(error.message)
      return (data ?? []).flatMap((r) => { const c = creditedDe(r); return c ? [c] : [] })
    },
    async quoteLots(quoteIds, signal) {
      const out = new Map<string, string>()
      for (const ids of pedacos(quoteIds)) {
        const { data, error } = await comSinal(db.from('dogcity_licence_quotes').select('id, lot_id').in('id', ids).not('lot_id', 'is', null), signal)
        if (error) falha(error)
        for (const r of data ?? []) { const l = normalizeLotId(r.lot_id); if (l && typeof r.id === 'string') out.set(r.id, l) }
      }
      return out
    },
    async assignmentsOf(wallet, signal) {
      const { data, error } = await comSinal(
        db.from('dogcity_licence_assignment').select('lot_id, wallet, amount_dog, source, ref').eq('wallet', wallet),
        signal,
      )
      if (error) falha(error)
      return (data ?? []).flatMap((r) => { const a = assignmentDe(r); return a ? [a] : [] })
    },
    async lotTotals(lotIds, signal) {
      const out = new Map<string, number>()
      for (const ids of pedacos([...new Set(lotIds)])) {
        const { data, error } = await comSinal(db.from('dogcity_lot_licence').select('lot_id, total_dog').in('lot_id', ids), signal)
        if (error) falha(error)
        for (const r of data ?? []) { const l = normalizeLotId(r.lot_id); if (l) out.set(l, num(r.total_dog)) }
      }
      return out
    },
    async apply(wallet, app, appliedBeforeDog) {
      const { data, error } = await db.rpc('dogcity_licence_apply', {
        p_wallet: wallet,
        p_lot_id: app.lotId,
        p_amount: app.amountDog,
        p_source: app.source,
        p_ref: app.ref,
        p_applied_before: appliedBeforeDog,
      })
      if (error) falha(error)
      return typeof data === 'string' && data.length > 0
    },
    async allFundRows() {
      return paginado<TxRow>(
        (a, b) => db.from('dog_transactions').select('id, txid, block_height, timestamp, senders, receivers')
          .contains('addresses', [FUND_DOG_ADDRESS]).order('block_height', { ascending: true }).order('id', { ascending: true }).range(a, b),
        (r) => r as TxRow,
      )
    },
    async allCredited() {
      return paginado(
        (a, b) => db.from('dogcity_btc_payments').select('txid, vout, ordinals_address, credit_dog, quote_id').eq('status', 'credited')
          .order('txid', { ascending: true }).order('vout', { ascending: true }).range(a, b),
        creditedDe,
      )
    },
    async allAssignments() {
      return paginado(
        (a, b) => db.from('dogcity_licence_assignment').select('lot_id, wallet, amount_dog, source, ref')
          .order('created_at', { ascending: true }).order('id', { ascending: true }).range(a, b),
        assignmentDe,
      )
    },
  }
}

/**
 * Quantas licenças existem, contadas por LOTE (o placar da landing). null = a tabela não existe ainda
 * ou o banco não respondeu: quem chama segue com a contagem antiga, por carteira.
 */
export async function licencasPorLote(db: SupabaseClient): Promise<LicenceTierCount | null> {
  try {
    const tiers = await paginado<LicenceTier>(
      (a, b) => db.from('dogcity_lot_licence').select('lot_id, tier').not('tier', 'is', null).order('lot_id', { ascending: true }).range(a, b),
      (r) => (isTier(r?.tier) ? r.tier : null),
    )
    const c: LicenceTierCount = { personal: 0, commercial: 0, patron: 0 }
    for (const t of tiers) c[t]++
    return c
  } catch {
    return null
  }
}

/** o mint: os lotes que o endereço guarda agora. null em qualquer dúvida (rede, prazo, status, forma). */
export async function holderDoMint(address: string, opts: { fetch?: typeof fetch; ms?: number } = {}): Promise<MintHolder | null> {
  const f = opts.fetch ?? fetch
  try {
    const r = await f(`${MINT_ORIGIN}/api/mint/holder/${encodeURIComponent(address)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(opts.ms ?? HOLDER_MS),
      headers: { accept: 'application/json' },
    })
    if (!r.ok) return null
    return readMintHolder(await r.json(), address)
  } catch {
    return null
  }
}
