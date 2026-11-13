// Rodar: npx tsx --test lib/game/race/track.test.ts
//
// O tracado `an7-v1` do servidor e' o MESMO do cliente (dogcity-mundo, src/corrida/tracado.ts `gerarPortoes()`, PR #404). A soma de
// verificacao abaixo foi tirada da lista que o cliente gera (JSON.stringify de gerarPortoes(), sha256) em 13/11/2026: se este teste
// reprovar, o servidor e o jogo deixaram de concordar sobre os portoes. Mexer no tracado = pista nova (an7-v2), nunca editar a v1.
import test from 'node:test'
import assert from 'node:assert/strict'
import { AN7, PISTA_PADRAO, RUMO_LARGADA, VOLTA_M, canteiroNoRumo, gerarPortoes, medirNoAnel, pistaDe, resolverPortao, rumoBruto, rumoDoS, sDoRumo, somaDosPortoes } from './track'

const SOMA_CLIENTE_AN7_V1 = '56b0afb5076b712eae30d208f9e7ab7d21cecf8c1c21a0bac58b7a18148a7783'

test('a lista de portoes e a do cliente: 61 portoes, soma de verificacao igual', () => {
  const g = gerarPortoes()
  assert.equal(g.length, 61)
  assert.equal(somaDosPortoes(g), SOMA_CLIENTE_AN7_V1)
})

test('a volta mede 43.668 m e a largada fica em 93,483 graus (o lote da DOG MOTORS)', () => {
  assert.ok(Math.abs(VOLTA_M - 43_668.137884898126) < 1e-6)
  assert.equal(RUMO_LARGADA, 93.483)
  assert.equal(AN7.raio, 6950)
})

test('largada no comeco, chegada no fim, s crescente, 35 portoes comuns e 24 de chicane', () => {
  const g = gerarPortoes()
  assert.deepEqual(g[0], { i: 0, s_m: 0, lane: 1, kind: 'largada' })
  assert.deepEqual(g[60], { i: 60, s_m: 43_668.14, lane: 1, kind: 'chegada' })
  for (let k = 0; k < g.length; k++) assert.equal(g[k]!.i, k)
  for (let k = 1; k < g.length; k++) assert.ok(g[k]!.s_m > g[k - 1]!.s_m, `s crescente em ${k}`)
  const por = (kind: string) => g.filter((p) => p.kind === kind).length
  assert.deepEqual([por('largada'), por('portao'), por('chicane'), por('chegada')], [1, 35, 24, 1])
  // o primeiro portao comum: 1/36 da volta, faixa da borda; o seguinte, faixa do canteiro
  assert.deepEqual(g[1], { i: 1, s_m: 1213, lane: 2, kind: 'portao' })
  assert.deepEqual(g[2], { i: 2, s_m: 2426.01, lane: 0, kind: 'portao' })
  // a chicane da AV05 (120 graus): 3 portoes a 75 m um do outro, borda, canteiro, borda
  assert.deepEqual(g.slice(3, 6).map((p) => [p.s_m, p.lane, p.kind]), [[3141.52, 2, 'chicane'], [3216.52, 0, 'chicane'], [3291.52, 2, 'chicane']])
})

test('rumo e distancia: ida e volta, sentido horario, norte = -Z', () => {
  assert.ok(Math.abs(rumoBruto(0, -100)) < 1e-9)
  assert.ok(Math.abs(rumoBruto(100, 0) - 90) < 1e-9)
  assert.ok(Math.abs(rumoBruto(0, 100) - 180) < 1e-9)
  assert.ok(Math.abs(rumoBruto(-100, 0) - 270) < 1e-9)
  assert.ok(Math.abs(sDoRumo(RUMO_LARGADA + 10) - (10 * Math.PI * 6950) / 180) < 1e-6)
  assert.ok(Math.abs(rumoDoS(sDoRumo(200)) - 200) < 1e-9)
  const m = medirNoAnel(0, -6928)
  assert.ok(Math.abs(m.u - 22) < 1e-9)
})

test('o canteiro: 8 m na Orla Nobre, 3,96 m fora, rampa linear de 0,5 grau nas pontas', () => {
  assert.ok(Math.abs(canteiroNoRumo(0) - 8) < 1e-12)
  assert.ok(Math.abs(canteiroNoRumo(93.483) - 8) < 1e-12)
  assert.ok(Math.abs(canteiroNoRumo(200) - 3.96) < 1e-12)
  assert.ok(Math.abs(canteiroNoRumo(116.75) - (3.96 + 4.04 * 0.5)) < 1e-9)
  assert.ok(Math.abs(canteiroNoRumo(345.75) - (3.96 + 4.04 * 0.5)) < 1e-9)
})

test('a abertura dos portoes: largada pela pista de dentro inteira, comum e chicane com 7 m', () => {
  const g = gerarPortoes()
  const l = resolverPortao(g[0]!)
  assert.ok(Math.abs(l.u - 13) < 1e-9 && Math.abs(l.w - 20) < 1e-9)
  const comum = resolverPortao(g[1]!) // faixa da borda: 22 - 0,5 - 3,5
  assert.ok(Math.abs(comum.u - 18) < 1e-9 && comum.w === 7)
  const canteiro = resolverPortao(g[2]!) // faixa do canteiro, canteiro 8 m: 4 + 0,5 + 3,5
  assert.ok(Math.abs(canteiro.u - 8) < 1e-9)
  // fora da Orla Nobre o canteiro e' de 3,96 m: 1,98 + 0,5 + 3,5
  const fora = resolverPortao(g.find((p) => p.kind === 'portao' && p.lane === 0 && resolverPortao(p).rumo > 130 && resolverPortao(p).rumo < 340)!)
  assert.ok(Math.abs(fora.u - 5.98) < 1e-9)
})

test('o registro de pistas: so a an7-v1', () => {
  assert.equal(PISTA_PADRAO, 'an7-v1')
  const p = pistaDe('an7-v1')
  assert.ok(p && p.portoes.length === 61 && p.noAnel.length === 61 && p.somaPortoes === SOMA_CLIENTE_AN7_V1)
  assert.equal(pistaDe('an7-v2'), null)
  assert.equal(pistaDe('__proto__'), null)
  assert.equal(pistaDe(undefined), null)
})
