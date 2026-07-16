'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// DogCity Luna — Phase 1.5: the FULL Moon.
//
// Real-scale lunar globe (R = 1,737,400 m) built from NASA's global LOLA elevation
// grid + the LROC color mosaic (CGI Moon Kit), with the three high-res city sites
// (Mare Tranquillitatis / Shackleton / Peary) embedded at their TRUE selenographic
// coordinates. One real sun computed from the live subsolar point lights the whole
// globe (real terminator); "daylight" mode force-lights the focused site because a
// real site spends two weeks a month in lunar night.
//
// Terrain stitching (reviewed adversarially — the naive version had the coarse
// globe facets slicing through the polar city):
//   • globe vertices within ~30 km of a site are SUNK by a per-site depth derived
//     from that site's real relief, so no coarse facet can rise into city terrain;
//   • each site gets an APRON: a square annulus of real global-DEM terrain from the
//     patch edge out to ~30 km whose outer band reproduces the globe mesh's own
//     triangulated surface EXACTLY (same vertex grid, same diagonal split), making
//     the outer seam watertight by construction;
//   • the patch keeps a deep skirt covering the patch↔apron step (site data is
//     5–59 m/px, the apron is 3.75 km/px — they legitimately disagree locally).
// The Moon's horizon is only ~2.5 km away at ground level, so the sunk-globe dish
// is never visible from the city; from orbit it is sub-pixel shading.
//
// Raw Three.js (not @react-three/fiber — broken against this repo's React).
// World frame: P(lat, lon) = R·(cosφ·cosλ, sinφ, −cosφ·sinλ)  →  +Y = north pole.
// Precision: site groups are anchored at their sphere position with vertex/instance
// coordinates RELATIVE to the anchor (CPU computes modelView in float64).
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { DISTRICTS, type ZoneId } from '@/lib/city/zones'
import { LUNAR_SITES, siteLocalToLatLon, latLonToSiteLocal } from '@/lib/city/lunar/sites'
import { R_MOON } from '@/lib/city/lunar/projection'
import { sampleGlobalHeight, type GlobalGrid } from '@/lib/city/lunar/grid'
import { subsolarPoint, subEarthPoint } from '@/lib/city/lunar/sun'

const ZONES: ZoneId[] = ['btc-core', 'solana', 'stacks']

const ZONE_LABEL: Record<ZoneId, { name: string; color: string }> = {
  'btc-core': { name: 'BTC-core — Mare Tranquillitatis', color: '#F7931A' },
  solana: { name: 'Solana — Shackleton', color: '#9945FF' },
  stacks: { name: 'Stacks — Peary', color: '#5546FF' },
}

const N_LON = 1024, N_LAT = 512          // globe mesh resolution
const APRON_HALF = 30_000                 // m — apron outer half-extent
const APRON_STEP = 640                    // m — apron grid step
const APRON_GLOBE_BLEND = 23_000          // m — where the apron starts conforming to the globe mesh
const SINK_RAMP_END = 32_000              // m — sink fades to zero here

const DEG2RAD = Math.PI / 180

function unitFromLatLon(latDeg: number, lonDeg: number, out?: THREE.Vector3): THREE.Vector3 {
  const phi = latDeg * DEG2RAD, lam = lonDeg * DEG2RAD
  const v = out ?? new THREE.Vector3()
  return v.set(Math.cos(phi) * Math.cos(lam), Math.sin(phi), -Math.cos(phi) * Math.sin(lam))
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// Emit grid triangles with OUTWARD-facing winding. The local x,z → lat/lon mapping
// flips handedness between hemispheres/projections (a south-polar grid comes out
// mirror-imaged), so the winding is decided from the actual geometry: the central
// quad's face normal is dotted against the outward radial — negative means flip.
// Getting this wrong = the whole mesh backface-culls into an invisible hole.
function emitGridIndices(
  positions: Float32Array, n: number, anchor: THREE.Vector3,
  push: (a: number, b: number, c: number) => void,
): void {
  const c0 = Math.floor(n / 2) - 1
  const k00 = (c0 * n + c0) * 3, k10 = (c0 * n + c0 + 1) * 3, k01 = ((c0 + 1) * n + c0) * 3
  const e1 = new THREE.Vector3(positions[k10] - positions[k00], positions[k10 + 1] - positions[k00 + 1], positions[k10 + 2] - positions[k00 + 2])
  const e2 = new THREE.Vector3(positions[k01] - positions[k00], positions[k01 + 1] - positions[k00 + 1], positions[k01 + 2] - positions[k00 + 2])
  const outward = new THREE.Vector3(positions[k00] + anchor.x, positions[k00 + 1] + anchor.y, positions[k00 + 2] + anchor.z).normalize()
  const flip = e2.cross(e1).dot(outward) < 0
  for (let j = 0; j < n - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      const a = j * n + i, b = a + 1, c = a + n, d = c + 1
      if (flip) { push(a, b, c); push(b, d, c) }
      else { push(a, c, b); push(b, c, d) }
    }
  }
}

// Interpolate a regular grid the way its TRIANGLE MESH renders it (diagonal b–c on
// every quad, matching the index pattern (a,c,b)(b,c,d) used by both the globe and
// the patches). Bilinear would diverge from the rendered surface by ~¼ of the
// quad's diagonal curvature — hundreds of meters on coarse polar terrain.
// (The flipped winding emitted by emitGridIndices keeps the SAME b–c diagonal, so
// this interpolation stays exact for both orientations.)
function meshInterp(get: (i: number, j: number) => number, nI: number, nJ: number, fi: number, fj: number): number {
  const ci = Math.min(nI - 2, Math.max(0, Math.floor(fi)))
  const cj = Math.min(nJ - 2, Math.max(0, Math.floor(fj)))
  const u = Math.min(1, Math.max(0, fi - ci))
  const v = Math.min(1, Math.max(0, fj - cj))
  const A = get(ci, cj), B = get(ci + 1, cj), C = get(ci, cj + 1), D = get(ci + 1, cj + 1)
  if (u + v <= 1) return A + u * (B - A) + v * (C - A)
  return D + (1 - u) * (C - D) + (1 - v) * (B - D)
}

// ─── Data ─────────────────────────────────────────────────────────────────────
interface SiteMeta {
  cols: number; rows: number; cellSizeM: number
  siteRadiusM: number
  siteCenterLatDeg: number; siteCenterLonDeg: number
  centerElevationM: number
  minRelM: number; maxRelM: number
}
interface LunarLot {
  xM: number; zM: number; elevationM: number
  district: number; heightTier: number; footprint: number
}
interface WideData { meta: SiteMeta; heights: Float32Array }
interface SiteData { meta: SiteMeta; heights: Float32Array; lots: LunarLot[]; wide: WideData | null }
interface GlobeData {
  grid: GlobalGrid
  colorTex: THREE.Texture
  lonOffsetDeg: number
  albedo: { data: Uint8ClampedArray; w: number; h: number } | null
}

async function loadSite(zone: ZoneId): Promise<SiteData | null> {
  try {
    const [meta, buf, lots] = await Promise.all([
      fetch(`/lunar/${zone}-heightmap.json`).then(r => { if (!r.ok) throw new Error('no heightmap meta'); return r.json() }),
      fetch(`/lunar/${zone}-heightmap.f32`).then(r => { if (!r.ok) throw new Error('no heightmap bin'); return r.arrayBuffer() }),
      fetch(`/lunar/${zone}-lots.json`).then(r => r.ok ? r.json() : []),
    ])
    if (buf.byteLength !== meta.cols * meta.rows * 4) {
      throw new Error(`heightmap size mismatch: ${buf.byteLength} B for ${meta.cols}x${meta.rows}`)
    }
    // Optional wide backdrop (polar sites) — absence is fine, presence must be sane.
    let wide: WideData | null = null
    try {
      const [wMeta, wBuf] = await Promise.all([
        fetch(`/lunar/${zone}-wide-heightmap.json`).then(r => { if (!r.ok) throw new Error('none'); return r.json() }),
        fetch(`/lunar/${zone}-wide-heightmap.f32`).then(r => { if (!r.ok) throw new Error('none'); return r.arrayBuffer() }),
      ])
      if (wBuf.byteLength === wMeta.cols * wMeta.rows * 4) {
        wide = { meta: wMeta, heights: new Float32Array(wBuf) }
      }
    } catch { /* no wide product for this site */ }
    return { meta, heights: new Float32Array(buf), lots, wide }
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
  if (hBuf.byteLength !== hMeta.cols * hMeta.rows * 2) {
    throw new Error(`globe-height size mismatch: ${hBuf.byteLength} B for ${hMeta.cols}x${hMeta.rows}`)
  }
  const grid: GlobalGrid = { cols: hMeta.cols, rows: hMeta.rows, data: new Int16Array(hBuf) }
  let colorTex: THREE.Texture
  try {
    colorTex = await new THREE.TextureLoader().loadAsync('/lunar/globe-color.jpg')
  } catch {
    throw new Error('globe-color.jpg failed to load')
  }
  colorTex.colorSpace = THREE.SRGBColorSpace
  colorTex.anisotropy = 8

  // CPU-readable albedo (downsampled) so patch/apron vertex colors can match the
  // photographic mosaic — otherwise the grey patches sit in a visible color island.
  let albedo: GlobeData['albedo'] = null
  try {
    const img = colorTex.image as HTMLImageElement
    const aw = 2048, ah = 1024
    const cv = document.createElement('canvas')
    cv.width = aw; cv.height = ah
    const ctx = cv.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(img, 0, 0, aw, ah)
    albedo = { data: ctx.getImageData(0, 0, aw, ah).data, w: aw, h: ah }
  } catch { /* albedo sampling optional — patches fall back to neutral grey */ }

  return { grid, colorTex, lonOffsetDeg: cMeta.lonOffsetDeg ?? 0, albedo }
}

function sampleAlbedo(globe: GlobeData, latDeg: number, lonDeg: number): { r: number; g: number; b: number } {
  if (!globe.albedo) return { r: 0.55, g: 0.53, b: 0.51 }
  const { data, w, h } = globe.albedo
  // albedo canvas columns follow the IMAGE, whose left edge is lonOffsetDeg
  const lon = (((lonDeg - globe.lonOffsetDeg) % 360) + 360) % 360
  const x = Math.min(w - 1, Math.max(0, Math.round((lon / 360) * w)))
  const y = Math.min(h - 1, Math.max(0, Math.round(((90 - latDeg) / 180) * h)))
  const k = (y * w + x) * 4
  return { r: data[k] / 255, g: data[k + 1] / 255, b: data[k + 2] / 255 }
}

// ─── Sink field + globe vertex radii (shared by globe mesh AND aprons) ─────────
interface SinkSite { dir: THREE.Vector3; s0: number }

function makeSinkSites(sites: Partial<Record<ZoneId, SiteData>>): SinkSite[] {
  // Sites WITH a wide backdrop don't sink the globe — their polar cap is simply
  // cut out of the globe mesh and replaced by real medium-res terrain.
  return ZONES.filter(z => sites[z] && !sites[z]!.wide).map(z => {
    const m = sites[z]!.meta
    // Depth scales with the site's real relief: enough that a coarse facet
    // interpolated across the sunk zone can never rise into the patch terrain.
    const s0 = (m.maxRelM - m.minRelM) * 1.2 + 300
    return { dir: unitFromLatLon(m.siteCenterLatDeg, m.siteCenterLonDeg), s0 }
  })
}

function sinkAt(px: number, py: number, pz: number, sinkSites: SinkSite[]): number {
  let sink = 0
  for (const s of sinkSites) {
    const dot = Math.min(1, Math.max(-1, px * s.dir.x + py * s.dir.y + pz * s.dir.z))
    const distM = Math.acos(dot) * R_MOON
    if (distM < SINK_RAMP_END) sink += s.s0 * (1 - smoothstep(SINK_RAMP_END * 0.55, SINK_RAMP_END, distM))
  }
  return sink
}

// The globe mesh's vertex radii, precomputed once: real DEM sample − sink, with the
// pole rows unified to ONE radius each (per-longitude radii on a zero-area direction
// fan produce vertical blade artifacts exactly where the polar cities live).
interface GlobeRadii { radii: Float32Array; lonOffsetDeg: number }

function buildGlobeRadii(globe: GlobeData, sinkSites: SinkSite[]): GlobeRadii {
  const vpr = N_LON + 1
  const radii = new Float32Array((N_LAT + 1) * vpr)
  const p = new THREE.Vector3()
  for (let j = 0; j <= N_LAT; j++) {
    const lat = 90 - (j / N_LAT) * 180
    for (let i = 0; i <= N_LON; i++) {
      const lon = globe.lonOffsetDeg + (i / N_LON) * 360
      unitFromLatLon(lat, lon, p)
      radii[j * vpr + i] = R_MOON + sampleGlobalHeight(globe.grid, lat, lon) - sinkAt(p.x, p.y, p.z, sinkSites)
    }
  }
  for (const j of [0, N_LAT]) {
    let sum = 0
    for (let i = 0; i <= N_LON; i++) sum += radii[j * vpr + i]
    const avg = sum / (N_LON + 1)
    for (let i = 0; i <= N_LON; i++) radii[j * vpr + i] = avg
  }
  return { radii, lonOffsetDeg: globe.lonOffsetDeg }
}

// The RENDERED globe surface at (lat,lon) — exact triangle interpolation over the
// vertex radii, so apron outer edges merge into the globe with zero crack.
function globeMeshRadius(gr: GlobeRadii, latDeg: number, lonDeg: number): number {
  const vpr = N_LON + 1
  const fi = ((((lonDeg - gr.lonOffsetDeg) % 360) + 360) % 360) / 360 * N_LON
  const fj = ((90 - latDeg) / 180) * N_LAT
  return meshInterp((i, j) => gr.radii[j * vpr + i], vpr, N_LAT + 1, fi, fj)
}

// ─── Globe mesh ───────────────────────────────────────────────────────────────
// `cutCaps` removes the quad rows poleward of ±CAP_LAT — the wide polar patches
// take over there (the 16ppd equirect grid is meaningless that close to a pole).
const CAP_LAT = 87.6

function buildGlobe(globe: GlobeData, gr: GlobeRadii, cutCaps: { north: boolean; south: boolean }): THREE.Mesh {
  const vpr = N_LON + 1
  const positions = new Float32Array((N_LAT + 1) * vpr * 3)
  const uvs = new Float32Array((N_LAT + 1) * vpr * 2)
  const p = new THREE.Vector3()
  for (let j = 0; j <= N_LAT; j++) {
    const lat = 90 - (j / N_LAT) * 180
    for (let i = 0; i <= N_LON; i++) {
      const lon = globe.lonOffsetDeg + (i / N_LON) * 360
      unitFromLatLon(lat, lon, p)
      const radius = gr.radii[j * vpr + i]
      const k = j * vpr + i
      positions[k * 3] = p.x * radius
      positions[k * 3 + 1] = p.y * radius
      positions[k * 3 + 2] = p.z * radius
      uvs[k * 2] = i / N_LON
      uvs[k * 2 + 1] = 1 - j / N_LAT   // flipY default: v=1 = image top = north
    }
  }

  const indices: number[] = []
  for (let j = 0; j < N_LAT; j++) {
    const latTop = 90 - (j / N_LAT) * 180
    const latBot = 90 - ((j + 1) / N_LAT) * 180
    if (cutCaps.north && latBot > CAP_LAT) continue
    if (cutCaps.south && latTop < -CAP_LAT) continue
    for (let i = 0; i < N_LON; i++) {
      const a = j * vpr + i, b = a + 1
      const c = a + vpr, d = c + 1
      indices.push(a, c, b, b, c, d)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geo.setIndex(indices)
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
  // bump canvas is indexed by TRUE lon 0..360; mesh UV u=0 sits at lonOffsetDeg
  bumpTex.offset.x = (((globe.lonOffsetDeg % 360) + 360) % 360) / 360
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

// ─── Apron — real global-DEM terrain ring bridging patch ↔ globe ──────────────
// Square annulus from the patch square out to APRON_HALF. Inside the patch square
// it drops a flat plug well below the patch (never visible); its outer band blends
// pure global data into the EXACT rendered globe surface.
interface ApronBuilt {
  mesh: THREE.Mesh
  finalRadii: Float32Array   // n×n ABSOLUTE radius of every rendered apron vertex
  n: number
  cellSizeM: number
}

function buildApron(
  meta: SiteMeta, zone: ZoneId, globe: GlobeData, gr: GlobeRadii, anchor: THREE.Vector3,
): ApronBuilt {
  const siteDef = LUNAR_SITES[zone]
  const gridHalf = (meta.cols - 1) / 2
  const patchHalf = gridHalf * meta.cellSizeM
  const n = Math.floor((APRON_HALF * 2) / APRON_STEP) + 1
  const half = ((n - 1) * APRON_STEP) / 2

  const positions = new Float32Array(n * n * 3)
  const colors = new Float32Array(n * n * 3)
  const finalRadii = new Float32Array(n * n)
  const pos = new THREE.Vector3()
  const plugRadius = R_MOON + meta.centerElevationM + meta.minRelM - 300

  for (let j = 0; j < n; j++) {
    const z = j * APRON_STEP - half
    for (let i = 0; i < n; i++) {
      const x = i * APRON_STEP - half
      const { latDeg, lonDeg } = siteLocalToLatLon(siteDef, x, z)
      const d = Math.max(Math.abs(x), Math.abs(z))
      let radius: number
      if (d <= patchHalf) {
        radius = plugRadius   // flat plug tucked under the high-res patch
      } else {
        const dataR = R_MOON + sampleGlobalHeight(globe.grid, latDeg, lonDeg)
        const t = smoothstep(APRON_GLOBE_BLEND, half, Math.hypot(x, z))
        radius = dataR * (1 - t) + globeMeshRadius(gr, latDeg, lonDeg) * t
      }
      finalRadii[j * n + i] = radius
      unitFromLatLon(latDeg, lonDeg, pos).multiplyScalar(radius).sub(anchor)
      const k = j * n + i
      positions[k * 3] = pos.x; positions[k * 3 + 1] = pos.y; positions[k * 3 + 2] = pos.z
      const alb = sampleAlbedo(globe, latDeg, lonDeg)
      colors[k * 3] = alb.r; colors[k * 3 + 1] = alb.g; colors[k * 3 + 2] = alb.b
    }
  }

  const indices = new Uint32Array((n - 1) * (n - 1) * 6)
  let ii = 0
  emitGridIndices(positions, n, anchor, (a, b, c) => { indices[ii++] = a; indices[ii++] = b; indices[ii++] = c })

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.setIndex(new THREE.BufferAttribute(indices, 1))
  geo.computeVertexNormals()

  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.96, metalness: 0,
  }))
  mesh.receiveShadow = true
  return { mesh, finalRadii, n, cellSizeM: APRON_STEP }
}

// ─── Wide polar backdrop — the rendered polar cap ──────────────────────────────
// Medium-res (~320 m) REAL terrain out to ±80 km around a polar site, replacing the
// cut-out globe cap. Outer band blends onto the globe mesh surface exactly; under
// the detail patch it drops a hidden plug. Heights are relative to the wide
// product's own centre elevation (its own meta), same site-local frame.
interface WideBuilt {
  mesh: THREE.Mesh
  finalRadii: Float32Array   // n×n ABSOLUTE radius of every rendered wide vertex
  n: number
  cellSizeM: number
}

function buildWidePatch(
  wide: WideData, detailMeta: SiteMeta, zone: ZoneId, globe: GlobeData, gr: GlobeRadii, anchor: THREE.Vector3,
): WideBuilt {
  const siteDef = LUNAR_SITES[zone]
  const m = wide.meta
  const n = m.cols
  const gridHalf = (n - 1) / 2
  const detailHalf = ((detailMeta.cols - 1) / 2) * detailMeta.cellSizeM
  const half = gridHalf * m.cellSizeM
  const blendStart = half * 0.86   // outer 14% conforms to the globe mesh

  const plugRadius = R_MOON + detailMeta.centerElevationM + detailMeta.minRelM - 250

  const positions = new Float32Array(n * n * 3)
  const colors = new Float32Array(n * n * 3)
  const finalRadii = new Float32Array(n * n)
  const pos = new THREE.Vector3()
  for (let j = 0; j < n; j++) {
    const z = (j - gridHalf) * m.cellSizeM
    for (let i = 0; i < n; i++) {
      const x = (i - gridHalf) * m.cellSizeM
      const { latDeg, lonDeg } = siteLocalToLatLon(siteDef, x, z)
      const d = Math.max(Math.abs(x), Math.abs(z))
      const r = Math.hypot(x, z)
      const dataR0 = R_MOON + m.centerElevationM + wide.heights[j * n + i]
      const t = smoothstep(blendStart, half, r)
      let radius = t > 0 ? dataR0 * (1 - t) + globeMeshRadius(gr, latDeg, lonDeg) * t : dataR0
      // Under the detail patch, dive to a hidden plug. The dive must COMPLETE well
      // inside the patch: the patch's edge blend interpolates wide vertices up to
      // one cell inside the boundary — any dived vertex there drags the patch edge
      // down into a visible trench (seen as a bright wall + shadow line on one side).
      if (d < detailHalf * 0.78) {
        const w = smoothstep(detailHalf * 0.45, detailHalf * 0.78, d)
        radius = plugRadius * (1 - w) + radius * w
      }
      // The square's CORNERS extend past the blend disc and would sit exactly ON the
      // globe surface (same function) → coplanar z-fighting. Tuck them just under.
      radius -= 15 * smoothstep(half * 0.985, half * 1.03, r)
      finalRadii[j * n + i] = radius
      unitFromLatLon(latDeg, lonDeg, pos).multiplyScalar(radius).sub(anchor)
      const k = j * n + i
      positions[k * 3] = pos.x; positions[k * 3 + 1] = pos.y; positions[k * 3 + 2] = pos.z
      const alb = sampleAlbedo(globe, latDeg, lonDeg)
      colors[k * 3] = alb.r; colors[k * 3 + 1] = alb.g; colors[k * 3 + 2] = alb.b
    }
  }

  const indices = new Uint32Array((n - 1) * (n - 1) * 6)
  let ii = 0
  emitGridIndices(positions, n, anchor, (a, b, c) => { indices[ii++] = a; indices[ii++] = b; indices[ii++] = c })

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.setIndex(new THREE.BufferAttribute(indices, 1))
  geo.computeVertexNormals()

  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.96, metalness: 0,
  }))
  mesh.receiveShadow = true
  return { mesh, finalRadii, n, cellSizeM: m.cellSizeM }
}

// ─── Site patch + lots + beacon ───────────────────────────────────────────────
function buildSitePatch(
  site: SiteData, zone: ZoneId, globe: GlobeData, gr: GlobeRadii,
): { group: THREE.Group; anchor: THREE.Vector3; surfaceRadiusAt: (latDeg: number, lonDeg: number) => number | null } {
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

  let minRel = Infinity, maxRel = -Infinity
  for (let k = 0; k < heights.length; k++) {
    const v = heights[k]
    if (v < minRel) minRel = v
    if (v > maxRel) maxRel = v
  }
  const relSpan = Math.max(1, maxRel - minRel)

  // Base albedo tone for the whole patch (site is ~2 texture pixels wide — one
  // sample at the centre is the right granularity) modulated by local relief.
  const baseAlb = sampleAlbedo(globe, meta.siteCenterLatDeg, meta.siteCenterLonDeg)

  // Wide backdrop FIRST — the patch's outer ~10% band blends onto the wide mesh's
  // FINAL rendered surface (post plug-dive, post globe-blend; meshInterp = exact
  // triangle interpolation), so the 5 m ↔ 320 m boundary is watertight instead of
  // reading as a raised tile edge. Lots are clipped at siteRadius = halfExtent/1.15
  // (≈ e 0.87) — never inside the blend band.
  const halfExtent = gridHalf * meta.cellSizeM
  const wideBuilt = site.wide ? buildWidePatch(site.wide, meta, zone, globe, gr, anchor) : null
  const sampleWideRel = (x: number, z: number): number | null => {
    if (!wideBuilt) return null
    const wHalf = (wideBuilt.n - 1) / 2
    const fi = x / wideBuilt.cellSizeM + wHalf
    const fj = z / wideBuilt.cellSizeM + wHalf
    if (fi < 0 || fj < 0 || fi > wideBuilt.n - 1 || fj > wideBuilt.n - 1) return null
    const radius = meshInterp((i, j) => wideBuilt.finalRadii[j * wideBuilt.n + i], wideBuilt.n, wideBuilt.n, fi, fj)
    return radius - (R_MOON + meta.centerElevationM)   // re-based to the DETAIL centre
  }

  // Decimated rel-height grid, kept for lot placement (lots must sit on the
  // RENDERED mesh, not the full-res data the mesh no longer shows).
  const relGrid = new Float32Array(n * n)
  const positions = new Float32Array(n * n * 3)
  const colors = new Float32Array(n * n * 3)
  const pos = new THREE.Vector3()
  for (let j = 0; j < n; j++) {
    const gz = Math.min(meta.rows - 1, j * stride)
    const z = (gz - gridHalf) * meta.cellSizeM
    for (let i = 0; i < n; i++) {
      const gx = Math.min(meta.cols - 1, i * stride)
      const x = (gx - gridHalf) * meta.cellSizeM
      let rel = heights[gz * meta.cols + gx]
      const e = Math.max(Math.abs(x), Math.abs(z)) / halfExtent
      const t = smoothstep(0.9, 1.0, e)
      if (t > 0) {
        const wideRel = sampleWideRel(x, z)
        if (wideRel != null) rel = rel * (1 - t) + wideRel * t
      }
      relGrid[j * n + i] = rel
      const { latDeg, lonDeg } = siteLocalToLatLon(siteDef, x, z)
      const radius = R_MOON + meta.centerElevationM + rel
      unitFromLatLon(latDeg, lonDeg, pos).multiplyScalar(radius).sub(anchor)
      const k = j * n + i
      positions[k * 3] = pos.x; positions[k * 3 + 1] = pos.y; positions[k * 3 + 2] = pos.z
      const shade = 0.72 + ((rel - minRel) / relSpan) * 0.55
      colors[k * 3] = baseAlb.r * shade
      colors[k * 3 + 1] = baseAlb.g * shade
      colors[k * 3 + 2] = baseAlb.b * shade
    }
  }

  // Perimeter skirt: covers the step onto the surrounding coarse data. With a wide
  // backdrop (same-instrument 40 m data) the step is small; against the 3.75 km
  // global grid it scales with the site's real relief.
  const skirtDrop = site.wide ? 500 : (meta.maxRelM - meta.minRelM) * 0.9 + 400
  const perimeter: number[] = []
  for (let i = 0; i < n; i++) perimeter.push(i)
  for (let j = 1; j < n; j++) perimeter.push(j * n + (n - 1))
  for (let i = n - 2; i >= 0; i--) perimeter.push((n - 1) * n + i)
  for (let j = n - 2; j >= 1; j--) perimeter.push(j * n)

  const skirtBase = n * n
  const allPositions = new Float32Array((n * n + perimeter.length) * 3)
  const allColors = new Float32Array((n * n + perimeter.length) * 3)
  allPositions.set(positions); allColors.set(colors)
  const radialDir = new THREE.Vector3()
  perimeter.forEach((src, s) => {
    const k = skirtBase + s
    radialDir.set(positions[src * 3] + anchor.x, positions[src * 3 + 1] + anchor.y, positions[src * 3 + 2] + anchor.z).normalize()
    allPositions[k * 3] = positions[src * 3] - radialDir.x * skirtDrop
    allPositions[k * 3 + 1] = positions[src * 3 + 1] - radialDir.y * skirtDrop
    allPositions[k * 3 + 2] = positions[src * 3 + 2] - radialDir.z * skirtDrop
    allColors[k * 3] = colors[src * 3] * 0.85
    allColors[k * 3 + 1] = colors[src * 3 + 1] * 0.85
    allColors[k * 3 + 2] = colors[src * 3 + 2] * 0.85
  })

  const indices: number[] = []
  emitGridIndices(positions, n, anchor, (a, b, c) => indices.push(a, b, c))
  const P = perimeter.length
  for (let s = 0; s < P; s++) {
    const a = perimeter[s], b = perimeter[(s + 1) % P]
    const a2 = skirtBase + s, b2 = skirtBase + ((s + 1) % P)
    // skirt walls stay DoubleSide via the patch material — winding uncritical
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

  // Terrain bridge to the globe: wide real polar cap when available (built above,
  // before the patch grid, so the patch edge could blend onto its final surface),
  // else the global-DEM apron ring.
  const apronBuilt = wideBuilt ? null : buildApron(meta, zone, globe, gr, anchor)
  if (wideBuilt) group.add(wideBuilt.mesh)
  else if (apronBuilt) group.add(apronBuilt.mesh)

  // Rendered-surface sampler for THIS site (detail patch > wide/apron), used by the
  // camera's ground collision and the cursor-zoom ray-march. Returns null outside
  // this site's terrain coverage.
  const surfaceRadiusAt = (latDeg: number, lonDeg: number): number | null => {
    const { x, z } = latLonToSiteLocal(siteDef, latDeg, lonDeg)
    if (Math.abs(x) <= halfExtent && Math.abs(z) <= halfExtent) {
      const fi = (x / meta.cellSizeM + gridHalf) / stride
      const fj = (z / meta.cellSizeM + gridHalf) / stride
      const rel = meshInterp((i, j) => relGrid[j * n + i], n, n, fi, fj)
      return R_MOON + meta.centerElevationM + rel
    }
    const ring = wideBuilt ?? apronBuilt
    if (ring) {
      const rHalf = (ring.n - 1) / 2
      const fi = x / ring.cellSizeM + rHalf
      const fj = z / ring.cellSizeM + rHalf
      if (fi >= 0 && fj >= 0 && fi <= ring.n - 1 && fj <= ring.n - 1) {
        return meshInterp((i, j) => ring.finalRadii[j * ring.n + i], ring.n, ring.n, fi, fj)
      }
    }
    return null
  }

  // ── Lots — instanced blocks standing radially on the RENDERED surface ───────
  // Base height sampled from the decimated mesh grid with the same triangle
  // interpolation the GPU rasterizes — the stored full-res elevation can differ
  // from the decimated mesh by ± meters (enough to sink a small marker).
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
      const fi = (lot.xM / meta.cellSizeM + gridHalf) / stride
      const fj = (lot.zM / meta.cellSizeM + gridHalf) / stride
      const relMesh = meshInterp((i, j) => relGrid[j * n + i], n, n, fi, fj)
      const { latDeg, lonDeg } = siteLocalToLatLon(siteDef, lot.xM, lot.zM)
      const baseR = R_MOON + meta.centerElevationM + relMesh
      unitFromLatLon(latDeg, lonDeg, radial)
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

  // Orbital beacon so the city is findable from space.
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

  return { group, anchor, surfaceRadiusAt }
}

// ─── Stars ────────────────────────────────────────────────────────────────────
function buildStars(): THREE.Points {
  const count = 9000
  const pos = new Float32Array(count * 3)
  const R = 2.4e7
  for (let i = 0; i < count; i++) {
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
    let cleanupFn: (() => void) | null = null

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

      const mount = mountRef.current
      if (!mount) { setLoading(false); return }
      const W = mount.clientWidth, H = mount.clientHeight

      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0x000000)

      // Log depth: camera ranges from ~50 m over the city to ~4 moon radii.
      const camera = new THREE.PerspectiveCamera(50, W / H, 1, 6e7)

      const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true })
      renderer.setSize(W, H)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap
      // Static scene: render the (1M-triangle) shadow casters once per sun/focus
      // change, not every frame.
      renderer.shadowMap.autoUpdate = false
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.05
      mount.appendChild(renderer.domElement)

      let raf = 0
      let controls: any = null
      // Registered NOW (before any await): unmount at any later point disposes
      // everything. Held in a closure var, not on the DOM node — React nulls the
      // ref before effect cleanup runs, so a ref-stored cleanup never fires.
      cleanupFn = () => {
        cancelAnimationFrame(raf)
        controls?.dispose?.()
        scene.traverse(obj => {
          const m = obj as THREE.Mesh
          if (m.geometry) m.geometry.dispose()
          const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : []
          for (const mat of mats) {
            for (const key of ['map', 'bumpMap'] as const) {
              const tex = (mat as any)[key]
              if (tex?.dispose) tex.dispose()
            }
            mat.dispose()
          }
        })
        renderer.dispose()
        if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement)
      }

      scene.add(buildStars())
      const sinkSites = makeSinkSites(sites)
      const gr = buildGlobeRadii(globe, sinkSites)
      const cutCaps = {
        north: ZONES.some(z => sites[z]?.wide && sites[z]!.meta.siteCenterLatDeg > 85),
        south: ZONES.some(z => sites[z]?.wide && sites[z]!.meta.siteCenterLatDeg < -85),
      }
      scene.add(buildGlobe(globe, gr, cutCaps))

      const anchors: Partial<Record<ZoneId, THREE.Vector3>> = {}
      const siteSamplers: ((latDeg: number, lonDeg: number) => number | null)[] = []
      for (const zone of ZONES) {
        const data = sites[zone]
        if (!data) continue
        const { group, anchor, surfaceRadiusAt } = buildSitePatch(data, zone, globe, gr)
        anchors[zone] = anchor
        siteSamplers.push(surfaceRadiusAt)
        scene.add(group)
      }

      // Rendered surface radius under any (lat,lon): site terrain wins over the
      // (possibly sunk / cap-cut) globe. Drives ground collision + cursor zoom.
      const RAD2DEG = 180 / Math.PI
      const surfaceRadiusAt = (latDeg: number, lonDeg: number): number => {
        let r = globeMeshRadius(gr, latDeg, lonDeg)
        for (const s of siteSamplers) {
          const v = s(latDeg, lonDeg)
          if (v != null && v > r) r = v
        }
        return r
      }
      const altitudeOf = (p: THREE.Vector3): number => {
        const r = p.length()
        const latDeg = Math.asin(Math.min(1, Math.max(-1, p.y / r))) * RAD2DEG
        const lonDeg = Math.atan2(-p.z, p.x) * RAD2DEG
        return r - surfaceRadiusAt(latDeg, lonDeg)
      }

      // Cheap analytic ray-march against the surface field (raycasting the actual
      // 1M-triangle meshes per wheel tick would stall the main thread).
      const raycastSurface = (origin: THREE.Vector3, dir: THREE.Vector3): THREE.Vector3 | null => {
        const p = new THREE.Vector3()
        let t = 0
        let prevAlt = altitudeOf(origin)
        if (prevAlt <= 0) return origin.clone()
        const maxT = origin.length() + R_MOON * 3
        for (let i = 0; i < 500 && t < maxT; i++) {
          const step = Math.max(20, prevAlt * 0.5)
          t += step
          p.copy(origin).addScaledVector(dir, t)
          const alt = altitudeOf(p)
          if (alt <= 0) {
            let lo = t - step, hi = t
            for (let k = 0; k < 24; k++) {
              const mid = (lo + hi) / 2
              p.copy(origin).addScaledVector(dir, mid)
              if (altitudeOf(p) > 0) lo = mid; else hi = mid
            }
            return p.copy(origin).addScaledVector(dir, (lo + hi) / 2)
          }
          // receding from the moon and already high → the ray missed
          if (alt > prevAlt && alt > R_MOON * 0.5 && p.dot(dir) > 0) return null
          prevAlt = alt
        }
        return null
      }

      // ── One real sun for the whole Moon — live subsolar point ────────────────
      const subsolar = subsolarPoint(new Date())
      const realSunDir = unitFromLatLon(subsolar.latDeg, subsolar.lonDeg)
      const sun = new THREE.DirectionalLight(0xfff4e0, 2.4)
      sun.castShadow = true
      sun.shadow.mapSize.set(2048, 2048)
      scene.add(sun)
      scene.add(sun.target)

      // Earthshine — the Earth genuinely lights the nearside's night. Aimed from
      // the true sub-Earth point, cool blue-grey, enough to read terrain at night.
      const subEarth = subEarthPoint(new Date())
      const earthDir = unitFromLatLon(subEarth.latDeg, subEarth.lonDeg)
      const earthshine = new THREE.DirectionalLight(0x9db4d8, 0.22)
      earthshine.position.copy(earthDir).multiplyScalar(R_MOON * 4)
      scene.add(earthshine)
      scene.add(new THREE.AmbientLight(0x30343e, 0.07))

      let sunMode: 'real' | 'daylight' = 'daylight'
      let focused: ZoneId | 'orbit' = 'btc-core'

      const updateSun = () => {
        const anchor = (focused !== 'orbit' && anchors[focused]) || null
        let dir = realSunDir.clone()
        if (sunMode === 'daylight') {
          if (anchor) {
            const up = anchor.clone().normalize()
            const east = new THREE.Vector3(0, 1, 0).cross(up).normalize()
            if (east.lengthSq() < 1e-6) east.set(1, 0, 0)
            // ~40° elevation from the local east — raking light, long shadows
            dir = up.clone().multiplyScalar(Math.sin(40 * DEG2RAD))
              .addScaledVector(east, Math.cos(40 * DEG2RAD)).normalize()
          } else {
            // orbit view: light the hemisphere the camera is looking at
            dir = camera.position.clone().normalize()
            if (dir.lengthSq() < 1e-6) dir.set(1, 0, 0)
          }
        }
        const shadowAnchor = anchor ?? new THREE.Vector3()
        sun.target.position.copy(shadowAnchor)
        sun.position.copy(shadowAnchor).addScaledVector(dir, anchor ? 40_000 : R_MOON * 4)
        const span = 6000
        sun.shadow.camera.left = -span; sun.shadow.camera.right = span
        sun.shadow.camera.top = span; sun.shadow.camera.bottom = -span
        sun.shadow.camera.near = 10
        sun.shadow.camera.far = anchor ? 90_000 : R_MOON * 8
        sun.shadow.bias = -0.0004
        sun.shadow.camera.updateProjectionMatrix()
        renderer.shadowMap.needsUpdate = true
      }
      sunApiRef.current = (m) => { sunMode = m; updateSun() }

      let OrbitControlsClass: any = null
      try {
        ({ OrbitControls: OrbitControlsClass } = await import('three/examples/jsm/controls/OrbitControls.js'))
      } catch { /* static camera still renders */ }
      if (cancelled) { cleanupFn(); cleanupFn = null; return }

      // OrbitControls captures camera.up ONCE at construction (its orbit-axis quat
      // lives in the update() closure) — on a globe the up-vector changes with every
      // site, so the controls are recreated whenever flyTo re-orients the camera.
      const makeControls = () => {
        if (!OrbitControlsClass) return
        const prevTarget = controls?.target.clone()
        controls?.dispose()
        controls = new OrbitControlsClass(camera, renderer.domElement)
        controls.enableDamping = true
        controls.dampingFactor = 0.08
        // Zoom is NOT OrbitControls' (it dollies toward the target — from orbit
        // that's the moon's CENTER, so it tunnels straight through the surface and
        // the 6 km city is flown past in two ticks). The custom wheel handler
        // below dollies toward the terrain point under the cursor instead.
        controls.enableZoom = false
        controls.minDistance = 1
        controls.maxDistance = 1.6e7
        if (prevTarget) controls.target.copy(prevTarget)
      }
      makeControls()

      // ── Cursor-anchored dolly (the city-3d.tsx trick, on a sphere) ───────────
      // Zoom-in moves the camera toward the surface point under the cursor and
      // drags the orbit pivot along; zoom-out backs away from the pivot. Never
      // tunnels: approach is clamped and a per-frame ground collision (below)
      // catches every other path (rotate/pan/damping).
      const _ndc = new THREE.Vector2()
      const _raycaster = new THREE.Raycaster()
      const onWheel = (e: WheelEvent) => {
        e.preventDefault()
        e.stopImmediatePropagation()
        if (!controls) return
        const rect = renderer.domElement.getBoundingClientRect()
        _ndc.set(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1,
        )
        const factor = Math.exp(Math.max(-240, Math.min(240, e.deltaY)) * 0.0016)
        if (factor < 1) {
          _raycaster.setFromCamera(_ndc, camera)
          const hit = raycastSurface(_raycaster.ray.origin, _raycaster.ray.direction)
          if (hit) {
            const offset = camera.position.clone().sub(hit)
            const newLen = Math.max(offset.length() * factor, 25)
            camera.position.copy(hit).addScaledVector(offset.normalize(), newLen)
            controls.target.lerp(hit, 1 - factor)
          } else {
            camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target)
          }
        } else {
          const offset = camera.position.clone().sub(controls.target)
          const newLen = Math.min(offset.length() * factor, 1.5e7)
          camera.position.copy(controls.target).addScaledVector(offset.normalize(), newLen)
        }
      }
      renderer.domElement.addEventListener('wheel', onWheel, { passive: false, capture: true })
      {
        const prevCleanupW = cleanupFn
        cleanupFn = () => {
          renderer.domElement.removeEventListener('wheel', onWheel, { capture: true } as any)
          prevCleanupW?.()
        }
      }

      const flyTo = (target: ZoneId | 'orbit') => {
        if (target === 'orbit' || !anchors[target as ZoneId]) {
          focused = 'orbit'
          camera.up.set(0, 1, 0)
          makeControls()   // orbit axis = camera.up, captured at construction
          const dir = anchors['btc-core']?.clone().normalize() ?? new THREE.Vector3(1, 0.2, 0).normalize()
          camera.position.copy(dir).multiplyScalar(R_MOON * 3.1).add(new THREE.Vector3(0, R_MOON * 0.4, 0))
          controls?.target.set(0, 0, 0)
          camera.lookAt(0, 0, 0)
          controls?.update()
          updateSun()
          return
        }
        const anchor = anchors[target as ZoneId]!
        focused = target as ZoneId
        const up = anchor.clone().normalize()
        // On a sphere "up" is radial — without this the view arrives rolled
        // sideways. OrbitControls captures the up-vector at CONSTRUCTION, so the
        // controls are rebuilt here (not just camera.up mutated).
        camera.up.copy(up)
        makeControls()
        const east = new THREE.Vector3(0, 1, 0).cross(up).normalize()
        if (east.lengthSq() < 1e-6) east.set(1, 0, 0) // exactly at a pole
        camera.position.copy(anchor).addScaledVector(up, 2600).addScaledVector(east, 4200)
        controls?.target.copy(anchor)
        camera.lookAt(anchor)
        controls?.update()
        updateSun()
      }
      flyToRef.current = flyTo
      // btc-core may have failed to load — fall back to any loaded site, else orbit.
      flyTo(ZONES.find(z => anchors[z]) ?? 'orbit')
      // debug handle for headless verification (harmless in prod)
      ;(window as any).__luna = { camera, get controls() { return controls }, anchors, flyTo }

      const onResize = () => {
        const w = mount.clientWidth, h = mount.clientHeight
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
      }
      window.addEventListener('resize', onResize)
      const prevCleanup = cleanupFn
      cleanupFn = () => { window.removeEventListener('resize', onResize); prevCleanup() }

      let firstFrame = true
      const animate = () => {
        raf = requestAnimationFrame(animate)
        controls?.update()
        // Ground collision — rotation/pan/damping must never carry the camera
        // through the terrain (the moon is 580× wider than the city; one careless
        // gesture at orbit scale would otherwise sail straight through it).
        {
          const alt = altitudeOf(camera.position)
          if (alt < 15) camera.position.multiplyScalar((camera.position.length() + (15 - alt)) / camera.position.length())
        }
        renderer.render(scene, camera)
        if (firstFrame) { firstFrame = false; setLoading(false) }   // loader stays up through the heavy build
      }
      animate()
    })()

    return () => {
      cancelled = true
      cleanupFn?.()
      cleanupFn = null
    }
  }, [])

  return (
    <div className="w-full h-screen bg-black relative overflow-hidden">
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
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
