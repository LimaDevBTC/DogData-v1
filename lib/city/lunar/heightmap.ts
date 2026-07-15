// ═══════════════════════════════════════════════════════════════════════════════
// lib/city/lunar/heightmap.ts — load + sample the per-site heightmap assets written
// by scripts/lunar/fetch_terrain.ts (public/lunar/<zone>-heightmap.{f32,json}).
// Grid is row-major, row=z axis, col=x axis, site-local meters, odd-sized (centre
// cell is exactly the site's point of interest).
// ═══════════════════════════════════════════════════════════════════════════════

import * as fs from 'fs'
import * as path from 'path'
import type { ZoneId } from '../zones'

export interface HeightmapMeta {
  zone: ZoneId
  name: string
  cols: number
  rows: number
  cellSizeM: number
  siteRadiusM: number
  slopeLimitDeg: number
  siteCenterLatDeg: number
  siteCenterLonDeg: number
  centerElevationM: number
  minRelM: number
  maxRelM: number
  demUrl: string
  generatedAt: string
}

export interface Heightmap {
  meta: HeightmapMeta
  data: Float32Array   // site-relative elevation meters
  gridHalf: number
}

const publicLunarDir = () => path.join(process.cwd(), 'public', 'lunar')

export function loadHeightmap(zone: ZoneId): Heightmap {
  const dir = publicLunarDir()
  const meta = JSON.parse(fs.readFileSync(path.join(dir, `${zone}-heightmap.json`), 'utf8')) as HeightmapMeta
  const buf = fs.readFileSync(path.join(dir, `${zone}-heightmap.f32`))
  const data = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4)
  const gridHalf = (meta.cols - 1) / 2
  return { meta, data, gridHalf }
}

// Bilinear elevation sample (site-relative meters) at site-local (xM, zM). null if
// the point falls outside the fetched grid.
export function sampleHeight(hm: Heightmap, xM: number, zM: number): number | null {
  const gx = xM / hm.meta.cellSizeM + hm.gridHalf
  const gz = zM / hm.meta.cellSizeM + hm.gridHalf
  if (gx < 0 || gz < 0 || gx > hm.meta.cols - 1 || gz > hm.meta.rows - 1) return null
  const c0 = Math.floor(gx), r0 = Math.floor(gz)
  const c1 = Math.min(hm.meta.cols - 1, c0 + 1)
  const r1 = Math.min(hm.meta.rows - 1, r0 + 1)
  const fc = gx - c0, fr = gz - r0
  const w = hm.meta.cols
  const v00 = hm.data[r0 * w + c0]
  const v01 = hm.data[r0 * w + c1]
  const v10 = hm.data[r1 * w + c0]
  const v11 = hm.data[r1 * w + c1]
  return v00 * (1 - fr) * (1 - fc) + v01 * (1 - fr) * fc + v10 * fr * (1 - fc) + v11 * fr * fc
}

// Local slope in degrees at (xM, zM) via a central finite difference one cell wide.
// null if any sample needed for the difference falls outside the grid.
export function sampleSlopeDeg(hm: Heightmap, xM: number, zM: number): number | null {
  const eps = hm.meta.cellSizeM
  const hL = sampleHeight(hm, xM - eps, zM)
  const hR = sampleHeight(hm, xM + eps, zM)
  const hD = sampleHeight(hm, xM, zM - eps)
  const hU = sampleHeight(hm, xM, zM + eps)
  if (hL == null || hR == null || hD == null || hU == null) return null
  const dhdx = (hR - hL) / (2 * eps)
  const dhdz = (hU - hD) / (2 * eps)
  return Math.atan(Math.hypot(dhdx, dhdz)) * (180 / Math.PI)
}
