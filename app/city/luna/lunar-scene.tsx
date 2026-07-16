'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// DogCity Luna — Phase 1.5: the FULL Moon.
//
// Real-scale lunar globe (R = 1,737,400 m) built from NASA's global LOLA elevation
// grid + the LROC color mosaic (CGI Moon Kit), with the three high-res city sites
// (Mare Tranquillitatis / Shackleton / Peary) embedded at their TRUE selenographic
// coordinates — the city is no longer floating in space. One real sun computed from
// the live subsolar point lights the whole globe (real terminator) and doubles as
// the per-site shadow caster.
//
// Raw Three.js (not @react-three/fiber — this repo's r3f build crashes against its
// installed React at runtime; see city-3d.tsx which set this precedent).
//
// World frame: P(lat, lon) = R·(cosφ·cosλ, sinφ, −cosφ·sinλ)  →  +Y = north pole.
// Precision: the globe mesh lives at planet magnitude (float32 rounding ~0.1 m is
// fine for km-res data), but each SITE group is anchored at its sphere position
// with vertex/instance coordinates RELATIVE to that anchor — the CPU computes
// modelView in float64, so close-up geometry never sees planet-scale rounding.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { DISTRICTS, type ZoneId } from '@/lib/city/zones'
import { LUNAR_SITES, siteLocalToLatLon } from '@/lib/city/lunar/sites'
import { R_MOON } from '@/lib/city/lunar/projection'
import { sampleGlobalHeight, type GlobalGrid } from '@/lib/city/lunar/grid'
import { subsolarPoint, subEarthPoint } from '@/lib/city/lunar/sun'

const ZONES: ZoneId[] = ['btc-core', 'solana', 'stacks']

const ZONE_LABEL: Record<ZoneId, { name: string; color: string }> = {
  'btc-core': { name: 'BTC-core — Mare Tranquillitatis', color: '#F7931A' },
  solana: { name: 'Solana — Shackleton', color: '#9945FF' },
  stacks: { name: 'Stacks — Peary', color: '#5546FF' },
}

// Site patches were fetched out to PAD × siteRadius (fetch_terrain.ts) — the outer
// band [BLEND_START..1] of that square is blended onto the coarse globe surface so
// the high-res patch lands seamlessly on the sphere.
const PATCH_PAD = 1.15
const BLEND_START = 0.82
const SKIRT_DROP = 400        // m — perimeter wall hiding any residual crack
const GLOBE_SINK = 150        // m — globe depressed under patch interiors (kills poke-through)

const DEG2RAD = Math.PI / 180

function unitFromLatLon(latDeg: number, lonDeg: number): THREE.Vector3 {
  const phi = latDeg * DEG2RAD, lam = lonDeg * DEG2RAD
  return new THREE.Vector3(Math.cos(phi) * Math.cos(lam), Math.sin(phi), -Math.cos(phi) * Math.sin(lam))
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// ─── Data loading ─────────────────────────────────────────────────────────────
interface SiteMeta {
  cols: number; rows: number; cellSizeM: number
  siteRadiusM: number
  siteCenterLatDeg: number; siteCenterLonDeg: number
  centerElevationM: number
}
interface LunarLot {
  xM: number; zM: number; elevationM: number
  district: number; heightTier: number; footprint: number
}
interface SiteData { meta: SiteMeta; heights: Float32Array; lots: LunarLot[] }
interface GlobeData {
  grid: GlobalGrid
  colorTex: THREE.Texture
  lonOffsetDeg: number
}

async function loadSite(zone: ZoneId): Promise<SiteData | null> {
  try {
    const [meta, buf, lots] = await Promise.all([
      fetch(`/lunar/${zone}-heightmap.json`).then(r => { if (!r.ok) throw new Error('no heightmap meta'); return r.json() }),
      fetch(`/lunar/${zone}-heightmap.f32`).then(r => { if (!r.ok) throw new Error('no heightmap bin'); return r.arrayBuffer() }),
      fetch(`/lunar/${zone}-lots.json`).then(r => r.ok ? r.json() : []),
    ])
    return { meta, heights: new Float32Array(buf), lots }
  } catch (err) {
    console.warn(`[luna] ${zone}: ${(err as Error).message}`)
    return null
  }
}

async function loadGlobe(): Promise<GlobeData> {
  const [hMeta, hBuf, cMeta] = await Promise.all([
    fetch('/lunar/globe-height.json').then(r => { if (!r.ok) throw new Error('no globe-height meta'); return r.json() }),
    fetch('/lunar/globe-height.i16').then(r => { if (!r.ok) throw new Error('no globe-height bin'); return r.arrayBuffer() }),
    fetch('/lunar/globe-color.json').then(r => { if (!r.ok) throw new Error('no globe-color meta'); return r.json() }),
  ])
  const grid: GlobalGrid = { cols: hMeta.cols, rows: hMeta.rows, data: new Int16Array(hBuf) }
  const colorTex = await new THREE.TextureLoader().loadAsync('/lunar/globe-color.jpg')
  colorTex.colorSpace = THREE.SRGBColorSpace
  colorTex.anisotropy = 8
  return { grid, colorTex, lonOffsetDeg: cMeta.lonOffsetDeg ?? 0 }
}

// ─── Globe mesh ───────────────────────────────────────────────────────────────
// Custom lat/lon grid sphere displaced by the real global DEM. UVs are laid out so
// u=0 falls exactly on the color texture's left edge (lonOffsetDeg, self-tested at
// build time), which also puts the mesh's duplicated seam column on the texture
// seam — no wrap-filtering artifacts.
function buildGlobe(globe: GlobeData, sites: Partial<Record<ZoneId, SiteData>>): THREE.Mesh {
  const N_LON = 1024, N_LAT = 512
  const vertsPerRow = N_LON + 1
  const positions = new Float32Array((N_LAT + 1) * vertsPerRow * 3)
  const uvs = new Float32Array((N_LAT + 1) * vertsPerRow * 2)

  // Precompute site anchors for the under-patch depression.
  const sinkSites = ZONES.filter(z => sites[z]).map(z => {
    const m = sites[z]!.meta
    return { dir: unitFromLatLon(m.siteCenterLatDeg, m.siteCenterLonDeg), radiusM: m.siteRadiusM }
  })

  const p = new THREE.Vector3()
  for (let j = 0; j <= N_LAT; j++) {
    const lat = 90 - (j / N_LAT) * 180
    for (let i = 0; i <= N_LON; i++) {
      const lon = globe.lonOffsetDeg + (i / N_LON) * 360
      let radius = R_MOON + sampleGlobalHeight(globe.grid, lat, lon)
      p.copy(unitFromLatLon(lat, lon))
      // Depress the globe under each site patch so the high-res terrain always
      // renders on top; the patch's blended edge + skirt covers the transition.
      for (const s of sinkSites) {
        const angDistM = Math.acos(Math.min(1, Math.max(-1,
          p.x * s.dir.x + p.y * s.dir.y + p.z * s.dir.z))) * R_MOON
        const dNorm = angDistM / (s.radiusM * PATCH_PAD)
        if (dNorm < 1.15) radius -= GLOBE_SINK * (1 - smoothstep(1.0, 1.15, dNorm))
      }
      const k = j * vertsPerRow + i
      positions[k * 3] = p.x * radius
      positions[k * 3 + 1] = p.y * radius
      positions[k * 3 + 2] = p.z * radius
      uvs[k * 2] = i / N_LON
      uvs[k * 2 + 1] = 1 - j / N_LAT   // flipY default: v=1 = image top = north
    }
  }

  const indices = new Uint32Array(N_LAT * N_LON * 6)
  let ii = 0
  for (let j = 0; j < N_LAT; j++) {
    for (let i = 0; i < N_LON; i++) {
      const a = j * vertsPerRow + i, b = a + 1
      const c = a + vertsPerRow, d = c + 1
      indices[ii++] = a; indices[ii++] = c; indices[ii++] = b
      indices[ii++] = b; indices[ii++] = c; indices[ii++] = d
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geo.setIndex(new THREE.BufferAttribute(indices, 1))
  geo.computeVertexNormals()

  // Bump map from the same real DEM — fine lighting detail beyond the mesh res.
  const bumpCanvas = document.createElement('canvas')
  bumpCanvas.width = globe.grid.cols; bumpCanvas.height = globe.grid.rows
  const ctx = bumpCanvas.getContext('2d')!
  const img = ctx.createImageData(globe.grid.cols, globe.grid.rows)
  let minH = Infinity, maxH = -Infinity
  for (let k = 0; k < globe.grid.data.length; k++) {
    const v = globe.grid.data[k]
    if (v < minH) minH = v
    if (v > maxH) maxH = v
  }
  const span = Math.max(1, maxH - minH)
  for (let k = 0; k < globe.grid.data.length; k++) {
    const g = Math.round(((globe.grid.data[k] - minH) / span) * 255)
    img.data[k * 4] = g; img.data[k * 4 + 1] = g; img.data[k * 4 + 2] = g; img.data[k * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  const bumpTex = new THREE.CanvasTexture(bumpCanvas)
  bumpTex.wrapS = THREE.RepeatWrapping
  // bump canvas row 0 = north (+90) and is indexed by TRUE lon 0..360; the mesh UV
  // u=0 sits at lonOffsetDeg — shift the bump texture by the same offset.
  bumpTex.offset.x = ((globe.lonOffsetDeg % 360) + 360) % 360 / 360
  bumpTex.anisotropy = 4

  const mat = new THREE.MeshStandardMaterial({
    map: globe.colorTex,
    bumpMap: bumpTex,
    bumpScale: 28,
    roughness: 0.96,
    metalness: 0,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.receiveShadow = true
  return mesh
}

// ─── Site patch on the sphere ─────────────────────────────────────────────────
// Rebuilds the site heightmap as sphere-space geometry: every grid vertex goes
// site-local (x,z) → true (lat,lon) → sphere position at its REAL radius, with the
// outer band blended down onto the coarse globe surface and a perimeter skirt.
// All positions are relative to `anchor` (returned) for float precision.
function buildSitePatch(
  site: SiteData, zone: ZoneId, globe: GlobeData,
): { group: THREE.Group; anchor: THREE.Vector3 } {
  const { meta, heights } = site
  const siteDef = LUNAR_SITES[zone]
  const anchor = unitFromLatLon(meta.siteCenterLatDeg, meta.siteCenterLonDeg)
    .multiplyScalar(R_MOON + meta.centerElevationM)

  const group = new THREE.Group()
  group.position.copy(anchor)

  // Decimate the big polar grids (691²) — stride 2 keeps ~10 m effective res.
  const stride = meta.cols > 400 ? 2 : 1
  const n = Math.floor((meta.cols - 1) / stride) + 1
  const gridHalf = (meta.cols - 1) / 2
  const halfExtent = gridHalf * meta.cellSizeM   // = PATCH_PAD × siteRadius (from fetch)

  let minRel = Infinity, maxRel = -Infinity
  for (let k = 0; k < heights.length; k++) {
    const v = heights[k]
    if (v < minRel) minRel = v
    if (v > maxRel) maxRel = v
  }
  const relSpan = Math.max(1, maxRel - minRel)

  const positions = new Float32Array(n * n * 3)
  const colors = new Float32Array(n * n * 3)
  const pos = new THREE.Vector3()
  for (let j = 0; j < n; j++) {
    const gz = Math.min(meta.rows - 1, j * stride)
    const z = (gz - gridHalf) * meta.cellSizeM
    for (let i = 0; i < n; i++) {
      const gx = Math.min(meta.cols - 1, i * stride)
      const x = (gx - gridHalf) * meta.cellSizeM
      const rel = heights[gz * meta.cols + gx]
      const { latDeg, lonDeg } = siteLocalToLatLon(siteDef, x, z)

      const e = Math.max(Math.abs(x), Math.abs(z)) / halfExtent   // 0 centre → 1 outer edge
      const t = smoothstep(BLEND_START, 1.0, e)
      const trueR = R_MOON + meta.centerElevationM + rel
      const globeR = R_MOON + sampleGlobalHeight(globe.grid, latDeg, lonDeg)
      const radius = trueR * (1 - t) + globeR * t

      pos.copy(unitFromLatLon(latDeg, lonDeg)).multiplyScalar(radius).sub(anchor)
      const k = j * n + i
      positions[k * 3] = pos.x; positions[k * 3 + 1] = pos.y; positions[k * 3 + 2] = pos.z
      const shade = 0.11 + ((rel - minRel) / relSpan) * 0.15
      colors[k * 3] = shade; colors[k * 3 + 1] = shade * 0.97; colors[k * 3 + 2] = shade * 0.93
    }
  }

  // Grid triangles + perimeter skirt (outer ring duplicated, pushed toward the
  // moon's centre by SKIRT_DROP) — covers any residual crack against the globe.
  const perimeter: number[] = []
  for (let i = 0; i < n; i++) perimeter.push(i)                                // top row →
  for (let j = 1; j < n; j++) perimeter.push(j * n + (n - 1))                  // right col ↓
  for (let i = n - 2; i >= 0; i--) perimeter.push((n - 1) * n + i)             // bottom row ←
  for (let j = n - 2; j >= 1; j--) perimeter.push(j * n)                       // left col ↑

  const skirtBase = n * n
  const allPositions = new Float32Array((n * n + perimeter.length) * 3)
  const allColors = new Float32Array((n * n + perimeter.length) * 3)
  allPositions.set(positions); allColors.set(colors)
  const radialDir = new THREE.Vector3()
  perimeter.forEach((src, s) => {
    const k = skirtBase + s
    radialDir.set(positions[src * 3] + anchor.x, positions[src * 3 + 1] + anchor.y, positions[src * 3 + 2] + anchor.z).normalize()
    allPositions[k * 3] = positions[src * 3] - radialDir.x * SKIRT_DROP
    allPositions[k * 3 + 1] = positions[src * 3 + 1] - radialDir.y * SKIRT_DROP
    allPositions[k * 3 + 2] = positions[src * 3 + 2] - radialDir.z * SKIRT_DROP
    allColors[k * 3] = colors[src * 3] * 0.6
    allColors[k * 3 + 1] = colors[src * 3 + 1] * 0.6
    allColors[k * 3 + 2] = colors[src * 3 + 2] * 0.6
  })

  const indices: number[] = []
  for (let j = 0; j < n - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      const a = j * n + i, b = a + 1, c = a + n, d = c + 1
      indices.push(a, c, b, b, c, d)
    }
  }
  const P = perimeter.length
  for (let s = 0; s < P; s++) {
    const a = perimeter[s], b = perimeter[(s + 1) % P]
    const a2 = skirtBase + s, b2 = skirtBase + ((s + 1) % P)
    indices.push(a, b, a2, b, b2, a2)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(allPositions, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(allColors, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()

  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 1, metalness: 0, side: THREE.DoubleSide,
  }))
  mesh.receiveShadow = true
  mesh.castShadow = true
  group.add(mesh)

  // ── Lots — instanced blocks standing radially on the real surface ───────────
  if (site.lots.length > 0) {
    const boxGeo = new THREE.BoxGeometry(1, 1, 1)
    const markMat = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.05 })
    const inst = new THREE.InstancedMesh(boxGeo, markMat, site.lots.length)
    inst.castShadow = true
    inst.receiveShadow = true
    const dummy = new THREE.Object3D()
    const color = new THREE.Color()
    const up = new THREE.Vector3(0, 1, 0)
    const radial = new THREE.Vector3()
    const q = new THREE.Quaternion()
    site.lots.forEach((lot, li) => {
      const h = 2 + lot.heightTier * 5
      const footprint = Math.max(1, lot.footprint * 0.5)
      const { latDeg, lonDeg } = siteLocalToLatLon(siteDef, lot.xM, lot.zM)
      // Same edge blend as the terrain so outer-ring lots sit on the blended surface.
      const e = Math.max(Math.abs(lot.xM), Math.abs(lot.zM)) / halfExtent
      const t = smoothstep(BLEND_START, 1.0, e)
      const trueR = R_MOON + meta.centerElevationM + lot.elevationM
      const globeR = R_MOON + sampleGlobalHeight(globe.grid, latDeg, lonDeg)
      const baseR = trueR * (1 - t) + globeR * t
      radial.copy(unitFromLatLon(latDeg, lonDeg))
      q.setFromUnitVectors(up, radial)
      dummy.position.copy(radial).multiplyScalar(baseR + h / 2).sub(anchor)
      dummy.quaternion.copy(q)
      dummy.scale.set(footprint, h, footprint)
      dummy.updateMatrix()
      inst.setMatrixAt(li, dummy.matrix)
      color.set(DISTRICTS[lot.district]?.color ?? '#888888')
      inst.setColorAt(li, color)
    })
    inst.instanceMatrix.needsUpdate = true
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true
    group.add(inst)
  }

  // Orbital beacon so the city is findable from space (fades out up close is
  // overkill for phase 1.5 — a small constant marker reads fine at all ranges).
  const beaconCanvas = document.createElement('canvas')
  beaconCanvas.width = beaconCanvas.height = 64
  const bctx = beaconCanvas.getContext('2d')!
  const grad = bctx.createRadialGradient(32, 32, 2, 32, 32, 30)
  grad.addColorStop(0, ZONE_LABEL[zone].color)
  grad.addColorStop(0.4, ZONE_LABEL[zone].color + 'aa')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  bctx.fillStyle = grad
  bctx.fillRect(0, 0, 64, 64)
  const beacon = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(beaconCanvas), transparent: true,
    depthWrite: false, sizeAttenuation: false,
  }))
  beacon.scale.setScalar(0.028)
  // group-local: unit radial × 30 km → world = anchor + 30 km straight up
  beacon.position.copy(anchor).normalize().multiplyScalar(30_000)
  group.add(beacon)

  return { group, anchor }
}

// ─── Stars ────────────────────────────────────────────────────────────────────
function buildStars(): THREE.Points {
  const count = 9000
  const pos = new Float32Array(count * 3)
  const R = 2.4e7
  for (let i = 0; i < count; i++) {
    // uniform on the full sphere — on a globe there is no "down" to skip
    const u = Math.random() * 2 - 1
    const theta = Math.random() * Math.PI * 2
    const s = Math.sqrt(1 - u * u)
    pos[i * 3] = R * s * Math.cos(theta)
    pos[i * 3 + 1] = R * u
    pos[i * 3 + 2] = R * s * Math.sin(theta)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const mat = new THREE.PointsMaterial({
    color: 0xdfe6f5, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0.85,
  })
  return new THREE.Points(geo, mat)
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function LunarScene() {
  const mountRef = useRef<HTMLDivElement>(null)
  const flyToRef = useRef<((zone: ZoneId | 'orbit') => void) | null>(null)
  const sunApiRef = useRef<((mode: 'real' | 'daylight') => void) | null>(null)
  const [sunModeUi, setSunModeUi] = useState<'real' | 'daylight'>('daylight')
  const [loading, setLoading] = useState(true)
  const [loadedZones, setLoadedZones] = useState<Partial<Record<ZoneId, { lots: number }>>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let renderer: THREE.WebGLRenderer | null = null
    let raf = 0
    let controls: any = null

    ;(async () => {
      let globe: GlobeData
      try {
        globe = await loadGlobe()
      } catch (err) {
        setLoading(false)
        setError(`Globe data missing — run scripts/lunar/fetch_globe.ts first. (${(err as Error).message})`)
        return
      }
      const pairs = await Promise.all(ZONES.map(z => loadSite(z).then(d => [z, d] as const)))
      if (cancelled) return
      const sites: Partial<Record<ZoneId, SiteData>> = {}
      for (const [z, d] of pairs) if (d) sites[z] = d
      const summary: Partial<Record<ZoneId, { lots: number }>> = {}
      for (const z of ZONES) if (sites[z]) summary[z] = { lots: sites[z]!.lots.length }
      setLoadedZones(summary)
      setLoading(false)

      const mount = mountRef.current
      if (!mount) return
      const W = mount.clientWidth, H = mount.clientHeight

      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0x000000)

      // Log depth buffer: camera ranges from ~50 m over the city to ~4 moon radii.
      const camera = new THREE.PerspectiveCamera(50, W / H, 1, 6e7)

      renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true })
      renderer.setSize(W, H)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.05
      mount.appendChild(renderer.domElement)

      scene.add(buildStars())
      scene.add(buildGlobe(globe, sites))

      const anchors: Partial<Record<ZoneId, THREE.Vector3>> = {}
      for (const zone of ZONES) {
        const data = sites[zone]
        if (!data) continue
        const { group, anchor } = buildSitePatch(data, zone, globe)
        anchors[zone] = anchor
        scene.add(group)
      }

      // ── One real sun for the whole Moon — live subsolar point ────────────────
      // The 29.53-day lunar day is REAL here: a site can genuinely be in its
      // 2-week night (Mare Tranquillitatis was, the day this shipped). Two modes:
      //   real     — sun where it actually is right now
      //   daylight — sun forced ~40° over the focused site so the city is
      //              always explorable (view mode, clearly labelled in the UI)
      const subsolar = subsolarPoint(new Date())
      const realSunDir = unitFromLatLon(subsolar.latDeg, subsolar.lonDeg)
      const sun = new THREE.DirectionalLight(0xfff4e0, 2.4)
      sun.castShadow = true
      sun.shadow.mapSize.set(2048, 2048)
      scene.add(sun)
      scene.add(sun.target)

      // Earthshine — the Earth really does light the nearside's night (a full Earth
      // is dozens of times brighter than a full Moon). Aimed from the true
      // sub-Earth point, cool blue-grey, subtle but enough to read terrain at night.
      const subEarth = subEarthPoint(new Date())
      const earthDir = unitFromLatLon(subEarth.latDeg, subEarth.lonDeg)
      const earthshine = new THREE.DirectionalLight(0x9db4d8, 0.22)
      earthshine.position.copy(earthDir).multiplyScalar(R_MOON * 4)
      scene.add(earthshine)
      scene.add(new THREE.AmbientLight(0x30343e, 0.07))

      let sunMode: 'real' | 'daylight' = 'daylight'
      let focusedAnchor: THREE.Vector3 | null = null

      // Shadow frustum follows the focused site (a planet-wide shadow map would
      // have km-sized texels — useless for a city). Also re-aims the sun per mode.
      const updateSun = () => {
        const anchor = focusedAnchor ?? anchors['btc-core'] ?? new THREE.Vector3(R_MOON, 0, 0)
        let dir = realSunDir
        if (sunMode === 'daylight') {
          const up = anchor.clone().normalize()
          const east = new THREE.Vector3(0, 1, 0).cross(up).normalize()
          if (east.lengthSq() < 1e-6) east.set(1, 0, 0)
          // ~40° elevation from the local east — warm raking light, long shadows
          dir = up.clone().multiplyScalar(Math.sin(40 * DEG2RAD))
            .addScaledVector(east, Math.cos(40 * DEG2RAD)).normalize()
        }
        sun.target.position.copy(anchor)
        sun.position.copy(anchor).addScaledVector(dir, 40_000)
        const span = 6000
        sun.shadow.camera.left = -span; sun.shadow.camera.right = span
        sun.shadow.camera.top = span; sun.shadow.camera.bottom = -span
        sun.shadow.camera.near = 10
        sun.shadow.camera.far = 90_000
        sun.shadow.bias = -0.0004
        sun.shadow.camera.updateProjectionMatrix()
      }
      const focusShadow = (anchor: THREE.Vector3) => {
        focusedAnchor = anchor
        updateSun()
      }
      sunApiRef.current = (m) => { sunMode = m; updateSun() }

      // ── Controls + fly-to ────────────────────────────────────────────────────
      try {
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')
        if (cancelled) return
        controls = new OrbitControls(camera, renderer.domElement)
        controls.enableDamping = true
        controls.dampingFactor = 0.08
        controls.minDistance = 40
        controls.maxDistance = 1.6e7
        controls.zoomSpeed = 1.4
      } catch { /* static camera still renders */ }

      const flyTo = (target: ZoneId | 'orbit') => {
        if (target === 'orbit') {
          camera.up.set(0, 1, 0)
          const dir = anchors['btc-core']?.clone().normalize() ?? new THREE.Vector3(1, 0.2, 0).normalize()
          camera.position.copy(dir).multiplyScalar(R_MOON * 3.1).add(new THREE.Vector3(0, R_MOON * 0.4, 0))
          controls?.target.set(0, 0, 0)
          camera.lookAt(0, 0, 0)
          controls?.update()
          return
        }
        const anchor = anchors[target]
        if (!anchor) return
        const up = anchor.clone().normalize()
        // On a sphere "up" is radial — without this the view arrives rolled sideways
        // (OrbitControls orbits around camera.up).
        camera.up.copy(up)
        const east = new THREE.Vector3(0, 1, 0).cross(up).normalize()
        if (east.lengthSq() < 1e-6) east.set(1, 0, 0) // exactly at a pole
        const pos = anchor.clone().addScaledVector(up, 2600).addScaledVector(east, 4200)
        camera.position.copy(pos)
        controls?.target.copy(anchor)
        camera.lookAt(anchor)
        controls?.update()
        focusShadow(anchor)
      }
      flyToRef.current = flyTo
      flyTo('btc-core')
      // debug handle for headless verification (harmless in prod)
      ;(window as any).__luna = { camera, get controls() { return controls }, anchors, flyTo }

      const onResize = () => {
        if (!mount || !renderer) return
        const w = mount.clientWidth, h = mount.clientHeight
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
      }
      window.addEventListener('resize', onResize)

      const animate = () => {
        raf = requestAnimationFrame(animate)
        controls?.update()
        renderer!.render(scene, camera)
      }
      animate()

      ;(mount as any).__cleanup = () => {
        window.removeEventListener('resize', onResize)
        cancelAnimationFrame(raf)
        controls?.dispose?.()
        renderer?.dispose()
        if (renderer?.domElement.parentElement === mount) mount.removeChild(renderer.domElement)
      }
    })()

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      const cleanup = (mountRef.current as any)?.__cleanup
      if (cleanup) cleanup()
    }
  }, [])

  return (
    <div className="w-full h-screen bg-black relative overflow-hidden">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <p className="font-mono text-xs text-white/60 tracking-[0.25em] uppercase">Loading the Moon…</p>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <p className="font-mono text-xs text-red-400 tracking-[0.2em] uppercase text-center px-6">{error}</p>
        </div>
      )}
      <div ref={mountRef} className="w-full h-full" />

      {/* fly-to controls */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-1.5">
        {ZONES.map(zone => (
          <button
            key={zone}
            onClick={() => flyToRef.current?.(zone)}
            disabled={!loadedZones[zone]}
            className="font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded text-left transition-colors"
            style={{
              background: 'rgba(0,0,0,0.6)',
              border: `1px solid ${loadedZones[zone] ? ZONE_LABEL[zone].color + '88' : '#333'}`,
              color: loadedZones[zone] ? '#fff' : '#555',
            }}
          >
            <span style={{ color: ZONE_LABEL[zone].color }}>● </span>
            {ZONE_LABEL[zone].name}
            {loadedZones[zone] && <span className="text-white/40"> · {loadedZones[zone]!.lots.toLocaleString()} lots</span>}
          </button>
        ))}
        <button
          onClick={() => flyToRef.current?.('orbit')}
          className="font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded text-left"
          style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid #666', color: '#ccc' }}
        >
          ◐ Full Moon
        </button>
        <button
          onClick={() => {
            const next = sunModeUi === 'daylight' ? 'real' : 'daylight'
            setSunModeUi(next)
            sunApiRef.current?.(next)
          }}
          className="font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded text-left"
          style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid #666', color: '#ccc' }}
          title="Real: the sun where it actually is right now (a site can be in its 2-week lunar night). Daylight: sun forced over the focused site."
        >
          {sunModeUi === 'daylight' ? '☀ Sun: daylight (forced)' : '🌓 Sun: real ephemeris'}
        </button>
      </div>

      <div className="absolute bottom-3 left-4 z-10 font-mono text-[9px] text-white/30 tracking-wider pointer-events-none">
        Terrain: NASA LRO/LOLA · SLDEM2015 · Color: NASA SVS CGI Moon Kit / LROC (ASU) · Public domain
      </div>
    </div>
  )
}
