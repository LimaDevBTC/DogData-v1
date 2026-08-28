// O chão: UM regolito, contínuo, do deck ao horizonte, passando pelo parque.
//
// Mare Tranquillitatis de verdade no sítio (public/lunar/btc-core-heightmap.f32,
// SLDEM2015, 137×137 células de 59,2 m, exageração vertical 2×, a mesma da cena da
// landing; conferido: o pad do spaceport cai a +75,5 onde o .blend tem 76,7, o
// plinto da Kray a -6,0), e dali para fora uma SAIA costurada vértice a vértice na
// borda do sítio, que leva o olho até o horizonte descendo devagar. Uma malha só,
// um material só, uma função de cor só (`regolithColor`), que o parque também usa:
// o fundador viu o sítio claro, o anel escuro e o parque marrom lado a lado, com
// fatias pretas onde a borda do sítio ficava mais alta que o anel e vazava o
// fundo, e disse o óbvio: "tudo isso está se passando no mesmo lugar, na Lua".
//
// Quadro three: x = leste, y = para cima, z = sul, que é exatamente (x, z, −y) do
// Blender, a conversão do exportador glTF. Sem névoa: o que escurece é a luz e um
// escurecimento suave com a distância, o mesmo para todas as malhas.
import * as THREE from 'three'
import { PARK_CENTER, PARK_CORE, PARK_HALF, PARK_PIT } from './park-site'

export interface TerrainMeta {
  cols: number
  rows: number
  cellSizeM: number
  minRelM: number
  maxRelM: number
}

// ⚠️⚠️ O EXAGERO VERTICAL DEIXOU DE SER CONSTANTE EM 28/08/2026, e a razão é
// urbanística, não estética. Mare Tranquillitatis é genuinamente plana: medido
// na prancha /city/plan, o relevo REAL da NASA tem 17,36 km² a menos de 2 graus
// dentro do sítio. Com o exagero de 2 que esta linha aplicava, sobravam 4,06.
// Era o dobro de altura que tornava a cidade inconstruível, não a Lua.
//
// Agora o exagero é 1 DENTRO da cidade e volta a 2 no horizonte. A cidade se
// apoia na Lua como ela é, e a paisagem distante continua dramática. A rampa é
// suave (smoothstep) entre os dois raios, então não há costura: a derivada da
// altura é contínua e nenhuma junta aparece no chão.
//
// ⚠️ MEXER NESTES NÚMEROS MOVE O MUNDO INTEIRO na vertical. Tudo que foi
// enquadrado à mão sobre este terreno (as câmeras da guerra, o datum da
// batalha, o pouso do parque) tem de ser reconferido depois, e o jeito de
// conferir é `?stats=1` com window.__plazaView().
export const VEX_CIDADE = 1
export const VEX_HORIZONTE = 2
/** raio até onde a cidade é plana como a Lua real */
export const VEX_R_CIDADE = 3500
/** e o raio onde o exagero do horizonte já está cheio */
export const VEX_R_HORIZONTE = 6000
export function exageroEm(r: number): number {
  if (r <= VEX_R_CIDADE) return VEX_CIDADE
  if (r >= VEX_R_HORIZONTE) return VEX_HORIZONTE
  const t = (r - VEX_R_CIDADE) / (VEX_R_HORIZONTE - VEX_R_CIDADE)
  return VEX_CIDADE + (VEX_HORIZONTE - VEX_CIDADE) * (t * t * (3 - 2 * t))
}
/** compatibilidade: quem só quer um número usa o do horizonte */
export const VERTICAL_EXAGGERATION = VEX_HORIZONTE

export interface Terrain {
  group: THREE.Group
  /** Altura do chão em (x, z), em qualquer lugar: sítio, saia, horizonte. */
  heightAt: (x: number, z: number) => number
  /** Igual a heightAt; nome mantido para quem chamava o anel do horizonte. */
  horizonAt: (x: number, z: number) => number
  /** O chão SEM a cova do parque: o parque funde a borda dele neste valor. */
  baseAt: (x: number, z: number) => number
  /** altura média do sítio: a régua do relevo em `regolithColor` */
  meanHeight: number
  halfExtent: number
}

const BASE = new THREE.Color('#3f3d3a') // regolito iluminado pelo sol; o material escurece o resto
const R_DARK_START = 3000
const R_DARK_END = 26000

/** A cor do regolito em qualquer malha do chão: base × relevo × ruído × distância.
 *  `relief` em metros (positivo = mais alto que a vizinhança), `dist` = distância à
 *  praça. Uma função só, para o parque a 9 km ser o mesmo chão que o deck. */
export function regolithColor(x: number, z: number, relief: number, dist: number, out: THREE.Color): THREE.Color {
  const rel = THREE.MathUtils.clamp(relief / 220 + 0.45, 0, 1)
  const noise = 0.92 + 0.08 * fract(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453)
  const far = THREE.MathUtils.clamp((dist - R_DARK_START) / (R_DARK_END - R_DARK_START), 0, 1)
  const shade = (0.72 + rel * 0.5) * noise * (1 - 0.72 * far)
  return out.set(BASE.r * shade, BASE.g * shade, BASE.b * shade)
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
  return buildTerrain(meta, new Float32Array(buf))
}

export function buildTerrain(meta: TerrainMeta, heights: Float32Array): Terrain {
  const n = meta.cols
  const cell = meta.cellSizeM
  const half = (n - 1) / 2
  const halfExtent = half * cell
  // ⚠️ o exagero entra DEPOIS da interpolação, e por lugar: interpolar alturas
  // já exageradas com fatores diferentes nos quatro cantos criaria degrau na
  // borda de célula. Interpola o relevo cru, depois escala pelo raio.
  const H = (i: number, j: number) => heights[Math.min(n - 1, Math.max(0, j)) * n + Math.min(n - 1, Math.max(0, i))]

  const rawAt = (x: number, z: number): number => {
    const fi = Math.min(n - 1.001, Math.max(0, x / cell + half))
    const fj = Math.min(n - 1.001, Math.max(0, z / cell + half))
    const i = Math.floor(fi), j = Math.floor(fj)
    const u = fi - i, v = fj - j
    const cru = H(i, j) * (1 - u) * (1 - v) + H(i + 1, j) * u * (1 - v) + H(i, j + 1) * (1 - u) * v + H(i + 1, j + 1) * u * v
    return cru * exageroEm(Math.hypot(x, z))
  }
  // O platô da praça: dentro de 960 m o chão é plano no nível 0 (o deck, as
  // âncoras e o jardim inteiro, até a muralha em 900, foram desenhados sobre um
  // plano), e daí até 1300 m ele volta suavemente ao relevo real.
  const siteAt = (x: number, z: number): number => {
    const raw = rawAt(x, z)
    const r = Math.hypot(x, z)
    if (r >= 1300) return raw
    if (r <= 960) return 0
    const t = (r - 960) / 340
    const k = t * t * (3 - 2 * t)
    return raw * k
  }
  // a média da saia usa o exagero do HORIZONTE, que é onde a saia vive
  let mean = 0
  for (let k = 0; k < heights.length; k++) mean += heights[k] * VEX_HORIZONTE
  mean /= heights.length

  // A saia: fora do quadrado do sítio, a altura parte da altura da BORDA (o ponto
  // do quadrado na direção do lugar), decai para a média do sítio, e desce com a
  // distância como um rebordo suave de cratera. Contínua na borda por construção.
  const boundaryPoint = (x: number, z: number): [number, number] => {
    const m = Math.max(Math.abs(x), Math.abs(z)) || 1
    return [(x / m) * halfExtent, (z / m) * halfExtent]
  }
  const drop = (d: number) => {
    const t = Math.min(1, Math.max(0, (d - halfExtent) / 24000))
    return t * 60 + t * t * 220
  }
  const skirtAt = (x: number, z: number): number => {
    const [bx, bz] = boundaryPoint(x, z)
    const hb = siteAt(bx, bz)
    const d = Math.hypot(x, z)
    const dOut = Math.max(0, Math.max(Math.abs(x), Math.abs(z)) - halfExtent)
    const fade = Math.exp(-(dOut / 2200) * (dOut / 2200))
    return hb * fade + mean * (1 - fade) - drop(d)
  }
  const baseAt = (x: number, z: number): number => (Math.max(Math.abs(x), Math.abs(z)) <= halfExtent ? siteAt(x, z) : skirtAt(x, z))
  // A cova do parque: sob o Parque Runestone o regolito desce até (datum − PARK_PIT),
  // onde datum é o chão sob o Monarca, com a mesma rampa (PARK_CORE → PARK_HALF)
  // que o parque usa para fundir na borda. O parque tem chão próprio (vale a −61,
  // cordilheira a +240 sobre o datum); sem a cova o regolito de Tranquillitatis
  // vazava pelo fundo do vale onde o relevo real é mais alto que o datum.
  const parkDatum = baseAt(PARK_CENTER.x, PARK_CENTER.z)
  const heightAt = (x: number, z: number): number => {
    const b = baseAt(x, z)
    const r = Math.hypot(x - PARK_CENTER.x, z - PARK_CENTER.z)
    if (r >= PARK_HALF) return b
    const k = r <= PARK_CORE ? 1 : 1 - (r - PARK_CORE) / (PARK_HALF - PARK_CORE)
    const kk = k * k * (3 - 2 * k)
    return b - kk * Math.max(0, b - (parkDatum - PARK_PIT))
  }

  // ── a malha única: grade do sítio + anéis da saia soldados na borda ────────
  const positions: number[] = []
  const colors: number[] = []
  const indices: number[] = []
  const col = new THREE.Color()
  const push = (x: number, y: number, z: number, relief: number) => {
    positions.push(x, y, z)
    regolithColor(x, z, relief, Math.hypot(x, z), col)
    colors.push(col.r, col.g, col.b)
    return positions.length / 3 - 1
  }
  // grade do sítio: índice j*n+i
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = (i - half) * cell, z = (j - half) * cell
      const y = heightAt(x, z)
      push(x, y, z, y - mean)
    }
  }
  for (let j = 0; j < n - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      const a = j * n + i, b = a + 1, c = a + n, d = c + 1
      indices.push(a, c, b, b, c, d)
    }
  }
  // o perímetro, em ordem, começando no canto (i=0,j=0) e girando
  const perimeter: number[] = []
  for (let i = 0; i < n - 1; i++) perimeter.push(0 * n + i)
  for (let j = 0; j < n - 1; j++) perimeter.push(j * n + (n - 1))
  for (let i = n - 1; i > 0; i--) perimeter.push((n - 1) * n + i)
  for (let j = n - 1; j > 0; j--) perimeter.push(j * n + 0)
  const P = perimeter.length
  // anéis da saia: escalas multiplicativas a partir do ponto de borda
  // anéis fechados perto da borda (triângulos curtos, sombreamento sem raias) e
  // abertos longe, onde ninguém vê a diferença
  const SCALES = [1.03, 1.07, 1.12, 1.19, 1.28, 1.4, 1.56, 1.78, 2.08, 2.5, 3.1, 4.0, 5.4, 7.6, 11.0, 16.0]
  let prevRing = perimeter
  for (const s of SCALES) {
    const ring: number[] = []
    for (let k = 0; k < P; k++) {
      const pi = perimeter[k]
      const bx = positions[pi * 3], bz = positions[pi * 3 + 2]
      const x = bx * s, z = bz * s
      const y = heightAt(x, z)
      ring.push(push(x, y, z, y - mean))
    }
    for (let k = 0; k < P; k++) {
      const a = prevRing[k], b = prevRing[(k + 1) % P], c = ring[k], d = ring[(k + 1) % P]
      indices.push(a, b, c, b, d, c)
    }
    prevRing = ring
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  // Enrolamento medido, não adivinhado: se a normal no centro apontar para
  // baixo, inverte todos os triângulos e recalcula. O mesmo teste vale para a
  // saia porque ela segue o mesmo sentido de giro do perímetro.
  const nrm = geo.attributes.normal as THREE.BufferAttribute
  const centerIdx = Math.floor(n / 2) * n + Math.floor(n / 2)
  if (nrm.getY(centerIdx) < 0) flipWinding(geo)
  const skirtProbe = perimeter.length + n * n // primeiro vértice do primeiro anel
  if ((geo.attributes.normal as THREE.BufferAttribute).getY(Math.min(skirtProbe, positions.length / 3 - 1)) < 0) {
    // a saia veio ao contrário da grade: inverte só os triângulos da saia
    const idx = geo.getIndex()!
    const start = (n - 1) * (n - 1) * 6
    for (let k = start; k < idx.count; k += 3) { const b = idx.getX(k + 1); idx.setX(k + 1, idx.getX(k + 2)); idx.setX(k + 2, b) }
    idx.needsUpdate = true
    geo.computeVertexNormals()
  }
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.receiveShadow = true
  mesh.name = 'Regolith'
  mesh.frustumCulled = false

  const group = new THREE.Group()
  group.add(mesh)
  return { group, heightAt, horizonAt: heightAt, baseAt, meanHeight: mean, halfExtent }
}

function flipWinding(geo: THREE.BufferGeometry) {
  const idx = geo.getIndex()!
  for (let k = 0; k < idx.count; k += 3) { const b = idx.getX(k + 1); idx.setX(k + 1, idx.getX(k + 2)); idx.setX(k + 2, b) }
  idx.needsUpdate = true
  geo.computeVertexNormals()
}

function fract(v: number) {
  return v - Math.floor(v)
}
