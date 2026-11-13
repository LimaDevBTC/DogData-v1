// ═══════════════════════════════════════════════════════════════════════════
// A VARREDURA DOS PAGAMENTOS DOS CARROS: o que chegou aos endereços do fundo do carro e a quem vira carro.
// A rota /api/cron/car-pay só liga os fios (rede, banco); o casamento está em payment.ts e o crédito na
// função `dogcity_car_credit` da migração 039.
//
// BTC: lê o CAR_FUND_BTC_ADDRESS no mempool.space (como lib/dog/licence-btc-sweep.ts faz com o fundo da
//      licença, mas com o endereço do carro por parâmetro e gravando em car_payments).
// $DOG: lê as linhas de `dog_transactions` (o índice do scanner, scripts/dog_block_scanner.py) que tocam o
//      CAR_FUND_DOG_ADDRESS. Cada receptor desse endereço é um pagamento (txid + vout do receptor). O txid
//      consumido fica gravado: a mesma saída nunca vira dois carros (chave primária + função no banco).
//      As confirmações contam pela ponta do PRÓPRIO índice (o scanner nunca está à frente da rede).
//
// O QUE ELA NÃO FAZ: não lê nem escreve as tabelas da licença, o livro dos founders ou o bloco B.
// ═══════════════════════════════════════════════════════════════════════════
import { BTC_MIN_CONFIRMATIONS, normalizeAddress } from '@/lib/dog/licence-btc'
import type { FetchLike } from '@/lib/dog/price-sources'
import { matchCarPayment, type CarMatch, type CarPayment } from './payment'
import { BLOCK_TIME_SLACK_MS, BTC_LATE_REVIEW_MS, DOG_BLOCK_GRACE_MS, DOG_LATE_REVIEW_MS, type CarCurrency, type CarOrder } from './order'

const MEMPOOL = 'https://mempool.space/api'
/** páginas de 25 transações confirmadas por varredura */
export const MAX_PAGES = 4
const TXID_RE = /^[0-9a-f]{64}$/

const canon = (a: string) => (a.toLowerCase().startsWith('bc1') ? a.toLowerCase() : a)

export interface ChainPayment {
  currency: CarCurrency
  txid: string
  vout: number
  amount: number
  payerAddresses: string[]
  confirmed: boolean
  blockHeight: number | null
  blockTimeMs: number | null
}

// ── BTC ─────────────────────────────────────────────────────────────────────

/** Os pagamentos de UMA transação do mempool.space ao endereço BTC do carro. O fundo como pagador fica de fora. */
export function btcPaymentsFromTx(tx: any, carBtcAddress: string, funds: string[]): ChainPayment[] {
  const to = canon(carBtcAddress)
  const txid = typeof tx?.txid === 'string' ? tx.txid.toLowerCase() : ''
  if (!TXID_RE.test(txid)) return []
  const payers = [...new Set<string>(
    (Array.isArray(tx.vin) ? tx.vin : [])
      .map((i: any) => i?.prevout?.scriptpubkey_address)
      .filter((a: unknown): a is string => typeof a === 'string' && a.length > 0)
      .map(canon),
  )]
  const fundSet = new Set(funds.map(canon))
  if (payers.some((p) => fundSet.has(p))) return []
  const confirmed = tx?.status?.confirmed === true
  const h = Number(tx?.status?.block_height)
  const bt = Number(tx?.status?.block_time)
  const out: ChainPayment[] = []
  ;(Array.isArray(tx.vout) ? tx.vout : []).forEach((o: any, vout: number) => {
    if (typeof o?.scriptpubkey_address !== 'string' || canon(o.scriptpubkey_address) !== to) return
    const sats = Number(o.value)
    if (!Number.isSafeInteger(sats) || sats <= 0) return
    out.push({
      currency: 'btc', txid, vout, amount: sats, payerAddresses: payers, confirmed,
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

/** A ponta da rede e os pagamentos recentes ao endereço BTC do carro, mais a primeira vista das não confirmadas. */
export async function readBtcChain(f: FetchLike, carBtcAddress: string, funds: string[], pages = MAX_PAGES): Promise<{
  tip: number
  payments: ChainPayment[]
  firstSeenMs: Map<string, number>
}> {
  const tip = Number(await json(f, `${MEMPOOL}/blocks/tip/height`))
  if (!Number.isSafeInteger(tip) || tip <= 0) throw new Error('bad tip height')
  const payments: ChainPayment[] = []
  let url = `${MEMPOOL}/address/${carBtcAddress}/txs`
  for (let p = 0; p < pages; p++) {
    const txs: any[] = await json(f, url)
    if (!Array.isArray(txs) || txs.length === 0) break
    for (const tx of txs) {
      payments.push(...btcPaymentsFromTx(tx, carBtcAddress, funds))
    }
    const confirmed = txs.filter((t) => t?.status?.confirmed === true)
    if (confirmed.length < 25) break
    url = `${MEMPOOL}/address/${carBtcAddress}/txs/chain/${confirmed[confirmed.length - 1].txid}`
  }
  // a primeira vista da rede para TODAS (as mais novas primeiro, até 50), não só as da mempool: um pagamento que a
  // varredura só viu já confirmado (cron parado) não pode parecer posterior a um pedido criado depois dele
  const firstSeenMs = new Map<string, number>()
  const ids = [...new Set(payments.map((p) => p.txid))].slice(0, 50)
  if (ids.length) {
    const times = await json(f, `${MEMPOOL}/v1/transaction-times?${ids.map((i) => `txId[]=${i}`).join('&')}`).catch(() => [])
    ids.forEach((id, i) => {
      const t = Number(Array.isArray(times) ? times[i] : 0)
      if (Number.isSafeInteger(t) && t > 0) firstSeenMs.set(id, t * 1000)
    })
  }
  return { tip, payments, firstSeenMs }
}

// ── $DOG ────────────────────────────────────────────────────────────────────

export interface DogTxRow {
  txid: string
  block_height: number
  timestamp: string
  senders: unknown
  receivers: unknown
}

function jsonArr(v: unknown): any[] {
  if (Array.isArray(v)) return v
  if (typeof v === 'string') { try { const j = JSON.parse(v); return Array.isArray(j) ? j : [] } catch { return [] } }
  return []
}

/**
 * Os pagamentos em $DOG de UMA linha de dog_transactions ao endereço $DOG do carro: um por receptor desse
 * endereço, com o `vout` do receptor e o valor em átomos INTEIROS (`amount`; o float `amount_dog` nunca entra).
 * Receptor sem vout ou sem átomos inteiros seguros não vira pagamento (falha fechada; o scanner atual grava os dois).
 */
export function dogPaymentsFromRow(row: DogTxRow, carDogAddress: string, funds: string[]): { payments: ChainPayment[]; skipped: number } {
  const to = canon(carDogAddress)
  const txid = typeof row?.txid === 'string' ? row.txid.toLowerCase() : ''
  const h = Number(row?.block_height)
  const bt = Date.parse(String(row?.timestamp ?? ''))
  if (!TXID_RE.test(txid) || !Number.isSafeInteger(h) || h <= 0 || !Number.isFinite(bt) || bt <= 0) return { payments: [], skipped: 1 }
  const senders = jsonArr(row.senders)
  const payers = [...new Set<string>(
    senders
      .filter((s) => typeof s?.address === 'string' && s.address && Number(s?.amount) > 0)
      .map((s) => canon(s.address)),
  )]
  const fundSet = new Set(funds.map(canon))
  if (payers.some((p) => fundSet.has(p))) return { payments: [], skipped: 0 }
  const out: ChainPayment[] = []
  let skipped = 0
  for (const r of jsonArr(row.receivers)) {
    if (typeof r?.address !== 'string' || canon(r.address) !== to) continue
    const vout = r?.vout, atoms = r?.amount
    if (!Number.isSafeInteger(vout) || vout < 0 || !Number.isSafeInteger(atoms) || atoms <= 0) { skipped++; continue }
    out.push({ currency: 'dog', txid, vout, amount: atoms, payerAddresses: payers, confirmed: true, blockHeight: h, blockTimeMs: bt })
  }
  return { payments: out, skipped }
}

// ── A VARREDURA ─────────────────────────────────────────────────────────────

export type PaymentStatus = 'observed' | 'credited' | 'unmatched' | 'pending_review'

export interface StoredCarPayment {
  currency: CarCurrency
  txid: string
  vout: number
  amount: number
  payerAddresses: string[]
  firstSeenMs: number
  blockHeight: number | null
  blockTimeMs: number | null
  status: PaymentStatus
  reviewReason: string | null
}

/** o que a função do banco respondeu ao creditar */
export type CreditOutcome = 'credited' | 'already_owned' | 'order_already_paid' | 'unmatched' | 'pending_review'

export interface CarSweepStore {
  /** linhas já gravadas, por `moeda:txid:vout` */
  loadRows(currency: CarCurrency, txids: string[]): Promise<Map<string, StoredCarPayment>>
  /** pedidos que vencem a partir de `sinceExpiresMs` (os que ainda podem casar) */
  loadOrders(sinceExpiresMs: number): Promise<CarOrder[]>
  /** grava um estado que NÃO é crédito (o banco recusa `credited` por aqui) */
  saveRow(row: StoredCarPayment): Promise<void>
  /** credita pela função do banco (pagamento + posse, numa transação só) */
  credit(row: StoredCarPayment, orderId: string): Promise<CreditOutcome>
}

export const keyOf = (currency: CarCurrency, txid: string, vout: number) => `${currency}:${txid}:${vout}`

/** Estados que a varredura não toca mais: tudo menos `observed` (aqui não há "tenta de novo sozinho"). */
export const isFinal = (r: Pick<StoredCarPayment, 'status'>) => r.status !== 'observed'

export interface CarSweepResult { credited: number; unmatched: number; pendingReview: number; observed: number; skipped: number; errors: number }

const emptyResult = (): CarSweepResult => ({ credited: 0, unmatched: 0, pendingReview: 0, observed: 0, skipped: 0, errors: 0 })

/** a janela mais longa em que um pedido ainda casa com um pagamento */
const MAX_LINK_MS = Math.max(BTC_LATE_REVIEW_MS, DOG_BLOCK_GRACE_MS + DOG_LATE_REVIEW_MS) + BLOCK_TIME_SLACK_MS

export async function sweepCars(deps: {
  nowMs: number
  /** todo endereço de fundo (carro e licença): pagamento que sai de um deles nunca é compra */
  funds: string[]
  btc: { tip: number; payments: ChainPayment[]; firstSeenMs: Map<string, number> } | null
  dog: { tip: number; payments: ChainPayment[] } | null
  store: CarSweepStore
}): Promise<CarSweepResult> {
  const { nowMs, store, funds } = deps
  const result = emptyResult()
  const groups: { currency: CarCurrency; tip: number; payments: ChainPayment[]; firstSeen: Map<string, number> }[] = []
  if (deps.btc) groups.push({ currency: 'btc', tip: deps.btc.tip, payments: deps.btc.payments, firstSeen: deps.btc.firstSeenMs })
  if (deps.dog) groups.push({ currency: 'dog', tip: deps.dog.tip, payments: deps.dog.payments, firstSeen: new Map() })

  // primeiro as linhas já gravadas; só os pagamentos ainda abertos pedem pedidos
  const pending: { cp: ChainPayment; ex: StoredCarPayment | undefined; tip: number; firstSeen: Map<string, number> }[] = []
  for (const g of groups) {
    if (!Number.isSafeInteger(g.tip) || g.tip <= 0) throw new Error(`bad ${g.currency} tip`)
    const rows = await store.loadRows(g.currency, [...new Set(g.payments.map((p) => p.txid))])
    const seen = new Set<string>()
    for (const cp of g.payments) {
      const k = keyOf(cp.currency, cp.txid, cp.vout)
      const ex = rows.get(k)
      // a mesma saída repetida na leitura (página que se sobrepõe, linha duplicada) conta uma vez só
      if (seen.has(k) || cp.currency !== g.currency || (ex && isFinal(ex))) { result.skipped++; continue }
      seen.add(k)
      pending.push({ cp, ex, tip: g.tip, firstSeen: g.firstSeen })
    }
  }
  if (pending.length === 0) return result

  // os pedidos que ainda podem casar com o pagamento aberto mais antigo
  const oldest = Math.min(...pending.map(({ cp, ex, firstSeen }) => Math.min(cp.blockTimeMs ?? nowMs, ex?.firstSeenMs ?? nowMs, firstSeen.get(cp.txid) ?? nowMs)))
  const needOrders = pending.some(({ cp, tip }) => cp.confirmed && cp.blockHeight != null && tip - cp.blockHeight + 1 >= BTC_MIN_CONFIRMATIONS)
  const orders = needOrders ? await store.loadOrders(oldest - MAX_LINK_MS) : []

  for (const { cp, ex, tip, firstSeen } of pending) {
    // BTC: a primeira vista só anda para trás (a nossa ou a da rede). $DOG: o horário do bloco.
    const firstSeenMs = cp.currency === 'btc'
      ? Math.min(ex?.firstSeenMs ?? nowMs, firstSeen.get(cp.txid) ?? nowMs)
      : (cp.blockTimeMs as number)
    const confirmations = cp.confirmed && cp.blockHeight ? Math.max(0, tip - cp.blockHeight + 1) : 0
    const payment: CarPayment = {
      currency: cp.currency, txid: cp.txid, vout: cp.vout, amount: cp.amount, payerAddresses: cp.payerAddresses,
      seenAtMs: firstSeenMs, blockTimeMs: cp.blockTimeMs, confirmations,
    }
    const row: StoredCarPayment = {
      currency: cp.currency, txid: cp.txid, vout: cp.vout, amount: cp.amount, payerAddresses: cp.payerAddresses,
      firstSeenMs, blockHeight: cp.blockHeight, blockTimeMs: cp.blockTimeMs, status: 'observed', reviewReason: null,
    }
    try {
      const m: CarMatch = matchCarPayment(payment, orders, funds)
      if (m.status === 'match') {
        const out = await store.credit(row, m.order.id)
        if (out === 'credited') result.credited++
        else if (out === 'unmatched') result.unmatched++
        else result.pendingReview++
        continue
      }
      const saved: StoredCarPayment = m.status === 'observed' ? row : { ...row, status: m.status, reviewReason: m.reason }
      await store.saveRow(saved)
      if (m.status === 'unmatched') result.unmatched++
      else if (m.status === 'pending_review') result.pendingReview++
      else result.observed++
    } catch (e) {
      // um pagamento que falha (banco, corrida entre duas varreduras) não derruba os outros; sem gravação não há
      // carro, e a próxima volta tenta de novo
      console.error('[car-pay] payment failed:', cp.currency, cp.txid, cp.vout, (e as Error)?.message)
      result.errors++
    }
  }
  return result
}

/** os endereços de fundo normalizados (carro e licença), para o "fundo como pagador" */
export function fundList(...addrs: (string | null | undefined)[]): string[] {
  return [...new Set(addrs.map((a) => normalizeAddress(a)).filter((a): a is string => !!a))]
}
