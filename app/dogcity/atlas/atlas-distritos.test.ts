// Rodar: npx tsx --test app/dogcity/atlas/atlas-distritos.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { DISTRITOS, distritoDoSlug, folhasDoDistrito, setorDaFolha } from './atlas-distritos'
import { ATLAS_PLATES, ATLAS_SHEETS } from './atlas-data'

test('nove distritos com os nomes do contrato e slugs de URL', () => {
  assert.deepEqual(DISTRITOS.map((d) => d.name), ['Harbor Canals', 'Liberty Row', 'Brownstone Heights', 'Arroyo', 'Timberline', 'Atomic Heights', 'The Spit', 'Financial District', 'Bay Shore'])
  assert.deepEqual(DISTRITOS.map((d) => d.slug), ['harbor-canals', 'liberty-row', 'brownstone-heights', 'arroyo', 'timberline', 'atomic-heights', 'the-spit', 'financial-district', 'bay-shore'])
  assert.equal(distritoDoSlug('timberline')?.code, 'S05')
  assert.equal(distritoDoSlug('TIMBERLINE')?.code, 'S05')
  assert.equal(distritoDoSlug('nope'), null)
  assert.equal(distritoDoSlug(null), null)
})

test('as folhas de cada distrito são as 09.xx do setor, e as nove juntas são todas as folhas', () => {
  assert.deepEqual(folhasDoDistrito(ATLAS_PLATES, ATLAS_SHEETS, distritoDoSlug('timberline')!), ['09.12', '09.13'])
  assert.deepEqual(folhasDoDistrito(ATLAS_PLATES, ATLAS_SHEETS, distritoDoSlug('financial-district')!), ['09.22'])
  const todas = DISTRITOS.flatMap((d) => folhasDoDistrito(ATLAS_PLATES, ATLAS_SHEETS, d))
  assert.deepEqual([...todas].sort(), [...ATLAS_SHEETS].sort())
  assert.equal(setorDaFolha('City Plan'), null)
})
