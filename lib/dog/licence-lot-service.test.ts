// Rodar: npx tsx --test lib/dog/licence-lot-service.test.ts
//
// A LICENÇA NO LOTE ligada ao banco e ao mint (12/11/2026), com um banco EM MEMÓRIA que imita a função
// dogcity_licence_apply da migração 037 (troca condicional pela soma já aplicada, `ref` único, a soma do
// lote andando junto). Cobre: o standing compatível e o gatilho de aplicação (1 lote, 0, 2, mint mudo,
// reserva do snapshot), o modo antigo sem as tabelas, duas leituras ao mesmo tempo aplicando uma vez,
// a cotação por lote (403, 409 do lote, subir pela diferença do lote, `lotId` gravado) e a varredura
// (BTC com lote primeiro, rodízio das perguntas ao mint). Dado SIMULADO.
import test from 'node:test'
import assert from 'node:assert/strict'
import type { TxRow } from './founders-ledger'
import { FUND_DOG_ADDRESS, licenceSats, type Quote } from './licence-btc'
import { atomsOf, btcRef, dogOfAtoms, type Application, type Assignment, type CreditedPayment, type MintHolder } from './licence-lot'
import { SemTabela, heldParaCotacao, passeDosLotes, standingDaCarteira, type LotDeps, type LotLicenceCronStore } from './licence-lot-service'
import { createQuote, type QuoteStore } from './licence-quote'

const A = 'bc1p' + 'a'.repeat(58)
const B = 'bc1p' + 'b'.repeat(58)
const C = 'bc1p' + 'c'.repeat(58)
const L1 = 'S01-Q00-B0001-L001'
const L2 = 'S02-Q01-B0123-L045'
const W = FUND_DOG_ADDRESS
const TX = 'e'.repeat(64)

const at = (dog: number) => Math.round(dog * 100_000)
let seq = 0
const doacao = (from: string, dog: number): TxRow => {
  seq++
  return {
    id: seq, txid: `t${seq}`, block_height: 100 + seq, timestamp: '2026-11-12T00:00:00Z',
    senders: [{ address: from, amount: at(dog) }], receivers: [{ address: W, amount: at(dog) }],
  }
}

// ── o banco em memória ──────────────────────────────────────────────────────

function memDb(init: { rows?: TxRow[]; credited?: CreditedPayment[]; quoteLots?: [string, string][]; assignments?: Assignment[]; semTabela?: boolean; lentoMs?: number } = {}) {
  const db = {
    rows: [...(init.rows ?? [])],
    credited: [...(init.credited ?? [])],
    quoteLots: new Map(init.quoteLots ?? []),
    assignments: [...(init.assignments ?? [])],
    applyCalls: 0,
  }
  const lots = () => {
    const m = new Map<string, number>()
    for (const a of db.assignments) m.set(a.lotId, dogOfAtoms((atomsOf(m.get(a.lotId)) ) + atomsOf(a.amountDog)))
    return m
  }
  const toca = (row: TxRow, w: string) =>
    [...(row.senders as any[]), ...(row.receivers as any[])].some((x) => x.address === w)
  const espera = () => (init.lentoMs ? new Promise((r) => setTimeout(r, init.lentoMs)) : Promise.resolve())
  const sem = () => { if (init.semTabela) throw new SemTabela() }
  const store: LotLicenceCronStore = {
    async fundRowsOf(address) { await espera(); return db.rows.filter((r) => toca(r, address)) },
    async creditedOf(address) { return db.credited.filter((c) => c.ordinalsAddress === address) },
    async quoteLots(ids) { sem(); return new Map([...db.quoteLots].filter(([k]) => ids.includes(k))) },
    async assignmentsOf(wallet) { sem(); return db.assignments.filter((a) => a.wallet === wallet).map((a) => ({ ...a })) },
    async lotTotals(ids) { sem(); const m = lots(); return new Map([...m].filter(([k]) => ids.includes(k))) },
    // a mesma regra de dogcity_licence_apply: soma aplicada tem de ser a que o chamador viu; ref único
    async apply(wallet: string, app: Application, before: number) {
      sem()
      db.applyCalls++
      await Promise.resolve()
      const aplicado = db.assignments.filter((a) => a.wallet === wallet).reduce((s, a) => s + atomsOf(a.amountDog), 0)
      if (aplicado !== atomsOf(before) && !(aplicado === 0 && before === 0)) return false
      if (app.ref && db.assignments.some((a) => a.ref === app.ref)) return false
      assert.ok(app.amountDog > 0 && !app.lotId.startsWith('S08-'), 'o check do banco')
      db.assignments.push({ ...app, wallet })
      return true
    },
    async allFundRows() { return db.rows },
    async allCredited() { return db.credited },
    async allAssignments() { sem(); return db.assignments.map((a) => ({ ...a })) },
  }
  return { db, store, lots }
}

function deps(store: LotLicenceCronStore, holders: Record<string, MintHolder | null>, snapshot: Record<string, string | null | undefined> = {}) {
  const perguntas: string[] = []
  const d: LotDeps = {
    store,
    holder: async (a) => { perguntas.push(a); return a in holders ? holders[a] : null },
    snapshotLot: async (a) => (a in snapshot ? snapshot[a] : null),
  }
  return { d, perguntas }
}

const silencio = async <T>(fn: () => Promise<T>) => {
  const e = console.error
  console.error = () => {}
  try { return await fn() } finally { console.error = e }
}

// ── standing ────────────────────────────────────────────────────────────────

test('standing: sem as tabelas da 037 é o modo antigo (licença por carteira) e nada é aplicado', async () => {
  const { store, db } = memDb({ rows: [doacao(A, 12_000)], semTabela: true })
  const { d } = deps(store, { [A]: { lots: [L1], snapshotLot: null } })
  const s = await standingDaCarteira(d, A)
  assert.deepEqual(s, { tier: 'personal', totalDog: 12_000, lots: null, unassignedDog: null, lotsFrom: null })
  assert.equal(db.applyCalls, 0)
})

test('standing: o gatilho aplica o livre no único lote, e a segunda leitura não aplica de novo', async () => {
  const { store, db } = memDb({ rows: [doacao(A, 12_000)] })
  const { d } = deps(store, { [A]: { lots: [], snapshotLot: L1 } })
  const s = await standingDaCarteira(d, A)
  assert.deepEqual(s, { tier: 'personal', totalDog: 12_000, lots: [{ lot: L1, tier: 'personal', totalDog: 12_000 }], unassignedDog: 0, lotsFrom: 'mint' })
  assert.deepEqual(db.assignments, [{ lotId: L1, wallet: A, amountDog: 12_000, source: 'dog', ref: null }])
  await standingDaCarteira(d, A)
  assert.equal(db.assignments.length, 1)
  // apply: false só lê
  db.rows.push(doacao(A, 40_000))
  const leitura = await standingDaCarteira(d, A, { apply: false })
  assert.deepEqual([leitura?.tier, leitura?.totalDog, leitura?.unassignedDog], ['personal', 52_000, 40_000])
  assert.equal(db.assignments.length, 1)
})

test('standing: nenhum lote espera, dois lotes esperam a escolha; a carteira leva a licença mais alta', async () => {
  const { store, db } = memDb({
    rows: [doacao(A, 10_000), doacao(B, 3_000)],
    assignments: [{ lotId: L2, wallet: C, amountDog: 60_000, source: 'migration', ref: 'migration:' + C }],
  })
  const { d } = deps(store, { [A]: { lots: [], snapshotLot: null }, [B]: { lots: [L1, L2], snapshotLot: null } })
  const semLote = await standingDaCarteira(d, A)
  assert.deepEqual(semLote, { tier: null, totalDog: 10_000, lots: [], unassignedDog: 10_000, lotsFrom: 'mint' })
  const doisLotes = await standingDaCarteira(d, B)
  assert.equal(doisLotes?.tier, 'commercial', 'o lote L2 tem a licença que C pagou; B guarda L2 agora')
  assert.deepEqual(doisLotes?.lots, [{ lot: L2, tier: 'commercial', totalDog: 60_000 }, { lot: L1, tier: null, totalDog: 0 }])
  assert.equal(doisLotes?.unassignedDog, 3_000)
  assert.equal(db.applyCalls, 0)
})

test('standing: mint mudo mostra o lote pela reserva do snapshot e NÃO aplica; sem reserva legível, null', async () => {
  const { store, db } = memDb({ rows: [doacao(A, 10_000)], assignments: [{ lotId: L1, wallet: A, amountDog: 10_000, source: 'migration', ref: 'migration:' + A }] })
  db.rows.push(doacao(A, 40_000))
  const { d } = deps(store, {}, { [A]: L1 })
  const s = await standingDaCarteira(d, A)
  assert.deepEqual(s, { tier: 'personal', totalDog: 50_000, lots: [{ lot: L1, tier: 'personal', totalDog: 10_000 }], unassignedDog: 40_000, lotsFrom: 'snapshot' })
  assert.equal(db.applyCalls, 0, 'reserva não manda aplicar')
  const cego = deps(store, {}, { [A]: undefined })
  assert.equal(await silencio(() => standingDaCarteira(cego.d, A)), null)
})

test('standing: BTC com lote nomeado cai no lote mesmo com o mint mudo', async () => {
  const pago: CreditedPayment = { txid: TX, vout: 0, ordinalsAddress: B, creditDog: 50_000, quoteId: 'q1' }
  const { store, db } = memDb({ credited: [pago], quoteLots: [['q1', L2]] })
  const { d } = deps(store, {}, { [B]: null })
  const s = await standingDaCarteira(d, B)
  assert.deepEqual(db.assignments, [{ lotId: L2, wallet: B, amountDog: 50_000, source: 'btc', ref: btcRef(TX, 0) }])
  assert.equal(s?.unassignedDog, 0)
})

test('standing: duas leituras ao mesmo tempo aplicam UMA vez (troca condicional)', async () => {
  const { store, db } = memDb({ rows: [doacao(A, 10_000)] })
  const { d } = deps(store, { [A]: { lots: [L1], snapshotLot: null } })
  const [s1, s2] = await Promise.all([standingDaCarteira(d, A), standingDaCarteira(d, A)])
  assert.equal(db.assignments.length, 1)
  assert.equal(db.applyCalls, 2, 'as duas tentaram; o banco recusou a segunda')
  for (const s of [s1, s2]) assert.equal(s?.tier, 'personal')
})

test('standing: banco lento estoura o prazo e responde null, nunca licença inventada', async () => {
  const { store } = memDb({ rows: [doacao(A, 10_000)], lentoMs: 200 })
  const { d } = deps(store, { [A]: { lots: [L1], snapshotLot: null } })
  assert.equal(await standingDaCarteira(d, A, { ms: 20 }), null)
})

// ── cotação por lote ────────────────────────────────────────────────────────

test('cotação: com lote, só o dono (pelo mint); sem mint não se cota', async () => {
  const { store } = memDb({ rows: [doacao(A, 5_000)] })
  const { d } = deps(store, { [A]: { lots: [L1], snapshotLot: null } })
  assert.equal(await heldParaCotacao(d, A, L2), 'not_holder')
  const mudo = deps(store, {}, { [A]: L1 })
  assert.equal(await heldParaCotacao(mudo.d, A, L1), null)
})

test('cotação: subir paga a diferença do LOTE (o que o dono anterior pagou fica no lote)', async () => {
  // A pagou Personal no lote L1 (migração) e vendeu a escritura para B; B não tem crédito nenhum
  const { store, db } = memDb({ rows: [doacao(A, 10_000)], assignments: [{ lotId: L1, wallet: A, amountDog: 10_000, source: 'migration', ref: 'migration:' + A }] })
  const { d } = deps(store, { [B]: { lots: [L1], snapshotLot: null }, [A]: { lots: [], snapshotLot: null } })
  assert.equal(await heldParaCotacao(d, B, L1), 10_000)
  assert.equal(await heldParaCotacao(d, B, null), 10_000, 'pedido antigo, sem lote: o único lote de B')
  // B tinha 2.000 livres e só um lote: a automática os põe em L1 antes de cotar
  db.rows.push(doacao(B, 2_000))
  assert.equal(await heldParaCotacao(d, B, L1), 12_000)
  assert.equal(db.assignments.at(-1)?.wallet, B)
  // A não guarda mais nada: o crédito dele está no lote que vendeu
  assert.equal(await heldParaCotacao(d, A, null), 0)
})

test('cotação: com dois lotes o livre espera a escolha e não abate a diferença do lote pedido', async () => {
  const { store, db } = memDb({ rows: [doacao(A, 5_000)], assignments: [{ lotId: L2, wallet: C, amountDog: 10_000, source: 'migration', ref: 'migration:' + C }] })
  const { d } = deps(store, { [A]: { lots: [L1, L2], snapshotLot: null } })
  assert.equal(await heldParaCotacao(d, A, L2), 10_000)
  assert.equal(await heldParaCotacao(d, A, L1), 0)
  assert.equal(db.applyCalls, 0)
})

test('cotação: sem as tabelas da 037, por carteira como antes; com lote, 503', async () => {
  const { store } = memDb({ rows: [doacao(A, 12_000)], semTabela: true })
  const { d } = deps(store, { [A]: { lots: [L1], snapshotLot: null } })
  assert.equal(await heldParaCotacao(d, A, null), 12_000)
  assert.equal(await heldParaCotacao(d, A, L1), null)
})

test('cotação: BTC que não se lê é 503 (quem cobra precisa dele)', async () => {
  const { store } = memDb({ rows: [doacao(A, 12_000)] })
  store.creditedOf = async () => { throw new Error('boom') }
  const { d } = deps(store, { [A]: { lots: [L1], snapshotLot: null } })
  assert.equal(await silencio(() => heldParaCotacao(d, A, L1)), null)
  // o standing (só exibe) segue com o $DOG
  assert.equal((await silencio(() => standingDaCarteira(d, A, { apply: false })))?.totalDog, 12_000)
})

// ── createQuote com lotId ───────────────────────────────────────────────────

const DOG_USD = 0.0009
const BTC_USD = 80_000
const ok = (price: number) => ({ ok: true as const, price, sources: [{ name: 'A', price }, { name: 'B', price }] })
const medians = async () => ({ dog: ok(DOG_USD), btc: ok(BTC_USD) })
const PAY = 'bc1q' + 'p'.repeat(38)
function quoteStore() {
  const inserted: Quote[] = []
  const store: QuoteStore = { countSince: async () => 0, insert: async (q) => { inserted.push(q) } }
  return { store, inserted }
}

test('createQuote: o lote vai para quem calcula, para a cotação gravada e para a resposta', async () => {
  const { store, inserted } = quoteStore()
  const pedidos: [string, string | null][] = []
  const heldDog = async (a: string, lot: string | null) => { pedidos.push([a, lot]); return 10_000 }
  const r = await createQuote({ store, medians, heldDog, nowMs: 0, newId: () => 'q' }, { tier: 'commercial', ordinalsAddress: B, paymentAddress: PAY, lotId: ' s01-q00-b0001-l001 ' })
  assert.equal(r.ok, true)
  assert.deepEqual(pedidos, [[B, L1]])
  assert.equal(inserted[0].lotId, L1)
  assert.equal(inserted[0].dogAmount, 40_000)
  if (r.ok) {
    assert.equal(r.quote.lotId, L1)
    assert.equal(r.quote.sats, licenceSats(40_000, DOG_USD, BTC_USD))
  }
  // sem lote: o pedido antigo, e nada de lotId na cotação
  const sem = await createQuote({ store, medians, heldDog, nowMs: 0, newId: () => 'q2' }, { tier: 'commercial', ordinalsAddress: B, paymentAddress: PAY })
  assert.equal(sem.ok, true)
  assert.deepEqual(pedidos[1], [B, null])
  assert.equal('lotId' in inserted[1], false)
  assert.equal(sem.ok && 'lotId' in sem.quote, false)
})

test('createQuote: lote ruim 400, setor 8 400, não é o dono 403, lote que já tem o degrau 409; nada gravado', async () => {
  const { store, inserted } = quoteStore()
  const run = (lotId: unknown, held: number | null | 'not_holder' = 0, tier = 'personal') =>
    createQuote({ store, medians, heldDog: async () => held, nowMs: 0, newId: () => 'x' }, { tier, ordinalsAddress: B, paymentAddress: PAY, lotId })
  assert.deepEqual(await run('lixo').then((r) => [r.status, !r.ok && r.error]), [400, 'lotId must be a DogCity lot id'])
  assert.deepEqual(await run(7).then((r) => r.status), 400)
  assert.deepEqual(await run('S08-Q00-B0002-L004').then((r) => [r.status, !r.ok && r.error]), [400, 'this lot does not take a building licence'])
  assert.deepEqual(await run(L1, 'not_holder').then((r) => [r.status, !r.ok && r.error]), [403, 'this wallet does not hold this lot'])
  assert.deepEqual(await run(L1, 10_000).then((r) => [r.status, !r.ok && r.error]), [409, 'this lot already holds this licence'])
  assert.deepEqual(await run(L1, 50_000, 'commercial').then((r) => r.status), 409)
  assert.deepEqual(await run(L1, null).then((r) => r.status), 503)
  assert.equal(inserted.length, 0)
  // lotId vazio ou null é o pedido antigo
  assert.equal((await run('', 0)).status, 200)
  assert.equal((await run(null, 0)).status, 200)
})

// ── a varredura ─────────────────────────────────────────────────────────────

test('varredura: BTC com lote primeiro, sem perguntar ao mint; depois a automática onde há um lote', async () => {
  const pago: CreditedPayment = { txid: TX, vout: 1, ordinalsAddress: B, creditDog: 40_000, quoteId: 'q9' }
  const { store, db } = memDb({ rows: [doacao(A, 10_000), doacao(B, 5_000), doacao(C, 7_000)], credited: [pago], quoteLots: [['q9', L2]] })
  const perguntas: string[] = []
  const holders: Record<string, MintHolder> = { [A]: { lots: [], snapshotLot: L1 }, [B]: { lots: [L2, 'S03-Q00-B0001-L001'], snapshotLot: null }, [C]: { lots: [], snapshotLot: null } }
  const r = await passeDosLotes({ store, holder: async (a) => { perguntas.push(a); return holders[a] ?? null }, nowMs: 0 })
  assert.deepEqual(db.assignments.find((a) => a.source === 'btc'), { lotId: L2, wallet: B, amountDog: 40_000, source: 'btc', ref: btcRef(TX, 1) })
  assert.deepEqual(db.assignments.find((a) => a.wallet === A), { lotId: L1, wallet: A, amountDog: 10_000, source: 'dog', ref: null })
  assert.equal(db.assignments.length, 2, 'B (dois lotes) e C (nenhum) esperam')
  assert.deepEqual(perguntas.sort(), [A, B, C].sort())
  assert.deepEqual({ direct: r.direct, automatic: r.automatic, manyLots: r.manyLots, noLot: r.noLot, checked: r.checked, stale: r.stale }, { direct: 1, automatic: 1, manyLots: 1, noLot: 1, checked: 3, stale: 0 })
  // a segunda volta não aplica nada de novo
  const r2 = await passeDosLotes({ store, holder: async (a) => holders[a] ?? null, nowMs: 0 })
  assert.equal(db.assignments.length, 2)
  assert.deepEqual([r2.direct, r2.automatic, r2.checked], [0, 0, 2])
})

test('varredura: perguntas ao mint limitadas por volta, em rodízio até todas passarem', async () => {
  const carteiras = Array.from({ length: 7 }, (_, i) => 'bc1p' + String.fromCharCode(103 + i).repeat(58))
  const { store } = memDb({ rows: carteiras.map((w) => doacao(w, 1_000)) })
  const vistas = new Set<string>()
  for (let volta = 0; volta < 4; volta++) {
    const r = await passeDosLotes({ store, holder: async (a) => { vistas.add(a); return null }, nowMs: volta * 120_000, maxHolderChecks: 2 })
    assert.equal(r.checked, 2)
    assert.equal(r.holderUnknown, 7, '2 perguntadas sem resposta + 5 fora da vez')
  }
  assert.equal(vistas.size, 7)
})

test('varredura: sem as tabelas da 037 não faz nada', async () => {
  const { store } = memDb({ rows: [doacao(A, 10_000)], semTabela: true })
  const r = await passeDosLotes({ store, holder: async () => ({ lots: [L1], snapshotLot: null }), nowMs: 0 })
  assert.equal(r.skipped, 'no_tables')
})
