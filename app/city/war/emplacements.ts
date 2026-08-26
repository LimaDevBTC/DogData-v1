// POSIÇÕES DE DEFESA FIXA: ninho de metralhadora, canhão antiaéreo e
// segmento de trincheira, mesma técnica de tanks.ts, arsenal.ts e
// vehicles.ts (caixas voxel fundidas numa BufferGeometry por peça, cor
// pintada POR VÉRTICE, sem custo extra por instância).
//
// Módulo AUTÔNOMO: as únicas dependências externas são three e
// mergeGeometries. O helper caixa() é redefinido localmente em vez de
// importado dos irmãos, mesmo padrão de vehicles.ts (cada arquivo mantém a
// própria cópia).
//
// Este arquivo só CONSTRÓI geometria, uma vez, na montagem da cena: não há
// laço por frame nem por evento aqui, então "zero alocação por evento" é a
// regra do hot path em battlefield.ts, não deste módulo. Pelo mesmo motivo
// não há PointLight nem ShaderMaterial aqui: o arquivo não cria material nem
// luz, só forma.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// ─────────────────────────────────────────────────────────────────────────
// PALETA
// ─────────────────────────────────────────────────────────────────────────

export interface CoresEmplacamento {
  saco: THREE.Color
  sacoSombra: THREE.Color
  metal: THREE.Color
  metalSombra: THREE.Color
  destaque: THREE.Color
}

/** saco e sacoSombra são propositalmente o MESMO valor nos dois lados: sacos
 *  de areia não têm exército, só terra suja empilhada. */
export const CORES_EMP_DOG: CoresEmplacamento = {
  saco: new THREE.Color('#8a7a5c'),
  sacoSombra: new THREE.Color('#6b5d43'),
  metal: new THREE.Color('#e06207'),
  metalSombra: new THREE.Color('#8a480f'),
  destaque: new THREE.Color('#f0680b'),
}
export const CORES_EMP_URSO: CoresEmplacamento = {
  saco: new THREE.Color('#8a7a5c'),
  sacoSombra: new THREE.Color('#6b5d43'),
  metal: new THREE.Color('#4a1220'),
  metalSombra: new THREE.Color('#2c0a12'),
  destaque: new THREE.Color('#7a2436'),
}

// cores de espécie do artilheiro agachado (mesma família de critters.ts e
// vehicles.ts, redeclaradas aqui porque o módulo não importa de fora)
const CAO_CASACO = new THREE.Color('#f0680b')
const CAO_PELE = new THREE.Color('#c9722a')
const CAO_CREME = new THREE.Color('#efe2c6')
const CAO_ORELHA = new THREE.Color('#a35d24')
const URSO_ESCURO = new THREE.Color('#7a2436')
const URSO_CABECA = new THREE.Color('#8f2a3f')
const URSO_FOCINHO = new THREE.Color('#a8354a')

// terra e madeira da trincheira: sem cor de exército, o chão de guerra é
// neutro nos dois lados da linha
const TERRA = new THREE.Color('#4a3826')
const TERRA_ESCURA = new THREE.Color('#33261a')
const MADEIRA = new THREE.Color('#3d2a18')
const MADEIRA_LASCA = new THREE.Color('#5a3f22')

// ─────────────────────────────────────────────────────────────────────────
// HELPER (cópia local, ver nota de autonomia no topo do arquivo)
// ─────────────────────────────────────────────────────────────────────────

/** caixa voxel colorida por vértice; `rot` (radianos) gira a caixa ANTES de
 *  transladar, pra peças em ângulo (pernas dobradas, estacas inclinadas)
 *  sem precisar de um grupo extra só pra inclinar uma peça estática. */
function caixa(
  w: number, h: number, d: number,
  x: number, y: number, z: number,
  cor: THREE.Color,
  rot?: { x?: number; y?: number; z?: number },
): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d)
  if (rot) {
    if (rot.x) g.rotateX(rot.x)
    if (rot.y) g.rotateY(rot.y)
    if (rot.z) g.rotateZ(rot.z)
  }
  g.translate(x, y, z)
  const n = g.attributes.position.count
  const cores = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    cores[i * 3] = cor.r
    cores[i * 3 + 1] = cor.g
    cores[i * 3 + 2] = cor.b
  }
  g.setAttribute('color', new THREE.BufferAttribute(cores, 3))
  return g
}

// ═══════════════════════════════════════════════════════════════════════
// 1. NINHO DE METRALHADORA
// ═══════════════════════════════════════════════════════════════════════

export interface NinhoGeo {
  base: THREE.BufferGeometry
  arma: THREE.BufferGeometry
}

// ⚠️ a boca da metralhadora fica em (sentido * BOCA_MG_DIST, 0, 0) no espaço
// LOCAL da peça `arma`, cujo pivô é o cabeçote de giro no TOPO do tripé (não
// o pé no chão): quem chama gira esse grupo em Y pra varrer o alvo e traduz
// esse ponto pela matrixWorld do pivô pra achar a origem real do disparo,
// igual BOCA_CANHAO_DIST de arsenal.ts. As pernas do tripé descem de y=0 até
// o chão; o chamador posiciona o grupo inteiro na altura do pedestal que
// `base` constrói (ver comentário do pedestal abaixo).
export const BOCA_MG_DIST = 1.35

// meia-lua de sacos de areia: arco de 90° a 270° (passa pelos 180°, o fundo),
// abrindo exatamente nos 3.5 de largura entre as duas pontas em z=+-R e
// z=-+R quando sentido=1 mira +x (mesma convenção de tanks.ts: sentido=-1
// espelha em x, a largura da boca não muda)
const NINHO_R = 1.75
const NINHO_ANG_BASE_DEG = [90, 112.5, 135, 157.5, 180, 202.5, 225, 247.5, 270]
const NINHO_ANG_TOPO_DEG = [101.25, 123.75, 146.25, 168.75, 191.25, 213.75, 236.25, 258.75]

/** meia-lua de sacos de areia (2 fiadas) abrindo pro inimigo, com um
 *  artilheiro da espécie agachado atrás; `base` é a parte parada (parapeito +
 *  pedestal + artilheiro), `arma` é a metralhadora pesada sobre tripé com
 *  pivô no cabeçote de giro (ver BOCA_MG_DIST). sentido=1 abre pra +x (cães),
 *  sentido=-1 pra -x (ursos), igual tanks.ts. */
export function buildNinhoGeometry(lado: 'dog' | 'bear', sentido: 1 | -1): NinhoGeo {
  const s = sentido
  const cores = lado === 'dog' ? CORES_EMP_DOG : CORES_EMP_URSO

  const sacos: THREE.BufferGeometry[] = []
  NINHO_ANG_BASE_DEG.forEach((deg, i) => {
    const t = (deg * Math.PI) / 180
    const x0 = Math.cos(t) * NINHO_R
    const z0 = Math.sin(t) * NINHO_R
    const cor = i % 2 === 0 ? cores.saco : cores.sacoSombra
    sacos.push(caixa(0.5, 0.32, 0.46, s * x0, 0.16, z0, cor))
  })
  NINHO_ANG_TOPO_DEG.forEach((deg, i) => {
    const t = (deg * Math.PI) / 180
    const rTopo = NINHO_R - 0.16 // fiada de cima recua um pouco, talude do parapeito
    const x0 = Math.cos(t) * rTopo
    const z0 = Math.sin(t) * rTopo
    const cor = i % 2 === 0 ? cores.sacoSombra : cores.saco
    sacos.push(caixa(0.46, 0.28, 0.42, s * x0, 0.46, z0, cor))
  })

  // pedestal onde o pivô da peça `arma` se apoia: 0.6 de altura, um pouco
  // à frente do centro (mais perto da boca aberta pro inimigo)
  const pedestal = caixa(0.32, 0.6, 0.32, s * 0.1, 0.3, 0, cores.metalSombra)

  // caixa de munição de reserva, encostada no parapeito de trás
  const municao = caixa(0.24, 0.22, 0.32, -s * 0.85, 0.11, 0.32, cores.metalSombra)

  // artilheiro agachado atrás da metralhadora (lado friendly da meia-lua,
  // perto do parapeito de fundo, oposto à boca aberta)
  const gx = -s * 0.5
  const gunner: THREE.BufferGeometry[] = []
  if (lado === 'dog') {
    gunner.push(
      caixa(0.34, 0.36, 0.3, gx, 0.42, 0, CAO_CASACO, { x: -0.15 }), // torso inclinado pra frente
      caixa(0.13, 0.3, 0.05, gx + s * 0.02, 0.42, 0, CAO_CREME, { x: -0.15 }), // peito
      caixa(0.26, 0.24, 0.26, gx + s * 0.1, 0.66, 0, CAO_PELE), // cabeça
      caixa(0.12, 0.11, 0.14, gx + s * 0.22, 0.62, 0, CAO_CREME), // focinho
      caixa(0.08, 0.13, 0.07, gx + s * 0.06, 0.79, 0.09, CAO_ORELHA),
      caixa(0.08, 0.13, 0.07, gx + s * 0.06, 0.79, -0.09, CAO_ORELHA),
      caixa(0.11, 0.28, 0.11, gx + s * 0.2, 0.35, 0.12, CAO_PELE, { x: -0.5 }), // braço no comando da arma
      caixa(0.11, 0.22, 0.11, gx - s * 0.14, 0.3, -0.14, CAO_PELE), // braço de apoio
      caixa(0.14, 0.14, 0.32, gx - s * 0.05, 0.22, 0.16, CAO_PELE), // coxa dobrada (agachado)
      caixa(0.13, 0.14, 0.32, gx - s * 0.05, 0.22, -0.16, CAO_PELE),
      caixa(0.13, 0.22, 0.13, gx - s * 0.16, 0.11, 0.22, CAO_PELE), // canela sob o corpo
      caixa(0.13, 0.22, 0.13, gx - s * 0.16, 0.11, -0.22, CAO_PELE),
      caixa(0.15, 0.08, 0.16, gx - s * 0.1, 0.04, 0.24, CAO_ORELHA), // pata
      caixa(0.15, 0.08, 0.16, gx - s * 0.1, 0.04, -0.24, CAO_ORELHA),
    )
  } else {
    gunner.push(
      caixa(0.32, 0.34, 0.28, gx, 0.42, 0, URSO_ESCURO, { x: -0.15 }),
      caixa(0.24, 0.22, 0.24, gx + s * 0.1, 0.65, 0, URSO_CABECA), // cabeça
      caixa(0.12, 0.1, 0.14, gx + s * 0.2, 0.61, 0, URSO_FOCINHO), // focinho
      caixa(0.07, 0.08, 0.06, gx + s * 0.06, 0.77, 0.09, URSO_CABECA),
      caixa(0.07, 0.08, 0.06, gx + s * 0.06, 0.77, -0.09, URSO_CABECA),
      caixa(0.1, 0.26, 0.1, gx + s * 0.19, 0.34, 0.12, URSO_ESCURO, { x: -0.5 }),
      caixa(0.1, 0.2, 0.1, gx - s * 0.13, 0.29, -0.13, URSO_ESCURO),
      caixa(0.14, 0.14, 0.3, gx - s * 0.05, 0.22, 0.15, URSO_ESCURO),
      caixa(0.13, 0.14, 0.3, gx - s * 0.05, 0.22, -0.15, URSO_ESCURO),
      caixa(0.12, 0.2, 0.12, gx - s * 0.15, 0.11, 0.21, URSO_FOCINHO),
      caixa(0.12, 0.2, 0.12, gx - s * 0.15, 0.11, -0.21, URSO_FOCINHO),
      caixa(0.14, 0.08, 0.15, gx - s * 0.09, 0.04, 0.23, URSO_CABECA),
      caixa(0.14, 0.08, 0.15, gx - s * 0.09, 0.04, -0.23, URSO_CABECA),
    )
  }

  const base = mergeGeometries([...sacos, pedestal, municao, ...gunner], false)!
  base.computeVertexNormals()

  const arma = mergeGeometries([
    // cabeçote de giro, é o pivô do grupo (0,0,0)
    caixa(0.26, 0.18, 0.3, 0, 0, 0, cores.metal),
    // pernas do tripé, descem do pivô até perto do chão
    caixa(0.08, 0.6, 0.08, -s * 0.22, -0.3, 0, cores.metalSombra, { z: -s * 0.4 }), // perna de trás
    caixa(0.08, 0.58, 0.08, s * 0.14, -0.3, 0.42, cores.metalSombra, { x: -0.4 }), // perna dianteira esq
    caixa(0.08, 0.58, 0.08, s * 0.14, -0.3, -0.42, cores.metalSombra, { x: 0.4 }), // perna dianteira dir
    // corpo da arma
    caixa(0.4, 0.24, 0.22, s * 0.15, 0, 0, cores.metalSombra), // receptor
    caixa(0.75, 0.13, 0.13, s * 0.75, 0, 0, cores.metal), // camisa de resfriamento do cano
    caixa(0.12, 0.12, 0.12, s * BOCA_MG_DIST, 0, 0, cores.destaque), // boca/freio
    caixa(0.3, 0.1, 0.08, s * 0.35, 0.16, 0, cores.destaque), // alça de transporte
    caixa(0.22, 0.2, 0.16, s * 0.05, -0.05, 0.22, cores.metalSombra), // pente/caixa de munição lateral
    caixa(0.18, 0.05, 0.05, s * 0.28, 0.05, 0.14, cores.destaque), // fita de alimentação
    caixa(0.06, 0.16, 0.3, -s * 0.12, 0.02, 0, cores.metalSombra), // punhos traseiros
    caixa(0.05, 0.08, 0.05, s * 0.05, 0.14, 0, cores.destaque), // mira
  ], false)!
  arma.computeVertexNormals()

  return { base, arma }
}

// ═══════════════════════════════════════════════════════════════════════
// 2. CANHÃO ANTIAÉREO
// ═══════════════════════════════════════════════════════════════════════

export interface AntiAereaGeo {
  base: THREE.BufferGeometry
  cano: THREE.BufferGeometry
}

// ⚠️ a boca de cada cano fica em (BOCA_AA_DIST, 0, +-0.24) no espaço LOCAL da
// peça `cano`, cujo pivô é o munhão (trunnion) onde a arma se apoia. Em
// repouso o cano aponta +x local com elevação 0: o chamador monta esse grupo
// dentro de um grupo de giro em Y (azimute, 360 graus livres, por isso esta
// peça não recebe `sentido`) e usa a rotação do próprio grupo `cano` (ou um
// grupo intermediário) pro segundo eixo, a elevação pro céu.
export const BOCA_AA_DIST = 1.9

/** plataforma cruciforme com assento do operador. sem `sentido`: o canhão
 *  antiaéreo mira em qualquer direção, então nada aqui é assimétrico em x. */
export function buildAntiAereaGeometry(lado: 'dog' | 'bear'): AntiAereaGeo {
  const cores = lado === 'dog' ? CORES_EMP_DOG : CORES_EMP_URSO

  const base = mergeGeometries([
    caixa(1.0, 0.3, 1.0, 0, 0.15, 0, cores.metal), // cubo central
    caixa(1.5, 0.18, 0.5, 1.0, 0.08, 0, cores.metalSombra), // braço +x
    caixa(1.5, 0.18, 0.5, -1.0, 0.08, 0, cores.metalSombra), // braço -x
    caixa(0.5, 0.18, 1.5, 0, 0.08, 1.0, cores.metalSombra), // braço +z
    caixa(0.5, 0.18, 1.5, 0, 0.08, -1.0, cores.metalSombra), // braço -z
    caixa(0.3, 0.1, 0.3, 1.7, 0.05, 0, cores.metalSombra), // pé de apoio na ponta de cada braço
    caixa(0.3, 0.1, 0.3, -1.7, 0.05, 0, cores.metalSombra),
    caixa(0.3, 0.1, 0.3, 0, 0.05, 1.7, cores.metalSombra),
    caixa(0.3, 0.1, 0.3, 0, 0.05, -1.7, cores.metalSombra),
    caixa(0.85, 0.14, 0.85, 0, 0.32, 0, cores.destaque), // anel de giro
    caixa(0.5, 0.5, 0.5, 0, 0.62, 0, cores.metal), // pedestal onde o munhão de `cano` se apoia
    // assento do operador, ao lado, oposto ao repouso do cano em +x
    caixa(0.4, 0.1, 0.36, -0.9, 0.42, 0.55, cores.metalSombra),
    caixa(0.06, 0.3, 0.06, -0.9, 0.2, 0.55 + 0.16, cores.metal),
    caixa(0.06, 0.3, 0.06, -0.9, 0.2, 0.55 - 0.16, cores.metal),
    caixa(0.32, 0.28, 0.06, -0.9, 0.62, 0.7, cores.metalSombra), // encosto
  ], false)!
  base.computeVertexNormals()

  const cano = mergeGeometries([
    caixa(0.4, 0.34, 0.9, 0, 0, 0, cores.metal), // berço/munhão, é o pivô do grupo
    caixa(0.3, 0.24, 0.24, 0.25, 0, 0.24, cores.metalSombra), // culatra cano de cima
    caixa(0.3, 0.24, 0.24, 0.25, 0, -0.24, cores.metalSombra), // culatra cano de baixo
    caixa(1.7, 0.14, 0.14, 1.05, 0, 0.24, cores.metal), // cano de cima
    caixa(1.7, 0.14, 0.14, 1.05, 0, -0.24, cores.metal), // cano de baixo
    caixa(0.16, 0.16, 0.16, BOCA_AA_DIST, 0, 0.24, cores.destaque), // boca de cima
    caixa(0.16, 0.16, 0.16, BOCA_AA_DIST, 0, -0.24, cores.destaque), // boca de baixo
    caixa(0.12, 0.12, 0.62, 1.5, 0.1, 0, cores.metalSombra), // jugo que une os dois canos
    caixa(0.22, 0.2, 0.22, -0.15, 0.22, 0, cores.destaque), // mira/contrapeso
    caixa(0.08, 0.22, 0.08, -0.3, -0.05, 0.3, cores.metalSombra), // punho esquerdo
    caixa(0.08, 0.22, 0.08, -0.3, -0.05, -0.3, cores.metalSombra), // punho direito
  ], false)!
  cano.computeVertexNormals()

  return { base, cano }
}

// ═══════════════════════════════════════════════════════════════════════
// 3. TRINCHEIRA
// ═══════════════════════════════════════════════════════════════════════

const TRINCHEIRA_COMPRIMENTO = 9
const TRINCHEIRA_PASSO_Z = 0.56
const TRINCHEIRA_N_SACOS = Math.round(TRINCHEIRA_COMPRIMENTO / TRINCHEIRA_PASSO_Z)
const TRINCHEIRA_ESTACAS_Z = [-4, -2.4, -0.8, 0.8, 2.4, 4]

/** segmento de trincheira de ~9 no eixo z, pra instanciar em fileira e
 *  formar uma linha contínua: chão rebaixado, ombreiras de terra, parapeito
 *  de sacos de areia do lado inimigo e estacas de madeira inclinadas pro
 *  mesmo lado. Sem espécie e sem cor de exército, terra e madeira não
 *  torcem pra ninguém. sentido=1 encara +x, sentido=-1 encara -x, igual
 *  tanks.ts (o parapeito e as estacas ficam do lado sentido*x). */
export function buildTrincheiraGeometry(sentido: 1 | -1): THREE.BufferGeometry {
  const s = sentido
  const partes: THREE.BufferGeometry[] = [
    // chão rebaixado da vala
    caixa(1.6, 0.1, TRINCHEIRA_COMPRIMENTO, 0, -0.05, 0, TERRA_ESCURA),
    // ombreiras (as duas paredes internas de terra batida)
    caixa(0.3, 0.24, TRINCHEIRA_COMPRIMENTO, 0.75, 0.02, 0, TERRA),
    caixa(0.3, 0.24, TRINCHEIRA_COMPRIMENTO, -0.75, 0.02, 0, TERRA),
    // estrado de tiro: degrau mais alto do lado inimigo pra atirar por cima
    caixa(0.5, 0.14, TRINCHEIRA_COMPRIMENTO, s * 0.35, 0.04, 0, TERRA),
  ]

  // parapeito de sacos de areia, 2 fiadas, correndo ao longo de z do lado
  // sentido*x (a face que encara o inimigo)
  for (let row = 0; row < 2; row++) {
    const xoff = s * (0.95 - row * 0.12)
    const y = 0.16 + row * 0.3
    const h = row === 0 ? 0.32 : 0.28
    const fase = row === 1 ? TRINCHEIRA_PASSO_Z / 2 : 0
    for (let i = 0; i < TRINCHEIRA_N_SACOS; i++) {
      const z = -TRINCHEIRA_COMPRIMENTO / 2 + TRINCHEIRA_PASSO_Z * (i + 0.5) + fase
      if (z > TRINCHEIRA_COMPRIMENTO / 2) continue
      // mesma dupla de tons de saco de areia de CORES_EMP_*, redeclarada
      // aqui porque este segmento não recebe `lado`
      const sacoTom = i % 2 === 0 ? new THREE.Color('#8a7a5c') : new THREE.Color('#6b5d43')
      partes.push(caixa(0.5, h, 0.5, xoff, y, z, sacoTom))
    }
  }

  // estacas de madeira inclinadas pro lado inimigo (+x se sentido=1)
  for (const z of TRINCHEIRA_ESTACAS_Z) {
    const x = s * 1.25
    partes.push(caixa(0.12, 0.9, 0.12, x, 0.4, z, MADEIRA, { z: s * 0.4 }))
    // ponta lascada mais clara, deslocada ao longo da mesma inclinação
    partes.push(caixa(0.14, 0.16, 0.14, x + s * 0.2, 0.9, z, MADEIRA_LASCA, { z: s * 0.4 }))
  }

  const g = mergeGeometries(partes, false)!
  g.computeVertexNormals()
  return g
}
