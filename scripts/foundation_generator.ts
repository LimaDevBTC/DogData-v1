/**
 * scripts/foundation_generator.ts — DogCity LotGenesis (masterplan.md §2, §5, §6)
 *
 * DRY-RUN ONLY. Reads local JSON exports, writes a local JSON report. Never touches
 * Supabase, never calls ord/bitcoin-cli, never spends a sat. This is the "gerador da
 * fundação" from masterplan.md §8 step 2 — it proves the LotGenesis formulas against
 * the real ~86k-holder dataset so the map can be reviewed before anything is minted.
 *
 * Formulas implemented (masterplan.md §2):
 *   - Elegibility: total_dog >= DUST_MAX (1 DOG), else no lot.
 *   - position_score: the UNIX timestamp (`ts`) of the oldest UTXO >= BUILD_THRESHOLD
 *     (20,000 DOG). `ts` is the confirming block's own timestamp — immutable and
 *     reproducible, exactly the "block height, not days-since-export" requirement in
 *     the master plan, without needing a scanner-pipeline patch (age_days recomputes
 *     relative to whenever the export ran; `ts` never changes).
 *   - Wallets that never held a single UTXO >= 20k DOG get NO shot at the centre: they
 *     rank strictly behind every ge20k wallet, ordered among themselves by their own
 *     oldest UTXO of any size ("periphery, ordered by wallet age" — masterplan §2).
 *   - Ring 0 ("Satoshi Visionary", 85 seats) is a PROVISIONAL proxy here: the 85
 *     earliest position_scores. The real cohort (airdrop + 100x+ accumulation) needs a
 *     join against the behavioral-cohort dataset that isn't wired into this script —
 *     flagged in the report, not silently assumed correct.
 *   - Districts 1-9: the remaining wallets banded into deciles by rank (oldest→newest),
 *     same 10-cohort scheme as lib/city/zones.ts DISTRICTS.
 *   - lot_area / height_tier: reused verbatim from lib/city/zones.ts (footprintWidth,
 *     heightTier) — already validated visually in the live 3D city, not reinvented.
 *   - typology: FROZEN from utxo_count at the snapshot (few UTXOs -> tower, many ->
 *     condo) per reorganizecity.md's "forma" rule — consolidating UTXOs later must
 *     NOT morph the building.
 *   - civic core + Reserva Urbana (masterplan §5/§6): specific (district, index) lot
 *     slots are reserved BEFORE wallets are enumerated, so wallets simply skip them —
 *     no wallet lot is ever displaced by civic/reserve land.
 *   - state at genesis: nobody can be a "ruin" on day one (ruin requires HAVING BUILT
 *     and then falling below 10k) — so every wallet is either `waiting` (<20k, never
 *     built) or `standing` (>=20k, builds at the founding).
 *
 * Usage: npx tsx scripts/foundation_generator.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { mintLot, footprintWidth, heightTier, streetAddress, DISTRICTS, type ZoneId } from '../lib/city/zones'

const DATA_DIR = path.join(__dirname, '..', 'data')
const OUT_DIR = path.join(__dirname, '..', 'data', 'foundation')

// ── §1/§2 constants (masterplan.md) ─────────────────────────────────────────────
const DUST_MAX = 1              // < 1 DOG → no lot at all
const BUILD_THRESHOLD = 20_000  // qualifies a UTXO for centrality + triggers building
const RING0_SEATS = 85          // "Satoshi Visionary" seats (PROVISIONAL proxy — see header)
const RESERVE_PARCEL_COUNT = 25 // masterplan §6 — DOGDATA_RESERVE land bank

// masterplan §5 — civic core slots reserved in district 0 (indices 0..N-1), never
// filled by a wallet. Count is a placeholder until the 3D civic layout (P1 buildings)
// is spatially laid out; it only needs to be large enough that no P1 building will
// ever collide with a wallet lot once the real footprint is designed.
const CIVIC_CORE_SLOTS = 200

interface RawUtxo { txid: string; vout: number; dog: number; age_days: number; ts: number; lth: boolean }
interface HolderRow { address: string; total_dog: number; utxo_count: number; rank: number }

interface PositionInfo { score: number; source: 'ge20k' | 'fallback_any' }

interface FoundationLot {
  address: string
  district: number
  ring0_visionary: boolean
  position_score: number
  position_source: 'ge20k' | 'fallback_any'
  balance_at_snapshot: number
  utxo_count_frozen: number
  typology: 'tower' | 'house' | 'condo'
  lot_side: number
  lot_area: number
  height_tier: number
  state: 'waiting' | 'standing'
  x: number; z: number; rot: number
  street: string; number: number
  lot_index: number
}

interface ReservedSlot {
  kind: 'civic_core' | 'dogdata_reserve'
  district: number
  index: number
  x: number; z: number; rot: number
}

// ── Load ─────────────────────────────────────────────────────────────────────────

function loadHolders(): HolderRow[] {
  const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'dog_holders.json'), 'utf8'))
  return (raw.holders as any[]).map((h) => ({
    address: h.address,
    total_dog: h.total_dog,
    utxo_count: h.utxo_count,
    rank: h.rank,
  }))
}

function loadUtxosByAddress(): Record<string, RawUtxo[]> {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'dog_utxos_by_address.json'), 'utf8'))
}

// ── §2 — position_score (the fundação's centrality metric) ─────────────────────

function computePositionScore(utxos: RawUtxo[] | undefined): PositionInfo {
  if (!utxos || utxos.length === 0) return { score: Number.MAX_SAFE_INTEGER, source: 'fallback_any' }
  let bestGe20k = -1
  for (const u of utxos) {
    if (u.dog >= BUILD_THRESHOLD && (bestGe20k === -1 || u.ts < bestGe20k)) bestGe20k = u.ts
  }
  if (bestGe20k !== -1) return { score: bestGe20k, source: 'ge20k' }
  let anyOldest = -1
  for (const u of utxos) if (anyOldest === -1 || u.ts < anyOldest) anyOldest = u.ts
  return { score: anyOldest === -1 ? Number.MAX_SAFE_INTEGER : anyOldest, source: 'fallback_any' }
}

// Two-tier compare: every ge20k wallet outranks (is more central than) every
// fallback wallet, REGARDLESS of the fallback wallet's own age — masterplan §2.
function comparePosition(a: PositionInfo, b: PositionInfo): number {
  const tierA = a.source === 'ge20k' ? 0 : 1
  const tierB = b.source === 'ge20k' ? 0 : 1
  if (tierA !== tierB) return tierA - tierB
  return a.score - b.score // smaller ts = older = more central
}

// ── §2 — typology, frozen from utxo_count at the snapshot ──────────────────────

function typologyFromUtxoCount(n: number): 'tower' | 'house' | 'condo' {
  if (n <= 2) return 'tower'
  if (n <= 10) return 'house'
  return 'condo'
}

// ── §1 — lifecycle state at genesis (no ruins are possible on day one) ─────────

function stateAtGenesis(balance: number): 'waiting' | 'standing' {
  return balance >= BUILD_THRESHOLD ? 'standing' : 'waiting'
}

// ── §5/§6 — deterministic reservation of civic + Reserva Urbana slots ──────────
// Reserved BEFORE wallets are enumerated so no wallet index is ever bumped later.

function reservedSlots(): { civic: Set<string>; reserve: ReservedSlot[] } {
  const civic = new Set<string>()
  for (let i = 0; i < CIVIC_CORE_SLOTS; i++) civic.add(`0:${i}`)

  // Reserva Urbana (masterplan §6, target 25 parcels): 1 premium seat just outside
  // the civic core in district 0; 8 seats across the inner rings 0-3 (2 per district);
  // 4 waterfront seats spread across districts 6-7 (higher indices = further out, a
  // stand-in for "orla" until the real coastline geometry exists); 3 arrival-axis
  // seats in districts 7-9 (periphery, near where new avenues would enter); 2 large
  // parcels in the outermost district for future port-adjacent expansion.
  // 1 + 8 + 4 + 3 + 2 = 18 planned here; padded to RESERVE_PARCEL_COUNT (25) below by
  // adding more inner-ring seats — the exact split is tunable, not load-bearing.
  const reserve: ReservedSlot[] = []
  const reserveIndexPlan: { district: number; index: number }[] = [
    { district: 0, index: CIVIC_CORE_SLOTS },                      // 1 premium, plaza-adjacent
    ...[0, 1, 2, 3].flatMap((d) => [{ district: d, index: 5000 + d * 2 }, { district: d, index: 5000 + d * 2 + 1 }]), // 8, inner rings
    ...[6, 7].flatMap((d) => [{ district: d, index: 9000 + d }, { district: d, index: 9500 + d }]),                   // 4, waterfront stand-in
    ...[7, 8, 9].map((d) => ({ district: d, index: 12000 + d })),                                                     // 3, arrival axes
    { district: 9, index: 15000 }, { district: 9, index: 15001 },                                                     // 2, port-expansion
    ...[1, 2, 3, 4, 5, 6, 7].map((d) => ({ district: d, index: 5100 + d })),                                          // 7 padding, inner/mid rings
  ]
  for (const slot of reserveIndexPlan.slice(0, RESERVE_PARCEL_COUNT)) {
    const { x, z, rot } = mintLot('btc-core', slot.district, slot.index)
    reserve.push({ kind: 'dogdata_reserve', district: slot.district, index: slot.index, x, z, rot })
  }
  return { civic, reserve }
}

// ── Main ─────────────────────────────────────────────────────────────────────────

function run() {
  console.log('DogCity Foundation Generator — dry-run (masterplan.md §2/§5/§6)\n')

  const holders = loadHolders()
  const utxosByAddress = loadUtxosByAddress()
  console.log(`Loaded ${holders.length} holders, ${Object.keys(utxosByAddress).length} UTXO sets`)

  // §2 — eligibility + position_score
  const eligible = holders.filter((h) => h.total_dog >= DUST_MAX)
  const dustDropped = holders.length - eligible.length

  const withPosition = eligible.map((h) => {
    const pos = computePositionScore(utxosByAddress[h.address])
    return { ...h, pos }
  })

  // Two-tier sort: all ge20k wallets first (oldest→newest), then all fallback wallets
  // (oldest→newest). This is the single ranking that drives ring0 + district bands.
  withPosition.sort((a, b) => comparePosition(a.pos, b.pos))

  const N = withPosition.length
  const ge20kCount = withPosition.filter((h) => h.pos.source === 'ge20k').length

  // supply normaliser for footprintWidth = the largest holder's balance (matches the
  // existing, visually-validated implementation in scripts/dogcity_backfill.ts —
  // NOT the token's total supply, which would flatten everyone but the #1 whale).
  const supplyNorm = holders.reduce((m, h) => Math.max(m, h.total_dog), 1)

  const { civic, reserve } = reservedSlots()
  const reservedKeys = new Set<string>(Array.from(civic).concat(reserve.map((r) => `${r.district}:${r.index}`)))

  // Per-district running index cursor, skipping reserved slots.
  const cursor: Record<number, number> = {}
  function nextIndex(district: number): number {
    let i = cursor[district] ?? 0
    while (reservedKeys.has(`${district}:${i}`)) i++
    cursor[district] = i + 1
    return i
  }

  const lots: FoundationLot[] = []
  withPosition.forEach((h, rank) => {
    const ring0 = rank < RING0_SEATS
    // District 0 = ring0 seats; remaining N-RING0_SEATS wallets banded into deciles
    // 1-9 (never re-using district 0, which is civic+ring0 only).
    let district: number
    if (ring0) {
      district = 0
    } else {
      const rel = rank - RING0_SEATS
      const relTotal = Math.max(1, N - RING0_SEATS)
      district = 1 + Math.min(8, Math.floor((rel / relTotal) * 9))
    }

    const index = nextIndex(district)
    const { x, z, rot } = mintLot('btc-core', district, index)
    const addr = streetAddress(district, index)
    const area = footprintWidth(h.total_dog, supplyNorm)

    lots.push({
      address: h.address,
      district,
      ring0_visionary: ring0,
      position_score: h.pos.score,
      position_source: h.pos.source,
      balance_at_snapshot: h.total_dog,
      utxo_count_frozen: h.utxo_count,
      typology: typologyFromUtxoCount(h.utxo_count),
      lot_side: Math.round(area * 100) / 100,
      lot_area: Math.round(area * area * 100) / 100,
      height_tier: heightTier(h.total_dog),
      state: stateAtGenesis(h.total_dog),
      x, z, rot,
      street: addr.street, number: addr.number,
      lot_index: index,
    })
  })

  // ── Validation ───────────────────────────────────────────────────────────────
  const posKey = (l: { x: number; z: number }) => `${l.x.toFixed(1)}:${l.z.toFixed(1)}`
  const seen = new Set<string>()
  let collisions = 0
  for (const l of lots) {
    const k = posKey(l)
    if (seen.has(k)) collisions++
    seen.add(k)
  }

  const byDistrict: Record<number, number> = {}
  const standingByDistrict: Record<number, number> = {}
  for (const l of lots) {
    byDistrict[l.district] = (byDistrict[l.district] ?? 0) + 1
    if (l.state === 'standing') standingByDistrict[l.district] = (standingByDistrict[l.district] ?? 0) + 1
  }
  const totalArea = lots.reduce((s, l) => s + l.lot_area, 0)
  const standing = lots.filter((l) => l.state === 'standing').length
  const waiting = lots.length - standing
  const typologyCounts = lots.reduce<Record<string, number>>((acc, l) => {
    acc[l.typology] = (acc[l.typology] ?? 0) + 1
    return acc
  }, {})

  // ── Output ───────────────────────────────────────────────────────────────────
  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.writeFileSync(path.join(OUT_DIR, 'lots.json'), JSON.stringify(lots, null, 0))
  fs.writeFileSync(path.join(OUT_DIR, 'reserved.json'), JSON.stringify(reserve, null, 2))

  const report = {
    generated_at: new Date().toISOString(),
    dry_run: true,
    note: 'No Supabase writes, no ord/bitcoin-cli calls, no spending. See masterplan.md §2/§5/§6.',
    caveats: [
      'ring0_visionary is a PROVISIONAL proxy (85 earliest position_score) — the real "Satoshi Visionary" cohort (airdrop + 100x+ accumulation) needs a join against the behavioral-cohort dataset, not wired here.',
      'position_score uses per-UTXO `ts` (block confirmation timestamp) as the reproducible ordering key — equivalent to the block-height requirement in masterplan.md §2 (both are immutable; ts is already present in dog_utxos_by_address.json, no scanner patch needed).',
      'Civic core (200 slots) and Reserva Urbana (25 parcels) are RESERVED INDEX COUNTS, not yet a spatially-designed 3D footprint — masterplan §5/§7 still need the real civic building placement before this generator becomes final.',
      'supply normaliser for lot_area is the largest single holder balance (matches the already-shipped, visually-validated footprintWidth), not the token total supply.',
    ],
    input: {
      holders_total: holders.length,
      dust_dropped: dustDropped,
      eligible: eligible.length,
    },
    position: {
      ge20k_wallets: ge20kCount,
      fallback_periphery_wallets: N - ge20kCount,
      ge20k_pct: Math.round((ge20kCount / N) * 1000) / 10,
    },
    districts: DISTRICTS.map((d) => ({
      id: d.id, name: d.name,
      lots: byDistrict[d.id] ?? 0,
      standing: standingByDistrict[d.id] ?? 0,
    })),
    lifecycle: { standing, waiting, standing_pct: Math.round((standing / N) * 1000) / 10 },
    typology: typologyCounts,
    area: {
      total_lot_area: Math.round(totalArea),
      avg_lot_area: Math.round((totalArea / N) * 100) / 100,
    },
    reserved: {
      civic_core_slots: CIVIC_CORE_SLOTS,
      dogdata_reserve_parcels: reserve.length,
    },
    validation: {
      total_lots: lots.length,
      position_collisions: collisions,
      collision_free: collisions === 0,
    },
  }
  fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2))

  console.log('\n── Report ──────────────────────────────────────────')
  console.log(JSON.stringify(report, null, 2))
  console.log(`\nWrote: ${path.relative(process.cwd(), OUT_DIR)}/{lots.json, reserved.json, report.json}`)
}

run()
