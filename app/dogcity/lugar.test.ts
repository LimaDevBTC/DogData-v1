// Rodar: npx tsx --test app/dogcity/lugar.test.ts
// O distrito pelo LUGAR do lote (25/11/2026): o ID e a escritura não mudam, só o rótulo de onde o lote fica.
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { sectorOf, districtOf, setorDoLugar, setorDoId } from './lugar'
import { DISTRITO_DO_SETOR } from './dogcity-data'
import LUGAR from './distrito-lugar.json'

test('um S09 que fica no meio da cidade diz onde fica', () => {
  assert.equal(sectorOf('S09-Q03-B0264-L001'), 'S03')
  assert.equal(districtOf('S09-Q03-B0264-L001'), 'Brownstone Heights')
  assert.equal(setorDoLugar('S09-Q03-B0264-L001'), 3)
  assert.equal(setorDoId('S09-Q03-B0264-L001'), 9) // o ID não muda
})

test('um S09 de orla que não está no mapa continua Bay Shore; os outros setores seguem o prefixo', () => {
  const orla = Object.keys(LUGAR.lotes).includes('S09-Q00-B0001-L001') ? 'S09-Q99-B9999-L001' : 'S09-Q00-B0001-L001'
  assert.equal(districtOf(orla), 'Bay Shore')
  assert.equal(districtOf('S05-Q01-B0100-L002'), 'Timberline')
  assert.equal(districtOf('S08-Q00-B0002-L004'), 'Financial District')
  assert.equal(districtOf('S07-Q00-B0001-L001'), 'The Spit')
})

test('o mapa: versão 1, 883 lotes S09, todo valor é S01..S06 ou S09', () => {
  assert.equal(LUGAR.v, 1)
  const ids = Object.keys(LUGAR.lotes)
  assert.equal(ids.length, 883)
  assert.ok(ids.every((id) => id.startsWith('S09-')))
  assert.ok(Object.values(LUGAR.lotes).every((v) => /^S0[1-69]$/.test(v)))
  assert.ok(Object.values(LUGAR.lotes).every((v) => DISTRITO_DO_SETOR[Number(v.slice(1))]))
})

test('a cópia é idêntica à do mint, se o repo do mint estiver ao lado', (t) => {
  const mint = new URL('../../../dogcity-mint/apps/web/app/_lib/distrito-lugar.json', import.meta.url)
  if (!existsSync(mint)) return t.skip('dogcity-mint não está ao lado')
  assert.deepEqual(JSON.parse(readFileSync(mint, 'utf8')), LUGAR)
})

test('o distrito de um lote vem de lugar.ts nas três rotas e na tela, não do prefixo', () => {
  for (const f of ['../api/dogcity/lot/route.ts', '../api/dogcity/lookup/route.ts', '../api/profile/route.ts']) {
    assert.match(readFileSync(new URL(f, import.meta.url), 'utf8'), /district: districtOf\(/, f)
  }
})
