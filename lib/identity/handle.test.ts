// Rodar: npx tsx --test lib/identity/handle.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { validateHandle } from './handle'

test('o exemplo das docs e os reservados da casa nao podem ser reivindicados', () => {
  for (const h of ['handle', 'Handle', 'yourhandle', 'your_handle', 'admin', 'dogcity', 'support']) {
    assert.deepEqual(validateHandle(h), { ok: false, reason: 'reserved' }, h)
  }
})

test('handle comum continua valido; formato ruim continua recusado', () => {
  assert.deepEqual(validateHandle(' BtcDog '), { ok: true, handle: 'btcdog' })
  assert.equal(validateHandle('handle`').reason, 'invalid_format')
  assert.equal(validateHandle('ab').reason, 'invalid_format')
})
