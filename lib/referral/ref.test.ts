// Rodar: npx tsx --test lib/referral/ref.test.ts
//
// O ref no link (parseRef, refLink) e no navegador (captureRef, readStoredRef, clearStoredRef): validade de
// 30 dias, primeiro link vence, consumo apos a verificacao, storage quebrado nunca lanca.
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseRef, refLink, shortAddress, REF_TTL_MS } from './ref'
import { captureRef, clearStoredRef, readStoredRef, REF_STORAGE_KEY, type RefStorage } from './client'

function mem(): RefStorage & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) }
}
const T0 = Date.UTC(2026, 9, 25)
const DAY = 24 * 60 * 60 * 1000

test('parseRef: @handle, handle puro, espaco e caixa; o resto e null', () => {
  assert.equal(parseRef('@alice'), 'alice')
  assert.equal(parseRef('alice'), 'alice')
  assert.equal(parseRef(' @Alice_9 '), 'alice_9')
  for (const ruim of ['', '@', '@@a', 'ab', 'a'.repeat(16), 'a b', 'a-b', 'admin', '@dogcity', 7, null, undefined, {}]) {
    assert.equal(parseRef(ruim), null, JSON.stringify(ruim))
  }
})

test('refLink leva o @handle e a landing; nunca um endereco', () => {
  assert.equal(refLink('alice'), 'https://dogcity.space/?ref=@alice')
  assert.equal(refLink('alice', 'https://www.dogdata.xyz'), 'https://www.dogdata.xyz/?ref=@alice')
})

test('shortAddress abrevia endereco longo e nao mexe em curto', () => {
  const a = 'bc1p' + 'a'.repeat(58)
  const s = shortAddress(a)
  assert.ok(s.length < a.length && s.includes('…') && !s.includes(a))
  assert.equal(shortAddress('bc1qshort'), 'bc1qshort')
})

test('captureRef guarda o ref valido do ?ref= e readStoredRef devolve dentro do prazo', () => {
  const st = mem()
  assert.equal(captureRef('?ref=@alice&utm_source=x', T0, st), 'alice')
  assert.equal(readStoredRef(T0 + 29 * DAY, st), 'alice')
})

test('vale 30 dias: depois disso o ref some e a chave e apagada', () => {
  const st = mem()
  captureRef('?ref=@alice', T0, st)
  assert.equal(readStoredRef(T0 + REF_TTL_MS, st), 'alice')
  assert.equal(readStoredRef(T0 + REF_TTL_MS + 1, st), null)
  assert.equal(st.data.has(REF_STORAGE_KEY), false)
})

test('o PRIMEIRO link valido ganha enquanto estiver no prazo; vencido, o novo entra', () => {
  const st = mem()
  assert.equal(captureRef('?ref=@alice', T0, st), 'alice')
  assert.equal(captureRef('?ref=@carl', T0 + DAY, st), null)
  assert.equal(readStoredRef(T0 + DAY, st), 'alice')
  assert.equal(captureRef('?ref=@carl', T0 + 31 * DAY, st), 'carl')
  assert.equal(readStoredRef(T0 + 31 * DAY, st), 'carl')
})

test('ref invalido na URL nao guarda nada; sem ?ref= tambem nao', () => {
  const st = mem()
  for (const q of ['', '?ref=', '?ref=ab', '?ref=admin', '?x=1', '?ref=@a b']) assert.equal(captureRef(q, T0, st), null, q)
  assert.equal(st.data.size, 0)
})

test('clearStoredRef consome o ref (apos a primeira verificacao)', () => {
  const st = mem()
  captureRef('?ref=@alice', T0, st)
  clearStoredRef(st)
  assert.equal(readStoredRef(T0, st), null)
})

test('valor guardado estragado ou do futuro e descartado', () => {
  const st = mem()
  st.setItem(REF_STORAGE_KEY, '{not json')
  assert.equal(readStoredRef(T0, st), null)
  st.setItem(REF_STORAGE_KEY, JSON.stringify({ h: 'alice', t: T0 + DAY }))
  assert.equal(readStoredRef(T0, st), null)
  st.setItem(REF_STORAGE_KEY, JSON.stringify({ h: 'admin', t: T0 }))
  assert.equal(readStoredRef(T0, st), null)
})

test('storage indisponivel (aba privada) nunca lanca', () => {
  const quebrado: RefStorage = {
    getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') }, removeItem() { throw new Error('blocked') },
  }
  assert.equal(captureRef('?ref=@alice', T0, quebrado), null)
  assert.equal(readStoredRef(T0, quebrado), null)
  assert.doesNotThrow(() => clearStoredRef(quebrado))
  assert.equal(captureRef('?ref=@alice', T0, null), null)
  assert.equal(readStoredRef(T0, null), null)
})
