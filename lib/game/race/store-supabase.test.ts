// Rodar: npx tsx --test lib/game/race/store-supabase.test.ts
//
// A cola com o banco da regra v2, SEM rede: a resposta jsonb de race_finish_lap lida campo a campo (dado hostil = erro, nunca repassado), o
// nome e os parametros do rpc, e a leitura da abertura (carteiras diferentes + race_openings). O SQL em si foi provado num Postgres de verdade
// fora do repo (PGlite), ver o PR.
import test from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { criarStoreSupabase, lerResultado } from './store-supabase'

const BOA = { ok: true, record: true, rank: 3, prize: 'pending_review', prize_phase: 'abertura', phase: 'open', drivers: 10, needed: 10, opening_closed: true }

test('lerResultado: le a resposta da funcao campo a campo (opening_closed vira openingClosed)', () => {
  assert.deepEqual(lerResultado(BOA), { record: true, rank: 3, prize: 'pending_review', phase: 'open', drivers: 10, needed: 10, openingClosed: true })
  assert.deepEqual(lerResultado({ ...BOA, prize: 'none', phase: 'opening', opening_closed: false, drivers: 4 }), {
    record: true,
    rank: 3,
    prize: 'none',
    phase: 'opening',
    drivers: 4,
    needed: 10,
    openingClosed: false,
  })
})

test('lerResultado: volta nao encontrada ou nao valida (ok: false) = null; forma inesperada = erro', () => {
  assert.equal(lerResultado({ ok: false, reason: 'lap_not_valid' }), null)
  assert.equal(lerResultado({ ok: false, reason: 'lap_not_found' }), null)
  for (const lixo of [null, undefined, 'x', 3, [], {}, { ok: 'yes' }]) assert.throws(() => lerResultado(lixo), /race concluirVolta/)
  assert.throws(() => lerResultado({ ...BOA, prize: 'approved' }), /premio/)
  assert.throws(() => lerResultado({ ...BOA, phase: 'closed' }), /fase/)
  assert.throws(() => lerResultado({ ...BOA, rank: 0 }), /numero/)
  assert.throws(() => lerResultado({ ...BOA, rank: 1.5 }), /numero/)
  assert.throws(() => lerResultado({ ...BOA, drivers: -1 }), /numero/)
  assert.throws(() => lerResultado({ ...BOA, drivers: '10' }), /numero/)
  assert.throws(() => lerResultado({ ...BOA, record: 'true' }), /booleano/)
  assert.throws(() => lerResultado({ ...BOA, opening_closed: undefined }), /booleano/)
})

test('concluirVolta chama race_finish_lap com a volta, se o modelo tem premio e quantas carteiras fecham a abertura', async () => {
  const chamadas: Array<{ nome: string; args: unknown }> = []
  const db = {
    rpc: async (nome: string, args: unknown) => {
      chamadas.push({ nome, args })
      return { data: BOA, error: null }
    },
  } as unknown as SupabaseClient
  const r = await criarStoreSupabase(db).concluirVolta({ lapId: '11111111-1111-4111-8111-111111111111', premio: true, necessarios: 10 })
  assert.equal(r!.openingClosed, true)
  assert.deepEqual(chamadas, [{ nome: 'race_finish_lap', args: { p_lap_id: '11111111-1111-4111-8111-111111111111', p_prize: true, p_needed: 10 } }])
})

test('concluirVolta: erro do banco vira excecao (a rota responde 503 e o cliente repete o finish)', async () => {
  const db = { rpc: async () => ({ data: null, error: { message: 'function race_finish_lap does not exist' } }) } as unknown as SupabaseClient
  await assert.rejects(() => criarStoreSupabase(db).concluirVolta({ lapId: 'x', premio: true, necessarios: 10 }), /race concluirVolta: function race_finish_lap does not exist/)
})

test('abertura: carteiras diferentes (race_best_laps) e a linha de race_openings', async () => {
  const consultas: string[] = []
  const faz = (n: number | null, erro: { message: string } | null = null) => (tabela: string) => {
    consultas.push(tabela)
    const q: Record<string, unknown> = {}
    q.select = () => q
    q.eq = () => q
    q.then = (ok: (v: unknown) => void) => ok({ count: n, error: erro })
    return q
  }
  const montar = (best: number | null, fechada: number | null) =>
    ({ from: (t: string) => (t === 'race_best_laps' ? faz(best)(t) : faz(fechada)(t)) }) as unknown as SupabaseClient
  assert.deepEqual(await criarStoreSupabase(montar(7, 0)).abertura('an7-v1', 'c02'), { drivers: 7, fechada: false })
  assert.deepEqual(await criarStoreSupabase(montar(12, 1)).abertura('an7-v1', 'c02'), { drivers: 12, fechada: true })
  assert.deepEqual(await criarStoreSupabase(montar(null, null)).abertura('an7-v1', 'c02'), { drivers: 0, fechada: false })
  assert.deepEqual([...new Set(consultas)].sort(), ['race_best_laps', 'race_openings'])
})
