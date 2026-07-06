// ═══════════════════════════════════════════════════════════════════════════════
// lib/city/zones.ts — CrossChainCity deterministic geometry (crosschaincity.md)
//
// Pure, dependency-free math shared by the registry, the /api/city/data reader and
// the backfill script. It answers one question: given a (zone, district, lotIndex)
// what is the PERMANENT world position of that lot?  Positions are minted here once
// and then frozen in the `dogcity_lots` table — the renderer only ever reads them.
//
// Layout model (BLOCO B): three macro-zones — BTC core at the origin, and the
// Solana / Stacks "islands" offset far across the water. Inside every zone each
// wealth district is its own phyllotaxis spiral anchored at a district centre, so
// lot i always lands on the same spot and new holders APPEND outward (r ∝ √i) —
// the city grows by accretion and never reshuffles an existing address.
// ═══════════════════════════════════════════════════════════════════════════════

export type ChainId = 'bitcoin' | 'solana' | 'stacks'
export type ZoneId = 'btc-core' | 'solana' | 'stacks'
export type LotState = 'active' | 'ruin'

export const CHAIN_TO_ZONE: Record<ChainId, ZoneId> = {
  bitcoin: 'btc-core',
  solana: 'solana',
  stacks: 'stacks',
}

// ─── Districts (shared across chains — a whale is a whale on any chain) ─────────
export interface DistrictDef { id: number; name: string; color: string; tag: string }
export const DISTRICTS: DistrictDef[] = [
  { id: 0, name: 'Satoshi District',     color: '#F7931A', tag: 'Diamond Paws'     },
  { id: 1, name: 'Leonidas District',    color: '#C4B5FD', tag: 'OG Runestone'     },
  { id: 2, name: 'Casey District',       color: '#67E8F9', tag: 'Ordinals + Runes' },
  { id: 3, name: 'Runes District',       color: '#FB923C', tag: 'Multi-Rune'       },
  { id: 4, name: 'Sovereign District',   color: '#4ADE80', tag: 'Self-Custody'     },
  { id: 5, name: 'Accumulator District', color: '#34D399', tag: 'Stack Growing'    },
  { id: 6, name: 'HODLer District',      color: '#CBD5E1', tag: 'Long-Term'        },
  { id: 7, name: 'Genesis District',     color: '#FCD34D', tag: 'Active Mid-Tier'  },
  { id: 8, name: 'Newcomer District',    color: '#FDA4AF', tag: 'New Entrants'     },
  { id: 9, name: 'Paper Hands',          color: '#6B7280', tag: 'Micro Holders'    },
]

// utxoCount is a Bitcoin-only activity signal; SOL/STX pass 0 → the inactive branch,
// which only ever nudges the mid tiers (2↔3, 4↔5, 6↔7) and never changes the tier band.
export function assignDistrict(totalDog: number, utxoCount: number): number {
  const active = utxoCount > 3
  if (totalDog >= 1_000_000_000) return 0
  if (totalDog >= 100_000_000)   return 1
  if (totalDog >= 10_000_000)    return active ? 2 : 3
  if (totalDog >= 1_000_000)     return active ? 5 : 4
  if (totalDog >= 100_000)       return active ? 7 : 6
  if (totalDog >= 10_000)        return 8
  return 9
}

// ─── Height tier (0-9) and footprint width from DOG balance ────────────────────
// Same curves the v3 generator used, so heights/footprints read identically.
export function heightTier(dog: number): number {
  if (dog <= 0) return 0
  return Math.max(0, Math.min(9, Math.floor(Math.log10(dog))))
}

const A_MIN = 40      // minimum lot area → smallest wallet still visible
const A_MAX = 8000    // whale-campus cap
export function footprintWidth(dog: number, supply: number): number {
  const s = Math.min(Math.max(dog, 1), supply)
  const norm = Math.sqrt(s) / Math.sqrt(Math.max(supply, 1))
  return Math.sqrt(A_MIN + (A_MAX - A_MIN) * norm)
}

// ─── Deterministic hash for tiny per-lot jitter (rotation) ─────────────────────
function hash1(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123
  return s - Math.floor(s)
}

// ═══════════════════════════════════════════════════════════════════════════════
// Zone / district anchor geometry
// ═══════════════════════════════════════════════════════════════════════════════
const GOLDEN = Math.PI * (3 - Math.sqrt(5))  // 137.5° — phyllotaxis angle
const LOT_PITCH = 14                          // world units between neighbouring lots

// BTC district centres — mirror the v3 SEEDS so the district ARRANGEMENT stays
// familiar even though every building position is now a stored fact.
const BTC_DISTRICT_CENTERS: [number, number][] = [
  [   0,    0],  // 0 Satoshi
  [  90,   65],  // 1 Leonidas
  [ 178,    0],  // 2 Casey
  [  90, -110],  // 3 Runes
  [-178,  110],  // 4 Sovereign
  [ -67, -200],  // 5 Accumulator
  [-578,  245],  // 6 HODLer
  [ 578,  200],  // 7 Genesis
  [ 245, -710],  // 8 Newcomer
  [-290, -688],  // 9 Paper Hands
]

// SOL / STX islands live far across the water (BTC land radius is ≈14·√N_btc ≈4k).
// Each island fans its 10 districts out on a small ring around the island centre.
export const ZONE_CENTERS: Record<ZoneId, [number, number]> = {
  'btc-core': [0, 0],
  'solana':   [0, 7200],       // island to the far north
  'stacks':   [7200, -2600],   // island to the far east
}

const ISLAND_DISTRICT_RING = 420   // radius of the district fan on SOL/STX islands

function districtCenter(zone: ZoneId, district: number): [number, number] {
  if (zone === 'btc-core') return BTC_DISTRICT_CENTERS[district]
  const [cx, cz] = ZONE_CENTERS[zone]
  // District 0 (richest) sits at the island centre; 1-9 fan around it.
  if (district === 0) return [cx, cz]
  const ang = (district / 10) * Math.PI * 2 + (zone === 'solana' ? 0.4 : 1.7)
  return [cx + Math.cos(ang) * ISLAND_DISTRICT_RING, cz + Math.sin(ang) * ISLAND_DISTRICT_RING]
}

export interface MintedLot { x: number; z: number; rot: number }

// The heart of BLOCO A: lot `index` in (zone, district) → a permanent position.
// Phyllotaxis around the district centre: r = pitch·√(index) grows monotonically,
// so higher indices are always further out (append-only) and never collide with a
// lower one. Fully deterministic → the same index always yields the same lot.
export function mintLot(zone: ZoneId, district: number, index: number): MintedLot {
  const [cx, cz] = districtCenter(zone, district)
  const r = LOT_PITCH * Math.sqrt(index + 0.5)
  const theta = index * GOLDEN + district * 1.31
  const x = cx + Math.cos(theta) * r
  const z = cz + Math.sin(theta) * r
  // Small coherent block tilt that grows outward, matching the v3 aesthetic.
  const rot = (hash1(index * 1.7 + district * 53) - 0.5) * Math.min(0.55, r / 2600)
  return { x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, rot: Math.round(rot * 1000) / 1000 }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BLOCO E — human-readable address (street name + number)
// Named per district + a stable "avenue index" derived from the lot index, so a
// wallet's address reads like "Satoshi District, HODL Ave 4471".
// ═══════════════════════════════════════════════════════════════════════════════
const STREET_NAMES: Record<number, string[]> = {
  0: ['Genesis Blvd', 'HODL Ave', 'Satoshi Row', 'Diamond Way'],
  1: ['Runestone Ave', 'Leonidas Blvd', 'OG Row'],
  2: ['Ordinals Ave', 'Casey Blvd', 'Inscription Row'],
  3: ['Runes Blvd', 'Etch Ave', 'Mint Row'],
  4: ['Sovereign Ave', 'Cold Storage Row', 'Keyholder Blvd'],
  5: ['Accumulator Ave', 'Stack Row', 'DCA Blvd'],
  6: ['HODLer Ave', 'Patience Row', 'Longterm Blvd'],
  7: ['Genesis Way', 'Midtier Ave', 'Active Row'],
  8: ['Newcomer Ave', 'Onboard Row', 'Fresh Blvd'],
  9: ['Paper Row', 'Micro Ave', 'Dust Lane'],
}

export interface StreetAddress { street: string; number: number }

// Deterministic from (district, index): pick a street within the district and a
// number that increases along the avenue. Stable for the life of the lot.
export function streetAddress(district: number, index: number): StreetAddress {
  const names = STREET_NAMES[district] ?? STREET_NAMES[9]
  const street = names[index % names.length]
  const number = 100 + Math.floor(index / names.length) * 2 + (index % 2)
  return { street, number }
}

export function formatAddress(district: number, addr: StreetAddress): string {
  const d = DISTRICTS[district]?.name ?? 'Unknown District'
  return `${d}, ${addr.street} ${addr.number}`
}

// Convenience: everything needed to persist a brand-new lot in one call.
export interface FreshLot {
  x: number; z: number; rot: number
  street: string; number: number
}
export function freshLot(zone: ZoneId, district: number, index: number): FreshLot {
  const { x, z, rot } = mintLot(zone, district, index)
  const { street, number } = streetAddress(district, index)
  return { x, z, rot, street, number }
}
