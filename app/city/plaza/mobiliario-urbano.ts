// ═══════════════════════════════════════════════════════════════════════════
// MOBILIÁRIO URBANO: a infraestrutura que faz a malha virar cidade à noite.
//
// Vias sem luminária têm escala de loteamento: há geometria, mas nenhuma medida
// humana, nenhuma cadência e nenhum motivo para atravessar a cidade depois do
// pôr do sol. Este módulo desenha um único tipo de poste, repetido com disciplina
// nas avenidas e nos anéis. Não é decoração de praça: acompanha a rede viária.
//
// Duas InstancedMesh (mastro e luminária) mantêm milhares de pontos de luz em
// duas chamadas de desenho. A cidade já é grande; objetos individuais aqui seriam
// a maneira errada de ganhar detalhe.
//
// ── look 2: o poste MODELADO ───────────────────────────────────────────────
// O poste de primitiva lê, na chapa rasante, como uma esfera branca num palito
// preto. Atrás de `?look=2` entra `public/city/mobiliario-urbano.glb`, saído de
// `blender/build_mobiliario.py`: fuste octogonal com dois troncos de cone, braço
// varrido num arco de 90° tangente ao fuste, e cabeça em DUAS malhas, carcaça e
// difusor, para o difusor acender sem a carcaça acender junto.
//
// ⚠️ ORÇAMENTO, medido no exportador: o poste modelado tem 178 triângulos
// (166 no mastro, 12 no difusor). 7.200 × 178 = 1.281.600 triângulos, e a cena
// inteira mede 6,3 M: o GLB NÃO pode ser o poste de todo mundo. Por isso ele é
// só o LOD PERTO. O caminho de primitiva continua desenhando os 7.200 (≈60 tris
// cada, ≈432 k) e `atualizar(camera)` troca os DETALHE_MAX (640) mais próximos
// da câmera pelo modelo: 640 × 178 = 113.920 triângulos a mais, ≈1,8% da cena.
//
// ⚠️ MATERIAL É O RECURSO ESCASSO (a cena compila +120 programas, teto medido
// perto de 235). O GLB entra só como GEOMETRIA: os materiais dele são
// descartados e as instâncias detalhadas reusam `posteMat` e `luzMat`, os mesmos
// dois do caminho de primitiva. Saldo de programas novos: ZERO.
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { AVENIDAS, avenidasGeom } from './teia'
import { look2 } from './look'

export interface AnelViario { r: number; larg: number }
export interface MobiliarioUrbanoOpts {
  heightAt: (x: number, z: number) => number
  /** A malha viária termina na baía; iluminação também. */
  molhado?: (x: number, z: number) => boolean
  aneis: AnelViario[]
  sombra?: boolean
  /** O carregador da cena, JÁ com DRACOLoader: o GLB vem comprimido em Draco e
   *  um GLTFLoader sem decodificador falha com "No DRACOLoader instance
   *  provided". Sem ele, o look 2 simplesmente fica no poste de primitiva. */
  gltf?: GLTFLoader
}

export interface MobiliarioUrbano {
  group: THREE.Group
  postes: number
  /** Resolve quando o GLB do look 2 entrou (ou na hora, no look 1). */
  pronto: Promise<void>
  /** Chame no laço de quadro. Só faz trabalho quando a câmera anda mais de
   *  PASSO_REFAZ metros; fora disso retorna na primeira linha. */
  atualizar(camera: THREE.Camera): void
  dispose(): void
}

/** Os nós do GLB, para quem mais quiser mobiliário modelado (orla, canteiro).
 *  `GRADIL_MODULO` corre em +X de x=0 a x=2,40 e encadeia sem sobrepor. */
export const PECAS_MOBILIARIO = [
  'LUM_MASTRO', 'LUM_DIFUSOR', 'GRADIL_MODULO', 'LIXEIRA', 'BALIZADOR', 'BALIZADOR_LUZ',
] as const
export type PecaMobiliario = (typeof PECAS_MOBILIARIO)[number]

const URL_GLB = '/city/mobiliario-urbano.glb'
let cacheGeo: Promise<Map<string, THREE.BufferGeometry>> | null = null

/** Carrega o GLB uma vez por página e devolve só as GEOMETRIAS, por nome de nó.
 *  Os materiais do arquivo ficam de fora de propósito: quem instancia usa os
 *  materiais que já existem na cena, para não somar programa de shader. */
export function carregarPecas(gltf: GLTFLoader): Promise<Map<string, THREE.BufferGeometry>> {
  if (cacheGeo) return cacheGeo
  cacheGeo = gltf.loadAsync(URL_GLB).then((g) => {
    const mapa = new Map<string, THREE.BufferGeometry>()
    g.scene.updateMatrixWorld(true)
    g.scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      // ⚠️ A geometria é local, com a origem no PÉ da peça; a translação do nó
      // no arquivo é só o espalhamento que separa as peças no Blender e tem de
      // ser IGNORADA, senão a lixeira nasce 11 m ao lado do poste.
      mapa.set(m.name.replace(/_\d+$/, ''), m.geometry)
      const mat = m.material as THREE.Material | THREE.Material[]
      for (const x of Array.isArray(mat) ? mat : [mat]) x?.dispose()
    })
    return mapa
  }).catch(() => new Map<string, THREE.BufferGeometry>())
  return cacheGeo
}

// ── O OMBRO MOBILIADO (02/09) ──────────────────────────────────────────────
// ⚠️ O GRADIL E O BALIZADOR EXISTIAM NO GLB E NÃO ESTAVAM EM LUGAR NENHUM. O
// arquivo publica seis peças (`PECAS_MOBILIARIO`) e só duas eram usadas, as do
// poste. As outras estavam ali desde 01/09 sem um único consumidor, que é a
// armadilha "nem tudo que é importado é chamado" na versão de dado: peça pronta,
// exportada, e invisível.
//
// ⚠️ E ELAS SÃO A HIERARQUIA, NÃO ENFEITE. `vias.ts` passou a dar ombro largo com
// soleira à avenida e ombro estreito ao anel; aqui a diferença fica legível de
// dentro do carro: AVENIDA GANHA GRADIL, ANEL GANHA BALIZADOR. Duas vias com a
// mesma seção e mobiliário diferente já leem como duas classes de via.
//
// ⚠️ ORÇAMENTO, medido no cabeçalho JSON do GLB: gradil 128 triângulos por
// módulo, balizador 40. Contínuos, seriam ~23 mil instâncias e mais de 2 M de
// triângulos, ou seja um terço da cena por causa de guarda-corpo. Por isso eles
// entram pelo MESMO LOD do poste modelado: a lista inteira fica em memória como
// (x, z, giro) e só as mais próximas viram matriz. Teto: 900 gradis (115.200
// tris) e 700 balizadores (28.000), e só quando a câmera está na rua.
//
// ⚠️ CUSTO DE CHAMADA: +2, e é o limite que o orçamento desta rodada permitia.
// Foi por isso que BALIZADOR_LUZ ficou de fora: acender o balizador seria uma
// terceira InstancedMesh, com material emissivo próprio. Fica registrado como a
// próxima peça a entrar se sobrar chamada.
//
// ⚠️ O GIRO É O NEGATIVO DO RUMO, e isso não é gosto. Uma rotação em Y no three
// leva o +X local para (cos θ, 0, −sen θ): com θ = atan2(uz, ux) o módulo de
// gradil, que corre em +X, sairia ESPELHADO em z e a corrida de 12 m se afastaria
// da via em vez de acompanhá-la. O poste não sofre disso porque é quase
// simétrico; o gradil sofre, e apareceria como cerca cruzando a pista.
const PASSO_AVENIDA = 36
const PASSO_ANEL = 44
const MAX_POSTES = 7200
/** módulo de gradil: corre em +X de 0 a 2,40 m e encadeia sem sobrepor */
const GRADIL_MODULO = 2.40
/** módulos por corrida de gradil, e de quantos em quantos metros uma corrida sai */
const GRADIL_MODULOS = 5
const GRADIL_PASSO = 96
/** balizador do anel, um a cada tantos metros */
const BALIZ_PASSO = 22
const GRADIL_MAX = 900
const BALIZ_MAX = 700
const RAIO_GRADIL = 420
const RAIO_BALIZ = 320
/** Teto de postes modelados vivos ao mesmo tempo. 640 × 178 tris = 113.920. */
const DETALHE_MAX = 640
/** Além disto o modelado não paga: o poste tem 7 m e some na perspectiva. */
const RAIO_DETALHE = 300
/** A câmera precisa andar isto para a lista de perto ser refeita. */
const PASSO_REFAZ = 30

export function buildMobiliarioUrbano(o: MobiliarioUrbanoOpts): MobiliarioUrbano {
  const group = new THREE.Group()
  group.name = 'mobiliario-urbano'
  const pontos: { x: number; z: number; giro: number }[] = []
  const molhado = o.molhado ?? (() => false)

  const por = (x: number, z: number, giro: number) => {
    if (pontos.length >= MAX_POSTES || molhado(x, z)) return
    pontos.push({ x, z, giro })
  }

  // as peças do ombro, guardadas como número solto e não como Matrix4: são
  // dezenas de milhares de candidatas e só as próximas da câmera viram matriz
  const gradis: { x: number; z: number; giro: number }[] = []
  const balizas: { x: number; z: number; giro: number }[] = []
  const peca = (lista: { x: number; z: number; giro: number }[],
                x: number, z: number, giro: number) => {
    if (molhado(x, z)) return
    lista.push({ x, z, giro })
  }

  // Em avenidas, os mastros ficam no passeio, voltados para a pista. As duas
  // fileiras alternam meio passo: a rua ganha ritmo sem parecer pista de pouso.
  for (const av of avenidasGeom()) {
    const dx = av.x1 - av.x0, dz = av.z1 - av.z0
    const L = Math.hypot(dx, dz)
    const ux = dx / L, uz = dz / L
    const px = -uz, pz = ux
    const distBorda = av.largura / 2 - 2.15
    for (const lado of [-1, 1]) {
      const inicio = lado < 0 ? PASSO_AVENIDA * 0.5 : PASSO_AVENIDA
      for (let d = inicio; d < L - 22; d += PASSO_AVENIDA) {
        por(av.x0 + ux * d + px * distBorda * lado,
            av.z0 + uz * d + pz * distBorda * lado,
            Math.atan2(uz, ux) + (lado < 0 ? Math.PI : 0))
      }
    }
    // ── o gradil da avenida, no ombro, em corridas curtas ────────────────
    // ⚠️ ELE VAI ALÉM DA CALÇADA, EM CIMA DA SOLEIRA QUE `vias.ts` DESENHOU.
    // Encostado no meio-fio ele leria como grade de canteiro; no ombro ele
    // fecha a borda da via, que é o que a chapa de cima estava pedindo.
    const rumo = -Math.atan2(uz, ux)
    const noOmbro = av.largura / 2 + 1.2
    for (let d = GRADIL_PASSO * 0.5; d < L - 40; d += GRADIL_PASSO) {
      for (const lado of [-1, 1]) {
        for (let m2 = 0; m2 < GRADIL_MODULOS; m2++) {
          const dd = d + m2 * GRADIL_MODULO
          peca(gradis,
               av.x0 + ux * dd + px * noOmbro * lado,
               av.z0 + uz * dd + pz * noOmbro * lado,
               rumo)
        }
      }
    }
  }

  // Os anéis são polígonos, como as vias em vias.ts: a iluminação percorre cada
  // corda entre rotatórias, em vez de desenhar um círculo que escaparia da rua.
  for (const anel of o.aneis) {
    for (let i = 0; i < AVENIDAS.length; i++) {
      const a0 = (i / AVENIDAS.length) * Math.PI * 2
      const a1 = ((i + 1) / AVENIDAS.length) * Math.PI * 2
      const x0 = Math.sin(a0) * anel.r, z0 = -Math.cos(a0) * anel.r
      const x1 = Math.sin(a1) * anel.r, z1 = -Math.cos(a1) * anel.r
      const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz)
      const ux = dx / L, uz = dz / L
      const px = -uz, pz = ux
      const distBorda = anel.larg / 2 - 1.8
      for (const lado of [-1, 1]) {
        const inicio = lado < 0 ? PASSO_ANEL * 0.5 : PASSO_ANEL
        for (let d = inicio; d < L - 20; d += PASSO_ANEL) {
          por(x0 + ux * d + px * distBorda * lado,
              z0 + uz * d + pz * distBorda * lado,
              Math.atan2(uz, ux) + (lado < 0 ? Math.PI : 0))
        }
      }
      // ── o balizador do anel: cadência fina onde a avenida tem gradil ────
      const rumoA = -Math.atan2(uz, ux)
      const noOmbroA = anel.larg / 2 + 1.0
      for (const lado of [-1, 1]) {
        for (let d = BALIZ_PASSO; d < L - 24; d += BALIZ_PASSO) {
          peca(balizas,
               x0 + ux * d + px * noOmbroA * lado,
               z0 + uz * d + pz * noOmbroA * lado,
               rumoA)
        }
      }
    }
  }

  // O mastro tem base, fuste e braço curto em uma geometria. A luminária é
  // separada para ter emissivo próprio — a forma continua legível de dia.
  const fuste = new THREE.CylinderGeometry(0.12, 0.19, 6.4, 8)
  fuste.translate(0, 3.2, 0)
  const base = new THREE.CylinderGeometry(0.34, 0.42, 0.18, 8)
  base.translate(0, 0.09, 0)
  const braco = new THREE.BoxGeometry(0.9, 0.10, 0.10)
  braco.translate(0.42, 6.22, 0)
  const posteGeo = merge([fuste, base, braco])
  const luzGeo = new THREE.CylinderGeometry(0.23, 0.18, 0.18, 8)
  luzGeo.rotateZ(Math.PI / 2)
  luzGeo.translate(0.88, 6.18, 0)

  const posteMat = new THREE.MeshStandardMaterial({ color: '#272A30', roughness: 0.42, metalness: 0.78 })
  const luzMat = new THREE.MeshStandardMaterial({ color: '#FFD59A', emissive: '#F6A74B', emissiveIntensity: 2.2, roughness: 0.32, metalness: 0.08 })
  const mastros = new THREE.InstancedMesh(posteGeo, posteMat, Math.max(1, pontos.length))
  const luminarias = new THREE.InstancedMesh(luzGeo, luzMat, Math.max(1, pontos.length))
  mastros.name = 'urbano:mastros'
  luminarias.name = 'urbano:luminarias'
  mastros.castShadow = o.sombra ?? true
  mastros.receiveShadow = true
  luminarias.castShadow = false
  mastros.frustumCulled = false
  luminarias.frustumCulled = false

  const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1)
  const eixoY = new THREE.Vector3(0, 1, 0)
  // A matriz de cada poste fica guardada: o LOD do look 2 precisa REPOR a
  // primitiva quando a câmera se afasta, e recompor do zero custa um seno por
  // poste por refazimento.
  const matrizes: THREE.Matrix4[] = []
  pontos.forEach((pt, i) => {
    p.set(pt.x, o.heightAt(pt.x, pt.z) + 0.35, pt.z)
    q.setFromAxisAngle(eixoY, pt.giro)
    m.compose(p, q, s)
    matrizes.push(m.clone())
    mastros.setMatrixAt(i, m)
    luminarias.setMatrixAt(i, m)
  })
  mastros.instanceMatrix.needsUpdate = true
  luminarias.instanceMatrix.needsUpdate = true
  group.add(mastros, luminarias)

  // ── LOD do look 2: os postes modelados ────────────────────────────────────
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0)
  let mastrosGLB: THREE.InstancedMesh | null = null
  let difusoresGLB: THREE.InstancedMesh | null = null
  let gradilMesh: THREE.InstancedMesh | null = null
  let balizMesh: THREE.InstancedMesh | null = null
  let escondidos: number[] = []
  const camAnterior = new THREE.Vector3(1e9, 1e9, 1e9)
  let primeira = true

  const pronto: Promise<void> = (look2 && o.gltf && pontos.length)
    ? carregarPecas(o.gltf).then((geo) => {
        // ── as peças do ombro entram ANTES do poste ──────────────────────
        // ⚠️ E A ORDEM IMPORTA: o bloco do poste tem um `return` quando o GLB não
        // traz a luminária, e escrever o gradil depois dele o deixaria refém de
        // uma peça que não é dele. Cada peça que falta desliga só a si mesma.
        const gGradil = geo.get('GRADIL_MODULO')
        if (gGradil && gradis.length) {
          gradilMesh = new THREE.InstancedMesh(gGradil, posteMat, Math.min(GRADIL_MAX, gradis.length))
          gradilMesh.name = 'urbano:gradil'
          gradilMesh.castShadow = o.sombra ?? true
          gradilMesh.receiveShadow = true
          gradilMesh.frustumCulled = false
          // ⚠️ count 0 até o primeiro `atualizar`, pelo mesmo motivo do poste:
          // InstancedMesh recém-nascida tem matriz zerada e desenharia a
          // corrida inteira espremida na origem.
          gradilMesh.count = 0
          group.add(gradilMesh)
        }
        const gBaliz = geo.get('BALIZADOR')
        if (gBaliz && balizas.length) {
          balizMesh = new THREE.InstancedMesh(gBaliz, posteMat, Math.min(BALIZ_MAX, balizas.length))
          balizMesh.name = 'urbano:balizador'
          balizMesh.castShadow = false      // 96 cm de poste não pagam mapa de sombra
          balizMesh.receiveShadow = true
          balizMesh.frustumCulled = false
          balizMesh.count = 0
          group.add(balizMesh)
        }
        primeira = true
        const gMastro = geo.get('LUM_MASTRO')
        const gDifusor = geo.get('LUM_DIFUSOR')
        if (!gMastro || !gDifusor) return
        const n = Math.min(DETALHE_MAX, pontos.length)
        mastrosGLB = new THREE.InstancedMesh(gMastro, posteMat, n)
        difusoresGLB = new THREE.InstancedMesh(gDifusor, luzMat, n)
        mastrosGLB.name = 'urbano:mastros-glb'
        difusoresGLB.name = 'urbano:luminarias-glb'
        mastrosGLB.castShadow = o.sombra ?? true
        mastrosGLB.receiveShadow = true
        difusoresGLB.castShadow = false
        mastrosGLB.frustumCulled = false
        difusoresGLB.frustumCulled = false
        // count 0 até o primeiro `atualizar`: uma InstancedMesh recém-nascida
        // tem as matrizes zeradas e desenharia 640 postes espremidos na origem.
        mastrosGLB.count = 0
        difusoresGLB.count = 0
        group.add(mastrosGLB, difusoresGLB)
        primeira = true
      })
    : Promise.resolve()

  const alvo = new THREE.Vector3()
  const perto: { i: number; d: number }[] = []
  const escolhidas: { i: number; d: number }[] = []

  /** preenche uma InstancedMesh com as `max` peças mais próximas dentro de `raio` */
  const pertoDe = (
    malha: THREE.InstancedMesh | null,
    lista: { x: number; z: number; giro: number }[],
    raio: number, max: number,
  ) => {
    if (!malha) return
    const r2 = raio * raio
    escolhidas.length = 0
    for (let i = 0; i < lista.length; i++) {
      const dx = lista[i].x - alvo.x, dz = lista[i].z - alvo.z
      const d = dx * dx + dz * dz
      if (d < r2) escolhidas.push({ i, d })
    }
    escolhidas.sort((a, b) => a.d - b.d)
    const n = Math.min(escolhidas.length, max)
    for (let k = 0; k < n; k++) {
      const p2 = lista[escolhidas[k].i]
      p.set(p2.x, o.heightAt(p2.x, p2.z), p2.z)
      q.setFromAxisAngle(eixoY, p2.giro)
      m.compose(p, q, s)
      malha.setMatrixAt(k, m)
    }
    malha.count = n
    malha.instanceMatrix.needsUpdate = true
  }

  function atualizar(camera: THREE.Camera) {
    if (!mastrosGLB && !gradilMesh && !balizMesh) return
    camera.getWorldPosition(alvo)
    if (!primeira && alvo.distanceToSquared(camAnterior) < PASSO_REFAZ * PASSO_REFAZ) return
    primeira = false
    camAnterior.copy(alvo)

    // ⚠️ O OMBRO É REFEITO ANTES DO POSTE, E FORA DA GUARDA DELE: o gradil não
    // pode depender de o GLB ter trazido a luminária.
    pertoDe(gradilMesh, gradis, RAIO_GRADIL, GRADIL_MAX)
    pertoDe(balizMesh, balizas, RAIO_BALIZ, BALIZ_MAX)
    if (!mastrosGLB || !difusoresGLB) return

    // repõe as primitivas que a rodada anterior tinha apagado
    for (const i of escondidos) mastros.setMatrixAt(i, matrizes[i])
    for (const i of escondidos) luminarias.setMatrixAt(i, matrizes[i])

    perto.length = 0
    const r2 = RAIO_DETALHE * RAIO_DETALHE
    for (let i = 0; i < pontos.length; i++) {
      const dx = pontos[i].x - alvo.x, dz = pontos[i].z - alvo.z
      const d = dx * dx + dz * dz
      if (d < r2) perto.push({ i, d })
    }
    perto.sort((a, b) => a.d - b.d)
    const n = Math.min(perto.length, DETALHE_MAX)

    escondidos = []
    for (let k = 0; k < n; k++) {
      const i = perto[k].i
      mastrosGLB.setMatrixAt(k, matrizes[i])
      difusoresGLB.setMatrixAt(k, matrizes[i])
      // o poste de primitiva do mesmo ponto some, senão os dois se
      // interpenetram e o fuste ganha uma casca dupla que brilha em z-fight
      mastros.setMatrixAt(i, ZERO)
      luminarias.setMatrixAt(i, ZERO)
      escondidos.push(i)
    }
    mastrosGLB.count = n
    difusoresGLB.count = n
    mastrosGLB.instanceMatrix.needsUpdate = true
    difusoresGLB.instanceMatrix.needsUpdate = true
    mastros.instanceMatrix.needsUpdate = true
    luminarias.instanceMatrix.needsUpdate = true
  }

  return {
    group,
    postes: pontos.length,
    pronto,
    atualizar,
    dispose() {
      posteGeo.dispose(); luzGeo.dispose(); posteMat.dispose(); luzMat.dispose(); group.clear()
    },
  }
}

function merge(geometrias: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = [], nor: number[] = [], ind: number[] = []
  for (const g of geometrias) {
    const base = pos.length / 3
    const p = g.getAttribute('position') as THREE.BufferAttribute
    const n = g.getAttribute('normal') as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i))
      nor.push(n.getX(i), n.getY(i), n.getZ(i))
    }
    const ix = g.getIndex()
    if (ix) for (let i = 0; i < ix.count; i++) ind.push(base + ix.getX(i))
    else for (let i = 0; i < p.count; i++) ind.push(base + i)
    g.dispose()
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  out.setIndex(ind)
  return out
}
