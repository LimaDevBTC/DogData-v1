// O Parque Runestone em tempo real (praca-central.md D10), a partir do que o Blender
// exportou de `runestone-park-v2.blend` (blender/export_park.py):
//   /city/park/heightmap.f32   o terreno do parque, 281×281 células de 25,7 m
//   /city/park/stones.json     as 1.009 pedras marcadas (variante + matriz de mundo)
//   /city/park/crystals.glb    as dez variantes de cristal, na origem
//   /city/park/scatter.bin     os 111.374 pontos do censo (uma pedra por Runestone
//                              do airdrop), int16 em quartos de metro
//   /city/park/temple.glb      o templo Leonidas, a estrada, o pavilhão, os painéis
//   /city/park/trails.glb      as trilhas W1-W5: decks, narizes de âmbar, fáscias,
//                              pilares, marcos, lanternas e os visitantes
//   /city/park/crystal-basecolor.webp + crystal-normal.webp
//                              as texturas do runestone3d.gltf (a mesma pedra da
//                              /airdrop), de onde sai a RECEITA DA MARCA BRANCA do
//                              .blend: pedra negra de obsidiana, arestas que
//                              faíscam, e o glifo que emite (mais forte quanto
//                              menor a pedra, para ler em qualquer escala)
//
// Onde fica: em `park-site.ts` (a posição da cena da landing, nordeste da praça,
// rumo 43°, a 5,2 km para o construído do parque ficar fora do platô). O parque
// tem chão próprio: dentro de PARK_CORE o terreno é o do .blend sobre um datum
// plano (o chão real sob o Monarca), e de PARK_CORE a PARK_HALF ele funde no
// regolito real (`baseAt`, sem a cova); o regolito, por sua vez, abre uma cova
// sob o parque (terrain.ts) para nunca vazar pelo fundo do vale. A malha é um
// disco: os cantos do quadrado colapsam no raio PARK_HALF.
//
// Quadro: o Blender é Z-up e o parque foi modelado com y = norte; o glTF já vem
// convertido (x, z, −y); o heightmap e o censo vêm crus e são convertidos aqui.
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { regolithColor } from './terrain'
import { PARK_CENTER, PARK_ROT_Y, PARK_HALF, PARK_CORE, TEMPLE_WORLD } from './park-site'
import { mergeStaticByMaterial, type PerfProfile, type DistanceCuller } from './perf'
import { SF, loadSf, dressSf } from './sf-assets'

export { PARK_CENTER, PARK_ROT_Y }

export interface Park {
  group: THREE.Group
  update: (t: number, halfHeightPx: number, camPos: THREE.Vector3) => void
  dispose: () => void
}

/** A receita por tier (materiais M_T8..M_T2 do .blend), na ordem das variantes do
 *  crystals.glb: metálico, rugosidade, tinta escura das faces, força da emissão da
 *  marca. Os "b" são as pedras foscas. */
export const TIERS: { metal: number; rough: number; dark: [number, number, number]; emit: number }[] = [
  { metal: 0.35, rough: 0.10, dark: [0.065, 0.065, 0.075], emit: 0.35 }, // M_T8, o Monarca
  { metal: 0.35, rough: 0.10, dark: [0.065, 0.065, 0.075], emit: 0.60 }, // M_T7, os Maiores
  { metal: 0.35, rough: 0.11, dark: [0.09, 0.09, 0.105], emit: 0.85 },   // M_T6, os Picos
  { metal: 0.05, rough: 0.62, dark: [0.24, 0.23, 0.22], emit: 0.85 },    // M_T6b
  { metal: 0.35, rough: 0.11, dark: [0.09, 0.09, 0.105], emit: 1.10 },   // M_T5, as Grandes
  { metal: 0.05, rough: 0.62, dark: [0.24, 0.23, 0.22], emit: 1.10 },    // M_T5b
  { metal: 0.30, rough: 0.13, dark: [0.20, 0.20, 0.22], emit: 1.40 },    // M_T4, as Médias
  { metal: 0.05, rough: 0.62, dark: [0.30, 0.29, 0.28], emit: 1.40 },    // M_T4b
  { metal: 0.32, rough: 0.11, dark: [0.20, 0.20, 0.22], emit: 2.20 },    // M_T3, escala humana
  { metal: 0.32, rough: 0.11, dark: [0.20, 0.20, 0.22], emit: 2.20 },    // M_T2, as de palma
]
const TIER_BY_NAME: Record<string, number> = { M_T8: 0, M_T7: 1, M_T6: 2, M_T6b: 3, M_T5: 4, M_T5b: 5, M_T4: 6, M_T4b: 7, M_T3: 8, M_T2: 9 }
const MARK = new THREE.Color(0.93, 0.91, 0.86)

interface HeightMeta { cols: number; rows: number; cellSizeM: number; minX: number; minY: number; maxX: number; maxY: number; minZ: number; maxZ: number }

/** Blender (x, y, z) → three (x, z, −y), como matriz. */
const B2T = new THREE.Matrix4().set(
  1, 0, 0, 0,
  0, 0, 1, 0,
  0, -1, 0, 0,
  0, 0, 0, 1,
)
const T2B = B2T.clone().invert()

/** O material de UMA pedra: a receita da marca branca em shader (ver o bloco das
 *  pedras marcadas em loadPark). Exportado para o Jardim Ordinal da praça usar as
 *  mesmas pedras com a mesma pele. */
export function crystalMaterialFor(tier: (typeof TIERS)[number], bcTex: THREE.Texture, nmTex: THREE.Texture): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    map: bcTex, normalMap: nmTex, normalScale: new THREE.Vector2(1, 1),
    metalness: tier.metal, roughness: tier.rough, envMapIntensity: 1.1,
  })
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uDark = { value: new THREE.Color(tier.dark[0], tier.dark[1], tier.dark[2]) }
    sh.uniforms.uMark = { value: MARK }
    sh.uniforms.uEmit = { value: tier.emit }
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uDark; uniform vec3 uMark; uniform float uEmit; float crystalLum = 0.0;')
      .replace('#include <map_fragment>', `
        #ifdef USE_MAP
          vec4 sampledDiffuseColor = texture2D( map, vMapUv );
          crystalLum = dot(sampledDiffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
          float crystalMk = floor(clamp((crystalLum - 0.42) / 0.30, 0.0, 1.0) * 4.0 + 0.5) / 4.0;
          diffuseColor.rgb *= mix(sampledDiffuseColor.rgb * uDark, uMark, crystalMk);
        #endif`)
      .replace('#include <emissivemap_fragment>', `
        #include <emissivemap_fragment>
        {
          // rampa suave, não em degraus: de longe os mips fundem o traço branco
          // do glifo com o preto em volta e a luminância cai para 0,1..0,3; com
          // a rampa em degraus (0,5..0,8) o glifo simplesmente sumia a 1 km, e o
          // fundador viu o parque sem marca nenhuma no celular. Assim ele vira
          // um brilho proporcional, como um bloom, e continua lendo de longe.
          float crystalMe = smoothstep(0.06, 0.55, crystalLum);
          totalEmissiveRadiance += uMark * uEmit * 1.4 * crystalMe;
        }`)
  }
  return m
}

/** As duas texturas da pedra (as do runestone3d.gltf), prontas para glTF (flipY off). */
export function loadCrystalTextures(): Promise<[THREE.Texture, THREE.Texture]> {
  const texLoader = new THREE.TextureLoader()
  const loadTex = (url: string, srgb: boolean) => new Promise<THREE.Texture>((res, rej) => texLoader.load(url, (t) => {
    t.flipY = false // UVs de glTF: origem no canto superior esquerdo
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    res(t)
  }, undefined, rej))
  return Promise.all([loadTex('/city/park/crystal-basecolor.webp', true), loadTex('/city/park/crystal-normal.webp', false)])
}

export async function loadPark(opts: { baseAt: (x: number, z: number) => number; meanHeight: number; gltf?: GLTFLoader; profile?: PerfProfile; culler?: DistanceCuller }): Promise<Park> {
  const [meta, hbuf, stones, sbuf] = await Promise.all([
    fetch('/city/park/heightmap.json').then((r) => r.json() as Promise<HeightMeta>),
    fetch('/city/park/heightmap.f32').then((r) => r.arrayBuffer()),
    fetch('/city/park/stones.json').then((r) => r.json() as Promise<{ variants: string[]; stones: number[][] }>),
    fetch('/city/park/scatter.bin').then((r) => r.arrayBuffer()),
  ])
  const gltf = opts.gltf ?? (() => { const d = new DRACOLoader(); d.setDecoderPath('/draco/'); const g = new GLTFLoader(); g.setDRACOLoader(d); return g })()
  const loadGlb = (url: string) => new Promise<THREE.Group>((res, rej) => gltf.load(url, (g) => res(g.scene), undefined, rej))
  const [crystals, temple, trails, [bcTex, nmTex]] = await Promise.all([
    loadGlb('/city/park/crystals.glb'), loadGlb('/city/park/temple.glb'), loadGlb('/city/park/trails.glb'),
    loadCrystalTextures(),
  ])

  const group = new THREE.Group()
  group.name = 'RunestonePark'
  group.rotation.y = PARK_ROT_Y
  const disposables: { dispose: () => void }[] = []
  const track = <T extends { dispose: () => void }>(o: T): T => { disposables.push(o); return o }

  // ── o datum: o chão real sob o Monarca; o núcleo do parque é plano sobre ele ──
  // e a borda (PARK_CORE → PARK_HALF) funde no regolito real. Tudo local ao grupo,
  // cujo y é o datum.
  const heights = new Float32Array(hbuf)
  const { cols, rows, cellSizeM: cell } = meta
  const parkH = (bx: number, by: number): number => {
    const fi = THREE.MathUtils.clamp((bx - meta.minX) / cell, 0, cols - 1.001)
    const fj = THREE.MathUtils.clamp((by - meta.minY) / cell, 0, rows - 1.001)
    const i = Math.floor(fi), j = Math.floor(fj), u = fi - i, v = fj - j
    const H = (ii: number, jj: number) => heights[Math.min(rows - 1, jj) * cols + Math.min(cols - 1, ii)]
    return H(i, j) * (1 - u) * (1 - v) + H(i + 1, j) * u * (1 - v) + H(i, j + 1) * (1 - u) * v + H(i + 1, j + 1) * u * v
  }
  const local = new THREE.Vector3()
  const worldOf = (lx: number, lz: number) => local.set(lx, 0, lz).applyAxisAngle(new THREE.Vector3(0, 1, 0), PARK_ROT_Y).add(PARK_CENTER)
  const center0 = opts.baseAt(PARK_CENTER.x, PARK_CENTER.z)
  group.position.set(PARK_CENTER.x, center0, PARK_CENTER.z)
  const ringLocal = (lx: number, lz: number) => { const w = worldOf(lx, lz); return opts.baseAt(w.x, w.z) - center0 }
  const coreK = (lx: number, lz: number) => {
    const r = Math.hypot(lx, lz)
    const k = r < PARK_CORE ? 1 : r > PARK_HALF ? 0 : 1 - (r - PARK_CORE) / (PARK_HALF - PARK_CORE)
    return k * k * (3 - 2 * k)
  }
  /** altura LOCAL (relativa ao grupo) do chão do parque em (lx, lz), quadro three local */
  const groundLocal = (lx: number, lz: number): number => {
    const kk = coreK(lx, lz)
    return ringLocal(lx, lz) * (1 - kk) + parkH(lx, -lz) * kk + 1.5
  }

  // ── terreno ───────────────────────────────────────────────────────────────
  const N = 240
  const geo = track(new THREE.PlaneGeometry(2 * PARK_HALF, 2 * PARK_HALF, N, N))
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position as THREE.BufferAttribute
  const col = new Float32Array(pos.count * 3)
  // a MESMA cor do chão da praça: o parque é o mesmo regolito, só com relevo
  const tint = new THREE.Color()
  for (let k = 0; k < pos.count; k++) {
    let lx = pos.getX(k), lz = pos.getZ(k)
    // disco: os cantos do quadrado colapsam no raio PARK_HALF
    const rr = Math.hypot(lx, lz)
    if (rr > PARK_HALF) { lx *= PARK_HALF / rr; lz *= PARK_HALF / rr; pos.setX(k, lx); pos.setZ(k, lz) }
    const y = groundLocal(lx, lz)
    pos.setY(k, y)
    const w = worldOf(lx, lz)
    // relevo na MESMA régua do regolito (altura de mundo menos a média do sítio),
    // senão o disco do parque aparece mais claro que a planície em volta
    regolithColor(w.x, w.z, y + center0 - opts.meanHeight, Math.hypot(w.x, w.z), tint)
    col[k * 3] = tint.r; col[k * 3 + 1] = tint.g; col[k * 3 + 2] = tint.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  geo.computeVertexNormals()
  const terrainMat = track(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }))
  const terrain = new THREE.Mesh(geo, terrainMat)
  terrain.receiveShadow = true
  terrain.name = 'ParkTerrain'
  group.add(terrain)
  // a versão grossa do mesmo chão (60×60) para quando o parque é horizonte
  const NC = 60
  const geoC = track(new THREE.PlaneGeometry(2 * PARK_HALF, 2 * PARK_HALF, NC, NC))
  geoC.rotateX(-Math.PI / 2)
  {
    const pc = geoC.attributes.position as THREE.BufferAttribute
    const cc = new Float32Array(pc.count * 3)
    for (let k = 0; k < pc.count; k++) {
      let lx = pc.getX(k), lz = pc.getZ(k)
      const rr = Math.hypot(lx, lz)
      if (rr > PARK_HALF) { lx *= PARK_HALF / rr; lz *= PARK_HALF / rr; pc.setX(k, lx); pc.setZ(k, lz) }
      const y = groundLocal(lx, lz)
      pc.setY(k, y)
      const w = worldOf(lx, lz)
      regolithColor(w.x, w.z, y + center0 - opts.meanHeight, Math.hypot(w.x, w.z), tint)
      cc[k * 3] = tint.r; cc[k * 3 + 1] = tint.g; cc[k * 3 + 2] = tint.b
    }
    geoC.setAttribute('color', new THREE.BufferAttribute(cc, 3))
    geoC.computeVertexNormals()
  }
  const terrainCoarse = new THREE.Mesh(geoC, terrainMat)
  terrainCoarse.receiveShadow = true
  terrainCoarse.name = 'ParkTerrainCoarse'
  terrainCoarse.visible = false
  group.add(terrainCoarse)
  const lodTerrain = (dist: number) => {
    const fine = dist < 4500
    if (terrain.visible !== fine) { terrain.visible = fine; terrainCoarse.visible = !fine }
  }

  // ── as pedras marcadas: cristais instanciados por variante ────────────────
  // A receita da marca branca, do .blend, em shader: a luminância da textura de
  // cor separa a pedra (preta, tingida por tier) das arestas e do glifo (claros);
  // a cor vira mix(textura × tinta, marca) por uma rampa em degraus (0,42..0,72), e
  // a emissão da marca é outra rampa (0,5..0,8) vezes a força do tier. Metálico
  // 0,35 e rugosidade 0,1: as faces são espelhos negros que faíscam ao sol.
  const crystalMats: THREE.MeshStandardMaterial[] = TIERS.map((tier) => track(crystalMaterialFor(tier, bcTex, nmTex)))
  const variantGeo: THREE.BufferGeometry[] = []
  crystals.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.isMesh) {
      const idx = Number((o.name.match(/CRYSTAL_(\d+)/) || [])[1])
      if (!Number.isNaN(idx)) variantGeo[idx] = m.geometry
    }
  })
  const byVariant = new Map<number, THREE.Matrix4[]>()
  const M = new THREE.Matrix4()
  for (const row of stones.stones) {
    const v = row[0]
    M.set(row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8], row[9], row[10], row[11], row[12], row[13], row[14], row[15], row[16])
    // M leva do local do cristal (Blender) ao mundo (Blender). Em three: B2T · M · T2B,
    // porque a geometria do GLB já está no quadro three.
    const Mt = new THREE.Matrix4().multiplyMatrices(B2T, M).multiply(T2B)
    // e desce ao datum: soma o anel local (a matriz traz o z do parque)
    const p = new THREE.Vector3().setFromMatrixPosition(Mt)
    const lift = groundLocal(p.x, p.z) - parkH(p.x, -p.z)
    Mt.elements[13] += lift
    const list = byVariant.get(v) ?? []
    list.push(Mt)
    byVariant.set(v, list)
  }
  // LOD por contagem: cada variante é um InstancedMesh com as instâncias ordenadas
  // da MAIOR para a menor; de longe só as maiores são desenhadas (`count`), e a
  // silhueta da cordilheira não muda porque as grandes é que a fazem. De perto,
  // todas. É o LOD dos jogos, sem malhas extras: 485 mil triângulos viram ~100 mil
  // vistos da praça.
  const scaleOf = (m: THREE.Matrix4) => Math.hypot(m.elements[0], m.elements[1], m.elements[2])
  const crystalMeshes: THREE.InstancedMesh[] = []
  for (const [v, list] of Array.from(byVariant.entries())) {
    const g = variantGeo[v]
    if (!g) continue
    list.sort((a, b) => scaleOf(b) - scaleOf(a))
    const im = new THREE.InstancedMesh(g, crystalMats[Math.min(v, crystalMats.length - 1)], list.length)
    list.forEach((m, i) => im.setMatrixAt(i, m))
    im.instanceMatrix.needsUpdate = true
    im.castShadow = true
    im.receiveShadow = true
    im.name = `Crystals_${v}`
    im.userData.total = list.length
    im.frustumCulled = false // as instâncias cobrem 7 km; a esfera da geometria mentiria
    group.add(im)
    crystalMeshes.push(im)
  }
  const CL = opts.profile?.crystalLod ?? [1, 0.35, 0.15, 0.08]
  const lodCrystals = (dist: number) => {
    const frac = dist < 2500 ? CL[0] : dist < 5000 ? CL[1] : dist < 9000 ? CL[2] : CL[3]
    for (const im of crystalMeshes) {
      const n = Math.max(1, Math.ceil((im.userData.total as number) * frac))
      if (im.count !== n) im.count = n
    }
  }

  // ── o censo: 111 mil pontos, uma pedra por Runestone ─────────────────────
  const s16 = new Int16Array(sbuf)
  const n = s16.length / 4
  const spos = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    if (i % 24000 === 23999) await new Promise<void>((r) => setTimeout(r, 0)) // respira: 111 mil pontos sem travar o quadro
    const bx = s16[i * 4] / 4, by = s16[i * 4 + 1] / 4, bz = s16[i * 4 + 2] / 4
    const lx = bx, lz = -by
    spos[i * 3] = lx
    spos[i * 3 + 1] = groundLocal(lx, lz) + Math.max(0.5, bz - parkH(bx, by)) + 0.6
    spos[i * 3 + 2] = lz
  }
  const sgeo = track(new THREE.BufferGeometry())
  sgeo.setAttribute('position', new THREE.BufferAttribute(spos, 3))
  // pontos que somem quando o tamanho projetado cai abaixo de um pixel (de longe
  // 111 mil pontos de 1 px viravam chuvisco; de perto são o cascalho de Runestones)
  const scatterMat = track(new THREE.ShaderMaterial({
    uniforms: { uHalfH: { value: 450 }, uColor: { value: new THREE.Color(0x9fb4d8) }, uOpacity: { value: 0.6 } },
    vertexShader: `
      uniform float uHalfH;
      varying float vA;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float ps = 1.6 * uHalfH / max(1.0, -mv.z);
        vA = clamp((ps - 0.5) / 1.6, 0.0, 1.0);
        gl_PointSize = clamp(ps, 1.0, 5.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uOpacity;
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5 || vA <= 0.001) discard;
        gl_FragColor = vec4(uColor, uOpacity * vA * (1.0 - d * 1.6));
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }))
  const scatter = new THREE.Points(sgeo, scatterMat)
  scatter.name = 'Census'
  scatter.frustumCulled = false
  // no celular o censo não entra (111 mil pontos por quadro); no desktop, só de perto
  if (opts.profile?.censusPoints !== false) {
    group.add(scatter)
    opts.culler?.add(scatter, opts.profile?.parkDetailCull ?? 4200, PARK_CENTER)
  }

  // ── o templo e o construído ───────────────────────────────────────────────
  const built = new THREE.Group()
  built.add(temple, trails)
  built.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    m.castShadow = true
    m.receiveShadow = true
    const mat = m.material as THREE.MeshStandardMaterial
    if (!mat) return
    const tier = TIER_BY_NAME[mat.name]
    if (tier !== undefined) { m.material = crystalMats[tier]; return } // torii, lintel: runestones
    if ('roughness' in mat) { mat.roughness = Math.max(0.35, mat.roughness); if ('envMapIntensity' in mat) mat.envMapIntensity = 0.3 }
    if (mat.emissive && mat.emissiveIntensity > 0 && (mat.emissive.r > 0.5)) { mat.toneMapped = false; mat.emissiveIntensity = Math.min(mat.emissiveIntensity, 1.6) }
  })
  // cada peça desce ao datum pelo anel LOCAL dela: o anel do horizonte inclina
  // 0,6° ao longo do parque, e um deslocamento único enterraria a estrada numa
  // ponta e a deixaria no ar na outra
  const bb = new THREE.Box3()
  const c = new THREE.Vector3()
  built.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    bb.setFromObject(m)
    bb.getCenter(c)
    m.position.y += groundLocal(c.x, c.z) - parkH(c.x, -c.z)
  })
  // ── o SALÃO do Templo Leonidas, sobre o pódio ────────────────────────────
  // O masterplan do parque (RUNESTONE-PARK-V2-MASTERPLAN.md) reservou "20 socket
  // plinths on T-3 (future hall grid)": o pódio de três tiers foi construído para
  // receber um salão que nunca existiu. É esse o lugar do templo japonês que o
  // fundador trouxe do Sketchfab (carolinefangel, CC-BY-4.0). A medida sai do
  // próprio pódio, antes da fusão por material (que apaga os nomes dos nós).
  const podiumBox = (() => {
    let node: THREE.Object3D | null = null
    built.traverse((o) => { if (!node && /^Podium/i.test(o.name)) node = o })
    if (!node) { console.warn('[plaza] Podium node não encontrado no temple.glb'); return null }
    built.updateMatrixWorld(true)
    return new THREE.Box3().setFromObject(node)
  })()
  if (podiumBox) {
    const hall = await loadSf(opts.gltf ?? new GLTFLoader(), SF.templeHall)
    if (hall) {
      const c = podiumBox.getCenter(new THREE.Vector3())
      dressSf(hall, { envMapIntensity: 0.5, roughness: 0.8 })
      hall.scale.setScalar(1.55) // 20 m → 31 m de frente, na medida do pódio (45×30)
      hall.position.set(c.x, podiumBox.max.y - 0.2, c.z)
      // o eixo do precinto do templo: az 251,6° no quadro do parque → o salão
      // olha para o Monarca, como o pódio
      hall.rotation.y = THREE.MathUtils.degToRad(251.6 - 180)
      built.add(hall)
      // a posição de mundo, para o menu Places poder voar até aqui
      TEMPLE_WORLD.set(c.x, podiumBox.max.y, c.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), PARK_ROT_Y).add(new THREE.Vector3(PARK_CENTER.x, center0, PARK_CENTER.z))
      // duas luzes quentes sob os beirais, para o telhado ler à noite
      for (const s of [-1, 1]) {
        const l = new THREE.PointLight(0xffb96a, 4, 60, 1.6)
        l.position.set(c.x + s * 12, podiumBox.max.y + 6, c.z + 10)
        built.add(l)
      }
    }
  }
  mergeStaticByMaterial(built, /^$/) // 138 malhas → ~20
  group.add(built)
  // as trilhas e o templo só de perto do parque (153 mil triângulos de passarela)
  opts.culler?.add(built, opts.profile?.parkDetailCull ?? 4200, PARK_CENTER)

  // uma luz fria e baixa no templo, e o cristal-monarca com um halo
  const templeLight = new THREE.PointLight(0xffa04d, 1.0, 700, 1.4) // âmbar: a lei do parque, nada frio aceso
  templeLight.position.set(1290, groundLocal(1290, -430) + 40, -430)
  group.add(templeLight)

  return {
    group,
    update(t, halfHeightPx, camPos) {
      scatterMat.uniforms.uHalfH.value = halfHeightPx
      const dist = camPos.distanceTo(PARK_CENTER)
      lodCrystals(dist)
      lodTerrain(dist)
      void t
    },
    dispose() { for (const d of disposables) d.dispose(); bcTex.dispose(); nmTex.dispose(); crystals.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry?.dispose() }) },
  }
}
