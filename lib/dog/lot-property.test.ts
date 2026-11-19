// Rodar: npx tsx --test lib/dog/lot-property.test.ts
//
// A PROPRIEDADE (fundador, 19/11/2026): lotes vizinhos da mesma carteira viram um terreno só no jogo.
// Os três lotes de S09-Q00-B0035 e os dois lotes soltos (S01, S07) são os cantos REAIS de
// dogcity-mundo plano/saida/lotes.json (master de 09/11); o resto é geometria simulada.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  agruparPropriedades, arquivoDeVizinhos, divisaEntre, encosto, lerVizinhos, numeroDe, paresVizinhos, propriedadeDoLote,
  quarteiraoDe, saoVizinhos, vizinhancaDaGeometria, type LoteGeo,
} from './lot-property'

const REAIS: LoteGeo[] = [
  { lotId: 'S09-Q00-B0035-L001', cantos: [[5707.77, 49.6], [5655.28, 49.4], [5655.04, 114.65], [5707.52, 114.85]] },
  { lotId: 'S09-Q00-B0035-L002', cantos: [[5655.28, 49.4], [5600.25, 49.2], [5600.0, 114.95], [5655.04, 114.65]] },
  { lotId: 'S09-Q00-B0035-L003', cantos: [[5600.25, 49.2], [5547.77, 49.0], [5547.52, 115.25], [5600.0, 114.95]] },
  { lotId: 'S01-Q90-B0079-L001', cantos: [[1499.92, -1081.3], [1581.77, -1137.2], [1533.12, -1195.1], [1454.94, -1147.16]] },
  { lotId: 'S07-Q00-B0001-L117', cantos: [[5266.34, -4501.42], [5370.54, -4376.58], [5296.9, -4316.56], [5040.58, -4308.45]] },
]

const quadrado = (lotId: string, x: number, z: number, w = 20, d = 30): LoteGeo =>
  ({ lotId, cantos: [[x, z], [x + w, z], [x + w, z + d], [x, z + d]] })

test('o id: quarteirão e número', () => {
  assert.equal(quarteiraoDe('S09-Q00-B0035-L002'), 'S09-Q00-B0035')
  assert.equal(numeroDe('S09-Q00-B0035-L002'), 2)
  assert.equal(quarteiraoDe('lixo'), null)
})

test('encosto: lados na mesma reta somam a sobreposição; lado paralelo afastado não encosta', () => {
  assert.equal(encosto([[0, 0], [10, 0]], [[4, 0], [20, 0]]), 6)
  assert.equal(encosto([[0, 0], [10, 0]], [[10, 0], [0, 0]]), 10)
  assert.equal(encosto([[0, 0], [10, 0]], [[0, 1], [10, 1]]), 0)   // uma rua de 1 m no meio
  assert.equal(encosto([[0, 0], [10, 0]], [[0, 0], [0, 10]]), 0)   // perpendicular
})

test('os três lotes reais de S09-Q00-B0035 são uma propriedade; S01 e S07 ficam sozinhos', () => {
  const [l1, l2, l3, s01, s07] = REAIS
  assert.ok(divisaEntre(l1.cantos, l2.cantos) > 60)
  assert.ok(saoVizinhos(l1, l2))
  assert.ok(saoVizinhos(l2, l3))
  assert.ok(!saoVizinhos(l1, l3)) // L001 e L003 não se tocam: a união passa pelo L002
  assert.ok(!saoVizinhos(s01, s07))
  const viz = vizinhancaDaGeometria(REAIS)
  const props = agruparPropriedades(REAIS.map((l) => l.lotId), viz)
  assert.deepEqual(props, [
    { id: 'S09-Q00-B0035-L001', lots: ['S09-Q00-B0035-L001', 'S09-Q00-B0035-L002', 'S09-Q00-B0035-L003'] },
    { id: 'S01-Q90-B0079-L001', lots: ['S01-Q90-B0079-L001'] },
    { id: 'S07-Q00-B0001-L117', lots: ['S07-Q00-B0001-L117'] },
  ])
})

test('sem o lote do meio, as pontas são duas propriedades (a carteira não guarda o que as une)', () => {
  const viz = vizinhancaDaGeometria(REAIS)
  const props = agruparPropriedades(['S09-Q00-B0035-L001', 'S09-Q00-B0035-L003'], viz)
  assert.equal(props.length, 2)
})

test('encostar só no canto não é vizinho; outro quarteirão, mesmo encostado, também não', () => {
  const a = quadrado('S04-Q01-B0100-L001', 0, 0)
  const canto = quadrado('S04-Q01-B0100-L002', 20, 30)  // toca só no ponto (20, 30)
  const lado = quadrado('S04-Q01-B0100-L003', 20, 0)
  const outroQ = quadrado('S04-Q01-B0101-L001', 0, 30)  // encosta no fundo, mas é outro quarteirão
  assert.ok(!saoVizinhos(a, canto))
  assert.ok(saoVizinhos(a, lado))
  assert.ok(!saoVizinhos(a, outroQ))
})

test('divisa curta demais (abaixo de 2 m) não une', () => {
  const a = quadrado('S04-Q01-B0100-L001', 0, 0)
  const b = quadrado('S04-Q01-B0100-L002', 20, 29)       // encosta 1 m
  const c = quadrado('S04-Q01-B0100-L003', 20, 27)       // encosta 3 m
  assert.ok(!saoVizinhos(a, b))
  assert.ok(saoVizinhos(a, c))
})

test('fundos que se encostam no mesmo quarteirão também unem (L em volta do quarteirão)', () => {
  const frente1 = quadrado('S05-Q02-B0200-L001', 0, 0)
  const frente2 = quadrado('S05-Q02-B0200-L002', 20, 0)
  const fundo = quadrado('S05-Q02-B0200-L009', 20, 30)
  const longe = quadrado('S05-Q02-B0200-L010', 80, 30)
  const todos = [frente1, frente2, fundo, longe]
  const props = agruparPropriedades(todos.map((l) => l.lotId), vizinhancaDaGeometria(todos))
  assert.deepEqual(props.map((p) => p.lots), [
    ['S05-Q02-B0200-L001', 'S05-Q02-B0200-L002', 'S05-Q02-B0200-L009'],
    ['S05-Q02-B0200-L010'],
  ])
  assert.equal(propriedadeDoLote(props, 'S05-Q02-B0200-L009')?.id, 'S05-Q02-B0200-L001')
})

test('sem a vizinhança (arquivo fora), cada lote é sozinho: nunca uma união chutada', () => {
  const props = agruparPropriedades(['S09-Q00-B0035-L002', 'S09-Q00-B0035-L001', 'lixo'], null)
  assert.deepEqual(props.map((p) => p.id), ['S09-Q00-B0035-L001', 'S09-Q00-B0035-L002'])
})

test('o arquivo de vizinhos ida e volta dá a mesma resposta da geometria', () => {
  const pares = paresVizinhos(REAIS)
  assert.deepEqual([...pares], [['S09-Q00-B0035', [[1, 2], [2, 3]]]])
  const arq = arquivoDeVizinhos(pares, 'teste')
  const viz = lerVizinhos(JSON.parse(JSON.stringify(arq)))!
  assert.ok(viz('S09-Q00-B0035-L002', 'S09-Q00-B0035-L001'))
  assert.ok(!viz('S09-Q00-B0035-L001', 'S09-Q00-B0035-L003'))
  assert.ok(!viz('S09-Q00-B0035-L001', 'S09-Q00-B0035-L001'))
  assert.equal(lerVizinhos({ versao: 2 }), null)
  assert.equal(lerVizinhos(null), null)
})

test('o arquivo do repo (data/dogcity_lot_vizinhos.json) une os três lotes reais e não une S01 com S07', () => {
  const viz = lerVizinhos(JSON.parse(readFileSync('data/dogcity_lot_vizinhos.json', 'utf8')))
  assert.ok(viz)
  const props = agruparPropriedades(REAIS.map((l) => l.lotId), viz)
  assert.deepEqual(props.map((p) => p.lots.length), [3, 1, 1])
})
