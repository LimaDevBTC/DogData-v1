// ═══════════════════════════════════════════════════════════════════════════════
// lib/city/lunar/sun.ts — real lunar sun geometry via astronomy-engine.
//
// astronomy-engine has no direct "subsolar point on the Moon" helper, so this
// builds the Moon's body-fixed (IAU) frame from RotationAxis() and projects the
// Moon→Sun direction into it. Verified by cross-checking the SAME frame's
// sub-EARTH point against astronomy-engine's own Libration() output — they agree
// to within ~0.03°, confirming the frame construction (see scratch test used
// during development). Only the initial, real sun direction is wired up here;
// animating it across the 29.53-day lunar day is a fast-follow (per the DogCity
// Luna Phase 1 plan).
// ═══════════════════════════════════════════════════════════════════════════════

import * as Astronomy from 'astronomy-engine'

interface Vec3 { x: number; y: number; z: number }

function sub3(a: Vec3, b: Vec3): Vec3 { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z } }
function norm3(v: Vec3): Vec3 { const n = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / n, y: v.y / n, z: v.z / n } }
function dot3(a: Vec3, b: Vec3): number { return a.x * b.x + a.y * b.y + a.z * b.z }
function cross3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }
}
// Rodrigues' rotation formula: rotate v about unit axis by angleDeg.
function rotAboutAxis(v: Vec3, axis: Vec3, angleDeg: number): Vec3 {
  const a = (angleDeg * Math.PI) / 180
  const cosA = Math.cos(a), sinA = Math.sin(a)
  const c = cross3(axis, v)
  const d = dot3(axis, v)
  return {
    x: v.x * cosA + c.x * sinA + axis.x * d * (1 - cosA),
    y: v.y * cosA + c.y * sinA + axis.y * d * (1 - cosA),
    z: v.z * cosA + c.z * sinA + axis.z * d * (1 - cosA),
  }
}

interface MoonFrame { Xbody: Vec3; Ybody: Vec3; Zbody: Vec3 }

function moonBodyFixedFrame(date: Date): MoonFrame {
  const axis = Astronomy.RotationAxis(Astronomy.Body.Moon, date)
  const Zbody = norm3(axis.north as Vec3)
  const node = norm3(cross3({ x: 0, y: 0, z: 1 }, Zbody)) // ascending node of body equator on EQJ equator
  const Xbody = norm3(rotAboutAxis(node, Zbody, axis.spin))
  const Ybody = cross3(Zbody, Xbody)
  return { Xbody, Ybody, Zbody }
}

function toSelenographic(v: Vec3, frame: MoonFrame): { latDeg: number; lonDeg: number } {
  const vx = dot3(v, frame.Xbody), vy = dot3(v, frame.Ybody), vz = dot3(v, frame.Zbody)
  const r = Math.hypot(vx, vy, vz) || 1
  return { latDeg: (Math.asin(vz / r) * 180) / Math.PI, lonDeg: (Math.atan2(vy, vx) * 180) / Math.PI }
}

// The point on the Moon directly under the Sun right now (selenographic lat/lon).
export function subsolarPoint(date: Date): { latDeg: number; lonDeg: number } {
  const frame = moonBodyFixedFrame(date)
  const moonVec = Astronomy.GeoVector(Astronomy.Body.Moon, date, false) as Vec3 // Earth→Moon, EQJ
  const sunVec = Astronomy.GeoVector(Astronomy.Body.Sun, date, false) as Vec3   // Earth→Sun, EQJ
  const moonToSun = norm3(sub3(sunVec, moonVec))
  return toSelenographic(moonToSun, frame)
}

// Sun elevation/azimuth as seen from a given selenographic site, given the current
// subsolar point — standard spherical-astronomy sun-position formula (same shape as
// the terrestrial sun-elevation-from-subsolar-point calc, just on the Moon).
export function sunLocalDirection(
  siteLatDeg: number, siteLonDeg: number, subsolar: { latDeg: number; lonDeg: number },
): { elevationDeg: number; azimuthDeg: number } {
  const D2R = Math.PI / 180
  const phi = siteLatDeg * D2R, phiS = subsolar.latDeg * D2R
  const dLon = (subsolar.lonDeg - siteLonDeg) * D2R
  const sinEl = Math.sin(phi) * Math.sin(phiS) + Math.cos(phi) * Math.cos(phiS) * Math.cos(dLon)
  const elevationDeg = Math.asin(Math.max(-1, Math.min(1, sinEl))) * (180 / Math.PI)
  const az = Math.atan2(
    Math.sin(dLon) * Math.cos(phiS),
    Math.cos(phi) * Math.sin(phiS) - Math.sin(phi) * Math.cos(phiS) * Math.cos(dLon),
  )
  const azimuthDeg = ((az * 180) / Math.PI + 360) % 360
  return { elevationDeg, azimuthDeg }
}

// Local (Three.js Y-up) unit vector POINTING TOWARD THE SUN, for a site's own tangent
// frame — north = -Z, east = +X, up = +Y. Feed straight into a DirectionalLight's
// `.position` (it points from that position toward the target, i.e. toward the site).
export function sunDirectionVector(elevationDeg: number, azimuthDeg: number): { x: number; y: number; z: number } {
  const D2R = Math.PI / 180
  const el = elevationDeg * D2R, az = azimuthDeg * D2R
  const horiz = Math.cos(el)
  return { x: horiz * Math.sin(az), y: Math.sin(el), z: -horiz * Math.cos(az) }
}
