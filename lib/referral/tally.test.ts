// Rodar: npx tsx --test lib/referral/tally.test.ts
//
// A CONTA: o que conta "depois do vinculo" (mint e licenca), o degrau pelos pagamentos posteriores, o teto do BTC,
// e o trabalho do cron (refreshBatch) com fontes falsas: falha fechada, cache de lote, nada anterior ao vinculo.
import test from 'node:test'
import assert from 'node:assert/strict'
import { isAfterLink, walletProgress, type LinkFact, type MintedLot, type Payment } from './tally'
import { refreshBatch, type PendingWallet, type ProgressRow, type RefreshDeps } from './refresh'

const BOB = 'bc1p' + 'b'.repeat(58)
const CARL = 'bc1p' + 'c'.repeat(58)
const ALICE = 'bc1p' + 'a'.repeat(58)
const T = Date.UTC(2026, 9, 25, 12, 0, 0)
const link = (over: Partial<LinkFact> = {}): LinkFact => ({ referred: BOB, referrer: ALICE, linkedAtMs: T, linkedBlock: 973_000, ...over })
const lot = (id: string, block: number | null, timeMs: number | null = null): MintedLot => ({ lotId: id, block, timeMs })
const dog = (v: number, block: number | null, timeMs: number | null = null): Payment => ({ kind: 'dog', dog: v, block, timeMs })
const btc = (v: number, block: number | null, timeMs: number | null = null): Payment => ({ kind: 'btc', dog: v, block, timeMs })

test('isAfterLink: bloco estritamente maior; o mesmo bloco do vinculo NAO conta', () => {
  const l = link()
  assert.equal(isAfterLink(l, { block: 973_001, timeMs: null }), true)
  assert.equal(isAfterLink(l, { block: 973_000, timeMs: null }), false)
  assert.equal(isAfterLink(l, { block: 972_999, timeMs: T + 1e9 }), false) // o bloco manda quando os dois existem
})

test('isAfterLink: sem bloco do vinculo ou do evento cai para o tempo; sem nada, NAO conta', () => {
  assert.equal(isAfterLink(link({ linkedBlock: null }), { block: 973_500, timeMs: T + 1 }), true)
  assert.equal(isAfterLink(link({ linkedBlock: null }), { block: 973_500, timeMs: T - 1 }), false)
  assert.equal(isAfterLink(link(), { block: null, timeMs: T + 1 }), true)
  assert.equal(isAfterLink(link(), { block: null, timeMs: T }), false)
  assert.equal(isAfterLink(link(), { block: null, timeMs: null }), false)
  assert.equal(isAfterLink(link({ linkedBlock: null }), { block: 973_500, timeMs: null }), false)
  assert.equal(isAfterLink(link(), { block: null, timeMs: NaN }), false)
})

test('mint: so conta lote cunhado DEPOIS do vinculo; o de antes nao conta', () => {
  const p = walletProgress(link(), [lot('A', 972_900), lot('B', 973_050), lot('C', 973_200)], [])
  assert.equal(p.mintedLots, 2)
  assert.equal(p.firstMintBlock, 973_050)
  const antes = walletProgress(link(), [lot('A', 972_000)], [])
  assert.equal(antes.mintedLots, 0)
  assert.equal(antes.firstMintBlock, null)
})

test('licenca: so o pago DEPOIS do vinculo; o degrau e o que esses pagamentos somam', () => {
  // pagou 50.000 antes (nao conta) e 10.000 depois: Personal, 10.000
  const p = walletProgress(link(), [], [dog(50_000, 972_000), dog(10_000, 973_100)])
  assert.equal(p.licenceDog, 10_000)
  assert.equal(p.tier, 'personal')
  // dois pagamentos posteriores somam para o degrau seguinte
  const q = walletProgress(link(), [], [dog(30_000, 973_010), dog(25_000, 973_020)])
  assert.equal(q.licenceDog, 55_000)
  assert.equal(q.tier, 'commercial')
  assert.equal(walletProgress(link(), [], [dog(500_000, 973_010)]).tier, 'patron')
})

test('licenca abaixo de Personal e Citizen (nao e licenca); nada depois do vinculo vale zero', () => {
  assert.equal(walletProgress(link(), [], [dog(9_999, 973_010)]).tier, 'citizen')
  const nada = walletProgress(link(), [], [dog(100_000, 972_000)])
  assert.equal(nada.licenceDog, 0)
  assert.equal(nada.tier, 'citizen')
})

test('licenca paga em BTC (credit_dog) soma com o DOG e respeita o teto por carteira', () => {
  const p = walletProgress(link(), [], [dog(4_000, 973_010), btc(6_000, 973_020)])
  assert.equal(p.licenceDog, 10_000)
  assert.equal(p.tier, 'personal')
  const teto = walletProgress(link(), [], [btc(9_000_000, 973_020)])
  assert.equal(teto.licenceDog, 5_000_000) // MAX_BTC_CREDIT_DOG_PER_WALLET
  // BTC anterior ao vinculo nao entra
  assert.equal(walletProgress(link(), [], [btc(10_000, 972_000)]).licenceDog, 0)
})

test('valor invalido (NaN, negativo, zero) nunca vira licenca', () => {
  const p = walletProgress(link(), [], [dog(NaN, 973_010), dog(-5, 973_010), dog(0, 973_010), dog(Infinity, 973_010)])
  assert.equal(p.licenceDog, 0)
})

// ── o cron ──────────────────────────────────────────────────────────────────

function wallet(over: Partial<PendingWallet> = {}): PendingWallet {
  return { referred: BOB, referrer: ALICE, linkedAtMs: T, linkedBlock: 973_000, knownLots: {}, ...over }
}

function deps(over: Partial<RefreshDeps> & { batch?: PendingWallet[] }): RefreshDeps & { saved: ProgressRow[]; resolved: string[] } {
  const saved: ProgressRow[] = []
  const resolved: string[] = []
  const d: RefreshDeps & { saved: ProgressRow[]; resolved: string[] } = {
    saved, resolved,
    nextBatch: async () => over.batch ?? [wallet()],
    mintLookup: async (addrs) => new Map(addrs.map((a) => [a, []])),
    resolveMint: async (id) => { resolved.push(id); return { block: 973_050, timeMs: T + 3600_000 } },
    dogPayments: async () => [],
    btcPayments: async (addrs) => new Map(addrs.map((a) => [a, []])),
    save: async (rows) => { saved.push(...rows) },
    ...over,
  }
  // `over.batch` nao e campo de RefreshDeps
  return d
}

test('cron: lote cunhado depois do vinculo conta; o de antes nao; o bloco vem do reveal', async () => {
  const d = deps({
    mintLookup: async () => new Map([[BOB, [{ lotId: 'L-NOVO', state: 'minted' }, { lotId: 'L-VELHO', state: 'minted' }, { lotId: 'L-LIVRE', state: 'available' }]]]),
    resolveMint: async (id) => (id === 'L-NOVO' ? { block: 973_050, timeMs: T + 1 } : { block: 972_000, timeMs: T - 1e9 }),
  })
  const r = await refreshBatch(d, 80)
  assert.deepEqual(r, { picked: 1, saved: 1, skipped: 0 })
  assert.equal(d.saved[0].mintedLots, 1)
  assert.equal(d.saved[0].firstMintBlock, 973_050)
  assert.deepEqual(Object.keys(d.saved[0].mintLots).sort(), ['L-NOVO', 'L-VELHO']) // 'available' nao entra
})

test('cron: lote minted ainda sem reveal confirmado NAO conta e nao fica no cache (tenta de novo depois)', async () => {
  const d = deps({
    mintLookup: async () => new Map([[BOB, [{ lotId: 'L1', state: 'minted' }]]]),
    resolveMint: async () => null,
  })
  await refreshBatch(d, 80)
  assert.equal(d.saved[0].mintedLots, 0)
  assert.deepEqual(d.saved[0].mintLots, {})
})

test('cron: lote ja resolvido em rodada anterior nao e pedido de novo', async () => {
  const d = deps({
    batch: [wallet({ knownLots: { L1: { b: 973_050, t: T + 1 } } })],
    mintLookup: async () => new Map([[BOB, [{ lotId: 'L1', state: 'minted' }]]]),
  })
  await refreshBatch(d, 80)
  assert.deepEqual(d.resolved, [])
  assert.equal(d.saved[0].mintedLots, 1)
})

test('cron: licenca em DOG e em BTC so depois do vinculo, e o degrau sai da soma posterior', async () => {
  const d = deps({
    dogPayments: async () => [dog(50_000, 972_000), dog(6_000, 973_100)],
    btcPayments: async (a) => new Map(a.map((x) => [x, [btc(4_000, 973_200)]])),
  })
  await refreshBatch(d, 80)
  assert.equal(d.saved[0].licenceDog, 10_000)
  assert.equal(d.saved[0].tier, 'personal')
})

test('cron FALHA FECHADA: fonte do mint ausente para a carteira, banco de BTC fora ou erro no livro: NAO grava essa carteira', async () => {
  // o lookup nao respondeu por BOB (so por CARL)
  const d1 = deps({ batch: [wallet(), wallet({ referred: CARL })], mintLookup: async () => new Map([[CARL, []]]) })
  assert.deepEqual(await refreshBatch(d1, 80), { picked: 2, saved: 1, skipped: 1 })
  assert.deepEqual(d1.saved.map((r) => r.referred), [CARL])
  // BTC fora do ar: ninguem e gravado (um zero falso apagaria licenca ja contada)
  const d2 = deps({ btcPayments: async () => { throw new Error('db') } })
  assert.deepEqual(await refreshBatch(d2, 80), { picked: 1, saved: 0, skipped: 1 })
  assert.equal(d2.saved.length, 0)
  // livro DOG falhou so para BOB
  const d3 = deps({
    batch: [wallet(), wallet({ referred: CARL })],
    dogPayments: async (w) => { if (w.referred === BOB) throw new Error('db'); return [] },
  })
  assert.deepEqual(await refreshBatch(d3, 80), { picked: 2, saved: 1, skipped: 1 })
})

test('cron: fila vazia nao faz nada; prazo estourado devolve as carteiras para a proxima rodada', async () => {
  const d = deps({ batch: [] })
  assert.deepEqual(await refreshBatch(d, 80), { picked: 0, saved: 0, skipped: 0 })
  const d2 = deps({})
  assert.deepEqual(await refreshBatch(d2, 80, Date.now() - 1), { picked: 1, saved: 0, skipped: 1 })
})
