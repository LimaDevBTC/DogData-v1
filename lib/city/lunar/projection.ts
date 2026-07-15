// ═══════════════════════════════════════════════════════════════════════════════
// lib/city/lunar/projection.ts — selenographic (lat,lon) ⇄ local site meters.
//
// Two projection kinds, matching the DEM sources' native projections so no
// resampling distortion is introduced:
//   • equirect     — local ENU tangent plane, accurate for a few-km-radius site
//                     near the equator (btc-core / Mare Tranquillitatis).
//   • polar-north/
//     polar-south  — spherical polar stereographic, true scale at the pole
//                     (k0=1), matching the LOLA polar DEM's native projection
//                     (PDS3 label: "POLAR STEREOGRAPHIC", spherical, R=1737.4km).
//                     Local z follows the projection's native y-axis — there is
//                     no meaningful "north/south" direction AT a pole, so this
//                     is just a fixed, documented local frame (not a compass).
// ═══════════════════════════════════════════════════════════════════════════════

export const R_MOON = 1_737_400 // meters — spherical datum used by LOLA/SLDEM2015

const DEG2RAD = Math.PI / 180
const RAD2DEG = 180 / Math.PI

export type ProjectionKind = 'equirect' | 'polar-north' | 'polar-south'

export interface ProjectionOrigin {
  kind: ProjectionKind
  centerLatDeg: number
  centerLonDeg: number   // positive-east, 0-360 or -180..180 (consistent within a site)
}

// Forward: true selenographic (lat,lon) → local site meters (x = local east-ish, z = local
// "south"-ish for equirect; Snyder-native axes for the polar aspects — see file header).
export function latLonToLocal(o: ProjectionOrigin, latDeg: number, lonDeg: number): { x: number; z: number } {
  if (o.kind === 'equirect') {
    const lat0 = o.centerLatDeg * DEG2RAD
    const x = (lonDeg - o.centerLonDeg) * DEG2RAD * R_MOON * Math.cos(lat0)
    const z = (o.centerLatDeg - latDeg) * DEG2RAD * R_MOON
    return { x, z }
  }
  const south = o.kind === 'polar-south'
  const phi = latDeg * DEG2RAD
  const lambda = (lonDeg - o.centerLonDeg) * DEG2RAD
  const rho = south
    ? 2 * R_MOON * Math.tan(Math.PI / 4 + phi / 2)
    : 2 * R_MOON * Math.tan(Math.PI / 4 - phi / 2)
  const x = rho * Math.sin(lambda)
  const z = south ? rho * Math.cos(lambda) : -rho * Math.cos(lambda)
  return { x, z }
}

// Inverse: local site meters → true selenographic (lat,lon). Used to stamp each minted
// lot with its real coordinates (crosschaincity Luna spec: "coordenadas selenográficas
// verdadeiras por holder").
export function localToLatLon(o: ProjectionOrigin, x: number, z: number): { latDeg: number; lonDeg: number } {
  if (o.kind === 'equirect') {
    const lat0 = o.centerLatDeg * DEG2RAD
    const lonDeg = o.centerLonDeg + (x / (R_MOON * Math.cos(lat0))) * RAD2DEG
    const latDeg = o.centerLatDeg - (z / R_MOON) * RAD2DEG
    return { latDeg, lonDeg }
  }
  const south = o.kind === 'polar-south'
  const rho = Math.hypot(x, z)
  if (rho < 1e-6) return { latDeg: south ? -90 : 90, lonDeg: o.centerLonDeg }
  const c = 2 * Math.atan(rho / (2 * R_MOON))
  const latDeg = (south ? -Math.PI / 2 + c : Math.PI / 2 - c) * RAD2DEG
  const lambda = south ? Math.atan2(x, z) : Math.atan2(x, -z)
  const lonDeg = o.centerLonDeg + lambda * RAD2DEG
  return { latDeg, lonDeg }
}
