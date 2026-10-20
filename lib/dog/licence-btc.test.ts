// Run: npx tsx --test lib/dog/licence-btc.test.ts
//
// Licença paga em BTC, com dado SIMULADO (preços e endereços inventados): mediana e recusa
// sem fontes, vencimento de 15 minutos, crédito dentro e fora da trava, soma DOG + BTC por
// carteira, tetos e valores inválidos (NaN, negativo, zero, Infinity), a varredura de ponta
// a ponta, e o teste que tranca a decisão 2 do fundador: BTC NÃO mexe em total_received
// nem no bloco B.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildLedger, type TxRow } from './founders-ledger'
import { detectB, GOAL_ATOMOS } from './mint-b'
import {
  BTC_MIN_CONFIRMATIONS, BTC_USD_BOUNDS, DOG_USD_BOUNDS, FUND_BTC_ADDRESS, FUND_DOG_ADDRESS, LICENCE_DOG,
  LINK_WINDOW_AFTER_EXPIRY_MS, MAX_BTC_CREDIT_DOG_PER_WALLET, MAX_CREDIT_DOG_PER_PAYMENT, MAX_PAYMENT_SATS,
  QUOTE_LOCK_MS, applyBtcCredits, buildQuote, combineWallet, dogForSats, licenceFor, matchQuote, medianPrice,
  msLeft, normalizeAddress, resolvePayment, satsForDog,
  type BtcPayment, type PriceAtBlock, type Quote,
} from './licence-btc'
import { spotMedians, priceAtTime, type FetchLike, type PriceSource } from './price-sources'
import { createQuote, MAX_QUOTES_PER_PAYMENT_PER_HOUR, type QuoteStore } from './licence-quote'
import { keyOf, paymentsFromTx, sweepOnce, type ChainPayment, type StoredPayment, type SweepStore } from './licence-btc-sweep'

const T0 = Date.UTC(2026, 9, 19, 12, 0, 0)
const MIN = 60_000
const ORD = 'bc1p' + 'a'.repeat(58)
const PAY = 'bc1q' + 'b'.repeat(38)
const OTHER_ORD = 'bc1p' + 'c'.repeat(58)
const DOG_USD = 0.0009
const BTC_USD = 80_000

const ok = (price: number) => ({ ok: true as const, price, sources: [{ name: 'A', price }, { name: 'B', price }] })
const sample = (...prices: number[]) => prices.map((price, i) => ({ name: `S${i}`, price }))

function quote(over: Partial<Quote> = {}): Quote {
  const built = buildQuote({ id: 'q1', tier: 'personal', ordinalsAddress: ORD, paymentAddress: PAY, dog: ok(DOG_USD), btc: ok(BTC_USD), nowMs: T0 })
  assert.equal(built.ok, true)
  return { ...(built as { quote: Quote }).quote, ...over }
}

function payment(over: Partial<BtcPayment> = {}): BtcPayment {
  return { txid: 'a'.repeat(64), vout: 0, sats: quote().sats, payerAddresses: [PAY], seenAtMs: T0 + 5 * MIN, confirmations: 6, blockTimeMs: T0 + 20 * MIN, ...over }
}

const noPrice = async (): Promise<PriceAtBlock | null> => { throw new Error('block price must not be asked inside the lock') }
const blockPrice = (dogUsd: number, btcUsd: number) => async (): Promise<PriceAtBlock | null> => ({ dogUsd, btcUsd })

// ── mediana e recusa ────────────────────────────────────────────────────────

test('median of three sources', () => {
  const r = medianPrice(sample(0.0009, 0.00091, 0.00092), DOG_USD_BOUNDS)
  assert.equal(r.ok, true)
  if (r.ok) { assert.equal(r.price, 0.00091); assert.equal(r.sources.length, 3) }
})

test('median of two sources is their mean', () => {
  const r = medianPrice(sample(100_000, 101_000), BTC_USD_BOUNDS)
  assert.equal(r.ok && r.price, 100_500)
})

test('refuses without enough independent sources: zero, one, or the same name twice', () => {
  for (const s of [[], sample(0.0009), [{ name: 'Kraken', price: 0.0009 }, { name: 'Kraken', price: 0.00091 }]]) {
    const r = medianPrice(s, DOG_USD_BOUNDS)
    assert.deepEqual(r, { ok: false, reason: 'not_enough_sources' })
  }
})

test('invalid samples never count: NaN, zero, negative, Infinity, text, out of bounds', () => {
  const junk = [NaN, 0, -1, Infinity, -Infinity, '0.0009x' as unknown as number, 1e9, 1e-12]
  const r = medianPrice([...junk.map((price, i) => ({ name: `J${i}`, price })), { name: 'Good', price: 0.0009 }], DOG_USD_BOUNDS)
  assert.deepEqual(r, { ok: false, reason: 'not_enough_sources' }) // only one valid source left
})

test('one wild source is dropped, the rest still quote', () => {
  const r = medianPrice(sample(0.0009, 0.00091, 0.0020), DOG_USD_BOUNDS)
  assert.equal(r.ok, true)
  if (r.ok) { assert.deepEqual(r.sources.map((s) => s.name), ['S0', 'S1']); assert.equal(r.price, 0.000905) }
})

test('sources that disagree too much refuse to quote', () => {
  assert.deepEqual(medianPrice(sample(0.0009, 0.0012), DOG_USD_BOUNDS), { ok: false, reason: 'sources_disagree' })
})

// ── fontes com rede simulada ────────────────────────────────────────────────

/** fetch de mentira: responde por pedaço da URL; o que não está na tabela falha. */
function fakeFetch(table: Record<string, unknown>): FetchLike {
  return async (url) => {
    const hit = Object.keys(table).find((k) => url.includes(k))
    if (!hit) return { ok: false, status: 500, json: async () => ({}) }
    return { ok: true, status: 200, json: async () => table[hit] }
  }
}
const SPOT = {
  'Ticker?pair=DOGUSD': { error: [], result: { DOGUSD: { c: ['0.000900', '1'] } } },
  'DOG_USDT': [{ last: '0.000902' }],
  'symbol=DOGUSDT': { price: '0.000898' },
  'Ticker?pair=XBTUSD': { error: [], result: { XXBTZUSD: { c: ['80000.0', '1'] } } },
  'BTC-USD/ticker': { price: '80100.5' },
  'btcusd': { last: '79950.2' },
}

test('spot medians from the real source list, with recorded answers', async () => {
  const m = await spotMedians(fakeFetch(SPOT))
  assert.equal(m.dog.ok && m.dog.price, 0.0009)
  assert.equal(m.btc.ok && m.btc.price, 80000)
})

test('no exchange answers: both medians refuse, nothing is quoted', async () => {
  const m = await spotMedians(fakeFetch({}))
  assert.deepEqual(m.dog, { ok: false, reason: 'not_enough_sources' })
  assert.deepEqual(m.btc, { ok: false, reason: 'not_enough_sources' })
})

test('only one exchange answers: still refuses', async () => {
  const m = await spotMedians(fakeFetch({ 'Ticker?pair=DOGUSD': SPOT['Ticker?pair=DOGUSD'], 'Ticker?pair=XBTUSD': SPOT['Ticker?pair=XBTUSD'] }))
  assert.equal(m.dog.ok, false)
  assert.equal(m.btc.ok, false)
})

test('price at a block time uses the candle of that minute and nothing else', async () => {
  const ts = Math.floor((T0 + 20 * MIN) / 1000)
  const m = ts - (ts % 60)
  const px = await priceAtTime(fakeFetch({
    'api.kraken.com/0/public/OHLC?pair=DOGUSD': { error: [], result: { DOGUSD: [[m, '0.000900', '1', '1', '1', '1', '1', 1]], last: m } },
    'DOG_USDT': [[String(m), '1', '1', '1', '1', '0.000901', '1', 'true']],
    'api.kraken.com/0/public/OHLC?pair=XBTUSD': { error: [], result: { XXBTZUSD: [[m, '80000', '1', '1', '1', '1', '1', 1]], last: m } },
    'BTC-USD/candles': [[m, 1, 1, 80_200, 1, 1]],
  }), T0 + 20 * MIN)
  assert.ok(px)
  assert.equal(px.dogUsd, 0.0009005)
  assert.equal(px.btcUsd, 80_100)
  // thin market: no trade in that minute, so the last candle BEFORE it counts (its close)
  const thin = await priceAtTime(fakeFetch({
    'api.kraken.com/0/public/OHLC?pair=DOGUSD': { error: [], result: { DOGUSD: [[m - 300, '0.000800', '1', '1', '0.000903', '1', '1', 1]] } },
    'DOG_USDT': [[String(m - 120), '1', '0.000905', '1', '1', '0.000800', '1', 'true']],
    'api.kraken.com/0/public/OHLC?pair=XBTUSD': { error: [], result: { XXBTZUSD: [[m, '80000', '1', '1', '1', '1', '1', 1]] } },
    'BTC-USD/candles': [[m, 1, 1, 80_000, 1, 1]],
  }), T0 + 20 * MIN)
  assert.ok(thin && Math.abs(thin.dogUsd - 0.000904) < 1e-12 && thin.btcUsd === 80_000)
  // a candle AFTER the block, or older than 30 minutes, never counts: with no source left it refuses
  const wrong = await priceAtTime(fakeFetch({
    'api.kraken.com/0/public/OHLC?pair=DOGUSD': { error: [], result: { DOGUSD: [[m + 60, '0.000900', '1', '1', '0.000900', '1', '1', 1]] } },
    'DOG_USDT': [[String(m - 3600), '1', '0.000905', '1', '1', '0.000800', '1', 'true']],
    'api.kraken.com/0/public/OHLC?pair=XBTUSD': { error: [], result: { XXBTZUSD: [[m, '80000', '1', '1', '1', '1', '1', 1]] } },
  }), T0 + 20 * MIN)
  assert.equal(wrong, null)
  assert.equal(await priceAtTime(fakeFetch({}), NaN), null)
})

// ── cotação e vencimento de 15 minutos ──────────────────────────────────────

test('sats round UP, so paying the quote never falls under the rung', () => {
  const q = quote()
  assert.ok(q.sats >= (10_000 * DOG_USD * 1e8) / BTC_USD)
  assert.ok(q.sats - (10_000 * DOG_USD * 1e8) / BTC_USD < 1)
  assert.equal(satsForDog(50_000, DOG_USD, BTC_USD), Math.ceil((50_000 * DOG_USD * 1e8) / BTC_USD))
  assert.equal(quote().dogAmount, LICENCE_DOG.personal)
})

test('the quote holds for exactly 15 minutes', () => {
  const q = quote()
  assert.equal(q.expiresAtMs - q.createdAtMs, QUOTE_LOCK_MS)
  assert.equal(QUOTE_LOCK_MS, 15 * MIN)
  assert.equal(msLeft(q, T0), 15 * MIN)
  assert.equal(msLeft(q, T0 + 14 * MIN + 59_000), 1_000)
  assert.equal(msLeft(q, T0 + 15 * MIN), 0)
  assert.equal(msLeft(q, T0 + 16 * MIN), 0)
})

test('no quote when a median was refused, or the input is bad', () => {
  const refused = { ok: false as const, reason: 'not_enough_sources' as const }
  const base = { id: 'x', ordinalsAddress: ORD, paymentAddress: PAY, nowMs: T0 }
  assert.deepEqual(buildQuote({ ...base, tier: 'personal', dog: refused, btc: ok(BTC_USD) }), { ok: false, reason: 'not_enough_sources' })
  assert.deepEqual(buildQuote({ ...base, tier: 'personal', dog: ok(DOG_USD), btc: refused }), { ok: false, reason: 'not_enough_sources' })
  assert.deepEqual(buildQuote({ ...base, tier: 'gold', dog: ok(DOG_USD), btc: ok(BTC_USD) }), { ok: false, reason: 'bad_input' })
  assert.deepEqual(buildQuote({ ...base, tier: 'personal', dog: ok(DOG_USD), btc: ok(BTC_USD), nowMs: NaN }), { ok: false, reason: 'bad_input' })
  // a price that makes the sats absurd (above 1 BTC) is refused, not clamped
  assert.deepEqual(buildQuote({ ...base, tier: 'patron', dog: ok(90), btc: ok(1_000) }), { ok: false, reason: 'bad_price' })
})

function memStore(count = 0) {
  const inserted: Quote[] = []
  const store: QuoteStore = {
    countSince: async () => count,
    insert: async (q) => { inserted.push(q) },
  }
  return { store, inserted }
}
const good = async () => ({ dog: ok(DOG_USD), btc: ok(BTC_USD) })

test('createQuote: saves the link payment address -> ordinals address and answers sats and expiry', async () => {
  const { store, inserted } = memStore()
  const r = await createQuote({ store, medians: good, nowMs: T0, newId: () => 'id-1' }, { tier: 'personal', ordinalsAddress: ORD.toUpperCase(), paymentAddress: PAY })
  assert.equal(r.ok, true)
  assert.equal(inserted.length, 1)
  assert.equal(inserted[0].ordinalsAddress, ORD)
  assert.equal(inserted[0].paymentAddress, PAY)
  if (r.ok) {
    assert.equal(r.quote.sats, inserted[0].sats)
    assert.equal(r.quote.expiresAt, new Date(T0 + 15 * MIN).toISOString())
    assert.equal(r.quote.payTo, FUND_BTC_ADDRESS)
    assert.ok(r.quote.sources.length >= 4)
  }
})

test('createQuote: no reliable sources means 503 and nothing is saved', async () => {
  const { store, inserted } = memStore()
  const none = async () => ({ dog: { ok: false as const, reason: 'not_enough_sources' as const }, btc: ok(BTC_USD) })
  const r = await createQuote({ store, medians: none, nowMs: T0, newId: () => 'x' }, { tier: 'personal', ordinalsAddress: ORD, paymentAddress: PAY })
  assert.deepEqual([r.ok, r.status], [false, 503])
  const boom = async () => { throw new Error('network') }
  const r2 = await createQuote({ store, medians: boom, nowMs: T0, newId: () => 'x' }, { tier: 'personal', ordinalsAddress: ORD, paymentAddress: PAY })
  assert.deepEqual([r2.ok, r2.status], [false, 503])
  assert.equal(inserted.length, 0)
})

test('createQuote: bad input, fund address as wallet, flood, and a failed write all refuse', async () => {
  const run = (body: unknown, store = memStore().store) => createQuote({ store, medians: good, nowMs: T0, newId: () => 'x' }, body)
  for (const body of [null, {}, { tier: 'gold', ordinalsAddress: ORD, paymentAddress: PAY }, { tier: 'personal', ordinalsAddress: 'nope', paymentAddress: PAY },
    { tier: 'personal', ordinalsAddress: ORD, paymentAddress: 42 }, { tier: 'personal', ordinalsAddress: FUND_BTC_ADDRESS, paymentAddress: PAY },
    { tier: 'personal', ordinalsAddress: ORD, paymentAddress: FUND_DOG_ADDRESS }]) {
    assert.equal((await run(body)).status, 400, JSON.stringify(body))
  }
  const flood = await run({ tier: 'personal', ordinalsAddress: ORD, paymentAddress: PAY }, memStore(MAX_QUOTES_PER_PAYMENT_PER_HOUR).store)
  assert.equal(flood.status, 429)
  const broken: QuoteStore = { countSince: async () => 0, insert: async () => { throw new Error('db down') } }
  assert.equal((await run({ tier: 'personal', ordinalsAddress: ORD, paymentAddress: PAY }, broken)).status, 503)
})

// ── crédito dentro e fora da trava ──────────────────────────────────────────

test('paid inside the lock: credited at the locked rate, and the exact quoted sats reach the rung', async () => {
  const q = quote()
  const r = await resolvePayment(payment({ sats: q.sats }), [q], noPrice)
  assert.equal(r.status, 'credited')
  if (r.status === 'credited') {
    assert.equal(r.basis, 'quote')
    assert.equal(r.ordinalsAddress, ORD)
    assert.equal(r.quoteId, 'q1')
    assert.ok(r.creditDog >= 10_000, `credited ${r.creditDog}`)
    assert.equal(licenceFor(r.creditDog), 'personal')
  }
})

test('paid more than the quote inside the lock: the credit follows the sats, at the locked rate', async () => {
  const q = quote()
  const r = await resolvePayment(payment({ sats: q.sats * 5 }), [q], noPrice)
  assert.equal(r.status === 'credited' && licenceFor(r.creditDog), 'commercial')
})

test('the lock edge: seen at 15:00 still locked, one ms later it is block priced', async () => {
  const q = quote()
  const edge = await resolvePayment(payment({ seenAtMs: q.expiresAtMs, blockTimeMs: q.expiresAtMs + 30 * MIN }), [q], noPrice)
  assert.equal(edge.status === 'credited' && edge.basis, 'quote')
  const late = await resolvePayment(payment({ seenAtMs: q.expiresAtMs + 1, blockTimeMs: q.expiresAtMs + 30 * MIN }), [q], blockPrice(0.0010, 100_000))
  assert.equal(late.status === 'credited' && late.basis, 'block')
})

test('paid after the lock: credited at the block rate, not the quote rate', async () => {
  const q = quote()
  const sats = q.sats
  const r = await resolvePayment(payment({ sats, seenAtMs: T0 + 40 * MIN, blockTimeMs: T0 + 45 * MIN }), [q], blockPrice(0.0006, 80_000))
  assert.equal(r.status, 'credited')
  if (r.status === 'credited') {
    assert.equal(r.basis, 'block')
    assert.equal(r.dogUsd, 0.0006)
    // DOG fell from 0.0009 to 0.0006: the same sats are worth MORE DOG now
    assert.equal(r.creditDog, dogForSats(sats, 0.0006, 80_000))
    assert.ok(r.creditDog > 10_000)
  }
  const up = await resolvePayment(payment({ sats, seenAtMs: T0 + 40 * MIN, blockTimeMs: T0 + 45 * MIN }), [q], blockPrice(0.0012, 80_000))
  assert.equal(up.status === 'credited' && up.creditDog < 10_000, true) // DOG rose: fewer DOG, so the rung is NOT reached
  assert.equal(up.status === 'credited' && licenceFor(up.creditDog), 'citizen')
})

test('seen in the mempool inside the lock but confirmed after it: still the quote rate', async () => {
  const q = quote()
  const r = await resolvePayment(payment({ seenAtMs: T0 + 10 * MIN, blockTimeMs: T0 + 90 * MIN }), [q], noPrice)
  assert.equal(r.status === 'credited' && r.basis, 'quote')
})

test('first seen late by the sweep but the block was timestamped inside the lock: the lock holds', async () => {
  const q = quote()
  const r = await resolvePayment(payment({ seenAtMs: T0 + 60 * MIN, blockTimeMs: T0 + 12 * MIN }), [q], noPrice)
  assert.equal(r.status === 'credited' && r.basis, 'quote')
})

test('no reliable block price: pending review (retries by itself), never a licence', async () => {
  const q = quote()
  const late = payment({ seenAtMs: T0 + 40 * MIN, blockTimeMs: T0 + 45 * MIN })
  for (const px of [null, { dogUsd: NaN, btcUsd: 80_000 }, { dogUsd: 0, btcUsd: 80_000 }, { dogUsd: 0.0009, btcUsd: -5 },
    { dogUsd: Infinity, btcUsd: 80_000 }, { dogUsd: 0.0009, btcUsd: Infinity }, { dogUsd: 1e9, btcUsd: 80_000 }]) {
    const r = await resolvePayment(late, [q], async () => px as PriceAtBlock | null)
    assert.deepEqual(r, { status: 'pending_review', reason: 'price_unavailable', retry: true }, JSON.stringify(px))
  }
  const boom = await resolvePayment(late, [q], async () => { throw new Error('exchange down') })
  assert.equal(boom.status, 'pending_review')
  const noBlock = await resolvePayment({ ...late, blockTimeMs: null }, [q], blockPrice(0.0009, 80_000))
  assert.equal(noBlock.status, 'pending_review')
})

test('waits for confirmations before anything is credited', async () => {
  const q = quote()
  for (let c = 0; c < BTC_MIN_CONFIRMATIONS; c++) {
    assert.deepEqual(await resolvePayment(payment({ confirmations: c }), [q], noPrice), { status: 'observed', reason: 'confirmations' })
  }
  assert.equal((await resolvePayment(payment({ confirmations: NaN }), [q], noPrice)).status, 'observed')
})

test('underpaid inside the lock: pending review, not credited, not silently block priced', async () => {
  const q = quote()
  const r = await resolvePayment(payment({ sats: q.sats - 1 }), [q], noPrice)
  assert.deepEqual(r, { status: 'pending_review', reason: 'underpaid_for_quote', retry: false })
})

test('no quote links the payer: general support, never a licence', async () => {
  assert.deepEqual(await resolvePayment(payment({ payerAddresses: ['bc1q' + 'z'.repeat(38)] }), [quote()], noPrice), { status: 'unmatched', reason: 'no_quote' })
  assert.deepEqual(await resolvePayment(payment(), [], noPrice), { status: 'unmatched', reason: 'no_quote' })
})

test('a payment that was seen BEFORE the quote existed is not linked to it', async () => {
  assert.equal((await resolvePayment(payment({ seenAtMs: T0 - 1, blockTimeMs: T0 + 10 * MIN }), [quote()], noPrice)).status, 'unmatched')
})

test('a quote links a late payment only for two hours after it expires', async () => {
  const q = quote()
  const inside = await resolvePayment(payment({ seenAtMs: q.expiresAtMs + LINK_WINDOW_AFTER_EXPIRY_MS, blockTimeMs: q.expiresAtMs + LINK_WINDOW_AFTER_EXPIRY_MS + MIN }), [q], blockPrice(0.0009, 80_000))
  assert.equal(inside.status, 'credited')
  const outside = await resolvePayment(payment({ seenAtMs: q.expiresAtMs + LINK_WINDOW_AFTER_EXPIRY_MS + 1, blockTimeMs: q.expiresAtMs + LINK_WINDOW_AFTER_EXPIRY_MS + MIN }), [q], blockPrice(0.0009, 80_000))
  assert.deepEqual(outside, { status: 'unmatched', reason: 'no_quote' })
})

test('two ordinals wallets linked to the same payer: nobody is guessed, a human decides', async () => {
  const a = quote(), b = quote({ id: 'q2', ordinalsAddress: OTHER_ORD })
  assert.deepEqual(await resolvePayment(payment(), [a, b], noPrice), { status: 'pending_review', reason: 'ambiguous_owner', retry: false })
})

test('the fund as payer (change, internal move) is never a licence payment', async () => {
  for (const f of [FUND_BTC_ADDRESS, FUND_DOG_ADDRESS]) {
    assert.deepEqual(await resolvePayment(payment({ payerAddresses: [PAY, f] }), [quote()], noPrice), { status: 'unmatched', reason: 'fund_is_payer' })
  }
})

test('absolute ceilings: above them nothing is credited and nothing is truncated', async () => {
  const q = quote()
  const huge = await resolvePayment(payment({ sats: MAX_PAYMENT_SATS + 1 }), [q], noPrice)
  assert.deepEqual(huge, { status: 'pending_review', reason: 'above_ceiling', retry: false })
  // a cheap DOG makes a legal amount of sats worth more DOG than the per-payment ceiling
  const cheap = quote({ dogUsd: 0.000001, btcUsd: 100_000, sats: 1_000 })
  const r = await resolvePayment(payment({ sats: 50_000_000 }), [cheap], noPrice)
  assert.deepEqual(r, { status: 'pending_review', reason: 'above_ceiling', retry: false })
  assert.ok((50_000_000 / 1e8) * 100_000 / 0.000001 > MAX_CREDIT_DOG_PER_PAYMENT)
})

test('invalid amounts: NaN, negative, zero, Infinity, fractional, unsafe', async () => {
  const q = quote()
  for (const sats of [NaN, -1, 0, Infinity, -Infinity, 1.5, Number.MAX_SAFE_INTEGER + 2]) {
    const r = await resolvePayment(payment({ sats }), [q], noPrice)
    assert.equal(r.status, 'pending_review', String(sats))
    assert.equal(r.status === 'pending_review' && r.reason, 'invalid_amount', String(sats))
  }
  assert.equal((await resolvePayment(payment({ seenAtMs: NaN }), [q], noPrice)).status, 'pending_review')
  assert.deepEqual(await resolvePayment(payment({ sats: 999 }), [q], noPrice), { status: 'unmatched', reason: 'dust' })
})

test('a stored quote with garbage numbers cannot credit', async () => {
  for (const bad of [{ dogUsd: NaN }, { dogUsd: 0 }, { btcUsd: -1 }, { btcUsd: Infinity }, { dogUsd: Infinity }]) {
    const r = await resolvePayment(payment(), [quote(bad as Partial<Quote>)], noPrice)
    assert.equal(r.status, 'pending_review', JSON.stringify(bad))
  }
})

test('helpers refuse invalid numbers', () => {
  for (const bad of [NaN, -1, 0, Infinity]) {
    assert.equal(satsForDog(bad, DOG_USD, BTC_USD), null)
    assert.equal(satsForDog(10_000, bad, BTC_USD), null)
    assert.equal(satsForDog(10_000, DOG_USD, bad), null)
    assert.equal(dogForSats(bad, DOG_USD, BTC_USD), null)
    assert.equal(dogForSats(1_000, bad, BTC_USD), null)
    assert.equal(dogForSats(1_000, DOG_USD, bad), null)
    assert.equal(licenceFor(bad), 'citizen')
  }
  assert.equal(normalizeAddress('  BC1Q' + 'B'.repeat(38) + ' '), PAY)
  assert.equal(normalizeAddress(7), null)
  assert.equal(normalizeAddress('bc1q'), null)
})

test('matchQuote picks the latest covering quote when several are open', () => {
  const a = quote({ id: 'old', createdAtMs: T0 - 5 * MIN, expiresAtMs: T0 + 10 * MIN, sats: 5_000 })
  const b = quote({ id: 'new', createdAtMs: T0, expiresAtMs: T0 + 15 * MIN })
  const m = matchQuote(payment({ sats: 50_000 }), [a, b])
  assert.equal(m.kind === 'quote' && m.quote.id, 'new')
})

// ── soma DOG + BTC por carteira ─────────────────────────────────────────────

test('a wallet adds DOG and BTC (in DOG) to reach the rung', () => {
  assert.equal(licenceFor(combineWallet(6_000, 4_000)), 'personal')
  assert.equal(licenceFor(combineWallet(6_000, 3_999.99999)), 'citizen')
  assert.equal(licenceFor(combineWallet(0, 50_000)), 'commercial')
  assert.equal(licenceFor(combineWallet(450_000, 50_000)), 'patron')
  assert.equal(combineWallet(1_000, 0), 1_000)
})

test('combineWallet ignores NaN, negative and Infinity, and caps the BTC part per wallet', () => {
  assert.equal(combineWallet(NaN, 5_000), 5_000)
  assert.equal(combineWallet(1_000, NaN), 1_000)
  assert.equal(combineWallet(1_000, -50_000), 1_000)
  assert.equal(combineWallet(-1_000, 2_000), 2_000)
  assert.equal(combineWallet(1_000, Infinity), 1_000)
  assert.equal(combineWallet(0, 9_999_999_999), MAX_BTC_CREDIT_DOG_PER_WALLET)
})

const entry = (address: string, total: number, license = 'citizen') => ({ address, total, license, rank: 1, txCount: 1, lastTx: 't' })

test('applyBtcCredits: DOG 6,000 + BTC worth 4,000 DOG is a Personal licence, in either case of the address', () => {
  const r = applyBtcCredits([entry(ORD, 6_000)], [{ ordinalsAddress: ORD.toUpperCase(), creditDog: 1_500 }, { ordinalsAddress: ORD, creditDog: 2_500 }])
  assert.equal(r.entries[0].license, 'personal')
  assert.equal(r.entries[0].btc_dog, 4_000)
  assert.equal(r.entries[0].licence_total, 10_000)
  assert.equal(r.entries[0].total, 6_000) // the DOG total is untouched
  assert.deepEqual(r.btcOnly, [])
})

test('applyBtcCredits: a wallet with only BTC is listed apart, outside the fund board', () => {
  const r = applyBtcCredits([entry(OTHER_ORD, 100)], [{ ordinalsAddress: ORD, creditDog: 10_000 }])
  assert.equal(r.entries.length, 1)
  assert.equal(r.entries[0].license, 'citizen')
  assert.deepEqual(r.btcOnly, [{ address: ORD, btc_dog: 10_000, licence_total: 10_000, license: 'personal' }])
})

test('applyBtcCredits drops invalid credits and keeps the DOG license when there is no BTC', () => {
  const r = applyBtcCredits([entry(ORD, 12_000, 'personal')], [
    { ordinalsAddress: ORD, creditDog: NaN }, { ordinalsAddress: ORD, creditDog: -9_000 }, { ordinalsAddress: ORD, creditDog: Infinity },
    { ordinalsAddress: '', creditDog: 5 }, { ordinalsAddress: ORD, creditDog: 0 },
  ])
  assert.equal(r.entries[0].btc_dog, 0)
  assert.equal(r.entries[0].license, 'personal')
  assert.deepEqual(r.btcOnly, [])
})

// ── a decisão 2: BTC não mexe no fundo nem em B ─────────────────────────────

const W = FUND_DOG_ADDRESS
const sender = 'bc1p' + 'd'.repeat(58)
const dogRow = (id: number, block: number, dog: number): TxRow => ({
  id, txid: String(id).padStart(64, '0'), block_height: block, timestamp: `2026-09-0${(id % 9) + 1}T00:00:00Z`,
  senders: [{ address: sender, amount: dog * 100_000 }],
  receivers: [{ address: W, amount: dog * 100_000 }],
})

test('BTC credits never change total_received, the contributions, or B', () => {
  const rows = [dogRow(1, 900_000, 4_000_000), dogRow(2, 900_010, 5_900_000)] // 9.9M: B not reached
  const before = buildLedger(rows, W, { licenseFor: licenceFor })
  const contribsBefore = JSON.stringify(before.contributions, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))
  const bBefore = detectB(before.contributions)
  assert.equal(bBefore.found, null)

  // a flood of BTC credit, enough in DOG terms to cross 10M several times over
  const credits = Array.from({ length: 50 }, (_, i) => ({ ordinalsAddress: i % 2 ? sender : OTHER_ORD, creditDog: MAX_CREDIT_DOG_PER_PAYMENT }))
  const board = applyBtcCredits(before.leaderboard, credits)

  const after = buildLedger(rows, W, { licenseFor: licenceFor })
  assert.equal(after.totalAtomos, before.totalAtomos)
  assert.equal(after.totalReceived, before.totalReceived)
  assert.equal(after.totalReceived, 9_900_000)
  assert.equal(JSON.stringify(after.contributions, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)), contribsBefore)
  assert.deepEqual(detectB(after.contributions), bBefore)
  assert.equal(detectB(after.contributions).found, null)
  assert.ok(detectB(after.contributions).totalAtomos < GOAL_ATOMOS)
  // while the wallet DOES move up the licence ladder
  assert.equal(board.entries[0].total, 9_900_000) // the fund total of the wallet is DOG only
  assert.equal(board.entries[0].btc_dog, MAX_BTC_CREDIT_DOG_PER_WALLET)
  assert.equal(board.entries[0].license, 'patron')
})

test('a wallet that paid only in BTC gets no Founder number; BTC on top of $DOG keeps the DOG Founder number', () => {
  const rows = [dogRow(1, 900_000, 600)] // `sender` puts 600 $DOG in the fund: Founder #1, Citizen
  const ledger = buildLedger(rows, W, { licenseFor: licenceFor })
  assert.equal(ledger.founders.length, 1)
  assert.equal(ledger.founders[0].address, sender)
  assert.equal(ledger.founders[0].founder_seq, 1)

  const credits = [
    { ordinalsAddress: OTHER_ORD, creditDog: 500_000 }, // BTC only, enough for Patron
    { ordinalsAddress: sender, creditDog: 9_400 }, // BTC on top of 600 $DOG: Personal
  ]
  const founders = applyBtcCredits(ledger.founders.map(({ totalAtomos: _t, ...f }) => f), credits)
  // the Founder list is the DOG ledger alone: the BTC-only wallet is not on it, the numbers do not move
  assert.deepEqual(founders.entries.map((f) => [f.address, f.founder_seq]), [[sender, 1]])
  assert.equal(founders.entries[0].license, 'personal') // the licence rung adds DOG and BTC
  assert.equal(founders.entries[0].total, 600) // but the fund total stays DOG only
  // the BTC-only wallet sits apart, with its licence rung and no Founder number
  assert.equal(founders.btcOnly.length, 1)
  assert.equal(founders.btcOnly[0].address, OTHER_ORD)
  assert.equal(founders.btcOnly[0].license, 'patron')
  assert.ok(!('founder_seq' in founders.btcOnly[0]))
  // and the route builds the Founder list from the DOG ledger alone
  const route = readFileSync(new URL('../../app/api/donate/leaderboard/route.ts', import.meta.url), 'utf8')
  assert.match(route, /applyBtcCredits\(ledger\.founders\.map/)
  assert.ok(!/founders\.push|btcOnly[^\n]*founders/.test(route))
})

test('the fund counter, the B detector and its route never import or read the BTC licence code', () => {
  const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8')
  const guarded = ['lib/dog/mint-b.ts', 'lib/dog/founders-ledger.ts', 'app/api/dogcity/mint-b/route.ts']
  for (const f of guarded) {
    const src = read(f)
    assert.ok(!/licence-btc|licence-quote|price-sources|dogcity_btc_payments|dogcity_licence_quotes/.test(src), `${f} must not touch BTC licence code`)
  }
  // total_received comes from the DOG ledger alone; the BTC credits are applied after it
  const route = read('app/api/donate/leaderboard/route.ts')
  assert.match(route, /const totalReceived = ledger\.totalReceived/)
  assert.ok(!/total_received:\s*[^,\n]*btc/i.test(route))
})

// ── a varredura de ponta a ponta ────────────────────────────────────────────

function sweepStore(quotes: Quote[]) {
  const rows = new Map<string, StoredPayment>()
  const store: SweepStore = {
    loadRows: async () => new Map(rows),
    loadQuotes: async (payers) => quotes.filter((q) => payers.includes(q.paymentAddress)),
    saveRow: async (r) => {
      const ex = rows.get(keyOf(r.txid, r.vout))
      assert.ok(!ex || ex.status !== 'credited', 'a credited row must never be rewritten')
      rows.set(keyOf(r.txid, r.vout), r)
    },
  }
  return { store, rows }
}
const chainPay = (over: Partial<ChainPayment> = {}): ChainPayment => ({
  txid: 'e'.repeat(64), vout: 1, sats: quote().sats, payerAddresses: [PAY], confirmed: true, blockHeight: 1_000, blockTimeMs: T0 + 20 * MIN, ...over,
})

test('sweep: unconfirmed is only observed, then credited once with 6 confirmations, and never again', async () => {
  const { store, rows } = sweepStore([quote()])
  const priceAtBlock = noPrice
  const unconfirmed = chainPay({ confirmed: false, blockHeight: null, blockTimeMs: null })
  const r1 = await sweepOnce({ nowMs: T0 + 5 * MIN, chain: { tip: 1_000, payments: [unconfirmed], firstSeenMs: new Map() }, store, priceAtBlock })
  assert.equal(r1.observed, 1)
  assert.equal(rows.get(keyOf(unconfirmed.txid, 1))?.firstSeenMs, T0 + 5 * MIN)

  // confirmed in 1000, tip 1005 = 6 confirmations; the sweep runs after the lock expired
  const r2 = await sweepOnce({ nowMs: T0 + 90 * MIN, chain: { tip: 1_005, payments: [chainPay()], firstSeenMs: new Map() }, store, priceAtBlock })
  assert.equal(r2.credited, 1)
  const row = rows.get(keyOf(unconfirmed.txid, 1))!
  assert.equal(row.status, 'credited')
  assert.equal(row.basis, 'quote') // first seen at T0+5, inside the lock, even though the sweep ran later
  assert.equal(row.ordinalsAddress, ORD)
  const credit = row.creditDog

  const r3 = await sweepOnce({ nowMs: T0 + 200 * MIN, chain: { tip: 1_100, payments: [chainPay()], firstSeenMs: new Map() }, store, priceAtBlock: async () => ({ dogUsd: 1, btcUsd: 1 }) })
  assert.equal(r3.skipped, 1)
  assert.equal(rows.get(keyOf(unconfirmed.txid, 1))!.creditDog, credit)
})

test('sweep: a payment from a wallet with no quote is unmatched and stays that way', async () => {
  const { store, rows } = sweepStore([quote()])
  const p = chainPay({ payerAddresses: ['bc1q' + 'y'.repeat(38)] })
  const r = await sweepOnce({ nowMs: T0 + 30 * MIN, chain: { tip: 1_010, payments: [p], firstSeenMs: new Map() }, store, priceAtBlock: noPrice })
  assert.equal(r.unmatched, 1)
  assert.equal(rows.get(keyOf(p.txid, 1))?.creditDog, null)
})

test('sweep: with no block price the payment waits in review and is retried; with a price it is credited', async () => {
  const { store, rows } = sweepStore([quote()])
  const late = chainPay({ blockTimeMs: T0 + 60 * MIN })
  const run = (priceAtBlock: (t: number) => Promise<PriceAtBlock | null>, nowMs: number) =>
    sweepOnce({ nowMs, chain: { tip: 1_010, payments: [late], firstSeenMs: new Map([[late.txid, T0 + 50 * MIN]]) }, store, priceAtBlock })
  const r1 = await run(async () => null, T0 + 61 * MIN)
  assert.equal(r1.pendingReview, 1)
  assert.equal(rows.get(keyOf(late.txid, 1))?.reviewReason, 'price_unavailable')
  const r2 = await run(blockPrice(DOG_USD, BTC_USD), T0 + 70 * MIN)
  assert.equal(r2.credited, 1)
  assert.equal(rows.get(keyOf(late.txid, 1))?.basis, 'block')
})

test('sweep: a review that needs a human is not retried', async () => {
  const q1 = quote(), q2 = quote({ id: 'q2', ordinalsAddress: OTHER_ORD })
  const { store, rows } = sweepStore([q1, q2])
  const p = chainPay()
  const chain = { tip: 1_010, payments: [p], firstSeenMs: new Map<string, number>() }
  assert.equal((await sweepOnce({ nowMs: T0 + 30 * MIN, chain, store, priceAtBlock: noPrice })).pendingReview, 1)
  assert.equal((await sweepOnce({ nowMs: T0 + 31 * MIN, chain, store, priceAtBlock: noPrice })).skipped, 1)
  assert.equal(rows.get(keyOf(p.txid, 1))?.reviewReason, 'ambiguous_owner')
})

test('mempool.space transactions: only outputs to the fund count, the fund as payer never does', () => {
  const tx = (vinAddr: string[], extra: Record<string, unknown> = {}) => ({
    txid: 'f'.repeat(64),
    vin: vinAddr.map((a) => ({ prevout: { scriptpubkey_address: a } })),
    vout: [{ scriptpubkey_address: 'bc1p' + 'q'.repeat(58), value: 40_000 }, { scriptpubkey_address: FUND_BTC_ADDRESS, value: 12_345 }, { scriptpubkey_address: FUND_BTC_ADDRESS, value: -5 }, {}],
    status: { confirmed: true, block_height: 972_203, block_time: 1_792_441_776 },
    ...extra,
  })
  const ps = paymentsFromTx(tx([PAY.toUpperCase()]))
  assert.deepEqual(ps, [{
    txid: 'f'.repeat(64), vout: 1, sats: 12_345, payerAddresses: [PAY], confirmed: true, blockHeight: 972_203, blockTimeMs: 1_792_441_776_000,
  }])
  assert.deepEqual(paymentsFromTx(tx([PAY, FUND_BTC_ADDRESS])), [])
  assert.deepEqual(paymentsFromTx(tx([PAY, FUND_DOG_ADDRESS])), [])
  assert.deepEqual(paymentsFromTx({ txid: 'nope', vin: [], vout: [] }), [])
  assert.equal(paymentsFromTx(tx([PAY], { status: { confirmed: false } }))[0].blockHeight, null)
})

test('the source lists name Kraken for DOG and the three exchanges of the mint ruler for BTC', async () => {
  const { DOG_SOURCES, BTC_SOURCES } = await import('./price-sources')
  const names = (s: PriceSource[]) => s.map((x) => x.name).sort()
  assert.deepEqual(names(BTC_SOURCES), ['Bitstamp', 'Coinbase', 'Kraken'])
  assert.ok(names(DOG_SOURCES).includes('Kraken'))
  assert.ok(DOG_SOURCES.length >= 2 && DOG_SOURCES.every((s) => s.pair === 'DOG/USD'))
})

test('the fund addresses are the same in the server code, the page data and the modal gate', async () => {
  const data = await import('../../app/dogcity/dogcity-data')
  assert.equal(data.DONATION_WALLET, FUND_DOG_ADDRESS)
  assert.equal(data.DONATION_METHODS.find((m) => m.key === 'bitcoin')?.address, FUND_BTC_ADDRESS)
  const modal = readFileSync(new URL('../../components/donate/donate-modal.tsx', import.meta.url), 'utf8')
  assert.ok(modal.includes(`ini: '${FUND_BTC_ADDRESS.slice(0, 9)}'`) && modal.includes(`fim: '${FUND_BTC_ADDRESS.slice(-6)}'`) && modal.includes(`tam: ${FUND_BTC_ADDRESS.length}`))
  // the public docs list both addresses
  const docs = readFileSync(new URL('../../app/dogcity/docs/page.tsx', import.meta.url), 'utf8')
  assert.ok(docs.includes(FUND_BTC_ADDRESS) && docs.includes(FUND_DOG_ADDRESS))
})
