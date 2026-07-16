/**
 * DogCity Luna — global Moon assets for the full-sphere view.
 *
 * Produces, under public/lunar/:
 *   globe-height.i16   — global elevation, equirectangular, Int16 METERS relative to
 *                        the 1737.4 km sphere (downsampled from NASA LOLA LDEM_16,
 *                        the same PDS3 float IMG family the site patches use)
 *   globe-height.json  — { cols, rows, minM, maxM, sourceUrl }
 *   globe-color.jpg    — LROC WAC color mosaic, 8k equirectangular JPEG (from NASA's
 *                        CGI Moon Kit, SVS 4720), converted TIFF→JPEG via sharp
 *   globe-color.json   — { width, height, lonOffsetDeg, sourceUrl } — lonOffsetDeg is
 *                        the longitude of the IMAGE'S LEFT EDGE, self-tested against
 *                        known dark maria so the renderer can never mount it rotated
 *
 * Usage: npx tsx scripts/lunar/fetch_globe.ts [--skip-color] [--skip-height]
 *
 * Credits: NASA/GSFC LRO LOLA · NASA SVS CGI Moon Kit · LROC (ASU). Public domain.
 */

import * as fs from 'fs'
import * as path from 'path'
import sharp from 'sharp'
import { sampleGlobalHeight, type GlobalGrid } from '../../lib/city/lunar/grid'

const OUT_DIR = path.join(__dirname, '..', '..', 'public', 'lunar')

// LOLA global cylindrical 16 ppd float grid — 5760×2880, row 0 = +90°, col 0 = 0°E,
// values in km relative to 1737.4 km (verified from LDEM_16_FLOAT.LBL).
const HEIGHT_URL = 'https://imbrium.mit.edu/DATA/LOLA_GDR/CYLINDRICAL/FLOAT_IMG/LDEM_16_FLOAT.IMG'
const SRC_COLS = 5760
const SRC_ROWS = 2880
// Output grid — plenty for a ~1M-vertex sphere + bump detail.
const OUT_COLS = 2880
const OUT_ROWS = 1440

const COLOR_URL = 'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_8k.tif'

async function download(url: string, label: string): Promise<Buffer> {
  console.log(`downloading ${label}: ${url}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  console.log(`  got ${(buf.length / 1e6).toFixed(1)} MB`)
  return buf
}

async function buildHeight(): Promise<void> {
  const raw = await download(HEIGHT_URL, 'LOLA LDEM_16 global DEM')
  if (raw.length !== SRC_COLS * SRC_ROWS * 4) {
    throw new Error(`LDEM_16 size mismatch: got ${raw.length}, expected ${SRC_COLS * SRC_ROWS * 4}`)
  }
  const src = new Float32Array(raw.buffer, raw.byteOffset, SRC_COLS * SRC_ROWS)

  // Area-average downsample (2×2 blocks) km→m→Int16. Moon relief is ±11 km, well
  // inside Int16 meters.
  const out = new Int16Array(OUT_COLS * OUT_ROWS)
  const bx = SRC_COLS / OUT_COLS, by = SRC_ROWS / OUT_ROWS
  let minM = Infinity, maxM = -Infinity
  for (let r = 0; r < OUT_ROWS; r++) {
    const sr0 = Math.floor(r * by), sr1 = Math.min(SRC_ROWS, Math.ceil((r + 1) * by))
    for (let c = 0; c < OUT_COLS; c++) {
      const sc0 = Math.floor(c * bx), sc1 = Math.min(SRC_COLS, Math.ceil((c + 1) * bx))
      let sum = 0, n = 0
      for (let sr = sr0; sr < sr1; sr++) {
        for (let sc = sc0; sc < sc1; sc++) { sum += src[sr * SRC_COLS + sc]; n++ }
      }
      const m = Math.round((sum / n) * 1000)
      out[r * OUT_COLS + c] = m
      if (m < minM) minM = m
      if (m > maxM) maxM = m
    }
  }

  // Sanity self-test against known lunar topography before writing anything.
  const grid: GlobalGrid = { cols: OUT_COLS, rows: OUT_ROWS, data: out }
  const crisium = sampleGlobalHeight(grid, 17, 59)         // Mare Crisium basin — deep
  const farsideHigh = sampleGlobalHeight(grid, 5, 200)     // farside highlands — high
  const aitkenFloor = sampleGlobalHeight(grid, -56, 180)   // South Pole–Aitken — deepest region
  console.log(`  self-test: Crisium=${crisium.toFixed(0)}m farside(5N,200E)=${farsideHigh.toFixed(0)}m SPA(56S,180E)=${aitkenFloor.toFixed(0)}m`)
  if (!(crisium < -1000 && farsideHigh > 1000 && aitkenFloor < -3000)) {
    throw new Error('global height self-test FAILED — grid orientation/scale wrong, refusing to write')
  }

  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.writeFileSync(path.join(OUT_DIR, 'globe-height.i16'), Buffer.from(out.buffer, out.byteOffset, out.byteLength))
  fs.writeFileSync(path.join(OUT_DIR, 'globe-height.json'), JSON.stringify({
    cols: OUT_COLS, rows: OUT_ROWS, minM, maxM, sourceUrl: HEIGHT_URL, generatedAt: new Date().toISOString(),
  }, null, 2))
  console.log(`  wrote globe-height.i16 (${(out.byteLength / 1e6).toFixed(1)} MB), relief ${minM}..${maxM} m`)
}

async function buildColor(): Promise<void> {
  const tif = await download(COLOR_URL, 'LROC color mosaic 8k (CGI Moon Kit)')
  const img = sharp(tif, { limitInputPixels: false })
  const meta = await img.metadata()
  console.log(`  source: ${meta.width}x${meta.height} ${meta.format}`)

  // ── Longitude-convention self-test ──────────────────────────────────────────
  // The CGI Moon Kit maps have been published with both 0°-centered and
  // 180°-centered variants over the years. Instead of trusting documentation,
  // measure it: Mare Crisium (17°N 59°E) is one of the darkest, most isolated
  // spots on the Moon; the farside highlands (0°N 200°E) are bright. Try both
  // hypotheses for the left-edge longitude and keep the one where Crisium is
  // darker — then RECORD it in the meta so the renderer maps UVs correctly.
  const { data: px, info } = await img.raw().toBuffer({ resolveWithObject: true })
  const W = info.width, H = info.height, CH = info.channels
  const lum = (x: number, y: number) => {
    // average a small window to be robust to local albedo speckle
    let s = 0, n = 0
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const xx = (x + dx + W) % W, yy = Math.max(0, Math.min(H - 1, y + dy))
      const i = (yy * W + xx) * CH
      s += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]
      n++
    }
    return s / n
  }
  const yOf = (lat: number) => Math.round(((90 - lat) / 180) * H)
  const xOf = (lon: number, leftEdgeLon: number) => Math.round((((lon - leftEdgeLon + 360) % 360) / 360) * W)

  const scoreFor = (leftEdgeLon: number) => {
    const crisium = lum(xOf(59, leftEdgeLon), yOf(17))
    const farside = lum(xOf(200, leftEdgeLon), yOf(0))
    const tranq = lum(xOf(23.5, leftEdgeLon), yOf(0.7))    // Mare Tranquillitatis — dark
    return { crisium, farside, tranq, score: farside - (crisium + tranq) / 2 }
  }
  const h0 = scoreFor(0)      // left edge = 0°E (i.e., map spans 0→360)
  const h180 = scoreFor(-180) // left edge = 180°W (i.e., map spans -180→180, 0 centered)
  console.log(`  lon test  left=0°E   : crisium=${h0.crisium.toFixed(0)} tranq=${h0.tranq.toFixed(0)} farside=${h0.farside.toFixed(0)} score=${h0.score.toFixed(0)}`)
  console.log(`  lon test  left=180°W : crisium=${h180.crisium.toFixed(0)} tranq=${h180.tranq.toFixed(0)} farside=${h180.farside.toFixed(0)} score=${h180.score.toFixed(0)}`)
  const lonOffsetDeg = h0.score >= h180.score ? 0 : -180
  const winner = lonOffsetDeg === 0 ? h0 : h180
  if (winner.score < 15) {
    throw new Error('color lon-convention self-test inconclusive — refusing to write a possibly-rotated moon')
  }
  console.log(`  → left edge of image = ${lonOffsetDeg}° (score ${winner.score.toFixed(0)})`)

  fs.mkdirSync(OUT_DIR, { recursive: true })
  const outJpg = path.join(OUT_DIR, 'globe-color.jpg')
  await sharp(tif, { limitInputPixels: false }).jpeg({ quality: 88, mozjpeg: true }).toFile(outJpg)
  const st = fs.statSync(outJpg)
  fs.writeFileSync(path.join(OUT_DIR, 'globe-color.json'), JSON.stringify({
    width: W, height: H, lonOffsetDeg, sourceUrl: COLOR_URL, generatedAt: new Date().toISOString(),
  }, null, 2))
  console.log(`  wrote globe-color.jpg (${(st.size / 1e6).toFixed(1)} MB, ${W}x${H})`)
}

async function main() {
  const skipColor = process.argv.includes('--skip-color')
  const skipHeight = process.argv.includes('--skip-height')
  if (!skipHeight) await buildHeight()
  if (!skipColor) await buildColor()
  console.log('done')
}

main().catch(err => { console.error(err); process.exit(1) })
