// ═══════════════════════════════════════════════════════════════════════════════
// lib/city/lunar/grid.ts — pure (fs-free, client-safe) sampling helpers for the
// GLOBAL equirectangular lunar height grid written by scripts/lunar/fetch_globe.ts.
// Shared by the Node build scripts AND the browser scene (which cannot import
// lib/city/lunar/heightmap.ts — that one uses fs).
//
// Grid convention (matches the LOLA LDEM cylindrical labels):
//   row 0 = north edge (+90°), row rows-1 = south edge (−90°), pixel-registered
//   col 0 = lon 0°E edge, wrapping east across 360°
//   values = elevation in METERS relative to the 1737.4 km reference sphere
// ═══════════════════════════════════════════════════════════════════════════════

export interface GlobalGrid {
  cols: number
  rows: number
  data: Int16Array | Float32Array
}

// Bilinear sample of the global grid at (latDeg, lonDeg). Longitude wraps; latitude
// clamps at the poles.
export function sampleGlobalHeight(g: GlobalGrid, latDeg: number, lonDeg: number): number {
  const lon = ((lonDeg % 360) + 360) % 360
  const colF = (lon / 360) * g.cols - 0.5
  const rowF = ((90 - latDeg) / 180) * g.rows - 0.5
  const r0 = Math.max(0, Math.min(g.rows - 1, Math.floor(rowF)))
  const r1 = Math.min(g.rows - 1, r0 + 1)
  const c0raw = Math.floor(colF)
  const c0 = ((c0raw % g.cols) + g.cols) % g.cols
  const c1 = (c0 + 1) % g.cols // wrap east
  const fr = Math.min(1, Math.max(0, rowF - r0))
  const fc = colF - c0raw
  const v00 = g.data[r0 * g.cols + c0]
  const v01 = g.data[r0 * g.cols + c1]
  const v10 = g.data[r1 * g.cols + c0]
  const v11 = g.data[r1 * g.cols + c1]
  return v00 * (1 - fr) * (1 - fc) + v01 * (1 - fr) * fc + v10 * fr * (1 - fc) + v11 * fr * fc
}
