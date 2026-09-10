// ═══════════════════════════════════════════════════════════════════════════
// A ORLA NOBRE: o plantio da alça, projeto fechado pelo paisagista em
// 10/09/2026. Duas fileiras únicas (uma espécie cada, passo regular, sem
// mistura) ladeando a avenida da alça (`AVENIDA_ALCA` em teia.ts, r 6.700,
// arco 346° a 116,5°), mais 30 nós de acesso à praia a cada ~500 m.
//
// ⚠️ ESTE MÓDULO NÃO REPROJETA A ORLA, EXECUTA. O paisagista fechou espécie,
// offset e passo; a única conta refeita aqui é ONDE o meio-fio realmente
// fica, porque a instrução veio com o valor marcado como "aproximado".
//
// ⚠️ O MEIO-FIO NÃO ESTÁ EM r 6.700. `AVENIDA_ALCA.r` é o CENTRO da via, não a
// guia: `vias.ts` desenha a seção do anel com meia largura para cada lado
// (`r0 = an.r - an.larg/2`, a mesma conta usada para todo anel da cidade), e a
// seção inteira (calçada + pista + canteiro + pista + calçada) cabe nesses
// 44 m. Logo a guia do lado da praia fica em 6.700 − 22 = 6.678, e a do lado
// das mansões em 6.700 + 22 = 6.722. A instrução chegou com "offset 5 m do
// meio-fio, ou seja r aproximado 6.705": 6.705 é 6.700 + 5, ou seja usa o
// CENTRO da via como se fosse a guia, um erro de 22 m (a mesma classe de erro
// que a memória da casa já registrou uma vez: "o consultor contou seção como
// pista"). Um r de 6.705 cairia DENTRO da segunda faixa de pista (6.702,5 a
// 6.716,1 na seção esticada), violando o próprio portão 2 deste trabalho
// ("nenhuma palmeira dentro da pista"). Este módulo usa a guia de verdade:
//     `ORLA_R_FILEIRA_A` = 6.678 − 5 = 6.673 (lado da praia)
//     `ORLA_R_FILEIRA_B` = 6.722 + 5 = 6.727 (lado das mansões)
// A REGRA ("offset 5 m do meio-fio") é o que manda; o número aproximado era
// só um chute do paisagista sobre onde o meio-fio está.
//
// ⚠️ 848 E 694 SÃO CONTAGEM, NÃO PASSO. Dividindo o comprimento do arco em
// r = 6.700 (o valor que o paisagista tinha à mão) por 18 e por 22 m batem
// exatamente 848 e 694 (15.260,2 / 18 = 847,8 → 848; / 22 = 693,6 → 694),
// confirmando que a contagem foi calculada contra a avenida, não contra a
// guia real. Aqui o passo é o que fecha exato: cada fileira recebe o número
// de unidades DADO (848 e 694) espalhado em passo REGULAR sobre o
// comprimento real do arco na guia própria de cada fileira. O desvio contra
// os 18/22 m nominais sai pequeno e consistente (ver `orlaPassoReal()`
// abaixo, ~0,08 m, a diferença de raio entre 6.673/6.727 e 6.700): é o preço
// de manter a CONTAGEM exata em vez do passo cru, e fica bem dentro de
// "alinhamento exato" pedido no portão 3.
//
// ⚠️ LOD POR DISTÂNCIA, NÃO POR BALDE FIXO. Os outros plantios da cidade
// (`arborizacao.ts`, `ilha-mata.ts`) rebalanceiam perto/longe quando a câmera
// anda mais que um limiar (150 m e 650 m, respectivamente): útil quando o
// objeto é pequeno ou fixo no mapa (uma ilha inteira, uma alameda de bairro).
// Aqui o objeto é uma LINHA DE 15,26 km: a câmera pode estar a 50 m de um
// trecho e a 12 km de outro ao mesmo tempo, e um único raio de rebalance por
// grupo não serve. A malha cheia entra numa JANELA de ±500 m ao redor da
// câmera (medido de verdade, incluindo altura: câmera a 272 m sobre o chão
// da alça vê uma faixa de arco mais curta que 500 m no plano, ver a nota em
// `JANELA_PERTO_ENTRA`); fora dela, um proxy de 12 triângulos por palmeira e
// 4 por touceira, igual para as três espécies de palmeira (só a ESCALA muda,
// pela proporção real de `MEDIDA`, o mesmo truque que o octaedro de longe de
// `ilha-mata.ts` já usa).
//
// ⚠️ TRÊS CUIDADOS COPIADOS DE `atletismo-loader.ts`, PORQUE A TÉCNICA (troca
// de malha em tempo real, não balde fixo) É NOVA NESTA CASA:
//   1. sonda no máximo 5x/s (`proximaSonda`, intervalo de 200 ms), nunca por
//      quadro: são ~1.900 indivíduos, e medir 1.900 distâncias 60x/s custaria
//      caro de graça por um dado que não muda em 16 ms.
//   2. histerese: entra em `JANELA_PERTO_ENTRA`, sai só em `JANELA_PERTO_SAI`
//      (bem mais larga). Sem isso uma palmeira bem na fronteira trocaria de
//      malha a cada sonda (5x/s) sempre que a câmera oscilasse um metro.
//   3. nada de alocar por quadro: as duas malhas (perto de verdade e proxy
//      barato) são `InstancedMesh` de capacidade fixa, e a sonda só reescreve
//      matriz de instância e `count`, nunca cria objeto novo.
//
// ⚠️ NENHUM LOTE ENTRA NA CONTA. Lote é teste até o snapshot (ver a memória
// da casa); este módulo planta em cima do arco e da avenida, que são dado
// medido, e não consulta lote nenhum.
//
// Three.js puro (regra da casa: nada de react-three-fiber). Comentários em
// português, com número, explicando o porquê.
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { loadSf, dressSf, podarMapasSecundarios } from './sf-assets'
import { COR_TRONCO, COR_COPA } from './especies'
import { ALCA_TERRA, AVENIDA_ALCA } from './teia'
import { ALCA_R_BAIA, ALCA_PRAIA_LARGURA } from './alca'
import type { Tier } from './perf'

// ── geometria do arco, reproduzida em número puro (sem THREE) para o
//    verificador em `scripts/city/verificar-orla.ts` importar sem precisar de
//    navegador nem de canvas ────────────────────────────────────────────────
export const ORLA_ARCO: [number, number] = ALCA_TERRA
export const ORLA_ARCO_LARGURA_GRAUS = ((ORLA_ARCO[1] - ORLA_ARCO[0]) + 360) % 360 // 130,5°

/** as duas guias reais da avenida (não o r do centro dela, ver o cabeçalho) */
export const ORLA_R_MEIO_FIO_PRAIA = AVENIDA_ALCA.r - AVENIDA_ALCA.larg / 2   // 6.678
export const ORLA_R_MEIO_FIO_MANSAO = AVENIDA_ALCA.r + AVENIDA_ALCA.larg / 2  // 6.722
export const ORLA_OFFSET_MEIO_FIO = 5

export const ORLA_R_FILEIRA_A = ORLA_R_MEIO_FIO_PRAIA - ORLA_OFFSET_MEIO_FIO   // 6.673, palm-tall
export const ORLA_R_FILEIRA_B = ORLA_R_MEIO_FIO_MANSAO + ORLA_OFFSET_MEIO_FIO  // 6.727, palm-date

export const ORLA_N_FILEIRA_A = 848
export const ORLA_N_FILEIRA_B = 694
export const ORLA_PASSO_A_NOMINAL = 18
export const ORLA_PASSO_B_NOMINAL = 22
/** quantas vagas da Fileira A cada nó consome para abrir a clareira de 40 m
 *  ("pula duas vagas", literal do pedido) */
const ORLA_CLAREIRA_VAGAS = 2

export const ORLA_N_NOS = 30

/** a praia (`alca.ts`): água em `ALCA_R_BAIA` (6.580), platô em
 *  `ALCA_R_BAIA + ALCA_PRAIA_LARGURA` (6.660). As três camadas de cada nó
 *  vivem ENTRE as duas, nunca na água nem na faixa fora dos nós. */
const ORLA_PRAIA_R0 = ALCA_R_BAIA                          // 6.580, linha d'água
const ORLA_PRAIA_R1 = ALCA_R_BAIA + ALCA_PRAIA_LARGURA      // 6.660, pé do platô

export interface OrlaPonto { x: number; z: number; a: number }
export interface OrlaPalmaInclinada extends OrlaPonto {
  /** eixo horizontal do tombo, perpendicular ao raio no ponto `a` (convenção
   *  de `teia.ts`: x = sin(a)·r, z = −cos(a)·r ⇒ eixo = (cos a, 0, sin a)
   *  tomba rumo a r DECRESCENTE, ou seja rumo à água; verificado por álgebra
   *  de Rodrigues antes de escrever, não por olho: ver o commit). */
  eixoX: number; eixoZ: number; angulo: number
}
export interface OrlaNo {
  x: number; z: number; a: number
  palmas: OrlaPalmaInclinada[]
  oleandro: OrlaPonto
  grama: OrlaPonto[]
}

/** o mesmo hash determinístico de `especies.ts` (`hash01`), reproduzido para
 *  este arquivo não puxar THREE no import (o verificador roda em `tsx` puro,
 *  sem navegador nem canvas). */
function hash01(i: number): number {
  let t = (i + 0x9e3779b9) >>> 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** normaliza para (−180°, 180°], a MESMA faixa que `Math.atan2` devolve. O
 *  arco da orla (346° a 116,5°) cruza o 0°: gerar ângulo cru (346 a 476,5°,
 *  como `anguloDoNo` faz internamente) e guardar sem normalizar deixava o
 *  campo `.a` incompatível com qualquer leitura por `atan2(x,-z)`, que é
 *  exatamente como o verificador (`scripts/city/verificar-orla.ts`) e o resto
 *  da cidade (`teia.ts:naAlcaDeTerra`, por exemplo) leem ângulo de posição. */
function normDeg(anguloGraus: number): number {
  const g = ((anguloGraus % 360) + 360) % 360 // [0, 360)
  return g > 180 ? g - 360 : g                // (−180, 180]
}

function pontoOrla(r: number, anguloGraus: number): [number, number] {
  const a = normDeg(anguloGraus) * (Math.PI / 180)
  return [Math.sin(a) * r, -Math.cos(a) * r]
}

/** o ângulo (graus) do nó `j`, 0 a `ORLA_N_NOS − 1`, centrado em cada uma das
 *  30 fatias iguais do arco. */
function anguloDoNo(j: number): number {
  const u = (j + 0.5) / ORLA_N_NOS
  return ORLA_ARCO[0] + u * ORLA_ARCO_LARGURA_GRAUS
}

/** os índices da Fileira A que caem dentro da clareira de cada nó: o vizinho
 *  mais próximo do ângulo do nó e o seguinte, sempre 2 (`ORLA_CLAREIRA_VAGAS`),
 *  nunca um número que varia com a sorte do arredondamento. */
function indicesClareiraFileiraA(): Set<number> {
  const rem = new Set<number>()
  for (let j = 0; j < ORLA_N_NOS; j++) {
    const angNo = anguloDoNo(j)
    const uNo = (((angNo - ORLA_ARCO[0]) + 360) % 360) / ORLA_ARCO_LARGURA_GRAUS
    const kFloat = uNo * ORLA_N_FILEIRA_A - 0.5
    const k0 = Math.round(kFloat)
    for (let d = 0; d < ORLA_CLAREIRA_VAGAS; d++) {
      const k = ((k0 + d) % ORLA_N_FILEIRA_A + ORLA_N_FILEIRA_A) % ORLA_N_FILEIRA_A
      rem.add(k)
    }
  }
  return rem
}

/** Fileira A: `palm-tall`, lado da praia, r 6.673, 848 vagas menos as
 *  clareiras dos 30 nós (60 vagas, 2 por nó) = ≈ 788 unidades plantadas. */
export function orlaFileiraA(): OrlaPonto[] {
  const clareira = indicesClareiraFileiraA()
  const pts: OrlaPonto[] = []
  for (let k = 0; k < ORLA_N_FILEIRA_A; k++) {
    if (clareira.has(k)) continue
    const u = (k + 0.5) / ORLA_N_FILEIRA_A
    const angDeg = ORLA_ARCO[0] + u * ORLA_ARCO_LARGURA_GRAUS
    const [x, z] = pontoOrla(ORLA_R_FILEIRA_A, angDeg)
    pts.push({ x, z, a: normDeg(angDeg) * (Math.PI / 180) })
  }
  return pts
}

/** Fileira B: `palm-date`, lado das mansões, r 6.727, 694 unidades, sem
 *  clareira (o nó marca o acesso à praia, não à fachada das mansões). */
export function orlaFileiraB(): OrlaPonto[] {
  const pts: OrlaPonto[] = []
  for (let k = 0; k < ORLA_N_FILEIRA_B; k++) {
    const u = (k + 0.5) / ORLA_N_FILEIRA_B
    const angDeg = ORLA_ARCO[0] + u * ORLA_ARCO_LARGURA_GRAUS
    const [x, z] = pontoOrla(ORLA_R_FILEIRA_B, angDeg)
    pts.push({ x, z, a: normDeg(angDeg) * (Math.PI / 180) })
  }
  return pts
}

/** o passo real de cada fileira (arco verdadeiro na guia própria, dividido
 *  pela contagem dada), e o desvio contra o nominal (18 e 22 m). Exportado
 *  para o relatório e para o verificador conferirem o MESMO número. */
export function orlaPassoReal() {
  const arcoRad = ORLA_ARCO_LARGURA_GRAUS * (Math.PI / 180)
  const passoA = (ORLA_R_FILEIRA_A * arcoRad) / ORLA_N_FILEIRA_A
  const passoB = (ORLA_R_FILEIRA_B * arcoRad) / ORLA_N_FILEIRA_B
  return {
    passoA, passoB,
    desvioA: Math.abs(passoA - ORLA_PASSO_A_NOMINAL),
    desvioB: Math.abs(passoB - ORLA_PASSO_B_NOMINAL),
  }
}

/**
 * Os 30 nós de acesso: 3 `palm` inclinadas na areia (rumo à água), 1
 * `oleander` marcando o pé do platô, 10 touceiras de `grama-alta`
 * espalhadas. Tudo vive entre a linha d'água (`ORLA_PRAIA_R0`, 6.580) e o pé
 * do platô (`ORLA_PRAIA_R1`, 6.660): nunca na água, nunca na faixa de areia
 * fora do nó (a faixa de areia fora dos nós, item do portão 2, fica sem
 * planta nenhuma de propósito, só o nó marca o acesso).
 */
export function orlaNos(): OrlaNo[] {
  const nos: OrlaNo[] = []
  for (let j = 0; j < ORLA_N_NOS; j++) {
    const angDeg = anguloDoNo(j)
    const [xc, zc] = pontoOrla(AVENIDA_ALCA.r, angDeg)
    const semente = j * 977 + 11

    const palmas: OrlaPalmaInclinada[] = []
    for (let i = 0; i < 3; i++) {
      // jitter de ±0,15° (~17 m de arco em r 6.625) para as três não nascerem
      // num risco reto: mata de verdade não planta em fila.
      const ang = angDeg + (hash01(semente + i * 7) - 0.5) * 0.3
      const r = ORLA_PRAIA_R0 + 20 + hash01(semente + i * 7 + 3) * 50 // 6.600 a 6.650
      const [x, z] = pontoOrla(r, ang)
      const a = normDeg(ang) * (Math.PI / 180)
      const angulo = (13 + hash01(semente + i * 7 + 5) * 9) * (Math.PI / 180) // 13 a 22°, igual a ilha-mata.ts
      palmas.push({ x, z, a, eixoX: Math.cos(a), eixoZ: Math.sin(a), angulo })
    }

    const rOle = ORLA_PRAIA_R1 - 4 // 6.656, quase no pé do platô: marca a chegada
    const [xo, zo] = pontoOrla(rOle, angDeg)
    const oleandro: OrlaPonto = { x: xo, z: zo, a: normDeg(angDeg) * (Math.PI / 180) }

    const grama: OrlaPonto[] = []
    for (let i = 0; i < 10; i++) {
      const ang = angDeg + (hash01(semente + 500 + i * 13) - 0.5) * 0.6
      const r = ORLA_PRAIA_R0 + 12 + hash01(semente + 500 + i * 13 + 5) * 65 // 6.592 a 6.657
      const [x, z] = pontoOrla(r, ang)
      grama.push({ x, z, a: normDeg(ang) * (Math.PI / 180) })
    }

    nos.push({ x: xc, z: zc, a: normDeg(angDeg) * (Math.PI / 180), palmas, oleandro, grama })
  }
  return nos
}

// ═══════════════════════════════════════════════════════════════════════════
// A PARTE THREE.JS: carregamento dos GLB reais e o LOD por distância.
// ═══════════════════════════════════════════════════════════════════════════

interface Parte { geo: THREE.BufferGeometry; mat: THREE.Material; local: THREE.Matrix4 }

/** altura, largura (maior lado no plano XZ) e orçamento das 5 espécies desta
 *  orla, medidos junto com o resto do acervo (ver a mesma tabela em
 *  `ilha-mata.ts`, reproduzida aqui e não importada pelo mesmo motivo de lá:
 *  duas plantações fechadas sobre closures diferentes). */
const MEDIDA: Record<string, { h: number; w: number }> = {
  'palm': { h: 13.0, w: 8.0 },
  'palm-tall': { h: 16.1, w: 15.0 },
  'palm-date': { h: 14.0, w: 10.4 },
  'oleander': { h: 1.93, w: 8.18 },
  'grama-alta': { h: 0.45, w: 1.3 },
}
const TRI_GLB: Record<string, number> = {
  'palm': 2264, 'palm-tall': 6000, 'palm-date': 2600, 'oleander': 10000, 'grama-alta': 400,
}
const PARTES_GLB: Record<string, number> = {
  'palm': 3, 'palm-tall': 3, 'palm-date': 4, 'oleander': 3, 'grama-alta': 2,
}

/**
 * O PROXY DE PALMEIRA: 12 triângulos, o mesmo truque de bipirâmide colorida
 * por vértice que `especies.ts:geoLonge()` usa para árvore genérica (8
 * triângulos, anel de 4 lados), só que aqui o anel tem 6 lados (6 + 6 = 12):
 * a orla pediu um proxy PRÓPRIO, mais caro que o genérico, porque de perto
 * mesmo em queda ele ainda precisa ler "palmeira" (tronco fino, copa em
 * cima) e não "bolha verde". `altura`/`largura` são a base (o padrão de
 * `geoLonge`, 7,0 × 4,8): cada palmeira real escala esta base pela proporção
 * de `MEDIDA`, exatamente como o octaedro de longe de `ilha-mata.ts` faz.
 */
function proxyPalmeira(altura = 7.0, largura = 4.8): THREE.BufferGeometry {
  const R = largura / 2
  const yc = altura * 0.55 // canopy mais alta que a de geoLonge (0,62): tronco lê mais fino e mais alto
  const LADOS = 6
  const vs: number[] = [0, 0, 0]
  const cs: number[] = [COR_TRONCO.r, COR_TRONCO.g, COR_TRONCO.b]
  for (let k = 0; k < LADOS; k++) {
    const a = (k / LADOS) * Math.PI * 2
    vs.push(Math.cos(a) * R, yc, Math.sin(a) * R)
    cs.push(COR_COPA.r, COR_COPA.g, COR_COPA.b)
  }
  vs.push(0, altura, 0)
  cs.push(COR_COPA.r, COR_COPA.g, COR_COPA.b)
  const ix: number[] = []
  for (let k = 0; k < LADOS; k++) {
    const a = 1 + k, b = 1 + ((k + 1) % LADOS)
    ix.push(0, b, a)                 // a saia, do pé até o anel
    ix.push(a, b, LADOS + 1)         // a copa, do anel até o topo
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(vs, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3))
  g.setIndex(ix)
  g.computeVertexNormals()
  return g
}

/**
 * O PROXY DE TOUCEIRA: 4 triângulos, a cruz de dois planos (técnica clássica
 * de "grass billboard": duas quads perpendiculares, 2 triângulos cada). De
 * 500 m uma touceira de 0,45 m de altura não sobrevive nem como octaedro; a
 * cruz plana é o mínimo que ainda lê como mancha de capim ao rasante.
 */
function proxyTufo(altura = 0.45, largura = 1.3): THREE.BufferGeometry {
  const w = largura / 2
  const vs: number[] = []
  const cs: number[] = []
  const push = (x: number, y: number, z: number) => { vs.push(x, y, z); cs.push(COR_COPA.r, COR_COPA.g, COR_COPA.b) }
  // quad 1, no plano XY girado em torno de Z=0
  push(-w, 0, 0); push(w, 0, 0); push(w, altura, 0); push(-w, altura, 0)
  // quad 2, perpendicular (plano ZY)
  push(0, 0, -w); push(0, 0, w); push(0, altura, w); push(0, altura, -w)
  const ix = [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(vs, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3))
  g.setIndex(ix)
  g.computeVertexNormals()
  return g
}

/** a cor por instância: mesmo espírito de `corTropical` em `ilha-mata.ts`
 *  (nunca só escurece, giro de matiz verde-a-dourado), reproduzida aqui pelo
 *  mesmo motivo de sempre neste arquivo (closure próprio, não vale a pena
 *  exportar 3 linhas de outro módulo e criar acoplamento). */
function hashPos(x: number, z: number): number {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453
  return s - Math.floor(s)
}
function corVariada(x: number, z: number, alvo: THREE.Color): THREE.Color {
  const hLuz = hashPos(x, z)
  const hMatiz = hashPos(x + 1013.1, z - 1013.1)
  const luz = 1 + (hLuz - 0.5) * 2 * 0.22
  const matiz = 0.28 + hMatiz * 0.10
  return alvo.copy(new THREE.Color().setHSL(matiz, 0.55, 0.42)).multiplyScalar(luz)
}

export interface OrlaOpts {
  /** a superfície real desenhada (rua, praia, platô já com a terraplanagem
   *  da alça aplicada, ver `alcaAlturaAt` embutida em `terrain.ts`): o pé de
   *  cada planta pousa aqui, nunca em `heightAt` cru. */
  superficieAt: (x: number, z: number) => number
  gltf: GLTFLoader
  tier: Tier
  cortaTextura: boolean
  sombra?: boolean
}

export interface Orla {
  group: THREE.Group
  individuos: number
  /** todo o plantio no balde de perto ao mesmo tempo: nunca acontece de
   *  verdade (a janela de ±500 m não cobre isso), é só o teto teórico para
   *  o log, igual ao mesmo campo em `ilha-mata.ts`. */
  trianguloPiorCaso: number
  chamadas: number
  update(cam: THREE.Vector3, agoraMs?: number): void
  dispose(): void
}

/** ⚠️ A JANELA É MEDIDA EM 3D, INCLUSIVE ALTURA. A vista `alca` (`view=alca`
 *  em `plaza-scene.tsx`) fica a 272 m de altura: um ponto a 420 m de
 *  distância NO PLANO já está a `hypot(420,272)` ≈ 500 m da câmera de
 *  verdade. Medir só X/Z superestimaria a janela perto do rasante, que é
 *  exatamente onde esta orla é vista com mais frequência (a alça é rasa).
 *  Entra em 500 m, sai em 620 m (histerese de 120 m, o "algo como" do
 *  pedido); no celular a janela encolhe (350/440) porque o orçamento de
 *  triângulo por quadro é menor lá, e a orla é decoração, não estrutura. */
const JANELA_PERTO_ENTRA: Record<Tier, number> = { desktop: 500, mobile: 350 }
const JANELA_PERTO_SAI: Record<Tier, number> = { desktop: 620, mobile: 440 }

interface Especie {
  file: 'palm-tall' | 'palm-date' | 'palm' | 'oleander' | 'grama-alta'
  pts: (OrlaPonto & { y: number; inclinacao?: { eixoX: number; eixoZ: number; angulo: number } })[]
  estado: Uint8Array // 0 = longe (proxy), 1 = perto (malha cheia)
  partes: Parte[]
  near: THREE.InstancedMesh[]
}

export async function buildOrla(o: OrlaOpts): Promise<Orla> {
  const group = new THREE.Group()
  group.name = 'orla-nobre'

  const carregarPartes = async (file: string): Promise<Parte[]> => {
    const root = await loadSf(o.gltf, `/city/sf/${file}.glb`)
    if (!root) return []
    if (o.cortaTextura) podarMapasSecundarios(root)
    dressSf(root, { castShadow: o.sombra ?? true })
    root.updateMatrixWorld(true)
    const partes: Parte[] = []
    root.traverse((obj) => {
      const m = obj as THREE.Mesh
      if (m.isMesh) partes.push({ geo: m.geometry, mat: m.material as THREE.Material, local: m.matrixWorld.clone() })
    })
    return partes
  }

  // ── 1. os pontos, com a cota real (superfície desenhada) já resolvida ────
  const comY = <T extends OrlaPonto>(pts: T[]) => pts.map((p) => ({ ...p, y: o.superficieAt(p.x, p.z) }))
  const filA = comY(orlaFileiraA())
  const filB = comY(orlaFileiraB())
  const nos = orlaNos()
  const todasPalmasDosNos = nos.flatMap((n) => n.palmas)
  const noPalmas = comY(todasPalmasDosNos).map((p, i) => ({
    ...p,
    inclinacao: { eixoX: todasPalmasDosNos[i].eixoX, eixoZ: todasPalmasDosNos[i].eixoZ, angulo: todasPalmasDosNos[i].angulo },
  }))
  const noOleandro = comY(nos.map((n) => n.oleandro))
  const noGrama = comY(nos.flatMap((n) => n.grama))

  const especies: Especie[] = [
    { file: 'palm-tall', pts: filA, estado: new Uint8Array(filA.length), partes: [], near: [] },
    { file: 'palm-date', pts: filB, estado: new Uint8Array(filB.length), partes: [], near: [] },
    { file: 'palm', pts: noPalmas, estado: new Uint8Array(noPalmas.length), partes: [], near: [] },
    { file: 'oleander', pts: noOleandro, estado: new Uint8Array(noOleandro.length), partes: [], near: [] },
    { file: 'grama-alta', pts: noGrama, estado: new Uint8Array(noGrama.length), partes: [], near: [] },
  ]

  let chamadas = 0
  let trianguloPiorCaso = 0
  const individuos = especies.reduce((s, e) => s + e.pts.length, 0)

  // ── 2. as malhas de PERTO: uma InstancedMesh por parte do GLB, capacidade
  // fixa e generosa (o pior caso da janela de 620 m, calculado uma vez em
  // scratchpad contra a vista `alca` e arredondado com folga; nunca alocado
  // de novo depois disto). Se um dia a janela crescer e estourar a
  // capacidade, o sintoma é sub-render silencioso, não crash: por isso a
  // folga é generosa (quase 2× o pior caso medido). ─────────────────────────
  const CAPACIDADE_PERTO: Record<Especie['file'], number> = {
    'palm-tall': 90, 'palm-date': 75, 'palm': 16, 'oleander': 6, 'grama-alta': 48,
  }
  await Promise.all(especies.map(async (e) => {
    e.partes = await carregarPartes(e.file)
    if (!e.partes.length) return
    const cap = CAPACIDADE_PERTO[e.file]
    for (const parte of e.partes) {
      const im = new THREE.InstancedMesh(parte.geo, parte.mat, cap)
      im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3)
      im.castShadow = o.sombra ?? true
      im.receiveShadow = true
      im.frustumCulled = false
      im.count = 0
      im.name = `orla:perto:${e.file}`
      group.add(im)
      e.near.push(im)
      chamadas++
    }
    trianguloPiorCaso += e.pts.length * (TRI_GLB[e.file] ?? 0)
  }))

  // ── 3. os dois proxies compartilhados: um para as três palmeiras (só a
  // escala muda por espécie, igual ao octaedro de longe de `ilha-mata.ts`),
  // um para a touceira. Capacidade = todo o plantio daquele tipo, porque no
  // pior caso (câmera longe de tudo) TUDO cai no proxy. ────────────────────
  const capPalmProxy = filA.length + filB.length + noPalmas.length + noOleandro.length
  const capTufoProxy = noGrama.length
  const geoPalmProxy = proxyPalmeira()
  const geoTufoProxy = proxyTufo()
  const matProxy = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, side: THREE.DoubleSide })
  const palmProxy = new THREE.InstancedMesh(geoPalmProxy, matProxy, Math.max(1, capPalmProxy))
  palmProxy.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, capPalmProxy) * 3).fill(1), 3)
  palmProxy.name = 'orla:longe:palmeiras'
  palmProxy.castShadow = false
  palmProxy.receiveShadow = false
  palmProxy.frustumCulled = false
  palmProxy.count = 0
  group.add(palmProxy)
  chamadas++
  const tufoProxy = new THREE.InstancedMesh(geoTufoProxy, matProxy, Math.max(1, capTufoProxy))
  tufoProxy.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, capTufoProxy) * 3).fill(1), 3)
  tufoProxy.name = 'orla:longe:tufos'
  tufoProxy.castShadow = false
  tufoProxy.receiveShadow = false
  tufoProxy.frustumCulled = false
  tufoProxy.count = 0
  group.add(tufoProxy)
  chamadas++

  const m4 = new THREE.Matrix4(), pos = new THREE.Vector3(), qua = new THREE.Quaternion(), esc3 = new THREE.Vector3()
  const eixoY = new THREE.Vector3(0, 1, 0)
  const quaLean = new THREE.Quaternion(), quaYaw = new THREE.Quaternion()
  const eixoInclinacao = new THREE.Vector3()
  const cor = new THREE.Color()

  const giroDe = (p: { x: number; z: number; inclinacao?: { eixoX: number; eixoZ: number; angulo: number } }) => {
    quaYaw.setFromAxisAngle(eixoY, hashPos(p.x + 3, p.z + 7) * Math.PI * 2)
    if (!p.inclinacao) return quaYaw.clone()
    eixoInclinacao.set(p.inclinacao.eixoX, 0, p.inclinacao.eixoZ)
    quaLean.setFromAxisAngle(eixoInclinacao, p.inclinacao.angulo)
    return quaLean.multiply(quaYaw)
  }

  let disposed = false
  let proximaSonda = 0

  /** roda no máximo 5x/s (ver `proximaSonda` em `update`), nunca por quadro:
   *  atualiza o estado de histerese de cada indivíduo e reescreve as duas
   *  famílias de InstancedMesh (perto e proxy) do zero. ~1.900 pontos a 5 Hz
   *  é <10 mil escritas de matriz por segundo, sem alocação nenhuma (todo
   *  escalar sai de `m4`/`pos`/`qua`/`esc3`, reaproveitados). */
  const rebalancear = (cam: THREE.Vector3) => {
    const entra2 = JANELA_PERTO_ENTRA[o.tier] ** 2
    const sai2 = JANELA_PERTO_SAI[o.tier] ** 2
    let iPalmProxy = 0, iTufoProxy = 0

    for (const e of especies) {
      const iPerto: number[] = new Array(e.near.length).fill(0)
      for (let i = 0; i < e.pts.length; i++) {
        const p = e.pts[i]
        const d2 = (p.x - cam.x) ** 2 + (p.y - cam.y) ** 2 + (p.z - cam.z) ** 2
        if (e.estado[i] === 0 && d2 < entra2) e.estado[i] = 1
        else if (e.estado[i] === 1 && d2 > sai2) e.estado[i] = 0

        pos.set(p.x, p.y, p.z)
        qua.copy(giroDe(p))

        if (e.estado[i] === 1 && e.near.length) {
          const s = 0.85 + hashPos(p.x, p.z) * 0.4
          esc3.setScalar(s)
          const base = new THREE.Matrix4().compose(pos, qua, esc3)
          e.near.forEach((im, pi) => {
            const idx = iPerto[pi]
            const mm = new THREE.Matrix4().multiplyMatrices(base, e.partes[pi].local)
            im.setMatrixAt(idx, mm)
            im.setColorAt(idx, corVariada(p.x, p.z, cor))
            iPerto[pi] = idx + 1
          })
        } else {
          const med = MEDIDA[e.file] ?? { h: 7, w: 4.8 }
          const s = 0.85 + hashPos(p.x, p.z) * 0.4
          const destino = e.file === 'grama-alta' ? tufoProxy : palmProxy
          const base = e.file === 'grama-alta'
            ? { hRef: 0.45, wRef: 1.3 }
            : { hRef: 7.0, wRef: 4.8 }
          esc3.set((med.w / base.wRef) * s, (med.h / base.hRef) * s, (med.w / base.wRef) * s)
          m4.compose(pos, qua, esc3)
          const idx = e.file === 'grama-alta' ? iTufoProxy++ : iPalmProxy++
          destino.setMatrixAt(idx, m4)
          destino.setColorAt(idx, corVariada(p.x, p.z, cor))
        }
      }
      e.near.forEach((im, pi) => {
        im.count = iPerto[pi]
        im.instanceMatrix.needsUpdate = true
        if (im.instanceColor) im.instanceColor.needsUpdate = true
      })
    }
    palmProxy.count = iPalmProxy
    palmProxy.instanceMatrix.needsUpdate = true
    if (palmProxy.instanceColor) palmProxy.instanceColor.needsUpdate = true
    tufoProxy.count = iTufoProxy
    tufoProxy.instanceMatrix.needsUpdate = true
    if (tufoProxy.instanceColor) tufoProxy.instanceColor.needsUpdate = true
  }

  rebalancear(new THREE.Vector3(1e9, 1e9, 1e9)) // primeira passada: tudo no proxy, câmera nasce longe da alça

  const { passoA, passoB, desvioA, desvioB } = orlaPassoReal()
  console.log(
    `[orla] ${individuos.toLocaleString('pt-BR')} indivíduos (Fileira A ${filA.length} palm-tall, `
    + `Fileira B ${filB.length} palm-date, ${ORLA_N_NOS} nós): passo A ${passoA.toFixed(3)} m `
    + `(desvio ${desvioA.toFixed(3)} m de 18), passo B ${passoB.toFixed(3)} m (desvio ${desvioB.toFixed(3)} m de 22); `
    + `${chamadas} chamadas de desenho, ${Math.round(trianguloPiorCaso).toLocaleString('pt-BR')} triângulos de pior caso`,
  )

  return {
    group,
    individuos,
    trianguloPiorCaso: Math.round(trianguloPiorCaso),
    chamadas,
    update(cam: THREE.Vector3, agoraMs = performance.now()) {
      if (disposed) return
      // ⚠️ CINCO SONDAS POR SEGUNDO, NUNCA POR QUADRO: mesmo padrão de
      // `proximaSonda`/200 ms em `atletismo-loader.ts`.
      if (agoraMs < proximaSonda) return
      proximaSonda = agoraMs + 200
      rebalancear(cam)
    },
    dispose() {
      if (disposed) return
      disposed = true
      geoPalmProxy.dispose()
      geoTufoProxy.dispose()
      matProxy.dispose()
      group.traverse((obj) => {
        const m = obj as THREE.Mesh
        if (m.isMesh) { m.geometry?.dispose(); (m.material as THREE.Material)?.dispose?.() }
      })
      group.clear()
    },
  }
}
