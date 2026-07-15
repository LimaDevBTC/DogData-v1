// ═══════════════════════════════════════════════════════════════════════════════
// lib/city/lunar/sites.ts — the 3 real lunar sites, one per chain zone.
//
//   btc-core → Mare Tranquillitatis, next to Apollo 11 (0.674°N, 23.473°E)
//   solana   → Shackleton crater, south pole (~89.9°S) — permanently shadowed
//   stacks   → Peary crater rim, north pole (~88.63°N) — near-eternal light
//
// Each site's `projection` origin is the DEM file's OWN native origin (the
// equator point for the SLDEM tile; the pole itself for the polar tiles — the
// polar files are one projection for the whole polar cap, not per-site). The
// site's actual point of interest (Shackleton, Peary) sits OFFSET from that
// origin — `siteOffset` (precomputed once, in the native projection's meters)
// lets every other module work in "site-local" meters centered on the site
// itself, matching what lib/city/zones.ts's mintLot() already assumes (index 0
// lands near local (0,0)).
// ═══════════════════════════════════════════════════════════════════════════════

import type { ZoneId } from '../zones'
import { latLonToLocal, localToLatLon, type ProjectionOrigin } from './projection'

export type DemSource =
  // SLDEM2015-style: a rectangular tile with simple lat/lon bounds, pixel-registered.
  | {
      kind: 'equirect-tile'
      url: string
      cols: number; rows: number; recordBytes: number
      ppd: number            // pixels per degree
      westLonDeg: number     // tile's western edge
      maxLatDeg: number      // tile's northern edge (row 0)
    }
  // LOLA polar GDR-style: whole-polar-cap stereographic tile, offset+scale addressing.
  | {
      kind: 'polar-tile'
      url: string
      cols: number; rows: number; recordBytes: number
      scaleM: number          // meters per pixel
      pixelOffset: number     // both SAMPLE_ and LINE_PROJECTION_OFFSET (square, symmetric grid)
    }

export interface LunarSite {
  zone: ZoneId
  name: string
  siteCenterLatDeg: number
  siteCenterLonDeg: number
  projection: ProjectionOrigin
  siteOffset: { x: number; z: number }   // site center's position within `projection`'s native frame
  siteRadiusM: number
  slopeLimitDeg: number
  dem: DemSource
}

function makeSite(
  zone: ZoneId, name: string,
  siteCenterLatDeg: number, siteCenterLonDeg: number,
  projection: ProjectionOrigin,
  siteRadiusM: number, slopeLimitDeg: number,
  dem: DemSource,
): LunarSite {
  const siteOffset = latLonToLocal(projection, siteCenterLatDeg, siteCenterLonDeg)
  return { zone, name, siteCenterLatDeg, siteCenterLonDeg, projection, siteOffset, siteRadiusM, slopeLimitDeg, dem }
}

export const LUNAR_SITES: Record<ZoneId, LunarSite> = {
  'btc-core': makeSite(
    'btc-core', 'Mare Tranquillitatis',
    0.674, 23.473,
    { kind: 'equirect', centerLatDeg: 0.674, centerLonDeg: 23.473 },
    3000, 2,
    {
      kind: 'equirect-tile',
      url: 'https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/sldem2015/tiles/float_img/SLDEM2015_512_00N_30N_000_045_FLOAT.IMG',
      cols: 23040, rows: 15360, recordBytes: 92160,
      ppd: 512, westLonDeg: 0, maxLatDeg: 30,
    },
  ),
  solana: makeSite(
    'solana', 'Shackleton',
    -89.9, 129.2,
    { kind: 'polar-south', centerLatDeg: -90, centerLonDeg: 0 },
    1500, 10,
    {
      kind: 'polar-tile',
      url: 'https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/FLOAT_IMG/LDEM_875S_5M_FLOAT.IMG',
      cols: 30336, rows: 30336, recordBytes: 121344,
      scaleM: 5, pixelOffset: 15167.5,
    },
  ),
  stacks: makeSite(
    'stacks', 'Peary',
    88.63, 33,
    { kind: 'polar-north', centerLatDeg: 90, centerLonDeg: 0 },
    1500, 10,
    {
      kind: 'polar-tile',
      url: 'https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/FLOAT_IMG/LDEM_875N_5M_FLOAT.IMG',
      cols: 30336, rows: 30336, recordBytes: 121344,
      scaleM: 5, pixelOffset: 15167.5,
    },
  ),
}

// site-local (x,z) — centered on the SITE (Apollo 11 / Shackleton / Peary), not the
// DEM's native origin — ⇄ that native projection's meters (what pixel addressing needs).
export function siteLocalToProj(site: LunarSite, x: number, z: number): { x: number; z: number } {
  return { x: x + site.siteOffset.x, z: z + site.siteOffset.z }
}
export function projToSiteLocal(site: LunarSite, x: number, z: number): { x: number; z: number } {
  return { x: x - site.siteOffset.x, z: z - site.siteOffset.z }
}

export function siteLocalToLatLon(site: LunarSite, x: number, z: number): { latDeg: number; lonDeg: number } {
  const p = siteLocalToProj(site, x, z)
  return localToLatLon(site.projection, p.x, p.z)
}
export function latLonToSiteLocal(site: LunarSite, latDeg: number, lonDeg: number): { x: number; z: number } {
  const p = latLonToLocal(site.projection, latDeg, lonDeg)
  return projToSiteLocal(site, p.x, p.z)
}
