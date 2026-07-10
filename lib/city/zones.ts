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
// Age cohorts (center = oldest). Kept in sync with generator.ts DISTRICTS; used here
// only for the shareable street-address label (BLOCO E).
export const DISTRICTS: DistrictDef[] = [
  { id: 0, name: 'Genesis Core',   color: '#FDE047', tag: 'Oldest coins'     },
  { id: 1, name: 'Diamond Hands',  color: '#FBBF24', tag: 'Ancient HODLers'  },
  { id: 2, name: 'Vanguard',       color: '#F7931A', tag: 'Early believers'  },
  { id: 3, name: 'Veterans',       color: '#FB7185', tag: 'Long-term'        },
  { id: 4, name: 'Seasoned',       color: '#E879F9', tag: 'Matured holdings' },
  { id: 5, name: 'Steady',         color: '#C4B5FD', tag: 'Mid-tenure'       },
  { id: 6, name: 'Maturing',       color: '#A5B4FC', tag: 'Aging in'         },
  { id: 7, name: 'Recent',         color: '#93C5FD', tag: 'Newer holdings'   },
  { id: 8, name: 'Newcomers',      color: '#67E8F9', tag: 'Recent entrants'  },
  { id: 9, name: 'Fresh Arrivals', color: '#6EE7B7', tag: 'Just arrived'     },
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

// SOL / STX islands live far across the water. Each island fans its 10 districts out
// on a small ring around the island centre — population there is far smaller than
// BTC-core, so the ring-fan model has never hit the overlap problem BTC-core did.
export const ZONE_CENTERS: Record<ZoneId, [number, number]> = {
  'btc-core': [0, 0],
  'solana':   [0, 7200],       // island to the far north
  'stacks':   [7200, -2600],   // island to the far east
}

const ISLAND_DISTRICT_RING = 420   // radius of the district fan on SOL/STX islands

function islandDistrictCenter(zone: ZoneId, district: number): [number, number] {
  const [cx, cz] = ZONE_CENTERS[zone]
  if (district === 0) return [cx, cz]
  const ang = (district / 10) * Math.PI * 2 + (zone === 'solana' ? 0.4 : 1.7)
  return [cx + Math.cos(ang) * ISLAND_DISTRICT_RING, cz + Math.sin(ang) * ISLAND_DISTRICT_RING]
}

export interface MintedLot { x: number; z: number; rot: number }

function round1(n: number): number { return Math.round(n * 10) / 10 }
function round3(n: number): number { return Math.round(n * 1000) / 1000 }

// ─── BTC-core geometry (foundation-safe) ────────────────────────────────────────
// The original model gave every district its OWN spiral centre a few hundred units
// apart, trusting that real populations would stay small enough the spirals never
// reached each other. That held for the slowly-growing live city, but the single-
// shot founding snapshot lands ~84k wallets across 10 districts AT ONCE — a real
// district's phyllotaxis radius (≈1,357 units at ~9,400 lots) exceeds the distance
// between EVERY pair of the old district centres, so distant lots from different
// districts landed on top of each other (found by scripts/foundation_generator.ts's
// collision check, masterplan.md §2/§8).
//
// Fix: districts 1-9 each own an EXCLUSIVE angular wedge radiating from the plaza —
// a hard wall no lot's angle can cross, so two districts cannot collide at ANY
// population size, not just the ones we happened to test. District 0 (Genesis Core /
// the ring-0 "Satoshi Visionary" seats) is tiny and fixed (≈85 wallets + a civic-core
// index buffer) so it keeps the old small full-circle spiral, safely inside the
// radius where the wedges begin.
const RING0_MAX_RADIUS = 400   // generous bound for district-0's civic-core + ring-0 indices
const WEDGE_START_RADIUS = 460 // districts 1-9 begin comfortably past ring 0
const WEDGE_COUNT = 9          // districts 1..9 tile the full circle
const WEDGE_WIDTH = (Math.PI * 2) / WEDGE_COUNT
const KRONECKER = 0.6180339887498949 // golden-ratio conjugate — low-discrepancy fill of an interval, no banding

function btcCoreLot(district: number, index: number): MintedLot {
  if (district === 0) {
    // Ring 0 — small, population-bounded, so the classic full-circle phyllotaxis
    // (safe well under RING0_MAX_RADIUS) is fine here.
    const r = LOT_PITCH * Math.sqrt(index + 0.5)
    const theta = index * GOLDEN
    const x = Math.cos(theta) * r
    const z = Math.sin(theta) * r
    const rot = (hash1(index * 1.7) - 0.5) * Math.min(0.55, r / 2600)
    return { x: round1(x), z: round1(z), rot: round3(rot) }
  }
  const wedgeIndex = district - 1 // 0..8
  const wedgeStart = wedgeIndex * WEDGE_WIDTH
  const r = WEDGE_START_RADIUS + LOT_PITCH * Math.sqrt(index + 0.5)
  // Kronecker/Weyl sequence: frac(index·φ) fills [0,1) quasi-uniformly (no clumping,
  // no periodic banding) — scaled to the wedge width, theta is PROVABLY confined to
  // [wedgeStart, wedgeStart + WEDGE_WIDTH) for every index, so it can never drift
  // into a neighbouring district's slice no matter how deep the district grows.
  const frac = (index * KRONECKER + district * 0.113) % 1
  const theta = wedgeStart + frac * WEDGE_WIDTH
  const x = Math.cos(theta) * r
  const z = Math.sin(theta) * r
  const rot = (hash1(index * 1.7 + district * 53) - 0.5) * Math.min(0.55, r / 2600)
  return { x: round1(x), z: round1(z), rot: round3(rot) }
}

// The heart of BLOCO A: lot `index` in (zone, district) → a permanent position.
// Fully deterministic → the same (zone, district, index) always yields the same lot.
export function mintLot(zone: ZoneId, district: number, index: number): MintedLot {
  if (zone === 'btc-core') return btcCoreLot(district, index)
  const [cx, cz] = islandDistrictCenter(zone, district)
  const r = LOT_PITCH * Math.sqrt(index + 0.5)
  const theta = index * GOLDEN + district * 1.31
  const x = cx + Math.cos(theta) * r
  const z = cz + Math.sin(theta) * r
  const rot = (hash1(index * 1.7 + district * 53) - 0.5) * Math.min(0.55, r / 2600)
  return { x: round1(x), z: round1(z), rot: round3(rot) }
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
