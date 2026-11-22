// Rodar: npx tsx --test lib/phone/phone.test.ts
// As regras puras de entrada do DOG Phone (sem banco).
import test from 'node:test'
import assert from 'node:assert/strict'
import { chaveCutucada, lerCid, lerHandle, lerId, lerIdMensagem, lerMotivo, lerTexto, LIMITES } from './rules'

test('handle: so o formato exato, com ou sem @', () => {
  assert.equal(lerHandle('@Bia_01 '), 'bia_01')
  assert.equal(lerHandle('bia'), 'bia')
  for (const ruim of ['', 'ab', 'a'.repeat(16), 'bia%', 'bi a', 'bia*', null, 12, '@@bia']) assert.equal(lerHandle(ruim), null)
})

test('id, cid e id de mensagem', () => {
  assert.equal(lerId('6F9619FF-8B86-D011-B42D-00C04FC964FF'), '6f9619ff-8b86-d011-b42d-00c04fc964ff')
  for (const ruim of ['x', '6f9619ff8b86d011b42d00c04fc964ff', null, "' or 1=1"]) assert.equal(lerId(ruim), null)
  assert.equal(lerCid('abcDEF12_-'), 'abcDEF12_-')
  for (const ruim of ['curto', 'a'.repeat(41), 'com espaco 1', null]) assert.equal(lerCid(ruim), null)
  assert.equal(lerIdMensagem('42'), 42)
  for (const ruim of [0, -1, 1.5, '1e3', '', null, '9'.repeat(20)]) assert.equal(lerIdMensagem(ruim), null)
})

test('texto: limpa controle e invisivel, conta por caractere, recusa vazio e longo', () => {
  assert.deepEqual(lerTexto('  oi​ ‮tudo\r\nbem  '), { ok: true, texto: 'oi tudo\nbem' })
  assert.deepEqual(lerTexto('a\n\n\n\n\nb'), { ok: true, texto: 'a\n\nb' })
  assert.deepEqual(lerTexto(' ​\n '), { ok: false, why: 'empty' })
  assert.deepEqual(lerTexto('x'.repeat(LIMITES.texto + 1)), { ok: false, why: 'too_long' })
  assert.equal(lerTexto('🐕'.repeat(LIMITES.texto)).ok, true) // 500 caracteres de 2 unidades UTF-16 cada
  assert.deepEqual(lerTexto('ruim \uD800 solto'), { ok: false, why: 'invalid_text' })
  assert.deepEqual(lerTexto(12), { ok: false, why: 'invalid_text' })
})

test('motivo da denuncia: uma linha, no maximo 300', () => {
  assert.equal(lerMotivo('  spam\n\nde   link '), 'spam de link')
  assert.equal([...lerMotivo('z'.repeat(999))].length, LIMITES.motivo)
  assert.equal(lerMotivo(undefined), '')
})

test('cutucada: estavel por conta, diferente por conta e por segredo, sem revelar o id', () => {
  const a = '6f9619ff-8b86-d011-b42d-00c04fc964ff'
  const b = '6f9619ff-8b86-d011-b42d-00c04fc964fe'
  assert.equal(chaveCutucada('s', a), chaveCutucada('s', a))
  assert.notEqual(chaveCutucada('s', a), chaveCutucada('s', b))
  assert.notEqual(chaveCutucada('s', a), chaveCutucada('t', a))
  assert.match(chaveCutucada('s', a), /^[0-9a-f]{20}$/)
  assert.ok(!chaveCutucada('s', a).includes(a.slice(0, 8)))
})
