// Rodar: npx tsx --test lib/game/race/service.test.ts
//
// O servico da corrida de ponta a ponta (start, gate, finish, leaderboard, me, fechamento), com o banco na memoria (store-memory.ts,
// as mesmas regras da migration 038) e um piloto de mentira que da' a volta inteira nos 61 portoes (test-support.ts). O relogio e'
// o do servidor: cada portao entra no instante do carimbo simulado.
import test from 'node:test'
import assert from 'node:assert/strict'
import { fechar, iniciar, meu, portao, ranking, terminar, type Deps, type Resposta } from './service'
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
  assert.deepEqual(corpo(c.fim), { valid: true, lapMs: c.volta.lapMs, rank: 1, record: true, prize: 'none' })
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
  assert.deepEqual(corpo(a.fim), { valid: true, lapMs: a.volta.lapMs, rank: 1, record: true, prize: 'none' })
  assert.deepEqual(corpo(b.fim), { valid: true, lapMs: b.volta.lapMs, rank: 2, record: false, prize: 'none' })
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

// ---- o premio ----

const JANELA = { startsAtMs: HOJE + 1_000_000, endsAtMs: HOJE + 100_000_000 }
const DEPOIS = JANELA.endsAtMs + 5_000_000

function comCampeonato(store: StoreMemoria): void {
  store.campeonatos.set('an7-v1', { trackId: 'an7-v1', startsAtMs: JANELA.startsAtMs, endsAtMs: JANELA.endsAtMs, closedAtMs: null })
}

test('premio: SEM campeonato configurado nada e premiado (so ranking)', async () => {
  const { d, store } = novo()
  const c = await correr(d, W1, 'c02', DEPOIS, 330)
  assert.deepEqual(corpo(c.fim), { valid: true, lapMs: c.volta.lapMs, rank: 1, record: true, prize: 'none' })
  assert.equal(store.premios.length, 0)
})

test('premio: DENTRO da janela nada e premiado na hora, nem o recorde', async () => {
  const { d, store } = novo()
  comCampeonato(store)
  const c = await correr(d, W1, 'c02', JANELA.startsAtMs + 10_000_000, 330)
  assert.deepEqual(corpo(c.fim), { valid: true, lapMs: c.volta.lapMs, rank: 1, record: true, prize: 'none' })
  assert.equal(store.premios.length, 0)
  // antes da janela tambem nao
  const { d: d2, store: s2 } = novo()
  comCampeonato(s2)
  const c2 = await correr(d2, W1, 'c02', HOJE + 100_000, 330)
  assert.equal(corpo(c2.fim).prize, 'none')
  assert.equal(s2.premios.length, 0)
})

test('premio: depois da janela, recorde novo de um carro da DOG MOTORS gera pending_review na hora; um por carteira por modelo', async () => {
  const { d, store } = novo()
  comCampeonato(store)
  const a = await correr(d, W1, 'c02', DEPOIS, 300) // primeiro tempo do modelo: e' recorde
  assert.deepEqual(corpo(a.fim), { valid: true, lapMs: a.volta.lapMs, rank: 1, record: true, prize: 'pending_review' })
  assert.deepEqual(store.premios.map((p) => [p.wallet, p.model, p.phase, p.state, p.lapId]), [[W1, 'c02', 'desafio', 'pending_review', a.raceId]])

  // outra carteira mais lenta: nao bate o recorde, nao ganha
  const b = await correr(d, W2, 'c02', DEPOIS + 3_600_000, 280)
  assert.deepEqual([corpo(b.fim).record, corpo(b.fim).prize, corpo(b.fim).rank], [false, 'none', 2])

  // a MESMA carteira bate o proprio recorde: o recorde atualiza, nao ha segundo carro
  const c = await correr(d, W1, 'c02', DEPOIS + 7_200_000, 330)
  assert.deepEqual([corpo(c.fim).record, corpo(c.fim).prize, corpo(c.fim).rank], [true, 'none', 1])
  assert.equal(store.recordes.get('an7-v1|c02')!.lapId, c.raceId)
  assert.equal(store.premios.length, 1)

  // outra carteira bate o recorde: ganha o dela
  const e = await correr(d, W3, 'c02', DEPOIS + 10_800_000, 340)
  assert.deepEqual([corpo(e.fim).record, corpo(e.fim).prize, corpo(e.fim).rank], [true, 'pending_review', 1])
  assert.deepEqual(store.premios.map((p) => p.wallet), [W1, W3])
})

test('premio: um por modelo: o recorde de OUTRO modelo da mesma carteira vale outro carro', async () => {
  const { d, store } = novo()
  comCampeonato(store)
  await correr(d, W1, 'c02', DEPOIS, 330)
  const c = await correr(d, W1, 'c52', DEPOIS + 3_600_000, 130)
  assert.equal(corpo(c.fim).prize, 'pending_review')
  assert.deepEqual(store.premios.map((p) => p.model), ['c02', 'c52'])
})

test('premio: Cyber e Moto2 rankeiam sem premio, tambem depois da janela', async () => {
  const { d, store } = novo()
  comCampeonato(store)
  const a = await correr(d, W1, 'cyber', DEPOIS, 190)
  const b = await correr(d, W2, 'moto2', DEPOIS + 3_600_000, 330)
  assert.deepEqual([corpo(a.fim).record, corpo(a.fim).prize], [true, 'none'])
  assert.deepEqual([corpo(b.fim).record, corpo(b.fim).prize], [true, 'none'])
  assert.equal(store.premios.length, 0)
})

test('premio: a volta anulada nunca premia', async () => {
  const { d, store } = novo()
  comCampeonato(store)
  const c = await correr(d, W1, 'c02', DEPOIS, 330, { flags: { ...LIMPA, autopilot: true } })
  assert.equal(corpo(c.fim).valid, false)
  assert.equal(store.premios.length, 0)
  assert.equal(store.recordes.size, 0)
})

test('premio: finish repetido de uma volta premiada devolve pending_review de novo, sem segundo premio', async () => {
  const { d, store } = novo()
  comCampeonato(store)
  const a = await correr(d, W1, 'c02', DEPOIS, 330)
  const de_novo = await terminar(d, W1, { raceId: a.raceId, trace: a.volta.trace, flags: LIMPA, clientLapMs: null }, DEPOIS + 999_999)
  assert.deepEqual(corpo(de_novo), corpo(a.fim))
  assert.equal(store.premios.length, 1)
})

// ---- o fechamento do campeonato ----

test('fechamento: antes do fim da janela nao fecha (409); sem campeonato = 404; pista invalida = 400', async () => {
  const { d, store } = novo()
  assert.equal((await fechar(d, 'an7-v1', HOJE)).status, 404)
  comCampeonato(store)
  const r = await fechar(d, 'an7-v1', JANELA.endsAtMs - 1)
  assert.equal(r.status, 409)
  assert.equal(corpo(r).error, 'window_open')
  assert.equal(store.campeonatos.get('an7-v1')!.closedAtMs, null)
  assert.equal((await fechar(d, 'nao-existe', JANELA.endsAtMs)).status, 400)
})

test('fechamento: o vencedor de CADA modelo da DOG MOTORS sai agora (so as voltas da janela); empate fica com a mais antiga', async () => {
  const { d, store } = novo()
  comCampeonato(store)
  const dentro = JANELA.startsAtMs + 10_000_000
  // c02: W1 ganha de W2; uma volta MAIS RAPIDA de W3, mas antes da janela, nao conta
  await correr(d, W3, 'c02', JANELA.startsAtMs - 500_000, 345)
  const w1 = await correr(d, W1, 'c02', dentro, 330)
  await correr(d, W2, 'c02', dentro + 3_600_000, 300)
  // c05: empate (a mesma velocidade): W2 correu primeiro
  const e1 = await correr(d, W2, 'c05', dentro + 7_200_000, 320)
  await correr(d, W1, 'c05', dentro + 10_800_000, 320, { desvio: 0.3 })
  // cyber e moto2: sem premio, mesmo sendo as melhores
  await correr(d, W1, 'cyber', dentro + 14_400_000, 200)
  // c52 so tem uma volta, fora da janela (depois do fim)
  await correr(d, W3, 'c52', DEPOIS, 130)
  assert.equal(store.premios.length, 1) // o c52 de depois da janela: o premio do desafio saiu na hora

  const r = await fechar(d, 'an7-v1', JANELA.endsAtMs)
  assert.equal(r.status, 200)
  const b = corpo(r)
  assert.equal(b.closedNow, true)
  // o c52 de W3 foi depois do fim da janela: premio do desafio (criado na hora), fora do fechamento
  const w = (b.winners as Array<{ model: string; wallet: string; lapId: string; prize: string }>).map((x) => [x.model, x.wallet, x.prize])
  assert.deepEqual(w.sort(), [['c02', W1, 'created'], ['c05', W2, 'created']].sort())
  const doFechamento = store.premios.filter((p) => p.phase === 'campeonato')
  assert.deepEqual(doFechamento.map((p) => [p.model, p.wallet, p.lapId]).sort(), [['c02', W1, w1.raceId], ['c05', W2, e1.raceId]].sort())
  assert.ok(doFechamento.every((p) => p.state === 'pending_review'))
  assert.equal(store.premios.some((p) => p.model === 'cyber' || p.model === 'moto2'), false)
  assert.equal(store.campeonatos.get('an7-v1')!.closedAtMs, JANELA.endsAtMs)
})

test('fechamento: idempotente (rodar de novo nao cria premio em dobro) e quem ja tem o carro do modelo nao ganha outro', async () => {
  const { d, store } = novo()
  comCampeonato(store)
  const dentro = JANELA.startsAtMs + 10_000_000
  await correr(d, W1, 'c02', dentro, 330)
  await correr(d, W2, 'c10', dentro + 3_600_000, 240)
  const r1 = corpo(await fechar(d, 'an7-v1', JANELA.endsAtMs + 1_000))
  assert.equal(r1.closedNow, true)
  assert.equal(store.premios.length, 2)
  const r2 = corpo(await fechar(d, 'an7-v1', JANELA.endsAtMs + 9_000))
  assert.equal(r2.closedNow, false)
  assert.equal(r2.closedAt, new Date(JANELA.endsAtMs + 1_000).toISOString())
  assert.deepEqual((r2.winners as Array<{ prize: string }>).map((x) => x.prize), ['exists', 'exists'])
  assert.equal(store.premios.length, 2)

  // uma carteira que ja tem o carro do modelo (premio do desafio) nao ganha outro no fechamento, e o segundo colocado nao herda
  const { d: d3, store: s3 } = novo()
  comCampeonato(s3)
  await correr(d3, W1, 'c25', dentro, 220) // campeonato
  await correr(d3, W2, 'c25', dentro + 3_600_000, 200)
  await s3.criarPremio({ trackId: 'an7-v1', wallet: W1, model: 'c25', lapId: 'x', lapMs: 1, phase: 'desafio' })
  const r3 = corpo(await fechar(d3, 'an7-v1', JANELA.endsAtMs))
  assert.deepEqual((r3.winners as Array<{ wallet: string; prize: string }>).map((x) => [x.wallet, x.prize]), [[W1, 'wallet_has_one']])
  assert.equal(s3.premios.length, 1)
})

test('fechamento: modelo sem nenhuma volta na janela nao tem vencedor', async () => {
  const { d, store } = novo()
  comCampeonato(store)
  const r = corpo(await fechar(d, 'an7-v1', JANELA.endsAtMs))
  assert.deepEqual(r.winners, [])
  assert.equal(r.closedNow, true)
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
