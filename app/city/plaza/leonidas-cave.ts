// O TEMPLO LEONIDAS DENTRO DA CAVERNA (praca-ajustes.md item 14).
//
// O pedido do fundador: "o templo será preto e laranja, entre as monarcas, dentro
// de uma caverna", com caminho secreto. Então o salão saiu do pódio (onde estava
// à vista, e torto) e entrou numa câmara escavada no flanco leste do maciço do
// Monarca, entre as pedras grandes:
//
//   · a ROCHA vem de `blender/build_leonidas_cave.py` → leonidas-cave.glb:
//     basalto preto. Em 2026-08-26 ela virou três peças (boca pequena de 7,2 m
//     de vão, corredor em S de 65 m que corta a linha de visão, e um SALÃO de
//     90 x 81 m de piso com 42 m de pé direito), mais matacões que escondem a
//     entrada de quem passa longe;
//   · o JARDIM DO PÁTIO é vegetação de caverna em volta do templo: cogumelos de
//     textura emissiva e crostas de líquen, tudo em azul frio contra o âmbar do
//     prédio. Ver `buildCaveGarden`;
//   · o SALÃO é o mesmo modelo japonês (carolinefangel, CC-BY-4.0), repintado:
//     todas as superfícies vão para o preto e o laranja entra como LUZ e como
//     fio de brasa (cumeeira, portal, lanternas). Preto e laranja, a marca;
//   · o CAMINHO SECRETO é uma fieira de lajes que sai do pódio do precinto e
//     vai rareando até a boca: quem não procurar, não acha.
//
// Quadro: tudo em LOCAL do parque (o mesmo de park.ts). O grupo é posto na
// soleira da boca, com +X saindo dela.
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { loadSf, dressSf, SF } from './sf-assets'
import type { PerfProfile, DistanceCuller } from './perf'

/** A boca da caverna, em LOCAL do parque (x, z do three). Fica a 340 m do
 *  Monarca no azimute 80°, num pocket de flanco a 23° com cinco pedras grandes
 *  a menos de 110 m: escondida, mas entre as monarcas. */
export const CAVE_LOCAL = { x: 335, z: -59 }
/** giro do grupo: +X local sai pela boca, morro abaixo (azimute 80°) */
export const CAVE_YAW = THREE.MathUtils.degToRad(10)
/** A CAMADA DA CAVERNA. O sol da praça é uma direcional sem oclusão: ele
 *  atravessa a rocha e acende o piso da câmara como se não houvesse teto (medido:
 *  o interior lia cinza-médio). Piso e salão vão para esta camada, que o sol e o
 *  hemisférico NÃO enxergam, só as brasas daqui de dentro. A câmera precisa
 *  habilitá-la (`camera.layers.enable(CAVE_LAYER)` em plaza-scene). */
export const CAVE_LAYER = 3

const ORANGE = 0xf7931a
const EMBER = 0xff8a2b
/** o frio do jardim. O âmbar é do TEMPLO e o frio é da vegetação: separados
 *  assim, a câmara lê como duas coisas (um prédio aceso no meio de um mato que
 *  brilha), e não como um monte de luzinhas da mesma cor. */
const SPORE = 0x4a90d9
/** ATENÇÃO, o significado deste número encolheu. Ele era a escala que
 *  `build_leonidas_cave.py` aplicava na rocha inteira, espelhada aqui para que o
 *  .ts pudesse posicionar por múltiplos dela. A assadeira de 2026-08-26 passou a
 *  emitir METROS FINAIS, sem multiplicador nenhum, e o interior mudou de figura
 *  (o meio do salão andou de x = −44 para x ≈ −71).
 *
 *  Então o que ainda depende de `S` são SÓ as peças presas à soleira, que é a
 *  origem e não se mexeu: monólitos, fio de brasa do chão, lanternas da garganta,
 *  braseiros e as duas luzes da boca. Tudo que é do INTERIOR (templo, cumeeira,
 *  luz do salão, jardim) passou a ser MEDIDO da malha do piso em `chamberPlan`,
 *  justamente para não precisar de outra rodada de números na próxima ampliação. */
const S = 2.0

export interface LeonidasCave {
  group: THREE.Group
  /** o ponto de mundo da boca, para o menu Places */
  mouthLocal: THREE.Vector3
  update: (t: number) => void
  dispose: () => void
}

/** Repinta o salão: tudo preto (a textura continua, só multiplicada para baixo),
 *  nada de brilho frio. O laranja é acrescentado depois, como brasa. */
function blacken(root: THREE.Object3D) {
  const seen = new Set<THREE.Material>()
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const mats = Array.isArray(m.material) ? m.material : [m.material]
    m.material = mats.map((mm) => {
      const src = mm as THREE.MeshStandardMaterial
      if (seen.has(src)) return src
      const mat = src.clone()
      seen.add(mat)
      mat.color = new THREE.Color(0x0e0e12)
      mat.roughness = Math.min(0.95, (mat.roughness ?? 0.6) + 0.3)
      mat.metalness = Math.min(0.2, mat.metalness ?? 0)
      mat.envMapIntensity = 0.25
      return mat
    }) as THREE.Material[]
    if ((m.material as THREE.Material[]).length === 1) m.material = (m.material as THREE.Material[])[0]
  })
}

/** A planta do SALÃO, lida da malha do piso em tempo de execução: onde é o meio
 *  do pátio e até onde ele vai.
 *
 *  Por que a caixa da malha não serve: a mesma malha traz a laje do salão E a
 *  FITA DO CORREDOR, que sai da laje e vai até a boca. A união das duas puxa o
 *  centro para a boca e infla o comprimento. Medido em 2026-08-26: caixa de
 *  131 x 90 m para uma laje de 100 x 90 m, com o centro 16 m fora do lugar.
 *  Plantar por essa caixa joga canteiro dentro da rocha.
 *
 *  Então mede por FATIAS em x: a fatia do salão é larga (dezenas de metros de
 *  corda) e a do corredor é estreita (11,6 m no ponto mais aberto). Fica só o que
 *  for largo. A conta não sabe nada sobre a caverna de hoje: valeu para a laje
 *  redonda de ontem, vale para a elipse com rabo de hoje e vale para a próxima. */
function chamberPlan(mesh: THREE.Mesh): { cx: number; cz: number; r: number; top: number } | null {
  const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute | undefined
  if (!pos) return null
  mesh.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(mesh)
  const x0 = box.min.x, span = Math.max(1e-6, box.max.x - x0)
  const BINS = 48
  const lo = new Float64Array(BINS).fill(Infinity)
  const hi = new Float64Array(BINS).fill(-Infinity)
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld)
    const b = THREE.MathUtils.clamp(Math.floor(((v.x - x0) / span) * BINS), 0, BINS - 1)
    if (v.z < lo[b]) lo[b] = v.z
    if (v.z > hi[b]) hi[b] = v.z
  }
  let widest = 0
  for (let b = 0; b < BINS; b++) widest = Math.max(widest, hi[b] - lo[b])
  if (!(widest > 0)) return null
  let bMin = -1, bMax = -1, zMin = Infinity, zMax = -Infinity
  for (let b = 0; b < BINS; b++) {
    if (!(hi[b] - lo[b] >= widest * 0.35)) continue
    if (bMin < 0) bMin = b
    bMax = b
    zMin = Math.min(zMin, lo[b]); zMax = Math.max(zMax, hi[b])
  }
  if (bMin < 0) return null
  const w = span / BINS
  const ax0 = x0 + bMin * w, ax1 = x0 + (bMax + 1) * w
  // a laje é assada MAIOR que o vazio de propósito ("a borda enterra na parede e
  // não sobra fresta entre piso e rocha": 100 x 90 m de laje para 90 x 81 m de
  // salão). Então o pátio pisável é 0,88 da laje, não a laje inteira.
  const r = Math.min(ax1 - ax0, zMax - zMin) * 0.5 * 0.88
  return { cx: (ax0 + ax1) * 0.5, cz: (zMin + zMax) * 0.5, r, top: box.max.y }
}

/** Ruído determinístico por índice. `Math.random` é proibido nas cenas da praça:
 *  a mesma caverna precisa nascer idêntica em todo aparelho e em toda recarga,
 *  senão a chapa de ontem não compara com a de hoje. */
function hash1(i: number, salt: number): number {
  const s = Math.sin(i * 127.1 + salt * 311.7 + 13.37) * 43758.5453123
  return s - Math.floor(s)
}

/** TODAS as primitivas de um GLB, com a matriz de mundo já assada na geometria:
 *  é o par (geometria, material) que o InstancedMesh exige. O `firstGeometry` do
 *  sf-assets devolve só a primeira, e o cogumelo em cacho tem duas (haste e
 *  chapéu, materiais diferentes), e com ela o chapéu ficava de fora. */
function primitivesOf(root: THREE.Object3D): { geo: THREE.BufferGeometry; mat: THREE.MeshStandardMaterial }[] {
  const out: { geo: THREE.BufferGeometry; mat: THREE.MeshStandardMaterial }[] = []
  root.updateMatrixWorld(true)
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const geo = m.geometry.clone()
    geo.applyMatrix4(m.matrixWorld)
    out.push({ geo, mat: (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial })
  })
  return out
}

/** Adapta um material de cogumelo ao escuro da câmara. Os dois modelos já vêm com
 *  TEXTURA EMISSIVA do Sketchfab, que é o motivo de terem sido escolhidos: eles
 *  leem sem luz nenhuma, que é o pedido ("lá não teremos luz"). O que muda aqui:
 *   · a força do glTF (KHR_materials_emissive_strength = 7,3 no alto) estoura no
 *     tone mapping da praça e vira uma bola branca; cai para a banda de brasa;
 *   · a franja do chapéu é alfa. Transparente + InstancedMesh dá ordem de desenho
 *     errada (a franja de trás apaga a da frente); vira recorte por alphaTest;
 *   · sem céu na câmara, envMapIntensity alto só suja o preto. */
function shroomMat(src: THREE.MeshStandardMaterial, intensity: number, fallbackEmissive?: number): THREE.MeshStandardMaterial {
  const m = src.clone()
  if (!m.emissiveMap && fallbackEmissive !== undefined) m.emissive = new THREE.Color(fallbackEmissive)
  m.emissiveIntensity = intensity
  m.envMapIntensity = 0.1
  m.metalness = 0
  m.roughness = Math.min(1, (m.roughness ?? 0.7) + 0.15)
  if (m.transparent) { m.transparent = false; m.alphaTest = 0.45 }
  return m
}

/** O JARDIM DO PÁTIO, em LOCAL do grupo da caverna (mesmo quadro do salão).
 *
 *  Pedido do fundador: "um pátio com jardim em torno do templo (precisa ser algum
 *  tipo de planta diferente, pois lá não teremos luz)". Então a flora é de
 *  caverna: cogumelos de textura emissiva e crostas de líquen. A luz da cena é a
 *  PRÓPRIA vegetação: emissivo frio mais três pontos baratos, um por canteiro
 *  grande. O salão continua na penumbra, que é a graça.
 *
 *  NENHUMA posição é chutada. A rocha é assada no Blender e cresce de vez em
 *  quando (a escala já subiu de 1,35 para 2,0, e a câmara está sendo ampliada de
 *  novo), e o salão é assentado por medida. Tudo aqui sai do BOUNDING BOX real do
 *  piso da câmara e do salão, lidos depois de carregados: caverna maior, jardim
 *  maior, sem outra rodada de números.
 */
function buildCaveGarden(opts: {
  tall: THREE.Object3D | null
  cluster: THREE.Object3D | null
  /** a planta do salão, de `chamberPlan` */
  plan: { cx: number; cz: number; r: number; top: number }
  /** a caixa do salão JÁ assentado */
  hallBox: THREE.Box3 | null
  low: boolean
}): { group: THREE.Group; mats: THREE.MeshStandardMaterial[]; lights: THREE.PointLight[]; junk: { dispose: () => void }[]; instances: number; draws: number } | null {
  const { plan, hallBox: hb, low } = opts

  // ── a régua ──────────────────────────────────────────────────────────────
  const floorC = new THREE.Vector3(plan.cx, plan.top, plan.cz)
  const floorR = plan.r
  const floorTop = plan.top
  const hallC = new THREE.Vector3()
  // a calçada nua rente ao templo: a PLANTA dele mais 3,5 m de passeio. Guardado
  // como meia-caixa e não como raio de propósito: ver `hallRadius` abaixo.
  let keepX: number, keepZ: number
  if (hb) {
    hb.getCenter(hallC)
    const hs = hb.getSize(new THREE.Vector3())
    keepX = hs.x * 0.5 + 3.5
    keepZ = hs.z * 0.5 + 3.5
  } else {
    // sem salão (o glb do templo faltou), o jardim ainda acontece: um anel em
    // torno do meio do pátio, com um vazio no meio do tamanho de um templo
    hallC.copy(floorC)
    keepX = keepZ = floorR * 0.4
  }

  /** O raio da caixa do templo NA DIREÇÃO `a`. É a peça que evita os dois erros
   *  opostos que a conferência pegou: com um raio único de "meio-lado + folga" o
   *  anel entrava pelos CANTOS da planta (duas peças dentro do salão a 39° do
   *  eixo); com um raio único de meia-DIAGONAL ele limpava os cantos mas deixava
   *  10 m de piso nu nos flancos, porque a planta é 30 x 24,6 m e não um quadrado.
   *  Seguindo a caixa, o canteiro encosta no passeio dos quatro lados. */
  const hallRadius = (a: number) => {
    const ca = Math.abs(Math.cos(a)), sa = Math.abs(Math.sin(a))
    return Math.min(ca > 1e-3 ? keepX / ca : Infinity, sa > 1e-3 ? keepZ / sa : Infinity)
  }
  const hallMax = Math.hypot(keepX, keepZ)   // o canto: o mais longe que a caixa chega

  // o `off` desconta o quanto o templo está descentrado do pátio, então o aro
  // cabe dentro do piso em QUALQUER ângulo, não só no ângulo medido hoje
  const off = Math.hypot(hallC.x - floorC.x, hallC.z - floorC.z)
  const outer = Math.max(hallMax + 5, floorR - off - 2)
  // a clareira de quem entra: o corredor desemboca do lado +X do salão, então a
  // faixa central dessa direção não recebe planta nenhuma
  const laneHalf = Math.max(7, floorR * 0.3)
  const gapHalf = Math.asin(THREE.MathUtils.clamp(laneHalf / Math.max(1, (hallMax + outer) * 0.5), 0, 0.96)) + 0.14

  /** Encaixa um ponto no pátio: empurra para fora da PLANTA do templo, prende no
   *  aro do pátio, prende dentro do disco do piso e RECUSA o que cai na clareira
   *  da entrada. */
  const fit = (px: number, pz: number): { x: number; z: number } | null => {
    let dx = px - hallC.x, dz = pz - hallC.z
    const d = Math.hypot(dx, dz) || 1
    const need = hallRadius(Math.atan2(dz, dx))
    const k = THREE.MathUtils.clamp(d, need, outer) / d
    dx *= k; dz *= k
    let x = hallC.x + dx, z = hallC.z + dz
    const ex = x - floorC.x, ez = z - floorC.z
    const ed = Math.hypot(ex, ez) || 1
    if (ed > floorR - 1.5) { const s = (floorR - 1.5) / ed; x = floorC.x + ex * s; z = floorC.z + ez * s }
    if (x > hallC.x && Math.abs(z - hallC.z) < laneHalf) return null
    return { x, z }
  }

  // ── os canteiros: aglomerado, nunca peça solta espalhada por igual ────────
  // (a mesma lição dos afloramentos do parque: cristal nasce em flor, não em
  // pedra avulsa). Cada canteiro é um centro no anel com um punhado de peças
  // apertadas em volta; entre um canteiro e o outro, piso nu.
  const BEDS = low ? 6 : 9
  const beds: { x: number; z: number; r: number; vigor: number }[] = []
  for (let k = 0; k < BEDS; k++) {
    const t = (k + 0.5) / BEDS
    const a = gapHalf + t * (Math.PI * 2 - gapHalf * 2) + (hash1(k, 3) - 0.5) * 0.16
    // a faixa plantável naquele ângulo: do passeio do templo até o aro do pátio.
    // Ela é mais larga nos flancos (a planta é mais estreita lá), e é isso que
    // faz o jardim abraçar o prédio em vez de descrever um círculo em volta dele.
    const near = hallRadius(a)
    const reach = Math.max(2, outer - near)
    const p = fit(hallC.x + Math.cos(a) * (near + (0.15 + hash1(k, 7) * 0.55) * reach),
                  hallC.z + Math.sin(a) * (near + (0.15 + hash1(k, 7) * 0.55) * reach))
    if (!p) continue
    const vigor = 0.6 + hash1(k, 23) * 0.7
    beds.push({ x: p.x, z: p.z, r: Math.max(3, reach * (0.24 + vigor * 0.2)), vigor })
  }
  if (!beds.length) return null

  const mTall: THREE.Matrix4[] = []
  const mClump: THREE.Matrix4[] = []
  const mCap: THREE.Matrix4[] = []
  const mPad: THREE.Matrix4[] = []
  const o = new THREE.Object3D()
  const push = (arr: THREE.Matrix4[], x: number, z: number, y: number, s: number, yaw: number, flat = 1) => {
    o.position.set(x, floorTop + y, z)
    o.rotation.set(0, yaw, 0)
    o.scale.set(s, s * flat, s)
    o.updateMatrix()
    arr.push(o.matrix.clone())
  }

  let n = 0
  for (const bed of beds) {
    // o hero do canteiro: o cogumelo grande, quase no centro. Os dois modelos do
    // Sketchfab custam 1800 e 1600 triângulos cada, então é AQUI que o orçamento
    // do celular fraco se decide (medido: 70 mil triângulos no padrão); no LOW
    // cada canteiro leva um de cada e o resto do volume fica com o miúdo.
    const heroes = low ? 1 : (hash1(n, 17) > 0.58 ? 2 : 1)
    for (let i = 0; i < heroes; i++, n++) {
      const a = hash1(n, 41) * Math.PI * 2
      const rr = bed.r * 0.3 * hash1(n, 43)
      const p = fit(bed.x + Math.cos(a) * rr, bed.z + Math.sin(a) * rr)
      if (p) push(mTall, p.x, p.z, -0.12, 0.6 + hash1(n, 47) * 0.8, hash1(n, 53) * Math.PI * 2)
    }
    // os cachos de três, no meio-termo de altura
    const clumps = low ? 1 : 2 + (hash1(n, 29) > 0.5 ? 1 : 0)
    for (let i = 0; i < clumps; i++, n++) {
      const a = hash1(n, 59) * Math.PI * 2
      const rr = bed.r * (0.35 + hash1(n, 61) * 0.6)
      const p = fit(bed.x + Math.cos(a) * rr, bed.z + Math.sin(a) * rr)
      if (p) push(mClump, p.x, p.z, -0.1, 0.32 + hash1(n, 67) * 0.34, hash1(n, 71) * Math.PI * 2)
    }
    // o miúdo: chapéus baixos que fazem o canteiro ter chão
    const caps = Math.round((6 + bed.vigor * 6) * (low ? 0.55 : 1))
    for (let i = 0; i < caps; i++, n++) {
      const a = hash1(n, 73) * Math.PI * 2
      // sqrt: adensa o miolo do canteiro em vez de virar um anel oco
      const rr = bed.r * Math.sqrt(hash1(n, 79)) * 1.05
      const p = fit(bed.x + Math.cos(a) * rr, bed.z + Math.sin(a) * rr)
      if (p) push(mCap, p.x, p.z, -0.05, 0.5 + hash1(n, 83) * 0.95, hash1(n, 89) * Math.PI * 2)
    }
    // as crostas de líquen: o que amarra o canteiro no piso e vaza para fora dele
    const pads = low ? 0 : Math.round(4 + bed.vigor * 5)
    for (let i = 0; i < pads; i++, n++) {
      const a = hash1(n, 97) * Math.PI * 2
      const rr = bed.r * (0.2 + hash1(n, 101) * 1.25)
      const p = fit(bed.x + Math.cos(a) * rr, bed.z + Math.sin(a) * rr)
      if (p) push(mPad, p.x, p.z, 0.02, 0.7 + hash1(n, 103) * 1.9, hash1(n, 107) * Math.PI * 2, 0.09 + hash1(n, 109) * 0.08)
    }
  }

  const group = new THREE.Group()
  group.name = 'CaveGarden'
  const mats: THREE.MeshStandardMaterial[] = []
  const junk: { dispose: () => void }[] = []
  let draws = 0
  const addInst = (geo: THREE.BufferGeometry, mat: THREE.Material, ms: THREE.Matrix4[], name: string) => {
    if (!ms.length) { geo.dispose(); return }
    const im = new THREE.InstancedMesh(geo, mat, ms.length)
    ms.forEach((m, i) => im.setMatrixAt(i, m))
    im.instanceMatrix.needsUpdate = true
    // a esfera de recorte tem de sair das INSTÂNCIAS, não da geometria base: sem
    // isto o three mede um cogumelo de 5 m na origem do grupo (a soleira da boca)
    // e o anel inteiro some do quadro assim que a boca sai da tela
    im.computeBoundingSphere()
    // sem sombra: o orçamento de sombra da praça é das torres, e mato no escuro
    // não tem sombra para dar. A camada da caverna mantém o sol fora daqui.
    im.castShadow = false
    im.receiveShadow = false
    im.layers.set(CAVE_LAYER)
    im.name = name
    group.add(im)
    junk.push(im, geo)
    draws++
  }

  if (opts.tall) {
    for (const p of primitivesOf(opts.tall)) {
      const mat = shroomMat(p.mat, 1.9)
      mats.push(mat); junk.push(mat)
      addInst(p.geo, mat, mTall, 'CaveGardenTall')
    }
  }
  if (opts.cluster) {
    for (const p of primitivesOf(opts.cluster)) {
      // a haste não traz emissivo no glTF: sem um fio de brasa fria ela some no
      // preto e o chapéu fica flutuando
      const hasGlow = !!p.mat.emissiveMap
      const mat = shroomMat(p.mat, hasGlow ? 1.5 : 0.55, SPORE)
      mats.push(mat); junk.push(mat)
      addInst(p.geo, mat, mClump, hasGlow ? 'CaveGardenClumpCap' : 'CaveGardenClumpStem')
    }
  }
  // os modelos carregados não entram na cena, só as instâncias: a geometria
  // original pode ir embora agora. As texturas ficam, porque `clone()` de material
  // compartilha a referência delas com os clones que estão em uso.
  for (const src of [opts.tall, opts.cluster]) {
    src?.traverse((x) => { const mm = x as THREE.Mesh; if (mm.isMesh) mm.geometry.dispose() })
  }

  // ── o miúdo, feito à mão ─────────────────────────────────────────────────
  // Chapéu e haste na MESMA geometria e no MESMO material: um material por peça
  // dobraria a chamada de desenho para ganhar uma haste escura de 30 cm que
  // ninguém vê. Aqui a peça inteira brilha, que é o que fungo de caverna faz.
  {
    const capGeo = mergeGeometries([
      new THREE.SphereGeometry(0.42, 9, 4, 0, Math.PI * 2, 0, Math.PI * 0.54).scale(1, 0.66, 1).translate(0, 0.58, 0),
      new THREE.CylinderGeometry(0.07, 0.12, 0.6, 6, 1, true).translate(0, 0.3, 0),
    ])
    if (capGeo) {
      const mat = new THREE.MeshStandardMaterial({ color: 0x0a1a22, emissive: SPORE, emissiveIntensity: 0.9, roughness: 0.75, metalness: 0, side: THREE.DoubleSide })
      mats.push(mat); junk.push(mat)
      addInst(capGeo, mat, mCap, 'CaveGardenCaps')
    }
    // a crosta: uma calota bem baixa, não um disco chapado (disco briga em z com
    // o piso e pisca); a escala em y achata cada uma de um jeito
    const padGeo = new THREE.SphereGeometry(1, 8, 2, 0, Math.PI * 2, 0, Math.PI * 0.5)
    const padMat = new THREE.MeshStandardMaterial({ color: 0x0b1a1e, emissive: SPORE, emissiveIntensity: 0.45, roughness: 0.9, metalness: 0 })
    mats.push(padMat); junk.push(padMat)
    addInst(padGeo, padMat, mPad, 'CaveGardenLichen')
  }

  // ── a luz: TRÊS pontos, nos canteiros mais fortes ────────────────────────
  // O orçamento da praça é ≤ 10 PointLights na cena inteira e a caverna já gasta
  // três; então o jardim leva o mínimo que faz a poça de luz fria aparecer no
  // piso, e todo o resto do brilho é emissão (que não custa luz nenhuma).
  const lights: THREE.PointLight[] = []
  const strong = beds.slice().sort((a, b) => b.vigor - a.vigor).slice(0, low ? 1 : 3)
  for (const bed of strong) {
    const l = new THREE.PointLight(SPORE, 34, 44, 1.7)
    l.layers.enable(CAVE_LAYER) // acende os dois: a rocha (camada 0) e o pátio
    l.position.set(bed.x, floorTop + 2.6, bed.z)
    group.add(l)
    lights.push(l)
  }

  return { group, mats, lights, junk, instances: mTall.length + mClump.length + mCap.length + mPad.length, draws }
}

export async function buildLeonidasCave(opts: {
  gltf: GLTFLoader
  /** altura LOCAL do chão do parque */
  groundLocal: (lx: number, lz: number) => number
  /** de onde sai o caminho secreto (o pódio do precinto), em local do parque */
  pathFrom: { x: number; z: number }
  /** o centro do parque em MUNDO: o culling mede distância em mundo, e passar
   *  a posição local escondia a caverna sempre (bug medido em 2026-08-19) */
  parkCenter: THREE.Vector3
  profile?: PerfProfile
  culler?: DistanceCuller
}): Promise<LeonidasCave | null> {
  const loadGlb = (url: string) => new Promise<THREE.Object3D | null>((res) => opts.gltf.load(url, (g) => res(g.scene), undefined, () => { console.warn('[plaza] caverna ausente', url); res(null) }))
  const [rock, hall, shroomTall, shroomClump] = await Promise.all([
    loadGlb('/city/park/leonidas-cave.glb'), loadSf(opts.gltf, SF.templeHall),
    loadSf(opts.gltf, SF.shroomTall), loadSf(opts.gltf, SF.shroomCluster),
  ])
  if (!rock) return null

  const group = new THREE.Group()
  group.name = 'LeonidasCave'
  const disposables: { dispose: () => void }[] = []
  const track = <T extends { dispose: () => void }>(o: T): T => { disposables.push(o); return o }

  // ── a rocha ───────────────────────────────────────────────────────────────
  // O sol da praça é uma direcional sem oclusão: ele entra pela rocha e acende o
  // piso da câmara como se não houvesse teto. Como sombra a 5 km não é opção
  // (o mapa de sombra é da praça), o interior se defende pelo ALBEDO: piso quase
  // preto, e a casca só um pouco mais clara para a rocha continuar lendo por fora.
  // o piso é também a planta do PÁTIO: o jardim mede o disco dele em vez de
  // chutar raio, e assim acompanha a rocha quando ela é assada maior
  let floorMesh: THREE.Mesh | null = null
  dressSf(rock, { envMapIntensity: 0.12, roughness: 0.95, castShadow: true })
  rock.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    m.receiveShadow = true
    const mat = m.material as THREE.MeshStandardMaterial
    if (mat?.name === 'CaveFloor') { mat.color = new THREE.Color(0x101014); m.layers.set(CAVE_LAYER); floorMesh = m }
    else if (mat?.name === 'CaveRock') {
      // 0x060608 e não 0x0c: a garganta é uma face virada PARA O SOL, e com
      // albedo médio ela lia cinza-claro dentro de uma caverna. Aqui o basalto
      // fica quase preto, e quem acende o interior é a brasa.
      mat.color = new THREE.Color(0x060608)
    } else if (mat) {
      // qualquer outra peça que a assadeira acrescentar DENTRO da câmara (as
      // estalactites, `CaveDrip`, entraram em 2026-08-26) é interior e vai para a
      // camada da caverna. Sem isto o sol da praça a acende como se não houvesse
      // teto: é o mesmo bug que o piso já teve, e ele volta a cada peça nova.
      mat.color = new THREE.Color(0x08080b)
      m.layers.set(CAVE_LAYER)
    }
  })
  group.add(rock)
  // a planta do pátio, medida do piso de verdade: é dela que saem o lugar do
  // templo, a luz do salão e o anel do jardim
  group.updateMatrixWorld(true)
  const plan = floorMesh ? chamberPlan(floorMesh) : null

  // ── o salão, preto, no fundo da câmara ───────────────────────────────────
  const emissives: THREE.Material[] = []
  /** a caixa do salão DEPOIS de assentado: é dela que sai o anel do jardim */
  let hallBox: THREE.Box3 | null = null
  if (hall) {
    blacken(hall)
    hall.traverse((o) => o.layers.set(CAVE_LAYER)) // só as brasas iluminam o salão
    dressSf(hall, { envMapIntensity: 0.2, castShadow: true })
    const box = new THREE.Box3().setFromObject(hall)
    const size = box.getSize(new THREE.Vector3())
    // a câmara tem 64 x 53 x 45 m e o salão fica em 30 m de frente: sobra nave
    // em volta dele, que é o que faz a caverna ser uma CAVERNA e não uma caixa
    const k = Math.min(30 / Math.max(size.x, size.z), 24 / Math.max(0.001, size.y))
    hall.scale.setScalar(k)
    // a frente do modelo olha para −z; girar −90° põe a frente na boca (+x)
    hall.rotation.y = -Math.PI / 2
    hall.position.set(0, 0, 0)
    group.add(hall)
    // assenta MEDINDO de novo, já girado e escalado: a conta feita na caixa de
    // antes deixava o salão pairando (o modelo traz transformação própria, e a
    // caixa medida antes do giro não é a mesma caixa)
    group.updateMatrixWorld(true)
    const wb = new THREE.Box3().setFromObject(hall)
    const wc = wb.getCenter(new THREE.Vector3())
    // O MEIO DO PÁTIO, medido, e não um número. Era `-22 * S`, um ponto fixo
    // casado com a caverna de 2026-08-19. A assadeira de 2026-08-26 mudou o
    // contrato (o salão passou a sair em METROS FINAIS, sem o multiplicador que o
    // `S` daqui espelhava, e o meio andou de −44 para ~−71): com o número velho o
    // templo encostava na parede da frente, que é a queixa que gerou a ampliação
    // ("o templo continua muito apertado dentro da caverna"). Medido, ele
    // acompanha qualquer assadeira futura.
    const cx = plan ? plan.cx : -22 * S
    const cz = plan ? plan.cz : 0
    hall.position.set(cx - wc.x, (plan ? plan.top : 0) - wb.min.y, cz - wc.z)
    // mede DE NOVO, já assentado: `wb` foi lido antes do último empurrão e serve
    // para tamanho, não para lugar. O jardim precisa do lugar.
    group.updateMatrixWorld(true)
    hallBox = new THREE.Box3().setFromObject(hall)

    // a cumeeira em brasa: o único traço aceso do prédio, no eixo do telhado
    // fio de brasa, não tubo de luz: com 0,82 do comprimento e intensidade alta
    // ele lia como uma barra fluorescente pairando sobre o telhado
    const ridgeMat = track(new THREE.MeshStandardMaterial({ color: 0x1a1207, emissive: ORANGE, emissiveIntensity: 0.55, roughness: 0.5 }))
    // a cumeeira é emissiva: fica na camada 0 para não depender de luz nenhuma
    emissives.push(ridgeMat)
    // ⚠️ eixo X, não Z: depois do giro Ry(-PI/2) o eixo LONGO do templo (30 m)
    // é o X; em Z ele tem 24,6 m. Com a barra em Z ela cruzava o telhado de
    // lado a lado, perpendicular à cumeeira real e 2 m abaixo dela, que é
    // exatamente a "barra fluorescente" que o comentário acima diz evitar.
    // 0,46 do lado longo dá 13,8 m, e a cumeeira do modelo tem 13,64 m.
    const ridge = new THREE.Mesh(track(new THREE.BoxGeometry((wb.max.x - wb.min.x) * 0.46, 0.22, 0.22)), ridgeMat)
    // segue o telhado, não um número: o salão andou junto com o meio do pátio
    ridge.position.set(hallBox.getCenter(new THREE.Vector3()).x, hallBox.min.y + (wb.max.y - wb.min.y) * 0.985, cz)
    ridge.layers.set(0)
    group.add(ridge)
  }

  // ── a soleira: dois monólitos, o fio de brasa no chão, brasa nas paredes ──
  // A primeira versão tinha uma verga atravessada de ponta a ponta: de longe
  // virava uma barra amarela chapada, um travessão de plástico na boca da
  // caverna. Saiu. O que fica é pedra preta e brasa rasteira.
  {
    const black = track(new THREE.MeshStandardMaterial({ color: 0x0b0b0e, roughness: 0.85, metalness: 0.15 }))
    const glow = track(new THREE.MeshStandardMaterial({ color: 0x120c04, emissive: ORANGE, emissiveIntensity: 0.5, roughness: 0.5 }))
    emissives.push(glow)
    const mono = track(new THREE.CylinderGeometry(1.2, 2.1, 18, 6))
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(mono, black)
      // ⚠️ ombreiras da porta NOVA: a boca foi de 19 m de vão para 7,2 m na
      // reforma de 26/08. Com z = +-9,4 os monólitos ficavam a 18,8 m um do
      // outro, longe da porta, e liam como pedras avulsas no terraço.
      p.position.set(5.5 * S, 9, s * 5.0)
      p.rotation.y = s * 0.3
      p.castShadow = true
      group.add(p)
    }
    // o fio de brasa da soleira: uma linha no chão, atravessando a boca
    // 7,6 m e não 18,5: o fio atravessa a BOCA (vão de 7,2 m), e não o vão
    // antigo. Com 18,5 ele sobrava 5,6 m para cada lado, entrando na rocha.
    const sill = new THREE.Mesh(track(new THREE.BoxGeometry(0.5, 0.16, 7.6)), track(new THREE.MeshStandardMaterial({ color: 0x120c04, emissive: ORANGE, emissiveIntensity: 0.4, roughness: 0.6 })))
    sill.position.set(5.5 * S, 0.1, 0)
    group.add(sill)
    // as lanternas da garganta: brasa nas paredes, sem custo de luz
    const lampGeo = track(new THREE.SphereGeometry(0.2, 10, 8))
    // ⚠️ o corredor agora faz uma CURVA em S: uma fileira reta em z = +-8,6
    // punha 4 das 6 lanternas dentro da rocha maciça. Elas seguem o eixo do
    // corredor (contrato da assadeira nova, em coordenadas do three, onde
    // three.z = -blender.y) e encostam na parede pela meia-largura local.
    const EIXO: [number, number][] = [[20, 0], [6, -0.8], [-8, -6.5], [-19, -11.5], [-30, -9]]
    for (let i = 0; i < 6; i++) {
      const side = i % 2 === 0 ? -1 : 1
      const u = (i / 5) * (EIXO.length - 1)
      const k = Math.min(EIXO.length - 2, Math.floor(u))
      const f = u - k
      const x = EIXO[k][0] + (EIXO[k + 1][0] - EIXO[k][0]) * f
      const z = EIXO[k][1] + (EIXO[k + 1][1] - EIXO[k][1]) * f
      const lamp = new THREE.Mesh(lampGeo, glow)
      // meia-largura do corredor abre em funil de 3,6 para 5,6 ao longo do S
      lamp.position.set(x, 6.2 - (i % 3) * 0.5, z + side * (3.2 + (i / 5) * 1.6))
      group.add(lamp)
    }
  }

  // ── os braseiros da soleira: quem chega vê fogo antes de ver a porta ─────
  {
    const brazier = await loadSf(opts.gltf, '/city/sf/brazier.glb')
    if (brazier) {
      dressSf(brazier, { envMapIntensity: 0.3, roughness: 0.8 })
      const b = new THREE.Box3().setFromObject(brazier)
      const k = 3.6 / Math.max(0.001, b.getSize(new THREE.Vector3()).y) // 3,6 m de altura
      for (const s of [-1, 1]) {
        const g = brazier.clone(true)
        g.scale.setScalar(k)
        g.position.set(9.5 * S, -b.min.y * k, s * 13)
        g.rotation.y = s * 0.4
        group.add(g)
        const fire = new THREE.Mesh(track(new THREE.SphereGeometry(0.55, 10, 8)), track(new THREE.MeshBasicMaterial({ color: 0xffa23a })))
        fire.position.set(9.5 * S, (b.max.y - b.min.y) * k * 0.98, s * 13)
        group.add(fire)
      }
    }
  }

  // ── o JARDIM DO PÁTIO ────────────────────────────────────────────────────
  // Medido AQUI, antes do grupo sair da origem: enquanto `group` está em (0,0,0)
  // sem giro, a caixa de mundo de qualquer filho já é a caixa local, que é o
  // quadro em que o jardim é construído.
  group.updateMatrixWorld(true)
  const garden = plan ? buildCaveGarden({
    tall: shroomTall, cluster: shroomClump, plan, hallBox,
    low: opts.profile?.quality === 'low',
  }) : null
  // a intensidade com que cada material NASCEU: a respiração multiplica esta, e
  // não a do quadro anterior (multiplicar a corrente faz o brilho derivar até
  // apagar em alguns minutos de cena aberta)
  const gardenBase = garden ? garden.mats.map((m) => m.emissiveIntensity) : []
  if (garden) {
    group.add(garden.group)
    for (const d of garden.junk) disposables.push(d)
  }

  // ── a luz: três brasas, sem sombra (o orçamento de sombra é das torres) ───
  const lights: THREE.PointLight[] = []
  const addLight = (x: number, y: number, z: number, inten: number, dist: number) => {
    const l = new THREE.PointLight(EMBER, inten, dist, 1.7)
    l.layers.enable(CAVE_LAYER) // acende os dois: a rocha (camada 0) e o interior
    l.position.set(x, y, z)
    group.add(l)
    lights.push(l)
  }
  // a de dentro segue o templo (o meio do pátio andou com a assadeira nova); as
  // outras duas são da garganta e da soleira, que continuam na origem
  addLight(plan ? plan.cx + 14 : -16 * S, 13, plan ? plan.cz : 0, 320, 190) // dentro, lavando o salão
  // ⚠️ a garganta CURVA: (-4, 10, 0) caía dentro da rocha e acima do teto do
  // corredor (arco de 8,2 m). O ponto abaixo está no eixo do S, na curva.
  addLight(-19, 5.5, -11.5, 140, 120)   // a garganta, no cotovelo do corredor
  addLight(9 * S, 7, 0, 70, 95)      // o derrame na soleira, o que se vê de longe

  group.position.set(CAVE_LOCAL.x, opts.groundLocal(CAVE_LOCAL.x, CAVE_LOCAL.z), CAVE_LOCAL.z)
  group.rotation.y = CAVE_YAW

  // ── o TERRAÇO da boca ────────────────────────────────────────────────────
  // O flanco cai 19° na frente da caverna: medido, o chão está 4 m ABAIXO da
  // soleira a 15 m da boca e 9 m abaixo a 30 m. Sem isto, o portal e os matacões
  // pairam. O terraço é uma prateleira de rocha que sai da soleira, desce de
  // leve e funde no terreno no aro, e por dentro do morro ele fica enterrado, que
  // é como uma sacada de rocha se comporta.
  const apron = (() => {
    const RINGS = 18, SECT = 40, R = 34 * S
    const HALF = Math.PI * 0.62 // leque: o disco inteiro entrava pela câmara adentro
    const cx = CAVE_LOCAL.x, cz = CAVE_LOCAL.z
    const floorY = opts.groundLocal(cx, cz)
    const pos: number[] = [], idx: number[] = []
    const smooth = (e0: number, e1: number, x: number) => { const t = THREE.MathUtils.clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t) }
    for (let i = 0; i <= RINGS; i++) {
      const r = (i / RINGS) * R
      for (let j = 0; j <= SECT; j++) {
        const a = CAVE_YAW * -1 + (j / SECT - 0.5) * 2 * HALF
        const px = cx + Math.cos(a) * r, pz = cz + Math.sin(a) * r
        const terr = opts.groundLocal(px, pz)
        const ledge = floorY - 0.1 - Math.max(0, r - 24) * 0.2 + Math.sin(a * 3 + r * 0.2) * 0.35 * smooth(8, 24, r)
        const y = THREE.MathUtils.lerp(Math.max(ledge, terr), terr, smooth(R - 12, R, r))
        pos.push(px, y, pz)
      }
    }
    for (let i = 0; i < RINGS; i++) {
      for (let j = 0; j < SECT; j++) {
        const a0 = i * (SECT + 1) + j, b0 = a0 + SECT + 1
        // sentido anti-horário visto DE CIMA: com o outro sentido o terraço
        // ficava de costas para o céu e sumia (backface), e os matacões pareciam
        // flutuar sobre o nada
        idx.push(a0, a0 + 1, b0, a0 + 1, b0 + 1, b0)
      }
    }
    const geo = track(new THREE.BufferGeometry())
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    geo.setIndex(idx)
    geo.computeVertexNormals()
    const mat = track(new THREE.MeshStandardMaterial({ color: 0x0d0d10, roughness: 0.95, metalness: 0.05 }))
    const m = new THREE.Mesh(geo, mat)
    m.name = 'CaveApron'
    m.receiveShadow = true
    return m
  })()

  // ── o caminho secreto: lajes do pódio até a boca, rareando no fim ────────
  const path = (() => {
    const A = new THREE.Vector2(opts.pathFrom.x, opts.pathFrom.z)
    const B = new THREE.Vector2(CAVE_LOCAL.x + 28 * Math.cos(CAVE_YAW), CAVE_LOCAL.z - 28 * Math.sin(CAVE_YAW))
    const mid = A.clone().lerp(B, 0.5)
    const perp = new THREE.Vector2(-(B.y - A.y), B.x - A.x).normalize()
    // a curva desvia 150 m para o norte: o caminho contorna o esporão, não sobe reto
    const C = mid.add(perp.multiplyScalar(150))
    const N = 132
    const mats: THREE.Matrix4[] = []
    const o = new THREE.Object3D()
    const p = new THREE.Vector2()
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1)
      // quadrática de Bézier A → C → B
      const w0 = (1 - u) * (1 - u), w1 = 2 * (1 - u) * u, w2 = u * u
      p.set(A.x * w0 + C.x * w1 + B.x * w2, A.y * w0 + C.y * w1 + B.y * w2)
      // rareia perto da caverna: as últimas lajes só aparecem de perto
      if (u > 0.72 && i % 2 === 1) continue
      const jitter = Math.sin(i * 12.9898) * 43758.5453
      const j = jitter - Math.floor(jitter)
      const side = (i % 2 === 0 ? 1 : -1) * (0.7 + j * 0.9)
      const dx = Math.cos(u * 3.1) * 0, dz = 0
      o.position.set(p.x + side * 0.9 + dx, opts.groundLocal(p.x, p.y) + 0.12, p.y + side * 0.5 + dz)
      o.rotation.set(0, j * 6.28, 0)
      o.scale.setScalar(0.85 + j * 0.5)
      o.updateMatrix()
      mats.push(o.matrix.clone())
    }
    // as lajes: mais claras que a rocha, senão o caminho não se acha nem de
    // perto (medido na chapa: a 300 m ele sumia por completo no regolito)
    const geo = track(new THREE.BoxGeometry(2.2, 0.3, 1.5))
    const mat = track(new THREE.MeshStandardMaterial({ color: 0x3a3a42, roughness: 0.85, metalness: 0.1 }))
    const im = new THREE.InstancedMesh(geo, mat, mats.length)
    mats.forEach((m, i) => im.setMatrixAt(i, m))
    im.instanceMatrix.needsUpdate = true
    im.receiveShadow = true
    im.name = 'SecretPath'
    // as marcas: a cada dez lajes uma brasa baixa, do tamanho de um mojão. É o
    // que transforma "sumido" em "secreto": quem procura, segue.
    const markGeo = track(new THREE.ConeGeometry(0.34, 1.15, 6))
    const markMat = track(new THREE.MeshStandardMaterial({ color: 0x120c04, emissive: ORANGE, emissiveIntensity: 0.55, roughness: 0.6 }))
    const marks = mats.filter((_, i) => i % 10 === 4)
    const mim = new THREE.InstancedMesh(markGeo, markMat, marks.length)
    marks.forEach((m, i) => {
      const p = new THREE.Vector3().setFromMatrixPosition(m)
      mim.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x + 2.2, p.y + 0.5, p.z + 1.4))
    })
    mim.instanceMatrix.needsUpdate = true
    mim.name = 'SecretPathMarks'
    const g = new THREE.Group()
    g.name = 'SecretPath'
    g.add(im, mim)
    return g
  })()

  const holder = new THREE.Group()
  holder.name = 'LeonidasCaveSite'
  holder.add(group, apron, path)
  const cullAt = new THREE.Vector3(CAVE_LOCAL.x, 0, CAVE_LOCAL.z).add(opts.parkCenter)
  opts.culler?.add(group, (opts.profile?.parkDetailCull ?? 4200) * 1.3, cullAt)
  opts.culler?.add(apron, (opts.profile?.parkDetailCull ?? 4200) * 1.3, cullAt)
  opts.culler?.add(path, opts.profile?.parkDetailCull ?? 4200, cullAt)
  // o jardim é miúdo dentro de uma câmara: some antes da rocha, que ainda precisa
  // ler de longe como um contraforte. Fica dentro do grupo, então some duas vezes
  // (com o grupo, e antes dele).
  if (garden) opts.culler?.add(garden.group, (opts.profile?.parkDetailCull ?? 4200) * 0.7, cullAt)

  return {
    group: holder,
    mouthLocal: new THREE.Vector3(CAVE_LOCAL.x, group.position.y, CAVE_LOCAL.z),
    update(t) {
      // brasa: a luz respira, o material não (o material é o que lê de longe)
      const f = 0.9 + 0.1 * Math.sin(t * 1.7) + 0.05 * Math.sin(t * 4.3)
      lights[0].intensity = 320 * f
      lights[1].intensity = 140 * (0.92 + 0.08 * Math.sin(t * 2.6 + 1))
      lights[2].intensity = 70 * (0.9 + 0.1 * Math.sin(t * 3.1 + 2))
      for (const m of emissives) (m as THREE.MeshStandardMaterial).emissiveIntensity = 1.35 * (0.94 + 0.06 * Math.sin(t * 2.2))
      // o jardim respira em outro compasso, mais lento que a brasa: fungo não
      // pisca como fogo. Cada família com sua fase, senão o pátio inteiro pulsa
      // junto e vira um pisca-pisca.
      if (garden) {
        for (let i = 0; i < garden.mats.length; i++) {
          const base = gardenBase[i]
          garden.mats[i].emissiveIntensity = base * (0.88 + 0.12 * Math.sin(t * 0.55 + i * 1.9))
        }
        for (let i = 0; i < garden.lights.length; i++) garden.lights[i].intensity = 34 * (0.82 + 0.18 * Math.sin(t * 0.42 + i * 2.3))
      }
    },
    dispose() { for (const d of disposables) d.dispose() },
  }
}
