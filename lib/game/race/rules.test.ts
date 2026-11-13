// Rodar: npx tsx --test lib/game/race/rules.test.ts
//
// A logica pura da corrida no servidor: piso de tempo por trecho, ordem dos portoes (fora de ordem, repetido, repeticao do ultimo),
// carimbos da volta inteira, bandeiras, fases do campeonato, regra do premio, empate (volta mais antiga) e fechamento do campeonato.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  REGRAS,
  compararVoltas,
  decidirPortao,
  decidirPremioNaHora,
  dentroDaJanela,
  faseDoCampeonato,
  lerFlags,
  motivoDasFlags,
  pisoDoTrechoMs,
  posicaoPlausivel,
  recordeNovo,
  validarCarimbos,
  vencedoresDoFechamento,
  type Carimbo,
  type VoltaDaJanela,
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

// ---- o campeonato e o premio ----

const JANELA = { startsAtMs: 1_000, endsAtMs: 2_000 }

test('fase do campeonato: sem config, antes, durante e depois (a janela e [inicio, fim))', () => {
  assert.equal(faseDoCampeonato(5_000, null), 'sem_campeonato')
  assert.equal(faseDoCampeonato(999, JANELA), 'antes')
  assert.equal(faseDoCampeonato(1_000, JANELA), 'durante')
  assert.equal(faseDoCampeonato(1_999, JANELA), 'durante')
  assert.equal(faseDoCampeonato(2_000, JANELA), 'depois')
  assert.equal(faseDoCampeonato(9_000_000, JANELA), 'depois')
  assert.equal(dentroDaJanela(1_000, JANELA), true)
  assert.equal(dentroDaJanela(2_000, JANELA), false)
  assert.equal(dentroDaJanela(999, JANELA), false)
})

test('premio: dentro da janela NADA e premiado na hora, nem recorde', () => {
  for (const fase of ['sem_campeonato', 'antes', 'durante'] as const) {
    assert.equal(decidirPremioNaHora({ modeloComPremio: true, fase, recorde: true, jaTemPremio: false }), 'none', fase)
  }
})

test('premio: depois da janela, recorde novo do modelo gera o premio do desafio', () => {
  assert.equal(decidirPremioNaHora({ modeloComPremio: true, fase: 'depois', recorde: true, jaTemPremio: false }), 'desafio')
  assert.equal(decidirPremioNaHora({ modeloComPremio: true, fase: 'depois', recorde: false, jaTemPremio: false }), 'none')
})

test('premio: UM por carteira por modelo (quem ja tem bate o proprio recorde sem ganhar outro)', () => {
  assert.equal(decidirPremioNaHora({ modeloComPremio: true, fase: 'depois', recorde: true, jaTemPremio: true }), 'none')
})

test('premio: Cyber e Moto2 rankeiam sem premio, em qualquer fase', () => {
  for (const fase of ['sem_campeonato', 'antes', 'durante', 'depois'] as const) {
    assert.equal(decidirPremioNaHora({ modeloComPremio: modeloTemPremio('cyber'), fase, recorde: true, jaTemPremio: false }), 'none')
    assert.equal(decidirPremioNaHora({ modeloComPremio: modeloTemPremio('moto2'), fase, recorde: true, jaTemPremio: false }), 'none')
  }
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

test('fechamento: a melhor volta de CADA modelo dentro da janela; empate fica com a mais antiga', () => {
  const v = (id: string, wallet: string, model: string, lapMs: number, finishedAtMs: number): VoltaDaJanela => ({ id, wallet, model, lapMs, finishedAtMs })
  const voltas = [
    v('1', 'A', 'c02', 700_000, 1_500),
    v('2', 'B', 'c02', 690_000, 1_600),
    v('3', 'C', 'c02', 690_000, 1_550), // empata com B e e' mais antiga: ganha
    v('4', 'D', 'c02', 650_000, 999), // antes da janela: nao conta
    v('5', 'E', 'c02', 640_000, 2_000), // no instante do fim: fora ([inicio, fim))
    v('6', 'F', 'c05', 800_000, 1_100),
    v('7', 'G', 'cyber', 600_000, 1_200), // sem premio: nao entra
    v('8', 'H', 'c52', 900_000, 1_999),
  ]
  const r = vencedoresDoFechamento(voltas, JANELA, IDS_MODELOS_COM_PREMIO)
  const porModelo = Object.fromEntries(r.map((x) => [x.model, x.volta.wallet]))
  assert.deepEqual(porModelo, { c02: 'C', c05: 'F', c52: 'H' })
  assert.ok(r.every((x) => x.premiar))
  assert.equal(r.find((x) => x.model === 'c10'), undefined) // sem volta na janela: sem vencedor
})

test('fechamento: quem ja tem o carro do modelo nao ganha outro e o segundo NAO herda', () => {
  const voltas: VoltaDaJanela[] = [
    { id: '1', wallet: 'A', model: 'c02', lapMs: 690_000, finishedAtMs: 1_500 },
    { id: '2', wallet: 'B', model: 'c02', lapMs: 700_000, finishedAtMs: 1_600 },
  ]
  const r = vencedoresDoFechamento(voltas, JANELA, ['c02'], (w, m) => w === 'A' && m === 'c02')
  assert.equal(r.length, 1)
  assert.equal(r[0]!.volta.wallet, 'A')
  assert.equal(r[0]!.premiar, false)
})

test('REGRAS: prazo de 30 min e margem de 5% (o cliente usa os mesmos)', () => {
  assert.equal(REGRAS.prazoMs, 1_800_000)
  assert.equal(REGRAS.margemVmax, 1.05)
})
