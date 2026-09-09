// ═══════════════════════════════════════════════════════════════════════════
// DOG AQUATICS: a parcela, o chão e o sítio da peça aquática.
//
// ⚠️ ELA NÃO ENTRA NO CAMPUS, E ISSO FOI MEDIDO. O campus esportivo (`campus.ts`)
// preenche os sete módulos entre as avenidas de 90° e 120° com as três arenas e
// não sobra bloco nenhum. A peça aquática vai para a FAIXA ESPELHADA, do outro
// lado da avenida de 90°, o que dá simetria de espelho em vez de um quarto
// membro desalinhado num trio que já fecha.
//
// ⚠️ E A PARCELA TEM DOIS MÓDULOS, NÃO CINCO, PORQUE AS GRANDES SÃO ATRAVESSADAS
// POR VIA. Medido em 09/09/2026 contra as vias publicadas:
//
//   j=34 ns=2  rumo 72,96..81,32   25,47 ha   via mais próxima: anel AN3 a +43,2 m
//   j=32 ns=3  rumo 68,68..81,32   38,4  ha   via mais próxima: anel AN3 a +43,2 m
//   j=30 ns=4  rumo 64,39..81,32   51,4  ha   **autopista AU2 a −19,0 m**
//   j=28 ns=5  rumo 60,10..81,32   64,4  ha   **bulevar BUL02 a −28,0 m**
//
// Negativo é invasão: nas parcelas de 4 e 5 módulos o eixo da via cai DENTRO da
// parcela, que é exatamente o defeito que o BUL04 tem no $DOG ARENA e que
// `campus.ts` registra como "defeito que ficou".
//
// ⚠️ E OS DOIS MÓDULOS AINDA SÃO O TERRENO MAIS PLANO DA FAIXA: 7,10 m de
// amplitude contra 13,1 m dos outros recortes e 33,1 m do campus.
//
// Three.js puro (regra da casa: nada de react-three-fiber).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import { montarPodio, dentroDoPoly, type Pt } from './podio'
import type { Modulo } from './teia'

/** a parcela: dois módulos da banda Bairro, r 3.024 a 3.564, rumo 72,96 a 81,32 */
export const AQUATICS_MOD: Modulo = { i: 11, nr: 3, j: 34, ns: 2 }

/**
 * A COTA TERRAPLANADA, e ela é a que EQUILIBRA corte e aterro.
 *
 * Medido em 09/09/2026 sobre os 25,47 ha da parcela, sondando a cada 5 m contra
 * `buildTerrain` no heightmap da NASA: o terreno natural vai de −37,21 a −30,11.
 * A cota de equilíbrio é −34,31, com **0,175 Mm³ de corte contra 0,171 Mm³ de
 * aterro**, corte máximo de 4,20 m em 45,3% da área e aterro máximo de 2,90 m.
 *
 * ⚠️ ISSO É 6% DO QUE O CAMPUS CUSTOU (2,74 Mm³ de cada lado), e a diferença não
 * é mérito de projeto: é o terreno. Deste lado da avenida de 90° a amplitude é
 * 7,10 m; do outro lado, 33,1 m.
 */
export const AQUATICS_Y = -34.3

/** a espessura da laje sobre o chão terraplanado, a mesma do campus */
export const PODIO_H = 1.5
/** a rampa entre a divisa (chão natural) e a laje, a mesma do campus */
export const FRANJA = 34
/** a faixa de calçada na borda da laje */
export const CALCADA = 12

/**
 * O ENVELOPE DA PEÇA, e ele é o do gerador: `blender/build_aquatics.py` declara
 * sítio de 324 × 180 m, calçada e saia enterrada incluídas.
 *
 * ⚠️ O COMPRIMENTO VAI NA TANGENTE DO ANEL, não no radial, e a razão é dupla. A
 * regra da casa (`estadio.ts`) manda o eixo longo do prédio na tangente, porque
 * é o que o deixa paralelo à rua de anel do próprio quarteirão. E aqui isso
 * ainda põe a Torre de Saltos, que fica na ponta de maior rumo da peça, virada
 * para o canal radial de 85°, que é onde THE REACH desemboca.
 */
export const AQUATICS_PECA_X = 324
export const AQUATICS_PECA_Z = 180
/** folga entre o topo da laje e a base do modelo, a mesma convenção do atletismo */
export const AQUATICS_FOLGA_Y = 0.40
const PASSO_SONDA = 8

/**
 * ⚠️ CHAVE DE DIAGNÓSTICO: `?aquatics=0` desliga a terraplanagem E a laje,
 * `=chao` deixa só a terraplanagem e `=laje` só a laje. A mesma grade do campus,
 * e pelo mesmo motivo: quando uma peça nova escurece ou afunda a cena, separar
 * "foi esta peça" de "foi outra coisa" sem chave custa um deploy por tentativa.
 */
const _flag = typeof window === 'undefined' ? '' : (new URLSearchParams(window.location.search).get('aquatics') ?? '')
export const AQUATICS_CHAO = _flag !== '0' && _flag !== 'laje'
export const AQUATICS_LAJE = _flag !== '0' && _flag !== 'chao'
export const AQUATICS_ATIVO = AQUATICS_CHAO || AQUATICS_LAJE

const P = montarPodio({ mod: AQUATICS_MOD, cota: AQUATICS_Y, nome: 'AQUATICS',
  franja: FRANJA, calcada: CALCADA, espessura: PODIO_H })

/** o topo da laje: é aqui que a peça pousa */
export const PODIO_TOPO = P.topo
/** o rumo do eixo do bloco, em graus */
export const AQUATICS_RUMO = P.rumo
/** o giro da peça na convenção do Three */
export const GIRO_AQUATICS = P.giro

/** o polígono da parcela, que vira máscara de via e de plantio */
export function aquaticsParcela(): { poly: [number, number][] } { return P.parcela() }
/** o polígono da laje, para quem precisa medir sem desenhar */
export function lajeDoAquatics(): Pt[] { return P.laje() }
export function naLajeAquatics(x: number, z: number): boolean { return P.naLaje(x, z) }
export function muroDoAquatics(alturaEm: (x: number, z: number) => number) { return P.medirMuro(alturaEm) }
export function peDoMuroAquatics(alturaEm: (x: number, z: number) => number, x: number, z: number) { return P.peDoMuro(alturaEm, x, z) }

/** a cota do chão depois da terraplanagem, dada a cota natural */
export function aquaticsAlturaAt(x: number, z: number, natural: number): number {
  if (!AQUATICS_CHAO) return natural
  return P.alturaAt(x, z, natural)
}

/** envolve `alturaEm` para que quem pousa peça encontre o topo da laje */
export function comPodioAquatics(base: (x: number, z: number) => number) {
  return P.comPodio(base)
}

/** o sítio da peça: o centro do bloco, como toda peça desta cidade */
export function aquaticsSitio(): { x: number; z: number; rumoDeg: number } {
  return { x: P.centro.x, z: P.centro.z, rumoDeg: P.rumo }
}

/**
 * As quatro quinas do envelope da peça, já giradas e postas no sítio.
 *
 * ⚠️ A MATRIZ É A MESMA QUE O THREE USA, e não a inversa. `campus.ts` registra o
 * dia em que `assentarEstadio` e `assentarGeode` sondaram o terreno com a matriz
 * invertida e mediram um retângulo girado 2φ fora do lugar: ficou invisível
 * enquanto o chão sob as peças era liso e apareceu quando o campus criou um
 * talude ao lado.
 */
export function envelopeAquatics(): [number, number][] {
  const s = aquaticsSitio()
  const giro = -THREE.MathUtils.degToRad(s.rumoDeg)
  const c = Math.cos(giro), sn = Math.sin(giro)
  const out: [number, number][] = []
  for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    const ex = (dx * AQUATICS_PECA_X) / 2, ez = (dz * AQUATICS_PECA_Z) / 2
    out.push([s.x + c * ex + sn * ez, s.z - sn * ex + c * ez])
  }
  return out
}

/** a peça está inteira dentro da laje? (o verificador usa, e a cena não precisa) */
export function pecaNaLaje(): boolean {
  return envelopeAquatics().every(([x, z]) => dentroDoPoly(x, z, P.laje()))
}

/**
 * Assenta o modelo: varre o envelope em grade, pega a cota mais alta e pousa.
 * Dentro da laje a varredura devolve sempre o topo do pódio, que é plano, então
 * a peça assenta rente sem que o gerador precise saber que existe um pódio.
 */
export function assentarAquatics(root: THREE.Object3D, alturaEm: (x: number, z: number) => number): THREE.Object3D {
  const s = aquaticsSitio()
  const giro = -THREE.MathUtils.degToRad(s.rumoDeg)
  const c = Math.cos(giro), sn = Math.sin(giro)
  const nx = Math.ceil(AQUATICS_PECA_X / PASSO_SONDA)
  const nz = Math.ceil(AQUATICS_PECA_Z / PASSO_SONDA)
  let alto = -Infinity
  for (let i = 0; i <= nx; i++) {
    const dx = -AQUATICS_PECA_X / 2 + (AQUATICS_PECA_X * i) / nx
    for (let j = 0; j <= nz; j++) {
      const dz = -AQUATICS_PECA_Z / 2 + (AQUATICS_PECA_Z * j) / nz
      const y = alturaEm(s.x + c * dx + sn * dz, s.z - sn * dx + c * dz)
      if (!Number.isFinite(y)) throw new Error('[aquatics] cota de terreno inválida')
      alto = Math.max(alto, y)
    }
  }
  root.name = 'DOG_AQUATICS'
  root.position.set(s.x, alto + AQUATICS_FOLGA_Y, s.z)
  root.rotation.y = giro
  return root
}

/** a laje desenhada: platô, calçada de borda e muro descendo até o terreno */
export function criarAquatics(alturaEm: (x: number, z: number) => number): THREE.Group {
  return P.criar(alturaEm)
}
