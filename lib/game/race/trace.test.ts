// Rodar: npx tsx --test lib/game/race/trace.test.ts
//
// A trajetoria enviada no fim da volta: formato, salto maximo, faixa da pista, portoes cruzados dentro da abertura e o relogio do
// cliente contra o carimbo do servidor. Um piloto de mentira (test-support.ts) da' a volta inteira da AN7 nos 61 portoes.
import test from 'node:test'
import assert from 'node:assert/strict'
import { REGRAS_TRACE, decodificarTrace, validarTrace, type AmostraTrace } from './trace'
import { pistaDe } from './track'
import { vmaxMs } from './models'
import { pontoDoMundo, semAsUltimas, simularVolta, type TraceD1 } from './test-support'

const PISTA = pistaDe('an7-v1')!
const CYBER = vmaxMs('cyber')
const kmh = (v: number) => v / 3.6

function honesta(extra: Partial<Parameters<typeof simularVolta>[0]> = {}) {
  const v = simularVolta({ pista: PISTA, vCruzeiro: kmh(190), ...extra })
  const d = decodificarTrace(v.trace)
  assert.equal(d.ok, true)
  return { v, amostras: d.ok ? d.amostras : [] }
}

test('a volta honesta passa: Cyber a 190 km/h, uns 12:45, ~3.900 amostras', () => {
  const { v, amostras } = honesta()
  assert.ok(amostras.length > 3_500 && amostras.length < 4_500, String(amostras.length))
  assert.ok(v.lapMs > 770_000 && v.lapMs < 860_000, String(v.lapMs))
  assert.deepEqual(validarTrace(amostras, PISTA, v.carimbos, CYBER), { ok: true })
})

test('atraso de rede no carimbo (ate 400 ms por portao) nao reprova uma volta honesta', () => {
  const lat = (i: number) => ((i * 7919) % 401) // 0 a 400 ms, repetivel
  const { v, amostras } = honesta({ latenciaMs: lat })
  assert.deepEqual(validarTrace(amostras, PISTA, v.carimbos, CYBER), { ok: true })
})

test('o cliente nem sempre grava o quadro da chegada: a trajetoria que para antes da linha passa', () => {
  const v = simularVolta({ pista: PISTA, vCruzeiro: kmh(190) })
  const d = decodificarTrace(semAsUltimas(v.trace, 1))
  assert.equal(d.ok, true)
  if (d.ok) assert.deepEqual(validarTrace(d.amostras, PISTA, v.carimbos, CYBER), { ok: true })
})

test('mas a trajetoria que acaba MUITO antes da chegada reprova (portao)', () => {
  const v = simularVolta({ pista: PISTA, vCruzeiro: kmh(190) })
  const d = decodificarTrace(semAsUltimas(v.trace, 20)) // 4 s antes, ~210 m
  assert.equal(d.ok, true)
  if (d.ok) assert.deepEqual(validarTrace(d.amostras, PISTA, v.carimbos, CYBER), { ok: false, motivo: 'trace_portao' })
})

test('a Moto2 a 340 km/h tambem passa com o piso dela', () => {
  const v = simularVolta({ pista: PISTA, vCruzeiro: kmh(340), aceleracao: 10 })
  const d = decodificarTrace(v.trace)
  assert.equal(d.ok, true)
  if (d.ok) assert.deepEqual(validarTrace(d.amostras, PISTA, v.carimbos, vmaxMs('moto2')), { ok: true })
})

// ---- os ataques ----

function comAmostra(amostras: AmostraTrace[], idx: number, troca: Partial<AmostraTrace>): AmostraTrace[] {
  return amostras.map((a, k) => (k === idx ? { ...a, ...troca } : a))
}

test('teleporte: pular um pedaco da volta reprova (buraco no tempo ou salto maximo)', () => {
  const { v, amostras } = honesta()
  const k = 1_000
  // 12 s de volta somem (60 amostras): o buraco passa de 5 s
  const pulo = amostras.slice(0, k).concat(amostras.slice(k + 60))
  assert.deepEqual(validarTrace(pulo, PISTA, v.carimbos, CYBER), { ok: false, motivo: 'trace_tempo' })
  // o mesmo salto com o tempo "remendado" para caber no buraco maximo: o deslocamento (2.100 m em 1 s) nao cabe em 1,05 x 58 m/s
  const remendo = amostras.slice(0, k).concat(amostras.slice(k + 60).map((a) => ({ ...a, t: a.t - 11_000 })))
  assert.deepEqual(validarTrace(remendo, PISTA, v.carimbos, CYBER), { ok: false, motivo: 'trace_salto' })
  // perder UMA amostra (o cliente pula quadro) e' so' um quadro perdido
  const adiante = amostras.slice(0, k).concat(amostras.slice(k + 1))
  assert.deepEqual(validarTrace(adiante, PISTA, v.carimbos, CYBER).ok, true) // sumir UMA amostra e' so' um quadro perdido
})

test('um ponto fora da pista reprova (faixa da pista)', () => {
  const { v, amostras } = honesta()
  const longe = pontoDoMundo(20_000, -60) // 60 m para FORA do eixo
  const r = validarTrace(comAmostra(amostras, 500, { x: longe.x, z: longe.z }), PISTA, v.carimbos, CYBER)
  assert.equal(r.ok, false)
  assert.equal(!r.ok && r.motivo, 'trace_fora')
  assert.deepEqual(validarTrace(comAmostra(amostras, 500, { y: 900 }), PISTA, v.carimbos, CYBER), { ok: false, motivo: 'trace_fora' })
})

test('velocidade informada absurda reprova', () => {
  const { v, amostras } = honesta()
  assert.equal(validarTrace(comAmostra(amostras, 700, { v: 300 }), PISTA, v.carimbos, CYBER).ok, false)
})

test('a volta feita mais rapido que o carro (250 km/h na Cyber de 210) reprova no deslocamento, mesmo com os carimbos limpos', () => {
  const v = simularVolta({ pista: PISTA, vCruzeiro: kmh(250) })
  const d = decodificarTrace(v.trace)
  assert.equal(d.ok, true)
  if (d.ok) assert.deepEqual(validarTrace(d.amostras, PISTA, v.carimbos, CYBER), { ok: false, motivo: 'trace_salto' })
})

test('errar a abertura de um portao reprova (portao): 8 m para dentro da faixa', () => {
  const g = PISTA.noAnel[30]!
  const v = simularVolta({ pista: PISTA, vCruzeiro: kmh(190), desvioU: (s) => (Math.abs(s - g.s_m) < 40 ? 8 : 0) })
  const d = decodificarTrace(v.trace)
  assert.equal(d.ok, true)
  if (d.ok) assert.deepEqual(validarTrace(d.amostras, PISTA, v.carimbos, CYBER), { ok: false, motivo: 'trace_portao' })
})

test('um robo que segura o POST da largada por 2,5 s para encurtar a volta reprova (relogio, mediana)', () => {
  const { v, amostras } = honesta({ latenciaMs: (i) => (i === 0 ? 2_500 : 0) })
  assert.deepEqual(validarTrace(amostras, PISTA, v.carimbos, CYBER), { ok: false, motivo: 'trace_relogio' })
})

test('um portao carimbado 5 s depois do que a trajetoria mostra reprova (relogio, por portao)', () => {
  const { v, amostras } = honesta({ latenciaMs: (i) => (i >= 30 && i < 33 ? 5_000 : 0) })
  assert.deepEqual(validarTrace(amostras, PISTA, v.carimbos, CYBER), { ok: false, motivo: 'trace_relogio' })
})

test('o relogio do cliente acelerado em 10% (speed hack) reprova', () => {
  const { v, amostras } = honesta()
  const rapido = amostras.map((a) => ({ ...a, t: Math.round(a.t * 0.9) }))
  // o deslocamento por amostra agora e' 11% maior que o possivel: cai antes no salto; o que importa e' que NAO passa
  assert.equal(validarTrace(rapido, PISTA, v.carimbos, CYBER).ok, false)
})

test('trajetoria de outra volta (portoes em outro tempo) reprova', () => {
  const lenta = simularVolta({ pista: PISTA, vCruzeiro: kmh(150) })
  const rapida = simularVolta({ pista: PISTA, vCruzeiro: kmh(190) })
  const d = decodificarTrace(lenta.trace)
  assert.equal(d.ok, true)
  if (d.ok) assert.equal(validarTrace(d.amostras, PISTA, rapida.carimbos, CYBER).ok, false)
})

// ---- a forma ----

const base = (): TraceD1 => simularVolta({ pista: PISTA, vCruzeiro: kmh(190) }).trace

test('formato: so o `d1` a 5 Hz, `q` com 5 numeros por amostra, inteiros seguros', () => {
  const t = base()
  assert.equal(decodificarTrace(t).ok, true)
  for (const ruim of [
    null, undefined, 'x', [], 7,
    { ...t, fmt: 'd2' },
    { ...t, hz: 10 },
    { ...t, n: t.n + 1 },
    { ...t, n: -1 },
    { ...t, n: 1.5 },
    { ...t, n: 12_001, q: new Array(12_001 * 5).fill(0) },
    { ...t, q: t.q.slice(0, -1) },
    { ...t, q: t.q.map((x, k) => (k === 7 ? Number.NaN : x)) },
    { ...t, q: t.q.map((x, k) => (k === 7 ? 1.5 : x)) },
    { ...t, q: t.q.map((x, k) => (k === 7 ? '3' : x)) },
    { ...t, q: t.q.map((x, k) => (k === 7 ? 2 ** 60 : x)) },
    { ...t, q: 'abc' },
  ]) {
    const r = decodificarTrace(ruim)
    assert.equal(r.ok, false, JSON.stringify(ruim)?.slice(0, 60))
  }
})

test('poucas amostras (e o corpo vazio da volta anulada) nao valem como trajetoria', () => {
  assert.deepEqual(decodificarTrace({ fmt: 'd1', hz: 5, n: 0, q: [] }), { ok: false, motivo: 'trace_pouco' })
  assert.deepEqual(decodificarTrace({ fmt: 'd1', hz: 5, n: 3, q: new Array(15).fill(1) }), { ok: false, motivo: 'trace_pouco' })
  const v = simularVolta({ pista: PISTA, vCruzeiro: kmh(190) })
  assert.deepEqual(validarTrace([], PISTA, v.carimbos, CYBER), { ok: false, motivo: 'trace_pouco' })
})

test('o tempo tem de crescer: amostras fora de ordem e repetidas reprovam', () => {
  const { v, amostras } = honesta()
  const repetida = amostras.map((a, k) => (k === 300 ? { ...a, t: amostras[299]!.t } : a))
  assert.deepEqual(validarTrace(repetida, PISTA, v.carimbos, CYBER), { ok: false, motivo: 'trace_tempo' })
  const volta = amostras.map((a, k) => (k === 300 ? { ...a, t: amostras[299]!.t - 50 } : a))
  assert.deepEqual(validarTrace(volta, PISTA, v.carimbos, CYBER), { ok: false, motivo: 'trace_tempo' })
})

test('um aparelho lento (1 quadro por segundo) tambem passa: o limite do buraco e' + "'" + ' de 5 s', () => {
  const v = simularVolta({ pista: PISTA, vCruzeiro: kmh(150), periodoMs: 1_000 })
  const d = decodificarTrace(v.trace)
  assert.equal(d.ok, true)
  if (d.ok) assert.deepEqual(validarTrace(d.amostras, PISTA, v.carimbos, CYBER), { ok: true })
  assert.equal(REGRAS_TRACE.maxIntervaloMs, 5_000)
})

test('o numero de carimbos tem de ser o de portoes', () => {
  const { v, amostras } = honesta()
  assert.deepEqual(validarTrace(amostras, PISTA, v.carimbos.slice(0, 60), CYBER), { ok: false, motivo: 'trace_relogio' })
})
