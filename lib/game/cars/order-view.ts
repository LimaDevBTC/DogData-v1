// ═══════════════════════════════════════════════════════════════════════════
// DOG MOTORS: o pedido como a JANELA DE COMPRA o aceita (a resposta do POST /api/dogcity/car-quote).
//
// O servidor decide tudo (preço, sats, valor exato, endereço, prazo) e grava o pedido antes de responder; o cliente
// não manda número nenhum além do modelo, da moeda e do endereço pagador. Mesmo assim a tela NÃO mostra instrução de
// pagamento de uma resposta fora da forma: um valor torto na tela é dinheiro torto na carteira de alguém.
// Esta conferência é pura (o teste roda sem navegador) e recusa, nunca arredonda:
//   - id uuid, modelo e moeda iguais aos pedidos, nome igual ao do catálogo, preço dentro do piso e do teto e igual
//     ao que o cartão mostrou;
//   - endereço pagador igual ao que a janela mandou (BTC: o de pagamento da carteira; $DOG: o ordinals da sessão);
//   - `payTo` de mainnet, diferente do pagador e dos endereços do fundo da LICENÇA (o dinheiro do carro nunca vai
//     para o fundo da licença);
//   - prazo depois do relógio do servidor e dentro da trava da moeda (BTC 15 min, $DOG 60 min);
//   - BTC: sats inteiros e seguros entre o piso e o teto; $DOG: átomos inteiros, o texto igual aos átomos, a parte
//     inteira igual ao preço e o sufixo de 1 a 99.999 átomos.
// ═══════════════════════════════════════════════════════════════════════════
import { FUND_BTC_ADDRESS, FUND_DOG_ADDRESS, MIN_PAYMENT_SATS, normalizeAddress } from '@/lib/dog/licence-btc'
import { CAR_MODELS, isCarModel, validPriceDog } from './catalog'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** os mesmos números de lib/game/cars/order.ts (não importados: aquele módulo puxa a régua de preço do servidor) */
export const ATOMS_PER_DOG = 100_000
export const SUFFIX_MAX = 99_999
export const CAR_MAX_SATS = 50_000_000
export const BTC_LOCK_MS = 15 * 60 * 1000
export const DOG_LOCK_MS = 60 * 60 * 1000
/** folga de relógio entre o `serverTime` e o `expiresAt` gravados no mesmo instante */
const LOCK_SLACK_MS = 5_000

export type CarCurrency = 'btc' | 'dog'

export interface CarOrderView {
  id: string
  model: string
  name: string
  currency: CarCurrency
  priceDog: number
  payTo: string
  payerAddress: string
  expiresAtMs: number
  serverTimeMs: number
  /** BTC: os sats exatos */
  sats: number | null
  /** $DOG: o valor exato em texto ("20000.04217") e em átomos */
  dogExact: string | null
  dogExactAtoms: number | null
  dogUsd: number | null
  btcUsd: number | null
  sources: string[]
}

/** átomos em texto com 5 casas, sem ponto flutuante (o mesmo de atomsToDogString em order.ts) */
export function atomsText(atoms: number): string | null {
  if (!Number.isSafeInteger(atoms) || atoms < 0) return null
  const s = String(atoms).padStart(6, '0')
  return `${s.slice(0, -5)}.${s.slice(-5)}`
}

/** "20,000.04217": o valor exato com separador de milhar, para ler; os 5 decimais nunca somem */
export function atomsPretty(atoms: number): string | null {
  const t = atomsText(atoms)
  if (!t) return null
  const [i, d] = t.split('.')
  return `${Number(i).toLocaleString('en-US')}.${d}`
}

export type ParseOrderResult = { ok: true; order: CarOrderView } | { ok: false; error: string }

export function parseCarOrder(
  raw: unknown,
  expect: { model: string; currency: CarCurrency; payerAddress: string; priceDog: number | null },
): ParseOrderResult {
  const bad = (why: string): ParseOrderResult => ({ ok: false, error: why })
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return bad('empty order')
  const r = raw as Record<string, unknown>

  if (typeof r.id !== 'string' || !UUID.test(r.id)) return bad('order id')
  if (!isCarModel(r.model) || r.model !== expect.model) return bad('model')
  if (r.name !== CAR_MODELS[r.model].name) return bad('name')
  if (r.currency !== expect.currency) return bad('currency')
  if (!validPriceDog(r.priceDog)) return bad('price')
  if (expect.priceDog !== null && r.priceDog !== expect.priceDog) return bad('price changed')

  const payer = normalizeAddress(r.payerAddress)
  const want = normalizeAddress(expect.payerAddress)
  if (!payer || !want || payer !== want) return bad('payer address')
  const payTo = normalizeAddress(r.payTo)
  if (!payTo || payTo === payer) return bad('payment address')
  const licence = new Set([FUND_BTC_ADDRESS, FUND_DOG_ADDRESS].map((a) => normalizeAddress(a)))
  if (licence.has(payTo)) return bad('payment address is the licence fund')

  const exp = typeof r.expiresAt === 'string' ? Date.parse(r.expiresAt) : NaN
  const now = typeof r.serverTime === 'string' ? Date.parse(r.serverTime) : NaN
  if (!Number.isFinite(exp) || !Number.isFinite(now) || exp <= now) return bad('deadline')
  const lock = expect.currency === 'btc' ? BTC_LOCK_MS : DOG_LOCK_MS
  if (exp - now > lock + LOCK_SLACK_MS) return bad('deadline too long')

  let sats: number | null = null
  let dogExact: string | null = null
  let dogExactAtoms: number | null = null
  if (expect.currency === 'btc') {
    if (typeof r.sats !== 'number' || !Number.isSafeInteger(r.sats) || r.sats < MIN_PAYMENT_SATS || r.sats > CAR_MAX_SATS) return bad('sats')
    if (r.dogExact !== undefined || r.dogExactAtoms !== undefined) return bad('mixed currencies')
    sats = r.sats
  } else {
    const a = r.dogExactAtoms
    if (typeof a !== 'number' || !Number.isSafeInteger(a)) return bad('exact amount')
    const suffix = a - (r.priceDog as number) * ATOMS_PER_DOG
    if (suffix < 1 || suffix > SUFFIX_MAX) return bad('exact amount suffix')
    if (typeof r.dogExact !== 'string' || r.dogExact !== atomsText(a)) return bad('exact amount text')
    if (r.sats !== undefined) return bad('mixed currencies')
    dogExact = r.dogExact
    dogExactAtoms = a
  }

  const pos = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null)
  const sources = Array.isArray(r.sources)
    ? [...new Set((r.sources as unknown[])
      .map((s) => (s && typeof s === 'object' && typeof (s as any).name === 'string' ? String((s as any).name).replace(/^(DOG|BTC)\/USD /, '') : ''))
      .filter((s) => s.length > 0 && s.length <= 40))]
    : []

  return {
    ok: true,
    order: {
      id: r.id.toLowerCase(), model: r.model, name: r.name as string, currency: expect.currency, priceDog: r.priceDog as number,
      payTo, payerAddress: payer, expiresAtMs: exp, serverTimeMs: now, sats, dogExact, dogExactAtoms,
      dogUsd: pos(r.dogUsd), btcUsd: pos(r.btcUsd), sources,
    },
  }
}

/** a frase de tela de cada erro do POST (lib/game/cars/order.ts e a rota) */
export function orderErrorText(status: number, error: unknown): string {
  const e = typeof error === 'string' ? error : ''
  if (status === 401) return 'Your wallet session ended. Sign in again with your wallet.'
  if (e === 'sales_closed') return 'The showroom is not open yet.'
  if (e === 'already_owned') return 'This wallet already has this car. One of each model per wallet.'
  if (e === 'model_not_for_sale' || e === 'model_unavailable') return 'This car is not for sale right now.'
  if (status === 429) return 'Too many orders from this wallet. Try again in an hour.'
  if (e.startsWith('paymentAddress')) return 'This wallet did not give a Bitcoin payment address.'
  if (e === 'a fund address cannot be a wallet address') return 'This wallet cannot buy from DOG MOTORS.'
  if (status === 503) return 'No reliable price right now. Try again in a minute.'
  return 'The order did not go through. Nothing was charged.'
}
