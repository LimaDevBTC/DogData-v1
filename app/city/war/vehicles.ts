// BESTIÁRIO DE VEÍCULOS: cavalaria, helicóptero de ataque e jipe de
// metralhadora para os dois exércitos (cães laranja Bitcoin vs ursos
// carmim), na mesma técnica de tanks.ts e arsenal.ts: caixas voxel
// transformadas e fundidas numa BufferGeometry por peça, cor pintada POR
// VÉRTICE (material liga vertexColors, sem custo extra por instância).
//
// Módulo AUTÔNOMO de propósito: as únicas dependências externas são three e
// mergeGeometries, e o helper caixa() é redefinido aqui em vez de importado
// dos irmãos (mesmo padrão que arsenal.ts já não repete de tanks.ts para
// tudo, mas critters/tanks/arsenal cada um mantém a própria cópia).
//
// Este arquivo só CONSTRÓI geometria, uma vez, na montagem da cena: não há
// laço por frame nem por evento aqui, então a regra de "zero alocação por
// evento" não se aplica a este arquivo (ela é do hot path em battlefield.ts,
// que instancia os Mesh/Group a partir do que sai daqui e reaproveita tudo
// via pools). Por isso mesmo motivo não há PointLight nem ShaderMaterial
// neste módulo: ele não cria material nem luz, só forma.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// ─────────────────────────────────────────────────────────────────────────
// PALETA
// ─────────────────────────────────────────────────────────────────────────

export interface CoresVeiculo {
  corpo: THREE.Color
  corpoSombra: THREE.Color
  detalhe: THREE.Color
  apoio: THREE.Color
}

/** paleta de carroceria/tack dos veículos cão: mesmos tons de tanks.ts, pra
 *  cavalaria, helicóptero e jipe lerem como o mesmo exército dos tanques. */
export const CORES_VEICULO_DOG: CoresVeiculo = {
  corpo: new THREE.Color('#e06207'),
  corpoSombra: new THREE.Color('#8a480f'),
  detalhe: new THREE.Color('#efe2c6'),
  apoio: new THREE.Color('#2a1f14'),
}
export const CORES_VEICULO_URSO: CoresVeiculo = {
  corpo: new THREE.Color('#4a1220'),
  corpoSombra: new THREE.Color('#2c0a12'),
  detalhe: new THREE.Color('#8f2a3f'),
  apoio: new THREE.Color('#1a0c10'),
}

// cores de espécie do cavaleiro montado (mesma família de critters.ts, mas
// redeclaradas aqui porque o módulo não importa de fora). O cavaleiro urso
// trocou a paleta carmim antiga por pelo marrom de urso de verdade + camisa
// vermelha (mesmos hex novos de critters.ts); o casaco do cavaleiro cão
// continua #f0680b, não mudou.
const CAO_CASACO = new THREE.Color('#f0680b')
const CAO_PELE = new THREE.Color('#c9722a')
const CAO_CREME = new THREE.Color('#efe2c6')
const CAO_ORELHA = new THREE.Color('#a35d24')
const URSO_ESCURO = new THREE.Color('#8a5a36') // pelo marrom, sombra (pernas/braço/capa)
const URSO_CABECA = new THREE.Color('#ac7043') // pelo marrom, tom médio (cabeça/orelhas)
const URSO_FOCINHO = new THREE.Color('#d9a877') // focinho/garra, tan claro
const URSO_CAMISA = new THREE.Color('#e6394a') // camisa vermelha no tronco

// a montaria é "lunar": pelagem clara e fria evocando regolito, não o marrom
// terrestre de cavalo comum, pra casar com o resto do mundo DogCity na Lua
const CAVALO_LUNAR = new THREE.Color('#c7c3bc')
const CAVALO_LUNAR_SOMBRA = new THREE.Color('#8f8b84')
const CAVALO_CRINA = new THREE.Color('#37332e')
const CAVALO_CASCO = new THREE.Color('#211e1b')

// ─────────────────────────────────────────────────────────────────────────
// HELPER (cópia local, ver nota de autonomia no topo do arquivo)
// ─────────────────────────────────────────────────────────────────────────

/** caixa voxel colorida por vértice; `rot` (radianos) gira a caixa ANTES de
 *  transladar, pra peças em ângulo (pescoço, pernas de galope, para-brisa)
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
// 1. CAVALARIA
// ═══════════════════════════════════════════════════════════════════════

/** ~3.3 de comprimento (corpo ~2.2 mais as pernas esticadas do galope),
 *  montaria lunar com o cavaleiro da espécie em cima; devolve UMA geometria
 *  fundida porque cavalo e cavaleiro sempre se movem como rigid body só
 *  (quem anima é o chamador balançando rotation.z/y do mesh inteiro pra
 *  simular o galope, então a pose aqui é congelada em "galope voador":
 *  as duas patas dianteiras esticadas pra frente, as traseiras uma esticada
 *  pra trás e a outra recolhida sob a barriga). sentido=1 olha pra +x (linha
 *  dos cães), sentido=-1 pra -x (linha dos ursos), igual tanks.ts. */
export function buildCavaleiroGeometry(lado: 'dog' | 'bear', sentido: 1 | -1): THREE.BufferGeometry {
  const s = sentido
  const cores = lado === 'dog' ? CORES_VEICULO_DOG : CORES_VEICULO_URSO

  const partes: THREE.BufferGeometry[] = [
    // ── montaria: massa do corpo ──
    caixa(1.05, 0.5, 0.42, 0, 1.15, 0, CAVALO_LUNAR),
    caixa(0.42, 0.46, 0.4, s * 0.62, 1.18, 0, CAVALO_LUNAR), // peito
    caixa(0.46, 0.42, 0.42, -s * 0.58, 1.08, 0, CAVALO_LUNAR), // garupa
    caixa(0.9, 0.16, 0.36, 0, 0.9, 0, CAVALO_LUNAR_SOMBRA), // sombra do ventre
    caixa(0.28, 0.62, 0.26, s * 0.95, 1.55, 0, CAVALO_LUNAR, { z: s * 0.55 }), // pescoço
    caixa(0.34, 0.28, 0.28, s * 1.35, 1.92, 0, CAVALO_LUNAR), // cabeça
    caixa(0.16, 0.15, 0.16, s * 1.56, 1.86, 0, CAVALO_LUNAR_SOMBRA), // focinho
    caixa(0.08, 0.14, 0.06, s * 1.28, 2.1, 0.1, CAVALO_LUNAR_SOMBRA), // orelha
    caixa(0.08, 0.14, 0.06, s * 1.28, 2.1, -0.1, CAVALO_LUNAR_SOMBRA),
    caixa(0.1, 0.55, 0.24, s * 0.9, 1.78, 0, CAVALO_CRINA, { z: s * 0.5 }), // crina
    caixa(0.14, 0.55, 0.14, -s * 1.05, 0.85, 0, CAVALO_CRINA, { z: -s * 0.35 }), // rabo

    // ── pata dianteira esquerda: esticada bem pra frente ──
    caixa(0.16, 0.5, 0.16, s * 0.82, 0.86, 0.14, CAVALO_LUNAR_SOMBRA, { z: s * 0.55 }),
    caixa(0.13, 0.42, 0.13, s * 1.2, 0.42, 0.14, CAVALO_LUNAR_SOMBRA, { z: s * 0.95 }),
    caixa(0.15, 0.11, 0.16, s * 1.36, 0.15, 0.14, CAVALO_CASCO),
    // ── pata dianteira direita: um degrau atrás da esquerda (quebra a simetria) ──
    caixa(0.16, 0.5, 0.16, s * 0.78, 0.9, -0.14, CAVALO_LUNAR_SOMBRA, { z: s * 0.42 }),
    caixa(0.13, 0.4, 0.13, s * 1.08, 0.5, -0.14, CAVALO_LUNAR_SOMBRA, { z: s * 0.7 }),
    caixa(0.15, 0.11, 0.16, s * 1.22, 0.24, -0.14, CAVALO_CASCO),
    // ── pata traseira esquerda: esticada bem pra trás (impulso do salto) ──
    caixa(0.18, 0.48, 0.18, -s * 0.8, 0.82, 0.15, CAVALO_LUNAR_SOMBRA, { z: -s * 0.48 }),
    caixa(0.14, 0.42, 0.14, -s * 1.14, 0.4, 0.15, CAVALO_LUNAR_SOMBRA, { z: -s * 0.85 }),
    caixa(0.16, 0.11, 0.17, -s * 1.3, 0.14, 0.15, CAVALO_CASCO),
    // ── pata traseira direita: recolhida sob a barriga (fase suspensa do galope) ──
    caixa(0.18, 0.44, 0.18, -s * 0.55, 0.98, -0.15, CAVALO_LUNAR_SOMBRA, { z: -s * 0.75 }),
    caixa(0.14, 0.34, 0.14, -s * 0.42, 0.62, -0.15, CAVALO_LUNAR_SOMBRA, { z: -s * 0.3 }),
    caixa(0.16, 0.1, 0.17, -s * 0.32, 0.44, -0.15, CAVALO_CASCO),

    // ── sela e apeiros: cor do exército em destaque sobre o pelo lunar ──
    caixa(0.55, 0.15, 0.46, 0, 1.43, 0, cores.corpo), // manta
    caixa(0.12, 0.55, 0.5, s * 0.02, 1.15, 0, cores.detalhe), // cilha
    caixa(0.08, 0.18, 0.08, s * 0.1, 1.02, 0.26, cores.apoio), // estribo
    caixa(0.08, 0.18, 0.08, s * 0.1, 1.02, -0.26, cores.apoio),
  ]

  if (lado === 'dog') {
    partes.push(
      caixa(0.36, 0.44, 0.32, 0, 1.85, 0, CAO_CASACO), // casaco/tronco
      caixa(0.14, 0.36, 0.05, s * 0.16, 1.85, 0, CAO_CREME), // peito claro
      caixa(0.15, 0.34, 0.14, 0, 1.5, 0.2, CAO_PELE), // perna
      caixa(0.15, 0.34, 0.14, 0, 1.5, -0.2, CAO_PELE),
      caixa(0.15, 0.12, 0.15, 0, 1.33, 0.2, CAVALO_CRINA), // bota
      caixa(0.15, 0.12, 0.15, 0, 1.33, -0.2, CAVALO_CRINA),
      caixa(0.13, 0.32, 0.13, s * 0.2, 1.92, 0.17, CAO_PELE, { z: s * 0.35 }), // braço (rédea)
      caixa(0.13, 0.32, 0.13, s * 0.2, 1.92, -0.17, CAO_PELE, { z: s * 0.35 }),
      caixa(0.3, 0.28, 0.3, s * 0.04, 2.28, 0, CAO_PELE), // cabeça
      caixa(0.14, 0.13, 0.16, s * 0.2, 2.22, 0, CAO_CREME), // focinho
      caixa(0.09, 0.14, 0.08, s * 0.02, 2.47, 0.11, CAO_ORELHA), // orelha
      caixa(0.09, 0.14, 0.08, s * 0.02, 2.47, -0.11, CAO_ORELHA),
      caixa(0.3, 0.5, 0.06, -s * 0.22, 1.78, 0, CAO_CASACO, { z: s * 0.15 }), // capa esvoaçante
      caixa(0.4, 0.08, 0.36, 0, 1.68, 0, CAO_CREME), // cinto
    )
  } else {
    partes.push(
      caixa(0.32, 0.38, 0.28, 0, 1.8, 0, URSO_CAMISA), // tronco (camisa vermelha, urso menor que o de infantaria)
      caixa(0.13, 0.3, 0.12, 0, 1.48, 0.18, URSO_ESCURO), // perna
      caixa(0.13, 0.3, 0.12, 0, 1.48, -0.18, URSO_ESCURO),
      caixa(0.13, 0.1, 0.13, 0, 1.33, 0.18, URSO_FOCINHO), // bota/garra
      caixa(0.13, 0.1, 0.13, 0, 1.33, -0.18, URSO_FOCINHO),
      caixa(0.12, 0.3, 0.12, s * 0.18, 1.85, 0.15, URSO_ESCURO, { z: s * 0.4 }), // braço (machado)
      caixa(0.12, 0.3, 0.12, s * 0.18, 1.85, -0.15, URSO_ESCURO, { z: s * 0.4 }), // braço (rédea)
      caixa(0.07, 0.5, 0.07, s * 0.42, 2.15, 0.15, cores.apoio, { z: s * 0.55 }), // cabo do machado
      caixa(0.05, 0.22, 0.16, s * 0.62, 2.38, 0.15, cores.detalhe, { z: s * 0.55 }), // lâmina
      caixa(0.28, 0.26, 0.26, s * 0.03, 2.2, 0, URSO_CABECA), // cabeça
      caixa(0.13, 0.12, 0.15, s * 0.18, 2.14, 0, URSO_FOCINHO), // focinho
      caixa(0.08, 0.08, 0.07, s * 0.02, 2.35, 0.09, URSO_CABECA), // orelha
      caixa(0.08, 0.08, 0.07, s * 0.02, 2.35, -0.09, URSO_CABECA),
      caixa(0.26, 0.42, 0.05, -s * 0.2, 1.72, 0, URSO_ESCURO, { z: s * 0.12 }), // capa
    )
  }

  const g = mergeGeometries(partes, false)!
  g.computeVertexNormals()
  return g
}

// ═══════════════════════════════════════════════════════════════════════
// 2. HELICÓPTERO DE ATAQUE
// ═══════════════════════════════════════════════════════════════════════

export interface HelicopteroGeo {
  corpo: THREE.BufferGeometry
  rotor: THREE.BufferGeometry
  rotorCauda: THREE.BufferGeometry
}

// o nariz do corpo é sempre desenhado em +x local; diferente da cavalaria e
// dos tanques o helicóptero não recebe `sentido`, porque ele voa livre e
// quem orienta é o chamador girando o grupo inteiro em Y (ver battlefield.ts
// pro padrão de grupo-pivô). os pontos abaixo são ONDE plugar cada rotor,
// medidos a partir da origem local do `corpo`.
export const ALTURA_ROTOR = 1.15
export const HELI_ROTOR_X = 0.3
export const HELI_ROTOR_Z = 0
export const HELI_CAUDA_X = -3.3
export const HELI_CAUDA_Y = 0.75
export const HELI_CAUDA_Z = 0.35
/** ponta do canhão de nariz, em x local (sempre +x, nariz fixo) */
export const PONTA_ARMA_HELI = 2.8

/** corpo ~5.5 de comprimento: cabine com arma de nariz, casco central com
 *  asinhas de pods, cauda afunilando até o estabilizador, trem de pouso em
 *  esqui. `rotor` (4 pás em cruz) e `rotorCauda` (2 pás em cruz, menores)
 *  saem com pivô em (0,0,0) cada: o chamador cria um Group, posiciona nos
 *  pontos HELI_ROTOR_X/Y/Z e HELI_CAUDA_X/Y/Z acima e gira esse grupo (Y pro
 *  rotor principal, X pro de cauda, já que ele varre o plano vertical). */
export function buildHelicopteroGeometry(lado: 'dog' | 'bear'): HelicopteroGeo {
  const cores = lado === 'dog' ? CORES_VEICULO_DOG : CORES_VEICULO_URSO

  const corpo = mergeGeometries([
    // cabine e arma de nariz
    caixa(0.9, 0.75, 0.85, 1.55, 0, 0, cores.corpo),
    caixa(0.75, 0.35, 0.7, 1.65, 0.15, 0, cores.detalhe), // vigia/canopy
    caixa(0.14, 0.14, 0.14, 2.05, -0.28, 0, cores.apoio), // berço da arma
    caixa(0.5, 0.1, 0.1, 2.55, -0.28, 0, cores.apoio), // cano
    caixa(0.1, 0.1, 0.1, PONTA_ARMA_HELI, -0.28, 0, cores.detalhe), // boca

    // casco central
    caixa(2.0, 0.85, 1.0, 0.2, 0.05, 0, cores.corpo),
    caixa(1.9, 0.3, 1.05, 0.2, -0.15, 0, cores.corpoSombra),
    caixa(1.0, 0.4, 0.7, -0.1, 0.55, 0, cores.corpoSombra), // domo do motor
    caixa(0.3, 0.2, 0.5, -0.1, 0.6, 0, cores.detalhe), // entrada de ar

    // mastro (parte fixa; o rotor giratório é peça separada, ver abaixo)
    caixa(0.22, 0.4, 0.22, HELI_ROTOR_X, 0.95, HELI_ROTOR_Z, cores.corpoSombra),

    // asas curtas com pods de míssil
    caixa(0.35, 0.18, 1.9, 0.1, -0.05, 0, cores.corpoSombra),
    caixa(0.24, 0.24, 0.7, 0.1, -0.15, 0.85, cores.apoio),
    caixa(0.24, 0.24, 0.7, 0.1, -0.15, -0.85, cores.apoio),

    // cauda afunilando pro estabilizador
    caixa(2.6, 0.3, 0.28, -2.1, 0.25, 0, cores.corpo),
    caixa(2.6, 0.12, 0.12, -2.1, 0.1, 0, cores.corpoSombra),
    caixa(1.3, 0.14, 0.32, -2.9, 0.35, 0, cores.detalhe), // estabilizador horizontal
    caixa(0.16, 0.9, 0.55, HELI_CAUDA_X, 0.55, 0, cores.corpo), // deriva vertical

    // trem de pouso em esqui
    caixa(0.1, 0.1, 2.4, 0, -0.62, 0.55, cores.apoio),
    caixa(0.1, 0.1, 2.4, 0, -0.62, -0.55, cores.apoio),
    caixa(0.08, 0.35, 0.08, 0.5, -0.4, 0.55, cores.apoio),
    caixa(0.08, 0.35, 0.08, -0.3, -0.4, 0.55, cores.apoio),
    caixa(0.08, 0.35, 0.08, 0.5, -0.4, -0.55, cores.apoio),
    caixa(0.08, 0.35, 0.08, -0.3, -0.4, -0.55, cores.apoio),
  ], false)!
  corpo.computeVertexNormals()

  const rotor = mergeGeometries([
    caixa(0.22, 0.14, 0.22, 0, 0, 0, cores.detalhe), // cubo
    caixa(3.6, 0.06, 0.28, 0, 0, 0, cores.apoio), // pá eixo x
    caixa(0.28, 0.06, 3.6, 0, 0, 0, cores.apoio), // pá eixo z (cruz de 4 pás)
  ], false)!
  rotor.computeVertexNormals()

  const rotorCauda = mergeGeometries([
    caixa(0.12, 0.12, 0.12, 0, 0, 0, cores.detalhe),
    caixa(0.06, 1.0, 0.14, 0, 0, 0, cores.apoio),
    caixa(0.06, 0.14, 1.0, 0, 0, 0, cores.apoio),
  ], false)!
  rotorCauda.computeVertexNormals()

  return { corpo, rotor, rotorCauda }
}

// ═══════════════════════════════════════════════════════════════════════
// 3. JIPE DE METRALHADORA
// ═══════════════════════════════════════════════════════════════════════

export interface JipeGeo {
  corpo: THREE.BufferGeometry
  arma: THREE.BufferGeometry
}

/** pivô da arma na origem do grupo que o chamador cria pra plugar em
 *  (sentido * JIPE_PIVO_ARMA_X, JIPE_PIVO_ARMA_Y, 0) sobre o `corpo`; a boca
 *  fica em (sentido * BOCA_ARMA_JIPE, 0, 0) no espaço local desse grupo,
 *  igual BOCA_CANHAO_DIST de arsenal.ts. */
export const JIPE_PIVO_ARMA_X = 1.05
export const JIPE_PIVO_ARMA_Y = 1.2
export const BOCA_ARMA_JIPE = 1.0

/** corpo ~3.0 de comprimento, aberto (sem teto): piso, capô, para-brisa
 *  inclinado, gaiola de proteção fina, 4 rodas em caixa e pedestal traseiro
 *  onde a metralhadora (peça separada, giratória) se monta. sentido=1 olha
 *  pra +x, sentido=-1 pra -x, igual tanks.ts. */
export function buildJipeGeometry(lado: 'dog' | 'bear', sentido: 1 | -1): JipeGeo {
  const s = sentido
  const cores = lado === 'dog' ? CORES_VEICULO_DOG : CORES_VEICULO_URSO

  const rodas: THREE.BufferGeometry[] = []
  const eixosX = [s * 0.95, -s * 0.85]
  const eixosZ = [0.72, -0.72]
  for (const wx of eixosX) {
    for (const wz of eixosZ) {
      rodas.push(caixa(0.34, 0.62, 0.62, wx, 0.31, wz, cores.apoio)) // pneu
      rodas.push(caixa(0.38, 0.22, 0.22, wx, 0.31, wz, cores.detalhe)) // aro
    }
  }

  const corpo = mergeGeometries([
    caixa(2.8, 0.22, 1.3, 0, 0.42, 0, cores.corpo), // piso/chassi
    caixa(0.5, 0.5, 1.15, s * 1.15, 0.65, 0, cores.corpoSombra), // capô/grade frontal
    caixa(0.06, 0.5, 1.1, s * 0.75, 0.85, 0, cores.detalhe, { z: s * 0.3 }), // para-brisa
    caixa(1.0, 0.35, 1.1, s * 0.15, 0.7, 0, cores.corpoSombra), // banco baixo
    caixa(2.2, 0.16, 0.1, 0, 0.58, 0.62, cores.detalhe), // trilho lateral
    caixa(2.2, 0.16, 0.1, 0, 0.58, -0.62, cores.detalhe),

    // gaiola de proteção (tubos finos)
    caixa(0.08, 0.75, 0.08, s * 0.7, 0.95, 0.6, cores.apoio),
    caixa(0.08, 0.75, 0.08, s * 0.7, 0.95, -0.6, cores.apoio),
    caixa(0.08, 0.85, 0.08, -s * 0.9, 1.0, 0.6, cores.apoio),
    caixa(0.08, 0.85, 0.08, -s * 0.9, 1.0, -0.6, cores.apoio),
    caixa(1.7, 0.08, 0.08, -s * 0.1, 1.4, 0.6, cores.apoio),
    caixa(1.7, 0.08, 0.08, -s * 0.1, 1.4, -0.6, cores.apoio),
    caixa(0.08, 0.08, 1.3, -s * 0.9, 1.4, 0, cores.apoio),
    caixa(0.08, 0.08, 1.25, s * 0.7, 1.35, 0, cores.apoio),

    // pedestal do pivô da metralhadora traseira
    caixa(0.4, 0.5, 0.4, -s * JIPE_PIVO_ARMA_X, 0.95, 0, cores.corpoSombra),

    ...rodas,
  ], false)!
  corpo.computeVertexNormals()

  const arma = mergeGeometries([
    caixa(0.16, 0.3, 0.16, 0, 0, 0, cores.detalhe), // colar de montagem no pivô
    caixa(0.22, 0.22, 0.22, s * 0.1, 0.12, 0, cores.corpoSombra), // culatra
    caixa(0.85, 0.1, 0.1, s * 0.55, 0.12, 0, cores.apoio), // cano
    caixa(0.14, 0.14, 0.14, s * BOCA_ARMA_JIPE, 0.12, 0, cores.detalhe), // boca
  ], false)!
  arma.computeVertexNormals()

  return { corpo, arma }
}
