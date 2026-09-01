// ═══════════════════════════════════════════════════════════════════════════
// A ARBORIZAÇÃO: a árvore da DogCity, e ela é o maior salto de percepção que a
// cidade tem antes do mint, porque até aqui só existia chão desenhado.
//
// ⚠️ A COPA NÃO DESENHA POR VALOR, DESENHA POR SOMBRA, e é isso que dita a
// forma. Verde #7E8A6B contra calçada #CBC4B6 dá 2,11:1 de contraste e contra
// lote dá 1,43:1: de cima, uma copa quase some. O que aparece numa aérea de
// verdade é a SOMBRA dela, uma tracejada escura ao lado da calçada. Uma árvore
// de 7 m com o sol a 32 graus projeta 11,2 m, que mede cerca de 2 px na vista de
// topo. É por isso que a árvore aqui pode ter 30 triângulos e ainda funcionar.
//
// ⚠️ DUAS FORMAS, UM MATERIAL SÓ, e o material é o recurso escasso desta cena
// (a vista de topo compila 228 programas e o teto medido é 235). Esfera e cone
// dividem um MeshStandardMaterial com cor por vértice, e os dois níveis de LOD
// dividem o mesmo: o three compila um programa e cobra uma chamada de desenho
// por InstancedMesh, quatro no total.
//
// ⚠️ O LOD NÃO SE REBALANCEIA POR QUADRO. A spec da maquete marcou o
// rebalanceamento contínuo como NÃO MEDIDO e deixou o plano B escrito: baldes
// refeitos só quando a câmera anda mais que um limiar. É o plano B que está
// implementado aqui, com limiar de 150 m, porque árvore não se mexe e a diferença
// entre cruz e copa a 400 m não muda enquanto a câmera anda meio quarteirão.
//
// ⚠️ A SEÇÃO DA AVENIDA É ESCALADA, E ISSO ERA O "ASFALTO CORTANDO A ÁRVORE AO
// MEIO". `vias.ts` desenha toda avenida com a MESMA seção de 34 m esticada por
// `esc = largura / 34`; as quatro cardeais têm 44 m, logo esc = 1,294. Aqui os
// recuos 3,93 e 30,07 entravam CRUS, sem esc: com meia largura de 22, o lado
// direito caía em t = 30,07, e na seção esticada a faixa 24,6 a 37,6 é PISTA. A
// muda nascia no meio da mão de tráfego. Medido em 01/09: 1.150 das 20.756 de
// bulevar, todas nas quatro cardeais. Agora o recuo é `3,93 × esc` e
// `30,07 × esc`, que é onde a calçada realmente está.
//
// ⚠️ A MÁSCARA DE VIA VALE PARA VIA ALHEIA, NÃO PARA A PRÓPRIA SEÇÃO. `naVia`
// marca pista, sarjeta E CALÇADA, e a fileira de bulevar é plantada de propósito
// na calçada do bulevar: aplicar a máscara crua apagaria as duas fileiras que a
// cidade quer ter. A regra escrita aqui é "a muda pode estar na seção da via a
// que ela pertence, não pode estar em NENHUMA outra": o teste é
// `naVia(...) && !propria(...)`, e `propria` é a caixa da avenida (ou a faixa do
// anel) que gerou aquela fileira.
//
// Espaçamentos de fonte primária, não de gosto:
//   7,6 m  bulevar e anel      (Portland, 25 ft, faixas C, CC, D, DC, F, FU)
//   9,1 m  via de contorno     (Portland, 30 ft, faixas E, G, GU)
//   1,07 m recuo do meio-fio   (Seattle, 3 ft 6 in do eixo à face da guia)
//   10,7 m recuo de esquina    (NYC, 35 ft do meio-fio da transversal)
//
// Three.js puro (regra da casa: nada de react-three-fiber).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import { AVENIDAS, avenidasGeom, emAvenida } from './teia'
import { look2 } from './look'
import type { DistanceCuller } from './perf'

export interface Cova { x: number; z: number; r: number }

export interface ArborizacaoOpts {
  heightAt: (x: number, z: number) => number
  /** covas que as praças e as peças pediram, em coordenadas de mundo */
  covas?: Cova[]
  /** ⚠️ ESTÁ MOLHADO? Sem isto a plantação atravessa a baía.
   *
   *  Medido em 31/08, antes de existir: 13,7% das mudas (cerca de 6.800 de
   *  49.818) estavam sobre água. A rua PARA na baía por decisão do fundador
   *  ("retire as estradas de cima da baía"), e a fileira de árvore seguia em
   *  frente, reta, por cima da lâmina. Vem de `lagos.naAgua`, que é a mesma
   *  rotulagem por preenchimento que desenha a água: fonte única, não uma
   *  conta paralela de altura que divergiria na borda do pódio. */
  molhado?: (x: number, z: number) => boolean
  /** ⚠️ ESTÁ NA RUA? Sem isto a muda nasce no meio da pista. Vem de
   *  `vias.naVia`, a mesma máscara que a rua usa para se desenhar: fonte
   *  única, não uma conta paralela que divergiria na esquina.
   *
   *  Até 01/09 a árvore só conhecia AVENIDA (`noBulevar`, via `emAvenida`) e
   *  ANEL (`noAnel`, um raio contra um dodecágono). A malha viária LOCAL, que é
   *  a maior parte dos 261 km de rua desenhada, e as 46 rotatórias não eram
   *  consultadas por ninguém. */
  naVia?: (x: number, z: number, folga?: number) => boolean
  sombra?: boolean
  culler?: DistanceCuller
}

export interface Arborizacao {
  group: THREE.Group
  arvores: number
  cheias: number
  triangulos: number
  update(cam: THREE.Vector3): void
  dispose(): void
}

const COR_TRONCO = new THREE.Color('#6E685C')
const COR_COPA = new THREE.Color('#7E8A6B')
// ⚠️ A TERRA BATIDA DO PÉ É O ÚNICO CONTATO QUE A ÁRVORE TEM COM O CHÃO. Ela é
// escura de propósito: contra regolito #9B958C dá 2,4:1, que é o valor de uma
// oclusão de contato, não de uma mancha desenhada.
const COR_TERRA = new THREE.Color('#4A4238')

const TETO = 40000        // teto duro de instâncias; o módulo loga o plantado
const R_CHEIA = 1400      // além disto a árvore vira o volume de longe (8 triângulos)
const PASSO_REBALANCE = 150
/** margem entre o pé da muda e a guia: o ponto não tem raio, a árvore tem. Torrão
 *  de 1,05 m no maior porte (×1,35 de escala, ×1,34 de copa aberta) dá 1,90 m. */
const FOLGA_VIA = 1.9
/** a seção do bulevar em `vias.ts` mede 34 m e é esticada por largura/34 */
const SEC_BULEVAR_M = 34

type Forma = 'esfera' | 'cone'
interface Muda {
  x: number; z: number; forma: Forma
  /** porte geral da muda */
  esc: number
  /** ⚠️ ESCALA NÃO UNIFORME É A SILHUETA DE GRAÇA. Quatro arquétipos (redonda,
   *  aberta, colunar, alta) saem de dois fatores por instância, sem uma malha
   *  nova, sem um material novo e sem um triângulo a mais: o custo de mais uma
   *  silhueta real seria uma chamada de desenho inteira numa cena com 442. */
  escXZ: number; escY: number
  giro: number
  /** inclinação do fuste: árvore de rua não nasce no prumo */
  tomboX: number; tomboZ: number
  /** cor por instância (`setColorAt`), só no look 2 */
  tint: THREE.Color | null
}

/** ruído determinístico: a cidade é a mesma em toda visita */
function hash01(i: number): number {
  let t = (i + 0x9e3779b9) >>> 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/**
 * RUÍDO DE MUNDO, célula de ~170 m, para a cor ter PARENTESCO.
 *
 * ⚠️ COPA TODA IGUAL É O QUE DENUNCIA INSTANCIAMENTO, e cor por instância é o
 * conserto mais barato que existe: `setColorAt` custa um atributo de 3 floats e
 * NENHUM material novo, numa cena onde o material é o recurso escasso (228
 * programas compilados contra um teto medido de 235).
 *
 * ⚠️ E A VARIAÇÃO NÃO PODE SER SÓ ALEATÓRIA. Random puro dá confete: cada árvore
 * de uma alameda com uma cor, que lê como ruído de televisão, não como
 * arborização. Uma alameda de verdade é plantada de uma vez, com mudas do mesmo
 * viveiro, e tem PARENTESCO; um bosque tem variedade. Então a cor sai de dois
 * termos: 65% de um ruído de mundo (vizinhos parecidos) e 35% do hash da muda
 * (nenhuma igual à outra).
 */
function ruidoMundo(x: number, z: number, escala: number): number {
  const xi = Math.floor(x / escala), zi = Math.floor(z / escala)
  const fx = x / escala - xi, fz = z / escala - zi
  const h = (a: number, b: number) => hash01((((a & 1023) * 1013904223 + (b & 1023) * 1664525) >>> 0))
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz)
  const a = h(xi, zi), b = h(xi + 1, zi)
  const c = h(xi, zi + 1), d = h(xi + 1, zi + 1)
  const t0 = a + (b - a) * sx, t1 = c + (d - c) * sx
  return t0 + (t1 - t0) * sz
}

/**
 * OS QUATRO ARQUÉTIPOS, e eles não custam um triângulo.
 *
 * ⚠️ DUAS FORMAS PARA A CIDADE INTEIRA É POUCO, mas mais uma silhueta de
 * verdade seria mais um InstancedMesh, ou seja mais uma chamada de desenho numa
 * cena com 442. Escala não uniforme e tombo do fuste são de graça e devolvem
 * quatro leituras diferentes da mesma geometria: redonda, aberta e baixa,
 * colunar, alta e estreita.
 *
 * ⚠️ ESCALA NÃO UNIFORME TORCE A NORMAL. O three multiplica a normal pela
 * instanceMatrix sem inversa transposta, então uma copa de 0,66 × 1,40 chega ao
 * shader com a normal inclinada alguns graus. NÃO MEDI o erro de luz; nas faixas
 * daqui (0,66 a 1,40) ele é pequeno e some numa copa de 20 triângulos, mas quem
 * abrir a faixa vai ver a copa achatada acender errado.
 */
const ARQUETIPOS: Record<Forma, [number, number][]> = {
  // xz, y
  esfera: [[1.00, 1.00], [1.34, 0.74], [0.66, 1.34], [0.88, 1.40]],
  cone: [[1.00, 1.00], [1.25, 0.85], [0.80, 1.10], [0.72, 1.24]],
}
/** ⚠️ 0,86 a 1,14 ERA FAIXA DE 30%, E ÁRVORE DE RUA NÃO É ASSIM. Uma fileira
 *  real tem muda nova de 3 m ao lado de exemplar velho de 13 m. Com o arquétipo
 *  junto, a esfera vai de 3,1 m a 13,2 m e o cone de 5,1 m a 15,1 m. */
const PORTE: Record<Forma, [number, number]> = { esfera: [0.60, 1.35], cone: [0.55, 1.25] }

/** o multiplicador de cor de uma muda: frio e escuro de um lado, quente e claro
 *  do outro. Ele MULTIPLICA a cor por vértice, então 1,0 é a copa de hoje. */
function tintarMuda(x: number, z: number, i: number, alvo: THREE.Color): THREE.Color {
  const t = 0.65 * ruidoMundo(x, z, 170) + 0.35 * hash01(i * 2654435761)
  // frio (0) → #B8DBC7 escurecido; quente (1) → #FFE8B0 clareado
  alvo.setRGB(
    0.74 + t * 0.52,
    0.86 + t * 0.30,
    0.80 + t * 0.08,
  )
  // luminância geral: as claras clareiam mais do que as escuras escurecem, senão
  // a massa toda cai de valor e o verde some contra o lote (1,43:1 já é pouco)
  const l = 0.88 + hash01(i * 40503) * 0.30
  alvo.multiplyScalar(l)
  return alvo
}

/** uma muda pronta: porte, arquétipo, tombo e cor saem todos do mesmo hash, para
 *  a cidade ser a mesma em toda visita. No look 1 devolve exatamente o que o
 *  módulo devolvia antes (escala uniforme 0,86 a 1,14, sem tombo, sem cor). */
function criarMuda(x: number, z: number, forma: Forma, i: number): Muda {
  const giro = hash01(i * 7) * Math.PI * 2
  if (!look2) {
    const esc = 0.86 + hash01(i) * 0.28
    return { x, z, forma, esc, escXZ: 1, escY: 1, giro, tomboX: 0, tomboZ: 0, tint: null }
  }
  const [p0, p1] = PORTE[forma]
  const esc = p0 + hash01(i) * (p1 - p0)
  const arq = ARQUETIPOS[forma]
  // o arquétipo também tem parentesco: uma alameda inteira tende ao mesmo tipo
  const q = 0.55 * ruidoMundo(x, z, 240) + 0.45 * hash01(i * 101)
  const [escXZ, escY] = arq[Math.min(arq.length - 1, Math.floor(q * arq.length))]
  // o cone é a árvore de canteiro, estaqueada: quase no prumo. A esfera é a de
  // calçada, que cresce torta.
  const tombo = forma === 'cone' ? 0.026 : 0.062
  return {
    x, z, forma, esc, escXZ, escY, giro,
    tomboX: (hash01(i * 77) - 0.5) * 2 * tombo,
    tomboZ: (hash01(i * 131) - 0.5) * 2 * tombo,
    tint: tintarMuda(x, z, i, new THREE.Color()),
  }
}

/** pinta uma geometria inteira de uma cor só, como atributo */
function pintar(g: THREE.BufferGeometry, cor: THREE.Color) {
  const n = g.attributes.position.count
  const c = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) { c[i * 3] = cor.r; c[i * 3 + 1] = cor.g; c[i * 3 + 2] = cor.b }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3))
  return g
}

/** um tubo de revolução por perfil [altura, raio], aberto nas duas pontas */
function tubo(perfil: [number, number][], lados: number, cor: THREE.Color): THREE.BufferGeometry {
  const vs: number[] = [], ix: number[] = []
  for (const [y, r] of perfil) {
    for (let k = 0; k < lados; k++) {
      const a = (k / lados) * Math.PI * 2
      vs.push(Math.cos(a) * r, y, Math.sin(a) * r)
    }
  }
  for (let s = 0; s < perfil.length - 1; s++) {
    for (let k = 0; k < lados; k++) {
      const k2 = (k + 1) % lados
      const a = s * lados + k, b = s * lados + k2
      const c = (s + 1) * lados + k, d = (s + 1) * lados + k2
      ix.push(a, c, d, a, d, b)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(vs, 3))
  g.setIndex(ix)
  g.computeVertexNormals()
  return pintar(g, cor)
}

/**
 * O PÉ: fuste alargado na base mais um torrão de terra batida. 32 triângulos.
 *
 * ⚠️ ISTO VALE MAIS QUE QUALQUER DETALHE DE COPA, e a razão é medida na chapa
 * rasante: hoje o tronco é um cilindro de raio constante que encosta no chão com
 * emenda dura, sem nenhuma sombra de contato, e o olho lê a árvore FLUTUANDO.
 * Duas coisas consertam isso, e nenhuma é sombra de verdade:
 *   1. o fuste abre de 0,18 m no topo para 0,62 m no pé (2 anéis, 20 triângulos),
 *      que é a base que qualquer árvore de rua tem;
 *   2. um torrão tronco-cônico de 1,05 m de raio e 0,20 m de altura em volta,
 *      na cor da terra (12 triângulos), que faz o papel do decal de oclusão.
 *
 * ⚠️ TORRÃO É VOLUME, NÃO DECAL, E É POR ISSO QUE ELE NÃO BRIGA COM O Z-BUFFER.
 * Um disco coplanar precisaria da FOLGA de 0,02 m de `vias.ts`, e 0,02 m só
 * segura terreno PLANO: no cinturão da cidade o relevo anda alguns centímetros
 * dentro de 1 m, e o disco ora sumiria ora boiaria. O torrão tem 0,20 m de
 * altura e a borda em 0,02 m, então ele engole o desnível em vez de disputá-lo.
 */
function geoPe(alturaFuste: number, raioTopo: number): THREE.BufferGeometry[] {
  const colo = Math.min(0.55, alturaFuste * 0.3)
  const fuste = tubo([[0.0, 0.62], [colo, 0.30], [alturaFuste, raioTopo]], 5, COR_TRONCO)
  const torrao = tubo([[0.02, 1.05], [0.20, 0.34]], 6, COR_TERRA)
  return [fuste, torrao]
}

/** ESFERA: copa de icosaedro achatada sobre tronco. 30 triângulos (52 no look 2,
 *  com o pé), 7,0 m. */
function geoEsfera(comPe: boolean): THREE.BufferGeometry {
  const copa = new THREE.IcosahedronGeometry(2.6, 0)
  copa.scale(1, 0.82, 1)
  copa.translate(0, 4.9, 0)
  if (comPe) return fundir([pintar(copa, COR_COPA), ...geoPe(3.4, 0.18)])
  const tronco = new THREE.CylinderGeometry(0.18, 0.26, 3.4, 5, 1, true)
  tronco.translate(0, 1.7, 0)
  return fundir([pintar(copa, COR_COPA), pintar(tronco, COR_TRONCO)])
}

/** CONE: 12 triângulos (44 no look 2, com o pé), 11,0 m. Só no canteiro de
 *  bulevar e de anel.
 *
 *  ⚠️ NO LOOK 2 A SAIA SOBE 1,6 m, e não é enfeite: com a saia no chão, o torrão
 *  de 1,05 m fica INTEIRO dentro do cone de 2,4 m de raio, invisível, e os 32
 *  triângulos do pé seriam pagos para não aparecer. A copa perde 1,6 m de saia e
 *  ganha um fuste que se vê, que é o que faz a peça encostar no chão. */
function geoCone(comPe: boolean): THREE.BufferGeometry {
  if (comPe) {
    const c = new THREE.ConeGeometry(2.4, 9.4, 6)
    c.translate(0, 1.6 + 4.7, 0)
    return fundir([pintar(c, COR_COPA), ...geoPe(1.9, 0.30)])
  }
  const c = new THREE.ConeGeometry(2.4, 11.0, 6)
  c.translate(0, 5.5, 0)
  return pintar(c, COR_COPA)
}

/**
 * O VOLUME DE LONGE: um octaedro alongado, 8 triângulos.
 *
 * ⚠️ ISTO SUBSTITUI A CRUZ DE QUADS (fundador, 30/08: "esse monte de bloco verde
 * é o quê? Horrível, se for algum tipo de árvore precisamos trocar todas"). A
 * cruz eram três quads cruzados: de frente parece árvore, mas na RASANTE, que é
 * como se olha uma cidade, ela vira uma laje verde chapada sem silhueta nenhuma,
 * e eram 39.518 delas contra 1.800 copas de verdade.
 *
 * ⚠️ E O CONSERTO NÃO É MAIS CARO, é 8 triângulos contra 6. O que a cruz nunca
 * teve e o octaedro tem é VOLUME: qualquer ângulo devolve um contorno de copa, a
 * luz varia entre as faces e a sombra projetada é de árvore, não de placa. A
 * cintura fica a 62% da altura, que é onde a copa de uma árvore de rua é mais
 * larga.
 */
function geoLonge(altura: number, larg: number): THREE.BufferGeometry {
  const R = larg / 2
  const yc = altura * 0.62
  const vs: number[] = [0, 0, 0]                 // o pé, na cor do tronco
  const cs: number[] = [COR_TRONCO.r, COR_TRONCO.g, COR_TRONCO.b]
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2
    vs.push(Math.cos(a) * R, yc, Math.sin(a) * R)
    cs.push(COR_COPA.r, COR_COPA.g, COR_COPA.b)
  }
  vs.push(0, altura, 0)                          // o topo
  cs.push(COR_COPA.r, COR_COPA.g, COR_COPA.b)
  const ix: number[] = []
  for (let k = 0; k < 4; k++) {
    const a = 1 + k, b = 1 + ((k + 1) % 4)
    ix.push(0, b, a)                             // a saia, para baixo
    ix.push(a, b, 5)                             // a copa, para cima
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(vs, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3))
  g.setIndex(ix)
  g.computeVertexNormals()
  return g
}

function fundir(gs: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const vs: number[] = [], cs: number[] = [], ix: number[] = []
  for (const g of gs) {
    const base = vs.length / 3
    const p = g.attributes.position as THREE.BufferAttribute
    const c = g.attributes.color as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) {
      vs.push(p.getX(i), p.getY(i), p.getZ(i))
      cs.push(c.getX(i), c.getY(i), c.getZ(i))
    }
    const idx = g.getIndex()
    if (idx) for (let i = 0; i < idx.count; i++) ix.push(base + idx.getX(i))
    else for (let i = 0; i < p.count; i++) ix.push(base + i)
    g.dispose()
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(vs, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3))
  g.setIndex(ix)
  g.computeVertexNormals()
  return g
}

interface Quarteirao { x: number; z: number; giro: number; lado: number; prof?: number }
interface Bulevar { rumo: number; largura: number; x0: number; z0: number; x1: number; z1: number }
interface Anel { r: number; larg: number }
interface Peca { x: number; z: number; a: number; b: number; rot: number; forma?: string }

export async function buildArborizacao(o: ArborizacaoOpts): Promise<Arborizacao> {
  const [malha, meta] = await Promise.all([
    fetch('/city/cidade-malha.json').then((r) => r.json() as Promise<{
      constantes: { setores: number; quarteirao: number; viaContorno: number; bulevar: number }
      quarteiroes: Quarteirao[]; bulevares: Bulevar[]
    }>),
    fetch('/city/cidade.json').then((r) => r.json() as Promise<{
      programa: Peca[]; raioBorda: number; raioInicio: number; aneis?: Anel[]
    }>),
  ])
  const K = malha.constantes
  const group = new THREE.Group()
  group.name = 'arborizacao'

  // ── as máscaras: árvore respeita o mesmo que a rua respeita ───────────────
  const pecas = (meta.programa ?? []).map((p) => {
    const rr = (p.rot * Math.PI) / 180
    return { x: p.x, z: p.z, a: p.a, b: p.b, ret: p.forma !== 'elipse',
             ca: Math.cos(rr), sa: Math.sin(rr), rr2: p.a * p.a + p.b * p.b }
  })
  const emPeca = (px: number, pz: number) => {
    for (const p of pecas) {
      const dx = px - p.x, dz = pz - p.z
      if (dx * dx + dz * dz > p.rr2) continue
      const lx = dx * p.ca + dz * p.sa, lz = -dx * p.sa + dz * p.ca
      if (p.ret) { if (Math.abs(lx) <= p.a && Math.abs(lz) <= p.b) return true }
      else if ((lx / p.a) ** 2 + (lz / p.b) ** 2 <= 1) return true
    }
    return false
  }
  const rMax = meta.raioBorda ?? 4400
  const rMin = (meta.raioInicio ?? 1300) - 40
  const aneis = meta.aneis ?? []
  // ⚠️ ESTA MÁSCARA ESTAVA MORTA, E CALADA. Ela varria `K.setores`, e
  // `constantes` publica `setoresLegado`, não `setores`: `s < undefined` é falso
  // na primeira volta, o laço nunca rodava e a função só respondia `r < 40`. Ou
  // seja, desde sempre a árvore NÃO desviava de avenida nenhuma, e as fileiras
  // de anel eram plantadas por dentro dos cruzamentos.
  //
  // Undefined numa comparação não estoura, dá falso: a máscara errada tem a
  // mesma aparência de máscara ausente, e nada no console reclama.
  //
  // Agora ela vem da teia, com a largura de CADA avenida (44 nas quatro cardeais,
  // 34 nas outras oito) em vez de um `meiaBul` único.
  const noBulevar = (px: number, pz: number) => {
    if (Math.hypot(px, pz) < 40) return true
    return emAvenida(px, pz, 3)
  }
  const noAnel = (px: number, pz: number, folga = 3) => {
    const r = Math.hypot(px, pz)
    for (const a of aneis) if (Math.abs(r - a.r) <= a.larg / 2 + folga) return true
    return false
  }

  // ⚠️ E ESTA É A MÁSCARA QUE FALTAVA INTEIRA. `noBulevar` e `noAnel` são testes
  // ANALÍTICOS sobre 12 retas e 7 raios; a rua desenhada tem 261 km, 1.859
  // quarteirões e 46 rotatórias. Tudo o que não é avenida nem anel nunca foi
  // consultado por ninguém, e é a maior parte do asfalto da cidade.
  const naVia = o.naVia
  if (!naVia) console.warn('[arborização] sem consulta de via: a muda pode nascer no meio da pista (o campo `naVia` de `vias.ts` não chegou)')

  // ⚠️ SONDA DE VIDA, PORQUE MÁSCARA MORTA TEM A CARA DE MÁSCARA AUSENTE. Foi
  // exatamente assim que `noBulevar` passou semanas lendo `K.setores`, um campo
  // que o JSON não publica, respondendo sempre `false` sem uma linha no console.
  // Aqui a sonda pergunta pelo MEIO DA PISTA de cada avenida: se nenhuma das 12
  // responder "é rua", a consulta chegou quebrada e o aviso sai alto.
  if (naVia) {
    let acertos = 0
    for (const av of avenidasGeom()) {
      const ang = (av.rumo * Math.PI) / 180
      const perpX = Math.cos(ang), perpZ = Math.sin(ang)
      const larg = av.largura ?? K.bulevar
      const e = larg / SEC_BULEVAR_M
      const off = 10 * e - larg / 2          // t = 10, meio da pista esquerda
      const mx = (av.x0 + av.x1) / 2 + perpX * off
      const mz = (av.z0 + av.z1) / 2 + perpZ * off
      if (naVia(mx, mz, 0)) acertos++
    }
    if (acertos === 0) console.warn('[arborização] a consulta de via chegou, mas não reconhece o meio da pista de NENHUMA das 12 avenidas: máscara provavelmente quebrada')
  }

  /** ⚠️ A MUDA PODE ESTAR NA SEÇÃO DA VIA QUE A PLANTOU, NUNCA EM OUTRA. `naVia`
   *  marca pista, sarjeta e calçada; a fileira de bulevar é plantada DE PROPÓSITO
   *  na calçada do bulevar, a 1,07 m da guia. Testar a máscara crua apagaria as
   *  duas fileiras que a cidade quer ter. Então quem tem seção própria passa
   *  `propria`, e só é recusada a muda que caiu em rua ALHEIA: malha local,
   *  rotatória, outro anel. */
  const emViaAlheia = (px: number, pz: number, folga: number, propria?: (x: number, z: number) => boolean) => {
    if (!naVia) return false
    if (!naVia(px, pz, folga)) return false
    return propria ? !propria(px, pz) : true
  }
  let rejVia = 0

  // ⚠️ SE A CONSULTA DE ÁGUA NÃO CHEGAR, RECLAME ALTO. O defeito que ela conserta
  // é invisível no console: máscara ausente e máscara errada têm a mesma cara, e
  // foi assim que `noBulevar` ficou morta por semanas lendo um campo que não
  // existe. Melhor um aviso feio do que 6.800 árvores boiando em silêncio.
  const molhado = o.molhado ?? (() => false)
  if (!o.molhado) console.warn('[arborização] sem consulta de água: a plantação pode atravessar a baía')

  const mudas: Muda[] = []
  /** `propria`: a seção de via a que esta fileira pertence, se houver. Sem ela,
   *  qualquer rua debaixo da muda a recusa. */
  const por = (x: number, z: number, forma: Forma, i: number, evitaVia = true,
               propria?: (px: number, pz: number) => boolean) => {
    if (mudas.length >= TETO) return
    const r = Math.hypot(x, z)
    if (r < rMin || r > rMax) return
    if (emPeca(x, z)) return
    if (molhado(x, z)) return
    if (evitaVia && (noBulevar(x, z) || noAnel(x, z))) return
    if (emViaAlheia(x, z, FOLGA_VIA, propria)) { rejVia++; return }
    mudas.push(criarMuda(x, z, forma, i))
  }

  // ── 1. as covas que a praça e a peça pediram ─────────────────────────────
  // Elas já vêm com posição escolhida por quem desenhou o chão, então não passam
  // pela máscara de peça: a cova DENTRO de uma peça é justamente a que a peça pôs.
  let i = 0
  for (const c of o.covas ?? []) {
    if (mudas.length >= TETO) break
    const r = Math.hypot(c.x, c.z)
    if (r < rMin || r > rMax) continue
    // a cova escapa da máscara de PEÇA (foi a peça que a pediu), nunca da de água
    if (molhado(c.x, c.z)) continue
    // ⚠️ nem da de VIA: quem desenhou o pátio escolheu a cova, mas nenhuma peça
    // pediu uma árvore no meio de uma rua que o `vias.ts` desenhou por cima dela
    if (emViaAlheia(c.x, c.z, FOLGA_VIA)) { rejVia++; continue }
    mudas.push(criarMuda(c.x, c.z, 'esfera', i))
    i++
  }
  const daCova = mudas.length

  // ── 2. os 12 bulevares: cone no canteiro, esfera nas duas calçadas ────────
  // Seção do bulevar (vias.ts): calçada 0 a 5, pista 5 a 15, canteiro 15 a 19,
  // pista 19 a 29, calçada 29 a 34, medida da borda esquerda.
  const PASSO_BUL = 7.6
  // ⚠️ AS AVENIDAS VÊM DE `avenidasGeom()`, NÃO DE `malha.bulevares`. O campo
  // `bulevares` do JSON são as 9 costuras dos 6 distritos, e `vias.ts` as troca
  // pelas 12 simétricas na cópia DELE. Este módulo busca o JSON por conta
  // própria e via as costuras: plantava em 61,9°, 106,9°, 185,6°, 241,9° e
  // 309,4°, onde não há rua, e deixava pelada a avenida de 30, 60, 120, 150,
  // 210, 240, 300 e 330. As duas listas só coincidem em 0, 90, 180 e 270.
  for (const b of avenidasGeom()) {
    const ang = (b.rumo * Math.PI) / 180
    const dirX = Math.sin(ang), dirZ = -Math.cos(ang)
    const perpX = Math.cos(ang), perpZ = Math.sin(ang)
    const L = Math.hypot(b.x1 - b.x0, b.z1 - b.z0)
    const n = Math.floor(L / PASSO_BUL)
    const larg = b.largura ?? K.bulevar
    const meia = larg / 2
    // ⚠️ A SEÇÃO É ESTICADA, E ERA ISTO QUE PUNHA A ÁRVORE NO ASFALTO. `vias.ts`
    // desenha toda avenida com a mesma seção de 34 m multiplicada por
    // `esc = largura / 34`. Nas quatro cardeais, de 44 m, esc = 1,294: a guia
    // direita não está em t = 29 e sim em t = 37,5, e o recuo cru de 30,07 caía
    // dentro da faixa 24,6 a 37,6, que é PISTA. Agora o recuo acompanha a seção.
    const esc = larg / SEC_BULEVAR_M
    // a árvore de bulevar tem seção própria: a caixa da avenida a legitima, menos
    // onde ela entra na rotatória, que é rua de outro dono
    const naSecaoDoBulevar = (px: number, pz: number) => emAvenida(px, pz, 0) && !noAnel(px, pz, 18)
    for (let k = 0; k <= n; k++) {
      const d = k * PASSO_BUL
      const bx = b.x0 + dirX * d, bz = b.z0 + dirZ * d
      // cone no eixo do canteiro (t = 17 da borda, ou seja o meio)
      por(bx, bz, 'cone', i++, false, naSecaoDoBulevar)
      // esfera a 1,07 m da face de cada meio-fio: t = 3,93 e t = 30,07 na seção
      // de 34 m, ambos esticados por esc
      for (const t of [3.93 * esc - meia, 30.07 * esc - meia]) {
        const x = bx + perpX * t, z = bz + perpZ * t
        if (Math.hypot(x, z) < rMin || Math.hypot(x, z) > rMax) continue
        if (emPeca(x, z) || molhado(x, z)) continue
        if (emViaAlheia(x, z, FOLGA_VIA, naSecaoDoBulevar)) { rejVia++; continue }
        if (mudas.length >= TETO) break
        mudas.push(criarMuda(x, z, 'esfera', i))
        i++
      }
    }
  }
  const doBulevar = mudas.length - daCova

  // ── 3. os 3 anéis: cone no canteiro central ──────────────────────────────
  // ⚠️ ISTO NÃO ESTAVA NA SPEC porque o anel não existia quando ela foi escrita.
  // É a peça que faltava para o verde da cidade ser SISTEMA e não ilha: o anel
  // plantado liga um distrito ao outro por baixo de árvore.
  // ⚠️ A FILEIRA SEGUE O POLÍGONO, NÃO O CÍRCULO. O anel virou dodecágono em
  // 31/08 ("teia é em linha reta") e a flecha vai de 60 m no Anel Interior a
  // 259 m na Pista de Serviço: plantar no círculo deixaria a fileira até 259 m
  // FORA da rua, atravessando o terreno — que é exatamente a leitura de "elemento
  // atrapalhando". Aqui a árvore anda pela corda entre duas avenidas, como a via.
  // ⚠️ O NÚMERO DE VÉRTICES É O NÚMERO DE AVENIDAS, não um 12 escrito à mão. O
  // anel vira polígono com um vértice em cada rotatória (é assim que `vias.ts`
  // o desenha, em `verticesDoAnel`), então derivar daqui é o que impede a
  // fileira de sair da corda no dia em que a teia mudar de contagem.
  const _VERT = AVENIDAS.length
  for (const a of aneis) {
    const n = Math.floor((2 * Math.PI * a.r) / PASSO_BUL)
    for (let k = 0; k < n; k++) {
      const t = (k / n) * Math.PI * 2
      // projeta o ângulo na corda do dodecágono: o vértice fica no raio cheio e
      // o meio da aresta em cos(π/12) dele
      const lado = Math.floor((t / (Math.PI * 2)) * _VERT)
      const g0 = (lado / _VERT) * Math.PI * 2, g1 = ((lado + 1) / _VERT) * Math.PI * 2
      const u = (t - g0) / (g1 - g0)
      const P0x = Math.sin(g0) * a.r, P0z = -Math.cos(g0) * a.r
      const P1x = Math.sin(g1) * a.r, P1z = -Math.cos(g1) * a.r
      const x = P0x + (P1x - P0x) * u, z = P0z + (P1z - P0z) * u
      if (Math.hypot(x, z) < rMin || Math.hypot(x, z) > rMax) continue
      if (emPeca(x, z) || molhado(x, z) || noBulevar(x, z)) continue
      // ⚠️ A FILEIRA DO ANEL SÓ TEM DIREITO AO CANTEIRO DO PRÓPRIO ANEL. Fora da
      // faixa dele (rotatória, malha local, outro anel), quem manda é `naVia`.
      // As 46 rotatórias eram o buraco maior: `noBulevar` recusa até 3 m fora da
      // caixa da avenida, e a rotatória tem 40 m de raio, então sobrava um aro de
      // asfalto de 15 m em cada travessia onde a fileira entrava e continuava.
      if (emViaAlheia(x, z, FOLGA_VIA, (px, pz) => Math.abs(Math.hypot(px, pz) - a.r) <= a.larg / 2)) { rejVia++; continue }
      if (mudas.length >= TETO) break
      mudas.push(criarMuda(x, z, 'cone', i))
      i++
    }
  }
  const doAnel = mudas.length - daCova - doBulevar

  // ── 4. a via de contorno, UM lado por quarteirão ─────────────────────────
  // ⚠️ UM LADO E NÃO OS DOIS, e isso é decisão urbana e não economia: plantio
  // unilateral em rua estreita de 7 m é padrão real, e a referência de maquete
  // (RJ Models) entrega masterplan com entourage deliberadamente limitado. Os
  // dois lados dariam mais de 35 mil árvores só aqui.
  const PASSO_CONT = 9.1
  const RECUO_ESQ = 10.7
  // ⚠️ O MEIO SAI DO BLOCO, NÃO DE UMA CONSTANTE. Era `K.quarteirao / 2` (84)
  // para a cidade inteira; com o quarteirão variando por banda (109 no Núcleo,
  // 168 no Meio, 227 no Bairro) isso plantava a fileira de árvores 30 m dentro
  // do lote no Núcleo e 30 m fora dele no Bairro.
  // ⚠️ ESTA FILEIRA FICOU ÓRFÃ EM 31/08 e por isso saiu. Ela era plantada ao
  // longo da VIA DE CONTORNO de cada quarteirão, e a via de contorno deixou de
  // existir quando a cidade passou a ter só as vias principais (7 anéis × 12
  // avenidas). O resultado na chapa eram fileiras pontilhadas atravessando o
  // terreno sem rua nenhuma embaixo, que é o que o fundador viu como elemento
  // atrapalhando. Árvore acompanha rua; sem rua, não há alinhamento.
  //
  // As de BULEVAR e de ANEL continuam, porque essas ruas existem. `?arvcont=1`
  // traz esta de volta para quem restaurar a teia fina.
  const _querCont = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('arvcont') === '1'
  for (const q of (_querCont ? malha.quarteiroes : [])) {
    const meio = q.lado / 2
    // a fileira corre ao longo da TESTADA e recua a PROFUNDIDADE
    const off = (q.prof ?? q.lado) / 2 + 2.5 + 1.07
    const g = (q.giro * Math.PI) / 180
    const cg = Math.cos(g), sg = Math.sin(g)
    const meia = meio - RECUO_ESQ
    const n = Math.floor((meia * 2) / PASSO_CONT)
    for (let k = 0; k <= n; k++) {
      const lx = -meia + k * PASSO_CONT
      const x = q.x + lx * cg - off * sg, z = q.z + lx * sg + off * cg
      por(x, z, 'esfera', i++)
    }
  }
  const doContorno = mudas.length - daCova - doBulevar - doAnel

  // ── 5. quatro InstancedMesh, UM material ─────────────────────────────────
  // ⚠️ DoubleSide POR CAUSA DA CRUZ: um quad de costas some, e metade das cruzes
  // fica de costas para qualquer câmera. Custa fragmento a mais em copa de 30
  // triângulos, o que não move o ponteiro, e é o que faz a cruz existir.
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.95, metalness: 0, side: THREE.DoubleSide,
  })
  const gEsf = geoEsfera(look2), gCon = geoCone(look2)
  const gCruzE = geoLonge(7.0, 4.8), gCruzC = geoLonge(11.0, 4.6)
  const TRI_ESF = gEsf.getIndex()!.count / 3
  const TRI_CON = gCon.getIndex()!.count / 3

  const nEsf = mudas.filter((m) => m.forma === 'esfera').length
  const nCon = mudas.length - nEsf
  // ⚠️ 900 ERA POUCO DEMAIS e o fundador viu: "esse monte de bloco verde é o quê?
  // Horrível". Com 40.000 árvores e teto de 900 copas, 39.518 delas eram o LOD de
  // longe, então praticamente a cidade INTEIRA era o LOD. Um teto de LOD só vale
  // quando o LOD é a exceção. Os lotes saíram e devolveram 1,03 milhão de
  // triângulos ao orçamento; 6.000 copas custam 180 mil.
  // ⚠️ E O TETO CAI NO LOOK 2, PORQUE A COPA CHEIA ENGORDOU. O pé (fuste
  // alargado + torrão) leva a esfera de 30 para 52 triângulos e o cone de 12
  // para 44. Manter 6.000 custaria 576.000 triângulos só de perto, contra os
  // 252.000 de hoje. 4.200 é o número que cabe: a densidade medida da cidade é
  // de 616 árvores/km² (34.436 no cinturão de 55,9 km²), então um disco de
  // R_CHEIA = 1.400 m contém cerca de 3.794 árvores e o teto quase nunca morde.
  const CAP_CHEIA = look2 ? 4200 : 6000   // teto de copas cheias em cena ao mesmo tempo

  const malhas: Record<string, THREE.InstancedMesh> = {
    cruzEsfera: new THREE.InstancedMesh(gCruzE, mat, Math.max(1, nEsf)),
    cruzCone: new THREE.InstancedMesh(gCruzC, mat, Math.max(1, nCon)),
    cheiaEsfera: new THREE.InstancedMesh(gEsf, mat, CAP_CHEIA),
    cheiaCone: new THREE.InstancedMesh(gCon, mat, CAP_CHEIA),
  }
  for (const [nome, m] of Object.entries(malhas)) {
    m.name = `arvore:${nome}`
    m.castShadow = o.sombra ?? true
    m.receiveShadow = false          // copa recebendo sombra de copa é só ruído
    m.frustumCulled = false
    group.add(m)
  }

  const m4 = new THREE.Matrix4()
  const pos = new THREE.Vector3()
  const qua = new THREE.Quaternion()
  const eul = new THREE.Euler()
  const esc = new THREE.Vector3()
  const eixoY = new THREE.Vector3(0, 1, 0)
  const y0 = mudas.map((m) => o.heightAt(m.x, m.z))
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0)

  // ── a cor por instância entra UMA VEZ, no balde de longe e no de perto ─────
  // ⚠️ instanceColor MULTIPLICA a cor por vértice, não a substitui: o tronco
  // continua tronco e o torrão continua terra, e o tinte inclina os três juntos,
  // que é como a luz de um lugar se comporta. Por isso o tinte é quase neutro
  // (0,74 a 1,26 por canal) em vez de uma cor cheia.
  if (look2) {
    for (const m of Object.values(malhas)) {
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(m.count * 3).fill(1), 3)
    }
  }

  // ⚠️ O BALDE DE PERTO PASSOU A SER O DOS MAIS PERTO, E ANTES NÃO ERA. O laço
  // preenchia `cheiaEsfera` na ordem do vetor até bater o teto: quando o teto
  // mordia, quem levava a copa cheia era quem tinha sido PLANTADO primeiro, não
  // quem estava perto da câmera, e sobrava cruz de 8 triângulos a 40 m do olho.
  // O conserto é um histograma de 48 baldes de distância (duas passadas O(n), sem
  // ordenar 34 mil): ele devolve o raio em que a contagem enche o teto, e o teto
  // vira um raio em vez de uma ordem de chegada.
  const BINS = 48
  const binW = R_CHEIA / BINS
  const histE = new Int32Array(BINS), histC = new Int32Array(BINS)
  const corte = (h: Int32Array) => {
    let acc = 0
    for (let b = 0; b < BINS; b++) { acc += h[b]; if (acc > CAP_CHEIA) return b * binW }
    return R_CHEIA
  }

  let ultima = new THREE.Vector3(1e9, 1e9, 1e9)
  let cheias = 0
  const rebalancear = (cam: THREE.Vector3) => {
    histE.fill(0); histC.fill(0)
    for (let k = 0; k < mudas.length; k++) {
      const m = mudas[k]
      const d = Math.hypot(m.x - cam.x, m.z - cam.z)
      if (d >= R_CHEIA) continue
      const b = Math.min(BINS - 1, (d / binW) | 0)
      if (m.forma === 'esfera') histE[b]++; else histC[b]++
    }
    const rE = corte(histE), rC = corte(histC)
    const rE2 = rE * rE, rC2 = rC * rC

    let iCE = 0, iCC = 0, iXE = 0, iXC = 0
    for (let k = 0; k < mudas.length; k++) {
      const m = mudas[k]
      const dx = m.x - cam.x, dz = m.z - cam.z
      const d2 = dx * dx + dz * dz
      pos.set(m.x, y0[k], m.z)
      if (m.tomboX || m.tomboZ) {
        eul.set(m.tomboX, m.giro, m.tomboZ, 'YXZ')
        qua.setFromEuler(eul)
      } else qua.setFromAxisAngle(eixoY, m.giro)
      esc.set(m.esc * m.escXZ, m.esc * m.escY, m.esc * m.escXZ)
      m4.compose(pos, qua, esc)
      if (m.forma === 'esfera') {
        if (d2 < rE2 && iCE < CAP_CHEIA) {
          if (m.tint) malhas.cheiaEsfera.setColorAt(iCE, m.tint)
          malhas.cheiaEsfera.setMatrixAt(iCE++, m4)
        } else {
          if (m.tint) malhas.cruzEsfera.setColorAt(iXE, m.tint)
          malhas.cruzEsfera.setMatrixAt(iXE++, m4)
        }
      } else {
        if (d2 < rC2 && iCC < CAP_CHEIA) {
          if (m.tint) malhas.cheiaCone.setColorAt(iCC, m.tint)
          malhas.cheiaCone.setMatrixAt(iCC++, m4)
        } else {
          if (m.tint) malhas.cruzCone.setColorAt(iXC, m.tint)
          malhas.cruzCone.setMatrixAt(iXC++, m4)
        }
      }
    }
    for (let k = iCE; k < CAP_CHEIA; k++) malhas.cheiaEsfera.setMatrixAt(k, ZERO)
    for (let k = iCC; k < CAP_CHEIA; k++) malhas.cheiaCone.setMatrixAt(k, ZERO)
    malhas.cruzEsfera.count = iXE
    malhas.cruzCone.count = iXC
    for (const m of Object.values(malhas)) {
      m.instanceMatrix.needsUpdate = true
      if (m.instanceColor) m.instanceColor.needsUpdate = true
    }
    cheias = iCE + iCC
  }
  rebalancear(new THREE.Vector3(0, 0, 0))

  const triangulos =
    nEsf * 8 + nCon * 8 + CAP_CHEIA * TRI_ESF + CAP_CHEIA * TRI_CON

  console.log(
    `[arborização] ${mudas.length.toLocaleString('pt-BR')} árvores: ` +
    `${daCova.toLocaleString('pt-BR')} de cova, ${doBulevar.toLocaleString('pt-BR')} de bulevar, ` +
    `${doAnel.toLocaleString('pt-BR')} de anel, ${doContorno.toLocaleString('pt-BR')} de contorno; ` +
    `${rejVia.toLocaleString('pt-BR')} recusadas pela máscara de via` +
    `${naVia ? '' : ' (MÁSCARA AUSENTE: o campo `naVia` não chegou por opts)'}` +
    `; copa cheia ${TRI_ESF}/${TRI_CON} triângulos, look ${look2 ? 2 : 1}`,
  )

  return {
    group,
    arvores: mudas.length,
    get cheias() { return cheias },
    triangulos,
    /** ⚠️ SÓ REFAZ OS BALDES QUANDO A CÂMERA ANDOU 150 m. Rebalancear por quadro
     *  é O(40.000) e a spec marcou o custo disso como não medido; árvore não se
     *  mexe, e a diferença entre cruz e copa a 400 m não muda em meio quarteirão. */
    update(cam: THREE.Vector3) {
      if (cam.distanceToSquared(ultima) < PASSO_REBALANCE * PASSO_REBALANCE) return
      ultima = cam.clone()
      rebalancear(cam)
    },
    dispose() {
      for (const m of Object.values(malhas)) { m.geometry.dispose(); m.dispose() }
      mat.dispose()
      group.clear()
    },
  }
}
