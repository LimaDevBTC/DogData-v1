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
import { montarPodio, dentroDoPoly, centrarEntreParalelas, paresDeRuas, folgasDaPeca, type Pt } from './podio'
import { caixaDoModulo, rumoDaFace, type Modulo } from './teia'

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

/**
 * ⚠️ O RUMO DA PEÇA É O DA FACE DO DODECÁGONO, NÃO O EIXO DO BLOCO, e isso é
 * conserto de defeito visto na chapa de produção. O fundador olhou a peça na
 * laje e disse: "tá meio torto, não tá no esquadro perfeito". Medido depois:
 * o eixo do bloco está em 77,143° e a face em 75,000°, ou seja **2,143° de
 * torção contra as duas bordas longas da laje**, que dá **12,1 m de
 * desalinhamento nos 324 m da peça**.
 *
 * As bordas de anel de uma parcela são cordas retas da face do dodecágono, então
 * quem manda no esquadro é a face. O $DOG ARENA nunca sofreu disso porque o eixo
 * do bloco dele cai em 105,000°, que É o meio de uma face: um endereço em cada
 * doze cai assim, e o campus calhou de ser um deles.
 *
 * ⚠️ E AS BORDAS RADIAIS CONTINUAM DIVERGINDO 8,363°, o que é irremediável: são
 * raios que abrem em leque, e nenhum retângulo fica paralelo aos dois lados de
 * um leque. O campus vive com 14,896° nas dele. O que se pode fazer é ficar na
 * bissetriz, e é o que o centro do bloco já dá.
 */
export const AQUATICS_RUMO = rumoDaFace(P.giro * -1) * 180 / Math.PI
/** o giro da peça na convenção do Three */
export const GIRO_AQUATICS = -THREE.MathUtils.degToRad(AQUATICS_RUMO)

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

/**
 * Até onde a peça continua desenhada, por perfil.
 *
 * ⚠️ O ALCANCE SAI DO RAIO DO BLOCO, não de um número escolhido: a peça tem de
 * sobreviver à vista da praça (r 1.024 dali até a borda) mais a folga da própria
 * peça. É a mesma conta do atletismo, e ela acompanha sozinha se a teia mudar.
 */
export function aquaticsCull(tier: 'mobile' | 'desktop'): number {
  const c = caixaDoModulo(AQUATICS_MOD)
  const alcancePraca = Math.ceil((c.rm + 1024 + 350) / 100) * 100
  return tier === 'mobile' ? alcancePraca : Math.max(7000, alcancePraca)
}

/** as quatro quinas do envelope, dado um centro e um rumo quaisquer */
function envelopeEm(cx: number, cz: number, rumoDeg: number): [number, number][] {
  const giro = -THREE.MathUtils.degToRad(rumoDeg)
  const c = Math.cos(giro), sn = Math.sin(giro)
  const out: [number, number][] = []
  for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    const ex = (dx * AQUATICS_PECA_X) / 2, ez = (dz * AQUATICS_PECA_Z) / 2
    out.push([cx + c * ex + sn * ez, cz - sn * ex + c * ez])
  }
  return out
}

/**
 * O SÍTIO DA PEÇA, e ele não é mais o ponto polar do módulo.
 *
 * ⚠️ REGRA DO FUNDADOR, 09/09/2026: "ele tem que estar na mesma distância das
 * ruas paralelas". No ponto polar ele não estava: medido contra as duas ruas de
 * anel, **165,7 m de um lado e 170,3 m do outro, 4,6 m fora do centro**. A causa
 * é que o raio do módulo é a média de duas APÓTEMAS, e as bordas desenhadas são
 * cordas do dodecágono, cujo raio naquele rumo é outro.
 *
 * ⚠️ O DESLOCAMENTO É CALCULADO, NUNCA ESCRITO À MÃO: `centrarEntreParalelas`
 * devolve metade da diferença de folga na normal da aresta, então se a teia, a
 * franja ou o tamanho da peça mudarem, o centro acompanha sozinho. Um "empurra
 * 2,3 m para dentro" constante viraria mentira silenciosa no dia seguinte.
 *
 * ⚠️ E ELE MEDE CONTRA A PARCELA, NÃO CONTRA A LAJE, porque a regra fala das
 * RUAS. Dá no mesmo enquanto a franja for um recuo uniforme (a laje é a parcela
 * deslocada 34 m em todas as arestas), e deixa de dar se um dia a franja variar
 * por lado; medir contra as ruas é o que continua certo nos dois casos.
 */
const _sitio = (() => {
  const base = P.centro
  const { dx, dz } = centrarEntreParalelas(envelopeEm(base.x, base.z, AQUATICS_RUMO), P.parcela().poly as Pt[])
  return { x: base.x + dx, z: base.z + dz, desloc: Math.hypot(dx, dz) }
})()

/** quanto a peça se deslocou do ponto polar do módulo para ficar centrada */
export const AQUATICS_DESLOC = _sitio.desloc

/** o sítio da peça: o centro do bloco, corrigido para equidistância das ruas */
export function aquaticsSitio(): { x: number; z: number; rumoDeg: number } {
  return { x: _sitio.x, z: _sitio.z, rumoDeg: AQUATICS_RUMO }
}

/** as folgas da peça a cada rua da parcela, e os pares opostos */
export function aquaticsFolgas() {
  const poly = P.parcela().poly as Pt[]
  const env = envelopeAquatics()
  return { arestas: folgasDaPeca(env, poly), pares: paresDeRuas(env, poly) }
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
  return envelopeEm(_sitio.x, _sitio.z, AQUATICS_RUMO)
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

/**
 * AS PALMEIRAS DO PARQUE AQUÁTICO, em coordenadas de MUNDO.
 *
 * ⚠️ ELAS NÃO MORAM NO GLB, E ISSO É REGRA E NÃO DETALHE. O gerador chegou a
 * plantar 36 árvores com o kit genérico do `lib_dogcity`, e o fundador cortou:
 * *"temos muitas árvores no projeto, essas genéricas não devem ser usadas"*. A
 * cidade tem acervo (`palm-tall`, a tamareira de 16,1 m com o corte diamante das
 * bainhas podadas, escolhida vendo as três candidatas em EEVEE) e tem quem plante
 * (`props-table.ts`, com instância, LOD e corte por distância). Árvore dentro do
 * GLB é geometria duplicada que a cena já tem carregada.
 *
 * ⚠️ A ORLA É O LUGAR, E O NÚMERO SAI DELA. Dez por lido, igualmente espaçadas na
 * borda externa da orla de madeira, que é a regra de simetria da casa. Elas ficam
 * no lado de FORA de cada bacia, nunca entre a bacia e a promenade: sombra sobre
 * espreguiçadeira é o que uma palmeira faz, e sombra sobre a lâmina de competição
 * é o que ela não pode fazer.
 */
export function palmeirasDoAquatics(): [number, number][] {
  const s = aquaticsSitio()
  const giro = -THREE.MathUtils.degToRad(s.rumoDeg)
  const c = Math.cos(giro), sn = Math.sin(giro)
  // as coordenadas locais são as do gerador: x no comprimento, y no arco
  const LIDO_CY = 62.0, LIDO_L = 50.0, LIDO_W = 21.0, WELL_CX = 34.0, DECK_W = 6.0
  const out: [number, number][] = []
  for (const sy of [-1, 1]) {
    const yBorda = sy * (LIDO_CY + LIDO_W / 2 + DECK_W - 1.6)
    for (let k = 0; k < 10; k++) {
      const dx = WELL_CX - LIDO_L / 2 - DECK_W + (LIDO_L + 2 * DECK_W) * ((k + 0.5) / 10)
      // local (dx, yBorda) para mundo, com o mesmo giro de `assentarAquatics`
      out.push([s.x + c * dx + sn * yBorda, s.z - sn * dx + c * yBorda])
    }
  }
  return out
}
