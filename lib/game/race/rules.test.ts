// Rodar: npx tsx --test lib/game/race/rules.test.ts
//
// A logica pura da corrida no servidor: piso de tempo por trecho, ordem dos portoes (fora de ordem, repetido, repeticao do ultimo),
// carimbos da volta inteira, bandeiras, abertura do modelo (10 carteiras), regra do premio v2, empate (volta mais antiga).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  NECESSARIOS_ABERTURA,
  REGRAS,
  carteirasDistintas,
  compararVoltas,
  decidirPortao,
  decidirPremio,
  faseDoModelo,
  lerFlags,
  melhorVolta,
  motivoDasFlags,
  pisoDoTrechoMs,
  posicaoPlausivel,
  recordeNovo,
  validarCarimbos,
  type Carimbo,
  type VoltaDeCarteira,
} from './rules'
import { IDS_MODELOS, IDS_MODELOS_COM_PREMIO, MODELOS_CORRIDA, ehModeloCorrida, modeloTemPremio, vmaxMs } from './models'
import { gerarPortoes } from './track'

const G = gerarPortoes()
const CYBER = vmaxMs('cyber')

// ---- os modelos ----

test('os modelos: Cyber 210, Moto2 350 e os 18 carros da DOG MOTORS; so os 18 dao premio', () => {
  assert.equal(IDS_MODELOS.length, 20)
  assert.equal(IDS_MODELOS_COM_PREMIO.length, 18)
  assert.equal(MODELOS_CORRIDA.cyber!.vmaxKmh, 210)
  assert.equal(MODELOS_CORRIDA.moto2!.vmaxKmh, 350)
  assert.equal(modeloTemPremio('cyber'), false)
  assert.equal(modeloTemPremio('moto2'), false)
  assert.equal(modeloTemPremio('c02'), true)
  assert.equal(modeloTemPremio('nada'), false)
  assert.ok(!IDS_MODELOS_COM_PREMIO.includes('cyber') && !IDS_MODELOS_COM_PREMIO.includes('moto2'))
  // as velocidades do jogo (tipos_carro.ts, vMaxDoTipo) dos 18
  const esperado: Record<string, number> = {
    c02: 350, c05: 350, c15: 300, c39: 280, c40: 270, c41: 285, c10: 250, c25: 230, c26: 225,
    c28: 228, c62: 205, c30: 205, c32: 225, c61: 210, c42: 160, c43: 175, c52: 140, c56: 150,
  }
  for (const [id, kmh] of Object.entries(esperado)) assert.equal(MODELOS_CORRIDA[id]!.vmaxKmh, kmh, id)
  assert.equal(Object.keys(esperado).length, 18)
})

test('todo modelo da tabela cabe no check da migration 038 (^[a-z][a-z0-9]{1,15}$)', () => {
  const sql = readFileSync('supabase/migrations/038_dogcity_race.sql', 'utf8')
  assert.ok(sql.includes("model ~ '^[a-z][a-z0-9]{1,15}$'"))
  for (const id of IDS_MODELOS) assert.match(id, /^[a-z][a-z0-9]{1,15}$/)
})

test('modelo valido: so os da tabela (nada de __proto__ nem constructor)', () => {
  assert.equal(ehModeloCorrida('cyber'), true)
  assert.equal(ehModeloCorrida('c62'), true)
  for (const x of ['__proto__', 'constructor', 'toString', 'C02', '', 7, null, undefined, {}]) assert.equal(ehModeloCorrida(x), false)
  assert.throws(() => vmaxMs('nada'))
  assert.ok(Math.abs(vmaxMs('moto2') - 350 / 3.6) < 1e-12)
})

// ---- o piso de tempo ----

test('piso do trecho: distancia / (1,05 x Vmax)', () => {
  // 1.213 m a 210 km/h (58,33 m/s) x 1,05
  const piso = pisoDoTrechoMs(1213, CYBER)
  assert.ok(Math.abs(piso - (1213 / (1.05 * CYBER)) * 1000) < 1e-6)
  assert.ok(piso > 19_800 && piso < 19_900)
  assert.equal(pisoDoTrechoMs(-5, CYBER), 0)
})

/** carimbos de uma volta feita exatamente no piso (o robo mais rapido possivel), t0 qualquer */
function noPiso(vmax: number, t0 = 1_000_000, folgaMs = 0): Carimbo[] {
  const out: Carimbo[] = []
  let t = t0
  for (let k = 0; k < G.length; k++) {
    if (k > 0) t += Math.ceil(pisoDoTrechoMs(G[k]!.s_m - G[k - 1]!.s_m, vmax)) + folgaMs
    out.push({ i: k, t })
  }
  return out
}

test('carimbos: a volta no piso passa; 1 ms mais rapido em UM trecho reprova', () => {
  const ok = validarCarimbos(G, noPiso(CYBER), CYBER)
  assert.equal(ok.ok, true)
  if (ok.ok) {
    assert.equal(ok.splits.length, 61)
    assert.equal(ok.splits[0], 0)
    assert.equal(ok.lapMs, ok.splits[60])
    // 43.668 m a 1,05 x 210 km/h = 11:53
    assert.ok(ok.lapMs > 712_000 && ok.lapMs < 714_000, String(ok.lapMs))
  }
  const rapido = noPiso(CYBER)
  for (let k = 30; k < rapido.length; k++) rapido[k]!.t -= 1 // o trecho 30 fica 1 ms abaixo do piso
  const r = validarCarimbos(G, rapido, CYBER)
  assert.deepEqual(r, { ok: false, motivo: 'velocidade' })
})

test('carimbos: faltando portao, fora de ordem, indice repetido e tempo nao numerico', () => {
  const todos = noPiso(CYBER, 1_000_000, 50)
  assert.deepEqual(validarCarimbos(G, todos.slice(0, 60), CYBER), { ok: false, motivo: 'faltando' })
  assert.deepEqual(validarCarimbos(G, [], CYBER), { ok: false, motivo: 'faltando' })
  const trocado = todos.map((c) => ({ ...c }))
  trocado[10] = { i: 11, t: trocado[10]!.t }
  assert.deepEqual(validarCarimbos(G, trocado, CYBER), { ok: false, motivo: 'ordem' })
  const nan = todos.map((c) => ({ ...c }))
  nan[5]!.t = Number.NaN
  assert.deepEqual(validarCarimbos(G, nan, CYBER), { ok: false, motivo: 'ordem' })
  const repetido = todos.map((c) => ({ ...c }))
  repetido[20] = { ...repetido[19]! }
  assert.deepEqual(validarCarimbos(G, repetido, CYBER), { ok: false, motivo: 'ordem' })
})

test('carimbos: o tempo oficial e' + "'" + ' o ultimo carimbo menos o da largada (nao o do inicio do pedido)', () => {
  const c = noPiso(CYBER, 5_000_000, 100)
  const r = validarCarimbos(G, c, CYBER)
  assert.equal(r.ok, true)
  if (r.ok) assert.equal(r.lapMs, c[60]!.t - c[0]!.t)
})

test('um carro mais lento tem o piso mais alto: o tempo da Moto2 nao vale para um c52', () => {
  const moto = noPiso(vmaxMs('moto2'))
  assert.equal(validarCarimbos(G, moto, vmaxMs('moto2')).ok, true)
  assert.deepEqual(validarCarimbos(G, moto, vmaxMs('c52')), { ok: false, motivo: 'velocidade' })
})

// ---- a chegada de um portao ----

const PISO1 = pisoDoTrechoMs(G[1]!.s_m - G[0]!.s_m, CYBER)

test('portao: o primeiro e' + "'" + ' o 0; pular reprova (ordem)', () => {
  const base = { portoes: G, vmax: CYBER, tMs: 10_000 }
  assert.deepEqual(decidirPortao({ ...base, i: 0, ultimo: null }), { tipo: 'gravar' })
  assert.deepEqual(decidirPortao({ ...base, i: 1, ultimo: null }), { tipo: 'recusar', motivo: 'ordem' })
  assert.deepEqual(decidirPortao({ ...base, i: 5, ultimo: null }), { tipo: 'recusar', motivo: 'ordem' })
  assert.deepEqual(decidirPortao({ ...base, i: 61, ultimo: null }), { tipo: 'recusar', motivo: 'ordem' })
})

test('portao: o proximo no tempo passa; abaixo do piso reprova (velocidade)', () => {
  const ultimo = { i: 0, t: 1_000_000 }
  const ok = decidirPortao({ i: 1, ultimo, portoes: G, vmax: CYBER, tMs: ultimo.t + PISO1 + 1 })
  assert.deepEqual(ok, { tipo: 'gravar' })
  const cedo = decidirPortao({ i: 1, ultimo, portoes: G, vmax: CYBER, tMs: ultimo.t + PISO1 - 1 })
  assert.deepEqual(cedo, { tipo: 'recusar', motivo: 'velocidade' })
  const antes = decidirPortao({ i: 1, ultimo, portoes: G, vmax: CYBER, tMs: ultimo.t - 500 })
  assert.deepEqual(antes, { tipo: 'recusar', motivo: 'velocidade' })
})

test('portao: repetir o ultimo devolve o mesmo carimbo (a resposta se perdeu); repetir um antigo reprova', () => {
  const ultimo = { i: 7, t: 1_234_567 }
  assert.deepEqual(decidirPortao({ i: 7, ultimo, portoes: G, vmax: CYBER, tMs: 9_999_999 }), { tipo: 'repeticao', t: 1_234_567 })
  assert.deepEqual(decidirPortao({ i: 6, ultimo, portoes: G, vmax: CYBER, tMs: 9_999_999 }), { tipo: 'recusar', motivo: 'repetido' })
  assert.deepEqual(decidirPortao({ i: 0, ultimo, portoes: G, vmax: CYBER, tMs: 9_999_999 }), { tipo: 'recusar', motivo: 'repetido' })
  assert.deepEqual(decidirPortao({ i: 9, ultimo, portoes: G, vmax: CYBER, tMs: 9_999_999 }), { tipo: 'recusar', motivo: 'ordem' })
})

test('portao: depois do ultimo (chegada) nao ha proximo', () => {
  const ultimo = { i: 60, t: 1_000_000 }
  assert.deepEqual(decidirPortao({ i: 61, ultimo, portoes: G, vmax: CYBER, tMs: 9_000_000 }), { tipo: 'recusar', motivo: 'ordem' })
})

test('posicao do portao: perto do anel e cota e velocidade razoaveis', () => {
  const rad = (93.483 * Math.PI) / 180 // a linha de largada, 13 m para dentro do eixo
  assert.equal(posicaoPlausivel([Math.sin(rad) * 6937, 0, -Math.cos(rad) * 6937], 50, CYBER), true)
  assert.equal(posicaoPlausivel([6763.9, 0, 411.7], 50, CYBER), false) // o lote da DOG MOTORS, 174 m dentro do anel
  assert.equal(posicaoPlausivel([0, 0, -6950], 58, CYBER), true)
  assert.equal(posicaoPlausivel([0, 0, -7100], 58, CYBER), false) // 150 m fora
  assert.equal(posicaoPlausivel([0, 0, 0], 58, CYBER), false) // o centro da cidade
  assert.equal(posicaoPlausivel([0, 999, -6950], 58, CYBER), false)
  assert.equal(posicaoPlausivel([0, 0, -6950], 400, CYBER), false) // 400 m/s
  assert.equal(posicaoPlausivel([0, 0, -6950], Number.NaN, CYBER), false)
  assert.equal(posicaoPlausivel([Number.POSITIVE_INFINITY, 0, 0], 10, CYBER), false)
  assert.equal(posicaoPlausivel([1, 2], 10, CYBER), false)
})

// ---- as bandeiras ----

test('bandeiras: o corpo do cliente e' + "'" + ' lido campo a campo', () => {
  assert.deepEqual(lerFlags({ autopilot: false, teleport: false, diag: false, void: null }), { autopilot: false, teleport: false, diag: false, void: null, bot: false })
  assert.deepEqual(lerFlags({ autopilot: true, teleport: false, diag: false, void: 'piloto', bot: true }), { autopilot: true, teleport: false, diag: false, void: 'piloto', bot: true })
  // ausente = falso (cliente antigo sem `bot`)
  assert.deepEqual(lerFlags({}), { autopilot: false, teleport: false, diag: false, void: null, bot: false })
  for (const ruim of [null, undefined, 7, 'x', [], { autopilot: 'sim' }, { void: 12 }, { void: 'A-b' }, { void: 'x'.repeat(40) }, { bot: 1 }]) assert.equal(lerFlags(ruim), null)
})

test('bandeiras: qualquer uma anula ou exclui; bot e' + "'" + ' o primeiro motivo; volta limpa nao tem motivo', () => {
  const limpa = { autopilot: false, teleport: false, diag: false, void: null, bot: false }
  assert.equal(motivoDasFlags(limpa), null)
  assert.equal(motivoDasFlags({ ...limpa, autopilot: true }), 'flag_autopilot')
  assert.equal(motivoDasFlags({ ...limpa, teleport: true }), 'flag_teleport')
  assert.equal(motivoDasFlags({ ...limpa, diag: true }), 'flag_diag')
  assert.equal(motivoDasFlags({ ...limpa, void: 'fora' }), 'client_fora')
  assert.equal(motivoDasFlags({ ...limpa, bot: true }), 'bot')
  assert.equal(motivoDasFlags({ ...limpa, bot: true, autopilot: true, void: 'piloto' }), 'bot')
})

// ---- a abertura do modelo e o premio (regra v2) ----

const NINGUEM = (): boolean => false
const volta = (id: string, wallet: string, lapMs: number, finishedAtMs: number): VoltaDeCarteira => ({ id, wallet, lapMs, finishedAtMs })

test('abertura: 10 carteiras diferentes; a fase do modelo vem do que esta gravado; Cyber e Moto2 nunca tem abertura', () => {
  assert.equal(NECESSARIOS_ABERTURA, 10)
  assert.equal(faseDoModelo({ modeloComPremio: true, aberturaFechada: false }), 'abertura')
  assert.equal(faseDoModelo({ modeloComPremio: true, aberturaFechada: true }), 'aberto')
  assert.equal(faseDoModelo({ modeloComPremio: modeloTemPremio('cyber'), aberturaFechada: false }), 'aberto')
  assert.equal(faseDoModelo({ modeloComPremio: modeloTemPremio('moto2'), aberturaFechada: false }), 'aberto')
})

test('abertura: carteiras DIFERENTES contam uma vez, por mais voltas que tenham', () => {
  const nove = Array.from({ length: 9 }, (_, i) => volta(`v${i}`, `W${i}`, 700_000 + i, 1_000 + i))
  assert.equal(carteirasDistintas(nove), 9)
  // a mesma carteira volta 3 vezes: 12 voltas, 9 carteiras
  const repetidas = [...nove, volta('r1', 'W0', 690_000, 2_000), volta('r2', 'W0', 680_000, 2_100), volta('r3', 'W3', 695_000, 2_200)]
  assert.equal(repetidas.length, 12)
  assert.equal(carteirasDistintas(repetidas), 9)
  assert.equal(carteirasDistintas([]), 0)
})

test('abertura: a melhor volta e a de menor tempo; EMPATE fica com a mais antiga; sem volta, ninguem', () => {
  const voltas = [volta('a', 'A', 700_000, 300), volta('b', 'B', 690_000, 500), volta('c', 'C', 690_000, 400), volta('d', 'D', 710_000, 100)]
  assert.equal(melhorVolta(voltas)!.id, 'c')
  assert.equal(melhorVolta([volta('x', 'X', 5, 9), volta('y', 'Y', 5, 9)])!.id, 'x') // o id desempata, so' para ser total
  assert.equal(melhorVolta([]), null)
})

test('premio: 9 carteiras = abertura em andamento, NADA premiado na hora, nem o recorde', () => {
  const v = volta('v9', 'W9', 650_000, 9_000)
  const r = decidirPremio({ modeloComPremio: true, aberturaFechada: false, carteiras: 9, volta: v, recorde: true, melhorDoModelo: v, jaTemPremio: NINGUEM })
  assert.deepEqual(r, { fase: 'abertura', fechouAbertura: false, premio: null })
})

test('premio: a 10a carteira fecha a abertura e a MELHOR volta do modelo leva o carro (aqui, a dela mesma)', () => {
  const v = volta('v10', 'W10', 640_000, 10_000)
  const r = decidirPremio({ modeloComPremio: true, aberturaFechada: false, carteiras: 10, volta: v, recorde: true, melhorDoModelo: v, jaTemPremio: NINGUEM })
  assert.deepEqual(r, { fase: 'aberto', fechouAbertura: true, premio: { fase: 'abertura', wallet: 'W10', lapId: 'v10', lapMs: 640_000 } })
})

test('premio: a 10a carteira fecha e a melhor volta e de OUTRA carteira: ela leva o carro, a que fechou nao', () => {
  const doquinto = volta('v5', 'W5', 600_000, 5_000)
  const v10 = volta('v10', 'W10', 700_000, 10_000)
  const r = decidirPremio({ modeloComPremio: true, aberturaFechada: false, carteiras: 10, volta: v10, recorde: false, melhorDoModelo: doquinto, jaTemPremio: NINGUEM })
  assert.equal(r.fechouAbertura, true)
  assert.deepEqual(r.premio, { fase: 'abertura', wallet: 'W5', lapId: 'v5', lapMs: 600_000 })
})

test('premio: na abertura a melhor volta pode ser uma volta REPETIDA de uma das carteiras (a segunda volta dela)', () => {
  const voltas = [
    ...Array.from({ length: 10 }, (_, i) => volta(`p${i}`, `W${i}`, 700_000 + i * 1_000, 1_000 + i)),
    volta('seg', 'W2', 610_000, 2_000), // a 2a volta da W2, que e' a melhor de todas
  ]
  const melhor = melhorVolta(voltas)!
  assert.equal(melhor.id, 'seg')
  const r = decidirPremio({ modeloComPremio: true, aberturaFechada: false, carteiras: carteirasDistintas(voltas), volta: voltas[9]!, recorde: false, melhorDoModelo: melhor, jaTemPremio: NINGUEM })
  assert.deepEqual(r.premio, { fase: 'abertura', wallet: 'W2', lapId: 'seg', lapMs: 610_000 })
})

test('premio: na abertura, empate entre carteiras fica com a volta mais antiga', () => {
  const a = volta('a', 'A', 650_000, 100)
  const b = volta('b', 'B', 650_000, 200)
  const melhor = melhorVolta([b, a])!
  const r = decidirPremio({ modeloComPremio: true, aberturaFechada: false, carteiras: 10, volta: b, recorde: false, melhorDoModelo: melhor, jaTemPremio: NINGUEM })
  assert.equal(r.premio!.wallet, 'A')
})

test('premio: abertura fechando e a melhor volta e de quem ja tem o modelo: nenhum carro (o proximo recorde leva)', () => {
  const v5 = volta('v5', 'W5', 600_000, 5_000)
  const v10 = volta('v10', 'W10', 700_000, 10_000)
  const r = decidirPremio({ modeloComPremio: true, aberturaFechada: false, carteiras: 10, volta: v10, recorde: false, melhorDoModelo: v5, jaTemPremio: (w) => w === 'W5' })
  assert.deepEqual(r, { fase: 'aberto', fechouAbertura: true, premio: null })
})

test('premio: depois da abertura, recorde NOVO leva o carro (desafio); quem nao e recorde nao', () => {
  const v = volta('n1', 'N1', 590_000, 20_000)
  assert.deepEqual(decidirPremio({ modeloComPremio: true, aberturaFechada: true, carteiras: 14, volta: v, recorde: true, melhorDoModelo: v, jaTemPremio: NINGUEM }), {
    fase: 'aberto',
    fechouAbertura: false,
    premio: { fase: 'desafio', wallet: 'N1', lapId: 'n1', lapMs: 590_000 },
  })
  assert.equal(decidirPremio({ modeloComPremio: true, aberturaFechada: true, carteiras: 14, volta: v, recorde: false, melhorDoModelo: v, jaTemPremio: NINGUEM }).premio, null)
})

test('premio: quem ja tem o modelo bate o proprio recorde sem carro novo; o proximo que bate e nao tem, leva', () => {
  const dono = volta('d1', 'DONO', 580_000, 30_000)
  const jaTem = (w: string): boolean => w === 'DONO'
  assert.equal(decidirPremio({ modeloComPremio: true, aberturaFechada: true, carteiras: 11, volta: dono, recorde: true, melhorDoModelo: dono, jaTemPremio: jaTem }).premio, null)
  const proximo = volta('p1', 'OUTRO', 570_000, 40_000)
  assert.deepEqual(decidirPremio({ modeloComPremio: true, aberturaFechada: true, carteiras: 12, volta: proximo, recorde: true, melhorDoModelo: proximo, jaTemPremio: jaTem }).premio, {
    fase: 'desafio',
    wallet: 'OUTRO',
    lapId: 'p1',
    lapMs: 570_000,
  })
  // um segundo quase igual (nao e recorde estrito): nada
  assert.equal(decidirPremio({ modeloComPremio: true, aberturaFechada: true, carteiras: 12, volta: volta('q', 'Q', 570_000, 50_000), recorde: false, melhorDoModelo: proximo, jaTemPremio: jaTem }).premio, null)
})

test('premio: Cyber e Moto2 nunca premiam e nunca tem abertura, com 10 carteiras ou mil', () => {
  const v = volta('c1', 'W1', 500_000, 1_000)
  for (const id of ['cyber', 'moto2']) {
    for (const carteiras of [1, 9, 10, 1_000]) {
      for (const fechada of [false, true]) {
        const r = decidirPremio({ modeloComPremio: modeloTemPremio(id), aberturaFechada: fechada, carteiras, volta: v, recorde: true, melhorDoModelo: v, jaTemPremio: NINGUEM })
        assert.deepEqual(r, { fase: 'aberto', fechouAbertura: false, premio: null }, `${id} ${carteiras} ${fechada}`)
      }
    }
  }
})

test('premio: modelos independentes (ganhar o c02 nao impede o c05): o limite e por carteira E modelo', () => {
  const tem = new Set(['W1|c02'])
  const v = volta('a', 'W1', 600_000, 1_000)
  const para = (modelo: string) =>
    decidirPremio({ modeloComPremio: modeloTemPremio(modelo), aberturaFechada: true, carteiras: 12, volta: v, recorde: true, melhorDoModelo: v, jaTemPremio: (w) => tem.has(`${w}|${modelo}`) })
  assert.equal(para('c02').premio, null)
  assert.equal(para('c05').premio!.fase, 'desafio')
})

test('premio: o numero de carteiras da abertura e parametro (o teste fecha com 3)', () => {
  const v = volta('v3', 'W3', 600_000, 3_000)
  assert.equal(decidirPremio({ modeloComPremio: true, aberturaFechada: false, carteiras: 3, necessarios: 3, volta: v, recorde: true, melhorDoModelo: v, jaTemPremio: NINGUEM }).fechouAbertura, true)
  assert.equal(decidirPremio({ modeloComPremio: true, aberturaFechada: false, carteiras: 2, necessarios: 3, volta: v, recorde: true, melhorDoModelo: v, jaTemPremio: NINGUEM }).fechouAbertura, false)
})

test('empate: vale a volta feita primeiro; recorde novo e' + "'" + ' ESTRITAMENTE mais rapido', () => {
  const a = { id: 'a', lapMs: 700_000, finishedAtMs: 100 }
  const b = { id: 'b', lapMs: 700_000, finishedAtMs: 200 }
  assert.ok(compararVoltas(a, b) < 0)
  assert.ok(compararVoltas(b, a) > 0)
  assert.ok(compararVoltas({ id: 'z', lapMs: 699_999, finishedAtMs: 900 }, a) < 0)
  assert.ok(compararVoltas({ id: 'x', lapMs: 700_000, finishedAtMs: 100 }, { id: 'y', lapMs: 700_000, finishedAtMs: 100 }) < 0)
  assert.equal([b, a].sort(compararVoltas)[0], a)
  assert.equal(recordeNovo(null, 800_000), true)
  assert.equal(recordeNovo({ lapMs: 700_000 }, 700_000), false) // empate: o recorde segue com a mais antiga
  assert.equal(recordeNovo({ lapMs: 700_000 }, 699_999), true)
  assert.equal(recordeNovo({ lapMs: 700_000 }, 700_001), false)
})

test('a migration 041 casa com o codigo: fase abertura no check, a funcao com trava por pista e modelo, so service_role', () => {
  const sql = readFileSync('supabase/migrations/041_dogcity_corrida_regra_v2.sql', 'utf8')
  assert.ok(sql.includes("phase in ('campeonato', 'desafio', 'abertura')"))
  assert.ok(sql.includes('create or replace function public.race_finish_lap('))
  assert.ok(sql.includes('pg_advisory_xact_lock'))
  assert.ok(sql.includes('p_needed integer default 10'))
  assert.ok(sql.includes('grant execute on function public.race_finish_lap(uuid, boolean, integer) to service_role'))
  assert.ok(sql.includes('revoke all on function public.race_finish_lap(uuid, boolean, integer) from public, anon, authenticated'))
  assert.ok(!/DROP\s+TABLE/i.test(sql))
  // sem travessao (U+2013, U+2014) na migration
  assert.ok(!/[\u2013\u2014]/.test(sql))
})

test('REGRAS: prazo de 30 min e margem de 5% (o cliente usa os mesmos)', () => {
  assert.equal(REGRAS.prazoMs, 1_800_000)
  assert.equal(REGRAS.margemVmax, 1.05)
})
