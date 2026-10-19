// Run: npx tsx --test lib/dog/mint-b.test.ts
//
// O detector do bloco B com dado SIMULADO (alturas e valores inventados, só para
// cobrir as bordas): cruzamento exato, várias transações no mesmo bloco, ainda
// não cruzou, transação sem confirmação não conta. Mais a ponta a ponta pelo
// livro (buildLedger), que é o que a rota usa.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildLedger, type TxRow } from './founders-ledger'
import { buildBResult, detectB, DONATION_WALLET, DOG_GOAL, GOAL_ATOMOS, type BContribution } from './mint-b'

const DOG = 100_000n
const c = (bloco: number, txid: string, dog: bigint, frac = 0n): BContribution => ({ bloco, txid, fundoAtomos: dog * DOG + frac })

test('a meta em átomos é 10.000.000 DOG exatos', () => {
  assert.equal(GOAL_ATOMOS, 1_000_000_000_000n)
  assert.equal(DOG_GOAL, 10_000_000)
})

test('cruzamento exato: a meta é atingida com igualdade, no bloco da transação que fecha', () => {
  const r = detectB([c(100, 'a', 4_000_000n), c(101, 'b', 5_000_000n), c(105, 'c', 1_000_000n), c(106, 'd', 50n)])
  assert.equal(r.found?.B, 105)
  assert.equal(r.found?.txid, 'c')
  assert.equal(r.found?.raisedAtBAtomos, GOAL_ATOMOS)
  assert.equal(r.totalAtomos, GOAL_ATOMOS + 50n * DOG)
})

test('um átomo a menos não cruza; um átomo a mais no bloco seguinte cruza ali', () => {
  const quase = detectB([c(100, 'a', 9_999_999n, 99_999n)])
  assert.equal(quase.found, null)
  const depois = detectB([c(100, 'a', 9_999_999n, 99_999n), c(101, 'b', 0n, 1n)])
  assert.equal(depois.found?.B, 101)
  assert.equal(depois.found?.txid, 'b')
})

test('várias transações no mesmo bloco: B é o bloco, raisedAtB é o bloco inteiro, txid a que cruzou', () => {
  const r = detectB([
    c(100, 'a', 9_000_000n),
    c(200, 'b', 600_000n), // 9.6M
    c(200, 'c', 500_000n), // 10.1M: cruza aqui
    c(200, 'd', 250_000n), // ainda no bloco 200: entra no raisedAtB
    c(201, 'e', 999n),     // bloco seguinte: fica fora
  ])
  assert.equal(r.found?.B, 200)
  assert.equal(r.found?.txid, 'c')
  assert.equal(r.found?.raisedAtBAtomos, 10_350_000n * DOG)
})

test('uma única transação gigante cruza sozinha', () => {
  const r = detectB([c(300, 'x', 10_500_000n)])
  assert.equal(r.found?.B, 300)
  assert.equal(r.found?.txid, 'x')
  assert.equal(r.found?.raisedAtBAtomos, 10_500_000n * DOG)
})

test('ainda não cruzou: sem B, com o total arrecadado', () => {
  const r = detectB([c(100, 'a', 4_000_000n), c(101, 'b', 5_887_345n, 60_701n)])
  assert.equal(r.found, null)
  const res = buildBResult(r.found, r.totalAtomos, 971_954)
  assert.equal(res.B, null)
  assert.equal(res.txid, null)
  assert.equal(res.raisedAtB, null)
  assert.equal(res.confirmations, null)
  assert.equal(res.goal, DOG_GOAL)
  assert.equal(res.raised, 9_887_345.60701)
  assert.deepEqual(detectB([]), { found: null, totalAtomos: 0n })
})

test('sem confirmação não conta: altura ausente, zero ou inválida fica fora da soma', () => {
  const sujas = [
    c(0, 'mempool', 5_000_000n),
    c(-1, 'neg', 5_000_000n),
    { bloco: Number.NaN, txid: 'nan', fundoAtomos: 5_000_000n * DOG },
    { bloco: null as unknown as number, txid: 'nulo', fundoAtomos: 5_000_000n * DOG },
    c(100, 'ok', 9_000_000n),
  ]
  const r = detectB(sujas)
  assert.equal(r.found, null)
  assert.equal(r.totalAtomos, 9_000_000n * DOG)
  // e é a transação confirmada que fecha, não a sem altura
  const fecha = detectB([...sujas, c(150, 'fecha', 1_000_000n)])
  assert.equal(fecha.found?.B, 150)
  assert.equal(fecha.found?.txid, 'fecha')
})

test('entrada fora de ordem: o B continua o primeiro bloco que chega à meta', () => {
  const r = detectB([c(300, 'z', 2_000_000n), c(100, 'a', 8_000_000n), c(200, 'm', 1n)])
  assert.equal(r.found?.B, 300) // 8M + 1 em 200 ainda não é 10M; 300 fecha
  assert.equal(r.found?.txid, 'z')
  assert.equal(r.found?.raisedAtBAtomos, 10_000_001n * DOG)
})

test('confirmações: ponta - B + 1, o próprio B é a primeira', () => {
  const found = { B: 971_900, txid: 't', raisedAtBAtomos: GOAL_ATOMOS + 250n * DOG }
  assert.equal(buildBResult(found, GOAL_ATOMOS, 971_900).confirmations, 1)
  assert.equal(buildBResult(found, GOAL_ATOMOS, 971_905).confirmations, 6)
  assert.equal(buildBResult(found, GOAL_ATOMOS, null).confirmations, null)
  assert.equal(buildBResult(found, GOAL_ATOMOS, 971_890).confirmations, 0) // ponta atrás de B: nunca negativo
  const r = buildBResult(found, GOAL_ATOMOS + 300n * DOG, 971_905)
  assert.equal(r.B, 971_900)
  assert.equal(r.txid, 't')
  assert.equal(r.raisedAtB, 10_000_250)
  assert.equal(r.raised, 10_000_300)
})

// ── ponta a ponta pelo livro, com linhas no formato de dog_transactions ──────
const DOADOR = 'bc1pdmpwsprd9dycdu3kxawz4r28hnk7qlzeaj5c6kd63jv2cdqzs9zq4utlqm'
const row = (id: number, txid: string, block_height: number, dog: number): TxRow => ({
  id, txid, block_height, timestamp: '2026-10-01T00:00:00Z',
  senders: [{ address: DOADOR, amount: dog * 100_000 + 700, has_dog: true }],
  receivers: [
    { address: DONATION_WALLET, amount: dog * 100_000, vout: 1 },
    { address: DOADOR, amount: 700, vout: 2 }, // troco: não é doação
  ],
})
const ledgerDe = (rows: TxRow[]) => {
  const L = buildLedger(rows.filter((r) => Number.isSafeInteger(r.block_height) && r.block_height > 0), DONATION_WALLET, { licenseFor: () => '', posicoes: {} })
  return detectB(L.contributions)
}

test('pelo livro: troco não conta, e o total bate com o que o placar soma', () => {
  const rows = [row(1, 'tx1', 500, 6_000_000), row(2, 'tx2', 510, 4_000_000), row(3, 'tx3', 511, 12_345)]
  const { found, totalAtomos } = ledgerDe(rows)
  assert.equal(found?.B, 510)
  assert.equal(found?.txid, 'tx2')
  assert.equal(found?.raisedAtBAtomos, GOAL_ATOMOS)
  assert.equal(totalAtomos, GOAL_ATOMOS + 12_345n * DOG)
})

test('pelo livro: a mesma transação repetida na leitura não conta duas vezes', () => {
  const rows = [row(1, 'tx1', 500, 6_000_000), row(1, 'tx1', 500, 6_000_000), row(2, 'tx2', 510, 3_999_999)]
  const { found, totalAtomos } = ledgerDe(rows)
  assert.equal(found, null)
  assert.equal(totalAtomos, 9_999_999n * DOG)
})

test('pelo livro: a carteira do fundo gastando não é doação', () => {
  const retirada: TxRow = {
    id: 9, txid: 'saida', block_height: 520, timestamp: '2026-10-02T00:00:00Z',
    senders: [{ address: DONATION_WALLET, amount: 50_000_000_000 }],
    receivers: [{ address: DONATION_WALLET, amount: 49_000_000_000 }, { address: DOADOR, amount: 1_000_000_000 }],
  }
  const { found, totalAtomos } = ledgerDe([row(1, 'tx1', 500, 6_000_000), retirada])
  assert.equal(found, null)
  assert.equal(totalAtomos, 6_000_000n * DOG)
})

test('a carteira e a meta da rota nova são as mesmas do placar (leaderboard)', () => {
  const src = readFileSync(new URL('../../app/api/donate/leaderboard/route.ts', import.meta.url), 'utf8')
  assert.ok(src.includes(`const DONATION_WALLET = '${DONATION_WALLET}'`), 'carteira do fundo divergiu do leaderboard')
  assert.ok(src.includes('const DOG_GOAL = 10_000_000'), 'meta divergiu do leaderboard')
})
