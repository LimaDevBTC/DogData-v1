// ═══════════════════════════════════════════════════════════════════════════════
// lib/city/lunar/pds-img.ts — shared reader for NASA PDS3 detached-label DEM
// products (SLDEM2015 equatorial tiles + LOLA polar GDR tiles). Both are served
// as a flat, row-major grid of little-endian float32 ("PC_REAL"/32-bit) samples
// with NO header offset (pixel data starts at byte 0) and fixed-length records
// (one row = RECORD_BYTES), confirmed live via HTTP Range requests against:
//   - pds-geosciences.wustl.edu (SLDEM2015)
//   - imbrium.mit.edu (LOLA polar GDR)
// No GDAL/geotiff needed — this is the entire parser.
// ═══════════════════════════════════════════════════════════════════════════════

export interface PdsImgSource {
  url: string
  cols: number         // LINE_SAMPLES
  rows: number          // LINES / FILE_RECORDS
  recordBytes: number   // bytes per row (cols * 4 for float32)
}

export interface PdsImgStripe {
  data: Float32Array    // rows-major, `cols` samples per row, elevation in KILOMETERS (raw DN)
  rowStart: number      // 0-based row index of stripe row 0, in the source grid
  rows: number
  cols: number
}

// Fetch rows [rowStart, rowEndExclusive) as one contiguous byte range. Rows are
// clamped to the source's valid range.
export async function fetchPdsImgRows(src: PdsImgSource, rowStart: number, rowEndExclusive: number): Promise<PdsImgStripe> {
  const r0 = Math.max(0, Math.floor(rowStart))
  const r1 = Math.min(src.rows, Math.ceil(rowEndExclusive))
  if (r1 <= r0) throw new Error(`fetchPdsImgRows: empty row range [${r0},${r1}) for ${src.url}`)
  const byteStart = r0 * src.recordBytes
  const byteEnd = r1 * src.recordBytes - 1
  const res = await fetch(src.url, { headers: { Range: `bytes=${byteStart}-${byteEnd}` } })
  if (res.status !== 206 && res.status !== 200) {
    throw new Error(`fetchPdsImgRows: HTTP ${res.status} fetching ${src.url} (range ${byteStart}-${byteEnd})`)
  }
  const buf = await res.arrayBuffer()
  const samplesPerRow = src.recordBytes / 4
  const data = new Float32Array(buf) // little-endian on our target runtimes, matches PC_REAL
  const rowsFetched = data.length / samplesPerRow
  return { data, rowStart: r0, rows: rowsFetched, cols: samplesPerRow }
}

// Bilinear sample at continuous (rowF, colF) within a stripe, clamped to its bounds.
export function bilinearSample(stripe: PdsImgStripe, rowF: number, colF: number): number {
  const localRow = rowF - stripe.rowStart
  const r0 = Math.min(stripe.rows - 1, Math.max(0, Math.floor(localRow)))
  const c0 = Math.min(stripe.cols - 1, Math.max(0, Math.floor(colF)))
  const r1 = Math.min(stripe.rows - 1, r0 + 1)
  const c1 = Math.min(stripe.cols - 1, c0 + 1)
  const fr = Math.min(1, Math.max(0, localRow - r0))
  const fc = Math.min(1, Math.max(0, colF - c0))
  const v00 = stripe.data[r0 * stripe.cols + c0]
  const v01 = stripe.data[r0 * stripe.cols + c1]
  const v10 = stripe.data[r1 * stripe.cols + c0]
  const v11 = stripe.data[r1 * stripe.cols + c1]
  return v00 * (1 - fr) * (1 - fc) + v01 * (1 - fr) * fc + v10 * fr * (1 - fc) + v11 * fr * fc
}
