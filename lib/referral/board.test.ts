// Rodar: npx tsx --test lib/referral/board.test.ts
//
// O formato PUBLICO do placar: @handle ou endereco abreviado, nunca o endereco inteiro.
import test from 'node:test'
import assert from 'node:assert/strict'
import { toPublicBoard, type BoardRowRaw } from './board'

const A = 'bc1p' + 'a'.repeat(58)
const B = 'bc1p' + 'b'.repeat(58)
const row = (over: Partial<BoardRowRaw>): BoardRowRaw => ({
  referrer_address: A, handle: 'alice', referred: 3, minted: 1, minted_lots: 2,
  licences_personal: 1, licences_commercial: 0, licences_patron: 0, licence_dog: 12_000,
  counted_at: '2026-10-25T20:00:00Z', referrers_total: 2, referred_total: 5, ...over,
})

test('usa o @handle; sem handle cai para o endereco abreviado', () => {
  const b = toPublicBoard([row({}), row({ referrer_address: B, handle: null, referred: 2 })])
  assert.equal(b.rows[0].name, '@alice')
  assert.ok(b.rows[1].name.includes('…') && b.rows[1].name.startsWith('bc1pbbbbbb') && b.rows[1].name !== B)
})

test('nenhum endereco inteiro sai no JSON publico', () => {
  const json = JSON.stringify(toPublicBoard([row({}), row({ referrer_address: B, handle: null })]))
  assert.ok(!json.includes(A) && !json.includes(B))
})

test('mantem a ordem do banco, numera de 1 e leva os totais e a data da ultima contagem', () => {
  const b = toPublicBoard([
    row({ counted_at: '2026-10-25T19:00:00Z' }),
    row({ referrer_address: B, handle: 'bob', referred: 2, counted_at: '2026-10-25T21:00:00Z' }),
  ])
  assert.deepEqual(b.rows.map((r) => [r.rank, r.name, r.referred]), [[1, '@alice', 3], [2, '@bob', 2]])
  assert.equal(b.referrers, 2)
  assert.equal(b.referred, 5)
  assert.equal(b.updated_at, '2026-10-25T21:00:00Z')
  assert.deepEqual(b.rows[0].licences, { personal: 1, commercial: 0, patron: 0 })
  assert.equal(b.rows[0].licence_dog, 12_000)
})

test('placar vazio: zero em tudo e sem data', () => {
  assert.deepEqual(toPublicBoard([]), { updated_at: null, referrers: 0, referred: 0, rows: [] })
})
