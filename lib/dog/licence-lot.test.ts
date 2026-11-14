// Rodar: npx tsx --test lib/dog/licence-lot.test.ts
//
// A LICENÇA NO LOTE (fundador, 12/11/2026), a conta pura: crédito livre, aplicação automática com um lote,
// nenhum lote e dois lotes, o BTC com lote nomeado primeiro e uma vez só, subir de nível por lote, a
// resposta do mint conferida, o `totalDog` compatível do standing, o total de todas as carteiras igual ao
// do placar, e a migração única (carteira com licença -> o lote do snapshot). Dado SIMULADO.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildLedger, type TxRow } from './founders-ledger'
import { FUND_DOG_ADDRESS, LICENCE_DOG, applyBtcCredits, licenceFor, type Credit } from './licence-btc'
import {
  atomsOf, btcRef, directBtcOf, heldLotsOf, lotTakesLicence, normalizeLotId, planWallet, planoDeMigracao, readMintHolder,
  sqlDaMigracao, standingOfLots, tierOfLot, walletTotals,
  type Assignment, type CreditedPayment, type DirectBtc,
} from './licence-lot'
import { standingOfWallet } from './licence-wallet'

const A = 'bc1p' + 'a'.repeat(58)
const B = 'bc1p' + 'b'.repeat(58)
const C = 'bc1q' + 'c'.repeat(38)
const L1 = 'S01-Q00-B0001-L001'
const L2 = 'S02-Q01-B0123-L045'
const L3 = 'S09-Q00-B0063-L002'
const S8 = 'S08-Q00-B0002-L004'
const TX = 'f'.repeat(64)

const asg = (wallet: string, lotId: string, amountDog: number, source: Assignment['source'] = 'dog', ref: string | null = null): Assignment =>
  ({ wallet, lotId, amountDog, source, ref })

// ── lote ────────────────────────────────────────────────────────────────────

test('lote: id canônico, setor 8 nunca leva licença', () => {
  assert.equal(normalizeLotId(' s01-q00-b0001-l001 '), L1)
  assert.equal(normalizeLotId('S01-Q00-B01-L001'), null)
  assert.equal(normalizeLotId(123), null)
  assert.equal(normalizeLotId('S01-Q00-B0001-L001; drop table'), null)
  assert.equal(lotTakesLicence(L1), true)
  assert.equal(lotTakesLicence(S8), false)
  assert.equal(lotTakesLicence('lixo'), false)
})

test('degrau do lote: as faixas do placar, em átomos', () => {
  assert.equal(tierOfLot(9_999.99999), null)
  assert.equal(tierOfLot(10_000), 'personal')
  assert.equal(tierOfLot(6_000.1 + 3_999.9), 'personal') // 9999.999999999998 em ponto flutuante
  assert.equal(tierOfLot(49_999.99999), 'personal')
  assert.equal(tierOfLot(50_000), 'commercial')
  assert.equal(tierOfLot(500_000), 'patron')
  assert.equal(tierOfLot('500000.00000'), 'patron') // numeric do banco chega como texto às vezes
  assert.equal(tierOfLot(NaN), null)
  assert.equal(tierOfLot(-1), null)
})

// ── crédito livre e aplicação automática ────────────────────────────────────

test('crédito livre = o que a carteira conta menos o que já aplicou', () => {
  const p = planWallet({ totalDog: 60_000, assignments: [asg(A, L1, 10_000, 'migration', 'migration:' + A)], directBtc: [], heldLots: null })
  assert.equal(p.why, 'holder_unknown')
  assert.equal(p.unassignedDog, 50_000)
  assert.deepEqual(p.applications, [])
  // nunca negativo, mesmo se o banco tiver mais aplicado do que a conta mostra
  assert.equal(planWallet({ totalDog: 5_000, assignments: [asg(A, L1, 10_000)], directBtc: [], heldLots: [L1] }).unassignedDog, 0)
})

test('automática: exatamente um lote recebe todo o livre', () => {
  const p = planWallet({ totalDog: 10_000, assignments: [], directBtc: [], heldLots: [L1] })
  assert.equal(p.why, 'applied')
  assert.deepEqual(p.applications, [{ lotId: L1, amountDog: 10_000, source: 'dog', ref: null }])
  assert.equal(p.unassignedDog, 0)
  // o snapshotLot do mint conta como lote: heldLotsOf junta e tira repetido
  const h = heldLotsOf({ lots: [], snapshotLot: L1 })
  assert.deepEqual(planWallet({ totalDog: 10_000, assignments: [], directBtc: [], heldLots: h }).applications.map((a) => a.lotId), [L1])
  assert.deepEqual(heldLotsOf({ lots: [L1], snapshotLot: L1 }), [L1])
})

test('automática: nenhum lote espera um lote; dois ou mais esperam a escolha; mint mudo não aplica', () => {
  const nenhum = planWallet({ totalDog: 10_000, assignments: [], directBtc: [], heldLots: [] })
  assert.deepEqual([nenhum.why, nenhum.applications.length, nenhum.unassignedDog], ['no_lot', 0, 10_000])
  const dois = planWallet({ totalDog: 10_000, assignments: [], directBtc: [], heldLots: [L1, L2] })
  assert.deepEqual([dois.why, dois.applications.length, dois.unassignedDog], ['many_lots', 0, 10_000])
  const mudo = planWallet({ totalDog: 10_000, assignments: [], directBtc: [], heldLots: null })
  assert.deepEqual([mudo.why, mudo.applications.length], ['holder_unknown', 0])
  // lote do setor 8 não conta como lote (nunca leva licença): sobra um, e é nele que aplica
  const s8 = planWallet({ totalDog: 10_000, assignments: [], directBtc: [], heldLots: [S8, L1] })
  assert.deepEqual(s8.applications.map((a) => a.lotId), [L1])
  assert.equal(planWallet({ totalDog: 10_000, assignments: [], directBtc: [], heldLots: [S8] }).why, 'no_lot')
})

test('automática: nada livre, nada a fazer; o valor sai em átomos inteiros', () => {
  assert.equal(planWallet({ totalDog: 10_000, assignments: [asg(A, L1, 10_000)], directBtc: [], heldLots: [L1] }).why, 'nothing_free')
  const p = planWallet({ totalDog: 6_000.1 + 43_999.9, assignments: [asg(A, L1, 6_000.1)], directBtc: [], heldLots: [L1] })
  assert.equal(p.applications[0].amountDog, 43_999.9)
  assert.equal(atomsOf(p.applications[0].amountDog) + atomsOf(6_000.1), atomsOf(LICENCE_DOG.commercial))
})

// ── BTC com lote nomeado ────────────────────────────────────────────────────

test('BTC com lote nomeado: vai primeiro, direto no lote, mesmo com dois lotes ou mint mudo', () => {
  const d: DirectBtc[] = [{ ref: btcRef(TX, 0), lotId: L2, creditDog: 40_000 }]
  for (const heldLots of [null, [L1, L2], [], [L1]]) {
    const p = planWallet({ totalDog: 45_000, assignments: [], directBtc: d, heldLots })
    assert.deepEqual(p.applications[0], { lotId: L2, amountDog: 40_000, source: 'btc', ref: btcRef(TX, 0) }, JSON.stringify(heldLots))
  }
  // o livre que sobra (5.000) segue a regra automática
  assert.deepEqual(planWallet({ totalDog: 45_000, assignments: [], directBtc: d, heldLots: [L1] }).applications[1], { lotId: L1, amountDog: 5_000, source: 'dog', ref: null })
  assert.equal(planWallet({ totalDog: 45_000, assignments: [], directBtc: d, heldLots: [L1, L2] }).unassignedDog, 5_000)
})

test('BTC com lote nomeado: uma vez só (ref) e nunca acima do que a carteira conta', () => {
  const d: DirectBtc[] = [{ ref: btcRef(TX, 0), lotId: L2, creditDog: 40_000 }]
  const ja = planWallet({ totalDog: 40_000, assignments: [asg(A, L2, 40_000, 'btc', btcRef(TX, 0))], directBtc: d, heldLots: [L1] })
  assert.deepEqual([ja.applications.length, ja.why], [0, 'nothing_free'])
  // o teto por carteira do BTC deixou só 30.000 contando: aplica 30.000, nunca 40.000
  const teto = planWallet({ totalDog: 30_000, assignments: [], directBtc: d, heldLots: null })
  assert.equal(teto.applications[0].amountDog, 30_000)
  // repetido na lista também só entra uma vez
  assert.equal(planWallet({ totalDog: 80_000, assignments: [], directBtc: [...d, ...d], heldLots: null }).applications.length, 1)
})

test('directBtcOf: só pagamento creditado cuja cotação nomeou lote que leva licença', () => {
  const pagos: CreditedPayment[] = [
    { txid: TX, vout: 0, ordinalsAddress: A, creditDog: 40_000, quoteId: 'q1' },
    { txid: TX, vout: 1, ordinalsAddress: A, creditDog: 1_000, quoteId: 'q2' },   // cotação sem lote
    { txid: TX, vout: 2, ordinalsAddress: A, creditDog: 1_000, quoteId: null },
    { txid: TX, vout: 3, ordinalsAddress: A, creditDog: 1_000, quoteId: 'q3' },   // lote S08
  ]
  const lots = new Map([['q1', L2], ['q3', S8]])
  assert.deepEqual(directBtcOf(pagos, lots), [{ ref: btcRef(TX, 0), lotId: L2, creditDog: 40_000 }])
})

// ── subir de nível paga a diferença do LOTE ─────────────────────────────────

test('subir por lote: o Personal do dono anterior fica no lote, e o novo dono paga só a diferença', () => {
  // A tinha Personal no lote L1 (migração); vendeu a escritura para B. B não tem nada aplicado.
  const lotTotals = new Map([[L1, 10_000]])
  const deB = standingOfLots([L1], lotTotals, 0)
  assert.deepEqual([deB.tier, deB.totalDog], ['personal', 10_000], 'B já recebe a licença do lote')
  // B paga 40.000 em $DOG e guarda só L1: a automática põe tudo em L1
  const p = planWallet({ totalDog: 40_000, assignments: [], directBtc: [], heldLots: [L1] })
  assert.deepEqual(p.applications, [{ lotId: L1, amountDog: 40_000, source: 'dog', ref: null }])
  const depois = standingOfLots([L1], new Map([[L1, 50_000]]), 0)
  assert.equal(depois.tier, 'commercial')
  // A, que vendeu, não guarda mais lote: perde a licença (o crédito dele já está no lote)
  const deA = standingOfLots([], new Map(), planWallet({ totalDog: 10_000, assignments: [asg(A, L1, 10_000, 'migration', 'migration:' + A)], directBtc: [], heldLots: [] }).unassignedDog)
  assert.deepEqual([deA.tier, deA.totalDog, deA.lots], [null, 0, []])
})

test('cada lote tem a sua licença: nada se soma entre lotes; a carteira leva a mais alta', () => {
  const v = standingOfLots([L1, L2, L3], new Map([[L1, 10_000], [L2, 60_000]]), 2_000)
  assert.equal(v.tier, 'commercial')
  assert.deepEqual(v.lots, [
    { lot: L2, tier: 'commercial', totalDog: 60_000 },
    { lot: L1, tier: 'personal', totalDog: 10_000 },
    { lot: L3, tier: null, totalDog: 0 },
  ])
  assert.equal(v.totalDog, 60_000, 'vários lotes: o total do mais alto (o livre espera a escolha)')
  assert.equal(v.unassignedDog, 2_000)
})

test('standing compatível: um lote = lote + livre; nenhum = o livre', () => {
  const um = standingOfLots([L1], new Map([[L1, 10_000]]), 3_000)
  assert.deepEqual([um.tier, um.totalDog, um.unassignedDog], ['personal', 13_000, 3_000])
  const nenhum = standingOfLots([], new Map(), 12_000)
  assert.deepEqual([nenhum.tier, nenhum.totalDog, nenhum.lots], [null, 12_000, []])
  // setor 8 fora da lista
  assert.deepEqual(standingOfLots([S8], new Map([[S8, 99_999]]), 0).lots, [])
})

// ── o mint ──────────────────────────────────────────────────────────────────

test('mint: a resposta é conferida; fora da forma é "não disse"', () => {
  assert.deepEqual(readMintHolder({ address: A, lots: [L1, L1, 's02-q01-b0123-l045'], snapshotLot: null }, A), { lots: [L1, L2], snapshotLot: null })
  assert.deepEqual(readMintHolder({ address: A.toUpperCase(), lots: [], snapshotLot: L3 }, A), { lots: [], snapshotLot: L3 })
  assert.deepEqual(readMintHolder({ address: A, lots: [] }, A), { lots: [], snapshotLot: null })
  for (const ruim of [
    null, 'x', [], { lots: [L1], snapshotLot: null },             // sem endereço
    { address: B, lots: [L1], snapshotLot: null },                  // outro endereço
    { address: A, lots: 'S01', snapshotLot: null },
    { address: A, lots: [L1, 'lixo'], snapshotLot: null },
    { address: A, lots: [], snapshotLot: 'lixo' },
    { address: A, lots: [], snapshotLot: 7 },
    { address: A, lots: Array(5001).fill(L1), snapshotLot: null },
  ]) assert.equal(readMintHolder(ruim, A), null, JSON.stringify(ruim)?.slice(0, 60))
})

// ── o total de todas as carteiras (a varredura) é o do placar ───────────────

const at = (dog: number) => Math.round(dog * 100_000)
const tx = (txid: string, block: number, senders: [string, number][], receivers: [string, number][]): TxRow => ({
  id: block, txid, block_height: block, timestamp: `2026-11-${String(block % 28 + 1).padStart(2, '0')}T00:00:00Z`,
  senders: senders.map(([address, dog]) => ({ address, amount: at(dog) })),
  receivers: receivers.map(([address, dog]) => ({ address, amount: at(dog) })),
})
const W = FUND_DOG_ADDRESS
const BASE58 = '1BoatSLRHtKNngkdXEeobR76b53LETtpyT'
const ROWS: TxRow[] = [
  tx('t1', 10, [[A, 6_000]], [[W, 6_000]]),
  tx('t2', 11, [[A, 5_000]], [[W, 4_000], [A, 1_000]]),
  tx('t3', 12, [[B, 30_000], [C, 30_000]], [[W, 60_000]]),
  tx('t4', 13, [[BASE58, 12_000]], [[W, 12_000]]),
  tx('t5', 14, [[W, 1_000]], [[B, 1_000]]),
]
const CREDITS: Credit[] = [{ ordinalsAddress: B, creditDog: 25_000 }, { ordinalsAddress: 'bc1p' + 'd'.repeat(58), creditDog: 500_000 }]

test('walletTotals: o mesmo total de standingOfWallet e do placar, com a caixa do base58 de volta', () => {
  const t = walletTotals(ROWS, CREDITS)
  for (const w of [A, B, C, BASE58, 'bc1p' + 'd'.repeat(58)]) {
    assert.equal(t.get(w), standingOfWallet(ROWS, w, CREDITS).totalDog, w.slice(0, 8))
  }
  const placar = applyBtcCredits(buildLedger(ROWS, W, { licenseFor: licenceFor, posicoes: {} }).leaderboard, CREDITS)
  for (const e of placar.entries) assert.equal(t.get(e.address === BASE58.toLowerCase() ? BASE58 : e.address), e.licence_total)
  assert.equal(t.has(BASE58.toLowerCase()), false, 'base58 nunca vira minúsculo')
  assert.equal(t.has('anonymous'), false)
  assert.equal(t.has(W), false)
})

// ── a migração única ────────────────────────────────────────────────────────

const REGISTRO = new Map([
  [A, { lotId: L1, address: A }],
  [B, { lotId: L2, address: B }],
  [BASE58.toLowerCase(), { lotId: L3, address: BASE58 }],
  [C, { lotId: S8, address: C }],
])

test('migração: cada carteira com licença -> o lote dela no snapshot', () => {
  const placar = [
    { address: A, licence_total: 10_000 },
    { address: B, licence_total: 55_000 },
    { address: BASE58.toLowerCase(), licence_total: 12_000 },      // o placar guarda tudo minúsculo
    { address: C, licence_total: 87_777 },                          // lote do setor 8
    { address: 'bc1p' + 'e'.repeat(58), licence_total: 500_000 },  // sem lote no snapshot
    { address: 'bc1p' + 'f'.repeat(58), licence_total: 5_000 },    // abaixo de Personal
    { address: 'anonymous', licence_total: 99_999 },
    { address: A, licence_total: 10_000 },                          // repetida
  ]
  const p = planoDeMigracao(placar, (a) => REGISTRO.get(a) ?? null)
  assert.deepEqual(p.linhas, [
    { wallet: A, lotId: L1, amountDog: 10_000, tier: 'personal' },
    { wallet: B, lotId: L2, amountDog: 55_000, tier: 'commercial' },
    { wallet: BASE58, lotId: L3, amountDog: 12_000, tier: 'personal' },
  ])
  assert.deepEqual(p.semLote, ['bc1p' + 'e'.repeat(58)])
  assert.deepEqual(p.setor8, [C])
  assert.equal(p.parciais, 1)
  // --parciais: o crédito abaixo de Personal com lote também entra
  const f = 'bc1p' + 'f'.repeat(58)
  const comParciais = planoDeMigracao(placar, (a) => (a === f ? { lotId: 'S03-Q00-B0001-L001', address: f } : REGISTRO.get(a) ?? null), { parciais: true })
  assert.deepEqual(comParciais.linhas.find((l) => l.wallet === f), { wallet: f, lotId: 'S03-Q00-B0001-L001', amountDog: 5_000, tier: null })
})

test('migração: o SQL é idempotente (applied_before 0 e ref por carteira) e recusa linha ruim', () => {
  const p = planoDeMigracao([{ address: A, licence_total: 10_000.000001 }, { address: B, licence_total: 55_000 }], (a) => REGISTRO.get(a) ?? null)
  const sql = sqlDaMigracao(p.linhas, ['teste'])
  assert.match(sql, /^-- teste\nbegin;\n/)
  assert.match(sql, new RegExp(`select public\\.dogcity_licence_apply\\('${A}', '${L1}', 10000, 'migration', 'migration:${A}', 0\\);`))
  assert.match(sql, new RegExp(`'${L2}', 55000, 'migration', 'migration:${B}', 0\\);`))
  assert.match(sql, /commit;\n$/)
  assert.throws(() => sqlDaMigracao([{ wallet: "x'); drop table x; --", lotId: L1, amountDog: 1, tier: null }], []))
  assert.throws(() => sqlDaMigracao([{ wallet: A, lotId: S8, amountDog: 10_000, tier: 'personal' }], []))
})

// ── o banco e a conta falam a mesma língua ──────────────────────────────────

test('migração 037: as faixas do degrau são as de LICENCE_DOG, setor 8 recusado, aplicação imutável', () => {
  const sql = readFileSync(new URL('../../supabase/migrations/037_dogcity_lot_licence.sql', import.meta.url), 'utf8')
  assert.match(sql, new RegExp(`when total >= ${LICENCE_DOG.patron} then 'patron'`))
  assert.match(sql, new RegExp(`when total >= ${LICENCE_DOG.commercial} then 'commercial'`))
  assert.match(sql, new RegExp(`when total >= ${LICENCE_DOG.personal} then 'personal'`))
  assert.match(sql, /lot_id !~ '\^S08-'/)
  assert.match(sql, /source in \('dog', 'btc', 'migration'\)/)
  assert.match(sql, /before update or delete on public\.dogcity_licence_assignment/)
  assert.match(sql, /pg_advisory_xact_lock/)
  assert.match(sql, /round\(v_applied, 5\) <> round\(p_applied_before, 5\)/)
  assert.match(sql, /create table if not exists public\.dogcity_lot_licence/)
  assert.match(sql, /create table if not exists public\.dogcity_licence_assignment/)
  assert.match(sql, /add column if not exists lot_id/)
})
