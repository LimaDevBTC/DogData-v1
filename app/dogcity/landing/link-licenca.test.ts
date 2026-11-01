// Rodar: npx tsx --test app/dogcity/landing/link-licenca.test.ts
//
// O link profundo da licença (contrato FUNIL_LOTE_LICENCA_CASA.md §3): só os três
// degraus e as três origens passam; o resto vira null, nunca lança.
import test from 'node:test'
import assert from 'node:assert/strict'
import { lerParametrosLicenca, limparParametrosLicenca } from './link-licenca'

test('os três degraus e as três origens passam', () => {
  assert.deepEqual(lerParametrosLicenca('?licence=personal&from=game'), { tier: 'personal', from: 'game' })
  assert.deepEqual(lerParametrosLicenca('?licence=commercial&from=mint'), { tier: 'commercial', from: 'mint' })
  assert.deepEqual(lerParametrosLicenca('licence=patron&from=profile'), { tier: 'patron', from: 'profile' })
})

test('fora da lista sai null, sem lançar', () => {
  assert.deepEqual(lerParametrosLicenca('?licence=founder&from=twitter'), { tier: null, from: null })
  assert.deepEqual(lerParametrosLicenca('?licence=PERSONAL'), { tier: null, from: null })
  assert.deepEqual(lerParametrosLicenca('?licence=<script>&from=%00'), { tier: null, from: null })
  assert.deepEqual(lerParametrosLicenca(''), { tier: null, from: null })
  assert.deepEqual(lerParametrosLicenca('?'), { tier: null, from: null })
})

test('um sem o outro: só os cartões, ou só a medida', () => {
  assert.deepEqual(lerParametrosLicenca('?from=game'), { tier: null, from: 'game' })
  assert.deepEqual(lerParametrosLicenca('?licence=personal'), { tier: 'personal', from: null })
})

test('limpar tira licence e from, mantém o hash e o resto', () => {
  assert.equal(
    limparParametrosLicenca('https://dogcity.space/?licence=commercial&from=game#tiers'),
    'https://dogcity.space/#tiers',
  )
  assert.equal(
    limparParametrosLicenca('https://dogcity.space/?utm_source=x&licence=personal#tiers'),
    'https://dogcity.space/?utm_source=x#tiers',
  )
  assert.equal(limparParametrosLicenca('nao-e-url'), 'nao-e-url')
})
