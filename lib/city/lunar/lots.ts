// ═══════════════════════════════════════════════════════════════════════════════
// lib/city/lunar/lots.ts — place a lot on REAL terrain.
//
// Reuses zones.ts's mintLot() UNCHANGED for the local (x,z,rot) candidate — that
// math (phyllotaxis spiral + angular wedges) is pure geometry with zero terrain
// coupling, so it works as-is as the in-site placement algorithm. This module adds
// what's new for Luna: site-radius clipping, slope-based buildability, real
// elevation sampling, and the true selenographic (lat,lon) back-projection
// ("coordenadas selenográficas verdadeiras por holder").
// ═══════════════════════════════════════════════════════════════════════════════

import { mintLot, heightTier, footprintWidth, ZONE_CENTERS, type ZoneId } from '../zones'
import { LUNAR_SITES, siteLocalToLatLon } from './sites'
import { sampleHeight, sampleSlopeDeg, type Heightmap } from './heightmap'

export interface LunarLot {
  address: string
  chain: string
  zone: ZoneId
  district: number
  index: number
  xM: number
  zM: number
  latDeg: number
  lonDeg: number
  elevationM: number
  rot: number
  heightTier: number
  footprint: number
}

export type RejectReason = 'out-of-radius' | 'too-steep' | 'no-height-data'
export interface PlaceLotResult {
  lot: LunarLot | null
  rejected?: RejectReason
}

export function placeLot(
  hm: Heightmap, address: string, chain: string, zone: ZoneId, district: number, index: number,
  balance: number, supply: number,
): PlaceLotResult {
  const site = LUNAR_SITES[zone]
  // mintLot() bakes in zones.ts's ZONE_CENTERS — the old "islands across the water"
  // world-space offsets (e.g. solana at [0,7200]). Luna sites are their OWN local
  // origin (the terrain's centre), so subtract that offset back out. For btc-core
  // ZONE_CENTERS is [0,0] — a no-op there.
  const [cx, cz] = ZONE_CENTERS[zone]
  const { x: mx, z: mz, rot } = mintLot(zone, district, index)
  const x = mx - cx, z = mz - cz
  if (Math.hypot(x, z) > site.siteRadiusM) return { lot: null, rejected: 'out-of-radius' }

  const elevationM = sampleHeight(hm, x, z)
  if (elevationM == null) return { lot: null, rejected: 'no-height-data' }

  const slopeDeg = sampleSlopeDeg(hm, x, z)
  if (slopeDeg == null || slopeDeg > site.slopeLimitDeg) return { lot: null, rejected: 'too-steep' }

  const { latDeg, lonDeg } = siteLocalToLatLon(site, x, z)
  return {
    lot: {
      address, chain, zone, district, index,
      xM: x, zM: z, latDeg, lonDeg, elevationM, rot,
      heightTier: heightTier(balance),
      footprint: footprintWidth(balance, supply),
    },
  }
}

// Place a holder onto the next buildable candidate for (zone, district), advancing a
// running index cursor past any rejected candidates (mirrors the "skip an invalid
// candidate cell" pattern lib/city/generator.ts already uses for isInLake/onRoad).
// Returns null (and leaves the cursor past `maxAttempts` tries) if no buildable slot
// was found — logged by the caller, never thrown, so one holder can never abort a run.
export function placeNextBuildable(
  hm: Heightmap, address: string, chain: string, zone: ZoneId, district: number,
  cursor: { next: number }, balance: number, supply: number,
  maxAttempts = 500,
): { result: PlaceLotResult; attempts: number } {
  let attempts = 0
  let last: PlaceLotResult = { lot: null, rejected: 'out-of-radius' }
  while (attempts < maxAttempts) {
    const index = cursor.next
    last = placeLot(hm, address, chain, zone, district, index, balance, supply)
    attempts++
    if (last.lot) { cursor.next = index + 1; return { result: last, attempts } }
    // mintLot's radius grows monotonically with index, so once a candidate falls
    // outside the site, EVERY later index in this district will too — stop instead
    // of burning the whole retry budget (and leave the cursor put, so the caller's
    // short-circuit below sees the same permanent state on the very next holder).
    if (last.rejected === 'out-of-radius') return { result: last, attempts }
    cursor.next = index + 1
  }
  return { result: last, attempts }
}
