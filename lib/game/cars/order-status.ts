// ═══════════════════════════════════════════════════════════════════════════
// DOG MOTORS: o ESTADO DE UM PEDIDO, para a janela de compra acompanhar depois que a carteira transmitiu.
// A rota GET /api/dogcity/car-order só liga isto ao banco (car_orders, car_payments) e ao mempool.space.
//
// QUEM DIZ É O SERVIDOR. A página não é a autoridade sobre para onde o dinheiro foi (a mesma regra de
// /api/donate/verify): o servidor lê a transação na rede e compara com o pedido GRAVADO (o endereço que recebe, o
// pagador, os sats). O carro só é dado pela varredura (/api/cron/car-pay) e pela função do banco; este estado só LÊ.
//
// Os estágios, do pedido à garagem:
//   awaiting_payment  pedido vivo, nenhuma transação informada
//   expired           o prazo passou sem transação informada (um pagamento que chegue depois vai para revisão)
//   sent              a carteira devolveu o txid, a rede ainda não mostra
//   in_mempool        a rede mostra, sem bloco
//   confirming        no bloco, contando até 6 confirmações (e a volta seguinte da varredura)
//   in_review         a varredura mandou para revisão humana (motivo em `reason`)
//   not_matched       a varredura não ligou o pagamento a pedido nenhum
//   delivered         creditado: o carro está na garagem da carteira
// Avisos (o que a tela grita): wrong_destination (a transação não paga o endereço do pedido), underpaid (BTC: menos
// sats que o pedido), other_payer (não sai do endereço pagador do pedido: não casa sozinho).
// ═══════════════════════════════════════════════════════════════════════════
import { BTC_MIN_CONFIRMATIONS } from '@/lib/dog/licence-btc'

export type OrderStage =
  | 'awaiting_payment' | 'expired' | 'sent' | 'in_mempool' | 'confirming' | 'in_review' | 'not_matched' | 'delivered'
export type OrderWarning = 'wrong_destination' | 'underpaid' | 'other_payer'
export type PaymentRowStatus = 'observed' | 'credited' | 'unmatched' | 'pending_review'

export interface TxCheck {
  found: boolean
  /** sats que a transação manda ao endereço do pedido (no $DOG, a poeira da saída das runas) */
  toPayTo: number
  /** alguma entrada sai do endereço pagador do pedido */
  fromPayer: boolean
  confirmed: boolean
  confirmations: number
}

const canon = (a: string) => (a.toLowerCase().startsWith('bc1') ? a.toLowerCase() : a)

/** a transação do mempool.space (GET /api/tx/<txid>) contra o pedido; `tip` = altura da ponta (null = não sei) */
export function checkTx(tx: unknown, payTo: string, payer: string, tip: number | null): TxCheck {
  const t = tx && typeof tx === 'object' ? (tx as any) : null
  if (!t || typeof t.txid !== 'string') return { found: false, toPayTo: 0, fromPayer: false, confirmed: false, confirmations: 0 }
  const to = canon(payTo)
  const from = canon(payer)
  let toPayTo = 0
  for (const o of Array.isArray(t.vout) ? t.vout : []) {
    const v = Number(o?.value)
    if (typeof o?.scriptpubkey_address === 'string' && canon(o.scriptpubkey_address) === to && Number.isSafeInteger(v) && v > 0) toPayTo += v
  }
  const fromPayer = (Array.isArray(t.vin) ? t.vin : []).some(
    (i: any) => typeof i?.prevout?.scriptpubkey_address === 'string' && canon(i.prevout.scriptpubkey_address) === from,
  )
  const confirmed = t.status?.confirmed === true
  const h = Number(t.status?.block_height)
  const confirmations = confirmed && tip !== null && Number.isSafeInteger(h) && h > 0 && tip >= h ? tip - h + 1 : 0
  return { found: true, toPayTo: Number.isSafeInteger(toPayTo) ? toPayTo : 0, fromPayer, confirmed, confirmations }
}

export interface OrderStatusInput {
  nowMs: number
  order: { currency: 'btc' | 'dog'; sats: number | null; expiresAtMs: number }
  /** um pagamento creditado aponta para ESTE pedido (car_payments.order_id) */
  credited: boolean
  /** a linha de car_payments do txid informado (a mais final, se houver mais de uma saída) */
  payment: { status: PaymentRowStatus; reviewReason: string | null } | null
  /** o txid informado, lido na rede (null = sem txid, ou a rede não respondeu) */
  tx: TxCheck | null
  /** a janela informou um txid (mesmo que a rede não tenha respondido) */
  hasTxid: boolean
}

export interface OrderStatus {
  stage: OrderStage
  reason: string | null
  warnings: OrderWarning[]
  confirmations: number | null
  needed: number
}

const RANK: Record<PaymentRowStatus, number> = { credited: 3, pending_review: 2, unmatched: 1, observed: 0 }
/** a linha mais final entre as saídas do mesmo txid */
export function mostFinal<T extends { status: PaymentRowStatus }>(rows: readonly T[]): T | null {
  let best: T | null = null
  for (const r of rows) if (RANK[r.status] !== undefined && (!best || RANK[r.status] > RANK[best.status])) best = r
  return best
}

export function orderStatus(i: OrderStatusInput): OrderStatus {
  const needed = BTC_MIN_CONFIRMATIONS
  const warnings: OrderWarning[] = []
  const tx = i.tx
  if (tx?.found) {
    if (tx.toPayTo <= 0) warnings.push('wrong_destination')
    else if (i.order.currency === 'btc' && i.order.sats !== null && tx.toPayTo < i.order.sats) warnings.push('underpaid')
    if (!tx.fromPayer) warnings.push('other_payer')
  }
  const conf = tx?.found && tx.confirmed ? tx.confirmations : null
  const out = (stage: OrderStage, reason: string | null = null): OrderStatus => ({ stage, reason, warnings, confirmations: conf, needed })

  if (i.credited) return { stage: 'delivered', reason: null, warnings: [], confirmations: conf, needed }
  if (i.payment) {
    if (i.payment.status === 'pending_review') return out('in_review', i.payment.reviewReason)
    // creditado, mas para OUTRO pedido: este não recebe carro por esta transação
    if (i.payment.status === 'unmatched' || i.payment.status === 'credited') return out('not_matched', i.payment.reviewReason)
    return out('confirming')
  }
  if (tx?.found) return out(tx.confirmed ? 'confirming' : 'in_mempool')
  if (i.hasTxid) return out('sent')
  return out(i.nowMs > i.order.expiresAtMs ? 'expired' : 'awaiting_payment')
}
