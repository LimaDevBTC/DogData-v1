/**
 * DogCity Luna — Phase 1 terrain ingestion.
 *
 * Downloads a real elevation crop for one (or all) lunar site(s) from NASA's public
 * LOLA/SLDEM2015 archives (byte-range HTTP requests, pure JS float32 parsing — no
 * GDAL) and writes a compact local heightmap asset under public/lunar/.
 *
 * Usage:
 *   npx tsx scripts/lunar/fetch_terrain.ts                  # all 3 sites
 *   npx tsx scripts/lunar/fetch_terrain.ts --zone=btc-core   # one site
 */

import * as fs from 'fs'
import * as path from 'path'
import { LUNAR_SITES, siteLocalToProj, siteLocalToLatLon, type LunarSite } from '../../lib/city/lunar/sites'
import { fetchPdsImgRows, bilinearSample } from '../../lib/city/lunar/pds-img'
import { R_MOON } from '../../lib/city/lunar/projection'
import type { ZoneId } from '../../lib/city/zones'

const OUT_DIR = path.join(__dirname, '..', '..', 'public', 'lunar')
const DEG2RAD = Math.PI / 180
const PAD = 1.15 // fetch a bit past siteRadiusM so bilinear sampling never runs off the grid edge

function demCellSizeM(site: LunarSite): number {
  const dem = site.dem
  if (dem.kind === 'polar-tile') return dem.scaleM
  return (R_MOON * DEG2RAD) / dem.ppd
}

// site-local (x,z) → continuous (row,col) in the SOURCE file's own pixel grid.
function demPixelCoords(site: LunarSite, x: number, z: number): { row: number; col: number } {
  const dem = site.dem
  if (dem.kind === 'equirect-tile') {
    const { latDeg, lonDeg } = siteLocalToLatLon(site, x, z)
    const col = (lonDeg - dem.westLonDeg) * dem.ppd - 0.5
    const row = (dem.maxLatDeg - latDeg) * dem.ppd - 0.5
    return { row, col }
  }
  const p = siteLocalToProj(site, x, z)
  const col = dem.pixelOffset + p.x / dem.scaleM
  const row = dem.pixelOffset - p.z / dem.scaleM
  return { row, col }
}

async function fetchSite(site: LunarSite): Promise<void> {
  const cellSizeM = demCellSizeM(site)
  const halfM = site.siteRadiusM * PAD
  const gridHalf = Math.ceil(halfM / cellSizeM)
  const gridSize = gridHalf * 2 + 1

  console.log(`[${site.zone}] ${site.name}: siteRadiusM=${site.siteRadiusM} cellSizeM=${cellSizeM.toFixed(3)} grid=${gridSize}x${gridSize}`)

  // Bound the source rows we need from the 4 corners of the site-local bbox (both
  // projection kinds are locally affine in (row,col), so corners bound the range).
  const corners = [
    [-halfM, -halfM], [-halfM, halfM], [halfM, -halfM], [halfM, halfM],
  ] as const
  let rowMin = Infinity, rowMax = -Infinity
  for (const [x, z] of corners) {
    const { row } = demPixelCoords(site, x, z)
    rowMin = Math.min(rowMin, row)
    rowMax = Math.max(rowMax, row)
  }
  const rowStart = Math.floor(rowMin) - 2
  const rowEnd = Math.ceil(rowMax) + 2
  console.log(`[${site.zone}] fetching source rows [${rowStart}, ${rowEnd}) of ${site.dem.rows} (~${(((rowEnd - rowStart) * site.dem.recordBytes) / 1e6).toFixed(1)} MB)…`)

  const stripe = await fetchPdsImgRows(site.dem, rowStart, rowEnd)
  console.log(`[${site.zone}] got stripe: ${stripe.rows} rows x ${stripe.cols} cols, rowStart=${stripe.rowStart}`)

  // Sample the site-local grid (row = z axis, col = x axis), raw km-DN → meters.
  const raw = new Float32Array(gridSize * gridSize)
  for (let gz = 0; gz < gridSize; gz++) {
    const z = (gz - gridHalf) * cellSizeM
    for (let gx = 0; gx < gridSize; gx++) {
      const x = (gx - gridHalf) * cellSizeM
      const { row, col } = demPixelCoords(site, x, z)
      const dnKm = bilinearSample(stripe, row, col)
      raw[gz * gridSize + gx] = dnKm * 1000 // meters, absolute (relative to 1737.4km reference sphere)
    }
  }

  const centerElevationM = raw[gridHalf * gridSize + gridHalf]
  let minRelM = Infinity, maxRelM = -Infinity
  const rel = new Float32Array(gridSize * gridSize)
  for (let i = 0; i < raw.length; i++) {
    const v = raw[i] - centerElevationM
    rel[i] = v
    if (v < minRelM) minRelM = v
    if (v > maxRelM) maxRelM = v
  }

  fs.mkdirSync(OUT_DIR, { recursive: true })
  const binPath = path.join(OUT_DIR, `${site.zone}-heightmap.f32`)
  fs.writeFileSync(binPath, Buffer.from(rel.buffer, rel.byteOffset, rel.byteLength))

  const meta = {
    zone: site.zone,
    name: site.name,
    cols: gridSize,
    rows: gridSize,
    cellSizeM,
    siteRadiusM: site.siteRadiusM,
    slopeLimitDeg: site.slopeLimitDeg,
    siteCenterLatDeg: site.siteCenterLatDeg,
    siteCenterLonDeg: site.siteCenterLonDeg,
    centerElevationM,     // absolute elevation at site-local (0,0), relative to the 1737.4km reference sphere
    minRelM, maxRelM,      // relative to centerElevationM — what the .f32 grid actually stores
    demUrl: site.dem.url,
    generatedAt: new Date().toISOString(),
  }
  fs.writeFileSync(path.join(OUT_DIR, `${site.zone}-heightmap.json`), JSON.stringify(meta, null, 2))

  console.log(`[${site.zone}] wrote ${binPath} (${(rel.byteLength / 1e6).toFixed(2)} MB) — relief ${minRelM.toFixed(1)}..${maxRelM.toFixed(1)} m relative to centre (abs centre elev ${centerElevationM.toFixed(1)} m)`)
}

async function main() {
  const zoneArg = process.argv.find(a => a.startsWith('--zone='))?.split('=')[1] as ZoneId | undefined
  const zones: ZoneId[] = zoneArg ? [zoneArg] : (['btc-core', 'solana', 'stacks'] as ZoneId[])
  for (const zone of zones) {
    const site = LUNAR_SITES[zone]
    if (!site) throw new Error(`unknown zone: ${zone}`)
    await fetchSite(site)
  }
}

main().catch(err => { console.error(err); process.exit(1) })
