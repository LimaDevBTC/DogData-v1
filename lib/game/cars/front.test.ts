// Run: npx tsx --test lib/game/cars/front.test.ts
//
// A JANELA DE COMPRA dos carros (o modo "car" de components/donate/donate-modal.tsx), com dado SIMULADO. UM TESTE POR
// ATAQUE no que a tela aceita do servidor: pedido de outro modelo, de outra moeda, com outro pagador, com o endereço
// do fundo da licença, sats tortos, valor $DOG sem sufixo ou com o texto diferente dos átomos, prazo longo demais.
// Mais: a segunda declaração do endereço que recebe (vazia = nada na tela) e o estado do pedido depois do envio.
import test from 'node:test'
import assert from 'node:assert/strict'
import { FUND_BTC_ADDRESS, FUND_DOG_ADDRESS } from '@/lib/dog/licence-btc'
import { atomsPretty, atomsText, orderErrorText, parseCarOrder } from './order-view'
import { CAR_PAY_TO_ENDS, payToConfirmed } from './pay-to'
import { checkTx, mostFinal, orderStatus, type TxCheck } from './order-status'

const WALLET = 'bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297'
const PAYER = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'
const CAR_BTC = 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'
const CAR_DOG = 'bc1pmzfrwwndsqmk5yh69yjr5lfgfg4ev8c0tsc06e'
const T0 = Date.parse('2026-11-20T12:00:00.000Z')
const iso = (ms: number) => new Date(ms).toISOString()

const btcOrder = (over: Record<string, unknown> = {}) => ({
  id: '3f2b8c1e-9a4d-4f6b-8e2a-1c5d7e9f0a1b', model: 'c41', name: 'DOG Surge IV', currency: 'btc', priceDog: 120_000,
  payTo: CAR_BTC, payerAddress: PAYER, expiresAt: iso(T0 + 15 * 60_000), serverTime: iso(T0),
  sats: 287_654, dogUsd: 0.0021, btcUsd: 98_000, sources: [{ name: 'DOG/USD kraken', price: 0.0021 }, { name: 'BTC/USD coinbase', price: 98_000 }],
  ...over,
})
const dogOrder = (over: Record<string, unknown> = {}) => ({
  id: '7a1c2e3f-4b5d-4c6e-8f70-91a2b3c4d5e6', model: 'c52', name: 'DOG Bug', currency: 'dog', priceDog: 20_000,
  payTo: CAR_DOG, payerAddress: WALLET, expiresAt: iso(T0 + 60 * 60_000), serverTime: iso(T0),
  dogExact: '20000.04217', dogExactAtoms: 2_000_004_217,
  ...over,
})
const expBtc = { model: 'c41', currency: 'btc' as const, payerAddress: PAYER, priceDog: 120_000 }
const expDog = { model: 'c52', currency: 'dog' as const, payerAddress: WALLET, priceDog: 20_000 }

test('o pedido certo passa, em BTC e em $DOG', () => {
  const b = parseCarOrder(btcOrder(), expBtc)
  assert.ok(b.ok)
  if (b.ok) {
    assert.equal(b.order.sats, 287_654)
    assert.equal(b.order.dogExact, null)
    assert.deepEqual(b.order.sources, ['kraken', 'coinbase'])
  }
  const d = parseCarOrder(dogOrder(), expDog)
  assert.ok(d.ok)
  if (d.ok) {
    assert.equal(d.order.dogExactAtoms, 2_000_004_217)
    assert.equal(d.order.sats, null)
  }
})

test('ataque: pedido de OUTRO modelo, outra moeda ou com o nome trocado', () => {
  assert.equal(parseCarOrder(btcOrder({ model: 'c02', name: 'DOG Centurion' }), expBtc).ok, false)
  assert.equal(parseCarOrder(btcOrder({ currency: 'dog' }), expBtc).ok, false)
  assert.equal(parseCarOrder(btcOrder({ name: 'Supra' }), expBtc).ok, false)
  assert.equal(parseCarOrder(btcOrder({ model: '__proto__' }), { ...expBtc, model: '__proto__' }).ok, false)
})

test('ataque: o preço mudou entre o cartão e o pedido', () => {
  assert.equal(parseCarOrder(btcOrder({ priceDog: 130_000 }), expBtc).ok, false)
  assert.equal(parseCarOrder(btcOrder({ priceDog: Number.POSITIVE_INFINITY }), { ...expBtc, priceDog: null }).ok, false)
})

test('ataque: endereço pagador trocado (o pagamento não casaria e a tela mandaria pagar de outro lugar)', () => {
  assert.equal(parseCarOrder(btcOrder({ payerAddress: WALLET }), expBtc).ok, false)
  assert.equal(parseCarOrder(dogOrder({ payerAddress: PAYER }), expDog).ok, false)
})

test('ataque: o endereço que recebe é o do fundo da LICENÇA, o próprio pagador ou não é de mainnet', () => {
  assert.equal(parseCarOrder(btcOrder({ payTo: FUND_BTC_ADDRESS }), expBtc).ok, false)
  assert.equal(parseCarOrder(dogOrder({ payTo: FUND_DOG_ADDRESS }), expDog).ok, false)
  assert.equal(parseCarOrder(btcOrder({ payTo: PAYER }), expBtc).ok, false)
  assert.equal(parseCarOrder(btcOrder({ payTo: 'tb1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' }), expBtc).ok, false)
})

test('ataque: sats tortos (NaN, Infinity, negativo, fração, abaixo do piso, acima do teto)', () => {
  for (const sats of [Number.NaN, Number.POSITIVE_INFINITY, -1, 1234.5, 999, 50_000_001, '287654', null]) {
    assert.equal(parseCarOrder(btcOrder({ sats }), expBtc).ok, false, `sats ${String(sats)}`)
  }
})

test('ataque: valor $DOG sem sufixo, com sufixo de 1 $DOG, texto diferente dos átomos, ou com sats junto', () => {
  assert.equal(parseCarOrder(dogOrder({ dogExactAtoms: 2_000_000_000, dogExact: '20000.00000' }), expDog).ok, false)
  assert.equal(parseCarOrder(dogOrder({ dogExactAtoms: 2_000_100_000, dogExact: '20001.00000' }), expDog).ok, false)
  assert.equal(parseCarOrder(dogOrder({ dogExact: '20000.04218' }), expDog).ok, false)
  assert.equal(parseCarOrder(dogOrder({ dogExact: 20000.04217 }), expDog).ok, false)
  assert.equal(parseCarOrder(dogOrder({ dogExactAtoms: 2_000_004_217.5 }), expDog).ok, false)
  assert.equal(parseCarOrder(dogOrder({ sats: 1000 }), expDog).ok, false)
  assert.equal(parseCarOrder(btcOrder({ dogExactAtoms: 1 }), expBtc).ok, false)
})

test('ataque: prazo vencido na resposta, ou mais longo que a trava da moeda', () => {
  assert.equal(parseCarOrder(btcOrder({ expiresAt: iso(T0) }), expBtc).ok, false)
  assert.equal(parseCarOrder(btcOrder({ expiresAt: iso(T0 + 16 * 60_000) }), expBtc).ok, false)
  assert.equal(parseCarOrder(dogOrder({ expiresAt: iso(T0 + 61 * 60_000) }), expDog).ok, false)
  assert.equal(parseCarOrder(btcOrder({ expiresAt: 'soon' }), expBtc).ok, false)
  assert.equal(parseCarOrder(btcOrder({ id: 'abc' }), expBtc).ok, false)
})

test('o valor exato em texto nunca passa por ponto flutuante', () => {
  assert.equal(atomsText(2_000_004_217), '20000.04217')
  assert.equal(atomsText(1), '0.00001')
  assert.equal(atomsPretty(50_000_000_001), '500,000.00001')
  assert.equal(atomsText(-1), null)
  assert.equal(atomsText(0.5), null)
})

test('a segunda declaração do endereço: vazia não confirma nada; confirma só pontas e tamanho iguais', () => {
  // como vem no código (o fundador preenche quando cria os endereços): nada confirma
  if (!CAR_PAY_TO_ENDS.btc) assert.equal(payToConfirmed('btc', CAR_BTC), false)
  if (!CAR_PAY_TO_ENDS.dog) assert.equal(payToConfirmed('dog', CAR_DOG), false)
  const table = {
    btc: { start: CAR_BTC.slice(0, 10), end: CAR_BTC.slice(-7), length: CAR_BTC.length },
    dog: { start: CAR_DOG.slice(0, 10), end: CAR_DOG.slice(-7), length: CAR_DOG.length },
  }
  assert.equal(payToConfirmed('btc', CAR_BTC, table), true)
  assert.equal(payToConfirmed('btc', CAR_BTC.toUpperCase(), table), true)      // bech32 não tem caixa
  assert.equal(payToConfirmed('dog', CAR_DOG, table), true)
  assert.equal(payToConfirmed('btc', CAR_DOG, table), false)                   // a moeda errada
  assert.equal(payToConfirmed('btc', CAR_BTC.slice(0, -1) + 'x', table), false)
  assert.equal(payToConfirmed('btc', CAR_BTC + 'q', table), false)
  assert.equal(payToConfirmed('btc', 42, table), false)
  // pontas curtas demais não servem de conferência
  assert.equal(payToConfirmed('btc', CAR_BTC, { ...table, btc: { start: 'bc1', end: 'h', length: CAR_BTC.length } }), false)
})

test('o erro do servidor vira frase de tela, e nenhuma diz que algo foi cobrado', () => {
  assert.match(orderErrorText(401, 'unauthenticated'), /Sign in again/)
  assert.match(orderErrorText(409, 'already_owned'), /already has this car/)
  assert.match(orderErrorText(503, 'sales_closed'), /not open yet/)
  assert.match(orderErrorText(429, 'too many orders, try again later'), /Too many orders/)
  assert.match(orderErrorText(500, 'x'), /Nothing was charged/)
})

// ── o estado do pedido ──
const tx = (over: Partial<TxCheck> = {}): TxCheck => ({ found: true, toPayTo: 287_654, fromPayer: true, confirmed: false, confirmations: 0, ...over })
const base = { nowMs: T0 + 60_000, order: { currency: 'btc' as const, sats: 287_654, expiresAtMs: T0 + 15 * 60_000 }, credited: false, payment: null, tx: null, hasTxid: false }

test('a leitura da transação: valor ao endereço do pedido, pagador e confirmações pela ponta', () => {
  const raw = {
    txid: 'ab'.repeat(32),
    vin: [{ prevout: { scriptpubkey_address: PAYER.toUpperCase() } }],
    vout: [{ scriptpubkey_address: CAR_BTC, value: 200_000 }, { scriptpubkey_address: CAR_BTC, value: 87_654 }, { scriptpubkey_address: PAYER, value: 5 }],
    status: { confirmed: true, block_height: 900_000 },
  }
  assert.deepEqual(checkTx(raw, CAR_BTC, PAYER, 900_005), { found: true, toPayTo: 287_654, fromPayer: true, confirmed: true, confirmations: 6 })
  assert.equal(checkTx(raw, CAR_BTC, PAYER, null).confirmations, 0)
  assert.equal(checkTx(raw, CAR_DOG, PAYER, 900_005).toPayTo, 0)
  assert.equal(checkTx(raw, CAR_BTC, WALLET, 900_005).fromPayer, false)
  assert.equal(checkTx(null, CAR_BTC, PAYER, 1).found, false)
})

test('os estágios do pedido, do pedido à garagem', () => {
  assert.equal(orderStatus(base).stage, 'awaiting_payment')
  assert.equal(orderStatus({ ...base, nowMs: T0 + 16 * 60_000 }).stage, 'expired')
  assert.equal(orderStatus({ ...base, hasTxid: true }).stage, 'sent')
  assert.equal(orderStatus({ ...base, hasTxid: true, tx: tx() }).stage, 'in_mempool')
  const c = orderStatus({ ...base, hasTxid: true, tx: tx({ confirmed: true, confirmations: 3 }) })
  assert.equal(c.stage, 'confirming')
  assert.equal(c.confirmations, 3)
  assert.equal(c.needed, 6)
  assert.equal(orderStatus({ ...base, hasTxid: true, payment: { status: 'observed', reviewReason: null } }).stage, 'confirming')
  const r = orderStatus({ ...base, hasTxid: true, payment: { status: 'pending_review', reviewReason: 'underpaid' } })
  assert.deepEqual([r.stage, r.reason], ['in_review', 'underpaid'])
  assert.equal(orderStatus({ ...base, hasTxid: true, payment: { status: 'unmatched', reviewReason: null } }).stage, 'not_matched')
  // creditado para OUTRO pedido: este não recebe carro
  assert.equal(orderStatus({ ...base, hasTxid: true, payment: { status: 'credited', reviewReason: null } }).stage, 'not_matched')
  assert.equal(orderStatus({ ...base, credited: true, hasTxid: true, tx: tx({ toPayTo: 0 }) }).stage, 'delivered')
})

test('os avisos: destino errado, a menor, outro pagador (a tela grita, nunca diz "pago")', () => {
  assert.deepEqual(orderStatus({ ...base, hasTxid: true, tx: tx({ toPayTo: 0 }) }).warnings, ['wrong_destination'])
  assert.deepEqual(orderStatus({ ...base, hasTxid: true, tx: tx({ toPayTo: 287_653 }) }).warnings, ['underpaid'])
  assert.deepEqual(orderStatus({ ...base, hasTxid: true, tx: tx({ fromPayer: false }) }).warnings, ['other_payer'])
  // $DOG: os sats ao endereço são a poeira da saída das runas; o valor exato quem confere é a varredura
  assert.deepEqual(orderStatus({ ...base, order: { currency: 'dog', sats: null, expiresAtMs: base.order.expiresAtMs }, hasTxid: true, tx: tx({ toPayTo: 546 }) }).warnings, [])
  assert.deepEqual(orderStatus({ ...base, hasTxid: true, tx: { found: false, toPayTo: 0, fromPayer: false, confirmed: false, confirmations: 0 } }).warnings, [])
})

test('a linha mais final entre as saídas do mesmo txid', () => {
  assert.equal(mostFinal([{ status: 'observed' as const }, { status: 'pending_review' as const }, { status: 'unmatched' as const }])?.status, 'pending_review')
  assert.equal(mostFinal([]), null)
})
