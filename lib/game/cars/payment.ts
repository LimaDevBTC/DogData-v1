// ═══════════════════════════════════════════════════════════════════════════
// O PAGAMENTO DE UM CARRO: a qual pedido um pagamento corresponde, ou por que nenhum. Puro, sem rede e sem banco.
//
// Quem credita de fato é a função `dogcity_car_credit` da migração 039, numa transação só (pagamento creditado
// + posse do carro), conferindo de novo o valor e o pagador e recusando a carteira que já tem o modelo. Aqui só
// se decide o casamento; qualquer dúvida vira `pending_review` (um humano decide), nunca carro sozinho.
//
// BTC: casa pelo endereço PAGADOR do pedido, visto dentro da trava de 15 minutos e cobrindo os sats.
// $DOG: casa pelo REMETENTE do pedido E pelo valor EXATO (preço + sufixo), com o bloco dentro do prazo.
// As duas: 6 confirmações (BTC_MIN_CONFIRMATIONS, a regra do B), teto absoluto, o fundo como pagador nunca é
// pagamento, e pagador ligado a duas carteiras diferentes não se adivinha.
// ═══════════════════════════════════════════════════════════════════════════
import { BTC_MIN_CONFIRMATIONS, MIN_PAYMENT_SATS } from '@/lib/dog/licence-btc'
import {
  BLOCK_TIME_SLACK_MS, BTC_LATE_REVIEW_MS, CAR_MAX_SATS, DOG_BLOCK_GRACE_MS, DOG_LATE_REVIEW_MS,
  MAX_DOG_EXACT_ATOMS, type CarCurrency, type CarOrder,
} from './order'

/** pagar mais que isto vezes os sats do pedido vai para revisão (pode ser dois carros num pagamento só) */
export const MAX_OVERPAY_FACTOR = 2

export interface CarPayment {
  currency: CarCurrency
  txid: string
  /** BTC: a saída da transação. $DOG: a saída que recebeu as runas (o `vout` do receptor no índice) */
  vout: number
  /** BTC: sats. $DOG: átomos (10^-5 $DOG) */
  amount: number
  /** BTC: todo endereço que financiou a transação. $DOG: todo remetente com $DOG */
  payerAddresses: string[]
  /** BTC: a primeira vista da rede (ou da varredura). $DOG: o horário do bloco */
  seenAtMs: number
  blockTimeMs: number | null
  confirmations: number
}

export type CarReviewReason =
  | 'invalid_amount'
  | 'above_ceiling'       // acima do teto: um humano decide, nada é truncado
  | 'ambiguous_owner'     // o pagador ligado a pedidos de duas carteiras diferentes
  | 'ambiguous_order'     // o pagamento serve a pedidos de modelos diferentes da mesma carteira
  | 'underpaid'           // BTC: pagou dentro da trava, mas menos que os sats do pedido
  | 'overpaid'            // BTC: mais que MAX_OVERPAY_FACTOR vezes o pedido
  | 'amount_mismatch'     // $DOG: o remetente tem pedido, mas o valor não é o exato (a menor, a maior, sem sufixo)
  | 'payer_mismatch'      // o valor casa com um pedido, mas saiu de outro endereço
  | 'order_expired'       // pago depois do prazo

export type CarMatch =
  | { status: 'observed'; reason: 'confirmations' }
  | { status: 'unmatched'; reason: 'dust' | 'fund_is_payer' | 'no_order' }
  | { status: 'pending_review'; reason: CarReviewReason }
  | { status: 'match'; order: CarOrder }

const low = (a: string) => a.toLowerCase()
const latest = (os: CarOrder[]) => os.reduce((a, b) => (b.createdAtMs > a.createdAtMs ? b : a))
const distinct = (os: CarOrder[], k: (o: CarOrder) => string) => new Set(os.map(k)).size
const review = (reason: CarReviewReason): CarMatch => ({ status: 'pending_review', reason })

/** o pagamento nasceu depois do pedido? (com a folga do horário de bloco para trás) */
function afterOrder(o: CarOrder, p: CarPayment): boolean {
  if (p.blockTimeMs != null && Number.isFinite(p.blockTimeMs) && p.blockTimeMs < o.createdAtMs - BLOCK_TIME_SLACK_MS) return false
  return p.currency === 'btc' ? o.createdAtMs <= p.seenAtMs : p.seenAtMs >= o.createdAtMs - BLOCK_TIME_SLACK_MS
}

function common(p: CarPayment, funds: string[]): CarMatch | null {
  if (!(p.confirmations >= BTC_MIN_CONFIRMATIONS)) return { status: 'observed', reason: 'confirmations' }
  if (!Number.isSafeInteger(p.amount) || p.amount <= 0 || !Number.isFinite(p.seenAtMs) || p.seenAtMs <= 0) return review('invalid_amount')
  if (!Array.isArray(p.payerAddresses) || p.payerAddresses.some((a) => typeof a !== 'string')) return review('invalid_amount')
  const payers = p.payerAddresses.map(low)
  // o próprio fundo (do carro ou da licença) como pagador: movimento interno, nunca compra
  if (funds.some((f) => payers.includes(low(f)))) return { status: 'unmatched', reason: 'fund_is_payer' }
  return null
}

/**
 * Pagamento em BTC. `funds` = todo endereço de fundo (carro e licença). `orders` = pedidos que podem casar
 * (a varredura carrega os recentes; os de $DOG são ignorados aqui).
 */
export function matchBtcPayment(p: CarPayment, orders: CarOrder[], funds: string[]): CarMatch {
  if (p.currency !== 'btc') return review('invalid_amount')
  const c = common(p, funds)
  if (c) return c
  if (p.amount < MIN_PAYMENT_SATS) return { status: 'unmatched', reason: 'dust' }
  if (p.amount > CAR_MAX_SATS) return review('above_ceiling')
  const payers = p.payerAddresses.map(low)
  // o relógio da trava: o mais cedo entre a primeira vista e o bloco (visto tarde mas minerado a tempo não perde a trava)
  const lockMs = p.blockTimeMs != null && Number.isFinite(p.blockTimeMs) ? Math.min(p.seenAtMs, p.blockTimeMs) : p.seenAtMs

  const inWindow = orders.filter((o) =>
    o.currency === 'btc' && Number.isSafeInteger(o.sats) && (o.sats as number) > 0 &&
    afterOrder(o, p) && lockMs <= o.expiresAtMs + BTC_LATE_REVIEW_MS)
  const linked = inWindow.filter((o) => payers.includes(low(o.payerAddress)))
  if (linked.length === 0) {
    // ninguém deste pagador; se o valor é exatamente o de um pedido vivo, quem pagou errou o endereço: um humano vê
    return inWindow.some((o) => o.sats === p.amount && lockMs <= o.expiresAtMs) ? review('payer_mismatch') : { status: 'unmatched', reason: 'no_order' }
  }
  // duas carteiras ligadas ao mesmo pagador: não se adivinha de quem é o carro
  if (distinct(linked, (o) => low(o.wallet)) > 1) return review('ambiguous_owner')

  const inLock = linked.filter((o) => lockMs <= o.expiresAtMs)
  const covering = inLock.filter((o) => p.amount >= (o.sats as number))
  const exact = covering.filter((o) => p.amount === o.sats)
  if (exact.length > 0) {
    if (distinct(exact, (o) => o.model) > 1) return review('ambiguous_order')
    return { status: 'match', order: latest(exact) }
  }
  if (covering.length > 0) {
    if (distinct(covering, (o) => o.model) > 1) return review('ambiguous_order')
    const o = latest(covering)
    if (p.amount > (o.sats as number) * MAX_OVERPAY_FACTOR) return review('overpaid')
    return { status: 'match', order: o }
  }
  if (inLock.length > 0) return review('underpaid')
  return review('order_expired')
}

/** Pagamento em $DOG. O valor tem de ser o EXATO do pedido e sair do remetente do pedido. */
export function matchDogPayment(p: CarPayment, orders: CarOrder[], funds: string[]): CarMatch {
  if (p.currency !== 'dog') return review('invalid_amount')
  const c = common(p, funds)
  if (c) return c
  if (p.amount > MAX_DOG_EXACT_ATOMS) return review('above_ceiling')
  const payers = p.payerAddresses.map(low)
  const t = p.seenAtMs // o horário do bloco

  const isDog = (o: CarOrder) => o.currency === 'dog' && Number.isSafeInteger(o.dogExactAtoms) && (o.dogExactAtoms as number) > 0
  const onTime = (o: CarOrder) => t <= o.expiresAtMs + DOG_BLOCK_GRACE_MS
  const inWindow = orders.filter((o) => isDog(o) && afterOrder(o, p) && t <= o.expiresAtMs + DOG_BLOCK_GRACE_MS + DOG_LATE_REVIEW_MS)
  const linked = inWindow.filter((o) => payers.includes(low(o.payerAddress)))
  const exactAny = inWindow.filter((o) => o.dogExactAtoms === p.amount)
  if (linked.length === 0) {
    return exactAny.some(onTime) ? review('payer_mismatch') : { status: 'unmatched', reason: 'no_order' }
  }
  const exact = linked.filter((o) => o.dogExactAtoms === p.amount)
  if (exact.length === 0) {
    // o remetente tem pedido, mas o valor não é o exato: a menor, a maior, ou sem o sufixo
    return exactAny.some(onTime) ? review('payer_mismatch') : review('amount_mismatch')
  }
  if (distinct(exact, (o) => low(o.wallet)) > 1) return review('ambiguous_owner')
  if (distinct(exact, (o) => o.model) > 1) return review('ambiguous_order')
  const live = exact.filter(onTime)
  if (live.length === 0) return review('order_expired')
  return { status: 'match', order: latest(live) }
}

export function matchCarPayment(p: CarPayment, orders: CarOrder[], funds: string[]): CarMatch {
  return p.currency === 'btc' ? matchBtcPayment(p, orders, funds) : p.currency === 'dog' ? matchDogPayment(p, orders, funds) : review('invalid_amount')
}
