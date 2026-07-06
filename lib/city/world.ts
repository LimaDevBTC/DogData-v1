// ═══════════════════════════════════════════════════════════════════════════════
// lib/city/world.ts — the FROZEN world scale for the permanent city.
//
// The registry stores absolute lot positions, so the road/water environment must be
// regenerated at the exact same scale the lots were minted at — otherwise buildings
// and streets drift apart. We freeze that scale once (at backfill) into a tiny JSON
// and every reader rebuilds the identical organic layout from it.
// ═══════════════════════════════════════════════════════════════════════════════

import fs from 'fs'
import path from 'path'
import { buildCity, buildCityAt, type CityLayout } from './generator'

const WORLD_FILE = () => path.join(process.cwd(), 'data', 'dogcity_world.json')

export interface FrozenWorld { rLand: number; worldScale: number; n: number; frozen_at: string }

// Freeze the world for N BTC holders: pick the land radius (grow-loop) and persist
// it. Returns the organic layout so the backfill can mint on its plots.
export function freezeWorld(n: number): { world: FrozenWorld; layout: CityLayout } {
  const layout = buildCity(n)
  const world: FrozenWorld = {
    rLand: layout.rLand,
    worldScale: layout.worldScale,
    n,
    frozen_at: new Date().toISOString(),
  }
  fs.writeFileSync(WORLD_FILE(), JSON.stringify(world, null, 2))
  return { world, layout }
}

export function readFrozenWorld(): FrozenWorld | null {
  try {
    const raw = fs.readFileSync(WORLD_FILE(), 'utf8')
    const w = JSON.parse(raw)
    if (typeof w?.rLand === 'number' && w.rLand > 0) return w as FrozenWorld
  } catch { /* not frozen yet */ }
  return null
}

// The organic layout at the frozen scale — the single source for both the registry
// mint positions and the /api/city/data environment. Falls back to grow-from-n if
// the world was never frozen (shouldn't happen once backfill has run).
export function frozenLayout(fallbackN = 86000): CityLayout {
  const w = readFrozenWorld()
  return w ? buildCityAt(w.rLand) : buildCity(fallbackN)
}
