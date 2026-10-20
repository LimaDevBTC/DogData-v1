// ═══════════════════════════════════════════════════════════════════════════
// VARREDURA DOS PAGAMENTOS EM BTC: o que chegou ao endereço Bitcoin do fundo e a quem se
// credita. A rota /api/cron/licence-btc só liga os fios (rede, banco); a conta está aqui,
// e as regras de crédito estão em licence-btc.ts.
//
// POR QUE EXISTE: o scanner do DOG (scripts/dog_block_scanner.py) só grava transação com
// DOG de entrada (`if not dog_inputs: continue`), e o placar lê só esse banco. Um pagamento
// em BTC ao endereço bc1qkq43... NUNCA aparece lá. Esta varredura lê o endereço no
// mempool.space e grava cada pagamento em dogcity_btc_payments.
//
// O QUE ELA NÃO FAZ: não mexe em dog_transactions, no livro dos founders, em total_received
// nem no bloco B. BTC é outra tabela, outra rota, outro contador.
// ═══════════════════════════════════════════════════════════════════════════
import {
  BTC_MIN_CONFIRMATIONS, FUND_BTC_ADDRESS, FUND_DOG_ADDRESS, resolvePayment,
  type BtcPayment, type PriceAtBlock, type Quote, type Resolution,
} from './licence-btc'
import type { FetchLike } from './price-sources'

const MEMPOOL = 'https://mempool.space/api'
/** páginas de 25 transações confirmadas por varredura (as anteriores a isto nunca foram pagamento de licença) */
export const MAX_PAGES = 4

export interface ChainPayment {
  txid: string
  vout: number
  sats: number
  payerAddresses: string[]
  confirmed: boolean
  blockHeight: number | null
  blockTimeMs: number | null
}

/** Os pagamentos de UMA transação do mempool.space ao endereço Bitcoin do fundo. */
export function paymentsFromTx(tx: any): ChainPayment[] {
  const txid = typeof tx?.txid === 'string' ? tx.txid.toLowerCase() : ''
  if (!/^[0-9a-f]{64}$/.test(txid)) return []
  const payers = [...new Set<string>(
    (Array.isArray(tx.vin) ? tx.vin : [])
      .map((i: any) => i?.prevout?.scriptpubkey_address)
      .filter((a: unknown): a is string => typeof a === 'string' && a.length > 0)
      .map((a: string) => (a.toLowerCase().startsWith('bc1') ? a.toLowerCase() : a)),
  )]
  // o fundo como pagador (movimento interno, retirada) nunca é pagamento
  if (payers.includes(FUND_BTC_ADDRESS) || payers.includes(FUND_DOG_ADDRESS)) return []
  const confirmed = tx?.status?.confirmed === true
  const h = Number(tx?.status?.block_height)
  const bt = Number(tx?.status?.block_time)
  const out: ChainPayment[] = []
  ;(Array.isArray(tx.vout) ? tx.vout : []).forEach((o: any, vout: number) => {
    if (o?.scriptpubkey_address !== FUND_BTC_ADDRESS) return
    const sats = Number(o.value)
    if (!Number.isSafeInteger(sats) || sats <= 0) return
    out.push({
      txid, vout, sats, payerAddresses: payers, confirmed,
      blockHeight: confirmed && Number.isSafeInteger(h) && h > 0 ? h : null,
      blockTimeMs: confirmed && Number.isFinite(bt) && bt > 0 ? bt * 1000 : null,
    })
  })
  return out
}

async function json(f: FetchLike, url: string): Promise<any> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 8_000)
  try {
    const r = await f(url, { signal: ctrl.signal, cache: 'no-store' })
    if (!r.ok) throw new Error(`${url} ${r.status}`)
    return await r.json()
  } finally {
    clearTimeout(t)
  }
}

/** Lê a ponta e os pagamentos recentes ao endereço do fundo, mais a primeira vista das não confirmadas. */
export async function readChain(f: FetchLike, pages = MAX_PAGES): Promise<{
  tip: number
  payments: ChainPayment[]
  firstSeenMs: Map<string, number>
}> {
  const tip = Number(await json(f, `${MEMPOOL}/blocks/tip/height`))
  if (!Number.isSafeInteger(tip) || tip <= 0) throw new Error('bad tip height')
  const payments: ChainPayment[] = []
  const unconfirmed: string[] = []
  let url = `${MEMPOOL}/address/${FUND_BTC_ADDRESS}/txs`
  for (let p = 0; p < pages; p++) {
    const txs: any[] = await json(f, url)
    if (!Array.isArray(txs) || txs.length === 0) break
    for (const tx of txs) {
      const ps = paymentsFromTx(tx)
      payments.push(...ps)
      if (ps.length && !ps[0].confirmed) unconfirmed.push(ps[0].txid)
    }
    const confirmed = txs.filter((t) => t?.status?.confirmed === true)
    // a primeira página traz as da mempool mais 25 confirmadas; as seguintes só confirmadas
    if (confirmed.length < 25) break
    url = `${MEMPOOL}/address/${FUND_BTC_ADDRESS}/txs/chain/${confirmed[confirmed.length - 1].txid}`
  }
  const firstSeenMs = new Map<string, number>()
  const ids = [...new Set(unconfirmed)].slice(0, 50)
  if (ids.length) {
    // 0 = a rede não sabe; qualquer coisa que não seja inteiro positivo é ignorada
    const times = await json(f, `${MEMPOOL}/v1/transaction-times?${ids.map((i) => `txId[]=${i}`).join('&')}`).catch(() => [])
    ids.forEach((id, i) => {
      const t = Number(Array.isArray(times) ? times[i] : 0)
      if (Number.isSafeInteger(t) && t > 0) firstSeenMs.set(id, t * 1000)
    })
  }
  return { tip, payments, firstSeenMs }
}

// ── A VARREDURA ─────────────────────────────────────────────────────────────

export interface StoredPayment {
  txid: string
  vout: number
  sats: number
  payerAddresses: string[]
  firstSeenMs: number
  blockHeight: number | null
  blockTimeMs: number | null
  status: 'observed' | 'credited' | 'unmatched' | 'pending_review'
  reviewReason: string | null
  ordinalsAddress: string | null
  quoteId: string | null
  creditDog: number | null
  basis: 'quote' | 'block' | null
  dogUsd: number | null
  btcUsd: number | null
}

export interface SweepStore {
  /** linhas já gravadas, por `txid:vout` */
  loadRows(txids: string[]): Promise<Map<string, StoredPayment>>
  /** cotações que ligam algum destes endereços pagadores */
  loadQuotes(payers: string[]): Promise<Quote[]>
  saveRow(row: StoredPayment): Promise<void>
}

export const keyOf = (txid: string, vout: number) => `${txid}:${vout}`

/** Estados que a varredura não toca mais. `price_unavailable` tenta de novo sozinho. */
export function isFinal(r: Pick<StoredPayment, 'status' | 'reviewReason'>): boolean {
  if (r.status === 'credited' || r.status === 'unmatched') return true
  return r.status === 'pending_review' && r.reviewReason !== 'price_unavailable'
}

function toRow(cp: ChainPayment, firstSeenMs: number, res: Resolution): StoredPayment {
  const base: StoredPayment = {
    txid: cp.txid, vout: cp.vout, sats: cp.sats, payerAddresses: cp.payerAddresses, firstSeenMs,
    blockHeight: cp.blockHeight, blockTimeMs: cp.blockTimeMs,
    status: 'observed', reviewReason: null, ordinalsAddress: null, quoteId: null, creditDog: null, basis: null, dogUsd: null, btcUsd: null,
  }
  if (res.status === 'credited') {
    return { ...base, status: 'credited', ordinalsAddress: res.ordinalsAddress, quoteId: res.quoteId, creditDog: res.creditDog, basis: res.basis, dogUsd: res.dogUsd, btcUsd: res.btcUsd }
  }
  if (res.status === 'pending_review') return { ...base, status: 'pending_review', reviewReason: res.reason }
  if (res.status === 'unmatched') return { ...base, status: 'unmatched', reviewReason: res.reason }
  return base
}

export interface SweepResult { credited: number; unmatched: number; pendingReview: number; observed: number; skipped: number }

export async function sweepOnce(deps: {
  nowMs: number
  chain: { tip: number; payments: ChainPayment[]; firstSeenMs: Map<string, number> }
  store: SweepStore
  priceAtBlock: (blockTimeMs: number) => Promise<PriceAtBlock | null>
}): Promise<SweepResult> {
  const { nowMs, chain, store } = deps
  const result: SweepResult = { credited: 0, unmatched: 0, pendingReview: 0, observed: 0, skipped: 0 }
  const rows = await store.loadRows([...new Set(chain.payments.map((p) => p.txid))])

  for (const cp of chain.payments) {
    const ex = rows.get(keyOf(cp.txid, cp.vout))
    if (ex && isFinal(ex)) { result.skipped++; continue }
    // a primeira vista só anda para trás: a mais antiga entre a nossa e a da rede
    const firstSeenMs = Math.min(ex?.firstSeenMs ?? nowMs, chain.firstSeenMs.get(cp.txid) ?? nowMs)
    const confirmations = cp.confirmed && cp.blockHeight ? Math.max(0, chain.tip - cp.blockHeight + 1) : 0
    const payment: BtcPayment = {
      txid: cp.txid, vout: cp.vout, sats: cp.sats, payerAddresses: cp.payerAddresses,
      seenAtMs: firstSeenMs, confirmations, blockTimeMs: cp.blockTimeMs,
    }
    const quotes = confirmations >= BTC_MIN_CONFIRMATIONS ? await store.loadQuotes(cp.payerAddresses) : []
    const res = await resolvePayment(payment, quotes, deps.priceAtBlock)
    await store.saveRow(toRow(cp, firstSeenMs, res))
    if (res.status === 'credited') result.credited++
    else if (res.status === 'unmatched') result.unmatched++
    else if (res.status === 'pending_review') result.pendingReview++
    else result.observed++
  }
  return result
}
