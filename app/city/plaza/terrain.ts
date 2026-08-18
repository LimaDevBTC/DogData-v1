// O chão da praça: Mare Tranquillitatis de verdade, do mesmo arquivo que a cena da
// landing usou (public/lunar/btc-core-heightmap.f32, SLDEM2015, 137×137 células de
// 59,2 m), com a mesma exageração vertical de 2×. Conferido numericamente contra o
// .blend: o pad do spaceport cai a +75,5 (o .blend tem 76,7), o plinto da Kray a
// -6,0 (o .blend tem -6,0). Quadro three: x = leste, y = para cima, z = sul, que
// é exatamente (x, z, -y) do Blender, a conversão do exportador glTF.
//
// A malha vai até ±4027 m como a da landing; fora dela um anel escuro leva o olho
// até o horizonte, que na Lua a 1,7 km de altura está a uns 77 km e não tem
// atmosfera para azular. Nada de névoa: o que escurece é a luz.
import * as THREE from 'three'

export interface TerrainMeta {
  cols: number
  rows: number
  cellSizeM: number
  minRelM: number
  maxRelM: number
}

export const VERTICAL_EXAGGERATION = 2

export interface Terrain {
  group: THREE.Group
  /** Altura do terreno (já exagerada) em (x, z); fora da malha devolve a borda. */
  heightAt: (x: number, z: number) => number
  halfExtent: number
}

export async function loadTerrain(): Promise<Terrain> {
  const [meta, buf] = await Promise.all([
    fetch('/lunar/btc-core-heightmap.json').then((r) => {
      if (!r.ok) throw new Error('heightmap meta missing')
      return r.json() as Promise<TerrainMeta>
    }),
    fetch('/lunar/btc-core-heightmap.f32').then((r) => {
      if (!r.ok) throw new Error('heightmap missing')
      return r.arrayBuffer()
    }),
  ])
  const heights = new Float32Array(buf)
  return buildTerrain(meta, heights)
}

export function buildTerrain(meta: TerrainMeta, heights: Float32Array): Terrain {
  const n = meta.cols
  const cell = meta.cellSizeM
  const half = (n - 1) / 2
  const halfExtent = half * cell
  const vex = VERTICAL_EXAGGERATION

  const H = (i: number, j: number) => heights[Math.min(n - 1, Math.max(0, j)) * n + Math.min(n - 1, Math.max(0, i))] * vex

  const rawAt = (x: number, z: number): number => {
    const fi = Math.min(n - 1.001, Math.max(0, x / cell + half))
    const fj = Math.min(n - 1.001, Math.max(0, z / cell + half))
    const i = Math.floor(fi), j = Math.floor(fj)
    const u = fi - i, v = fj - j
    return H(i, j) * (1 - u) * (1 - v) + H(i + 1, j) * u * (1 - v) + H(i, j + 1) * (1 - u) * v + H(i + 1, j + 1) * u * v
  }
  // O platô da praça: dentro de 780 m o chão é plano no nível 0 (o deck, as duas
  // torres, o anel e o castelo foram desenhados sobre um plano), e daí até 1100 m
  // ele volta suavemente ao relevo real. O mar de Tranquillitatis varia poucos
  // metros aqui (a Kray cairia a -6, a BitFlow a +3), então ninguém nota o platô e
  // nenhuma laje fica flutuando.
  const heightAt = (x: number, z: number): number => {
    const raw = rawAt(x, z)
    const r = Math.hypot(x, z)
    if (r >= 1100) return raw
    if (r <= 780) return 0
    const t = (r - 780) / 320
    const k = t * t * (3 - 2 * t)
    return raw * k
  }

  // A malha: um plano no XZ com y = altura. Cores por vértice: regolito escuro
  // (albedo lunar ~0,12) modulado por relevo e por um ruído barato, para o chão
  // não ler como plástico liso.
  const geo = new THREE.PlaneGeometry(2 * halfExtent, 2 * halfExtent, n - 1, n - 1)
  geo.rotateX(-Math.PI / 2) // o PlaneGeometry nasce no XY; deitado, +y vira normal
  const pos = geo.attributes.position as THREE.BufferAttribute
  const colors = new Float32Array(pos.count * 3)
  const base = new THREE.Color('#3f3d3a') // regolito: escuro de verdade (albedo lunar ~0,12); o sol faz o resto
  let minR = Infinity, maxR = -Infinity
  for (let k = 0; k < heights.length; k++) {
    if (heights[k] < minR) minR = heights[k]
    if (heights[k] > maxR) maxR = heights[k]
  }
  const span = Math.max(1, maxR - minR)
  for (let k = 0; k < pos.count; k++) {
    const x = pos.getX(k), z = pos.getZ(k)
    const y = heightAt(x, z)
    pos.setY(k, y)
    const rel = (y / vex - minR) / span
    const noise = 0.92 + 0.08 * fract(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453)
    const shade = (0.7 + rel * 0.5) * noise
    colors[k * 3] = base.r * shade
    colors[k * 3 + 1] = base.g * shade
    colors[k * 3 + 2] = base.b * shade
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.computeVertexNormals()

  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.receiveShadow = true
  mesh.name = 'LunarTerrain'

  // O anel externo até o horizonte, na altura média da borda, escurecendo para o
  // preto. Sem ele a malha acabaria numa aresta reta contra as estrelas.
  const edgeAvg = (() => {
    let s = 0, c = 0
    for (let i = 0; i < n; i++) { s += H(i, 0) + H(i, n - 1) + H(0, i) + H(n - 1, i); c += 4 }
    return s / c
  })()
  const ring = new THREE.RingGeometry(halfExtent * 0.999, 60000, 96, 6)
  ring.rotateX(-Math.PI / 2)
  const rpos = ring.attributes.position as THREE.BufferAttribute
  const rcol = new Float32Array(rpos.count * 3)
  for (let k = 0; k < rpos.count; k++) {
    const x = rpos.getX(k), z = rpos.getZ(k)
    const r = Math.hypot(x, z)
    const t = Math.min(1, (r - halfExtent) / 20000)
    // acompanha o relevo na borda interna e cai devagar até um horizonte um pouco
    // abaixo, como o rebordo de uma cratera vista de dentro
    rpos.setY(k, edgeAvg - t * 90 - t * t * 260)
    const shade = 0.55 * (1 - t) + 0.05 * t
    rcol[k * 3] = base.r * shade
    rcol[k * 3 + 1] = base.g * shade
    rcol[k * 3 + 2] = base.b * shade
  }
  ring.setAttribute('color', new THREE.BufferAttribute(rcol, 3))
  ring.computeVertexNormals()
  const ringMesh = new THREE.Mesh(ring, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }))
  ringMesh.name = 'Horizon'

  const group = new THREE.Group()
  group.add(mesh, ringMesh)
  return { group, heightAt, halfExtent }
}

function fract(v: number) {
  return v - Math.floor(v)
}
