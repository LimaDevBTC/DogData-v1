// O Parque Runestone em tempo real (praca-central.md D10), a partir do que o Blender
// exportou de `runestone-park-v2.blend` (blender/export_park.py):
//   /city/park/heightmap.f32   o terreno do parque, 281×281 células de 25,7 m
//   /city/park/stones.json     as 1.009 pedras marcadas (variante + matriz de mundo)
//   /city/park/crystals.glb    as dez variantes de cristal, na origem
//   /city/park/scatter.bin     os 111.374 pontos do censo (uma pedra por Runestone
//                              do airdrop), int16 em quartos de metro
//   /city/park/temple.glb      o templo Leonidas, a estrada, o pavilhão, os painéis
//
// Onde fica: não havia posição registrada em documento nenhum (o parque foi
// desenhado no próprio quadro). A proposta implementada, a confirmar com o
// fundador: **no fim do eixo monumental, ao sul, com o centro a 9,2 km** (0, 9200),
// atrás do spaceport, fora da malha do sítio (para não brigar com o relevo de
// Tranquillitatis) e assentado sobre o anel do horizonte, girado 225° para que a
// chegada (o Portão, o vale que abre para o sudoeste no quadro do parque) olhe para
// a praça. Do enquadramento de abertura a cordilheira fecha o eixo no horizonte:
// deck, Chalé, spaceport, montanhas de cristal. `?view=park` leva até lá.
//
// Quadro: o Blender é Z-up e o parque foi modelado com y = norte; o glTF já vem
// convertido (x, z, −y); o heightmap e o censo vêm crus e são convertidos aqui.
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'

export const PARK_CENTER = new THREE.Vector3(0, 0, 9200)
export const PARK_ROT_Y = (5 * Math.PI) / 4
const PARK_HALF = 3600

export interface Park {
  group: THREE.Group
  update: (t: number) => void
  dispose: () => void
}

interface HeightMeta { cols: number; rows: number; cellSizeM: number; minX: number; minY: number; maxX: number; maxY: number; minZ: number; maxZ: number }

/** Blender (x, y, z) → three (x, z, −y), como matriz. */
const B2T = new THREE.Matrix4().set(
  1, 0, 0, 0,
  0, 0, 1, 0,
  0, -1, 0, 0,
  0, 0, 0, 1,
)
const T2B = B2T.clone().invert()

export async function loadPark(opts: { horizonAt: (x: number, z: number) => number; gltf?: GLTFLoader }): Promise<Park> {
  const [meta, hbuf, stones, sbuf] = await Promise.all([
    fetch('/city/park/heightmap.json').then((r) => r.json() as Promise<HeightMeta>),
    fetch('/city/park/heightmap.f32').then((r) => r.arrayBuffer()),
    fetch('/city/park/stones.json').then((r) => r.json() as Promise<{ variants: string[]; stones: number[][] }>),
    fetch('/city/park/scatter.bin').then((r) => r.arrayBuffer()),
  ])
  const gltf = opts.gltf ?? (() => { const d = new DRACOLoader(); d.setDecoderPath('/draco/'); const g = new GLTFLoader(); g.setDRACOLoader(d); return g })()
  const loadGlb = (url: string) => new Promise<THREE.Group>((res, rej) => gltf.load(url, (g) => res(g.scene), undefined, rej))
  const [crystals, temple] = await Promise.all([loadGlb('/city/park/crystals.glb'), loadGlb('/city/park/temple.glb')])

  const group = new THREE.Group()
  group.name = 'RunestonePark'
  group.position.copy(PARK_CENTER)
  group.rotation.y = PARK_ROT_Y
  const disposables: { dispose: () => void }[] = []
  const track = <T extends { dispose: () => void }>(o: T): T => { disposables.push(o); return o }

  // ── o datum: o parque assenta sobre o anel do horizonte, 2 m acima dele ────
  // O anel cai com a distância à praça, então cada vértice soma o anel local; a
  // borda do parque (r > 3200) funde para o anel puro.
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
  const baseAt = (lx: number, lz: number) => { const w = worldOf(lx, lz); return opts.horizonAt(w.x, w.z) }
  const center0 = opts.horizonAt(PARK_CENTER.x, PARK_CENTER.z)
  /** altura LOCAL (relativa ao grupo) do chão do parque em (lx, lz), quadro three local */
  const groundLocal = (lx: number, lz: number): number => {
    const bx = lx, by = -lz
    const r = Math.hypot(lx, lz)
    const k = r < 3100 ? 1 : r > PARK_HALF ? 0 : 1 - (r - 3100) / (PARK_HALF - 3100)
    const kk = k * k * (3 - 2 * k)
    const ring = baseAt(lx, lz) - center0
    return ring + 2 + parkH(bx, by) * kk
  }

  // ── terreno ───────────────────────────────────────────────────────────────
  const N = 240
  const geo = track(new THREE.PlaneGeometry(2 * PARK_HALF, 2 * PARK_HALF, N, N))
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position as THREE.BufferAttribute
  const col = new Float32Array(pos.count * 3)
  // mais escuro que o regolito do sítio: a esta distância o anel do horizonte já
  // escureceu, e um parque claro leria como uma mesa iluminada no meio da noite
  const base = new THREE.Color('#2a2724')
  const range = Math.max(1, meta.maxZ - meta.minZ)
  for (let k = 0; k < pos.count; k++) {
    const lx = pos.getX(k), lz = pos.getZ(k)
    const y = groundLocal(lx, lz)
    pos.setY(k, y)
    const rel = (parkH(lx, -lz) - meta.minZ) / range
    const sh = 0.55 + rel * 0.75
    col[k * 3] = base.r * sh; col[k * 3 + 1] = base.g * sh; col[k * 3 + 2] = base.b * sh
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  geo.computeVertexNormals()
  const terrain = new THREE.Mesh(geo, track(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })))
  terrain.receiveShadow = true
  terrain.name = 'ParkTerrain'
  group.add(terrain)

  // ── as pedras marcadas: cristais instanciados por variante ────────────────
  const crystalMat = track(new THREE.MeshStandardMaterial({
    color: 0xaebad0, roughness: 0.36, metalness: 0.08, emissive: 0x16223a, emissiveIntensity: 0.32, flatShading: true,
  }))
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
  for (const [v, list] of Array.from(byVariant.entries())) {
    const g = variantGeo[v]
    if (!g) continue
    const im = new THREE.InstancedMesh(g, crystalMat, list.length)
    list.forEach((m, i) => im.setMatrixAt(i, m))
    im.instanceMatrix.needsUpdate = true
    im.castShadow = true
    im.receiveShadow = true
    im.name = `Crystals_${v}`
    group.add(im)
  }

  // ── o censo: 111 mil pontos, uma pedra por Runestone ─────────────────────
  const s16 = new Int16Array(sbuf)
  const n = s16.length / 4
  const spos = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const bx = s16[i * 4] / 4, by = s16[i * 4 + 1] / 4, bz = s16[i * 4 + 2] / 4
    const lx = bx, lz = -by
    spos[i * 3] = lx
    spos[i * 3 + 1] = groundLocal(lx, lz) + Math.max(0.5, bz - parkH(bx, by)) + 0.6
    spos[i * 3 + 2] = lz
  }
  const sgeo = track(new THREE.BufferGeometry())
  sgeo.setAttribute('position', new THREE.BufferAttribute(spos, 3))
  const scatter = new THREE.Points(sgeo, track(new THREE.PointsMaterial({ color: 0xb8c4da, size: 1.8, sizeAttenuation: true, transparent: true, opacity: 0.4, depthWrite: false })))
  scatter.name = 'Census'
  group.add(scatter)

  // ── o templo e o construído ───────────────────────────────────────────────
  temple.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    m.castShadow = true
    m.receiveShadow = true
    const mat = m.material as THREE.MeshStandardMaterial
    if (mat && 'roughness' in mat) { mat.roughness = Math.max(0.35, mat.roughness); if ('envMapIntensity' in mat) mat.envMapIntensity = 0.3 }
  })
  // cada peça desce ao datum pelo anel LOCAL dela: o anel do horizonte inclina
  // 0,6° ao longo do parque, e um deslocamento único enterraria a estrada numa
  // ponta e a deixaria no ar na outra
  const bb = new THREE.Box3()
  const c = new THREE.Vector3()
  temple.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    bb.setFromObject(m)
    bb.getCenter(c)
    m.position.y += groundLocal(c.x, c.z) - parkH(c.x, -c.z)
  })
  group.add(temple)

  // uma luz fria e baixa no templo, e o cristal-monarca com um halo
  const templeLight = new THREE.PointLight(0xdfe8ff, 1.2, 900, 1.3)
  templeLight.position.set(1290, groundLocal(1290, -430) + 40, -430)
  group.add(templeLight)

  return {
    group,
    update(t) { crystalMat.emissiveIntensity = 0.4 + 0.08 * Math.sin(t * 0.6) },
    dispose() { for (const d of disposables) d.dispose(); crystals.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry?.dispose() }) },
  }
}
