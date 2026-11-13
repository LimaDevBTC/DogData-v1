// ═══════════════════════════════════════════════════════════════════════════
// O PEDIDO DE UM CARRO: cotação + pedido, a conta pura (o banco entra por `CarOrderStore`).
// A rota POST /api/dogcity/car-quote só liga isto à sessão, ao freio de IP, ao banco e às corretoras.
//
// REGRAS (rota irmã da licença; NÃO usa as tabelas da licença):
//  1. O preço é FIXO em $DOG por modelo (lib/game/cars/catalog.ts) e só vale quando o catálogo do código e a
//     linha de `car_models` concordam, com o modelo ativo. Desacordo = 503, nada gravado.
//  2. Quem compra é a carteira da SESSÃO (cookie dg_wallet, o endereço ordinals que assinou). Nenhum endereço
//     de dono vem do corpo do pedido.
//  3. UM carro de cada modelo por carteira: a que já tem o modelo (compra ou prêmio da corrida aprovado ou
//     entregue) recebe 409 e nada é gravado.
//  4. BTC: os sats saem da MEDIANA das corretoras (a mesma régua da licença), travada por 15 minutos. Sem
//     fontes independentes que concordem: 503, nada gravado. O pagamento tem de sair do endereço pagador do pedido.
//  5. $DOG: o pedido leva um valor EXATO, o preço mais um sufixo único de átomos (1 a 99.999 átomos, menos de
//     1 $DOG), e o endereço pagador. O pagamento casa pelo remetente E pelo valor exato, dentro da janela.
//     Não precisa de cotação de preço: o preço já é em $DOG.
//
// TETOS: preço entre MIN e MAX_CAR_PRICE_DOG, sats entre MIN_PAYMENT_SATS e CAR_MAX_SATS, pedidos por carteira
// e por pagador por hora. NaN, Infinity, negativo, fração e inteiro inseguro são recusados, nunca arredondados.
// ═══════════════════════════════════════════════════════════════════════════
import {
  FUND_BTC_ADDRESS, FUND_DOG_ADDRESS, MIN_PAYMENT_SATS, QUOTE_LOCK_MS, normalizeAddress, satsForDog,
  type SourceSample,
} from '@/lib/dog/licence-btc'
import type { Medians } from '@/lib/dog/price-sources'
import { CAR_MODELS, MAX_CAR_PRICE_DOG, isCarModel, validPriceDog } from './catalog'
import type { CarSales } from './config'

export const ATOMS_PER_DOG = 100_000
/** o sufixo do valor em $DOG: de 1 a 99.999 átomos (sempre menos de 1 $DOG por cima do preço) */
export const DOG_SUFFIX_MIN = 1
export const DOG_SUFFIX_MAX = 99_999
/** maior valor exato possível em átomos (o teto do preço mais o maior sufixo): inteiro seguro com folga */
export const MAX_DOG_EXACT_ATOMS = MAX_CAR_PRICE_DOG * ATOMS_PER_DOG + DOG_SUFFIX_MAX

/** teto absoluto de um pedido e de um pagamento em BTC (0,5 BTC); acima vai para revisão, nunca é truncado */
export const CAR_MAX_SATS = 50_000_000

/** a trava do preço em BTC (a mesma da licença) */
export const BTC_ORDER_LOCK_MS = QUOTE_LOCK_MS
/** o prazo para ENVIAR o $DOG (o preço é em $DOG, não há trava de câmbio; o prazo só segura o sufixo) */
export const DOG_ORDER_LOCK_MS = 60 * 60 * 1000

// ── AS JANELAS DO CASAMENTO (lib/game/cars/payment.ts) ─────────────────────────
/** o horário de um bloco pode vir até ~2 h antes do relógio real (regra de consenso): folga para trás */
export const BLOCK_TIME_SLACK_MS = 2 * 60 * 60 * 1000
/** $DOG: o bloco pode chegar até 6 h depois do prazo (taxa baixa); o preço é em $DOG, não há risco de câmbio */
export const DOG_BLOCK_GRACE_MS = 6 * 60 * 60 * 1000
/** BTC pago depois da trava, até 2 h: vai para revisão (nunca credita sozinho); depois disso não liga a nada */
export const BTC_LATE_REVIEW_MS = 2 * 60 * 60 * 1000
/** $DOG pago depois do prazo + folga, até 7 dias: vai para revisão */
export const DOG_LATE_REVIEW_MS = 7 * 24 * 60 * 60 * 1000
/** um valor exato em $DOG não se repete enquanto um pagamento ainda pode casar com ele */
export const DOG_SUFFIX_UNIQUE_MS = DOG_ORDER_LOCK_MS + DOG_BLOCK_GRACE_MS + DOG_LATE_REVIEW_MS

/** pedidos por carteira por hora e por endereço pagador por hora */
export const MAX_ORDERS_PER_WALLET_PER_HOUR = 10
export const MAX_ORDERS_PER_PAYER_PER_HOUR = 10
/** tentativas de achar um sufixo livre antes de desistir (503) */
export const SUFFIX_TRIES = 8

export type CarCurrency = 'btc' | 'dog'
export const isCurrency = (c: unknown): c is CarCurrency => c === 'btc' || c === 'dog'

export interface CarOrder {
  id: string
  model: string
  /** a carteira ordinals da sessão: quem fica com o carro */
  wallet: string
  currency: CarCurrency
  /** o endereço de onde o pagamento TEM de sair */
  payerAddress: string
  /** o endereço do fundo do carro que recebe (o da moeda do pedido), gravado para auditoria */
  payTo: string
  priceDog: number
  /** BTC: os sats a pagar dentro da trava. $DOG: null */
  sats: number | null
  /** $DOG: o valor exato em átomos (preço + sufixo). BTC: null */
  dogExactAtoms: number | null
  dogUsd: number | null
  btcUsd: number | null
  sources: SourceSample[]
  createdAtMs: number
  expiresAtMs: number
}

export interface ModelRow { priceDog: number; active: boolean }

export interface CarOrderStore {
  /** a linha de `car_models` do modelo, ou null se não há */
  modelRow(model: string): Promise<ModelRow | null>
  /** a carteira já tem o modelo (compra, ou prêmio aprovado/entregue)? */
  ownsModel(wallet: string, model: string): Promise<boolean>
  countByWalletSince(wallet: string, sinceMs: number): Promise<number>
  countByPayerSince(payer: string, sinceMs: number): Promise<number>
  /** algum pedido em $DOG criado desde `sinceMs` já usa este valor exato? */
  dogAmountTaken(atoms: number, sinceMs: number): Promise<boolean>
  insert(o: CarOrder): Promise<void>
}

export interface PublicCarOrder {
  id: string
  model: string
  name: string
  currency: CarCurrency
  priceDog: number
  payTo: string
  payerAddress: string
  /** BTC: os sats exatos a pagar */
  sats?: number
  /** $DOG: o valor EXATO a enviar, em texto com 5 casas (ex.: "20000.04217"), e o mesmo em átomos */
  dogExact?: string
  dogExactAtoms?: number
  dogUsd?: number
  btcUsd?: number
  sources?: SourceSample[]
  expiresAt: string
  /** o relógio do servidor na hora do pedido: a tela conta o prazo por ele */
  serverTime: string
}

export type CreateCarOrderResult =
  | { ok: true; status: 200; order: PublicCarOrder }
  | { ok: false; status: 400 | 401 | 409 | 429 | 503; error: string }

/** átomos em texto com 5 casas, sem ponto flutuante (20000.04217) */
export function atomsToDogString(atoms: number): string {
  if (!Number.isSafeInteger(atoms) || atoms < 0) throw new Error('bad atoms')
  const s = String(atoms).padStart(6, '0')
  return `${s.slice(0, -5)}.${s.slice(-5)}`
}

/** o valor exato em átomos de um preço com sufixo; null em qualquer entrada fora da forma */
export function dogExactAtoms(priceDog: number, suffix: number): number | null {
  if (!validPriceDog(priceDog)) return null
  if (!Number.isSafeInteger(suffix) || suffix < DOG_SUFFIX_MIN || suffix > DOG_SUFFIX_MAX) return null
  const a = priceDog * ATOMS_PER_DOG + suffix
  return Number.isSafeInteger(a) && a <= MAX_DOG_EXACT_ATOMS ? a : null
}

/** os sats de um carro em BTC pela mediana; null se fora da forma ou do teto */
export function carSats(priceDog: number, dogUsd: number, btcUsd: number): number | null {
  if (!validPriceDog(priceDog)) return null
  const s = satsForDog(priceDog, dogUsd, btcUsd)
  if (s === null || !Number.isSafeInteger(s) || s > CAR_MAX_SATS) return null
  return Math.max(s, MIN_PAYMENT_SATS)
}

export async function createCarOrder(
  deps: {
    sales: CarSales
    store: CarOrderStore
    medians: () => Promise<Medians>
    nowMs: number
    newId: () => string
    /** um inteiro de DOG_SUFFIX_MIN a DOG_SUFFIX_MAX (a rota usa crypto.randomInt) */
    randomSuffix: () => number
  },
  sessionWallet: string | null,
  body: unknown,
): Promise<CreateCarOrderResult> {
  const { sales, store, nowMs } = deps
  if (!sales.open) return { ok: false, status: 503, error: 'sales_closed' }
  if (!Number.isFinite(nowMs) || nowMs <= 0) return { ok: false, status: 503, error: 'no reliable quote right now' }
  const wallet = normalizeAddress(sessionWallet)
  if (!wallet) return { ok: false, status: 401, error: 'unauthenticated' }

  const b = (body && typeof body === 'object' && !Array.isArray(body) ? body : {}) as Record<string, unknown>
  if (!isCarModel(b.model)) return { ok: false, status: 400, error: 'unknown car model' }
  if (!isCurrency(b.currency)) return { ok: false, status: 400, error: 'currency must be btc or dog' }
  const model = b.model
  const currency = b.currency
  // BTC: o endereço pagador é obrigatório (na Xverse, UniSat e OKX ele é outro, não o ordinals). $DOG: o padrão
  // é a própria carteira (as runas moram no endereço ordinals), mas pode vir outro.
  const payerGiven = b.paymentAddress !== undefined && b.paymentAddress !== null && b.paymentAddress !== ''
  if (currency === 'btc' && !payerGiven) return { ok: false, status: 400, error: 'paymentAddress is required to pay in BTC' }
  const payerAddress = payerGiven ? normalizeAddress(b.paymentAddress) : wallet
  if (!payerAddress) return { ok: false, status: 400, error: 'paymentAddress must be a Bitcoin mainnet address' }
  const funds = new Set([FUND_BTC_ADDRESS, FUND_DOG_ADDRESS, sales.btcAddress, sales.dogAddress].map((a) => a.toLowerCase()))
  if (funds.has(wallet.toLowerCase()) || funds.has(payerAddress.toLowerCase())) {
    return { ok: false, status: 400, error: 'a fund address cannot be a wallet address' }
  }

  const priceDog = CAR_MODELS[model].priceDog
  if (!validPriceDog(priceDog)) return { ok: false, status: 503, error: 'model_unavailable' }

  let row: ModelRow | null, owns: boolean
  try {
    ;[row, owns] = await Promise.all([store.modelRow(model), store.ownsModel(wallet, model)])
  } catch {
    return { ok: false, status: 503, error: 'no reliable quote right now' }
  }
  // o preço do código e o do banco têm de ser o MESMO número; qualquer desacordo fecha este modelo
  if (!row || !validPriceDog(row.priceDog) || row.priceDog !== priceDog) return { ok: false, status: 503, error: 'model_unavailable' }
  if (row.active !== true) return { ok: false, status: 409, error: 'model_not_for_sale' }
  if (owns !== false) return { ok: false, status: 409, error: 'already_owned' }

  try {
    const hourAgo = nowMs - 3_600_000
    const [byWallet, byPayer] = await Promise.all([store.countByWalletSince(wallet, hourAgo), store.countByPayerSince(payerAddress, hourAgo)])
    if (!Number.isFinite(byWallet) || !Number.isFinite(byPayer)) return { ok: false, status: 503, error: 'no reliable quote right now' }
    if (byWallet >= MAX_ORDERS_PER_WALLET_PER_HOUR || byPayer >= MAX_ORDERS_PER_PAYER_PER_HOUR) {
      return { ok: false, status: 429, error: 'too many orders, try again later' }
    }
  } catch {
    return { ok: false, status: 503, error: 'no reliable quote right now' }
  }

  const base = {
    id: deps.newId(), model, wallet, currency, payerAddress, priceDog, createdAtMs: nowMs,
  }
  let order: CarOrder
  if (currency === 'btc') {
    const m = await deps.medians().catch(() => null)
    if (!m || !m.dog.ok || !m.btc.ok) return { ok: false, status: 503, error: 'no reliable quote right now' }
    const sats = carSats(priceDog, m.dog.price, m.btc.price)
    if (sats === null) return { ok: false, status: 503, error: 'no reliable quote right now' }
    order = {
      ...base, payTo: sales.btcAddress, sats, dogExactAtoms: null, dogUsd: m.dog.price, btcUsd: m.btc.price,
      sources: [
        ...m.dog.sources.map((s) => ({ name: `DOG/USD ${s.name}`, price: s.price })),
        ...m.btc.sources.map((s) => ({ name: `BTC/USD ${s.name}`, price: s.price })),
      ],
      expiresAtMs: nowMs + BTC_ORDER_LOCK_MS,
    }
  } else {
    // o sufixo é sorteado e conferido contra os pedidos em $DOG que ainda podem casar (DOG_SUFFIX_UNIQUE_MS) com o mesmo valor; o casamento
    // ainda exige o remetente, então uma colisão rara cai em revisão, nunca no carro errado
    let atoms: number | null = null
    try {
      for (let i = 0; i < SUFFIX_TRIES && atoms === null; i++) {
        const a = dogExactAtoms(priceDog, deps.randomSuffix())
        if (a !== null && !(await store.dogAmountTaken(a, nowMs - DOG_SUFFIX_UNIQUE_MS))) atoms = a
      }
    } catch {
      return { ok: false, status: 503, error: 'no reliable quote right now' }
    }
    if (atoms === null) return { ok: false, status: 503, error: 'no reliable quote right now' }
    order = {
      ...base, payTo: sales.dogAddress, sats: null, dogExactAtoms: atoms, dogUsd: null, btcUsd: null, sources: [],
      expiresAtMs: nowMs + DOG_ORDER_LOCK_MS,
    }
  }

  // gravar ANTES de responder: um pedido que a pessoa viu e nós não temos nunca vira carro
  try {
    await store.insert(order)
  } catch {
    return { ok: false, status: 503, error: 'no reliable quote right now' }
  }
  const pub: PublicCarOrder = {
    id: order.id, model, name: CAR_MODELS[model].name, currency, priceDog, payTo: order.payTo, payerAddress,
    expiresAt: new Date(order.expiresAtMs).toISOString(), serverTime: new Date(nowMs).toISOString(),
    ...(order.currency === 'btc'
      ? { sats: order.sats!, dogUsd: order.dogUsd!, btcUsd: order.btcUsd!, sources: order.sources }
      : { dogExact: atomsToDogString(order.dogExactAtoms!), dogExactAtoms: order.dogExactAtoms! }),
  }
  return { ok: true, status: 200, order: pub }
}
