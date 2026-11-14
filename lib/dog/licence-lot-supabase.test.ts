// Rodar: npx tsx --test lib/dog/licence-lot-supabase.test.ts
//
// Os fios da licença no lote (12/11/2026): a pergunta ao mint (prazo, status, forma conferida), o
// reconhecimento de "a tabela da 037 ainda não existe" (vira modo antigo, nunca erro de banco), e o
// mapeamento da chamada a dogcity_licence_apply. Cliente do Supabase e fetch FALSOS.
import test from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { SemTabela } from './licence-lot-service'
import { MINT_ORIGIN, ehSemTabela, holderDoMint, licencasPorLote, lotLicenceStore } from './licence-lot-supabase'

const A = 'bc1p' + 'a'.repeat(58)
const L1 = 'S01-Q00-B0001-L001'

const resp = (status: number, body: unknown) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })

test('mint: pergunta pelo endereço, confere a forma e cala em qualquer dúvida', async () => {
  const urls: string[] = []
  const f = (async (u: string) => { urls.push(u); return resp(200, { address: A, lots: [L1], snapshotLot: null }) }) as unknown as typeof fetch
  assert.deepEqual(await holderDoMint(A, { fetch: f }), { lots: [L1], snapshotLot: null })
  assert.equal(urls[0], `${MINT_ORIGIN}/api/mint/holder/${A}`)
  const casos: Array<typeof fetch> = [
    (async () => resp(404, { error: 'not found' })) as unknown as typeof fetch,
    (async () => resp(503, {})) as unknown as typeof fetch,
    (async () => resp(200, 'não é json')) as unknown as typeof fetch,
    (async () => resp(200, { address: 'bc1p' + 'b'.repeat(58), lots: [L1], snapshotLot: null })) as unknown as typeof fetch,
    (async () => { throw new Error('rede') }) as unknown as typeof fetch,
  ]
  for (const c of casos) assert.equal(await holderDoMint(A, { fetch: c }), null)
  // prazo: o mint lento não segura o standing
  const lento = ((_u: string, init: RequestInit) => new Promise((_res, rej) => init.signal?.addEventListener('abort', () => rej(new Error('abort'))))) as unknown as typeof fetch
  const t0 = Date.now()
  // o relógio de AbortSignal.timeout não segura o processo (unref): um timer comum mantém o teste vivo
  const vivo = setTimeout(() => {}, 2_000)
  try {
    assert.equal(await holderDoMint(A, { fetch: lento, ms: 30 }), null)
  } finally {
    clearTimeout(vivo)
  }
  assert.ok(Date.now() - t0 < 1000)
})

test('tabela da 037 ausente é reconhecida (códigos do Postgres e do PostgREST)', () => {
  for (const code of ['42P01', '42703', '42883', 'PGRST202', 'PGRST204', 'PGRST205']) assert.equal(ehSemTabela({ message: 'x', code }), true, code)
  assert.equal(ehSemTabela({ message: 'relation "public.dogcity_lot_licence" does not exist' }), true)
  assert.equal(ehSemTabela({ message: "Could not find the 'lot_id' column of 'dogcity_licence_quotes' in the schema cache" }), true)
  assert.equal(ehSemTabela({ message: 'canceling statement due to statement timeout', code: '57014' }), false)
  assert.equal(ehSemTabela(null), false)
})

function fakeDb(opts: { rpc?: (fn: string, args: any) => { data: unknown; error: any }; table?: (t: string) => { data: any[] | null; error: any } }) {
  const chamadas: { fn: string; args: any }[] = []
  const db = {
    rpc: async (fn: string, args: any) => { chamadas.push({ fn, args }); return opts.rpc?.(fn, args) ?? { data: null, error: null } },
    from(t: string) {
      const q: any = {}
      for (const m of ['select', 'eq', 'in', 'not', 'order', 'range', 'contains', 'abortSignal']) q[m] = () => q
      q.then = (res: (r: unknown) => void) => res(opts.table?.(t) ?? { data: [], error: null })
      return q
    },
  }
  return { db: db as unknown as SupabaseClient, chamadas }
}

test('apply: os argumentos de dogcity_licence_apply e o "não aplicou" (null) como false', async () => {
  const { db, chamadas } = fakeDb({ rpc: (_f, a) => ({ data: a.p_applied_before === 0 ? 'uuid-1' : null, error: null }) })
  const s = lotLicenceStore(db)
  assert.equal(await s.apply(A, { lotId: L1, amountDog: 10_000, source: 'dog', ref: null }, 0), true)
  assert.equal(await s.apply(A, { lotId: L1, amountDog: 5, source: 'dog', ref: null }, 9), false)
  assert.deepEqual(chamadas[0], { fn: 'dogcity_licence_apply', args: { p_wallet: A, p_lot_id: L1, p_amount: 10_000, p_source: 'dog', p_ref: null, p_applied_before: 0 } })
  const sem = lotLicenceStore(fakeDb({ rpc: () => ({ data: null, error: { message: 'Could not find the function public.dogcity_licence_apply', code: 'PGRST202' } }) }).db)
  await assert.rejects(sem.apply(A, { lotId: L1, amountDog: 1, source: 'dog', ref: null }, 0), SemTabela)
})

test('leituras: SemTabela sem a 037; erro comum segue erro; linhas fora da forma são descartadas', async () => {
  const semTabela = lotLicenceStore(fakeDb({ table: () => ({ data: null, error: { message: 'relation does not exist', code: '42P01' } }) }).db)
  await assert.rejects(semTabela.assignmentsOf(A), SemTabela)
  await assert.rejects(semTabela.lotTotals([L1]), SemTabela)
  await assert.rejects(semTabela.allAssignments(), SemTabela)
  const fora = lotLicenceStore(fakeDb({ table: () => ({ data: null, error: { message: 'timeout', code: '57014' } }) }).db)
  await assert.rejects(fora.assignmentsOf(A), (e: unknown) => !(e instanceof SemTabela))
  const linhas = lotLicenceStore(fakeDb({
    table: (t) => t === 'dogcity_licence_assignment'
      ? { data: [{ lot_id: L1, wallet: A, amount_dog: '10000.00000', source: 'migration', ref: 'migration:' + A }, { lot_id: 'lixo', wallet: A, amount_dog: 1, source: 'dog', ref: null }, { lot_id: L1, wallet: A, amount_dog: 1, source: 'gift', ref: null }], error: null }
      : { data: [{ lot_id: L1, total_dog: 50000 }], error: null },
  }).db)
  assert.deepEqual(await linhas.assignmentsOf(A), [{ lotId: L1, wallet: A, amountDog: 10_000, source: 'migration', ref: 'migration:' + A }])
  assert.deepEqual([...(await linhas.lotTotals([L1]))], [[L1, 50_000]])
})

test('placar: licenças contadas por lote; sem a tabela, null (a landing conta por carteira)', async () => {
  const com = fakeDb({ table: () => ({ data: [{ lot_id: L1, tier: 'personal' }, { lot_id: 'S01-Q00-B0001-L002', tier: 'patron' }, { lot_id: 'S01-Q00-B0001-L003', tier: 'personal' }], error: null }) })
  assert.deepEqual(await licencasPorLote(com.db), { personal: 2, commercial: 0, patron: 1 })
  const sem = fakeDb({ table: () => ({ data: null, error: { message: 'relation does not exist', code: '42P01' } }) })
  assert.equal(await licencasPorLote(sem.db), null)
})
