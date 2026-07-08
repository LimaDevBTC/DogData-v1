// ═══════════════════════════════════════════════════════════════════════════════
// lib/city/generator.ts — the v3 ORGANIC city layout (Tokyo, not a chessboard).
//
// A real city seen from above is a hierarchical ROAD NETWORK — ring roads + radial
// avenues + diagonals + a local grid that warps organically toward the edges. This
// module builds that graph and the domain-warped plots between the roads, avoiding
// water and parks, sorted inner→outer. It is the single source of truth for BOTH:
//
//   • the CrossChainCity registry — lots are MINTED on these organic plots and then
//     frozen (permanent), so the city keeps its road-aligned Tokyo shape instead of
//     the artificial phyllotaxis disc.
//   • /api/city/data — draws the same roads/water/parks as the environment, at the
//     SAME frozen scale, so buildings and streets always line up.
//
// buildCityAt(rLand) is deterministic and memoized: the same rLand always yields the
// same plots, which is exactly what "permanent lot" requires.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── District definitions — AGE COHORTS (center = oldest, edge = newest) ───────
// The city is organised by holding age: the innermost ring is the oldest coins
// (Genesis Core), fanning out to the freshest arrivals on the outskirts. Colours
// rotate warm (old) → cool (new) so the age gradient reads at a glance from above.
export const DISTRICTS = [
  { id: 0, name: 'Genesis Core',   color: '#FDE047', tag: 'Oldest coins'      },
  { id: 1, name: 'Diamond Hands',  color: '#FBBF24', tag: 'Ancient HODLers'   },
  { id: 2, name: 'Vanguard',       color: '#F7931A', tag: 'Early believers'   },
  { id: 3, name: 'Veterans',       color: '#FB7185', tag: 'Long-term'         },
  { id: 4, name: 'Seasoned',       color: '#E879F9', tag: 'Matured holdings'  },
  { id: 5, name: 'Steady',         color: '#C4B5FD', tag: 'Mid-tenure'        },
  { id: 6, name: 'Maturing',       color: '#A5B4FC', tag: 'Aging in'          },
  { id: 7, name: 'Recent',         color: '#93C5FD', tag: 'Newer holdings'    },
  { id: 8, name: 'Newcomers',      color: '#67E8F9', tag: 'Recent entrants'   },
  { id: 9, name: 'Fresh Arrivals', color: '#6EE7B7', tag: 'Just arrived'      },
]

// ─── World scale constants (base 1180 world, multiplied by WORLD_SCALE) ─────────
const R_BASE       = 1180
const GRID_SPACING = 12.5
const USABLE_FRAC  = 0.24

// ─── Satoshi Plaza (reorganizecity.md · BLOCO 1) ───────────────────────────────
// A project-owned commercial square at the dead centre (0,0). No wallet lot is ever
// placed inside PLAZA.radius — the oldest holders ring AROUND it. Fixed absolute
// size (a landmark), independent of how big the city grows.
export const PLAZA = {
  radius: 820,   // reserved central circle (no wallet lots inside) — 3× wider plaza
  half:   510,   // half side-length of the square plaza (3× the original)
}

const SEEDS_BASE: [number, number][] = [
  [   0,    0], [  90,   65], [ 178,    0], [  90, -110], [-178,  110],
  [ -67, -200], [-578,  245], [ 578,  200], [ 245, -710], [-290, -688],
]
const OCEAN_START_X_BASE = -950
const RIVER_W_BASE       = 48
const LAKES_BASE: [number, number, number][] = [
  [-618, 320, 132], [ 396, 688, 106], [-132, -352, 78],
]

// ── Active (scaled) world state — set by configureWorld() ───────────────────────
let WORLD_SCALE  = 1
let R_LAND       = R_BASE
let SEEDS: [number, number][]              = SEEDS_BASE
let OCEAN_START_X                          = OCEAN_START_X_BASE
let RIVER_W                                = RIVER_W_BASE
let LAKES: [number, number, number][]      = LAKES_BASE

export function deriveRLand(n: number): number {
  const cellArea  = GRID_SPACING * GRID_SPACING
  const areaTotal = (n / USABLE_FRAC) * cellArea
  const r         = Math.sqrt(areaTotal / Math.PI)
  return Math.max(R_BASE, r)
}

function configureWorld(rLand: number): void {
  R_LAND      = rLand
  WORLD_SCALE = rLand / R_BASE
  const s     = WORLD_SCALE
  SEEDS         = SEEDS_BASE.map(([x, z]) => [x * s, z * s] as [number, number])
  OCEAN_START_X = OCEAN_START_X_BASE * s
  RIVER_W       = RIVER_W_BASE * s
  LAKES         = LAKES_BASE.map(([x, z, r]) => [x * s, z * s, r * s] as [number, number, number])
}

// ─── Deterministic value noise / fbm ──────────────────────────────────────────
function h2(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123
  return s - Math.floor(s)
}
function vn(x: number, z: number): number {
  const xi = Math.floor(x), zi = Math.floor(z)
  let xf = x - xi, zf = z - zi
  xf = xf * xf * (3 - 2 * xf); zf = zf * zf * (3 - 2 * zf)
  const a = h2(xi, zi), b = h2(xi + 1, zi), c = h2(xi, zi + 1), d = h2(xi + 1, zi + 1)
  return a + (b - a) * xf + (c - a) * zf + (a - b - c + d) * xf * zf
}
function fbm(x: number, z: number, oct = 4): number {
  let a = 0.5, s = 0, n = 0
  for (let i = 0; i < oct; i++) { s += a * vn(x, z); n += a; x = x * 2.03 + 15.1; z = z * 2.03 - 7.7; a *= 0.5 }
  return s / n
}

function outlineR(theta: number): number {
  return R_LAND * (
    1
    + 0.150 * Math.sin(3 * theta + 0.7)
    + 0.095 * Math.sin(5 * theta + 2.1)
    + 0.065 * Math.sin(7 * theta - 1.3)
    - 0.050 * Math.cos(2 * theta + 0.4)
  )
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
function riverX(z: number): number {
  const s = WORLD_SCALE
  const t = smoothstep(820 * s, 1240 * s, z)   // delta blend near the south edge
  // The meander FADES as the river nears its mouth so the delta approaches the sea
  // in a clean straight run (no wrong-way hook) instead of wiggling into the coast.
  const meander = (120 * s * Math.sin(z * (0.0033 / s) + 0.8) + 62 * s * Math.sin(z * (0.0074 / s) + 2.1)) * (1 - t)
  const spine = 350 * s + meander
  // Mouth sits WEST of the coast (out in the ocean) so the delta flows INTO the sea
  // instead of dead-ending on the beach.
  const mouth = OCEAN_START_X - 260 * s
  return spine * (1 - t) + mouth * t
}
function isInLake(x: number, z: number): boolean {
  return LAKES.some(([lx, lz, r]) => (x - lx) ** 2 + (z - lz) ** 2 < r * r)
}
function isInRiver(x: number, z: number): boolean { return Math.abs(x - riverX(z)) < RIVER_W }
function isInOcean(x: number, z: number): boolean { return x < OCEAN_START_X }
function inLand(x: number, z: number): boolean {
  if (isInOcean(x, z)) return false
  const r = Math.hypot(x, z)
  return r <= outlineR(Math.atan2(z, x))
}

function nearestSeedSoft(px: number, pz: number): number {
  const warp = fbm(px * 0.0016 + 3, pz * 0.0016 + 3) - 0.5
  let best = 0, bestDist = Infinity
  for (let i = 0; i < SEEDS.length; i++) {
    const dx = px - SEEDS[i][0], dz = pz - SEEDS[i][1]
    let d = Math.sqrt(dx * dx + dz * dz)
    d *= 1 + warp * 0.18 * Math.sin(i * 2.3 + px * 0.002 + pz * 0.0017)
    if (d < bestDist) { bestDist = d; best = i }
  }
  return best
}

function buildStreetMask(count: number, salt: number): boolean[] {
  const mask = new Array<boolean>(count).fill(false)
  let i = 2
  while (i < count) {
    mask[i] = true
    const gap = 6 + Math.floor(h2(i * 1.7 + salt, salt * 3.3) * 8)
    i += gap
  }
  return mask
}

// ═══════════════════════════════════════════════════════════════════════════════
// Road network
// ═══════════════════════════════════════════════════════════════════════════════
export type RoadClass = 'ring' | 'avenue' | 'diagonal' | 'coastal' | 'riverside'
export interface Road { cls: RoadClass; w: number; pts: [number, number][] }

const ROAD_W: Record<RoadClass, number> = {
  ring: 30, avenue: 26, diagonal: 24, coastal: 20, riverside: 14,
}

function splitOnLand(cands: [number, number][], minRun = 2): [number, number][][] {
  const runs: [number, number][][] = []
  let cur: [number, number][] = []
  for (const p of cands) {
    if (inLand(p[0], p[1])) { cur.push(p) }
    else { if (cur.length >= minRun) runs.push(cur); cur = [] }
  }
  if (cur.length >= minRun) runs.push(cur)
  return runs
}

function buildRoads(): Road[] {
  const roads: Road[] = []
  const s = WORLD_SCALE

  const N_AVE = 8
  for (let i = 0; i < N_AVE; i++) {
    const base = (i / N_AVE) * Math.PI * 2 + (h2(i, 7) - 0.5) * 0.35
    const cands: [number, number][] = []
    for (let r = 30 * s; r <= R_LAND * 1.18; r += 22 * s) {
      const a = base + 0.11 * Math.sin(r * (0.0034 / s) + i * 1.3)
      cands.push([Math.cos(a) * r, Math.sin(a) * r])
    }
    for (const run of splitOnLand(cands)) roads.push({ cls: 'avenue', w: ROAD_W.avenue, pts: run })
  }

  const RINGS = [360 * s, 700 * s, 1000 * s]
  RINGS.forEach((R, ri) => {
    const cands: [number, number][] = []
    for (let t = 0; t <= 1.0001; t += 1 / 96) {
      const th = t * Math.PI * 2
      const rr = R * (1 + 0.12 * Math.sin(3 * th + ri) + 0.07 * Math.sin(5 * th + ri * 2))
      cands.push([Math.cos(th) * rr, Math.sin(th) * rr])
    }
    for (const run of splitOnLand(cands, 3)) roads.push({ cls: 'ring', w: ROAD_W.ring, pts: run })
  })

  const DIAGS: { ang: number; off: number }[] = [
    { ang:  0.62, off:  120 * s },
    { ang: -0.90, off: -160 * s },
    { ang:  2.05, off:  90  * s },
  ]
  for (const { ang, off } of DIAGS) {
    const dx = Math.cos(ang), dz = Math.sin(ang)
    const nx = -dz, nz = dx
    const cands: [number, number][] = []
    for (let t = -R_LAND * 1.3; t <= R_LAND * 1.3; t += 24 * s) {
      cands.push([dx * t + nx * off, dz * t + nz * off])
    }
    for (const run of splitOnLand(cands)) roads.push({ cls: 'diagonal', w: ROAD_W.diagonal, pts: run })
  }

  {
    const cands: [number, number][] = []
    for (let z = -R_LAND * 1.2; z <= R_LAND * 1.2; z += 26 * s) {
      const x = OCEAN_START_X + 120 * s + 12 * s * Math.sin(z * (0.004 / s) + 1.1)
      cands.push([x, z])
    }
    for (const run of splitOnLand(cands, 3)) roads.push({ cls: 'coastal', w: ROAD_W.coastal, pts: run })
  }

  for (const side of [-1, 1] as const) {
    const cands: [number, number][] = []
    for (let z = -R_LAND * 1.2; z <= R_LAND * 1.2; z += 24 * s) {
      cands.push([riverX(z) + side * (RIVER_W + 16 * s), z])
    }
    for (const run of splitOnLand(cands, 3)) roads.push({ cls: 'riverside', w: ROAD_W.riverside, pts: run })
  }

  return roads
}

function segDist2(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax, dz = bz - az
  const l2 = dx * dx + dz * dz
  let t = l2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0
  t = t < 0 ? 0 : t > 1 ? 1 : t
  const cx = ax + t * dx, cz = az + t * dz
  return (px - cx) ** 2 + (pz - cz) ** 2
}

interface Seg { ax: number; az: number; bx: number; bz: number; hw2: number }
function roadSegments(roads: Road[]): Seg[] {
  const segs: Seg[] = []
  for (const road of roads) {
    const hw = road.w / 2 + 4
    const hw2 = hw * hw
    for (let i = 0; i < road.pts.length - 1; i++) {
      segs.push({ ax: road.pts[i][0], az: road.pts[i][1], bx: road.pts[i + 1][0], bz: road.pts[i + 1][1], hw2 })
    }
  }
  return segs
}

export interface Bridge { x: number; z: number; angle: number; span: number; w: number }
function buildBridges(roads: Road[]): Bridge[] {
  const s = WORLD_SCALE
  const bridges: Bridge[] = []
  const seen: [number, number][] = []
  const dedup2 = (70 * s) ** 2
  for (const road of roads) {
    if (road.cls === 'riverside' || road.cls === 'coastal') continue
    for (let i = 0; i < road.pts.length - 1; i++) {
      const [ax, az] = road.pts[i], [bx, bz] = road.pts[i + 1]
      const fa = ax - riverX(az), fb = bx - riverX(bz)
      if (fa === 0 && fb === 0) continue
      if ((fa <= 0) !== (fb <= 0)) {
        const t = fa / (fa - fb)
        const x = ax + t * (bx - ax), z = az + t * (bz - az)
        let rdx = bx - ax, rdz = bz - az
        const rl = Math.hypot(rdx, rdz) || 1; rdx /= rl; rdz /= rl
        const rvx = (riverX(z + 1) - riverX(z - 1)) / 2
        const rvl = Math.hypot(rvx, 1); const rvdx = rvx / rvl, rvdz = 1 / rvl
        const sinAng = Math.abs(rdx * rvdz - rdz * rvdx)
        if (sinAng < 0.45) continue
        if (seen.some(([sx, sz]) => (sx - x) ** 2 + (sz - z) ** 2 < dedup2)) continue
        seen.push([x, z])
        const span = Math.min(RIVER_W * 2 + 120 * s, Math.max(RIVER_W * 2 + 34 * s, (RIVER_W * 2 + 34 * s) / sinAng))
        bridges.push({
          x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10,
          angle: Math.atan2(rdz, rdx), span: Math.round(span), w: road.w,
        })
      }
    }
  }
  return bridges
}

// ─── Parks ─────────────────────────────────────────────────────────────────────
export interface Park { x: number; z: number; r: number }
function buildParks(): Park[] {
  const parks: Park[] = []
  const N = 30
  const GA = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < N; i++) {
    const frac = (i + 0.5) / N
    const rr = (0.20 + 0.78 * Math.sqrt(frac)) * R_LAND
    const ang = i * GA + (h2(i, 5) - 0.5) * 0.9
    const x = Math.cos(ang) * rr + (h2(i, 11) - 0.5) * R_LAND * 0.05
    const z = Math.sin(ang) * rr + (h2(i, 13) - 0.5) * R_LAND * 0.05
    if (!inLand(x, z)) continue
    if (isInOcean(x, z) || isInLake(x, z) || isInRiver(x, z)) continue
    const r = (36 + h2(i, 17) * 60) * (0.5 + frac) * WORLD_SCALE
    parks.push({ x, z, r })
  }
  return parks
}

// ─── Plots (organic, road-aligned, sorted inner→outer per district) ────────────
export interface Plot { x: number; z: number; rot: number; dist2: number }

function generatePlots(segs: Seg[], parks: Park[]): { districtPlots: Plot[][]; total: number } {
  const s = WORLD_SCALE
  const districtPlots: Plot[][] = Array.from({ length: 10 }, () => [])
  let total = 0

  const gridCount = Math.round((2 * R_LAND) / GRID_SPACING) + 2
  const streetsI = buildStreetMask(gridCount, 1)
  const streetsJ = buildStreetMask(gridCount, 2)

  for (let gx = -R_LAND; gx <= R_LAND; gx += GRID_SPACING) {
    const gi = Math.round((gx + R_LAND) / GRID_SPACING)
    if (streetsI[gi]) continue
    for (let gz = -R_LAND; gz <= R_LAND; gz += GRID_SPACING) {
      const gj = Math.round((gz + R_LAND) / GRID_SPACING)
      if (streetsJ[gj]) continue

      const r0 = Math.hypot(gx, gz)
      const warpAmp = Math.min(1, Math.max(0, (r0 - 240 * s) / (900 * s))) * 30
      const dxN = fbm(gx * 0.0021 + 11, gz * 0.0021 + 11) - 0.5
      const dzN = fbm(gx * 0.0021 + 91, gz * 0.0021 + 91) - 0.5
      const px = gx + dxN * warpAmp * 2 + Math.sin(gx * 0.41 + gz * 0.87) * 2.0
      const pz = gz + dzN * warpAmp * 2 + Math.cos(gz * 0.59 + gx * 0.73) * 2.0

      if (!inLand(px, pz)) continue
      if (px < OCEAN_START_X + 138 * s) continue
      if (isInLake(px, pz) || isInRiver(px, pz)) continue
      if (px * px + pz * pz < PLAZA.radius * PLAZA.radius) continue   // reserve the central plaza

      let inPark = false
      for (let pk = 0; pk < parks.length; pk++) {
        if ((px - parks[pk].x) ** 2 + (pz - parks[pk].z) ** 2 < parks[pk].r * parks[pk].r) { inPark = true; break }
      }
      if (inPark) continue

      const edgeR = outlineR(Math.atan2(pz, px))
      const thinStart = 0.32 * R_LAND
      const keepProb = 1 - 0.55 * Math.min(1, Math.max(0, (r0 - thinStart) / (edgeR - thinStart + 1)))
      if (h2(gx * 1.7, gz * 2.3) > keepProb) continue

      let onRoad = false
      for (let si = 0; si < segs.length; si++) {
        if (segDist2(px, pz, segs[si].ax, segs[si].az, segs[si].bx, segs[si].bz) < segs[si].hw2) { onRoad = true; break }
      }
      if (onRoad) continue

      const orientAmp = Math.min(0.55, r0 / (2600 * s))
      const rot = orientAmp * (fbm(gx * 0.0016 + 5, gz * 0.0016 + 5) - 0.5) * 2 + (h2(gi, gj) - 0.5) * 0.04

      const d = nearestSeedSoft(px, pz)
      const [sx, sz] = SEEDS[d]
      districtPlots[d].push({ x: px, z: pz, rot, dist2: (px - sx) ** 2 + (pz - sz) ** 2 })
      total++
    }
  }
  for (const plots of districtPlots) plots.sort((a, b) => a.dist2 - b.dist2)
  return { districtPlots, total }
}

export async function buildVoronoiPolygons(rLand: number, seeds: [number, number][]): Promise<[number, number][][]> {
  const { Delaunay } = await import('d3-delaunay')
  const pts = seeds.flatMap(([x, z]) => [x, z])
  const delaunay = new Delaunay(Float64Array.from(pts))
  const voronoi = delaunay.voronoi([-rLand, -rLand, rLand, rLand])
  return Array.from({ length: seeds.length }, (_, i) => {
    const poly = voronoi.cellPolygon(i)
    return poly ? (poly as [number, number][]) : []
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// buildCityAt — the full organic layout at a GIVEN land radius (memoized).
// This is the frozen, deterministic source of both the registry's lot positions
// and the /api/city/data environment.
// ═══════════════════════════════════════════════════════════════════════════════
export interface CityLayout {
  rLand: number
  worldScale: number
  seeds: [number, number][]
  districtPlots: Plot[][]
  totalPlots: number
  roads: Road[]
  bridges: Bridge[]
  parks: Park[]
  riverPoints: { x: number; z: number }[]
  riverWidth: number
  outline: [number, number][]
  lakes: { x: number; z: number; r: number }[]
  oceanStartX: number
}

const _cache = new Map<number, CityLayout>()

export function buildCityAt(rLand: number): CityLayout {
  const key = Math.round(rLand)
  const hit = _cache.get(key)
  if (hit) return hit

  configureWorld(rLand)
  const roads = buildRoads()
  const segs = roadSegments(roads)
  const bridges = buildBridges(roads)
  const parks = buildParks()
  const { districtPlots, total } = generatePlots(segs, parks)

  const riverPoints: { x: number; z: number }[] = []
  const riverZExtent = 1300 * WORLD_SCALE, riverZStep = 30 * WORLD_SCALE
  for (let z = -riverZExtent; z <= riverZExtent; z += riverZStep) {
    riverPoints.push({ x: Math.round(riverX(z) * 10) / 10, z: Math.round(z * 10) / 10 })
  }
  const outline: [number, number][] = []
  for (let t = 0; t < 1; t += 1 / 128) {
    const th = t * Math.PI * 2
    outline.push([Math.round(Math.cos(th) * outlineR(th) * 10) / 10, Math.round(Math.sin(th) * outlineR(th) * 10) / 10])
  }

  const layout: CityLayout = {
    rLand: R_LAND,
    worldScale: WORLD_SCALE,
    seeds: SEEDS.map(([x, z]) => [x, z] as [number, number]),
    districtPlots,
    totalPlots: total,
    roads,
    bridges,
    parks,
    riverPoints,
    riverWidth: RIVER_W,
    outline,
    lakes: LAKES.map(([x, z, r]) => ({ x: Math.round(x), z: Math.round(z), r: Math.round(r) })),
    oceanStartX: Math.round(OCEAN_START_X),
  }
  _cache.set(key, layout)
  return layout
}

// ─── Age-ordered plot list (for the age-organised city) ─────────────────────────
// All organic plots flattened and sorted by an AGE KEY = distance-from-centre with a
// large low-frequency noise wobble added. The noise is the whole point: a STRICT
// radius sort makes perfect concentric rings (a disc), which fights the organic city
// shape. With the wobble the age gradient still trends centre→edge (old→new) but the
// bands meander like real neighbourhoods, and the registry then STRIDES across the
// full list so buildings fill the entire irregular outline, not just a central disc.
export interface RadialPlot { x: number; z: number; rot: number; r: number }
const _radialCache = new Map<number, RadialPlot[]>()
// Wobble amplitude as a fraction of the land radius. Higher = looser/more organic age
// bands (less circular); lower = crisper rings. 0.32 keeps a readable gradient that
// still follows the city's organic form.
const AGE_NOISE_AMP = 0.32
export function ageOrderedPlots(layout: CityLayout): RadialPlot[] {
  const key = Math.round(layout.rLand)
  const hit = _radialCache.get(key)
  if (hit) return hit
  const amp = AGE_NOISE_AMP * layout.rLand
  const all: RadialPlot[] = []
  for (const plots of layout.districtPlots) {
    for (const p of plots) {
      const rr = Math.hypot(p.x, p.z)
      // Wobble RAMPS UP with radius: the core stays crisply "oldest" (little noise),
      // while the outskirts get loose, organic age bands (lots of noise). This gives
      // both a clear old centre AND a non-circular, city-shaped gradient outward.
      const ampR = amp * smoothstep(0.08 * layout.rLand, 0.85 * layout.rLand, rr)
      const wobble = (fbm(p.x * 0.0016 + 21, p.z * 0.0016 + 21) - 0.5) * 2 * ampR
      // `r` holds the AGE KEY (noisy radius) used for ordering, not the true radius.
      all.push({ x: p.x, z: p.z, rot: p.rot, r: rr + wobble })
    }
  }
  all.sort((a, b) => a.r - b.r)
  _radialCache.set(key, all)
  return all
}

// Grow the land radius from N until every wallet fits, then return the layout AND
// the chosen rLand (the value to freeze into the registry).
export function buildCity(n: number): CityLayout {
  let rLand = deriveRLand(n)
  for (let attempt = 0; attempt < 6; attempt++) {
    const layout = buildCityAt(rLand)
    if (layout.totalPlots >= n) return layout
    rLand *= 1.12
  }
  return buildCityAt(rLand)
}

// ═══════════════════════════════════════════════════════════════════════════════
// Satoshi Plaza geometry (BLOCO 1) — the project-owned centre. A square with the
// DOG-sign Space-Needle tower dead centre, one big anchor at each side-centre (~50%
// of the side) and two flanking shops per side. All fixed in absolute world coords.
// ═══════════════════════════════════════════════════════════════════════════════
export interface PlazaBuilding { name: string; x: number; z: number; w: number; d: number; face: number }
export interface PlazaLayout {
  center: [number, number]
  radius: number
  half: number
  tower: { x: number; z: number; base: number; height: number }
  anchors: PlazaBuilding[]
  shops: PlazaBuilding[]
}

// Anchor / shop footprints are ABSOLUTE (kept the size they were at the 1× plaza),
// so a bigger plaza just gets MORE small shops filling the longer sides — the anchor
// no longer dominates.
const ANCHOR_W = 175, ANCHOR_D = 82
const SHOP_W = 74, SHOP_D = 58

export function plazaLayout(): PlazaLayout {
  const H = PLAZA.half

  // face = yaw so the building looks toward the plaza centre (0,0).
  const faceCenter = (x: number, z: number) => Math.atan2(-x, -z)

  // The four sides (project anchors, in the doc's order). tx/tz = along-side tangent.
  const sides: { name: string; x: number; z: number; tx: number; tz: number }[] = [
    { name: 'BitFlow',     x: 0,  z: H,  tx: 1, tz: 0 },  // north
    { name: 'DogShopping', x: H,  z: 0,  tx: 0, tz: 1 },  // east
    { name: 'BuildSpace',  x: 0,  z: -H, tx: 1, tz: 0 },  // south
    { name: 'Kray',        x: -H, z: 0,  tx: 0, tz: 1 },  // west
  ]

  const anchors: PlazaBuilding[] = sides.map(s => ({
    name: s.name, x: s.x, z: s.z, w: ANCHOR_W, d: ANCHOR_D, face: faceCenter(s.x, s.z),
  }))

  // Fill each side with small shops flanking the anchor out toward the corners.
  const shops: PlazaBuilding[] = []
  const first = ANCHOR_W / 2 + 34 + SHOP_W / 2    // clear of the anchor
  const step  = SHOP_W + 26
  const maxOff = H - SHOP_W / 2 - 20              // stop before the corner
  for (const s of sides) {
    for (let off = first; off <= maxOff; off += step) {
      for (const sign of [-1, 1]) {
        shops.push({
          name: `${s.name} Shop`,
          x: s.x + s.tx * off * sign,
          z: s.z + s.tz * off * sign,
          w: SHOP_W, d: SHOP_D, face: faceCenter(s.x, s.z),
        })
      }
    }
  }

  return {
    center: [0, 0],
    radius: PLAZA.radius,
    half: H,
    tower: { x: 0, z: 0, base: 34, height: 500 },
    anchors,
    shops,
  }
}
