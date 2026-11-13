// Run: npx tsx --test lib/game/cars/cars.test.ts
//
// Carros da DOG MOTORS pagos em $DOG ou BTC, com dado SIMULADO (preços, endereços e txids inventados). UM TESTE
// POR ATAQUE: pagamento a menor, cotação vencida, txid repetido, endereço pagador trocado, valor $DOG sem sufixo,
// NaN/Infinity/negativo, teto. Mais: loja fechada sem os endereços, o carro nunca no fundo da licença, um modelo
// por carteira (prêmio da corrida conta), o preço só vale quando código e banco concordam, e a varredura de
// ponta a ponta com um banco de mentira que imita a função dogcity_car_credit da migração 039.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { BTC_MIN_CONFIRMATIONS, FUND_BTC_ADDRESS, FUND_DOG_ADDRESS, MIN_PAYMENT_SATS } from '@/lib/dog/licence-btc'
import type { Medians } from '@/lib/dog/price-sources'
import {
  CAR_MODELS, CAR_MODEL_IDS, MAX_CAR_PRICE_DOG, MIN_CAR_PRICE_DOG, PRECOS_PROVISORIOS, catalogIsSane, isCarModel, validPriceDog,
  type CarModel,
} from './catalog'
import { carSales, type CarSales } from './config'
import {
  BTC_LATE_REVIEW_MS, BTC_ORDER_LOCK_MS, CAR_MAX_SATS, DOG_BLOCK_GRACE_MS, DOG_ORDER_LOCK_MS, DOG_SUFFIX_MAX, MAX_DOG_EXACT_ATOMS,
  MAX_ORDERS_PER_PAYER_PER_HOUR, MAX_ORDERS_PER_WALLET_PER_HOUR, atomsToDogString, carSats, createCarOrder, dogExactAtoms,
  type CarOrder, type CarOrderStore, type ModelRow,
} from './order'
import { MAX_OVERPAY_FACTOR, matchBtcPayment, matchCarPayment, matchDogPayment, type CarPayment } from './payment'
import {
  btcPaymentsFromTx, dogPaymentsFromRow, keyOf, readBtcChain, sweepCars,
  type CarSweepStore, type ChainPayment, type CreditOutcome, type StoredCarPayment,
} from './sweep'
import { orderFromDb } from './supabase'

const T0 = Date.UTC(2026, 10, 13, 12, 0, 0)
const MIN = 60_000
const H = 60 * MIN
const W = 'bc1p' + 'a'.repeat(58)        // a carteira ordinals da sessão
const W2 = 'bc1p' + 'f'.repeat(58)       // outra carteira
const PAY = 'bc1q' + 'b'.repeat(38)      // o endereço de pagamento da mesma carteira
const OTHER = 'bc1q' + 'c'.repeat(38)    // um endereço que não é do pedido
const CAR_BTC = 'bc1q' + 'd'.repeat(38)  // o fundo do carro, BTC
const CAR_DOG = 'bc1p' + 'e'.repeat(58)  // o fundo do carro, $DOG
const FUNDS = [FUND_BTC_ADDRESS, FUND_DOG_ADDRESS, CAR_BTC, CAR_DOG]
const OPEN: CarSales = { open: true, btcAddress: CAR_BTC, dogAddress: CAR_DOG }
const DOG_USD = 0.0015
const BTC_USD = 100_000
const tx = (c: string) => c.repeat(64)

const okMed = (price: number) => ({ ok: true as const, price, sources: [{ name: 'A', price }, { name: 'B', price }] })
const medians = (dog = DOG_USD, btc = BTC_USD): Medians => ({ dog: okMed(dog), btc: okMed(btc) })

// ── um banco de pedidos de mentira ──────────────────────────────────────────

class MemOrders implements CarOrderStore {
  orders: CarOrder[] = []
  models = new Map<string, ModelRow>(CAR_MODEL_IDS.map((id) => [id, { priceDog: CAR_MODELS[id].priceDog, active: true }]))
  owned = new Set<string>()
  fail = false
  async modelRow(m: string) { if (this.fail) throw new Error('db down'); return this.models.get(m) ?? null }
  async ownsModel(w: string, m: string) { if (this.fail) throw new Error('db down'); return this.owned.has(`${w}:${m}`) }
  async countByWalletSince(w: string, s: number) { return this.orders.filter((o) => o.wallet === w && o.createdAtMs >= s).length }
  async countByPayerSince(p: string, s: number) { return this.orders.filter((o) => o.payerAddress === p && o.createdAtMs >= s).length }
  async dogAmountTaken(a: number, s: number) { return this.orders.some((o) => o.currency === 'dog' && o.dogExactAtoms === a && o.createdAtMs >= s) }
  async insert(o: CarOrder) { if (this.fail) throw new Error('db down'); this.orders.push(o) }
}

let seq = 0
function deps(store: CarOrderStore, over: Partial<Parameters<typeof createCarOrder>[0]> = {}) {
  return {
    sales: OPEN, store, medians: async () => medians(), nowMs: T0, newId: () => `o${++seq}`,
    randomSuffix: () => 4217, ...over,
  }
}

async function orderOf(body: Record<string, unknown>, store = new MemOrders(), wallet: string | null = W, over: Partial<Parameters<typeof createCarOrder>[0]> = {}) {
  const r = await createCarOrder(deps(store, over), wallet, body)
  return { r, store }
}

function btcOrder(over: Partial<CarOrder> = {}): CarOrder {
  return {
    id: 'ob', model: 'c52', wallet: W, currency: 'btc', payerAddress: PAY, payTo: CAR_BTC, priceDog: 10_000,
    sats: carSats(10_000, DOG_USD, BTC_USD), dogExactAtoms: null, dogUsd: DOG_USD, btcUsd: BTC_USD, sources: [],
    createdAtMs: T0, expiresAtMs: T0 + BTC_ORDER_LOCK_MS, ...over,
  }
}
function dogOrder(over: Partial<CarOrder> = {}): CarOrder {
  return {
    id: 'od', model: 'c52', wallet: W, currency: 'dog', payerAddress: W, payTo: CAR_DOG, priceDog: 10_000,
    sats: null, dogExactAtoms: dogExactAtoms(10_000, 4217), dogUsd: null, btcUsd: null, sources: [],
    createdAtMs: T0, expiresAtMs: T0 + DOG_ORDER_LOCK_MS, ...over,
  }
}
function btcPay(over: Partial<CarPayment> = {}): CarPayment {
  return { currency: 'btc', txid: tx('1'), vout: 0, amount: btcOrder().sats!, payerAddresses: [PAY], seenAtMs: T0 + 5 * MIN, blockTimeMs: T0 + 8 * MIN, confirmations: 6, ...over }
}
function dogPay(over: Partial<CarPayment> = {}): CarPayment {
  return { currency: 'dog', txid: tx('2'), vout: 1, amount: dogOrder().dogExactAtoms!, payerAddresses: [W], seenAtMs: T0 + 20 * MIN, blockTimeMs: T0 + 20 * MIN, confirmations: 6, ...over }
}

// ═══ catálogo e loja ════════════════════════════════════════════════════════

test('catálogo: os 18 modelos da DOG MOTORS, preço válido, e o seed da 039 com os MESMOS preços', () => {
  assert.deepEqual([...CAR_MODEL_IDS].sort(), ['c02', 'c05', 'c10', 'c15', 'c25', 'c26', 'c28', 'c30', 'c32', 'c39', 'c40', 'c41', 'c42', 'c43', 'c52', 'c56', 'c61', 'c62'])
  assert.equal(catalogIsSane(), true)
  for (const id of CAR_MODEL_IDS) assert.equal(validPriceDog(CAR_MODELS[id].priceDog), true, id)
  // o código e o banco têm de dar o mesmo preço: o seed da migração tranca a igualdade
  const sql = readFileSync(join(process.cwd(), 'supabase/migrations/039_dogcity_cars.sql'), 'utf8')
  const seed = new Map([...sql.matchAll(/\('(c[0-9]{2})', '([^']+)', ([0-9]+)\)/g)].map((m) => [m[1], { name: m[2], price: Number(m[3]) }]))
  assert.equal(seed.size, 18)
  for (const id of CAR_MODEL_IDS) {
    assert.equal(seed.get(id)?.price, CAR_MODELS[id].priceDog, `preço de ${id}`)
    assert.equal(seed.get(id)?.name, CAR_MODELS[id].name, `nome de ${id}`)
  }
  // o teto e o piso do código são os do check da migração
  assert.match(sql, new RegExp(`price_dog between ${MIN_CAR_PRICE_DOG} and ${MAX_CAR_PRICE_DOG}`))
  assert.match(sql, new RegExp(`sats between ${MIN_PAYMENT_SATS} and ${CAR_MAX_SATS}`))
})

test('catálogo: id que não é modelo (protótipo, vazio, número) não passa', () => {
  for (const v of ['__proto__', 'toString', 'constructor', '', 'C02', 'c99', 2, null, undefined, {}]) assert.equal(isCarModel(v), false, String(v))
  assert.equal(catalogIsSane([{ id: 'c02', name: 'x', class: 'super', priceDog: NaN } as CarModel]), false)
  assert.equal(catalogIsSane([{ id: 'c02', name: 'x', class: 'super', priceDog: 1 } as CarModel, { id: 'c02', name: 'y', class: 'super', priceDog: 20_000 } as CarModel]), false)
})

test('loja FECHADA sem as variáveis, com endereço inválido, com endereço do fundo da licença ou com preço provisório', () => {
  const env = { CAR_FUND_BTC_ADDRESS: CAR_BTC, CAR_FUND_DOG_ADDRESS: CAR_DOG, CAR_SALES_OPEN: '1' }
  assert.deepEqual(carSales({}, { provisional: false }), { open: false, reason: 'no_btc_address' })
  assert.deepEqual(carSales({ CAR_FUND_BTC_ADDRESS: CAR_BTC }, { provisional: false }), { open: false, reason: 'no_dog_address' })
  assert.deepEqual(carSales({ ...env, CAR_FUND_BTC_ADDRESS: '  ' }, { provisional: false }), { open: false, reason: 'no_btc_address' })
  assert.deepEqual(carSales({ ...env, CAR_FUND_DOG_ADDRESS: 'tb1qnotmainnet0000000000000000000000000' }, { provisional: false }), { open: false, reason: 'no_dog_address' })
  // o carro NUNCA recebe no fundo da licença (senão entraria no placar, no livro dos founders e no gatilho do mint)
  assert.deepEqual(carSales({ ...env, CAR_FUND_BTC_ADDRESS: FUND_BTC_ADDRESS }, { provisional: false }), { open: false, reason: 'licence_address' })
  assert.deepEqual(carSales({ ...env, CAR_FUND_DOG_ADDRESS: FUND_DOG_ADDRESS.toUpperCase() }, { provisional: false }), { open: false, reason: 'licence_address' })
  assert.deepEqual(carSales(env, { provisional: true }), { open: false, reason: 'provisional_prices' })
  assert.deepEqual(carSales(env, { provisional: false, catalogOk: false }), { open: false, reason: 'bad_catalog' })
  assert.deepEqual(carSales(env, { provisional: false }), { open: true, btcAddress: CAR_BTC, dogAddress: CAR_DOG })
  // a chave de abertura: sem CAR_SALES_OPEN=1 a loja não vende, mesmo com tudo pronto
  for (const v of [undefined, '', '0', 'true', 'yes', ' 2 ']) {
    assert.deepEqual(carSales({ ...env, CAR_SALES_OPEN: v }, { provisional: false }), { open: false, reason: 'not_open' }, `CAR_SALES_OPEN=${v}`)
  }
  assert.equal(carSales({ ...env, CAR_SALES_OPEN: ' 1 ' }, { provisional: false }).open, true)
  // os preços são os do fundador (13/11); sem os dois endereços próprios a loja continua fechada
  assert.equal(PRECOS_PROVISORIOS, false)
  assert.equal(carSales({}).open, false)
})

test('loja fechada: o pedido responde 503 sales_closed e não grava nada', async () => {
  const { r, store } = await orderOf({ model: 'c52', currency: 'dog' }, new MemOrders(), W, { sales: { open: false, reason: 'no_btc_address' } })
  assert.deepEqual(r, { ok: false, status: 503, error: 'sales_closed' })
  assert.equal(store.orders.length, 0)
})

// ═══ o pedido ═══════════════════════════════════════════════════════════════

test('pedido em BTC: sats pela mediana, trava de 15 min, dono = carteira da sessão', async () => {
  const { r, store } = await orderOf({ model: 'c52', currency: 'btc', paymentAddress: PAY, wallet: W2, ordinalsAddress: W2 })
  assert.equal(r.ok, true)
  const o = (r as any).order
  assert.equal(o.sats, carSats(10_000, DOG_USD, BTC_USD))
  assert.equal(o.sats, Math.ceil(10_000 * DOG_USD * 1e8 / BTC_USD))
  assert.equal(o.payTo, CAR_BTC)
  assert.equal(o.expiresAt, new Date(T0 + 15 * MIN).toISOString())
  // o corpo tentou nomear outra carteira: ignorado, o dono é a da sessão
  assert.equal(store.orders[0].wallet, W)
  assert.equal(store.orders[0].payerAddress, PAY)
})

test('pedido em $DOG: valor EXATO = preço + sufixo, pagador padrão = a própria carteira', async () => {
  const { r, store } = await orderOf({ model: 'c52', currency: 'dog' })
  assert.equal(r.ok, true)
  const o = (r as any).order
  assert.equal(o.dogExactAtoms, 10_000 * 100_000 + 4217)
  assert.equal(o.dogExact, '10000.04217')
  assert.equal(o.payTo, CAR_DOG)
  assert.equal(o.payerAddress, W)
  assert.equal(store.orders[0].sats, null)
  assert.equal(atomsToDogString(1), '0.00001')
  assert.equal(atomsToDogString(2_000_000_000), '20000.00000')
})

test('pedido em $DOG: o sufixo nunca se repete enquanto o outro pedido pode casar (sorteia de novo)', async () => {
  const store = new MemOrders()
  const sorteios = [4217, 4217, 4217, 99]
  const fix = () => sorteios.shift()!
  await orderOf({ model: 'c52', currency: 'dog' }, store, W, { randomSuffix: fix })
  const { r } = await orderOf({ model: 'c56', currency: 'dog' }, store, W2, { randomSuffix: fix })
  assert.equal((r as any).order.dogExactAtoms, 10_000 * 100_000 + 99)
  // sem sufixo livre em SUFFIX_TRIES tentativas: 503, nada gravado
  const { r: r2 } = await orderOf({ model: 'c56', currency: 'dog', paymentAddress: OTHER }, store, 'bc1p' + '9'.repeat(58), { randomSuffix: () => 4217 })
  assert.deepEqual(r2, { ok: false, status: 503, error: 'no reliable quote right now' })
  assert.equal(store.orders.length, 2)
})

test('pedido: sem sessão 401; campo torto 400; endereço do fundo como carteira 400', async () => {
  assert.equal((await orderOf({ model: 'c52', currency: 'dog' }, new MemOrders(), null)).r.status, 401)
  assert.equal((await orderOf({ model: 'c52', currency: 'dog' }, new MemOrders(), 'not-an-address')).r.status, 401)
  assert.equal((await orderOf({ model: 'c99', currency: 'dog' })).r.status, 400)
  assert.equal((await orderOf({ model: 'c52', currency: 'eth' })).r.status, 400)
  assert.equal((await orderOf({ model: 'c52', currency: 'btc' })).r.status, 400) // BTC sem endereço pagador
  assert.equal((await orderOf({ model: 'c52', currency: 'btc', paymentAddress: 'xyz' })).r.status, 400)
  for (const f of FUNDS) assert.equal((await orderOf({ model: 'c52', currency: 'btc', paymentAddress: f })).r.status, 400, f)
  assert.equal((await orderOf({ model: 'c52', currency: 'dog' }, new MemOrders(), CAR_DOG)).r.status, 400)
  assert.equal((await orderOf([] as any)).r.status, 400)
})

test('um carro de cada modelo por carteira: quem já tem (compra ou prêmio) recebe 409 e nada é gravado', async () => {
  const store = new MemOrders()
  store.owned.add(`${W}:c52`)
  const { r } = await orderOf({ model: 'c52', currency: 'dog' }, store)
  assert.deepEqual(r, { ok: false, status: 409, error: 'already_owned' })
  assert.equal(store.orders.length, 0)
  // outro modelo, a mesma carteira: pode
  assert.equal((await orderOf({ model: 'c56', currency: 'dog' }, store)).r.ok, true)
})

test('o preço só vale quando código e banco concordam; modelo inativo 409; banco fora 503', async () => {
  const s1 = new MemOrders(); s1.models.set('c52', { priceDog: 19_999, active: true })
  assert.deepEqual((await orderOf({ model: 'c52', currency: 'dog' }, s1)).r, { ok: false, status: 503, error: 'model_unavailable' })
  const s2 = new MemOrders(); s2.models.delete('c52')
  assert.equal((await orderOf({ model: 'c52', currency: 'dog' }, s2)).r.status, 503)
  const s3 = new MemOrders(); s3.models.set('c52', { priceDog: 10_000, active: false })
  assert.deepEqual((await orderOf({ model: 'c52', currency: 'dog' }, s3)).r, { ok: false, status: 409, error: 'model_not_for_sale' })
  const s4 = new MemOrders(); s4.fail = true
  assert.equal((await orderOf({ model: 'c52', currency: 'dog' }, s4)).r.status, 503)
  for (const s of [s1, s2, s3, s4]) assert.equal(s.orders.length, 0)
})

test('tetos por carteira e por pagador por hora: 429', async () => {
  const store = new MemOrders()
  for (let i = 0; i < MAX_ORDERS_PER_WALLET_PER_HOUR; i++) {
    store.orders.push(dogOrder({ id: `x${i}`, payerAddress: 'bc1q' + String(i).repeat(38).slice(0, 38), dogExactAtoms: 2_000_000_000 + 100 + i }))
  }
  assert.equal((await orderOf({ model: 'c56', currency: 'dog' }, store)).r.status, 429)
  const s2 = new MemOrders()
  for (let i = 0; i < MAX_ORDERS_PER_PAYER_PER_HOUR; i++) s2.orders.push(btcOrder({ id: `y${i}`, wallet: 'bc1p' + String(i).repeat(58).slice(0, 58) }))
  assert.equal((await orderOf({ model: 'c56', currency: 'btc', paymentAddress: PAY }, s2)).r.status, 429)
})

test('BTC sem cotação confiável (fontes recusadas ou corretora fora): 503, nada gravado', async () => {
  const store = new MemOrders()
  const r1 = await orderOf({ model: 'c52', currency: 'btc', paymentAddress: PAY }, store, W, { medians: async () => ({ dog: { ok: false, reason: 'not_enough_sources' }, btc: okMed(BTC_USD) }) })
  const r2 = await orderOf({ model: 'c52', currency: 'btc', paymentAddress: PAY }, store, W, { medians: async () => { throw new Error('down') } })
  assert.equal(r1.r.status, 503)
  assert.equal(r2.r.status, 503)
  assert.equal(store.orders.length, 0)
  // em $DOG não precisa de cotação: a corretora fora não impede
  assert.equal((await orderOf({ model: 'c52', currency: 'dog' }, store, W, { medians: async () => { throw new Error('down') } })).r.ok, true)
})

// ═══ ATAQUE: NaN, Infinity, negativo ════════════════════════════════════════

test('ATAQUE NaN/Infinity/negativo: preço, sats, sufixo e relógio tortos nunca viram valor', async () => {
  for (const p of [NaN, Infinity, -Infinity, -20_000, 0, 20_000.5, Number.MAX_SAFE_INTEGER + 2, '20000' as any]) {
    assert.equal(validPriceDog(p), false, String(p))
    assert.equal(carSats(p, DOG_USD, BTC_USD), null, String(p))
    assert.equal(dogExactAtoms(p, 1), null, String(p))
  }
  for (const v of [NaN, Infinity, -1, 0]) {
    assert.equal(carSats(20_000, v, BTC_USD), null, `dogUsd ${v}`)
    assert.equal(carSats(20_000, DOG_USD, v), null, `btcUsd ${v}`)
  }
  for (const s of [NaN, Infinity, 0, -1, 1.5, DOG_SUFFIX_MAX + 1]) assert.equal(dogExactAtoms(20_000, s), null, `sufixo ${s}`)
  // mediana com preço NaN: não cota
  const store = new MemOrders()
  const r = await orderOf({ model: 'c52', currency: 'btc', paymentAddress: PAY }, store, W, { medians: async () => ({ dog: okMed(NaN), btc: okMed(BTC_USD) }) })
  assert.equal(r.r.status, 503)
  // sorteio NaN: nunca grava um valor torto
  const r2 = await orderOf({ model: 'c52', currency: 'dog' }, store, W, { randomSuffix: () => NaN })
  assert.equal(r2.r.status, 503)
  // relógio NaN: não grava
  assert.equal((await orderOf({ model: 'c52', currency: 'dog' }, store, W, { nowMs: NaN })).r.status, 503)
  assert.equal(store.orders.length, 0)
  // pagamento com valor NaN, Infinity, negativo, fração ou relógio NaN: revisão, nunca carro
  for (const amount of [NaN, Infinity, -5, 0, 1.5]) {
    assert.deepEqual(matchBtcPayment(btcPay({ amount }), [btcOrder()], FUNDS), { status: 'pending_review', reason: 'invalid_amount' }, `btc ${amount}`)
    assert.deepEqual(matchDogPayment(dogPay({ amount }), [dogOrder()], FUNDS), { status: 'pending_review', reason: 'invalid_amount' }, `dog ${amount}`)
  }
  assert.equal(matchBtcPayment(btcPay({ seenAtMs: NaN }), [btcOrder()], FUNDS).status, 'pending_review')
  assert.equal(matchDogPayment(dogPay({ seenAtMs: NaN }), [dogOrder()], FUNDS).status, 'pending_review')
  // confirmações NaN contam como zero
  assert.deepEqual(matchBtcPayment(btcPay({ confirmations: NaN }), [btcOrder()], FUNDS), { status: 'observed', reason: 'confirmations' })
  // pedido torto vindo do banco não casa com nada
  assert.equal(orderFromDb({ id: 'x', model: 'c52', wallet: W, currency: 'btc', payer_address: PAY, price_dog: '20000', sats: 'NaN', created_at: new Date(T0).toISOString(), expires_at: new Date(T0 + MIN).toISOString() }), null)
  assert.equal(orderFromDb({ id: 'x', model: 'c52', wallet: W, currency: 'dog', payer_address: PAY, price_dog: 20000, dog_exact_atoms: -1, created_at: new Date(T0).toISOString(), expires_at: new Date(T0 + MIN).toISOString() }), null)
})

// ═══ ATAQUE: teto ═══════════════════════════════════════════════════════════

test('ATAQUE teto: preço acima do teto, sats acima de 0,5 BTC e $DOG acima do maior valor possível', async () => {
  assert.equal(validPriceDog(MAX_CAR_PRICE_DOG), true)
  assert.equal(validPriceDog(MAX_CAR_PRICE_DOG + 1), false)
  assert.equal(validPriceDog(MIN_CAR_PRICE_DOG - 1), false)
  // a cotação que daria mais que o teto de sats não sai (DOG caro demais contra o BTC)
  assert.equal(carSats(MAX_CAR_PRICE_DOG, 10, 1_000), null)
  const store = new MemOrders()
  const r = await orderOf({ model: 'c02', currency: 'btc', paymentAddress: PAY }, store, W, { medians: async () => medians(50, 10_000) })
  assert.equal(r.r.status, 503)
  assert.equal(store.orders.length, 0)
  // pagamento acima do teto vai para revisão, nunca é truncado nem creditado
  const big = btcOrder({ sats: CAR_MAX_SATS })
  assert.deepEqual(matchBtcPayment(btcPay({ amount: CAR_MAX_SATS + 1 }), [big], FUNDS), { status: 'pending_review', reason: 'above_ceiling' })
  assert.equal(matchBtcPayment(btcPay({ amount: CAR_MAX_SATS }), [big], FUNDS).status, 'match')
  assert.deepEqual(matchDogPayment(dogPay({ amount: MAX_DOG_EXACT_ATOMS + 1 }), [dogOrder()], FUNDS), { status: 'pending_review', reason: 'above_ceiling' })
  // pagar mais que o dobro do pedido: revisão (pode ser dois carros num pagamento)
  const o = btcOrder()
  assert.deepEqual(matchBtcPayment(btcPay({ amount: o.sats! * MAX_OVERPAY_FACTOR + 1 }), [o], FUNDS), { status: 'pending_review', reason: 'overpaid' })
  assert.equal(matchBtcPayment(btcPay({ amount: o.sats! * MAX_OVERPAY_FACTOR }), [o], FUNDS).status, 'match')
})

// ═══ ATAQUE: pagamento a menor ══════════════════════════════════════════════

test('ATAQUE pagamento a menor: BTC 1 sat abaixo vai para revisão; $DOG 1 átomo abaixo também', () => {
  const o = btcOrder()
  assert.deepEqual(matchBtcPayment(btcPay({ amount: o.sats! - 1 }), [o], FUNDS), { status: 'pending_review', reason: 'underpaid' })
  assert.deepEqual(matchBtcPayment(btcPay({ amount: o.sats! }), [o], FUNDS), { status: 'match', order: o })
  const d = dogOrder()
  assert.deepEqual(matchDogPayment(dogPay({ amount: d.dogExactAtoms! - 1 }), [d], FUNDS), { status: 'pending_review', reason: 'amount_mismatch' })
  // a MAIOR em $DOG também não casa: o valor é exato
  assert.deepEqual(matchDogPayment(dogPay({ amount: d.dogExactAtoms! + 1 }), [d], FUNDS), { status: 'pending_review', reason: 'amount_mismatch' })
  // poeira em BTC não é compra nem revisão
  assert.deepEqual(matchBtcPayment(btcPay({ amount: MIN_PAYMENT_SATS - 1 }), [o], FUNDS), { status: 'unmatched', reason: 'dust' })
})

// ═══ ATAQUE: valor $DOG sem sufixo ══════════════════════════════════════════

test('ATAQUE valor $DOG sem sufixo: enviar o preço redondo nunca vira carro', () => {
  const d = dogOrder()
  assert.deepEqual(matchDogPayment(dogPay({ amount: d.priceDog * 100_000 }), [d], FUNDS), { status: 'pending_review', reason: 'amount_mismatch' })
  // o pedido em si nunca nasce sem sufixo (o check da 039 também recusa)
  assert.equal(dogExactAtoms(20_000, 0), null)
  const sql = readFileSync(join(process.cwd(), 'supabase/migrations/039_dogcity_cars.sql'), 'utf8')
  assert.match(sql, /dog_exact_atoms > price_dog \* 100000 and dog_exact_atoms < \(price_dog \+ 1\) \* 100000/)
})

// ═══ ATAQUE: cotação vencida ════════════════════════════════════════════════

test('ATAQUE cotação vencida: BTC pago depois da trava vai para revisão (nunca credita à taxa velha)', () => {
  const o = btcOrder()
  const late = btcPay({ seenAtMs: o.expiresAtMs + 1, blockTimeMs: o.expiresAtMs + 5 * MIN })
  assert.deepEqual(matchBtcPayment(late, [o], FUNDS), { status: 'pending_review', reason: 'order_expired' })
  // visto tarde pela varredura, mas minerado dentro da trava: vale
  assert.equal(matchBtcPayment(btcPay({ seenAtMs: o.expiresAtMs + H, blockTimeMs: o.expiresAtMs - MIN }), [o], FUNDS).status, 'match')
  // muito depois da janela: não liga a pedido nenhum
  const veryLate = btcPay({ seenAtMs: o.expiresAtMs + BTC_LATE_REVIEW_MS + MIN, blockTimeMs: o.expiresAtMs + BTC_LATE_REVIEW_MS + MIN })
  assert.deepEqual(matchBtcPayment(veryLate, [o], FUNDS), { status: 'unmatched', reason: 'no_order' })
  // pago ANTES do pedido existir: não liga
  assert.deepEqual(matchBtcPayment(btcPay({ seenAtMs: T0 - MIN, blockTimeMs: T0 - 3 * H }), [o], FUNDS), { status: 'unmatched', reason: 'no_order' })
})

test('ATAQUE cotação vencida: $DOG com o bloco depois do prazo + folga vai para revisão', () => {
  const d = dogOrder()
  const t = d.expiresAtMs + DOG_BLOCK_GRACE_MS + 1
  assert.deepEqual(matchDogPayment(dogPay({ seenAtMs: t, blockTimeMs: t }), [d], FUNDS), { status: 'pending_review', reason: 'order_expired' })
  const inGrace = d.expiresAtMs + DOG_BLOCK_GRACE_MS
  assert.equal(matchDogPayment(dogPay({ seenAtMs: inGrace, blockTimeMs: inGrace }), [d], FUNDS).status, 'match')
})

// ═══ ATAQUE: endereço pagador trocado ═══════════════════════════════════════

test('ATAQUE endereço pagador trocado: o valor certo saindo de outro endereço nunca vira carro', () => {
  const o = btcOrder()
  assert.deepEqual(matchBtcPayment(btcPay({ payerAddresses: [OTHER] }), [o], FUNDS), { status: 'pending_review', reason: 'payer_mismatch' })
  const d = dogOrder()
  assert.deepEqual(matchDogPayment(dogPay({ payerAddresses: [OTHER] }), [d], FUNDS), { status: 'pending_review', reason: 'payer_mismatch' })
  // de outro endereço e com outro valor: não é de ninguém
  assert.deepEqual(matchBtcPayment(btcPay({ payerAddresses: [OTHER], amount: 123_456 }), [o], FUNDS), { status: 'unmatched', reason: 'no_order' })
})

test('ATAQUE pedido com o endereço pagador de OUTRA pessoa: pagador ligado a duas carteiras não se adivinha', () => {
  // o atacante (W2) cota pondo o PAY da vítima (W) como pagador; a vítima paga o pedido dela
  const vitima = btcOrder({ id: 'v' })
  const atacante = btcOrder({ id: 'a', wallet: W2, createdAtMs: T0 + MIN })
  assert.deepEqual(matchBtcPayment(btcPay(), [vitima, atacante], FUNDS), { status: 'pending_review', reason: 'ambiguous_owner' })
  // em $DOG o valor exato separa: o pagamento da vítima só casa com o pedido dela
  const dv = dogOrder({ id: 'dv' })
  const da = dogOrder({ id: 'da', wallet: W2, dogExactAtoms: dogExactAtoms(10_000, 777) })
  const m = matchDogPayment(dogPay(), [dv, da], FUNDS)
  assert.equal(m.status, 'match')
  assert.equal((m as any).order.id, 'dv')
})

test('o fundo (do carro ou da licença) como pagador nunca é compra', () => {
  for (const f of FUNDS) {
    assert.deepEqual(matchBtcPayment(btcPay({ payerAddresses: [PAY, f] }), [btcOrder()], FUNDS), { status: 'unmatched', reason: 'fund_is_payer' }, f)
    assert.deepEqual(matchDogPayment(dogPay({ payerAddresses: [W, f.toUpperCase()] }), [dogOrder()], FUNDS), { status: 'unmatched', reason: 'fund_is_payer' }, f)
  }
})

test('menos de 6 confirmações: só observado', () => {
  for (let c = 0; c < BTC_MIN_CONFIRMATIONS; c++) {
    assert.deepEqual(matchCarPayment(btcPay({ confirmations: c }), [btcOrder()], FUNDS), { status: 'observed', reason: 'confirmations' })
    assert.deepEqual(matchCarPayment(dogPay({ confirmations: c }), [dogOrder()], FUNDS), { status: 'observed', reason: 'confirmations' })
  }
})

test('dois pedidos vivos de modelos diferentes que o pagamento cobre: revisão; o valor exato desempata', () => {
  const a = btcOrder({ id: 'a', model: 'c52', sats: 30_000 })
  const b = btcOrder({ id: 'b', model: 'c56', sats: 30_000, createdAtMs: T0 + MIN })
  assert.deepEqual(matchBtcPayment(btcPay({ amount: 30_000 }), [a, b], FUNDS), { status: 'pending_review', reason: 'ambiguous_order' })
  const c = btcOrder({ id: 'c', model: 'c02', sats: 700_000 })
  const m = matchBtcPayment(btcPay({ amount: 700_000 }), [a, c], FUNDS)
  assert.equal((m as any).order?.id, 'c')
  // um pedido em BTC nunca casa com $DOG e vice-versa
  assert.deepEqual(matchDogPayment(dogPay({ amount: 30_000 }), [a], FUNDS), { status: 'unmatched', reason: 'no_order' })
})

// ═══ leitura da cadeia ══════════════════════════════════════════════════════

test('BTC: só as saídas ao endereço do carro; o fundo como pagador fica de fora', () => {
  const t = {
    txid: tx('a').toUpperCase(),
    vin: [{ prevout: { scriptpubkey_address: PAY } }],
    vout: [{ scriptpubkey_address: CAR_BTC, value: 30_000 }, { scriptpubkey_address: OTHER, value: 5_000 }, { scriptpubkey_address: CAR_BTC, value: 'NaN' }],
    status: { confirmed: true, block_height: 900_000, block_time: T0 / 1000 },
  }
  const ps = btcPaymentsFromTx(t, CAR_BTC, FUNDS)
  assert.equal(ps.length, 1)
  assert.deepEqual(ps[0], { currency: 'btc', txid: tx('a'), vout: 0, amount: 30_000, payerAddresses: [PAY], confirmed: true, blockHeight: 900_000, blockTimeMs: T0 })
  // pagamento ao fundo da LICENÇA não é pagamento de carro
  assert.equal(btcPaymentsFromTx({ ...t, vout: [{ scriptpubkey_address: FUND_BTC_ADDRESS, value: 30_000 }] }, CAR_BTC, FUNDS).length, 0)
  assert.equal(btcPaymentsFromTx({ ...t, vin: [{ prevout: { scriptpubkey_address: CAR_BTC } }] }, CAR_BTC, FUNDS).length, 0)
  assert.equal(btcPaymentsFromTx({ ...t, txid: 'zz' }, CAR_BTC, FUNDS).length, 0)
})

test('$DOG: um pagamento por receptor do endereço do carro, em átomos INTEIROS, com o vout do receptor', () => {
  const row = {
    txid: tx('b'), block_height: 900_001, timestamp: new Date(T0).toISOString(),
    // o índice às vezes guarda o JSON como texto
    senders: JSON.stringify([{ address: W, amount: 2_100_000_000 }, { address: OTHER, amount: 0 }]),
    receivers: [
      { address: CAR_DOG, amount: 2_000_004_217, amount_dog: 20000.04217, vout: 1, is_change: false },
      { address: W, amount: 99_995_783, vout: 2, is_change: true },
      { address: CAR_DOG, amount: 2000.5, vout: 3 },          // float: não é átomo
      { address: CAR_DOG, amount: 1_000 },                     // sem vout
    ],
  }
  const r = dogPaymentsFromRow(row, CAR_DOG, FUNDS)
  assert.equal(r.payments.length, 1)
  assert.equal(r.skipped, 2)
  assert.deepEqual(r.payments[0], { currency: 'dog', txid: tx('b'), vout: 1, amount: 2_000_004_217, payerAddresses: [W], confirmed: true, blockHeight: 900_001, blockTimeMs: T0 })
  // DOG ao fundo da licença não é pagamento de carro; o fundo como remetente fica de fora
  assert.equal(dogPaymentsFromRow({ ...row, receivers: [{ address: FUND_DOG_ADDRESS, amount: 2_000_004_217, vout: 1 }] }, CAR_DOG, FUNDS).payments.length, 0)
  assert.equal(dogPaymentsFromRow({ ...row, senders: [{ address: CAR_DOG, amount: 5 }] }, CAR_DOG, FUNDS).payments.length, 0)
  assert.equal(dogPaymentsFromRow({ ...row, timestamp: 'lixo' }, CAR_DOG, FUNDS).payments.length, 0)
})

test('BTC: a leitura do endereço do carro pega a ponta, as saídas e a primeira vista da rede de TODAS', async () => {
  const urls: string[] = []
  const confirmedTx = { txid: tx('c'), vin: [{ prevout: { scriptpubkey_address: PAY } }], vout: [{ scriptpubkey_address: CAR_BTC, value: 30_000 }], status: { confirmed: true, block_height: 900_000, block_time: T0 / 1000 } }
  const mempoolTx = { txid: tx('d'), vin: [{ prevout: { scriptpubkey_address: PAY } }], vout: [{ scriptpubkey_address: CAR_BTC, value: 40_000 }], status: { confirmed: false } }
  const f = async (u: string) => {
    urls.push(u)
    const body = u.endsWith('/blocks/tip/height') ? 900_010
      : u.includes(`/address/${CAR_BTC}/txs`) ? [mempoolTx, confirmedTx]
      : u.includes('/v1/transaction-times') ? [T0 / 1000 - 60, T0 / 1000 + 600]
      : null
    return { ok: body !== null, status: body !== null ? 200 : 404, json: async () => body }
  }
  const r = await readBtcChain(f, CAR_BTC, FUNDS)
  assert.equal(r.tip, 900_010)
  assert.deepEqual(r.payments.map((p) => [p.txid, p.amount, p.confirmed]), [[tx('d'), 40_000, false], [tx('c'), 30_000, true]])
  // a já confirmada também ganha a primeira vista da rede
  assert.equal(r.firstSeenMs.get(tx('d')), T0 - MIN)
  assert.equal(r.firstSeenMs.get(tx('c')), T0 + 10 * MIN)
  assert.ok(urls.every((u) => !u.includes(FUND_BTC_ADDRESS)), 'nunca lê o fundo da licença')
  // ponta torta: falha (nada de confirmações inventadas)
  await assert.rejects(readBtcChain(async (u: string) => ({ ok: true, status: 200, json: async () => (u.endsWith('/height') ? 'NaN' : []) }), CAR_BTC, FUNDS))
})

// ═══ a varredura de ponta a ponta ═══════════════════════════════════════════

/** um banco de mentira que imita a 039: crédito só pela função, posse única por (carteira, modelo), txid consumido */
class MemSweep implements CarSweepStore {
  rows = new Map<string, StoredCarPayment & { orderId?: string }>()
  owned = new Map<string, string>() // carteira:modelo -> ref
  prizes = new Set<string>()        // carteira:modelo com prêmio aprovado/entregue
  creditCalls = 0
  constructor(public orders: CarOrder[]) {}
  async loadRows(currency: 'btc' | 'dog', txids: string[]) {
    const out = new Map<string, StoredCarPayment>()
    for (const [k, r] of this.rows) if (r.currency === currency && txids.includes(r.txid)) out.set(k, r)
    return out
  }
  async loadOrders(since: number) { return this.orders.filter((o) => o.expiresAtMs >= since) }
  async saveRow(row: StoredCarPayment) {
    assert.notEqual(row.status, 'credited')
    const k = keyOf(row.currency, row.txid, row.vout)
    assert.notEqual(this.rows.get(k)?.status, 'credited', 'crédito é imutável')
    this.rows.set(k, row)
  }
  async credit(row: StoredCarPayment, orderId: string): Promise<CreditOutcome> {
    this.creditCalls++
    const o = this.orders.find((x) => x.id === orderId)!
    // as mesmas conferências da função dogcity_car_credit
    if (!row.payerAddresses.includes(o.payerAddress)) throw new Error('payer')
    if (o.currency === 'btc' ? row.amount < o.sats! || row.amount > CAR_MAX_SATS : row.amount !== o.dogExactAtoms) throw new Error('amount')
    const k = keyOf(row.currency, row.txid, row.vout)
    const ex = this.rows.get(k)
    if (ex && ex.status !== 'observed') return ex.status as CreditOutcome
    const wm = `${o.wallet}:${o.model}`
    if (this.owned.has(wm) || this.prizes.has(wm)) { this.rows.set(k, { ...row, status: 'pending_review', reviewReason: 'already_owned', orderId }); return 'already_owned' }
    if ([...this.rows.values()].some((r) => r.orderId === orderId && r.status === 'credited')) { this.rows.set(k, { ...row, status: 'pending_review', reviewReason: 'order_already_paid', orderId }); return 'order_already_paid' }
    this.rows.set(k, { ...row, status: 'credited', reviewReason: null, orderId })
    this.owned.set(wm, k)
    return 'credited'
  }
}

const chainBtc = (p: Partial<ChainPayment> = {}): ChainPayment => ({
  currency: 'btc', txid: tx('1'), vout: 0, amount: btcOrder().sats!, payerAddresses: [PAY], confirmed: true, blockHeight: 900_000, blockTimeMs: T0 + 8 * MIN, ...p,
})
const chainDog = (p: Partial<ChainPayment> = {}): ChainPayment => ({
  currency: 'dog', txid: tx('2'), vout: 1, amount: dogOrder().dogExactAtoms!, payerAddresses: [W], confirmed: true, blockHeight: 900_000, blockTimeMs: T0 + 20 * MIN, ...p,
})

test('varredura: BTC e $DOG certos viram carro com 6 confirmações; antes disso só observado', async () => {
  const store = new MemSweep([btcOrder(), dogOrder({ model: 'c56' })])
  const btc = { tip: 900_004, payments: [chainBtc()], firstSeenMs: new Map([[tx('1'), T0 + 5 * MIN]]) }
  const dog = { tip: 900_004, payments: [chainDog()] }
  let r = await sweepCars({ nowMs: T0 + H, funds: FUNDS, btc, dog, store })
  assert.equal(r.observed, 2)
  assert.equal(store.owned.size, 0)
  r = await sweepCars({ nowMs: T0 + 2 * H, funds: FUNDS, btc: { ...btc, tip: 900_005 }, dog: { ...dog, tip: 900_005 }, store })
  assert.equal(r.credited, 2)
  assert.deepEqual([...store.owned.keys()].sort(), [`${W}:c52`, `${W}:c56`])
  // a primeira vista só anda para trás: a gravada na 1ª volta vale
  assert.equal(store.rows.get(keyOf('btc', tx('1'), 0))!.firstSeenMs, T0 + 5 * MIN)
})

test('ATAQUE txid repetido: a mesma saída nunca vira dois carros (nem repetida na lista, nem na volta seguinte)', async () => {
  const store = new MemSweep([dogOrder()])
  const dog = { tip: 900_010, payments: [chainDog(), chainDog()] } // o índice devolveu a mesma linha duas vezes
  const r1 = await sweepCars({ nowMs: T0 + H, funds: FUNDS, btc: null, dog, store })
  assert.equal(r1.credited, 1)
  assert.equal(store.owned.size, 1)
  const r2 = await sweepCars({ nowMs: T0 + 2 * H, funds: FUNDS, btc: null, dog, store })
  assert.equal(r2.credited, 0)
  assert.equal(r2.skipped, 2)
  // a mesma saída reapresentada à função depois de creditada: devolve 'credited' sem gravar outra posse
  assert.equal(await store.credit({ ...store.rows.get(keyOf('dog', tx('2'), 1))!, status: 'observed' }, 'od'), 'credited')
  assert.equal(store.owned.size, 1)
  // OUTRO txid pagando o mesmo pedido de novo: já tem o modelo, vai para revisão (dinheiro devolvido por humano)
  const r3 = await sweepCars({ nowMs: T0 + 2 * H, funds: FUNDS, btc: null, dog: { tip: 900_010, payments: [chainDog({ txid: tx('3') })] }, store })
  assert.equal(r3.pendingReview, 1)
  assert.equal(store.rows.get(keyOf('dog', tx('3'), 1))!.reviewReason, 'already_owned')
  assert.equal(store.owned.size, 1)
})

test('varredura: o prêmio da corrida conta como posse (pagar o modelo ganho vai para revisão)', async () => {
  const store = new MemSweep([btcOrder()])
  store.prizes.add(`${W}:c52`)
  const r = await sweepCars({ nowMs: T0 + H, funds: FUNDS, btc: { tip: 900_010, payments: [chainBtc()], firstSeenMs: new Map() }, dog: null, store })
  assert.equal(r.pendingReview, 1)
  assert.equal(store.rows.get(keyOf('btc', tx('1'), 0))!.reviewReason, 'already_owned')
})

test('varredura: pagamentos fora de par vão para revisão com o motivo; um que falha não derruba os outros', async () => {
  const store = new MemSweep([btcOrder(), dogOrder({ model: 'c56' })])
  const bad = new MemSweep([])
  const btc = { tip: 900_010, payments: [chainBtc({ amount: btcOrder().sats! - 1 }), chainBtc({ txid: tx('4'), payerAddresses: [OTHER] })], firstSeenMs: new Map() }
  const dog = { tip: 900_010, payments: [chainDog({ amount: 20_000 * 100_000 })] }
  const r = await sweepCars({ nowMs: T0 + H, funds: FUNDS, btc, dog, store })
  assert.equal(r.pendingReview, 3)
  assert.equal(store.rows.get(keyOf('btc', tx('1'), 0))!.reviewReason, 'underpaid')
  assert.equal(store.rows.get(keyOf('btc', tx('4'), 0))!.reviewReason, 'payer_mismatch')
  assert.equal(store.rows.get(keyOf('dog', tx('2'), 1))!.reviewReason, 'amount_mismatch')
  assert.equal(store.owned.size, 0)
  // banco que falha ao gravar: conta erro, segue
  bad.saveRow = async () => { throw new Error('db down') }
  const r2 = await sweepCars({ nowMs: T0 + H, funds: FUNDS, btc: { tip: 900_010, payments: [chainBtc({ payerAddresses: [OTHER], amount: 1 }), chainBtc({ txid: tx('5') })], firstSeenMs: new Map() }, dog: null, store: bad })
  assert.equal(r2.errors, 2)
  // ponta inválida: a volta falha inteira (nada de confirmações inventadas)
  await assert.rejects(sweepCars({ nowMs: T0, funds: FUNDS, btc: { tip: NaN, payments: [chainBtc()], firstSeenMs: new Map() }, dog: null, store }))
})

// ═══ isolamento da licença ══════════════════════════════════════════════════

test('o carro nunca toca a licença: nenhum arquivo do carro lê as tabelas da licença, o livro ou o bloco B', () => {
  const root = process.cwd()
  const files = [
    ...readdirSync(join(root, 'lib/game/cars')).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts')).map((f) => join(root, 'lib/game/cars', f)),
    join(root, 'app/api/dogcity/car-quote/route.ts'),
    join(root, 'app/api/dogcity/cars/route.ts'),
    join(root, 'app/api/cron/car-pay/route.ts'),
    join(root, 'supabase/migrations/039_dogcity_cars.sql'),
  ]
  for (const f of files) {
    const src = readFileSync(f, 'utf8')
    for (const proibido of ['dogcity_licence_quotes', 'dogcity_btc_payments', 'dogcity_lot_licence', 'dogcity_licence_assignment', 'founders-ledger', 'mint-b', 'licence-wallet', 'licence-lot']) {
      // a 039 cita as tabelas da licença só no comentário que diz que não as toca
      const code = f.endsWith('.sql') ? src.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n') : src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')
      assert.equal(code.includes(proibido), false, `${f} cita ${proibido}`)
    }
  }
  // e a licença não sabe do carro
  for (const f of ['lib/dog/licence-btc.ts', 'lib/dog/licence-btc-sweep.ts', 'lib/dog/founders-ledger.ts', 'lib/dog/mint-b.ts', 'lib/dog/licence-wallet.ts']) {
    const src = readFileSync(join(root, f), 'utf8')
    assert.equal(/car_(orders|payments|ownership|models)|CAR_FUND_/.test(src), false, f)
  }
})

test('preços do fundador (13/11): topo 250.000 $DOG nos dois supercarros, 10.000 nos Fuscas', () => {
  assert.equal(CAR_MODELS.c02.priceDog, 250_000)
  assert.equal(CAR_MODELS.c05.priceDog, 250_000)
  assert.equal(CAR_MODELS.c52.priceDog, 10_000)
  assert.equal(CAR_MODELS.c56.priceDog, 10_000)
  const precos = CAR_MODEL_IDS.map((id) => CAR_MODELS[id].priceDog)
  assert.equal(Math.max(...precos), 250_000)
  assert.equal(Math.min(...precos), 10_000)
})
