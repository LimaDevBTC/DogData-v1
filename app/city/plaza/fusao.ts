// A FUSÃO POR ATRIBUTO DE VÉRTICE, genérica: qualquer hierarquia estática
// (GLB carregado) que tenha duas ou mais malhas com material PBR LISO (sem
// mapa nenhum, opaco) vira uma malha e um material só, com cor, rugosidade,
// metalicidade e emissiva indo para ATRIBUTO POR VÉRTICE em vez de UNIFORME
// DE MATERIAL. É a técnica de `props.ts` (ver o cabeçalho de lá, onde ela
// nasceu para `sp-complex`), aqui generalizada para operar em QUALQUER árvore
// de `THREE.Object3D`, não só na lista `Parte[]` de um adereço instanciado.
//
// ⚠️ POR QUE ISTO EXISTE, e por que é o item de maior alavancagem da cena.
// Censo de 02/09 (frente orçamento): lendo o JSON dos seis prédios que
// `plaza-scene.tsx` carrega (central-tower, bitflow-hq, kray-tower, plaza,
// spaceport, btc-mark, cada torre com seu LOD1), 254 dos ~510 materiais da
// entrada padrão da praça vêm desses arquivos. Medido de novo, arquivo por
// arquivo: 250 dos 254 (98%) são PBR liso. É o único lugar da cena onde o
// mesmo trabalho rende centenas de materiais de uma vez.
//
// ⚠️ A RECONSTRUÇÃO É EXATA, NÃO APROXIMADA. Sem mapa não há UV para perder;
// cor, rugosidade, metalicidade e `emissive × emissiveIntensity` (o valor que
// o three já pré-multiplica em `WebGLMaterials.js`) são lidos do material tal
// como ele está NA HORA DA CHAMADA e gravados por vértice. Por isso a ordem
// importa mais que o código: ESTA FUNÇÃO TEM DE RODAR DEPOIS DE QUALQUER
// AJUSTE DE MATERIAL (repintura por nome, `roughness`/`emissiveIntensity`
// mutados em `traverse`), nunca antes, senão ela cozinha o valor de ANTES do
// ajuste. `park.ts` já roda assim; é o padrão para todo chamador novo.
//
// ⚠️ DUAS ARMADILHAS, achadas no censo de 02/09 e as duas reais:
//
//   1. NOME DE MATERIAL QUE REGE REPINTURA. `plaza-scene.tsx` repinta os
//      sítios da Kray e da BitFlow pelo NOME DO MATERIAL (`site_asphalt`,
//      `site_kerb`, `veg_leaf`…) e some com rua/carro por NOME DE NÓ. Fundir
//      ANTES apaga os dois nomes e a repintura não acha mais nada para reger.
//      A ordem certa: repintura (e a subida de massa, `liftMassing`) primeiro,
//      fusão depois, no MESMO objeto, e para as DUAS versões de LOD.
//
//   2. NOME DE NÓ QUE UMA ANIMAÇÃO GUARDA POR REFERÊNCIA. `plaza-scene.tsx`
//      guarda `{ material, base: emissiveIntensity }` de todo nó cujo NOME
//      bate com `/beacon|led|glow|_light|lamp|strip|portal/i` (o "pulses" que
//      faz farol e letreiro respirar) e guarda O NÓ (não o material) de
//      `KRAY_CROWN_ICON`, `WATER_JET` etc. para balançar/girar. O
//      `mergeStaticByMaterial` de `perf.ts` nunca quebra isso porque ele
//      REUTILIZA o mesmo objeto de material ao fundir malhas que já
//      compartilhavam material; esta função NÃO: ela CRIA um material novo e
//      descarta os originais. Fundir um nó guardado por referência apaga a
//      animação em silêncio (o material antigo, órfão, continua mutando sem
//      que nada o desenhe). `keep` PRECISA proteger os dois conjuntos de nome,
//      não só o de posição/giro. O relatório desta rodada traz a lista exata,
//      medida por prédio, dos nós que caem nesta armadilha.
//
// Three.js puro (regra da casa: nada de react-three-fiber).
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** A bandeira, no padrão de `look.ts`: lida uma vez, no módulo, e exportada
 *  para quem precisar do mesmo valor (hoje `park.ts`; amanhã, os seis
 *  prédios de `plaza-scene.tsx`, colados fora daqui porque esse arquivo não é
 *  meu). `?fundir=1` liga; sem a bandeira, nenhuma função deste módulo é
 *  chamada e a cena desenha exatamente o que desenhava antes. */
export const FUNDIR = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('fundir') === '1'

/** PBR liso: nenhum mapa (base, normal, RM, AO, emissiva), opaco. `constructor`
 *  EXATO e não `instanceof`: uma extensão KHR de material físico (specular,
 *  transmissão, ior, clearcoat, sheen…) promove o GLTFLoader a
 *  `MeshPhysicalMaterial`, que HERDA de `MeshStandardMaterial` e passaria pelo
 *  `instanceof` mesmo carregando propriedade que esta fusão não sabe
 *  reconstruir (specular/ior da pedra runestone de `park.ts`, por exemplo). */
export function materialLiso(m: THREE.Material): m is THREE.MeshStandardMaterial {
  if (m.constructor !== THREE.MeshStandardMaterial) return false
  const mm = m as THREE.MeshStandardMaterial
  return !mm.map && !mm.normalMap && !mm.roughnessMap && !mm.metalnessMap
    && !mm.aoMap && !mm.emissiveMap && !mm.alphaMap
    && mm.transparent === false && mm.alphaTest === 0
}

/** Funde, por atributo de vértice, as malhas ESTÁTICAS de `root` cujo material
 *  é PBR liso (`materialLiso`) e do MESMO lado (`side`). `keep` casa com os
 *  nomes de NÓ que não podem entrar: nó animado (posição/giro/escala) OU nó
 *  cujo material uma animação guarda por referência (ver armadilha 2 acima).
 *  Mesma assinatura de `mergeStaticByMaterial` (perf.ts), de propósito: um
 *  chamador que já monta o `keep` certo para aquela função monta o mesmo
 *  `keep`, OU MAIOR, para esta. Devolve quantas malhas entraram e em quantos
 *  materiais viraram (0 ou 1 por lado; 1 malha sozinha não funde, porque
 *  fundir uma coisa só não economiza nada). */
export function fundirMalhasLisas(root: THREE.Object3D, keep: RegExp): { antes: number; fundidas: number } {
  root.updateMatrixWorld(true)
  const pular = new Set<THREE.Object3D>()
  root.traverse((o) => { if (keep.test(o.name)) o.traverse((c) => pular.add(c)) })
  const porLado = new Map<THREE.Side, THREE.Mesh[]>()
  let antes = 0
  root.traverse((o) => {
    const m = o as THREE.Mesh & { isInstancedMesh?: boolean; isSkinnedMesh?: boolean }
    if (!m.isMesh || m.isInstancedMesh || m.isSkinnedMesh || pular.has(o)) return
    if (Array.isArray(m.material)) return
    if (!materialLiso(m.material as THREE.Material)) return
    antes++
    const lado = (m.material as THREE.MeshStandardMaterial).side
    const lista = porLado.get(lado) ?? []
    lista.push(m)
    porLado.set(lado, lista)
  })
  let fundidas = 0
  Array.from(porLado.entries()).forEach(([lado, meshes]) => {
    if (meshes.length < 2) return // uma malha sozinha: fundir não economiza nada
    const geos = meshes.map((mesh) => {
      const mat = mesh.material as THREE.MeshStandardMaterial
      const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()
      for (const a of Object.keys(g.attributes)) if (a !== 'position' && a !== 'normal') g.deleteAttribute(a)
      if (!g.attributes.normal) g.computeVertexNormals()
      g.applyMatrix4(mesh.matrixWorld)
      const n = g.attributes.position.count
      const cor = new Float32Array(n * 3)
      const rm = new Float32Array(n * 2)
      const emit = new Float32Array(n * 3)
      const emissivo = mat.emissive.clone().multiplyScalar(mat.emissiveIntensity)
      for (let i = 0; i < n; i++) {
        cor[i * 3] = mat.color.r; cor[i * 3 + 1] = mat.color.g; cor[i * 3 + 2] = mat.color.b
        rm[i * 2] = mat.roughness; rm[i * 2 + 1] = mat.metalness
        emit[i * 3] = emissivo.r; emit[i * 3 + 1] = emissivo.g; emit[i * 3 + 2] = emissivo.b
      }
      g.setAttribute('color', new THREE.BufferAttribute(cor, 3))
      g.setAttribute('aRoughMetal', new THREE.BufferAttribute(rm, 2))
      g.setAttribute('aEmissivo', new THREE.BufferAttribute(emit, 3))
      return g
    })
    const merged = mergeGeometries(geos, false)
    for (const g of geos) g.dispose()
    for (const mesh of meshes) mesh.removeFromParent()
    const mat = vestirFundido(new THREE.MeshStandardMaterial({ vertexColors: true, side: lado }))
    const mesh = new THREE.Mesh(merged, mat)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.name = 'merged:fundido'
    root.add(mesh)
    fundidas++
  })
  return { antes, fundidas }
}

// Chave de programa FIXA para todo material fundido por esta função: sem ela
// o three compilaria um programa por CHAMADA (uma por prédio, uma por nível
// de LOD), que é o mesmo defeito que motivou o módulo inteiro.
const CHAVE_FUNDIDO = 'dogcity:fusao-lisa-v1'

/** Veste o material fundido com o par vértice → uniforme que os `#include` do
 *  shader padrão normalmente leem de textura: `roughnessmap_fragment` e
 *  `metalnessmap_fragment` sem mapa já resolvem para `roughness`/`metalness`
 *  do material (uniforme única); aqui passam a ler um atributo por vértice, e
 *  o mesmo vale para a radiância emissiva. A cor viaja pelo atributo `color`
 *  nativo do three (`vertexColors: true` já liga `USE_COLOR` sozinho). */
function vestirFundido(mat: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aRoughMetal;\nattribute vec3 aEmissivo;\nvarying vec2 vRoughMetal;\nvarying vec3 vEmissivo;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRoughMetal = aRoughMetal;\nvEmissivo = aEmissivo;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vRoughMetal;\nvarying vec3 vEmissivo;')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vRoughMetal.x;')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vRoughMetal.y;')
      .replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = vEmissivo;')
  }
  mat.customProgramCacheKey = () => CHAVE_FUNDIDO
  return mat
}

/** O padrão de nome que `plaza-scene.tsx` usa para achar farol/letreiro que
 *  RESPIRA (guarda `{material, base: emissiveIntensity}` por referência: ver
 *  a armadilha 2 no cabeçalho). Exportado daqui, não copiado lá, para as duas
 *  pontas nunca divergirem: se o padrão mudar em `plaza-scene.tsx`, muda aqui
 *  também, e quem importa não usa uma cópia velha. Quem monta o `keep` de uma
 *  torre para esta função PRECISA unir isto ao `KEEP` que já protege giro e
 *  balanço, ou o farol para de respirar em silêncio. */
export const NOME_PISCA = /beacon|led|glow|_light|lamp|strip|portal/i
