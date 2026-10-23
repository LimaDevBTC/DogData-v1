// A página que o painel conta no domínio da DogCity (23/10/2026): a landing em dogcity.space não pode cair na "/" da DogData.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { paginaMedida } from './client'

test('dogcity.space grava o caminho interno da landing', () => {
  assert.equal(paginaMedida('/', 'dogcity.space'), '/dogcity')
  assert.equal(paginaMedida('/', 'www.dogcity.space'), '/dogcity')
  assert.equal(paginaMedida('/founders', 'dogcity.space'), '/dogcity/founders')
  assert.equal(paginaMedida('/dogcity/docs', 'dogcity.space'), '/dogcity/docs')
})

test('a DogData e os outros domínios ficam como estão', () => {
  assert.equal(paginaMedida('/', 'www.dogdata.xyz'), '/')
  assert.equal(paginaMedida('/dogcity', 'www.dogdata.xyz'), '/dogcity')
  assert.equal(paginaMedida('/', 'notdogcity.space'), '/')
})
