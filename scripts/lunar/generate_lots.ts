/**
 * DogCity Luna — Phase 1 lot generation.
 *
 * Places real holders onto the real terrain fetched by fetch_terrain.ts, using
 * zones.ts's existing mintLot() geometry + slope/radius buildability filtering
 * (lib/city/lunar/lots.ts). Writes STATIC JSON under public/lunar/ — this phase
 * does NOT touch the live Supabase registry (lib/city/registry.ts untouched).
 *
 * Usage:
 *   npx tsx scripts/lunar/generate_lots.ts                  # all 3 sites
 *   npx tsx scripts/lunar/generate_lots.ts --zone=btc-core   # one site
 *   CITY_API_BASE=http://localhost:3000 npx tsx scripts/lunar/generate_lots.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'
import { assignDistrict, type ZoneId } from '../../lib/city/zones'
import { loadHeightmap } from '../../lib/city/lunar/heightmap'
import { placeNextBuildable, type LunarLot, type RejectReason } from '../../lib/city/lunar/lots'

dotenv.config({ path: path.join(__dirname, '..', '..', '.env.local') })
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') })

const OUT_DIR = path.join(__dirname, '..', '..', 'public', 'lunar')
const API_BASE = process.env.CITY_API_BASE || 'http://localhost:3000'
const DUST_MAX = 1 // < 1 DOG dropped entirely, matches lib/city/registry.ts's BLOCO 3.1 threshold

interface RawHolder { address: string; balance: number; utxo_count?: number }

function loadBtcHolders(): { holders: RawHolder[]; supply: number } {
  const p = path.join(__dirname, '..', '..', 'data', 'dog_holders.json')
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'))
  const holders: RawHolder[] = (raw.holders || []).map((h: any) => ({
    address: h.address, balance: h.total_dog, utxo_count: h.utxo_count,
  }))
  const supply = holders.reduce((m, h) => Math.max(m, h.balance), 1)
  return { holders, supply }
}

async function loadExternalHolders(chain: 'solana' | 'stacks'): Promise<RawHolder[]> {
  const limit = chain === 'stacks' ? 200 : 1000
  const url = `${API_BASE}/api/multichain/holders?chain=${chain}&limit=${limit}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${chain} holders HTTP ${res.status}`)
  const json: any = await res.json()
  const list: any[] = json?.[chain]?.holders || []
  return list.filter(h => h.address && h.balance > 0).map(h => ({ address: h.address, balance: h.balance }))
}

async function generateForZone(zone: ZoneId, holders: RawHolder[], supply: number): Promise<void> {
  const active = holders.filter(h => h.balance >= DUST_MAX)
  // Highest balance first — biggest holders claim the innermost (lowest-index) plots.
  active.sort((a, b) => b.balance - a.balance)

  let hm
  try {
    hm = loadHeightmap(zone)
  } catch (err) {
    console.warn(`[${zone}] heightmap not found — run fetch_terrain.ts --zone=${zone} first. Skipping. (${(err as Error).message})`)
    return
  }

  const cursors = new Map<number, { next: number }>()
  const fullDistricts = new Set<number>() // hit 'out-of-radius' — every later index here is futile too
  const rejects: Record<RejectReason, number> = { 'out-of-radius': 0, 'too-steep': 0, 'no-height-data': 0 }
  let placed = 0, dropped = 0
  const lots: LunarLot[] = []
  let latMin = Infinity, latMax = -Infinity, lonMin = Infinity, lonMax = -Infinity

  const chain = zone === 'btc-core' ? 'bitcoin' : zone

  for (const h of active) {
    const district = assignDistrict(h.balance, h.utxo_count ?? 0)
    if (fullDistricts.has(district)) { dropped++; rejects['out-of-radius']++; continue }
    const cursor = cursors.get(district) ?? { next: 0 }
    cursors.set(district, cursor)
    const { result, attempts } = placeNextBuildable(hm, h.address, chain, zone, district, cursor, h.balance, supply)
    if (!result.lot) {
      dropped++
      if (result.rejected) rejects[result.rejected] += attempts
      if (result.rejected === 'out-of-radius') fullDistricts.add(district)
      continue
    }
    lots.push(result.lot)
    placed++
    latMin = Math.min(latMin, result.lot.latDeg); latMax = Math.max(latMax, result.lot.latDeg)
    lonMin = Math.min(lonMin, result.lot.lonDeg); lonMax = Math.max(lonMax, result.lot.lonDeg)
  }

  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.writeFileSync(path.join(OUT_DIR, `${zone}-lots.json`), JSON.stringify(lots))

  console.log(`[${zone}] ${placed} placed, ${dropped} dropped (out-of-radius=${rejects['out-of-radius']}, too-steep=${rejects['too-steep']}, no-height-data=${rejects['no-height-data']})`)
  if (placed > 0) console.log(`[${zone}] lat range [${latMin.toFixed(5)}, ${latMax.toFixed(5)}], lon range [${lonMin.toFixed(5)}, ${lonMax.toFixed(5)}]`)
}

async function main() {
  const zoneArg = process.argv.find(a => a.startsWith('--zone='))?.split('=')[1] as ZoneId | undefined
  const zones: ZoneId[] = zoneArg ? [zoneArg] : (['btc-core', 'solana', 'stacks'] as ZoneId[])

  const btc = loadBtcHolders()
  console.log(`BTC snapshot: ${btc.holders.length} holders, supply≈${Math.round(btc.supply)}`)

  for (const zone of zones) {
    if (zone === 'btc-core') {
      await generateForZone('btc-core', btc.holders, btc.supply)
      continue
    }
    try {
      const holders = await loadExternalHolders(zone as 'solana' | 'stacks')
      console.log(`${zone} snapshot: ${holders.length} holders (live)`)
      await generateForZone(zone, holders, btc.supply)
    } catch (err) {
      console.warn(`[${zone}] live holders unavailable (${(err as Error).message}) — is the dev server running at ${API_BASE}? Skipping.`)
    }
  }
}

main().catch(err => { console.error(err); process.exit(1) })
