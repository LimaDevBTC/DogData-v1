// Run: npx tsx --test lib/dog/licence-wallet.test.ts
//
// A licença de UMA carteira (casa da licença, 28/10/2026) tem de dar o MESMO
// degrau do placar de /api/donate/leaderboard: livro inteiro + applyBtcCredits.
// Dado SIMULADO (endereços e valores inventados). Também cobre a parte de banco
// com um cliente falso: o filtro por índice, a falha do BTC (conta só o $DOG),
// e banco fora ou prazo estourado (null, nunca licença inventada).
import test from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { buildLedger, type TxRow } from './founders-ledger'
import { FUND_DOG_ADDRESS, applyBtcCredits, licenceFor, type Credit } from './licence-btc'
import { licenceOfWallet, licencaDaCarteira } from './licence-wallet'

const W = FUND_DOG_ADDRESS
const A = 'bc1p' + 'a'.repeat(58)
const B = 'bc1p' + 'b'.repeat(58)
const C = 'bc1p' + 'c'.repeat(58)
const D = 'bc1q' + 'd'.repeat(38)
const at = (dog: number) => Math.round(dog * 100_000)

const tx = (txid: string, block: number, senders: [string, number][], receivers: [string, number][]): TxRow => ({
  id: block, txid, block_height: block, timestamp: `2026-10-${String(block % 28 + 1).padStart(2, '0')}T00:00:00Z`,
  senders: senders.map(([address, dog]) => ({ address, amount: at(dog) })),
  receivers: receivers.map(([address, dog]) => ({ address, amount: at(dog) })),
})

const ROWS: TxRow[] = [
  tx('t1', 10, [[A, 6_000]], [[W, 6_000]]),                       // A: 6.000
  tx('t2', 11, [[A, 5_000]], [[W, 4_000], [A, 1_000]]),           // A: +4.000 (troco não conta) = 10.000, Personal
  tx('t3', 12, [[B, 30_000], [C, 30_000]], [[W, 60_000]]),        // B e C: 30.000 cada (partilha)
  tx('t4', 13, [[W, 1_000]], [[B, 1_000]]),                       // o fundo paga B: não é doação
  tx('t5', 14, [[C, 25_000]], [[W, 25_000]]),                     // C: 55.000, Commercial
  tx('t1', 10, [[A, 6_000]], [[W, 6_000]]),                       // linha repetida: conta uma vez
]
const CREDITS: Credit[] = [
  { ordinalsAddress: B, creditDog: 25_000 },  // B: 30.000 DOG + 25.000 BTC = Commercial
  { ordinalsAddress: D, creditDog: 500_000 }, // D: só BTC, Patron
  { ordinalsAddress: A.toUpperCase(), creditDog: 0 }, // crédito inválido: não muda nada
]

/** o degrau como o placar calcula: livro inteiro, depois os créditos em BTC */
function pelaRotaDoPlacar(address: string): string {
  const L = buildLedger(ROWS, W, { licenseFor: licenceFor, posicoes: {} })
  const board = applyBtcCredits(L.leaderboard, CREDITS)
  const e = board.entries.find((x) => x.address === address) ?? board.btcOnly.find((x) => x.address === address)
  return e?.license ?? 'citizen'
}

/** as linhas que o banco devolveria para `addresses @> {fundo, carteira}` */
const doBanco = (address: string) =>
  ROWS.filter((r) => [...(r.senders as any[]), ...(r.receivers as any[])].some((x) => x.address === address))

test('o degrau de uma carteira sobre o recorte é o mesmo do placar inteiro', () => {
  for (const a of [A, B, C, D, 'bc1p' + 'e'.repeat(58)]) {
    const mine = licenceOfWallet(doBanco(a), a, CREDITS)
    const placar = pelaRotaDoPlacar(a)
    assert.equal(mine.tier ?? 'citizen', placar, a.slice(0, 8))
  }
  assert.deepEqual(licenceOfWallet(doBanco(A), A, CREDITS), { tier: 'personal' })
  assert.deepEqual(licenceOfWallet(doBanco(B), B, CREDITS), { tier: 'commercial' })
  assert.deepEqual(licenceOfWallet(doBanco(C), C, CREDITS), { tier: 'commercial' })
  assert.deepEqual(licenceOfWallet([], D, CREDITS), { tier: 'patron' })
  assert.deepEqual(licenceOfWallet([], 'bc1p' + 'e'.repeat(58), CREDITS), { tier: null })
})

test('abaixo de 10.000 não é licença; créditos de outra carteira não contam', () => {
  assert.deepEqual(licenceOfWallet([tx('x', 1, [[A, 9_999.99999]], [[W, 9_999.99999]])], A, []), { tier: null })
  assert.deepEqual(licenceOfWallet([], A, [{ ordinalsAddress: B, creditDog: 1_000_000 }]), { tier: null })
  // caixa do endereço não importa (bech32 é canonicamente minúsculo)
  assert.deepEqual(licenceOfWallet(doBanco(A), A.toUpperCase(), []), { tier: 'personal' })
})

// ── cliente falso do Supabase: só o encadeamento que licence-wallet usa ─────
type Resp = { data: any[] | null; error: { message: string } | null }
function fakeDb(opts: { tx?: (filters: Record<string, unknown>) => Resp; btc?: (filters: Record<string, unknown>) => Resp; delayMs?: number }) {
  const calls: { table: string; filters: Record<string, unknown> }[] = []
  const db = {
    from(table: string) {
      const filters: Record<string, unknown> = {}
      let signal: AbortSignal | undefined
      const q: any = {
        select: () => q,
        order: () => q,
        contains: (col: string, v: unknown) => { filters[`contains:${col}`] = v; return q },
        eq: (col: string, v: unknown) => { filters[`eq:${col}`] = v; return q },
        range: (a: number, b: number) => { filters.range = [a, b]; return q },
        abortSignal: (s: AbortSignal) => { signal = s; return q },
        then: (res: (r: Resp) => void, rej: (e: unknown) => void) => {
          calls.push({ table, filters: { ...filters } })
          const r = table === 'dog_transactions' ? opts.tx?.(filters) : opts.btc?.(filters)
          const go = () => (signal?.aborted ? rej(new Error('aborted')) : res(r ?? { data: [], error: null }))
          if (opts.delayMs) {
            const t = setTimeout(go, opts.delayMs)
            signal?.addEventListener('abort', () => { clearTimeout(t); rej(new Error('aborted')) }, { once: true })
          } else go()
        },
      }
      return q
    },
  }
  return { db: db as unknown as SupabaseClient, calls }
}

test('banco: filtra pelo índice (fundo + carteira) e pelos créditos desta carteira', async () => {
  const { db, calls } = fakeDb({
    tx: () => ({ data: doBanco(B), error: null }),
    btc: () => ({ data: [{ ordinals_address: B, credit_dog: '25000' }], error: null }),
  })
  assert.deepEqual(await licencaDaCarteira(db, B), { tier: 'commercial' })
  const t = calls.find((c) => c.table === 'dog_transactions')!
  assert.deepEqual(t.filters['contains:addresses'], [W, B])
  const b = calls.find((c) => c.table === 'dogcity_btc_payments')!
  assert.equal(b.filters['eq:status'], 'credited')
  assert.equal(b.filters['eq:ordinals_address'], B)
})

test('banco: BTC fora conta só o $DOG (nunca credita a mais); $DOG fora = null', async () => {
  const errLog = console.error
  console.error = () => {}
  try {
    const semBtc = fakeDb({ tx: () => ({ data: doBanco(B), error: null }), btc: () => ({ data: null, error: { message: 'relation does not exist' } }) })
    assert.deepEqual(await licencaDaCarteira(semBtc.db, B), { tier: 'personal' }) // 30.000 DOG sem os 25.000 em BTC
    const semDog = fakeDb({ tx: () => ({ data: null, error: { message: 'boom' } }) })
    assert.equal(await licencaDaCarteira(semDog.db, A), null)
  } finally {
    console.error = errLog
  }
})

test('banco: prazo estourado ou sinal abortado = null', async () => {
  const lento = fakeDb({ tx: () => ({ data: doBanco(A), error: null }), delayMs: 200 })
  assert.equal(await licencaDaCarteira(lento.db, A, { ms: 20 }), null)
  const ctrl = new AbortController()
  ctrl.abort()
  const rapido = fakeDb({ tx: () => ({ data: doBanco(A), error: null }) })
  assert.equal(await licencaDaCarteira(rapido.db, A, { signal: ctrl.signal }), null)
})

test('banco: pagina de 1000 em 1000 até a última página curta', async () => {
  const muitas = Array.from({ length: 2300 }, (_, i) => tx(`p${i}`, 100 + i, [[A, 5]], [[W, 5]])) // 11.500 DOG
  const { db, calls } = fakeDb({
    tx: (f) => { const [a, b] = f.range as [number, number]; return { data: muitas.slice(a, b + 1), error: null } },
  })
  assert.deepEqual(await licencaDaCarteira(db, A), { tier: 'personal' })
  assert.equal(calls.filter((c) => c.table === 'dog_transactions').length, 3)
})
