// Run: npx tsx --test lib/dog/licence-presets.test.ts
//
// Os atalhos de licença da janela de pagamento em BTC (28/10): os três degraus, com os sats que a
// cotação trava, em acordo com o que o código de crédito conta. Dado SIMULADO (preços inventados).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  LICENCE_DOG, LICENCE_TIERS, buildQuote, combineWallet, licenceFor, licenceSats, matchQuote,
  resolvePayment, satsForDog, type BtcPayment, type LicenceTier, type Quote,
} from './licence-btc'
import { licenceOffers, licencePresets, parseLicencePreview, parseWalletStanding } from './licence-presets'
import { bip21Uri } from '../wallet/bip21'

const T0 = Date.UTC(2026, 9, 28, 12, 0, 0)
const MIN = 60_000
const ORD = 'bc1p' + 'a'.repeat(58)
const OTHER = 'bc1p' + 'c'.repeat(58)
const PAY = 'bc1q' + 'b'.repeat(38)
const DOG_USD = 0.0009
const BTC_USD = 80_000
const ok = (price: number) => ({ ok: true as const, price, sources: [{ name: 'A', price }, { name: 'B', price }] })

/** a resposta que GET /api/dogcity/licence-quote monta (o mesmo laço da rota) */
function previewJson(dogUsd = DOG_USD, btcUsd = BTC_USD) {
  const tiers: Record<string, number> = {}
  for (const t of LICENCE_TIERS) tiers[t] = satsForDog(LICENCE_DOG[t], dogUsd, btcUsd) as number
  return { tiers, dogUsd, btcUsd, sources: [], asOf: new Date(T0).toISOString(), lockMinutes: 15 }
}

function quoteFor(tier: LicenceTier, over: Partial<Quote> = {}, dogUsd = DOG_USD, btcUsd = BTC_USD, nowMs = T0): Quote {
  const b = buildQuote({ id: `q-${tier}`, tier, ordinalsAddress: ORD, paymentAddress: PAY, dog: ok(dogUsd), btc: ok(btcUsd), nowMs, heldDog: 0 })
  assert.equal(b.ok, true)
  return { ...(b as { quote: Quote }).quote, ...over }
}

const pay = (sats: number, over: Partial<BtcPayment> = {}): BtcPayment => ({
  txid: 'a'.repeat(64), vout: 0, sats, payerAddresses: [PAY], seenAtMs: T0 + 5 * MIN, confirmations: 6, blockTimeMs: T0 + 20 * MIN, ...over,
})
const noPrice = async () => { throw new Error('block price must not be asked inside the lock') }

// ── os atalhos são os três degraus, com os sats da cotação ───────────────────

test('presets are the three licences in ladder order, never the old generic 10k/50k/200k sats', () => {
  const p = licencePresets(parseLicencePreview(previewJson()))
  assert.deepEqual(p.map((x) => x.tier), ['personal', 'commercial', 'patron'])
  assert.deepEqual(p.map((x) => x.dogAmount), [10_000, 50_000, 500_000])
  assert.deepEqual(p.map((x) => x.sats), LICENCE_TIERS.map((t) => satsForDog(LICENCE_DOG[t], DOG_USD, BTC_USD)))
  // a lista antiga: nenhum dos três valores genéricos pode ser o preço de um degrau
  const sats = p.map((x) => x.sats)
  for (const generic of [10_000, 50_000, 200_000]) assert.ok(!sats.includes(generic), `${generic} is not a licence price`)
})

test('preset sats equal the quote sats the server locks, for every tier and several price pairs', () => {
  for (const [dogUsd, btcUsd] of [[0.0009, 80_000], [0.00123, 109_500.5], [0.0000321, 61_234], [0.05, 98_000]] as const) {
    const presets = licencePresets(parseLicencePreview(previewJson(dogUsd, btcUsd)))
    for (const t of LICENCE_TIERS) {
      const q = quoteFor(t, {}, dogUsd, btcUsd)
      assert.equal(presets.find((p) => p.tier === t)?.sats, q.sats, `${t} @ ${dogUsd}/${btcUsd}`)
      assert.equal(q.dogAmount, LICENCE_DOG[t])
    }
  }
})

test('paying exactly the preset sats inside the lock is credited and lands on that rung', async () => {
  const presets = licencePresets(parseLicencePreview(previewJson()))
  for (const t of LICENCE_TIERS) {
    const q = quoteFor(t)
    const sats = presets.find((p) => p.tier === t)!.sats!
    const r = await resolvePayment(pay(sats), [q], noPrice)
    assert.equal(r.status, 'credited', t)
    if (r.status === 'credited') {
      assert.equal(r.basis, 'quote')
      assert.ok(r.creditDog >= LICENCE_DOG[t], `${t} credited ${r.creditDog}`)
      assert.equal(licenceFor(r.creditDog), t)
    }
    // um sat a menos já não cobre a cotação: vai para revisão manual, nunca credita sozinho
    const short = await resolvePayment(pay(sats - 1), [q], noPrice)
    assert.deepEqual(short, { status: 'pending_review', reason: 'underpaid_for_quote', retry: false }, t)
  }
})

test('the newest quote wins when several tiers are quoted: the selector always pays the latest one', () => {
  // personal (mais velha) e commercial (mais nova), as duas dentro da trava; paga-se a da commercial
  const a = quoteFor('personal', { createdAtMs: T0, expiresAtMs: T0 + 15 * MIN })
  const b = quoteFor('commercial', { createdAtMs: T0 + MIN, expiresAtMs: T0 + 16 * MIN })
  const m = matchQuote(pay(b.sats, { seenAtMs: T0 + 3 * MIN }), [a, b])
  assert.equal(m.kind === 'quote' && m.quote.tier, 'commercial')
})

// ── a prévia do servidor é conferida, nunca confiada ─────────────────────────

test('parseLicencePreview accepts the server shape and rejects anything that disagrees with the quote maths', () => {
  const good = previewJson()
  assert.ok(parseLicencePreview(good))
  assert.equal(parseLicencePreview(null), null)
  assert.equal(parseLicencePreview('x'), null)
  assert.equal(parseLicencePreview({}), null)
  assert.equal(parseLicencePreview({ ...good, tiers: undefined }), null)
  assert.equal(parseLicencePreview({ ...good, dogUsd: NaN }), null)
  assert.equal(parseLicencePreview({ ...good, btcUsd: 0 }), null)
  for (const t of LICENCE_TIERS) {
    assert.equal(parseLicencePreview({ ...good, tiers: { ...good.tiers, [t]: good.tiers[t] + 1 } }), null, `${t} off by one`)
    assert.equal(parseLicencePreview({ ...good, tiers: { ...good.tiers, [t]: good.tiers[t] + 0.5 } }), null, `${t} fractional`)
    assert.equal(parseLicencePreview({ ...good, tiers: { ...good.tiers, [t]: String(good.tiers[t]) } }), null, `${t} string`)
    assert.equal(parseLicencePreview({ ...good, tiers: { ...good.tiers, [t]: -good.tiers[t] } }), null, `${t} negative`)
    const { [t]: _gone, ...rest } = good.tiers
    assert.equal(parseLicencePreview({ ...good, tiers: rest }), null, `${t} missing`)
  }
  // preços novos com sats velhos: a conta diverge, descarta
  assert.equal(parseLicencePreview({ ...good, btcUsd: BTC_USD * 1.1 }), null)
})

test('without a reliable preview the presets still list the three licences but invent no sats', () => {
  const p = licencePresets(null)
  assert.deepEqual(p.map((x) => x.tier), ['personal', 'commercial', 'patron'])
  assert.ok(p.every((x) => x.sats === null))
})

// ── o que a carteira já conta na escada (rota leve por carteira) ──────────────

test('parseWalletStanding reads the light route answer and rejects junk', () => {
  assert.deepEqual(parseWalletStanding({ address: ORD, tier: 'personal', totalDog: 10_000 }), { totalDog: 10_000, rung: 'personal' })
  assert.deepEqual(parseWalletStanding({ tier: null, totalDog: 0 }), { totalDog: 0, rung: 'citizen' })
  assert.deepEqual(parseWalletStanding({ tier: 'commercial', totalDog: 49_999.99999 }), { totalDog: 49_999.99999, rung: 'personal' })
  for (const bad of [null, undefined, 'x', 7, {}, { totalDog: -1 }, { totalDog: NaN }, { totalDog: Infinity }, { totalDog: '5' }, { error: 'busy' }]) {
    assert.equal(parseWalletStanding(bad), null, JSON.stringify(bad))
  }
})

// ── o que cada degrau pede de uma carteira que já conta DOG ──────────────────

test('licenceOffers: a wallet with nothing pays the full price of every rung', () => {
  const preview = parseLicencePreview(previewJson())
  for (const offers of [licenceOffers(preview, null), licenceOffers(preview, { totalDog: 0, rung: 'citizen' })]) {
    assert.deepEqual(offers.map((o) => o.neededDog), [10_000, 50_000, 500_000])
    assert.deepEqual(offers.map((o) => o.state), ['available', 'available', 'available'])
    assert.deepEqual(offers.map((o) => o.sats), licencePresets(preview).map((p) => p.sats))
  }
})

test('licenceOffers: Personal wallet pays the DIFFERENCE to Commercial and Patron, sats from the quote maths', () => {
  const preview = parseLicencePreview(previewJson())!
  const offers = licenceOffers(preview, { totalDog: 10_000, rung: 'personal' })
  assert.deepEqual(offers.map((o) => o.state), ['held', 'available', 'available'])
  assert.deepEqual(offers.map((o) => o.neededDog), [0, 40_000, 490_000])
  assert.equal(offers[0].sats, null) // o degrau que a carteira já tem não tem preço
  assert.equal(offers[1].sats, licenceSats(40_000, DOG_USD, BTC_USD))
  assert.equal(offers[2].sats, licenceSats(490_000, DOG_USD, BTC_USD))
  // a diferença custa menos que o preço cheio
  assert.ok(offers[1].sats! < licencePresets(preview)[1].sats!)
})

test('licenceOffers: Commercial wallet pays the difference to Patron; Patron wallet holds everything', () => {
  const preview = parseLicencePreview(previewJson())
  const c = licenceOffers(preview, { totalDog: 50_000, rung: 'commercial' })
  assert.deepEqual(c.map((o) => [o.state, o.neededDog]), [['held', 0], ['held', 0], ['available', 450_000]])
  const p = licenceOffers(preview, { totalDog: 500_000, rung: 'patron' })
  assert.ok(p.every((o) => o.state === 'held' && o.neededDog === 0 && o.sats === null))
})

test('licenceOffers marks held rungs with the same comparison licenceFor uses (boundaries and a sweep)', () => {
  const preview = parseLicencePreview(previewJson())
  const held = (total: number) => licenceOffers(preview, { totalDog: total, rung: licenceFor(total) }).filter((o) => o.state === 'held').map((o) => o.tier)
  assert.deepEqual(held(0), [])
  assert.deepEqual(held(9_999.99999), [])
  assert.deepEqual(held(10_000), ['personal'])
  assert.deepEqual(held(49_999.99999), ['personal'])
  assert.deepEqual(held(50_000), ['personal', 'commercial'])
  assert.deepEqual(held(499_999.99999), ['personal', 'commercial'])
  assert.deepEqual(held(500_000), ['personal', 'commercial', 'patron'])
  for (const total of [0, 1, 9_999, 10_000, 12_345, 50_000, 77_777, 499_999, 500_000, 1_000_000, 646.48596 + 16576.31718 + 32777.19686]) {
    const rung = licenceFor(total)
    const reached = LICENCE_TIERS.filter((t) => rung !== 'citizen' && LICENCE_TIERS.indexOf(t) <= LICENCE_TIERS.indexOf(rung as LicenceTier))
    assert.deepEqual(held(total), reached, `total ${total}`)
  }
})

test('licenceOffers without a preview prices nothing, but still says what is still needed', () => {
  const offers = licenceOffers(null, { totalDog: 10_000, rung: 'personal' })
  assert.ok(offers.every((o) => o.sats === null))
  assert.deepEqual(offers.map((o) => o.neededDog), [0, 40_000, 490_000])
})

test('the sats a difference offer shows are exactly what the server quote locks and the cron then counts', async () => {
  const preview = parseLicencePreview(previewJson())!
  const offers = licenceOffers(preview, { totalDog: 10_000, rung: 'personal' })
  const commercial = offers.find((o) => o.tier === 'commercial')!
  // a cotação de um Commercial para quem conta 10.000: a MESMA conta que a tela mostrou
  const b = buildQuote({ id: 'qd', tier: 'commercial', ordinalsAddress: ORD, paymentAddress: PAY, dog: ok(DOG_USD), btc: ok(BTC_USD), nowMs: T0, heldDog: 10_000 })
  assert.equal(b.ok, true)
  const q = (b as { quote: Quote }).quote
  assert.equal(q.sats, commercial.sats)
  assert.equal(q.dogAmount, commercial.neededDog)
  const r = await resolvePayment(pay(commercial.sats!), [q], noPrice)
  assert.equal(r.status, 'credited')
  if (r.status === 'credited') assert.equal(licenceFor(combineWallet(10_000, r.creditDog)), 'commercial')
})

// ── BIP-21: o amount é BTC decimal, nunca satoshi ────────────────────────────

const ADDR = 'bc1qkq43gqyr7gjzj0mxz0v7e0nzs3cm59g9jspc63'
const amountOf = (uri: string) => new URL(uri.replace('bitcoin:', 'bitcoin://')).searchParams.get('amount')

test('bip21Uri carries BTC with a decimal point, never the satoshi integer', () => {
  assert.equal(amountOf(bip21Uri(ADDR, 105_000)), '0.00105')
  assert.equal(amountOf(bip21Uri(ADDR, 1)), '0.00000001')
  assert.equal(amountOf(bip21Uri(ADDR, 100_000_000)), '1')
  assert.equal(amountOf(bip21Uri(ADDR, 150_000_000)), '1.5')
  assert.equal(amountOf(bip21Uri(ADDR, 56_250)), '0.0005625')
  for (const t of LICENCE_TIERS) {
    const sats = satsForDog(LICENCE_DOG[t], DOG_USD, BTC_USD)!
    const amount = amountOf(bip21Uri(ADDR, sats))!
    assert.ok(/^\d+(\.\d{1,8})?$/.test(amount), amount)
    assert.ok(Number(amount) < 1 || sats >= 1e8)
    assert.equal(Math.round(Number(amount) * 1e8), sats, `${t} round trip`)
    assert.notEqual(amount, String(sats))
  }
})

test('bip21Uri leaves the amount out when there is nothing to pay, and keeps address and label', () => {
  for (const s of [0, -5, NaN]) assert.equal(amountOf(bip21Uri(ADDR, s)), null, String(s))
  const uri = bip21Uri(ADDR, 1000)
  assert.ok(uri.startsWith(`bitcoin:${ADDR}?`))
  assert.ok(uri.includes('label=DogCity%20construction%20fund'))
})

// ── a janela usa os módulos puros, nada mais calcula preço ───────────────────

test('the donate modal has no generic sats presets left and takes BTC amounts only from the quote logic', () => {
  const src = readFileSync(new URL('../../components/donate/donate-modal.tsx', import.meta.url), 'utf8')
  assert.ok(!/SATS_PRESETS/.test(src), 'generic SATS_PRESETS must be gone')
  assert.ok(!/200_000/.test(src), 'the old 200,000 sats chip must be gone')
  assert.ok(/licenceOffers\(/.test(src) && /parseLicencePreview\(/.test(src), 'presets come from lib/dog/licence-presets')
  assert.ok(!/donate\/leaderboard/.test(src), 'the modal must not download the whole leaderboard')
  assert.ok(/licence-standing\?address=/.test(src), 'the modal reads one wallet from the light route')
  assert.ok(!/use \$DOG\./.test(src), 'the old use-$DOG-for-the-difference warning is gone')
  assert.ok(/from '@\/lib\/wallet\/bip21'/.test(src), 'BIP-21 comes from the tested module')
  assert.ok(!/function bip21Uri/.test(src), 'no second copy of bip21Uri')
})
