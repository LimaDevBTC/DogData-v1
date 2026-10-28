// Run: npx tsx --test lib/dog/licence-upgrade.test.ts
//
// SUBIR PAGA SÓ A DIFERENÇA, em BTC (fundador, 28/10): a cotação cobre o que a carteira AINDA FALTA
// (`degrau - DOG que ela já conta`, a conta do placar), o pagamento que a cobre credita os sats à
// taxa travada e a carteira chega ao degrau; o degrau que ela já tem não recebe cotação. E, com
// várias cotações vivas do mesmo pagador, o pagamento é casado com a que ele de fato paga.
// Dado SIMULADO (preços e endereços inventados).
import test from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { buildLedger, type TxRow } from './founders-ledger'
import {
  FUND_DOG_ADDRESS, LICENCE_DOG, LICENCE_TIERS, MIN_PAYMENT_SATS, applyBtcCredits, buildQuote, combineWallet, dogForSats,
  dogStillNeeded, licenceFor, licenceSats, matchQuote, resolvePayment,
  type BtcPayment, type Credit, type LicenceTier, type Quote,
} from './licence-btc'
import { createQuote, type QuoteStore } from './licence-quote'
import { posicaoDaCarteira, standingOfWallet } from './licence-wallet'

const T0 = Date.UTC(2026, 9, 28, 12, 0, 0)
const MIN = 60_000
const ORD = 'bc1p' + 'a'.repeat(58)
const PAY = 'bc1q' + 'b'.repeat(38)
const DOG_USD = 0.0009
const BTC_USD = 80_000
const ok = (price: number) => ({ ok: true as const, price, sources: [{ name: 'A', price }, { name: 'B', price }] })

function quote(tier: LicenceTier, heldDog: number, over: Partial<Quote> = {}, rates: [number, number] = [DOG_USD, BTC_USD], nowMs = T0, id = `q-${tier}-${heldDog}-${nowMs}`): Quote {
  const b = buildQuote({ id, tier, ordinalsAddress: ORD, paymentAddress: PAY, dog: ok(rates[0]), btc: ok(rates[1]), nowMs, heldDog })
  assert.equal(b.ok, true, `${tier} held ${heldDog}`)
  return { ...(b as { quote: Quote }).quote, ...over }
}

const pay = (sats: number, over: Partial<BtcPayment> = {}): BtcPayment => ({
  txid: 'a'.repeat(64), vout: 0, sats, payerAddresses: [PAY], seenAtMs: T0 + 5 * MIN, confirmations: 6, blockTimeMs: T0 + 20 * MIN, ...over,
})
const noPrice = async () => { throw new Error('block price must not be asked inside the lock') }

// ── a diferença ─────────────────────────────────────────────────────────────

test('dogStillNeeded: the licence minus what the wallet counts, never below 0, in whole atomos', () => {
  assert.equal(dogStillNeeded('personal', 0), 10_000)
  assert.equal(dogStillNeeded('commercial', 10_000), 40_000)
  assert.equal(dogStillNeeded('patron', 10_000), 490_000)
  assert.equal(dogStillNeeded('patron', 50_000), 450_000)
  assert.equal(dogStillNeeded('personal', 10_000), 0)
  assert.equal(dogStillNeeded('personal', 1_000_000), 0)
  assert.equal(dogStillNeeded('commercial', 9_999.99999), 40_000.00001)
  assert.equal(dogStillNeeded('commercial', 49_999.99999), 0.00001)
  assert.equal(dogStillNeeded('commercial', 6_000.1), 43_999.9)
  for (const bad of [NaN, -1, Infinity, -Infinity]) assert.ok(Number.isNaN(dogStillNeeded('commercial', bad)), String(bad))
  assert.ok(Number.isNaN(dogStillNeeded('gold' as LicenceTier, 0)))
})

test('licenceFor compares in atomos: float noise in the sum of credits cannot leave a wallet just under its rung', () => {
  // três créditos em BTC que somam exatamente 50.000 átomos a átomos, mas em ponto flutuante dão 49.999,99999999999
  const parts = [646.48596, 16576.31718, 32777.19686]
  const raw = parts.reduce((a, b) => a + b, 0)
  assert.ok(raw < 50_000, `precondition: the float sum ${raw} falls just under 50,000`)
  assert.equal(licenceFor(raw), 'commercial')
  // a carteira só com BTC (sem DOG no fundo) sai Commercial no placar
  const board = applyBtcCredits([], parts.map((creditDog) => ({ ordinalsAddress: ORD, creditDog })))
  assert.equal(board.btcOnly[0].license, 'commercial')
  // e com DOG no fundo
  const withDog = applyBtcCredits([{ address: ORD, total: 6_000.1, license: licenceFor(6_000.1) }], [{ ordinalsAddress: ORD, creditDog: 43_999.9 }])
  assert.equal(withDog.entries[0].license, 'commercial')
  // as fronteiras continuam estritas: um átomo abaixo não chega
  assert.equal(licenceFor(49_999.99999), 'personal')
  assert.equal(licenceFor(9_999.99999), 'citizen')
  assert.equal(licenceFor(499_999.99999), 'commercial')
})

// ── a cotação cobre só o que falta ──────────────────────────────────────────

test('quote: Personal -> Commercial, Personal -> Patron, Commercial -> Patron cover only the difference', () => {
  for (const [held, tier, needed] of [[10_000, 'commercial', 40_000], [10_000, 'patron', 490_000], [50_000, 'patron', 450_000]] as const) {
    const q = quote(tier, held)
    assert.equal(q.tier, tier)
    assert.equal(q.dogAmount, needed)
    assert.equal(q.sats, licenceSats(needed, DOG_USD, BTC_USD))
    assert.ok(q.sats < licenceSats(LICENCE_DOG[tier], DOG_USD, BTC_USD)!, 'cheaper than the full price')
    assert.equal(q.expiresAtMs - q.createdAtMs, 15 * MIN)
  }
  // sem nada na carteira, o preço cheio de sempre
  for (const t of LICENCE_TIERS) assert.equal(quote(t, 0).dogAmount, LICENCE_DOG[t])
})

test('quote: a wallet that already holds the rung (or more) gets no quote', () => {
  const base = { id: 'x', ordinalsAddress: ORD, paymentAddress: PAY, dog: ok(DOG_USD), btc: ok(BTC_USD), nowMs: T0 }
  for (const [tier, held] of [['personal', 10_000], ['personal', 60_000], ['commercial', 50_000], ['commercial', 500_000], ['patron', 500_000], ['patron', 1_234_567]] as const) {
    assert.deepEqual(buildQuote({ ...base, tier, heldDog: held }), { ok: false, reason: 'already_held' }, `${tier} held ${held}`)
  }
  // um átomo abaixo do degrau ainda cota
  assert.equal(buildQuote({ ...base, tier: 'personal', heldDog: 9_999.99999 }).ok, true)
  assert.equal(buildQuote({ ...base, tier: 'patron', heldDog: 499_999.99999 }).ok, true)
})

test('quote: an unknown or invalid wallet total is refused, never read as zero', () => {
  const base = { id: 'x', ordinalsAddress: ORD, paymentAddress: PAY, dog: ok(DOG_USD), btc: ok(BTC_USD), nowMs: T0, tier: 'commercial' }
  for (const heldDog of [NaN, -1, Infinity, undefined as unknown as number, '5' as unknown as number]) {
    assert.deepEqual(buildQuote({ ...base, heldDog }), { ok: false, reason: 'bad_input' }, String(heldDog))
  }
})

test('quote: a tiny difference still asks for the dust minimum, so the payment is never dust', async () => {
  const q = quote('commercial', 49_999.99999)
  assert.equal(q.dogAmount, 0.00001)
  assert.equal(q.sats, MIN_PAYMENT_SATS)
  const r = await resolvePayment(pay(q.sats), [q], noPrice)
  assert.equal(r.status, 'credited')
  if (r.status === 'credited') {
    assert.ok(r.creditDog >= q.dogAmount)
    assert.equal(licenceFor(combineWallet(49_999.99999, r.creditDog)), 'commercial')
  }
  // abaixo do mínimo continua poeira
  assert.deepEqual(await resolvePayment(pay(MIN_PAYMENT_SATS - 1), [q], noPrice), { status: 'unmatched', reason: 'dust', })
})

// ── o crédito: cobre a cotação, credita os sats à taxa travada, a carteira chega ao degrau ──

const RATES: [number, number][] = [[0.0009, 80_000], [0.00123, 109_500.5], [0.0000321, 61_234], [0.05, 98_000], [0.000311, 71_111.11]]
const HELDS = [0, 1, 4_000, 6_000.1, 9_999.99999, 10_000, 12_345.67891, 33_333.33333, 49_999.99999, 50_000, 123_456.12345, 449_999.5, 499_999.99999]

test('paying the quoted sats credits the sats at the locked rate and the wallet total reaches the rung it paid for', async () => {
  let cases = 0
  for (const rates of RATES) {
    for (const held of HELDS) {
      for (const tier of LICENCE_TIERS) {
        if (licenceFor(held) !== 'citizen' && LICENCE_TIERS.indexOf(tier) <= LICENCE_TIERS.indexOf(licenceFor(held) as LicenceTier)) continue
        const q = quote(tier, held, {}, rates)
        const r = await resolvePayment(pay(q.sats), [q], noPrice)
        const label = `${tier} held ${held} @ ${rates}`
        assert.equal(r.status, 'credited', label)
        if (r.status !== 'credited') continue
        assert.equal(r.basis, 'quote')
        // exatamente os sats pagos à taxa travada (o piso é só contra erro de ponto flutuante)
        assert.equal(r.creditDog, Math.max(dogForSats(q.sats, rates[0], rates[1])!, q.dogAmount), label)
        assert.ok(r.creditDog >= q.dogAmount, label)
        assert.equal(licenceFor(combineWallet(held, r.creditDog)), tier, `${label} total ${combineWallet(held, r.creditDog)}`)
        // um sat a menos não cobre a cotação: revisão manual, nunca crédito sozinho
        if (q.sats > MIN_PAYMENT_SATS) {
          assert.deepEqual(await resolvePayment(pay(q.sats - 1), [q], noPrice), { status: 'pending_review', reason: 'underpaid_for_quote', retry: false }, label)
        }
        cases++
      }
    }
  }
  assert.ok(cases > 100, `swept ${cases} cases`)
})

test('mixed DOG + BTC history: the quote follows the leaderboard total, and the credit lands the wallet on the rung', async () => {
  // 6.000 DOG no fundo + 4.000 DOG de BTC já creditado = Personal; o Commercial pede 40.000
  const ledger = [{ address: ORD, total: 6_000, license: licenceFor(6_000) }]
  const credits: Credit[] = [{ ordinalsAddress: ORD, creditDog: 4_000 }]
  const board = applyBtcCredits(ledger, credits).entries[0]
  assert.equal(board.licence_total, 10_000)
  assert.equal(board.license, 'personal')
  const q = quote('commercial', board.licence_total)
  assert.equal(q.dogAmount, 40_000)
  const r = await resolvePayment(pay(q.sats), [q], noPrice)
  assert.equal(r.status, 'credited')
  if (r.status === 'credited') {
    const after = applyBtcCredits(ledger, [...credits, { ordinalsAddress: ORD, creditDog: r.creditDog }]).entries[0]
    assert.equal(after.license, 'commercial')
  }
})

test('the full path Personal -> Commercial -> Patron by BTC pays each difference exactly once', async () => {
  let total = 10_000
  const steps: [LicenceTier, number][] = [['commercial', 40_000], ['patron', 450_000]]
  for (const [tier, needed] of steps) {
    const q = quote(tier, total, {}, [DOG_USD, BTC_USD], T0, `step-${tier}`)
    assert.equal(q.dogAmount, needed)
    const r = await resolvePayment(pay(q.sats), [q], noPrice)
    assert.equal(r.status, 'credited')
    if (r.status === 'credited') total = combineWallet(total, r.creditDog)
    assert.equal(licenceFor(total), tier)
  }
  assert.ok(total >= 500_000 && total < 500_001, `total ${total}`)
})

// ── várias cotações vivas do mesmo pagador ──────────────────────────────────

test('two live quotes of different tiers: paying the OLDER, bigger one credits it, not the newer small one', async () => {
  // Commercial cotado primeiro; depois a pessoa olhou o Personal numa taxa em que o DOG subiu 3%
  const commercial = quote('commercial', 0, {}, [DOG_USD, BTC_USD], T0, 'qc')
  const personal = quote('personal', 0, {}, [DOG_USD * 1.03, BTC_USD], T0 + MIN, 'qp')
  assert.ok(personal.createdAtMs > commercial.createdAtMs)
  // a regra antiga (a mais nova que cobre) creditaria pela taxa do Personal e deixaria a carteira abaixo do degrau pago
  const undercredit = dogForSats(commercial.sats, DOG_USD * 1.03, BTC_USD)!
  assert.ok(undercredit < 50_000, `precondition: the newer rate would credit only ${undercredit}`)
  const seen = { seenAtMs: T0 + 3 * MIN, blockTimeMs: T0 + 20 * MIN }
  for (const order of [[commercial, personal], [personal, commercial]]) {
    const m = matchQuote(pay(commercial.sats, seen), order)
    assert.equal(m.kind === 'quote' && m.quote.id, 'qc')
    const r = await resolvePayment(pay(commercial.sats, seen), order, noPrice)
    assert.equal(r.status, 'credited')
    if (r.status === 'credited') {
      assert.equal(r.quoteId, 'qc')
      assert.ok(r.creditDog >= 50_000)
      assert.equal(licenceFor(r.creditDog), 'commercial')
    }
  }
})

test('two live quotes: paying the smaller one credits the smaller one (the bigger is not covered)', async () => {
  const commercial = quote('commercial', 0, {}, [DOG_USD, BTC_USD], T0, 'qc')
  const personal = quote('personal', 0, {}, [DOG_USD, BTC_USD], T0 + MIN, 'qp')
  const r = await resolvePayment(pay(personal.sats, { seenAtMs: T0 + 3 * MIN }), [commercial, personal], noPrice)
  assert.equal(r.status === 'credited' && r.quoteId, 'qp')
  assert.equal(r.status === 'credited' && licenceFor(r.creditDog), 'personal')
})

test('two live difference quotes for a Personal wallet: Commercial and Patron are told apart by what was paid', async () => {
  const commercial = quote('commercial', 10_000, {}, [DOG_USD, BTC_USD], T0, 'qc')
  const patron = quote('patron', 10_000, {}, [DOG_USD * 0.98, BTC_USD], T0 + MIN, 'qp')
  const seen = { seenAtMs: T0 + 3 * MIN }
  const a = await resolvePayment(pay(patron.sats, seen), [commercial, patron], noPrice)
  assert.equal(a.status === 'credited' && a.quoteId, 'qp')
  assert.equal(a.status === 'credited' && licenceFor(combineWallet(10_000, a.creditDog)), 'patron')
  const b = await resolvePayment(pay(commercial.sats, seen), [commercial, patron], noPrice)
  assert.equal(b.status === 'credited' && b.quoteId, 'qc')
  assert.equal(b.status === 'credited' && licenceFor(combineWallet(10_000, b.creditDog)), 'commercial')
  // paga o Patron com o preço do Commercial: só cobre o Commercial, nunca vira Patron
  const c = await resolvePayment(pay(commercial.sats + 1_000, seen), [commercial, patron], noPrice)
  assert.equal(c.status === 'credited' && licenceFor(combineWallet(10_000, c.creditDog)), 'commercial')
})

test('the same tier quoted twice: a payment covering both is matched to the newest', () => {
  const old = quote('commercial', 0, {}, [DOG_USD, BTC_USD], T0, 'q-old')
  const fresh = quote('commercial', 0, {}, [DOG_USD * 1.01, BTC_USD], T0 + 2 * MIN, 'q-new')
  const sats = Math.max(old.sats, fresh.sats) + 10
  for (const order of [[old, fresh], [fresh, old]]) {
    const m = matchQuote(pay(sats, { seenAtMs: T0 + 5 * MIN }), order)
    assert.equal(m.kind === 'quote' && m.quote.id, 'q-new')
  }
})

test('a payment that covers no live quote is still held for review, whatever else is quoted', async () => {
  const commercial = quote('commercial', 0, {}, [DOG_USD, BTC_USD], T0, 'qc')
  const personal = quote('personal', 0, {}, [DOG_USD, BTC_USD], T0 + MIN, 'qp')
  const r = await resolvePayment(pay(personal.sats - 1, { seenAtMs: T0 + 3 * MIN }), [commercial, personal], noPrice)
  assert.deepEqual(r, { status: 'pending_review', reason: 'underpaid_for_quote', retry: false })
})

// ── createQuote: o servidor lê o que a carteira já conta ────────────────────

function memStore() {
  const inserted: Quote[] = []
  const store: QuoteStore = { countSince: async () => 0, insert: async (q) => { inserted.push(q) } }
  return { store, inserted }
}
const medians = async () => ({ dog: ok(DOG_USD), btc: ok(BTC_USD) })
const body = (tier: string) => ({ tier, ordinalsAddress: ORD.toUpperCase(), paymentAddress: PAY })

test('createQuote: stores and answers the difference, with the full licence and what the wallet counts', async () => {
  const { store, inserted } = memStore()
  const asked: string[] = []
  const r = await createQuote({ store, medians, heldDog: async (a) => { asked.push(a); return 10_000 }, nowMs: T0, newId: () => 'id-1' }, body('commercial'))
  assert.equal(r.ok, true)
  assert.deepEqual(asked, [ORD], 'the wallet is looked up by its normalized ordinals address')
  assert.equal(inserted.length, 1)
  assert.equal(inserted[0].dogAmount, 40_000)
  assert.equal(inserted[0].tier, 'commercial')
  if (r.ok) {
    assert.equal(r.quote.dogAmount, 40_000)
    assert.equal(r.quote.licenceDog, 50_000)
    assert.equal(r.quote.heldDog, 10_000)
    assert.equal(r.quote.sats, licenceSats(40_000, DOG_USD, BTC_USD))
  }
})

test('createQuote: a wallet with nothing is quoted the full price (unchanged)', async () => {
  const { store, inserted } = memStore()
  const r = await createQuote({ store, medians, heldDog: async () => 0, nowMs: T0, newId: () => 'id-1' }, body('personal'))
  assert.equal(r.ok && r.quote.dogAmount, 10_000)
  assert.equal(inserted[0].sats, licenceSats(10_000, DOG_USD, BTC_USD))
})

test('createQuote: a tier the wallet already holds is refused with 409 and nothing is saved', async () => {
  const { store, inserted } = memStore()
  for (const [tier, held] of [['personal', 10_000], ['commercial', 55_000], ['patron', 500_000]] as const) {
    const r = await createQuote({ store, medians, heldDog: async () => held, nowMs: T0, newId: () => 'x' }, body(tier))
    assert.deepEqual([r.ok, r.status], [false, 409], `${tier} held ${held}`)
  }
  assert.equal(inserted.length, 0)
})

test('createQuote: not knowing what the wallet counts is a 503, never the full price and never a free pass', async () => {
  const { store, inserted } = memStore()
  const run = (heldDog: () => Promise<number | null>) => createQuote({ store, medians, heldDog, nowMs: T0, newId: () => 'x' }, body('commercial'))
  for (const f of [async () => null, async () => { throw new Error('db down') }, async () => NaN, async () => -5, async () => Infinity]) {
    const r = await run(f as () => Promise<number | null>)
    assert.deepEqual([r.ok, r.status], [false, 503])
  }
  assert.equal(inserted.length, 0)
})

// ── licence-wallet: o total que a rota leve devolve é o do placar ───────────

const W = FUND_DOG_ADDRESS
const at = (dog: number) => Math.round(dog * 100_000)
const tx = (txid: string, block: number, senders: [string, number][], receivers: [string, number][]): TxRow => ({
  id: block, txid, block_height: block, timestamp: `2026-10-${String(block % 28 + 1).padStart(2, '0')}T00:00:00Z`,
  senders: senders.map(([address, dog]) => ({ address, amount: at(dog) })),
  receivers: receivers.map(([address, dog]) => ({ address, amount: at(dog) })),
})
const ROWS: TxRow[] = [
  tx('t1', 10, [[ORD, 6_000.1]], [[W, 6_000.1]]),
  tx('t2', 11, [['bc1p' + 'c'.repeat(58), 30_000]], [[W, 30_000]]),
]
const CREDITS: Credit[] = [{ ordinalsAddress: ORD, creditDog: 43_999.9 }, { ordinalsAddress: 'bc1p' + 'c'.repeat(58), creditDog: 5_000 }]

test('standingOfWallet: the total is the leaderboard licence_total (DOG + capped BTC), and the tier follows in atomos', () => {
  const L = buildLedger(ROWS, W, { licenseFor: licenceFor, posicoes: {} })
  const board = applyBtcCredits(L.leaderboard, CREDITS)
  for (const a of [ORD, 'bc1p' + 'c'.repeat(58)]) {
    const mine = standingOfWallet(ROWS.filter((r) => JSON.stringify(r).includes(a)), a, CREDITS)
    const e = board.entries.find((x) => x.address === a)!
    assert.equal(mine.totalDog, e.licence_total)
    assert.equal(mine.tier ?? 'citizen', e.license)
  }
  // 6.000,1 DOG + 43.999,9 DOG de BTC: exatamente Commercial
  assert.equal(standingOfWallet(ROWS.slice(0, 1), ORD, CREDITS).tier, 'commercial')
  // carteira desconhecida: nada
  assert.deepEqual(standingOfWallet([], 'bc1p' + 'e'.repeat(58), CREDITS), { tier: null, totalDog: 0 })
  // só BTC
  assert.deepEqual(standingOfWallet([], 'bc1q' + 'd'.repeat(38), [{ ordinalsAddress: 'bc1q' + 'd'.repeat(38), creditDog: 500_000 }]), { tier: 'patron', totalDog: 500_000 })
})

type Resp = { data: any[] | null; error: { message: string } | null }
function fakeDb(opts: { tx?: Resp; btc?: Resp }) {
  const db = {
    from(table: string) {
      const q: any = {
        select: () => q, order: () => q, contains: () => q, eq: () => q, range: () => q, abortSignal: () => q,
        then: (res: (r: Resp) => void) => res((table === 'dog_transactions' ? opts.tx : opts.btc) ?? { data: [], error: null }),
      }
      return q
    },
  }
  return db as unknown as SupabaseClient
}

test('posicaoDaCarteira: strict (the quote path) refuses to guess when the BTC credits cannot be read; the display path counts DOG only', async () => {
  const errLog = console.error
  console.error = () => {}
  try {
    const db = fakeDb({ tx: { data: ROWS.slice(0, 1), error: null }, btc: { data: null, error: { message: 'relation does not exist' } } })
    assert.equal(await posicaoDaCarteira(db, ORD, { strict: true }), null)
    assert.deepEqual(await posicaoDaCarteira(db, ORD), { tier: null, totalDog: 6_000.1 })
    const good = fakeDb({ tx: { data: ROWS.slice(0, 1), error: null }, btc: { data: [{ ordinals_address: ORD, credit_dog: '43999.9' }], error: null } })
    const s = await posicaoDaCarteira(good, ORD, { strict: true })
    assert.equal(s?.tier, 'commercial')
    assert.equal(s?.totalDog, combineWallet(6_000.1, 43_999.9))
  } finally {
    console.error = errLog
  }
})

// ── a fiação: as rotas usam a conta, e a tela não baixa o placar ─────────────

test('the quote route reads the wallet strictly; the light standing route is uncached and validates the address', async () => {
  const { readFileSync } = await import('node:fs')
  const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8')
  const quoteRoute = read('app/api/dogcity/licence-quote/route.ts')
  assert.match(quoteRoute, /posicaoDaCarteira\(supabase, ordinalsAddress, \{ ms: HELD_MS, strict: true \}\)/)
  assert.match(quoteRoute, /createQuote\(\{ store, medians, heldDog,/)
  const standing = read('app/api/dogcity/licence-standing/route.ts')
  assert.match(standing, /'Cache-Control': 'no-store'/)
  assert.match(standing, /normalizeAddress\(/)
  assert.match(standing, /posicaoDaCarteira\(supabase, address/)
  // a cron e a tabela de cotações seguem como estavam: a diferença mora em `dog_amount`
  const cron = read('app/api/cron/licence-btc/route.ts')
  assert.match(cron, /dogAmount: Number\(r\.dog_amount\)/)
})
