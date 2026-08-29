// ═══════════════════════════════════════════════════════════════════════════
// A ARBORIZAÇÃO: o verde da DogCity, que até 29/08/2026 não existia fora do
// raio 910 da praça central.
//
// ⚠️ O DIAGNÓSTICO. O levantamento mediu a cena com ?tecido=1 e escreveu a frase
// que originou este arquivo: "NÃO EXISTE UM ADEREÇO sobre os 20 km2 de lotes;
// todo entourage (34 GLBs) fica no raio 910 da praça". Um loteamento sem árvore
// é um desenho de CAD, não uma maquete: falta a única coisa que dá escala humana
// a uma quadra de 168 m vista de 1.900 m.
//
// ⚠️ A COPA NÃO DESENHA POR VALOR, DESENHA POR SOMBRA, e isso manda em todo o
// módulo (maquete-spec.md §4.1). O verde #7E8A6B contra a calçada #CBC4B6 mede
// 2,11:1 e contra o lote #A39D91 mede 1,43:1: de cima a copa quase não existe
// como mancha. O que existe é a SOMBRA. Com o sol a 32 graus (o perfil `maquete`
// da §6.1) uma árvore de 7,0 m projeta 7,0/tan(32) = 11,2 m, que mede 2,11 px a
// 6.213 m: a fileira vira uma tracejada escura ao lado da calçada, que é como
// alinhamento de árvore aparece numa aérea de verdade. Por isso a elevação do sol
// é 32 e não 16 (sombra de 24,4 m, as sombras se emendam numa mancha) nem 44
// (7,25 m, some). E por isso castShadow é true e receiveShadow é false: sombra
// projetada por um blob de 30 triângulos sobre outro blob de 30 triângulos é
// custo sem imagem.
//
// ⚠️ ÁRVORE AQUI É PRIMITIVA DO THREE, NÃO GLB, e é decisão medida (§0, D7). Cada
// GLB de árvore em public/city/sf/ traz de 1 a 5 materiais (palm-date tem 4,
// tree-palm tem 5) e props.ts:45-110 cria um InstancedMesh POR PARTE: uma espécie
// vira de 2 a 5 draw calls e de 2 a 5 programas POR NÍVEL DE LOD. Com 4 níveis
// isso são 8 a 20 chamadas para um objeto que mede 15 px na chapa mais próxima.
// Os 34 GLBs continuam servindo a praça central no raio 910, sem nenhuma mudança,
// e nenhum crédito novo foi preciso em sf-assets.ts porque nada novo foi baixado.
//
// Toda a geometria de plantio sai de public/city/cidade-malha.json (a mesma fonte
// de vias.ts) e das covas que pracas.ts publica. Nada aqui é inventado: se o
// gerador mudar a malha, a arborização anda junto.
//
// Three.js puro (regra da casa: nada de react-three-fiber).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { PARK_CENTER, PARK_CORE } from './park-site'
import type { Cova } from './pracas'

/** O DistanceCuller de perf.ts satisfaz esta forma. É tipo estrutural de
 *  propósito: seis frentes editam módulos vizinhos ao mesmo tempo e um import de
 *  classe amarraria este arquivo à assinatura exata de perf.ts. */
export interface Culler {
  add(o: THREE.Object3D, maxDist: number, center?: THREE.Vector3): void
}

/** Só os campos que este módulo lê do PerfProfile de perf.ts. */
export interface PerfilLido {
  quality?: string
  smallCull?: number
}

export interface ArborizacaoOpts {
  /** ⚠️ é o `terrain.superficieAt` que a cena passa, NUNCA uma função nova: quem
   *  desenha sobre o chão tem de assentar na MALHA que a câmera vê. A nota longa
   *  com a medição está em terrain.ts, na interface. */
  heightAt: (x: number, z: number) => number
  /** as covas que buildPracas devolve. Sem elas as 128 praças ficam sem árvore e
   *  o módulo avisa no log; ele NÃO inventa cova própria (§0, D8: a praça marca a
   *  cova, plantar por grade própria planta em cima de sebe e de espelho d'água). */
  covas?: Cova[]
  /** a malha já carregada; se não vier, o módulo busca /city/cidade-malha.json */
  malha?: Malha
  profile?: PerfilLido
  culler?: Culler
  sombra?: boolean
  /** aceito e IGNORADO: árvore aqui é primitiva, não GLB (§0, D7). Existe só para
   *  o integrador poder passar o mesmo objeto de opções dos outros módulos. */
  gltf?: unknown
}

export interface Arborizacao {
  group: THREE.Group
  arvores: number
  triangulos: number
  /** Rebalanceia os baldes cheia/cruz em volta da câmera. O módulo já se dirige
   *  sozinho pelo onBeforeRender da malha de cruzes, então chamar isto no laço é
   *  opcional; se o integrador chamar, o efeito é o mesmo (a guarda de 120 m
   *  torna a chamada idempotente). */
  update(cam: THREE.Vector3): void
  dispose(): void
}

// ── COTAS ────────────────────────────────────────────────────────────────────
// ⚠️ ESTES TRÊS NÚMEROS SÃO CÓPIA E TÊM DE CONTINUAR SENDO. Y_CALCADA e
// Y_CANTEIRO são de vias.ts:52-54 e Y_COVA é o Y_L3 de pracas.ts:58, e nenhum dos
// dois exporta as constantes. A árvore nasce no PISO em que ela está plantada, e
// não no terreno: uma árvore em heightAt+0 na calçada de 0,33 aparece afundada
// até o joelho, e na chapa de pedestre isso é o primeiro erro que se vê. A §0/D1
// da spec garante que as três cotas não mudam nesta rodada.
const Y_CALCADA = 0.33
const Y_CANTEIRO = 0.40
const Y_COVA = 0.44

// ── PALETA (maquete-spec.md §1.1 e §1.2) ─────────────────────────────────────
// UM verde na cidade inteira. Os quatro verdes antigos (#4A5C3E canteiro,
// #3E5F42 grama, #2F4A34 sebe, #3F6B44 campo) morrem nos módulos deles.
const COR_COPA = '#7E8A6B'
const COR_TRONCO = '#6E685C'

// ── DIMENSÕES DAS DUAS FORMAS (§4.1) ─────────────────────────────────────────
const ESF_ALT = 7.0        // altura total, com jitter de +-0,9 m
const ESF_JIT = 0.9
const ESF_RAIO = 2.6       // copa de 5,2 m de diâmetro
const ESF_ACHATA = 0.82    // a copa é achatada em y: bola perfeita lê como bolinha
const ESF_TRONCO = 3.4
const CON_ALT = 11.0       // altura total, com jitter de +-1,2 m
const CON_JIT = 1.2
const CON_RAIO = 2.4       // copa de 4,8 m de diâmetro

// ── ONDE PLANTA, com espaçamento de fonte primária (§4.2) ────────────────────
// Os três espaçamentos saem de manual de rua, não de gosto:
//   7,6 m  = 25 ft, Portland, faixas C, CC, D, DC, F, FU (bulevar)
//   9,1 m  = 30 ft, Portland, faixas E, G, GU (via de contorno, rua estreita)
//   1,07 m = 3 ft 6 in, Seattle, eixo da árvore à face do meio-fio
//   10,7 m = 35 ft, NYC, recuo da árvore ao meio-fio da transversal na esquina
const PASSO_BULEVAR = 7.6
const PASSO_CONTORNO = 9.1
const RECUO_MEIOFIO = 1.07
const RECUO_ESQUINA = 10.7
// Seção do bulevar (vias.ts:85-91): 5 calçada, 10 pista, 4 canteiro, 10 pista, 5
// calçada. A face do meio-fio está em t=5 e t=29; a árvore fica 1,07 m dentro da
// calçada. O canteiro central vai de 15 a 19, então o eixo é t=17.
const BUL_T_CALCADA_A = 5.0 - RECUO_MEIOFIO   // 3,93
const BUL_T_CALCADA_B = 29.0 + RECUO_MEIOFIO  // 30,07
const BUL_T_CANTEIRO = 17.0
// Seção do contorno (vias.ts:73-76): 2,5 calçada, 3,5 pista, e cada quarteirão
// desenha só a sua metade. A face do meio-fio está em t=2,5 medido da borda do
// quarteirão, então a árvore fica em t=1,43 (dentro da calçada).
const CTR_T = 2.5 - RECUO_MEIOFIO             // 1,43

// ⚠️ UM LADO POR QUARTEIRÃO, NÃO OS DOIS, E ISSO É DECISÃO, NÃO ECONOMIA (§4.2).
// Os dois lados dariam 36.142 árvores só no contorno e 52.961 no total, o que
// estoura o teto duro sozinho. Plantio unilateral em rua estreita de 7,0 m de
// pista é padrão urbano real, e a referência de maquete é explícita: RJ Models
// entrega masterplan de venda com "entourage muito limitado".
const LADO_LOCAL_Z = +1

/** teto duro de instâncias (§4.2). Estourar isto é reprovar o critério 18. */
const TETO = 36000

// ── LOD (§4.3) ───────────────────────────────────────────────────────────────
const RAIO_CHEIA = 400
/** ⚠️ O REBALANCEAMENTO POR QUADRO NÃO ESTÁ MEDIDO e a spec (§4.3) manda medir
 *  antes de bater o martelo. Em vez de apostar, este módulo já nasce com a
 *  RECEITA DE FALLBACK dela: os baldes só se refazem quando a câmera anda mais de
 *  120 m, e o trabalho por refação é limitado pelas capacidades abaixo (no pior
 *  caso 1.820 matrizes recompostas), não pelas 35 mil árvores. */
const PASSO_REFAZ = 120
const CAP_CHEIA_ESFERA = 1400
const CAP_CHEIA_CONE = 420
/** célula da grade de busca: com raio de 400 m varre 5x5 células e nunca a cidade */
const CELULA = 256

// ── tipos da malha (os mesmos campos que vias.ts lê) ─────────────────────────
interface Quarteirao {
  id: string; setor: number; x: number; z: number; r: number
  giro: number; lado: number; lotes: number
}
interface Bulevar {
  id: string; rumo: number; largura: number
  x0: number; z0: number; x1: number; z1: number
}
interface Peca { x: number; z: number; a: number; b: number; rot: number }
export interface Malha {
  constantes: { setores: number; quarteirao: number; bulevar: number }
  bulevares: Bulevar[]
  quarteiroes: Quarteirao[]
}

/** ruído determinístico: a cidade é a mesma em toda visita, e o alinhamento do
 *  critério 16 depende de o jitter ser de ALTURA e de giro, nunca de posição. */
function hash01(i: number, sal: number): number {
  let h = 2166136261 ^ Math.imul(sal, 16777619)
  h = Math.imul(h ^ i, 16777619)
  h ^= h >>> 13
  h = Math.imul(h, 16777619)
  return ((h >>> 0) % 100000) / 100000
}

/** toNonIndexed() numa geometria já não indexada só imprime aviso no console */
function planificada(g: THREE.BufferGeometry): THREE.BufferGeometry {
  return g.index ? g.toNonIndexed() : g
}

/** pinta a geometria por altura: abaixo de yCorte é tronco, acima é copa. Uma
 *  BufferGeometry com cor por vértice é o que permite UM material para as duas
 *  formas e os dois níveis de LOD (§4.1). */
function pinta(geo: THREE.BufferGeometry, yCorte: number): THREE.BufferGeometry {
  const pos = geo.getAttribute('position')
  const cor = new Float32Array(pos.count * 3)
  const baixo = new THREE.Color(COR_TRONCO)
  const alto = new THREE.Color(COR_COPA)
  for (let i = 0; i < pos.count; i++) {
    const c = pos.getY(i) < yCorte ? baixo : alto
    cor[i * 3] = c.r; cor[i * 3 + 1] = c.g; cor[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cor, 3))
  if (geo.getAttribute('uv')) geo.deleteAttribute('uv')
  return geo
}

/** ESFERA cheia: 20 triângulos de copa + 10 de tronco = 30 (§4.1). */
function geoEsferaCheia(): THREE.BufferGeometry {
  // a copa fica com o topo em ESF_ALT: centro = 7,0 - 2,6*0,82 = 4,868
  const copa = planificada(new THREE.IcosahedronGeometry(ESF_RAIO, 0))
  copa.scale(1, ESF_ACHATA, 1)
  copa.translate(0, ESF_ALT - ESF_RAIO * ESF_ACHATA, 0)
  // ⚠️ openEnded: sem as tampas o cilindro custa 10 triângulos em vez de 20, e as
  // duas tampas ficam uma no chão e outra DENTRO da copa: ninguém as vê nunca.
  const tronco = planificada(new THREE.CylinderGeometry(0.18, 0.26, ESF_TRONCO, 5, 1, true))
  tronco.translate(0, ESF_TRONCO / 2, 0)
  const g = mergeGeometries([pinta(tronco, 1e9), pinta(copa, ESF_TRONCO)], false)!
  copa.dispose(); tronco.dispose()
  g.computeVertexNormals()
  return g
}

/** CONE cheio: 6 triângulos de lateral + 6 de tampa = 12 (§4.1). */
function geoConeCheia(): THREE.BufferGeometry {
  const g = planificada(new THREE.ConeGeometry(CON_RAIO, CON_ALT, 6, 1, false))
  g.translate(0, CON_ALT / 2, 0)  // pivô no pé
  // só o anel da base é tronco: a cor sobe do escuro para o verde ao longo do
  // fuste, que é o que faz um cone de 6 lados não ler como cone de papel
  return pinta(g, 0.01)
}

/** Emite um quad plano com a normal apontando para `n`, conferindo o sentido.
 *  ⚠️ ARMADILHA 4 DA SPEC, que já custou uma rodada inteira em pracas.ts: quad com
 *  os cantos no sentido errado tem a normal invertida e o backface culling apaga a
 *  face inteira. Aqui o sentido é CONFERIDO em vez de confiado. */
function quadOrientado(
  vs: number[], ix: number[], cs: number[], ns: number[],
  cantos: [number, number, number][], cores: THREE.Color[], n: THREE.Vector3,
) {
  const b = vs.length / 3
  const ab = new THREE.Vector3(...cantos[1]).sub(new THREE.Vector3(...cantos[0]))
  const ac = new THREE.Vector3(...cantos[2]).sub(new THREE.Vector3(...cantos[0]))
  const inverte = ab.cross(ac).dot(n) < 0
  const ordem = inverte ? [0, 3, 2, 1] : [0, 1, 2, 3]
  // ⚠️ A NORMAL DE SOMBREADO NÃO É A NORMAL GEOMÉTRICA, E ISSO FOI MEDIDO NUMA
  // CHAPA. Um quad vertical tem normal HORIZONTAL, e com o sol a 32 graus ela
  // recebe cos(32)=0,85 de lado enquanto a copa cheia recebe o sol por cima: na
  // primeira chapa (scratchpad/arb-quarteirao.png) as árvores além dos 400 m
  // ficaram visivelmente MAIS ESCURAS que as de perto, e na aérea isso vira um
  // anel de copa escura em volta da câmera, que reprova o critério 10 ("um verde
  // só"). A correção é de graça: a normal aponta para fora E PARA CIMA, como se o
  // quad fosse a casca de uma copa. O PAR FOI MEDIDO EM TRÊS RODADAS de chapa,
  // com a luminância média dos pixels verdes de cada faixa (PIL, HSV, S > 0,14 e
  // matiz 0,15 a 0,30): normal horizontal pura dá copa cheia 112,9 contra cruz
  // 85,4, um degrau de 27,5 níveis; (0,60 / 0,80) inverte para 112,9 contra 134,0,
  // degrau de -21,1; (0,90 / 0,42) dá +3,3; (0,85 / 0,50) dá 112,9 contra 114,3,
  // DEGRAU DE 1,4 NÍVEL EM 255, ou seja a troca de LOD deixa de aparecer.
  const nb = new THREE.Vector3(n.x * 0.85, 0.50, n.z * 0.85).normalize()
  for (const k of ordem) {
    vs.push(cantos[k][0], cantos[k][1], cantos[k][2])
    cs.push(cores[k].r, cores[k].g, cores[k].b)
    ns.push(nb.x, nb.y, nb.z)
  }
  ix.push(b, b + 1, b + 2, b, b + 2, b + 3)
}

/** Nível distante: 3 quads cruzados, 6 triângulos, que leem de qualquer ângulo
 *  (§4.3). Um disco plano some na rasante e por isso está fora.
 *
 *  ⚠️ OS TRÊS PLANOS FICAM A 0, 120 E 240 GRAUS, NÃO A 0, 60 E 120. O material é
 *  FrontSide (DoubleSide dobraria o fragmento de 200 mil triângulos por nada), e a
 *  frente de um plano cobre 180 graus de azimute. Com 0/60/120 a união cobre de 0 a
 *  300 e sobra uma fatia de 60 graus de onde a árvore SOME. Com 0/120/240 a união
 *  fecha os 360 e de qualquer direção se veem uma ou duas faces.
 *
 *  ⚠️ E O RECORTE NÃO É RETÂNGULO. Um retângulo de 5,2 x 4,26 só na copa deixa a
 *  copa BOIANDO 2,74 m acima do chão, e a 400 m (a troca) esses 2,74 m medem 8 px:
 *  a árvore pula quando o LOD vira. Um retângulo do chão ao topo vira uma laje
 *  escura larga demais. A pipa (base no pé, largura máxima na altura do centro da
 *  copa, ponta no topo) é a silhueta de uma bola em haste e não pula. */
function geoCruz(forma: 'esfera' | 'cone'): THREE.BufferGeometry {
  const vs: number[] = [], ix: number[] = [], cs: number[] = [], ns: number[] = []
  const tronco = new THREE.Color(COR_TRONCO)
  const copa = new THREE.Color(COR_COPA)
  const alt = forma === 'esfera' ? ESF_ALT : CON_ALT
  const raio = forma === 'esfera' ? ESF_RAIO : CON_RAIO
  const meio = forma === 'esfera' ? ESF_ALT - ESF_RAIO * ESF_ACHATA : 0
  for (let k = 0; k < 3; k++) {
    const a = (k * 2 * Math.PI) / 3
    const n = new THREE.Vector3(Math.cos(a), 0, Math.sin(a))
    const u = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a))
    const P = (s: number, h: number): [number, number, number] => [u.x * s, h, u.z * s]
    if (forma === 'esfera') {
      quadOrientado(vs, ix, cs, ns,
        [P(0, 0), P(-raio, meio), P(0, alt), P(raio, meio)],
        [tronco, copa, copa, copa], n)
    } else {
      // o cone é um fuste: base larga no chão, quase ponta no topo
      quadOrientado(vs, ix, cs, ns,
        [P(-raio, 0), P(raio, 0), P(0.35, alt), P(-0.35, alt)],
        [tronco, tronco, copa, copa], n)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(vs, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(ns, 3))
  g.setIndex(ix)
  return g
}

export async function buildArborizacao(o: ArborizacaoOpts): Promise<Arborizacao> {
  const [malha, meta] = await Promise.all([
    o.malha ?? fetch('/city/cidade-malha.json').then((r) => r.json() as Promise<Malha>),
    fetch('/city/cidade.json').then((r) => r.json() as Promise<{ programa: Peca[]; raioBorda: number }>),
  ])
  const K = malha.constantes
  const group = new THREE.Group()
  group.name = 'arborizacao'

  // ── as três máscaras, as mesmas de vias.ts mais o parque ───────────────────
  // (1) as 38 peças do programa: rua não atravessa lago (vias.ts:139-156) e
  //     árvore também não. As covas de pracas.ts já vêm filtradas por esta mesma
  //     máscara, mas o plantio de rua não.
  const pecas = (meta.programa ?? []).map((p) => {
    const rot = (-p.rot * Math.PI) / 180
    return { x: p.x, z: p.z, a: p.a, b: p.b, ca: Math.cos(rot), sa: Math.sin(rot), rr: Math.max(p.a, p.b) ** 2 }
  })
  const emPeca = (px: number, pz: number) => {
    for (const p of pecas) {
      const dx = px - p.x, dz = pz - p.z
      if (dx * dx + dz * dz > p.rr) continue
      const lx = dx * p.ca - dz * p.sa, lz = dx * p.sa + dz * p.ca
      if ((lx / p.a) ** 2 + (lz / p.b) ** 2 <= 1) return true
    }
    return false
  }
  // (2) o corredor dos 12 bulevares. Na costura a grade de um setor não casa com
  //     a do vizinho, e vias.ts já corta a via de contorno ali: uma árvore de
  //     contorno nesse corredor ficaria de pé no meio da pista do bulevar.
  const meiaBul = K.bulevar / 2 + 3
  const noBulevar = (px: number, pz: number) => {
    const r = Math.hypot(px, pz)
    if (r < 40) return true
    for (let s = 0; s < K.setores; s++) {
      const ang = (s * (2 * Math.PI)) / K.setores
      const dirX = Math.sin(ang), dirZ = -Math.cos(ang)
      if (px * dirX + pz * dirZ <= 0) continue
      if (Math.abs(px * Math.cos(ang) + pz * Math.sin(ang)) < meiaBul) return true
    }
    return false
  }
  // (3) ⚠️ O PARQUE RUNESTONE, QUE É UMA COVA DE VERDADE. terrain.ts:167-181
  //     rebaixa o regolito até -144,86 m em todo o raio PARK_CORE (3.100 m) em
  //     volta de PARK_CENTER (3.546, -3.802), o que come boa parte dos setores 1 e
  //     2. Árvore plantada ali nasce dentro do buraco e o parque tem paleta
  //     própria de obsidiana: não se planta lá (§4.4).
  const noParque = (px: number, pz: number) =>
    Math.hypot(px - PARK_CENTER.x, pz - PARK_CENTER.z) < PARK_CORE
  const rMax = meta.raioBorda ?? 4400

  // ── o plantio: duas listas paralelas, uma por forma ────────────────────────
  type Lista = { x: number[]; y: number[]; z: number[]; s: number[]; yaw: number[] }
  const nova = (): Lista => ({ x: [], y: [], z: [], s: [], yaw: [] })
  const listas: [Lista, Lista] = [nova(), nova()]   // 0 = esfera, 1 = cone
  const contas = { covas: 0, canteiro: 0, calcada: 0, contorno: 0, corte: 0 }
  let total = 0

  const planta = (forma: 0 | 1, x: number, z: number, cota: number): boolean => {
    if (total >= TETO) { contas.corte++; return false }
    const L = listas[forma]
    const i = L.x.length
    const sal = forma === 0 ? 7 : 13
    const alt = forma === 0 ? ESF_ALT : CON_ALT
    const jit = forma === 0 ? ESF_JIT : CON_JIT
    // escala UNIFORME pela razão de altura: a copa cresce junto com o tronco, que
    // é o que uma árvore faz. Jitter só de altura e de giro, nunca de posição: o
    // critério 16 pede que nenhum tronco fuja 2 px do eixo da fileira.
    L.x.push(x); L.z.push(z)
    L.y.push(o.heightAt(x, z) + cota)
    L.s.push((alt + (hash01(i, sal) - 0.5) * 2 * jit) / alt)
    L.yaw.push(hash01(i, sal + 1) * Math.PI * 2)
    total++
    return true
  }

  // 1. as covas das praças (§0, D8: a praça marca a cova, não a árvore) ───────
  if (o.covas && o.covas.length) {
    for (const c of o.covas) {
      if (Math.hypot(c.x, c.z) > rMax || noParque(c.x, c.z)) continue
      if (planta(0, c.x, c.z, Y_COVA)) contas.covas++
    }
  } else {
    console.warn('[arborização] sem covas: as praças ficam sem árvore. buildPracas tem de subir ANTES e passar pr.covas (maquete-spec.md §0/D8)')
  }

  // 2. os 12 bulevares: cone no canteiro central, esfera nas duas calçadas ────
  for (const b of malha.bulevares) {
    const ang = (b.rumo * Math.PI) / 180
    const perpX = Math.cos(ang), perpZ = Math.sin(ang)
    const larg = b.largura ?? K.bulevar
    const esc = larg / 34
    const comp = Math.hypot(b.x1 - b.x0, b.z1 - b.z0)
    const dirX = (b.x1 - b.x0) / comp, dirZ = (b.z1 - b.z0) / comp
    const passos = Math.floor(comp / PASSO_BULEVAR)
    for (let k = 0; k <= passos; k++) {
      const d = k * PASSO_BULEVAR
      const bx = b.x0 + dirX * d, bz = b.z0 + dirZ * d
      const pos = (t: number): [number, number] => {
        const off = (t * esc) - larg / 2
        return [bx + perpX * off, bz + perpZ * off]
      }
      const [cx, cz] = pos(BUL_T_CANTEIRO)
      if (!emPeca(cx, cz) && !noParque(cx, cz) && Math.hypot(cx, cz) <= rMax) {
        if (planta(1, cx, cz, Y_CANTEIRO)) contas.canteiro++
      }
      for (const t of [BUL_T_CALCADA_A, BUL_T_CALCADA_B]) {
        const [ax, az] = pos(t)
        if (emPeca(ax, az) || noParque(ax, az) || Math.hypot(ax, az) > rMax) continue
        if (planta(0, ax, az, Y_CALCADA)) contas.calcada++
      }
    }
  }

  // 3. a via de contorno, UM LADO por quarteirão com lote ────────────────────
  // Os 119 quarteirões sem lote não recebem alinhamento: eles são as reservas
  // públicas que pracas.ts desenha em chão verde (§4.4), e alinhar rua em volta de
  // reserva é mobiliar terreno que ainda não foi alocado.
  const meio = K.quarteirao / 2
  for (const q of malha.quarteiroes) {
    if (q.lotes <= 0) continue
    const g = (q.giro * Math.PI) / 180
    const cg = Math.cos(g), sg = Math.sin(g)
    const lz = LADO_LOCAL_Z * (meio + CTR_T)
    const meiaFaixa = meio - RECUO_ESQUINA
    const n = Math.floor((meiaFaixa * 2) / PASSO_CONTORNO)
    const inicio = -(n * PASSO_CONTORNO) / 2
    for (let k = 0; k <= n; k++) {
      const lx = inicio + k * PASSO_CONTORNO
      const wx = q.x + lx * cg - lz * sg
      const wz = q.z + lx * sg + lz * cg
      if (Math.hypot(wx, wz) > rMax) continue
      if (emPeca(wx, wz) || noBulevar(wx, wz) || noParque(wx, wz)) continue
      if (planta(0, wx, wz, Y_CALCADA)) contas.contorno++
    }
  }

  // ── UM material para as quatro malhas (§4.1 e §8.1: +1 material, 1 programa) ─
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.95, metalness: 0,
  })
  mat.name = 'arborizacao'

  const geos: THREE.BufferGeometry[] = [
    geoEsferaCheia(), geoConeCheia(), geoCruz('esfera'), geoCruz('cone'),
  ]
  const triPorInst = geos.map((g) => (g.index ? g.index.count : g.getAttribute('position').count) / 3)

  const baixa = (o.profile?.quality ?? '') === 'low'
  const raioCheia = baixa ? 200 : RAIO_CHEIA
  const caps: [number, number] = [
    Math.min(CAP_CHEIA_ESFERA, listas[0].x.length),
    Math.min(CAP_CHEIA_CONE, listas[1].x.length),
  ]

  const malhas: THREE.InstancedMesh[] = []
  const nomes = ['arvore:esfera:cheia', 'arvore:cone:cheia', 'arvore:esfera:cruz', 'arvore:cone:cruz']
  for (let k = 0; k < 4; k++) {
    const conta = k < 2 ? caps[k] : listas[k - 2].x.length
    const im = new THREE.InstancedMesh(geos[k], mat, Math.max(1, conta))
    im.name = nomes[k]
    // ⚠️ castShadow É O MÓDULO INTEIRO: a copa não desenha por valor, desenha pela
    // sombra (ver o cabeçalho). receiveShadow fica false porque sombra sobre um
    // blob de 30 triângulos é fragmento gasto sem imagem.
    im.castShadow = o.sombra ?? true
    im.receiveShadow = false
    im.frustumCulled = false
    im.count = conta
    group.add(im)
    malhas.push(im)
  }
  const [cheiaEsf, cheiaCon, cruzEsf, cruzCon] = malhas
  const cheias: [THREE.InstancedMesh, THREE.InstancedMesh] = [cheiaEsf, cheiaCon]
  const cruzes: [THREE.InstancedMesh, THREE.InstancedMesh] = [cruzEsf, cruzCon]

  // ── as matrizes ────────────────────────────────────────────────────────────
  const M = new THREE.Matrix4()
  const P = new THREE.Vector3()
  const Q = new THREE.Quaternion()
  const S = new THREE.Vector3()
  const EIXO = new THREE.Vector3(0, 1, 0)
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0)
  const compoe = (f: 0 | 1, i: number): THREE.Matrix4 => {
    const L = listas[f]
    P.set(L.x[i], L.y[i], L.z[i])
    Q.setFromAxisAngle(EIXO, L.yaw[i])
    S.setScalar(L.s[i])
    return M.compose(P, Q, S)
  }
  for (const f of [0, 1] as const) {
    for (let i = 0; i < listas[f].x.length; i++) cruzes[f].setMatrixAt(i, compoe(f, i))
    cruzes[f].instanceMatrix.needsUpdate = true
  }

  // ── a grade de busca: 5x5 células de 256 m, nunca a cidade inteira ─────────
  const grades: [Map<number, number[]>, Map<number, number[]>] = [new Map(), new Map()]
  const chave = (ix: number, iz: number) => (ix + 128) * 512 + (iz + 128)
  for (const f of [0, 1] as const) {
    const L = listas[f]
    for (let i = 0; i < L.x.length; i++) {
      const k = chave(Math.floor(L.x[i] / CELULA), Math.floor(L.z[i] / CELULA))
      const lista = grades[f].get(k)
      if (lista) lista.push(i); else grades[f].set(k, [i])
    }
  }

  // ── o rebalanceamento cheia/cruz ──────────────────────────────────────────
  // ⚠️ CUSTO POR REFAÇÃO: NAO MEDIDO. O que está medido (dossiê de técnica) é o
  // balde estático: 120.000 cruzes de 8 triângulos custam 2,3 ms de render. Aqui o
  // trabalho é limitado por construção: no pior caso 1.820 matrizes recompostas e
  // um upload de instanceMatrix, e só quando a câmera anda 120 m.
  const zerados: [number[], number[]] = [[], []]
  const ultima = new THREE.Vector3(NaN, NaN, NaN)
  const cand: { i: number; d: number }[] = []
  const update = (cam: THREE.Vector3) => {
    if (ultima.x === ultima.x && cam.distanceToSquared(ultima) < PASSO_REFAZ * PASSO_REFAZ) return
    ultima.copy(cam)
    const r2 = raioCheia * raioCheia
    const c0 = Math.floor(cam.x / CELULA), c1 = Math.floor(cam.z / CELULA)
    const alcance = Math.ceil(raioCheia / CELULA)
    for (const f of [0, 1] as const) {
      const L = listas[f]
      // devolve à cruz quem estava promovido
      for (const i of zerados[f]) cruzes[f].setMatrixAt(i, compoe(f, i))
      zerados[f].length = 0
      cand.length = 0
      for (let ix = c0 - alcance; ix <= c0 + alcance; ix++) {
        for (let iz = c1 - alcance; iz <= c1 + alcance; iz++) {
          const lista = grades[f].get(chave(ix, iz))
          if (!lista) continue
          for (const i of lista) {
            const dx = L.x[i] - cam.x, dy = L.y[i] - cam.y, dz = L.z[i] - cam.z
            const d = dx * dx + dy * dy + dz * dz
            if (d <= r2) cand.push({ i, d })
          }
        }
      }
      // se passar da capacidade ficam as mais PRÓXIMAS: a que vira cruz por falta
      // de vaga está longe, e é onde a troca não se vê
      if (cand.length > caps[f]) cand.sort((a, b) => a.d - b.d)
      const n = Math.min(cand.length, caps[f])
      for (let k = 0; k < n; k++) {
        const i = cand[k].i
        cheias[f].setMatrixAt(k, compoe(f, i))
        cruzes[f].setMatrixAt(i, ZERO)
        zerados[f].push(i)
      }
      cheias[f].count = n
      cheias[f].instanceMatrix.needsUpdate = true
      cruzes[f].instanceMatrix.needsUpdate = true
    }
  }
  update(new THREE.Vector3(0, 400, 0))

  // ⚠️ O MÓDULO SE DIRIGE SOZINHO, porque plaza-scene.tsx não é dele. O laço da
  // cena chama culler.update(camera.position) e mais nada; para não depender de o
  // integrador acrescentar uma linha, o rebalanceamento pega carona no
  // onBeforeRender da malha de cruzes, que tem frustumCulled=false e por isso
  // desenha em todo quadro. A GUARDA DE CÂMERA É OBRIGATÓRIA: o mapa de sombra
  // renderiza a cena inteira de novo com a câmera ORTOGRÁFICA da luz direcional, e
  // sem a guarda o balde se refaria em volta do sol e a cidade inteira ficaria em
  // LOD distante.
  cruzEsf.onBeforeRender = (_r, _s, camera) => {
    if (!(camera as THREE.PerspectiveCamera).isPerspectiveCamera) return
    update(camera.position)
  }

  // ── DistanceCuller ────────────────────────────────────────────────────────
  // ⚠️ AQUI O CENTRO É A ORIGEM E ISSO ESTÁ CERTO, ao contrário de props.ts:98: a
  // cidade é concêntrica em (0,0) e o anel de lotes acaba em r 4.400.
  // ⚠️ E O ALCANCE NÃO É smallCull. A vista `maqueteplano` fica a 12.000 m e é
  // justamente nela que a arborização tem de aparecer (critério 9 mede a tracejada
  // de sombra do canteiro); cortar em 3.400 apagaria a arborização de duas das
  // cinco chapas. O que este registro serve é a ÓRBITA: acima de 16 km as cruzes
  // são 200 mil triângulos invisíveis. As cheias não precisam de registro nenhum:
  // elas já se autolimitam (count = 0 quando não há árvore em 400 m).
  o.culler?.add(group, 16000, new THREE.Vector3(0, 0, 0))

  const triangulos =
    caps[0] * triPorInst[0] + caps[1] * triPorInst[1] +
    listas[0].x.length * triPorInst[2] + listas[1].x.length * triPorInst[3]

  console.log(
    `[arborização] ${total.toLocaleString('pt-BR')} árvores (teto ${TETO.toLocaleString('pt-BR')}): ` +
    `${contas.covas.toLocaleString('pt-BR')} covas de praça, ${contas.canteiro.toLocaleString('pt-BR')} canteiro de bulevar, ` +
    `${contas.calcada.toLocaleString('pt-BR')} calçada de bulevar, ${contas.contorno.toLocaleString('pt-BR')} contorno de quarteirão` +
    (contas.corte ? `, ${contas.corte.toLocaleString('pt-BR')} CORTADAS PELO TETO` : '') +
    `; ${triangulos.toLocaleString('pt-BR')} triângulos no pior caso, 4 chamadas, 1 material`,
  )

  return {
    group,
    arvores: total,
    triangulos,
    update,
    dispose() {
      cruzEsf.onBeforeRender = () => {}
      for (const g of geos) g.dispose()
      mat.dispose()
      for (const im of malhas) im.dispose()
      group.clear()
    },
  }
}
