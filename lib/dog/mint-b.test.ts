// Run: npx tsx --test lib/dog/mint-b.test.ts
//
// O detector do bloco B com dado SIMULADO (alturas e valores inventados, só para
// cobrir as bordas): cruzamento exato, ordem de cadeia (não de chegada), sem
// confirmação não conta, reorg antes de 6 confirmações, congelamento com 6, B fixo
// depois (doação devolvida, linha antiga inserida tarde), o formato público e o CORS.
// Mais a ponta a ponta pelo livro (buildLedger), que é o que a rota usa.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildLedger, type TxRow } from './founders-ledger'
import {
  B_CONFIRMATIONS, confirmationsOf, corsHeaders, detectB, mintBNow, resolveB, DONATION_WALLET, DOG_GOAL, GOAL_ATOMOS,
  type BContribution, type FrozenB, type MintBSource,
} from './mint-b'

const DOG = 100_000n
const c = (bloco: number, txid: string, dog: bigint, frac = 0n, posicao?: number): BContribution => ({ bloco, txid, fundoAtomos: dog * DOG + frac, posicao })

test('a meta em átomos é 10.000.000 DOG exatos', () => {
  assert.equal(GOAL_ATOMOS, 1_000_000_000_000n)
  assert.equal(DOG_GOAL, 10_000_000)
  assert.equal(B_CONFIRMATIONS, 6)
})

test('cruzamento exato: a meta é atingida com igualdade, no bloco da transação que fecha', () => {
  const r = detectB([c(100, 'a', 4_000_000n), c(101, 'b', 5_000_000n), c(105, 'c', 1_000_000n), c(106, 'd', 50n)])
  assert.equal(r.found?.B, 105)
  assert.equal(r.found?.txid, 'c')
  assert.equal(r.totalAtomos, GOAL_ATOMOS + 50n * DOG)
})

test('um átomo a menos não cruza; um átomo a mais no bloco seguinte cruza ali', () => {
  assert.equal(detectB([c(100, 'a', 9_999_999n, 99_999n)]).found, null)
  const depois = detectB([c(100, 'a', 9_999_999n, 99_999n), c(101, 'b', 0n, 1n)])
  assert.equal(depois.found?.B, 101)
  assert.equal(depois.found?.txid, 'b')
})

test('várias transações no mesmo bloco: B é o bloco da que cruzou, as seguintes do bloco não o movem', () => {
  const r = detectB([
    c(100, 'a', 9_000_000n),
    c(200, 'b', 600_000n), // 9.6M
    c(200, 'c', 500_000n), // 10.1M: cruza aqui
    c(200, 'd', 250_000n),
    c(201, 'e', 999n),
  ])
  assert.equal(r.found?.B, 200)
  assert.equal(r.found?.txid, 'c')
})

test('uma única transação gigante cruza sozinha', () => {
  const r = detectB([c(300, 'x', 10_500_000n)])
  assert.equal(r.found?.B, 300)
  assert.equal(r.found?.txid, 'x')
})

test('ordem de CADEIA, não de chegada: entrada embaralhada dá o mesmo B; dentro do bloco manda a posição', () => {
  const r = detectB([c(300, 'z', 2_000_000n), c(100, 'a', 8_000_000n), c(200, 'm', 1n)])
  assert.equal(r.found?.B, 300) // 8M + 1 em 200 ainda não é 10M; 300 fecha
  // a ordem é a da cadeia (400 antes de 500), qualquer que seja a de chegada: quem cruza é o 500
  const tarde = detectB([c(500, 'alto', 6_000_000n), c(400, 'baixo', 4_000_000n)])
  assert.equal(tarde.found?.B, 500)
  const mesmo = detectB([c(500, 'b', 400_000n, 0n, 9), c(500, 'a', 9_700_000n, 0n, 2)])
  assert.equal(mesmo.found?.B, 500)
  assert.equal(mesmo.found?.txid, 'b') // posição 2 vem antes da 9: a de posição 9 é a que cruza
})

test('ainda não cruzou: sem B', () => {
  const r = detectB([c(100, 'a', 4_000_000n), c(101, 'b', 5_887_345n, 60_701n)])
  assert.equal(r.found, null)
  assert.deepEqual(detectB([]), { found: null, totalAtomos: 0n })
  const res = resolveB({ ...r, tip: 971_954, frozen: null })
  assert.deepEqual(res.body, { status: 'filling', raised: 9_887_345.60701, goal: DOG_GOAL, B: null, confirmations: null, tip: 971_954 })
  assert.equal(res.freeze, null)
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
  const fecha = detectB([...sujas, c(150, 'fecha', 1_000_000n)])
  assert.equal(fecha.found?.B, 150)
  assert.equal(fecha.found?.txid, 'fecha')
})

test('confirmações: ponta - B + 1, o próprio B é a primeira, nunca negativo', () => {
  assert.equal(confirmationsOf(971_900, 971_900), 1)
  assert.equal(confirmationsOf(971_900, 971_905), 6)
  assert.equal(confirmationsOf(971_900, null), null)
  assert.equal(confirmationsOf(971_900, 971_890), 0)
})

// ── os três estados e o congelamento ─────────────────────────────────────────
const B = 971_900
const cruzou = () => detectB([c(B - 5, 'a', 6_000_000n), c(B, 'b', 4_000_000n), c(B + 3, 'c', 250n)])
const em = (tip: number | null, frozen: FrozenB | null = null, d = cruzou()) => resolveB({ ...d, tip, frozen })

test('full_unconfirmed: meta atingida com menos de 6 confirmações; B provisório, nada congelado', () => {
  for (const [tip, conf] of [[B, 1], [B + 3, 4], [B + 4, 5]] as const) {
    const r = em(tip)
    assert.equal(r.body.status, 'full_unconfirmed')
    assert.equal(r.body.B, B)
    assert.equal(r.body.confirmations, conf)
    assert.equal(r.freeze, null)
  }
  const semPonta = em(null)
  assert.equal(semPonta.body.status, 'full_unconfirmed')
  assert.equal(semPonta.body.confirmations, null)
  assert.equal(semPonta.freeze, null)
})

test('set: com 6 confirmações exatas B vale e é congelado com o total e a ponta daquele instante', () => {
  const r = em(B + 5)
  assert.deepEqual(r.body, { status: 'set', raised: 10_000_250, goal: DOG_GOAL, B, confirmations: 6, tip: B + 5 })
  assert.deepEqual(r.freeze, { B, raised: 10_000_250, tip: B + 5, txid: 'b' })
  assert.deepEqual(Object.keys(r.body), ['status', 'raised', 'goal', 'B', 'confirmations', 'tip'])
})

test('reorg antes de 6 confirmações não congela: o cruzamento some e a resposta volta a filling', () => {
  const antes = em(B + 2)
  assert.equal(antes.body.status, 'full_unconfirmed')
  assert.equal(antes.freeze, null)
  // a transação que cruzou saiu do bloco: o total fica abaixo da meta
  const depois = em(B + 3, null, detectB([c(B - 5, 'a', 6_000_000n), c(B + 3, 'c', 250n)]))
  assert.equal(depois.body.status, 'filling')
  assert.equal(depois.body.B, null)
  assert.equal(depois.body.confirmations, null)
  assert.equal(depois.freeze, null)
  // ou o cruzamento se muda para outro bloco: B provisório acompanha
  const moveu = em(B + 4, null, detectB([c(B - 5, 'a', 6_000_000n), c(B + 2, 'b', 4_000_000n)]))
  assert.equal(moveu.body.status, 'full_unconfirmed')
  assert.equal(moveu.body.B, B + 2)
  assert.equal(moveu.freeze, null)
})

test('depois do congelamento B não muda: doação devolvida, linha antiga inserida tarde, livro vazio', () => {
  const frozen = em(B + 5).freeze as FrozenB
  // (a) o fundo devolve DOG: retirada não abate o total, o livro lê igual e B segue
  const igual = em(B + 40, frozen)
  assert.equal(igual.body.status, 'set')
  assert.equal(igual.body.B, B)
  assert.equal(igual.body.raised, frozen.raised)
  assert.equal(igual.body.confirmations, 41)
  assert.equal(igual.freeze, null)
  // (b) o scanner insere tarde uma doação antiga e o cálculo novo cruzaria mais cedo: B congelado manda
  const antigo = em(B + 40, frozen, detectB([c(B - 100, 'velha', 9_000_000n), c(B - 5, 'a', 6_000_000n), c(B, 'b', 4_000_000n)]))
  assert.equal(antigo.body.B, B)
  assert.equal(antigo.diverged, true)
  // (c) o livro voltou vazio (banco restaurado, tabela apagada): continua set
  const vazio = em(B + 40, frozen, { found: null, totalAtomos: 0n })
  assert.equal(vazio.body.status, 'set')
  assert.equal(vazio.body.B, B)
  // (d) ponta desconhecida ou atrasada: usa a do congelamento, nunca menos de 6 confirmações
  assert.deepEqual(em(null, frozen).body, { status: 'set', raised: frozen.raised, goal: DOG_GOAL, B, confirmations: 6, tip: B + 5 })
  assert.equal(em(B + 1, frozen).body.confirmations, 6)
})

// ── a orquestração da rota, com banco e cadeia simulados ─────────────────────
function fonte(init: { contribs: BContribution[]; tip: number | null; frozen?: FrozenB | null }) {
  const st = { contribs: init.contribs, tip: init.tip, frozen: init.frozen ?? null, livroLido: 0, gravacoes: 0 }
  const src: MintBSource = {
    loadFrozen: async () => st.frozen,
    saveFrozen: async (f) => { st.gravacoes++; if (!st.frozen) st.frozen = f }, // insert-once, como o banco
    readContributions: async () => { st.livroLido++; return st.contribs },
    readTip: async () => st.tip,
  }
  return { st, src }
}
const livro = [c(B - 5, 'a', 6_000_000n), c(B, 'b', 4_000_000n), c(B + 3, 'c', 250n)]

test('rota: filling -> full_unconfirmed -> set; congela uma vez, com 6 confirmações, e depois nem abre o livro', async () => {
  const { st, src } = fonte({ contribs: [c(B - 5, 'a', 6_000_000n)], tip: B - 1 })
  assert.equal((await mintBNow(src)).body.status, 'filling')
  st.contribs = livro; st.tip = B + 4 // meta cruzada, 5 confirmações
  assert.equal((await mintBNow(src)).body.status, 'full_unconfirmed')
  assert.equal(st.gravacoes, 0)
  st.tip = B + 5 // 6 confirmações
  const set = await mintBNow(src)
  assert.deepEqual(set.body, { status: 'set', raised: 10_000_250, goal: DOG_GOAL, B, confirmations: 6, tip: B + 5 })
  assert.equal(st.gravacoes, 1)
  const lidas = st.livroLido
  st.contribs = []; st.tip = B + 50 // até um livro vazio já não importa
  const depois = await mintBNow(src)
  assert.deepEqual(depois.body, { status: 'set', raised: 10_000_250, goal: DOG_GOAL, B, confirmations: 51, tip: B + 50 })
  assert.equal(st.livroLido, lidas) // o livro não foi aberto
  assert.equal(st.gravacoes, 1)
})

test('rota: reorg antes das 6 confirmações não grava nada e a resposta acompanha a cadeia', async () => {
  const { st, src } = fonte({ contribs: livro, tip: B + 2 })
  assert.equal((await mintBNow(src)).body.status, 'full_unconfirmed')
  st.contribs = [c(B - 5, 'a', 6_000_000n), c(B + 3, 'c', 250n)]; st.tip = B + 4 // o bloco de B foi reorganizado
  assert.equal((await mintBNow(src)).body.status, 'filling')
  assert.equal(st.gravacoes, 0)
  assert.equal(st.frozen, null)
})

test('rota: outra instância congelou outro B primeiro, vale o gravado', async () => {
  const { st, src } = fonte({ contribs: livro, tip: B + 5 })
  const outra: FrozenB = { B: B - 2, raised: 10_000_100, tip: B + 4, txid: 'x' }
  src.loadFrozen = (() => { let n = 0; return async () => (n++ === 0 ? null : outra) })() // some entre a leitura e a gravação
  const r = await mintBNow(src)
  assert.equal(r.body.B, B - 2)
  assert.equal(r.diverged, true)
  assert.equal(st.gravacoes, 1)
})

test('o formato público tem exatamente seis campos nos três estados', () => {
  const chaves = ['status', 'raised', 'goal', 'B', 'confirmations', 'tip']
  for (const r of [em(B + 1), em(B + 9), em(B + 9, em(B + 5).freeze), resolveB({ found: null, totalAtomos: 0n, tip: B, frozen: null })]) {
    assert.deepEqual(Object.keys(r.body), chaves)
  }
})

test('CORS: só o mint e o ensaio; Vary: Origin sempre', () => {
  assert.deepEqual(corsHeaders('https://mint.dogcity.space'), { Vary: 'Origin', 'Access-Control-Allow-Origin': 'https://mint.dogcity.space' })
  assert.equal(corsHeaders('https://ensaio.dogcity.space')['Access-Control-Allow-Origin'], 'https://ensaio.dogcity.space')
  for (const o of ['https://evil.example', 'https://mint.dogcity.space.evil.example', 'http://mint.dogcity.space', '*', '', null]) {
    assert.deepEqual(corsHeaders(o), { Vary: 'Origin' })
  }
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

test('pelo livro: linha ingerida tarde (id alto, bloco antigo) entra na ordem da cadeia, não na de chegada', () => {
  const rows = [row(1, 'tx1', 500, 6_000_000), row(2, 'tx2', 520, 4_000_000), row(3, 'tardia', 510, 100)]
  const { found } = ledgerDe(rows)
  assert.equal(found?.B, 520) // 6M + 100 (510) + 4M (520) cruza em 520, qualquer que seja o id
  assert.equal(found?.txid, 'tx2')
  const cedo = ledgerDe([row(1, 'tx1', 500, 6_000_000), row(2, 'tx2', 520, 4_000_000), row(3, 'tardia', 510, 4_000_000)])
  assert.equal(cedo.found?.B, 510) // a tardia de 4M fecha a meta em 510, antes de tx2
  assert.equal(cedo.found?.txid, 'tardia')
})

test('pelo livro: no mesmo bloco manda a posição da cadeia (founders-positions), não o id', () => {
  const rows = [row(1, 'tx1', 500, 9_000_000), row(2, 'segunda', 510, 600_000), row(3, 'primeira', 510, 600_000)]
  const L = buildLedger(rows, DONATION_WALLET, { licenseFor: () => '', posicoes: { primeira: 1, segunda: 2 } })
  const { found } = detectB(L.contributions)
  assert.equal(found?.B, 510)
  assert.equal(found?.txid, 'segunda') // 9.6M com a primeira, 10.2M com a segunda: a segunda cruza
})

test('pelo livro: devolver DOG depois de B não o move e o total do detector é o do placar', () => {
  const devolucao: TxRow = {
    id: 9, txid: 'devolucao', block_height: 530, timestamp: '2026-10-03T00:00:00Z',
    senders: [{ address: DONATION_WALLET, amount: 400_000_000_000 }],
    receivers: [{ address: DOADOR, amount: 400_000_000_000 }],
  }
  const base = [row(1, 'tx1', 500, 6_000_000), row(2, 'tx2', 510, 4_000_000)]
  const antes = ledgerDe(base)
  const depois = ledgerDe([...base, devolucao])
  assert.equal(antes.found?.B, 510)
  assert.equal(depois.found?.B, 510)
  assert.equal(depois.totalAtomos, antes.totalAtomos)
  const L = buildLedger([...base, devolucao], DONATION_WALLET, { licenseFor: () => '', posicoes: {} })
  assert.equal(L.totalAtomos, depois.totalAtomos)
})

test('a carteira e a meta da rota nova são as mesmas do placar (leaderboard)', () => {
  const src = readFileSync(new URL('../../app/api/donate/leaderboard/route.ts', import.meta.url), 'utf8')
  assert.ok(src.includes(`const DONATION_WALLET = '${DONATION_WALLET}'`), 'carteira do fundo divergiu do leaderboard')
  assert.ok(src.includes('const DOG_GOAL = 10_000_000'), 'meta divergiu do leaderboard')
})
