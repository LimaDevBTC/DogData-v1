// Rodar: npx tsx --test lib/game/race/service.test.ts
//
// O servico da corrida de ponta a ponta (start, gate, finish, leaderboard, me, abertura e premio v2), com o banco na memoria (store-memory.ts,
// as mesmas regras das migrations 038 e 041) e um piloto de mentira que da' a volta inteira nos 61 portoes (test-support.ts). O relogio e'
// o do servidor: cada portao entra no instante do carimbo simulado.
import test from 'node:test'
import assert from 'node:assert/strict'
import { iniciar, meu, portao, ranking, terminar, type Deps, type Resposta } from './service'
import { StoreMemoria } from './store-memory'
import { MODELOS_CORRIDA } from './models'
import { pistaDe } from './track'
import { pontoDoMundo, simularVolta, type VoltaSimulada } from './test-support'

const PISTA = pistaDe('an7-v1')!
const W1 = 'bc1p' + 'a'.repeat(58)
const W2 = 'bc1p' + 'b'.repeat(58)
const W3 = 'bc1p' + 'c'.repeat(58)
const LIMPA = { autopilot: false, teleport: false, diag: false, void: null }
const kmh = (v: number) => v / 3.6

let seq = 0
function novo(): { d: Deps; store: StoreMemoria } {
  const store = new StoreMemoria()
  return { d: { store, novoId: () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}` }, store }
}

const corpo = (r: Resposta) => r.body as Record<string, unknown>

/** O corpo do finish de uma volta valida na regra v2: os campos do v1 + phase, opening e openingClosed. */
const valida = (c: { volta: VoltaSimulada }, o: { rank: number; record: boolean; prize?: 'none' | 'pending_review'; phase?: 'opening' | 'open'; drivers?: number; openingClosed?: boolean }) => ({
  valid: true,
  lapMs: c.volta.lapMs,
  rank: o.rank,
  record: o.record,
  prize: o.prize ?? 'none',
  phase: o.phase ?? 'open',
  opening: { drivers: o.drivers ?? 1, needed: 10 },
  openingClosed: o.openingClosed ?? false,
})

interface Corrida {
  raceId: string
  volta: VoltaSimulada
  fim: Resposta
  gates: Resposta[]
}

/**
 * Uma volta inteira pelo servico: start 10 s antes da linha, 61 portoes nos carimbos do piloto, finish 200 ms depois do ultimo.
 * `t0` = o relogio do servidor na linha de largada. `kmhCruzeiro` abaixo da Vmax do modelo.
 */
async function correr(d: Deps, wallet: string, model: string, t0: number, kmhCruzeiro: number, opcoes: { flags?: object; clientLapMs?: number | null; trace?: unknown; desvio?: number } = {}): Promise<Corrida> {
  const ini = await iniciar(d, wallet, { model, track: 'an7-v1' }, t0 - 10_000)
  assert.equal(ini.status, 200, JSON.stringify(ini.body))
  const raceId = corpo(ini).raceId as string
  const volta = simularVolta({ pista: PISTA, vCruzeiro: kmh(kmhCruzeiro), t0Servidor: t0, desvioU: opcoes.desvio ? () => opcoes.desvio! : undefined })
  const gates: Resposta[] = []
  for (const g of PISTA.noAnel) {
    const { x, z } = pontoDoMundo(g.s_m, g.u)
    gates.push(await portao(d, wallet, { raceId, i: g.i, pos: [x, 0, z], v: kmh(kmhCruzeiro) }, volta.carimbos[g.i]!.t))
  }
  const fim = await terminar(d, wallet, { raceId, trace: opcoes.trace ?? volta.trace, flags: opcoes.flags ?? LIMPA, clientLapMs: opcoes.clientLapMs === undefined ? volta.lapMs : opcoes.clientLapMs }, volta.carimbos[60]!.t + 200)
  return { raceId, volta, fim, gates }
}

const HOJE = 1_800_000_000_000

// ---- start ----

test('start: devolve raceId, relogio do servidor, os 61 portoes e o prazo de 30 min', async () => {
  const { d } = novo()
  const r = await iniciar(d, W1, { model: 'cyber', track: 'an7-v1' }, HOJE)
  assert.equal(r.status, 200)
  const b = corpo(r)
  assert.equal(typeof b.raceId, 'string')
  assert.equal(b.serverTime, HOJE)
  assert.equal(b.expiresAt, HOJE + 30 * 60_000)
  assert.deepEqual(b.gates, PISTA.portoes)
  assert.equal((b.gates as unknown[]).length, 61)
})

test('start: modelo e pista desconhecidos, corpo lixo', async () => {
  const { d } = novo()
  for (const ruim of [{ model: 'c99', track: 'an7-v1' }, { model: 'cyber', track: 'an7-v9' }, { model: '__proto__', track: 'an7-v1' }, { track: 'an7-v1' }, null, 'x', [], 7]) {
    const r = await iniciar(d, W1, ruim, HOJE)
    assert.equal(r.status, 400, JSON.stringify(ruim))
  }
})

test('start: UMA volta aberta por carteira (a nova substitui a velha); outras carteiras nao se afetam', async () => {
  const { d, store } = novo()
  const a = corpo(await iniciar(d, W1, { model: 'cyber', track: 'an7-v1' }, HOJE)).raceId as string
  const o = corpo(await iniciar(d, W2, { model: 'moto2', track: 'an7-v1' }, HOJE)).raceId as string
  const b = corpo(await iniciar(d, W1, { model: 'cyber', track: 'an7-v1' }, HOJE + 1_000)).raceId as string
  assert.notEqual(a, b)
  assert.equal(store.voltas.get(a)!.status, 'void')
  assert.equal(store.voltas.get(a)!.voidReason, 'replaced')
  assert.equal(store.voltas.get(b)!.status, 'open')
  assert.equal(store.voltas.get(o)!.status, 'open')
  // o portao da volta velha, que o cliente ainda mande, nao entra
  const velho = await portao(d, W1, { raceId: a, i: 0, pos: [0, 0, -6937], v: 0 }, HOJE + 2_000)
  assert.equal(velho.status, 409)
})

// ---- gate ----

test('gate: o servidor carimba o portao no SEU relogio e devolve o carimbo', async () => {
  const { d } = novo()
  const raceId = corpo(await iniciar(d, W1, { model: 'cyber', track: 'an7-v1' }, HOJE)).raceId as string
  const g0 = PISTA.noAnel[0]!
  const { x, z } = pontoDoMundo(g0.s_m, g0.u)
  const r = await portao(d, W1, { raceId, i: 0, pos: [x, 0, z], v: 5 }, HOJE + 12_345)
  assert.deepEqual([r.status, corpo(r)], [200, { ok: true, t: HOJE + 12_345 }])
})

test('gate: de outra carteira ou raceId inexistente = 404; corpo lixo = 400', async () => {
  const { d } = novo()
  const raceId = corpo(await iniciar(d, W1, { model: 'cyber', track: 'an7-v1' }, HOJE)).raceId as string
  const bom = { raceId, i: 0, pos: [6937, 0, 0], v: 5 }
  assert.equal((await portao(d, W2, bom, HOJE + 1)).status, 404)
  assert.equal((await portao(d, W1, { ...bom, raceId: '11111111-1111-4111-8111-111111111111' }, HOJE + 1)).status, 404)
  for (const ruim of [{ ...bom, raceId: 'x' }, { ...bom, i: -1 }, { ...bom, i: 1.5 }, { ...bom, i: 400 }, { ...bom, pos: [1, 2] }, { ...bom, pos: [1, 2, Number.NaN] }, { ...bom, v: 'a' }, null, 5]) {
    assert.equal((await portao(d, W1, ruim, HOJE + 1)).status, 400, JSON.stringify(ruim))
  }
})

test('gate: fora de ordem (pulou) anula a volta', async () => {
  const { d, store } = novo()
  const raceId = corpo(await iniciar(d, W1, { model: 'cyber', track: 'an7-v1' }, HOJE)).raceId as string
  const g5 = PISTA.noAnel[5]!
  const { x, z } = pontoDoMundo(g5.s_m, g5.u)
  const r = await portao(d, W1, { raceId, i: 5, pos: [x, 0, z], v: 50 }, HOJE + 5_000)
  assert.equal(r.status, 409)
  assert.equal(corpo(r).ok, false)
  assert.equal(store.voltas.get(raceId)!.voidReason, 'gate_ordem')
  // a volta anulada nao aceita mais nada
  assert.equal((await portao(d, W1, { raceId, i: 0, pos: [x, 0, z], v: 50 }, HOJE + 6_000)).status, 409)
})

test('gate: repetido (um portao que ja passou) anula; repetir o ULTIMO devolve o mesmo carimbo sem gravar', async () => {
  const { d, store } = novo()
  const raceId = corpo(await iniciar(d, W1, { model: 'cyber', track: 'an7-v1' }, HOJE)).raceId as string
  const pos = (i: number): [number, number, number] => {
    const g = PISTA.noAnel[i]!
    const p = pontoDoMundo(g.s_m, g.u)
    return [p.x, 0, p.z]
  }
  const t0 = HOJE + 10_000
  assert.equal((await portao(d, W1, { raceId, i: 0, pos: pos(0), v: 5 }, t0)).status, 200)
  const t1 = t0 + 21_000
  assert.equal((await portao(d, W1, { raceId, i: 1, pos: pos(1), v: 50 }, t1)).status, 200)
  const antes = store.gravacoes
  const re = await portao(d, W1, { raceId, i: 1, pos: pos(1), v: 50 }, t1 + 700)
  assert.deepEqual([re.status, corpo(re)], [200, { ok: true, t: t1 }])
  assert.equal(store.gravacoes, antes)
  assert.equal(store.voltas.get(raceId)!.status, 'open')
  const velho = await portao(d, W1, { raceId, i: 0, pos: pos(0), v: 5 }, t1 + 5_000)
  assert.equal(velho.status, 409)
  assert.equal(store.voltas.get(raceId)!.voidReason, 'gate_repetido')
})

test('gate: trecho mais rapido que distancia / (1,05 x Vmax) = 422 e a volta e anulada', async () => {
  const { d, store } = novo()
  const raceId = corpo(await iniciar(d, W1, { model: 'cyber', track: 'an7-v1' }, HOJE)).raceId as string
  const pos = (i: number): [number, number, number] => {
    const g = PISTA.noAnel[i]!
    const p = pontoDoMundo(g.s_m, g.u)
    return [p.x, 0, p.z]
  }
  const t0 = HOJE + 10_000
  await portao(d, W1, { raceId, i: 0, pos: pos(0), v: 5 }, t0)
  // 1.213 m a 210 km/h x 1,05 pedem 19,8 s; 15 s e' impossivel
  const r = await portao(d, W1, { raceId, i: 1, pos: pos(1), v: 80 }, t0 + 15_000)
  assert.equal(r.status, 422)
  assert.equal(store.voltas.get(raceId)!.voidReason, 'gate_velocidade')
})

test('gate: o mesmo trecho e legal para a Moto2 (350 km/h) e ilegal para o Cyber (210)', async () => {
  const { d } = novo()
  const pos = (i: number): [number, number, number] => {
    const g = PISTA.noAnel[i]!
    const p = pontoDoMundo(g.s_m, g.u)
    return [p.x, 0, p.z]
  }
  const corre = async (model: string, w: string) => {
    const raceId = corpo(await iniciar(d, w, { model, track: 'an7-v1' }, HOJE)).raceId as string
    await portao(d, w, { raceId, i: 0, pos: pos(0), v: 5 }, HOJE + 10_000)
    return portao(d, w, { raceId, i: 1, pos: pos(1), v: 90 }, HOJE + 10_000 + 12_000) // 12 s para 1.213 m = 364 km/h; a Moto2 aguenta 1,05 x 350 = 367
  }
  assert.equal((await corre('moto2', W1)).status, 200)
  assert.equal((await corre('cyber', W2)).status, 422)
})

test('gate: ponto longe do anel da AN7 anula (o centro da cidade nao e perimetral)', async () => {
  const { d, store } = novo()
  const raceId = corpo(await iniciar(d, W1, { model: 'cyber', track: 'an7-v1' }, HOJE)).raceId as string
  const r = await portao(d, W1, { raceId, i: 0, pos: [0, 0, 0], v: 5 }, HOJE + 10_000)
  assert.equal(r.status, 422)
  assert.equal(store.voltas.get(raceId)!.voidReason, 'gate_pos')
})

test('gate: depois de 30 min a volta expirou (410) e fica anulada', async () => {
  const { d, store } = novo()
  const raceId = corpo(await iniciar(d, W1, { model: 'cyber', track: 'an7-v1' }, HOJE)).raceId as string
  const g = PISTA.noAnel[0]!
  const p = pontoDoMundo(g.s_m, g.u)
  const r = await portao(d, W1, { raceId, i: 0, pos: [p.x, 0, p.z], v: 5 }, HOJE + 30 * 60_000 + 1)
  assert.equal(r.status, 410)
  assert.equal(store.voltas.get(raceId)!.voidReason, 'expired')
  // no ultimo milissegundo do prazo ainda vale
  const id2 = corpo(await iniciar(d, W2, { model: 'cyber', track: 'an7-v1' }, HOJE)).raceId as string
  assert.equal((await portao(d, W2, { raceId: id2, i: 0, pos: [p.x, 0, p.z], v: 5 }, HOJE + 30 * 60_000)).status, 200)
})

// ---- finish: a volta valida ----

test('uma volta inteira honesta: valida, tempo oficial = ultimo carimbo menos a largada, recorde, primeiro, sem premio (Cyber)', async () => {
  const { d, store } = novo()
  const c = await correr(d, W1, 'cyber', HOJE, 190)
  assert.ok(c.gates.every((g) => g.status === 200))
  assert.deepEqual(corpo(c.fim), valida(c, { rank: 1, record: true }))
  assert.equal(c.volta.lapMs, c.volta.carimbos[60]!.t - c.volta.carimbos[0]!.t)
  const v = store.voltas.get(c.raceId)!
  assert.equal(v.status, 'valid')
  assert.equal(v.splits!.length, 61)
  assert.equal(v.splits![0], 0)
  assert.equal(v.splits![60], c.volta.lapMs)
  assert.equal(store.recordes.get('an7-v1|cyber')!.lapId, c.raceId)
})

test('o tempo do relogio do cliente e informativo: um clientLapMs mentiroso nao muda o tempo oficial', async () => {
  const { d } = novo()
  const c = await correr(d, W1, 'cyber', HOJE, 190, { clientLapMs: 500_000 })
  assert.equal(corpo(c.fim).valid, true)
  assert.equal(corpo(c.fim).lapMs, c.volta.lapMs)
})

test('finish de uma volta ja valida devolve o MESMO resultado e nao regrava (a resposta se perdeu)', async () => {
  const { d, store } = novo()
  const c = await correr(d, W1, 'cyber', HOJE, 190)
  const antes = store.gravacoes
  const de_novo = await terminar(d, W1, { raceId: c.raceId, trace: c.volta.trace, flags: LIMPA, clientLapMs: c.volta.lapMs }, HOJE + 99_999_999)
  assert.deepEqual(corpo(de_novo), corpo(c.fim))
  assert.equal(store.gravacoes, antes)
})

test('finish de volta alheia ou inexistente = 404; corpo lixo = 400', async () => {
  const { d } = novo()
  const c = await correr(d, W1, 'cyber', HOJE, 190)
  assert.equal((await terminar(d, W2, { raceId: c.raceId, trace: c.volta.trace, flags: LIMPA, clientLapMs: null }, HOJE)).status, 404)
  assert.equal((await terminar(d, W1, { raceId: '22222222-2222-4222-8222-222222222222', trace: {}, flags: LIMPA, clientLapMs: null }, HOJE)).status, 404)
  for (const ruim of [null, 7, { raceId: 'x' }, { raceId: c.raceId, flags: { autopilot: 'sim' } }, { raceId: c.raceId, flags: null }]) {
    assert.equal((await terminar(d, W1, ruim, HOJE)).status, 400, JSON.stringify(ruim))
  }
})

// ---- finish: o que anula ou exclui ----

for (const [nome, flags, motivo] of [
  ['piloto automatico', { ...LIMPA, autopilot: true, void: 'piloto' }, 'flag_autopilot'],
  ['teleporte', { ...LIMPA, teleport: true, void: 'teleporte' }, 'flag_teleport'],
  ['ganchos de diagnostico', { ...LIMPA, diag: true, void: 'diag' }, 'flag_diag'],
  ['anulada pelo cliente (saiu da pista)', { ...LIMPA, void: 'fora' }, 'client_fora'],
  ['motorista de prova (bot)', { ...LIMPA, bot: true }, 'bot'],
] as const) {
  test(`finish: ${nome} anula a volta, mesmo com os portoes limpos, e ela NAO vai ao ranking`, async () => {
    const { d, store } = novo()
    const c = await correr(d, W1, 'cyber', HOJE, 190, { flags })
    assert.deepEqual(corpo(c.fim), { valid: false, lapMs: null, rank: null, record: false, prize: 'none' })
    assert.equal(store.voltas.get(c.raceId)!.status, 'void')
    assert.equal(store.voltas.get(c.raceId)!.voidReason, motivo)
    assert.equal(store.recordes.size, 0)
    const rk = await ranking(d, 'an7-v1', 'cyber', 50)
    assert.deepEqual((corpo(rk).entries as unknown[]).length, 0)
  })
}

test('finish: a volta anulada pelo cliente com o corpo minimo (trace vazio) fecha a aberta', async () => {
  const { d, store } = novo()
  const raceId = corpo(await iniciar(d, W1, { model: 'cyber', track: 'an7-v1' }, HOJE)).raceId as string
  const r = await terminar(d, W1, { raceId, trace: { fmt: 'd1', hz: 5, n: 0, q: [] }, flags: { ...LIMPA, void: 'desistiu' }, clientLapMs: null }, HOJE + 5_000)
  assert.equal(corpo(r).valid, false)
  assert.equal(store.voltas.get(raceId)!.status, 'void')
  // e a carteira ja pode largar de novo
  assert.equal((await iniciar(d, W1, { model: 'cyber', track: 'an7-v1' }, HOJE + 6_000)).status, 200)
})

test('finish: faltando portao (ou o finish sem os portoes) nao vale', async () => {
  const { d, store } = novo()
  const raceId = corpo(await iniciar(d, W1, { model: 'cyber', track: 'an7-v1' }, HOJE)).raceId as string
  const volta = simularVolta({ pista: PISTA, vCruzeiro: kmh(190), t0Servidor: HOJE + 10_000 })
  for (const i of [0, 1, 2]) {
    const g = PISTA.noAnel[i]!
    const p = pontoDoMundo(g.s_m, g.u)
    await portao(d, W1, { raceId, i, pos: [p.x, 0, p.z], v: 50 }, volta.carimbos[i]!.t)
  }
  const r = await terminar(d, W1, { raceId, trace: volta.trace, flags: LIMPA, clientLapMs: volta.lapMs }, volta.carimbos[60]!.t)
  assert.equal(corpo(r).valid, false)
  assert.equal(store.voltas.get(raceId)!.voidReason, 'gates_faltando')
})

test('finish: depois dos 30 min a volta aberta e anulada (expirou)', async () => {
  const { d, store } = novo()
  const raceId = corpo(await iniciar(d, W1, { model: 'cyber', track: 'an7-v1' }, HOJE)).raceId as string
  const r = await terminar(d, W1, { raceId, trace: {}, flags: LIMPA, clientLapMs: null }, HOJE + 30 * 60_000 + 1)
  assert.equal(corpo(r).valid, false)
  assert.equal(store.voltas.get(raceId)!.voidReason, 'expired')
})

test('finish: trajetoria que nao confere anula (portoes limpos no relogio, mas o carro nunca passou por eles)', async () => {
  const { d, store } = novo()
  const g30 = PISTA.noAnel[30]!.s_m
  const robo = simularVolta({ pista: PISTA, vCruzeiro: kmh(190), t0Servidor: HOJE, desvioU: (s) => 9 * Math.max(0, 1 - Math.abs(s - g30) / 60) }) // desvia 9 m no portao 30
  const c = await correr(d, W1, 'cyber', HOJE, 190, { trace: robo.trace })
  assert.equal(corpo(c.fim).valid, false)
  assert.equal(store.voltas.get(c.raceId)!.voidReason, 'trace_portao')
  // trajetoria em outro formato
  const c2 = await correr(d, W2, 'cyber', HOJE, 190, { trace: { fmt: 'zip', n: 1, q: [] } })
  assert.equal(corpo(c2.fim).valid, false)
  assert.equal(store.voltas.get(c2.raceId)!.voidReason, 'trace_formato')
})

test('finish: copiar a trajetoria de outra volta valida nao vale (a mesma trajetoria uma vez so)', async () => {
  const { d, store } = novo()
  const a = await correr(d, W1, 'cyber', HOJE, 190)
  assert.equal(corpo(a.fim).valid, true)
  const b = await correr(d, W2, 'cyber', HOJE + 3_600_000, 190, { trace: a.volta.trace })
  assert.equal(corpo(b.fim).valid, false)
  assert.equal(store.voltas.get(b.raceId)!.voidReason, 'trace_duplicate')
})

// ---- ranking, empate, recorde ----

test('o ranking mostra a melhor volta de cada carteira; so a primeira linha traz os splits; o handle vem do perfil', async () => {
  const { d, store } = novo()
  store.perfis.set(W1, 'speedy')
  const a = await correr(d, W1, 'cyber', HOJE, 190) // mais rapida
  await correr(d, W2, 'cyber', HOJE + 3_600_000, 170)
  await correr(d, W1, 'cyber', HOJE + 7_200_000, 150) // volta pior da mesma carteira: o ranking guarda a melhor dela
  const rk = corpo(await ranking(d, 'an7-v1', 'cyber', 50))
  assert.equal(rk.track, 'an7-v1')
  assert.equal(rk.model, 'cyber')
  const e = rk.entries as Array<Record<string, unknown>>
  assert.equal(e.length, 2)
  assert.deepEqual(e.map((x) => [x.rank, x.wallet]), [[1, W1], [2, W2]])
  assert.equal(e[0]!.lapMs, a.volta.lapMs)
  assert.equal(e[0]!.handle, 'speedy')
  assert.equal(e[1]!.handle, null)
  assert.equal((e[0]!.splits as number[]).length, 61)
  assert.equal(e[1]!.splits, null)
  assert.match(e[0]!.at as string, /^\d{4}-\d\d-\d\dT/)
})

test('o ranking e por modelo; limite entre 1 e 200; pista e modelo invalidos = 400', async () => {
  const { d } = novo()
  await correr(d, W1, 'cyber', HOJE, 190)
  assert.equal(((corpo(await ranking(d, 'an7-v1', 'moto2', 50)).entries) as unknown[]).length, 0)
  assert.equal(((corpo(await ranking(d, 'an7-v1', 'cyber', 0)).entries) as unknown[]).length, 1)
  assert.equal(((corpo(await ranking(d, 'an7-v1', 'cyber', Number.NaN)).entries) as unknown[]).length, 1)
  assert.equal((await ranking(d, 'an7-v9', 'cyber', 50)).status, 400)
  assert.equal((await ranking(d, 'an7-v1', 'c99', 50)).status, 400)
})

test('empate: vale a volta feita primeiro; a que empata depois nao e recorde e fica em 2o', async () => {
  const { d } = novo()
  const a = await correr(d, W1, 'cyber', HOJE, 190)
  const b = await correr(d, W2, 'cyber', HOJE + 3_600_000, 190, { desvio: 0.3 }) // o mesmo cruzeiro: o mesmo tempo ao milissegundo (30 cm de lado: outra trajetoria)
  assert.equal(a.volta.lapMs, b.volta.lapMs)
  assert.deepEqual(corpo(a.fim), valida(a, { rank: 1, record: true }))
  assert.deepEqual(corpo(b.fim), valida(b, { rank: 2, record: false, drivers: 2 }))
  const rk = (corpo(await ranking(d, 'an7-v1', 'cyber', 50)).entries as Array<{ wallet: string }>).map((x) => x.wallet)
  assert.deepEqual(rk, [W1, W2])
})

test('bater o recorde: ESTRITAMENTE mais rapido; o ranking sobe; me traz a melhor e a posicao', async () => {
  const { d } = novo()
  await correr(d, W1, 'cyber', HOJE, 170)
  const r2 = await correr(d, W2, 'cyber', HOJE + 3_600_000, 190)
  assert.deepEqual([corpo(r2.fim).rank, corpo(r2.fim).record], [1, true])
  const r3 = await correr(d, W3, 'cyber', HOJE + 7_200_000, 150)
  assert.deepEqual([corpo(r3.fim).rank, corpo(r3.fim).record], [3, false])
  const eu = corpo(await meu(d, W1, HOJE + 8_000_000))
  assert.equal(eu.wallet, W1)
  assert.deepEqual(Object.keys(eu.best as object), ['cyber'])
  assert.equal((eu.best as Record<string, { rank: number }>).cyber!.rank, 2)
  assert.equal(eu.open, null)
})

test('me: a volta aberta aparece enquanto nao expirou; carteira sem volta vem vazia', async () => {
  const { d } = novo()
  const raceId = corpo(await iniciar(d, W1, { model: 'moto2', track: 'an7-v1' }, HOJE)).raceId as string
  const vivo = corpo(await meu(d, W1, HOJE + 60_000))
  assert.deepEqual(vivo.open, { raceId, model: 'moto2', expiresAt: HOJE + 30 * 60_000 })
  assert.deepEqual(vivo.best, {})
  assert.equal(corpo(await meu(d, W1, HOJE + 30 * 60_000 + 1)).open, null)
  assert.deepEqual(corpo(await meu(d, W3, HOJE)), { wallet: W3, best: {}, open: null })
})

// ---- a abertura e o premio (regra v2) ----

/** A carteira n (a mesma para sempre). */
const carteira = (n: number): string => 'bc1p' + String(n).padStart(58, '0')
/** O relogio da n-esima volta do teste: uma por hora, sempre depois da anterior (a ordem de chegada e' a ordem de n). */
const quando = (n: number): number => HOJE + 1_000_000 + n * 3_600_000

/**
 * O c02 (Vmax 350) com `kmhs.length` carteiras diferentes, a carteira k+1 na velocidade kmhs[k]: quem tem mais velocidade faz a melhor volta.
 * Devolve as voltas na ordem de chegada.
 */
async function abrirC02(d: Deps, kmhs: number[], modelo = 'c02'): Promise<Corrida[]> {
  const out: Corrida[] = []
  for (let k = 0; k < kmhs.length; k++) out.push(await correr(d, carteira(k + 1), modelo, quando(k), kmhs[k]!))
  return out
}

const LENTO = 300
const nove = (extra = 0): number[] => Array.from({ length: 9 }, (_, k) => LENTO + k + extra)

test('abertura: com 9 carteiras NINGUEM e premiado, nem o recorde; a fase e opening e o contador sobe', async () => {
  const { d, store } = novo()
  const voltas = await abrirC02(d, nove())
  voltas.forEach((c, k) => {
    const b = corpo(c.fim)
    assert.equal(b.valid, true)
    assert.equal(b.prize, 'none')
    assert.equal(b.phase, 'opening')
    assert.deepEqual(b.opening, { drivers: k + 1, needed: 10 })
    assert.equal(b.openingClosed, false)
  })
  // o recorde acompanha a melhor volta ate agora (cada volta e mais rapida que a anterior)
  assert.equal(corpo(voltas[8]!.fim).record, true)
  assert.equal(store.recordes.get('an7-v1|c02')!.lapId, voltas[8]!.raceId)
  assert.equal(store.premios.length, 0)
  assert.equal(store.aberturas.size, 0)
})

test('abertura: a 10a carteira fecha, e a MELHOR volta do modelo (aqui, de outra carteira) leva o carro', async () => {
  const { d, store } = novo()
  // a carteira 4 e a mais rapida; a 10a e a mais lenta
  const kmhs = [...nove(), LENTO - 20]
  kmhs[3] = 340
  const voltas = await abrirC02(d, kmhs)
  const ultima = corpo(voltas[9]!.fim)
  // quem fechou nao leva o carro, mas fechou a abertura
  assert.deepEqual(ultima, valida(voltas[9]!, { rank: 10, record: false, prize: 'none', phase: 'open', drivers: 10, openingClosed: true }))
  assert.deepEqual(
    store.premios.map((p) => [p.wallet, p.model, p.phase, p.state, p.lapId]),
    [[carteira(4), 'c02', 'abertura', 'pending_review', voltas[3]!.raceId]],
  )
  // o recorde e a volta vencedora
  assert.equal(store.recordes.get('an7-v1|c02')!.lapId, voltas[3]!.raceId)
  assert.equal(store.aberturas.get('an7-v1|c02')!.closingLapId, voltas[9]!.raceId)
  assert.equal(store.aberturas.get('an7-v1|c02')!.winningLapId, voltas[3]!.raceId)
})

test('abertura: a 10a carteira fecha sendo a melhor: ela mesma leva o carro (prize e openingClosed no mesmo finish)', async () => {
  const { d, store } = novo()
  const voltas = await abrirC02(d, [...nove(), 345])
  assert.deepEqual(corpo(voltas[9]!.fim), valida(voltas[9]!, { rank: 1, record: true, prize: 'pending_review', phase: 'open', drivers: 10, openingClosed: true }))
  assert.deepEqual(store.premios.map((p) => [p.wallet, p.phase, p.lapId]), [[carteira(10), 'abertura', voltas[9]!.raceId]])
})

test('abertura: volta REPETIDA da mesma carteira nao e carteira nova (10 voltas, 9 carteiras); a melhor volta pode ser uma repetida', async () => {
  const { d, store } = novo()
  const voltas = await abrirC02(d, nove())
  // a carteira 2 volta e faz uma volta MELHOR que todas: 10 voltas validas, 9 carteiras
  const repetida = await correr(d, carteira(2), 'c02', quando(20), 346)
  assert.equal(corpo(repetida.fim).phase, 'opening')
  assert.deepEqual(corpo(repetida.fim).opening, { drivers: 9, needed: 10 })
  assert.equal(corpo(repetida.fim).prize, 'none')
  assert.equal(store.premios.length, 0)
  assert.equal(corpo(repetida.fim).record, true)
  // a 10a carteira diferente fecha: o carro vai para a volta repetida da carteira 2
  const decima = await correr(d, carteira(10), 'c02', quando(21), LENTO - 30)
  assert.deepEqual(corpo(decima.fim), valida(decima, { rank: 10, record: false, phase: 'open', drivers: 10, openingClosed: true }))
  assert.deepEqual(store.premios.map((p) => [p.wallet, p.lapId]), [[carteira(2), repetida.raceId]])
  assert.ok(voltas.length === 9)
})

test('abertura: EMPATE na melhor volta fica com a mais antiga', async () => {
  const { d, store } = novo()
  const a = await correr(d, carteira(1), 'c02', quando(0), 340)
  const b = await correr(d, carteira(2), 'c02', quando(1), 340, { desvio: 0.3 }) // o mesmo tempo ao milissegundo, depois
  assert.equal(a.volta.lapMs, b.volta.lapMs)
  assert.equal(corpo(b.fim).record, false)
  for (let k = 3; k <= 10; k++) await correr(d, carteira(k), 'c02', quando(k), LENTO + k)
  assert.deepEqual(store.premios.map((p) => [p.wallet, p.lapId]), [[carteira(1), a.raceId]])
  assert.equal(store.recordes.get('an7-v1|c02')!.lapId, a.raceId)
})

test('depois da abertura: recorde novo (estritamente mais rapido) leva o carro na hora; igual ou mais lento nao', async () => {
  const { d, store } = novo()
  const voltas = await abrirC02(d, [...nove(), 330]) // a 10a e a melhor e leva a abertura
  assert.equal(store.premios.length, 1)
  // mais lenta que o recorde: nada
  const lenta = await correr(d, carteira(11), 'c02', quando(30), 320)
  assert.deepEqual(corpo(lenta.fim), valida(lenta, { rank: 2, record: false, drivers: 11 }))
  // o MESMO tempo do recorde (desvio de 30 cm): empate, nao e recorde, nao premia
  const igual = await correr(d, carteira(12), 'c02', quando(31), 330, { desvio: 0.3 })
  assert.equal(igual.volta.lapMs, voltas[9]!.volta.lapMs)
  assert.deepEqual([corpo(igual.fim).record, corpo(igual.fim).prize], [false, 'none'])
  assert.equal(store.premios.length, 1)
  // mais rapida: leva
  const nova = await correr(d, carteira(13), 'c02', quando(32), 340)
  assert.deepEqual(corpo(nova.fim), valida(nova, { rank: 1, record: true, prize: 'pending_review', drivers: 13 }))
  assert.deepEqual(store.premios.map((p) => [p.wallet, p.phase, p.state]), [
    [carteira(10), 'abertura', 'pending_review'],
    [carteira(13), 'desafio', 'pending_review'],
  ])
  assert.equal(store.recordes.get('an7-v1|c02')!.lapId, nova.raceId)
})

test('quem ja tem o modelo bate o proprio recorde e segue dono dele, sem carro novo; o proximo que bate e nao tem, leva', async () => {
  const { d, store } = novo()
  await abrirC02(d, [...nove(), 330]) // a carteira 10 leva a abertura
  // a carteira 10 bate o proprio recorde: o recorde e dela, o carro nao se repete
  const propria = await correr(d, carteira(10), 'c02', quando(40), 340)
  assert.deepEqual([corpo(propria.fim).record, corpo(propria.fim).prize], [true, 'none'])
  assert.equal(store.recordes.get('an7-v1|c02')!.wallet, carteira(10))
  assert.equal(store.premios.length, 1)
  // outra carteira bate esse tempo e nao tem o modelo: leva
  const proxima = await correr(d, carteira(11), 'c02', quando(41), 345)
  assert.deepEqual([corpo(proxima.fim).record, corpo(proxima.fim).prize], [true, 'pending_review'])
  assert.deepEqual(store.premios.map((p) => [p.wallet, p.phase]), [[carteira(10), 'abertura'], [carteira(11), 'desafio']])
  // e a carteira 10 de novo, mais rapida ainda: segue sem carro novo (o dela ja existe)
  const outra = await correr(d, carteira(10), 'c02', quando(42), 348)
  assert.deepEqual([corpo(outra.fim).record, corpo(outra.fim).prize], [true, 'none'])
  assert.equal(store.premios.length, 2)
})

test('abertura fechando com a melhor volta de quem ja tem o modelo: nenhum carro agora, o proximo recorde leva', async () => {
  const { d, store } = novo()
  // a carteira 4 ja tem um carro do modelo (por exemplo, de antes): a abertura fecha, o recorde e dela, mas o carro nao sai
  store.premios.push({ id: 'antigo', trackId: 'an7-v1', wallet: carteira(4), model: 'c02', lapId: 'x', lapMs: 1, phase: 'campeonato', state: 'approved' })
  const kmhs = [...nove(), LENTO - 20]
  kmhs[3] = 340
  const voltas = await abrirC02(d, kmhs)
  assert.deepEqual(corpo(voltas[9]!.fim), valida(voltas[9]!, { rank: 10, record: false, phase: 'open', drivers: 10, openingClosed: true }))
  assert.equal(store.premios.length, 1) // so o antigo
  assert.equal(store.recordes.get('an7-v1|c02')!.wallet, carteira(4))
  const proxima = await correr(d, carteira(11), 'c02', quando(50), 345)
  assert.deepEqual([corpo(proxima.fim).record, corpo(proxima.fim).prize], [true, 'pending_review'])
})

test('Cyber e Moto2 nunca premiam e nunca tem abertura, com mais de 10 carteiras', async () => {
  const { d, store } = novo()
  for (let k = 0; k < 11; k++) {
    const a = await correr(d, carteira(k + 1), 'cyber', quando(k), 150 + k * 3)
    const b = await correr(d, carteira(k + 1), 'moto2', quando(k + 100), 250 + k * 5)
    for (const c of [a, b]) {
      const r = corpo(c.fim)
      assert.equal(r.prize, 'none')
      assert.equal(r.phase, 'open')
      assert.equal(r.openingClosed, false)
    }
  }
  assert.equal(store.premios.length, 0)
  assert.equal(store.aberturas.size, 0)
  // o leaderboard: sem abertura
  const rk = corpo(await ranking(d, 'an7-v1', 'cyber', 50))
  assert.deepEqual(rk.opening, { drivers: 11, needed: 10, open: false })
})

test('modelos independentes: ganhar o c02 nao impede o c05, cada um com a sua abertura e o seu recorde', async () => {
  const { d, store } = novo()
  // a mesma carteira 1 e a mais rapida nos dois modelos; cada modelo tem as suas 10 carteiras
  // (velocidades diferentes nos dois modelos: a mesma trajetoria nao vale duas voltas, em modelo nenhum)
  await abrirC02(d, [345, ...Array.from({ length: 9 }, (_, k) => LENTO + k)], 'c02')
  await abrirC02(d, [346, ...Array.from({ length: 9 }, (_, k) => LENTO + 20 + k)], 'c05')
  assert.deepEqual(
    store.premios.map((p) => [p.wallet, p.model, p.phase]).sort(),
    [[carteira(1), 'c02', 'abertura'], [carteira(1), 'c05', 'abertura']].sort(),
  )
  assert.equal(store.recordes.get('an7-v1|c02')!.wallet, carteira(1))
  assert.equal(store.recordes.get('an7-v1|c05')!.wallet, carteira(1))
  assert.equal(store.aberturas.size, 2)
  // e as carteiras do c02 nao contam no c05: o c52 comeca do zero
  const c52 = await correr(d, carteira(1), 'c52', quando(200), 130)
  assert.deepEqual(corpo(c52.fim).opening, { drivers: 1, needed: 10 })
  assert.equal(corpo(c52.fim).phase, 'opening')
})

test('premio: a volta anulada nunca premia nem conta carteira para a abertura', async () => {
  const { d, store } = novo()
  const c = await correr(d, carteira(1), 'c02', quando(0), 330, { flags: { ...LIMPA, autopilot: true } })
  assert.deepEqual(corpo(c.fim), { valid: false, lapMs: null, rank: null, record: false, prize: 'none' })
  assert.equal(store.premios.length, 0)
  assert.equal(store.recordes.size, 0)
  assert.deepEqual(await store.abertura('an7-v1', 'c02'), { drivers: 0, fechada: false })
  // 9 validas + 1 anulada = ainda 9 carteiras: a abertura nao fecha
  await abrirC02(d, nove().map((v) => v + 1))
  const anulada = await correr(d, carteira(10), 'c02', quando(60), 330, { flags: { ...LIMPA, teleport: true } })
  assert.equal(corpo(anulada.fim).valid, false)
  assert.equal(store.aberturas.size, 0)
  assert.equal(store.premios.length, 0)
})

test('finish repetido: devolve o MESMO (inclusive prize e openingClosed) e nao cria premio nem abertura de novo', async () => {
  const { d, store } = novo()
  const voltas = await abrirC02(d, [...nove(), 345])
  const ultima = voltas[9]!
  assert.equal(corpo(ultima.fim).openingClosed, true)
  const antes = { gravacoes: store.gravacoes, premios: store.premios.length }
  const de_novo = await terminar(d, carteira(10), { raceId: ultima.raceId, trace: ultima.volta.trace, flags: LIMPA, clientLapMs: null }, quando(99))
  assert.deepEqual(corpo(de_novo), corpo(ultima.fim))
  assert.deepEqual({ gravacoes: store.gravacoes, premios: store.premios.length }, antes)
  // uma volta que nao fechou a abertura segue com openingClosed false ao repetir
  const primeira = voltas[0]!
  const rep = await terminar(d, carteira(1), { raceId: primeira.raceId, trace: primeira.volta.trace, flags: LIMPA, clientLapMs: null }, quando(99))
  assert.equal(corpo(rep).openingClosed, false)
  assert.equal(store.premios.length, 1)
})

test('premio rejeitado na revisao libera a vaga, e um finish repetido da volta recusada NAO recria o premio', async () => {
  const { d, store } = novo()
  const voltas = await abrirC02(d, [...nove(), 345])
  const p = store.premios[0]!
  p.state = 'rejected'
  const rep = await terminar(d, carteira(10), { raceId: voltas[9]!.raceId, trace: voltas[9]!.volta.trace, flags: LIMPA, clientLapMs: null }, quando(99))
  assert.equal(corpo(rep).prize, 'none') // a volta rejeitada nao mostra premio
  assert.equal(store.premios.length, 1) // e nao se recria
  // a vaga ficou livre: a mesma carteira bate o recorde e leva o carro (desafio)
  const volta2 = await correr(d, carteira(10), 'c02', quando(70), 348)
  assert.deepEqual([corpo(volta2.fim).record, corpo(volta2.fim).prize], [true, 'pending_review'])
  assert.deepEqual(store.premios.map((x) => [x.phase, x.state]), [['abertura', 'rejected'], ['desafio', 'pending_review']])
})

test('leaderboard: opening por modelo (carteiras, 10 necessarias, open = ainda em abertura)', async () => {
  const { d } = novo()
  assert.deepEqual(corpo(await ranking(d, 'an7-v1', 'c02', 50)).opening, { drivers: 0, needed: 10, open: true })
  await abrirC02(d, nove())
  assert.deepEqual(corpo(await ranking(d, 'an7-v1', 'c02', 50)).opening, { drivers: 9, needed: 10, open: true })
  // volta repetida da carteira 1: continuam 9
  await correr(d, carteira(1), 'c02', quando(80), 345)
  assert.deepEqual(corpo(await ranking(d, 'an7-v1', 'c02', 50)).opening, { drivers: 9, needed: 10, open: true })
  await correr(d, carteira(10), 'c02', quando(81), LENTO - 7)
  assert.deepEqual(corpo(await ranking(d, 'an7-v1', 'c02', 50)).opening, { drivers: 10, needed: 10, open: false })
  // outro modelo, outra abertura
  assert.deepEqual(corpo(await ranking(d, 'an7-v1', 'c05', 50)).opening, { drivers: 0, needed: 10, open: true })
  // os campos antigos seguem
  const rk = corpo(await ranking(d, 'an7-v1', 'c02', 50))
  assert.equal(rk.track, 'an7-v1')
  assert.equal(rk.model, 'c02')
  assert.ok(Array.isArray(rk.entries))
})

test('os 18 modelos com premio e os 2 sem estao na tabela: todo modelo da tabela larga', async () => {
  const { d } = novo()
  let k = 0
  for (const id of Object.keys(MODELOS_CORRIDA)) {
    const r = await iniciar(d, `bc1p${String(++k).padStart(58, 'z')}`, { model: id, track: 'an7-v1' }, HOJE)
    assert.equal(r.status, 200, id)
  }
  assert.equal(k, 20)
})
