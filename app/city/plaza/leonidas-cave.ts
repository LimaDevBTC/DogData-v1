// O TEMPLO LEONIDAS DENTRO DA CAVERNA (praca-ajustes.md item 14).
//
// O pedido do fundador: "o templo será preto e laranja, entre as monarcas, dentro
// de uma caverna", com caminho secreto. Então o salão saiu do pódio (onde estava
// à vista, e torto) e entrou numa câmara escavada no flanco leste do maciço do
// Monarca, entre as pedras grandes:
//
//   · a ROCHA vem de `blender/build_leonidas_cave.py` → leonidas-cave.glb:
//     basalto preto, câmara de 32 x 27 x 23 m, boca em arco de 9,6 m e três
//     matacões que escondem a entrada de quem passa longe;
//   · o SALÃO é o mesmo modelo japonês (carolinefangel, CC-BY-4.0), repintado:
//     todas as superfícies vão para o preto e o laranja entra como LUZ e como
//     fio de brasa (cumeeira, portal, lanternas). Preto e laranja, a marca;
//   · o CAMINHO SECRETO é uma fieira de lajes que sai do pódio do precinto e
//     vai rareando até a boca — quem não procurar, não acha.
//
// Quadro: tudo em LOCAL do parque (o mesmo de park.ts). O grupo é posto na
// soleira da boca, com +X saindo dela.
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
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
 *  hemisférico NÃO enxergam — só as brasas daqui de dentro. A câmera precisa
 *  habilitá-la (`camera.layers.enable(CAVE_LAYER)` em plaza-scene). */
export const CAVE_LAYER = 3

const ORANGE = 0xf7931a
const EMBER = 0xff8a2b
/** a mesma escala que `build_leonidas_cave.py` aplicou na rocha: a boca fica na
 *  origem e todo o resto (câmara, portal, terraço) cresce com ela */
const S = 1.35

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
  const [rock, hall] = await Promise.all([loadGlb('/city/park/leonidas-cave.glb'), loadSf(opts.gltf, SF.templeHall)])
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
  dressSf(rock, { envMapIntensity: 0.12, roughness: 0.95, castShadow: true })
  rock.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    m.receiveShadow = true
    const mat = m.material as THREE.MeshStandardMaterial
    if (mat?.name === 'CaveFloor') { mat.color = new THREE.Color(0x101014); m.layers.set(CAVE_LAYER) }
    else if (mat?.name === 'CaveRock') {
      // 0x060608 e não 0x0c: a garganta é uma face virada PARA O SOL, e com
      // albedo médio ela lia cinza-claro dentro de uma caverna. Aqui o basalto
      // fica quase preto, e quem acende o interior é a brasa.
      mat.color = new THREE.Color(0x060608)
    }
  })
  group.add(rock)

  // ── o salão, preto, no fundo da câmara ───────────────────────────────────
  const emissives: THREE.Material[] = []
  if (hall) {
    blacken(hall)
    hall.traverse((o) => o.layers.set(CAVE_LAYER)) // só as brasas iluminam o salão
    dressSf(hall, { envMapIntensity: 0.2, castShadow: true })
    const box = new THREE.Box3().setFromObject(hall)
    const size = box.getSize(new THREE.Vector3())
    // a câmara tem 43 x 36 x 31 m: o salão quase a preenche (27 m de frente),
    // que é o que faz a caverna ser um TEMPLO e não um buraco com uma casinha
    const k = Math.min(27 / Math.max(size.x, size.z), 21 / Math.max(0.001, size.y))
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
    hall.position.set(-22 * S - wc.x, -wb.min.y, -wc.z)

    // a cumeeira em brasa: o único traço aceso do prédio, no eixo do telhado
    const ridgeMat = track(new THREE.MeshStandardMaterial({ color: 0x1a1207, emissive: ORANGE, emissiveIntensity: 1.1, roughness: 0.5, toneMapped: false }))
    // a cumeeira é emissiva: fica na camada 0 para não depender de luz nenhuma
    emissives.push(ridgeMat)
    // a cumeeira corre no eixo LONGO do salão (z depois do giro), não no eixo da
    // boca: assim ela lê como cumeeira e não como uma barra atravessada
    const ridge = new THREE.Mesh(track(new THREE.BoxGeometry(0.28, 0.28, (wb.max.z - wb.min.z) * 0.82)), ridgeMat)
    ridge.position.set(-22 * S, (wb.max.y - wb.min.y) * 0.955, 0)
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
    const mono = track(new THREE.CylinderGeometry(0.85, 1.5, 12.5, 6))
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(mono, black)
      p.position.set(5.5 * S, 6.2, s * 6.4)
      p.rotation.y = s * 0.3
      p.castShadow = true
      group.add(p)
    }
    // o fio de brasa da soleira: uma linha no chão, atravessando a boca
    const sill = new THREE.Mesh(track(new THREE.BoxGeometry(0.42, 0.14, 12.4)), track(new THREE.MeshStandardMaterial({ color: 0x120c04, emissive: ORANGE, emissiveIntensity: 0.4, roughness: 0.6 })))
    sill.position.set(5.5 * S, 0.1, 0)
    group.add(sill)
    // as lanternas da garganta: brasa nas paredes, sem custo de luz
    const lampGeo = track(new THREE.SphereGeometry(0.2, 10, 8))
    for (let i = 0; i < 6; i++) {
      const side = i % 2 === 0 ? -1 : 1
      const lamp = new THREE.Mesh(lampGeo, glow)
      lamp.position.set((2.5 - i * 2.6) * S, 5.6 - (i % 3) * 0.35, side * 6.0)
      group.add(lamp)
    }
  }

  // ── os braseiros da soleira: quem chega vê fogo antes de ver a porta ─────
  {
    const brazier = await loadSf(opts.gltf, '/city/sf/brazier.glb')
    if (brazier) {
      dressSf(brazier, { envMapIntensity: 0.3, roughness: 0.8 })
      const b = new THREE.Box3().setFromObject(brazier)
      const k = 2.6 / Math.max(0.001, b.getSize(new THREE.Vector3()).y) // 2,6 m de altura
      for (const s of [-1, 1]) {
        const g = brazier.clone(true)
        g.scale.setScalar(k)
        g.position.set(9.5 * S, -b.min.y * k, s * 9.2)
        g.rotation.y = s * 0.4
        group.add(g)
        const fire = new THREE.Mesh(track(new THREE.SphereGeometry(0.55, 10, 8)), track(new THREE.MeshBasicMaterial({ color: 0xffa23a })))
        fire.position.set(9.5 * S, (b.max.y - b.min.y) * k * 0.98, s * 9.2)
        group.add(fire)
      }
    }
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
  addLight(-16 * S, 9, 0, 120, 95)   // dentro, lavando o salão
  addLight(-2 * S, 7, 0, 55, 60)     // a garganta
  addLight(9 * S, 5, 0, 30, 48)      // o derrame na soleira, o que se vê de longe

  group.position.set(CAVE_LOCAL.x, opts.groundLocal(CAVE_LOCAL.x, CAVE_LOCAL.z), CAVE_LOCAL.z)
  group.rotation.y = CAVE_YAW

  // ── o TERRAÇO da boca ────────────────────────────────────────────────────
  // O flanco cai 19° na frente da caverna: medido, o chão está 4 m ABAIXO da
  // soleira a 15 m da boca e 9 m abaixo a 30 m. Sem isto, o portal e os matacões
  // pairam. O terraço é uma prateleira de rocha que sai da soleira, desce de
  // leve e funde no terreno no aro — por dentro do morro ele fica enterrado, que
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
        const ledge = floorY - 0.1 - Math.max(0, r - 17) * 0.2 + Math.sin(a * 3 + r * 0.2) * 0.35 * smooth(8, 24, r)
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
    const B = new THREE.Vector2(CAVE_LOCAL.x + 20 * Math.cos(CAVE_YAW), CAVE_LOCAL.z - 20 * Math.sin(CAVE_YAW))
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

  return {
    group: holder,
    mouthLocal: new THREE.Vector3(CAVE_LOCAL.x, group.position.y, CAVE_LOCAL.z),
    update(t) {
      // brasa: a luz respira, o material não (o material é o que lê de longe)
      const f = 0.9 + 0.1 * Math.sin(t * 1.7) + 0.05 * Math.sin(t * 4.3)
      lights[0].intensity = 90 * f
      lights[1].intensity = 45 * (0.92 + 0.08 * Math.sin(t * 2.6 + 1))
      lights[2].intensity = 26 * (0.9 + 0.1 * Math.sin(t * 3.1 + 2))
      for (const m of emissives) (m as THREE.MeshStandardMaterial).emissiveIntensity = 1.35 * (0.94 + 0.06 * Math.sin(t * 2.2))
    },
    dispose() { for (const d of disposables) d.dispose() },
  }
}
