// O tracado `an7-v1` da corrida da perimetral no SERVIDOR: a MESMA lista de portoes que o cliente gera
// (`src/corrida/tracado.ts` `gerarPortoes()`, dogcity-mundo, PR #404). Puro e deterministico: a conta e' copia do cliente, e o teste
// (`track.test.ts`) tranca a lista inteira contra a que o cliente gera (61 portoes, soma de verificacao). Mudou o tracado: pista nova
// (`an7-v2`, linha nova em race_tracks), nunca editar a v1.
//
// Geometria (medida no dado do jogo): a AN7 e' um anel de raio 6.950 m e 44 m de largura centrado na origem do mundo. Rumo em graus
// de norte (-Z), horario: `atan2(x, -z)`. A mao e' a direita: no sentido horario a direita e' para DENTRO do anel. `u` = metros PARA
// DENTRO a partir do eixo (u = 6.950 - raio). `s_m` = distancia no EIXO (raio 6.950) a partir da linha de largada, de 0 a VOLTA_M.
import { createHash } from 'node:crypto'

export const AN7 = { raio: 6950, largura: 44, meia: 22 } as const
/** Uma volta no eixo da AN7, em metros (43.668,14 m). */
export const VOLTA_M = 2 * Math.PI * AN7.raio
/** A sede da corrida: o centro do lote da DOG MOTORS (S07-Q00-B0001-L176). */
const LOTE_DOG_MOTORS = { x: 6763.9, z: 411.7 } as const
const RAD = Math.PI / 180

/** Rumo em graus [0, 360) sem arredondar. */
export function rumoBruto(x: number, z: number): number {
  const r = (Math.atan2(x, -z) / RAD) % 360
  return r < 0 ? r + 360 : r
}

/** O rumo da largada e da chegada (o do centro do lote da DOG MOTORS, 93,483 graus), a 0,001 grau. */
export const RUMO_LARGADA = Math.round(rumoBruto(LOTE_DOG_MOTORS.x, LOTE_DOG_MOTORS.z) * 1000) / 1000

export type TipoPortao = 'largada' | 'portao' | 'chicane' | 'chegada'
/** 0 = faixa do canteiro (a de dentro), 1 = meio da pista, 2 = faixa da borda (a de fora). */
export type FaixaPortao = 0 | 1 | 2

/** O portao como o contrato descreve (POST /api/game/race/start devolve `gates`). */
export interface Portao {
  i: number
  s_m: number
  lane: FaixaPortao
  kind: TipoPortao
}

interface DefinicaoTracado {
  id: string
  rumoLargada: number
  passoGraus: number
  larguraPortaoM: number
  chicanes: ReadonlyArray<{ rumo: number; nome: string }>
  chicanePortoes: number
  chicaneEspacoM: number
  chicaneLarguraM: number
  margemM: number
}

/** an7-v1 (13/11): 36 portoes comuns a cada 10 graus, 8 chicanes de 3 portoes (AV05 em 120 graus e os trevos de 150 a 330). */
export const TRACADO_AN7_V1: DefinicaoTracado = {
  id: 'an7-v1',
  rumoLargada: RUMO_LARGADA,
  passoGraus: 10,
  larguraPortaoM: 7,
  chicanes: [
    { rumo: 120, nome: 'AV05' },
    { rumo: 150, nome: 'T150' },
    { rumo: 180, nome: 'T180' },
    { rumo: 210, nome: 'T210' },
    { rumo: 240, nome: 'T240' },
    { rumo: 270, nome: 'T270' },
    { rumo: 300, nome: 'T300' },
    { rumo: 330, nome: 'T330' },
  ],
  chicanePortoes: 3,
  chicaneEspacoM: 75,
  chicaneLarguraM: 7,
  margemM: 0.5,
}

/** Distancia ao longo da volta para um rumo, a partir da largada, no sentido horario, em [0, VOLTA_M). */
export function sDoRumo(rumo: number, rumoLargada = RUMO_LARGADA): number {
  let d = (rumo - rumoLargada) % 360
  if (d < 0) d += 360
  return d * RAD * AN7.raio
}

/** `s` (qualquer) para rumo em [0, 360). */
export function rumoDoS(s: number, rumoLargada = RUMO_LARGADA): number {
  const r = (rumoLargada + s / AN7.raio / RAD) % 360
  return r < 0 ? r + 360 : r
}

function arred(s: number): number {
  return Math.round(s * 100) / 100
}

/** Os portoes do tracado, em ordem de `s`, `i` de 0 (largada) a N-1 (chegada). Deterministico: igual ao `gerarPortoes()` do cliente. */
export function gerarPortoes(def: DefinicaoTracado = TRACADO_AN7_V1): Portao[] {
  const lista: Array<Omit<Portao, 'i'>> = []
  lista.push({ s_m: 0, lane: 1, kind: 'largada' })
  const n = Math.round(360 / def.passoGraus)
  for (let k = 1; k < n; k++) lista.push({ s_m: arred((VOLTA_M * k) / n), lane: k % 2 === 1 ? 2 : 0, kind: 'portao' })
  for (const c of def.chicanes) {
    const sc = sDoRumo(c.rumo, def.rumoLargada)
    const meio = (def.chicanePortoes - 1) / 2
    for (let j = 0; j < def.chicanePortoes; j++) {
      lista.push({ s_m: arred(sc + (j - meio) * def.chicaneEspacoM), lane: j % 2 === 0 ? 2 : 0, kind: 'chicane' })
    }
  }
  const fim = arred(VOLTA_M)
  const curta = lista.filter((p) => p.kind === 'largada' || p.s_m < fim - 1)
  curta.push({ s_m: fim, lane: 1, kind: 'chegada' })
  curta.sort((a, b) => a.s_m - b.s_m)
  return curta.map((p, i) => ({ i, ...p }))
}

/** A soma de verificacao da lista de portoes (a mesma que a migration 038 grava em race_tracks.gates_sha256). */
export function somaDosPortoes(portoes: ReadonlyArray<Portao>): string {
  return createHash('sha256').update(JSON.stringify(portoes)).digest('hex')
}

// ---- a geometria do portao no mundo (a trajetoria enviada no fim e' conferida contra ela) ----

const FRACAO_CANTEIRO = 0.09
const CANTEIRO_ORLA_NOBRE_M = 8
const ORLA_NOBRE_RUMO0 = 346
const ORLA_NOBRE_RUMO1 = 116.5
const RAMPA_GRAUS = 0.5
const COMPRIMENTO_DO_ARCO = (((ORLA_NOBRE_RUMO1 - ORLA_NOBRE_RUMO0 + 360) % 360))

function pesoNoRumo(rumo: number): number {
  const rel = (((rumo - ORLA_NOBRE_RUMO0) % 360) + 360) % 360
  if (rel <= COMPRIMENTO_DO_ARCO) return 1
  const alem = rel - COMPRIMENTO_DO_ARCO
  if (alem <= RAMPA_GRAUS) return 1 - alem / RAMPA_GRAUS
  const antes = 360 - rel
  if (antes <= RAMPA_GRAUS) return 1 - antes / RAMPA_GRAUS
  return 0
}

/** O canteiro central da AN7 no rumo (8 m na Orla Nobre, 3,96 m fora, rampa linear de 0,5 grau; `nucleo/canteiro.ts` do jogo). */
export function canteiroNoRumo(rumo: number): number {
  const base = AN7.largura * FRACAO_CANTEIRO
  const p = pesoNoRumo(rumo)
  if (p <= 0) return base
  return base + (Math.max(CANTEIRO_ORLA_NOBRE_M, base) - base) * p
}

/** O portao resolvido: o centro `u` (m para dentro do eixo) e a largura `w` da abertura. */
export interface PortaoNoAnel extends Portao {
  rumo: number
  u: number
  w: number
}

export function resolverPortao(p: Portao, def: DefinicaoTracado = TRACADO_AN7_V1): PortaoNoAnel {
  const rumo = rumoDoS(p.s_m, def.rumoLargada)
  const canteiro = canteiroNoRumo(rumo)
  let w: number
  let u: number
  if (p.kind === 'largada' || p.kind === 'chegada') {
    // a linha atravessa a pista de dentro inteira, com 1 m de tolerancia de cada lado
    w = AN7.meia - canteiro / 2 + 2
    u = (canteiro / 2 + AN7.meia) / 2
  } else {
    w = p.kind === 'chicane' ? def.chicaneLarguraM : def.larguraPortaoM
    const dentro = canteiro / 2
    if (p.lane === 0) u = dentro + def.margemM + w / 2
    else if (p.lane === 2) u = AN7.meia - def.margemM - w / 2
    else u = (dentro + AN7.meia) / 2
  }
  return { ...p, rumo, u, w }
}

/** Onde um ponto do mundo esta em relacao ao anel: rumo bruto e `u` (m para dentro do eixo; negativo = para fora). */
export function medirNoAnel(x: number, z: number): { rumo: number; u: number } {
  return { rumo: rumoBruto(x, z), u: AN7.raio - Math.hypot(x, z) }
}

// ---- o registro das pistas que o servidor conhece ----

export interface Pista {
  id: string
  portoes: ReadonlyArray<Portao>
  /** o mesmo, resolvido no anel (so a conferencia da trajetoria usa) */
  noAnel: ReadonlyArray<PortaoNoAnel>
  voltaM: number
  somaPortoes: string
}

function montarPista(def: DefinicaoTracado): Pista {
  const portoes = gerarPortoes(def)
  return { id: def.id, portoes, noAnel: portoes.map((p) => resolverPortao(p, def)), voltaM: VOLTA_M, somaPortoes: somaDosPortoes(portoes) }
}

const PISTAS: Readonly<Record<string, Pista>> = Object.freeze({ [TRACADO_AN7_V1.id]: montarPista(TRACADO_AN7_V1) })

export const PISTA_PADRAO = TRACADO_AN7_V1.id

export function pistaDe(id: unknown): Pista | null {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(PISTAS, id) ? PISTAS[id]! : null
}
