// ═══════════════════════════════════════════════════════════════════════════════
// lib/city/registry.ts — CrossChainCity lot registry (crosschaincity.md · BLOCO A)
//
// Read/write layer over the `dogcity_lots` table. Lot allocation is transactional
// (the dogcity_reserve_lots RPC hands out non-overlapping index blocks), so two
// concurrent requests can never mint the same lot. Reads of the full city are
// memoized in-process for CITY_TTL because the city only changes once per hourly
// snapshot — the render path never pays for an 86k-row scan more than once a window.
// ═══════════════════════════════════════════════════════════════════════════════

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  CHAIN_TO_ZONE, assignDistrict, heightTier, footprintWidth, mintLot, streetAddress,
  type ChainId, type ZoneId, type LotState,
} from './zones'
import { freezeWorld, frozenLayout, readFrozenWorld } from './world'
import { ageOrderedPlots, type RadialPlot } from './generator'

// Sentinel "district" used as the GLOBAL radial mint cursor for the BTC core (the
// age model uses one centre-out ordering, not per-district counters).
const BTC_RADIAL_CURSOR = 99

// Age-band from a holder's global age rank (0 = oldest/centre … 9 = newest/edge).
function ageBand(index: number, total: number): number {
  return Math.min(9, Math.max(0, Math.floor((index / Math.max(total, 1)) * 10)))
}

// The N backfill holders are STRIDED across all P age-ordered plots so the whole
// organic outline fills (not just a central disc). Rank i (oldest=0) → this plot.
function btcBackfillPlot(ordered: RadialPlot[], N: number, i: number): RadialPlot {
  const P = ordered.length
  return ordered[Math.min(P - 1, Math.floor((i * P) / Math.max(N, 1)))]
}

// The plots the stride skipped, ordered OUTER-first (highest age key) — the frontier
// where future (newest) arrivals build. Cached per (rLand, N).
let _growthCache: { rLand: number; N: number; list: RadialPlot[] } | null = null
function btcGrowthPlots(ordered: RadialPlot[], N: number, rLand: number): RadialPlot[] {
  if (_growthCache && _growthCache.rLand === rLand && _growthCache.N === N) return _growthCache.list
  const P = ordered.length
  const used = new Uint8Array(P)
  for (let i = 0; i < N; i++) used[Math.min(P - 1, Math.floor((i * P) / Math.max(N, 1)))] = 1
  const list: RadialPlot[] = []
  for (let k = P - 1; k >= 0; k--) if (!used[k]) list.push(ordered[k])
  _growthCache = { rLand, N, list }
  return list
}

// Position resolver: BTC lots land on the ORGANIC road-aligned plots (age-ordered,
// strided to fill the whole outline); SOL/STX islands use the phyllotaxis spiral.
function positionFor(zone: ZoneId, district: number, index: number): { x: number; z: number; rot: number } {
  if (zone === 'btc-core') {
    const layout = frozenLayout()
    const ordered = ageOrderedPlots(layout)
    const N = readFrozenWorld()?.n ?? ordered.length
    // index < N → a backfill slot; index ≥ N → the (index-N)-th growth arrival.
    let p: RadialPlot | undefined
    if (index < N) p = btcBackfillPlot(ordered, N, index)
    else {
      const growth = btcGrowthPlots(ordered, N, layout.rLand)
      p = growth[index - N]
    }
    if (p) return { x: Math.round(p.x * 10) / 10, z: Math.round(p.z * 10) / 10, rot: Math.round(p.rot * 1000) / 1000 }
  }
  return mintLot(zone, district, index)
}

// ─── Client (service role — the registry writes) ───────────────────────────────
let _client: SupabaseClient | null = null
export function registryClient(): SupabaseClient {
  if (_client) return _client
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('SUPABASE_URL / key not set for dogcity registry')
  _client = createClient(url, key, { auth: { persistSession: false } })
  return _client
}

// ─── Row shape ─────────────────────────────────────────────────────────────────
export type LotKind = 'build' | 'open'

export interface LotRow {
  address: string
  chain: ChainId
  zone: ZoneId
  district: number
  lot_x: number
  lot_z: number
  rot: number
  street: string | null
  number: number | null
  state: LotState
  last_balance: number
  height_tier: number
  footprint: number
  kind: LotKind          // 'build' (≥10k DOG) | 'open' (1-10k green space)
  utxo_count: number     // drives form: few = tower, many = condo
  age_score: number      // centrality metric: age (days) of oldest ≥10k UTXO
  prestige: number       // 1-5 stars (profile only)
}

const LOT_COLS = 'address,chain,zone,district,lot_x,lot_z,rot,street,number,state,last_balance,height_tier,footprint,kind,utxo_count,age_score,prestige'

export interface HolderInput {
  address: string
  balance: number       // DOG balance
  utxo_count?: number    // number of UTXOs (Bitcoin) — drives form + activity
  age?: number           // age_score in days (oldest ≥10k UTXO) — drives BTC placement
  lth_pct?: number       // % of balance in long-term (≥155d) UTXOs — for prestige
}

// Occupancy bands (reorganizecity.md · BLOCO 3.1).
const DUST_MAX = 1        // < 1 DOG → dropped entirely (no lot)
const BUILD_MIN = 10_000  // ≥ 10k DOG → a building; 1..<10k → open green space
function lotKind(balance: number): LotKind { return balance >= BUILD_MIN ? 'build' : 'open' }

// Prestige stars (1-5): tenure (age) + accumulation (balance) + conviction (LTH%).
function prestigeStars(ageDays: number, balance: number, lthPct: number): number {
  const ageNorm = Math.min(1, Math.max(0, ageDays / 730))            // ~2y cap
  const balNorm = Math.min(1, Math.max(0, Math.log10(Math.max(balance, 1)) / 10)) // up to 10B
  const lthNorm = Math.min(1, Math.max(0, lthPct / 100))
  const raw = 0.5 * ageNorm + 0.2 * balNorm + 0.3 * lthNorm
  return 1 + Math.round(raw * 4)
}

export type CityEvent = 'construct' | 'implode' | 'resize' | 'rebuild'
export interface EventRow {
  id?: number
  address: string
  zone: ZoneId
  district: number
  event: CityEvent
  lot_x: number
  lot_z: number
  height_tier: number
  footprint: number
}

const PAGE = 1000

// ─── Full-city read (memoized per process) ─────────────────────────────────────
const CITY_TTL = 15 * 60 * 1000
let _cityCache: { at: number; rows: LotRow[] } | null = null

export async function getAllLots(force = false): Promise<LotRow[]> {
  if (!force && _cityCache && Date.now() - _cityCache.at < CITY_TTL) return _cityCache.rows
  const sb = registryClient()
  const rows: LotRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('dogcity_lots')
      .select(LOT_COLS)
      .order('address', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`getAllLots: ${error.message}`)
    if (!data || data.length === 0) break
    rows.push(...(data as LotRow[]))
    if (data.length < PAGE) break
  }
  _cityCache = { at: Date.now(), rows }
  return rows
}

export function invalidateCityCache(): void { _cityCache = null }

// Cheap existence probe so callers can fall back to legacy generation gracefully.
export async function registryCount(): Promise<number> {
  const sb = registryClient()
  const { count, error } = await sb
    .from('dogcity_lots')
    .select('address', { count: 'exact', head: true })
  if (error) throw new Error(`registryCount: ${error.message}`)
  return count ?? 0
}

// ─── Address → lot resolution (BLOCO D) ────────────────────────────────────────
export async function resolveAddresses(addresses: string[]): Promise<Map<string, LotRow>> {
  const out = new Map<string, LotRow>()
  const uniq = Array.from(new Set(addresses.filter(Boolean)))
  const sb = registryClient()
  for (let i = 0; i < uniq.length; i += 300) {
    const chunk = uniq.slice(i, i + 300)
    const { data, error } = await sb
      .from('dogcity_lots')
      .select(LOT_COLS)
      .in('address', chunk)
    if (error) throw new Error(`resolveAddresses: ${error.message}`)
    for (const r of (data as LotRow[] | null) ?? []) out.set(r.address, r)
  }
  return out
}

// ─── Transactional lot minting ─────────────────────────────────────────────────
// Reserve a contiguous block of indices for (zone, district) atomically, then map
// each to a permanent world position via the deterministic spiral.
async function reserveIndices(zone: ZoneId, district: number, n: number): Promise<number> {
  const sb = registryClient()
  const { data, error } = await sb.rpc('dogcity_reserve_lots', {
    p_zone: zone, p_district: district, p_n: n,
  })
  if (error) throw new Error(`reserveIndices: ${error.message}`)
  return (data as number) ?? 0
}

export type FreshHolder = HolderInput & { district: number }

function mkLotRow(
  h: FreshHolder, chain: ChainId, zone: ZoneId, district: number,
  pos: { x: number; z: number; rot: number }, idx: number, supply: number,
): LotRow {
  const addr = streetAddress(district, idx)
  return {
    address: h.address, chain, zone, district,
    lot_x: pos.x, lot_z: pos.z, rot: pos.rot,
    street: addr.street, number: addr.number,
    state: h.balance > 0 ? 'active' : 'ruin',
    last_balance: h.balance,
    height_tier: heightTier(h.balance),
    footprint: footprintWidth(h.balance, supply),
    kind: lotKind(h.balance),
    utxo_count: h.utxo_count ?? 1,
    age_score: h.age ?? 0,
    prestige: prestigeStars(h.age ?? 0, h.balance, h.lth_pct ?? 0),
  }
}

// Build a LotRow for a brand-new address (does not write it — caller batches).
export async function buildFreshLots(
  chain: ChainId,
  newHolders: FreshHolder[],
  supply: number,
): Promise<LotRow[]> {
  const zone = CHAIN_TO_ZONE[chain]
  const rows: LotRow[] = []

  // BTC: brand-new holders are the NEWEST → they arrive at the outer frontier via a
  // single global radial cursor, in the 'Fresh Arrivals' ring (district 9).
  if (zone === 'btc-core') {
    const start = await reserveIndices(zone, BTC_RADIAL_CURSOR, newHolders.length)
    newHolders.forEach((h, i) => {
      const idx = start + i
      rows.push(mkLotRow(h, chain, zone, 9, positionFor(zone, 9, idx), idx, supply))
    })
    return rows
  }

  // SOL/STX islands: per-district phyllotaxis spiral.
  const byDistrict = new Map<number, FreshHolder[]>()
  for (const h of newHolders) {
    const arr = byDistrict.get(h.district) ?? []
    arr.push(h)
    byDistrict.set(h.district, arr)
  }
  for (const [district, hs] of Array.from(byDistrict.entries())) {
    const start = await reserveIndices(zone, district, hs.length)
    hs.forEach((h, i) => {
      const idx = start + i
      rows.push(mkLotRow(h, chain, zone, district, positionFor(zone, district, idx), idx, supply))
    })
  }
  return rows
}

// ─── Batched writes ────────────────────────────────────────────────────────────
export async function upsertLots(rows: LotRow[]): Promise<void> {
  if (rows.length === 0) return
  const sb = registryClient()
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500).map(r => ({ ...r, updated_at: new Date().toISOString() }))
    const { error } = await sb.from('dogcity_lots').upsert(chunk, { onConflict: 'address' })
    if (error) throw new Error(`upsertLots: ${error.message}`)
  }
  invalidateCityCache()
}

export async function insertEvents(events: EventRow[]): Promise<void> {
  if (events.length === 0) return
  const sb = registryClient()
  const payload = events.map(e => ({
    address: e.address, zone: e.zone, district: e.district, event: e.event,
    lot_x: e.lot_x, lot_z: e.lot_z, height_tier: e.height_tier, footprint: e.footprint,
  }))
  for (let i = 0; i < payload.length; i += 500) {
    const { error } = await sb.from('dogcity_events').insert(payload.slice(i, i + 500))
    if (error) throw new Error(`insertEvents: ${error.message}`)
  }
}

// Prune the event ring so it stays bounded — keep the most recent `keep` rows.
export async function pruneEvents(keep = 5000): Promise<void> {
  const sb = registryClient()
  const { data } = await sb.from('dogcity_events').select('id').order('id', { ascending: false }).range(keep, keep)
  const cutoff = (data as { id: number }[] | null)?.[0]?.id
  if (cutoff) await sb.from('dogcity_events').delete().lt('id', cutoff)
}

export async function recentEvents(sinceId: number, limit = 500): Promise<{ events: EventRow[]; cursor: number }> {
  const sb = registryClient()
  const { data, error } = await sb
    .from('dogcity_events')
    .select('id,address,zone,district,event,lot_x,lot_z,height_tier,footprint')
    .gt('id', sinceId)
    .order('id', { ascending: true })
    .limit(limit)
  if (error) throw new Error(`recentEvents: ${error.message}`)
  const events = (data as EventRow[] | null) ?? []
  const cursor = events.length ? events[events.length - 1].id! : sinceId
  return { events, cursor }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BLOCO C — the diff engine. Compare a fresh snapshot against the registry and
// produce animatable events, minting lots for new addresses. Pure computation
// (no writes) so it can be unit-tested; commitSnapshot() persists the result.
// ═══════════════════════════════════════════════════════════════════════════════
export interface DiffResult {
  events: EventRow[]
  freshInputs: FreshHolder[]
  updates: LotRow[]   // existing lots whose state/balance/size changed
}

// A resize is only worth animating past a threshold — micro-jitter is ignored.
const RESIZE_EPS = 0.02

export function diffSnapshot(
  chain: ChainId,
  snapshot: HolderInput[],
  existing: LotRow[],
  supply: number,
  completeSnapshot = true,
): DiffResult {
  const zone = CHAIN_TO_ZONE[chain]
  const existingByAddr = new Map(existing.map(r => [r.address, r]))
  const seen = new Set<string>()
  const events: EventRow[] = []
  const freshInputs: DiffResult['freshInputs'] = []
  const updates: LotRow[] = []

  for (const h of snapshot) {
    seen.add(h.address)
    const bal = h.balance
    const district = assignDistrict(bal, h.utxo_count ?? 0)
    const prev = existingByAddr.get(h.address)
    if (!prev) {
      if (bal >= DUST_MAX) freshInputs.push({ address: h.address, balance: bal, district, utxo_count: h.utxo_count, age: h.age, lth_pct: h.lth_pct })
      continue
    }
    const ht = heightTier(bal)
    const fp = footprintWidth(bal, supply)
    if (prev.state === 'ruin' && bal > 0) {
      const row: LotRow = { ...prev, state: 'active', last_balance: bal, height_tier: ht, footprint: fp }
      updates.push(row)
      events.push({ address: prev.address, zone, district: prev.district, event: 'rebuild', lot_x: prev.lot_x, lot_z: prev.lot_z, height_tier: ht, footprint: fp })
    } else if (bal <= 0 && prev.state === 'active') {
      const row: LotRow = { ...prev, state: 'ruin', last_balance: 0, height_tier: 0, footprint: prev.footprint }
      updates.push(row)
      events.push({ address: prev.address, zone, district: prev.district, event: 'implode', lot_x: prev.lot_x, lot_z: prev.lot_z, height_tier: 0, footprint: prev.footprint })
    } else if (bal > 0) {
      const rel = Math.abs(bal - prev.last_balance) / Math.max(prev.last_balance, 1)
      if (rel > RESIZE_EPS || ht !== prev.height_tier) {
        const row: LotRow = { ...prev, state: 'active', last_balance: bal, height_tier: ht, footprint: fp }
        updates.push(row)
        events.push({ address: prev.address, zone, district: prev.district, event: 'resize', lot_x: prev.lot_x, lot_z: prev.lot_z, height_tier: ht, footprint: fp })
      }
    }
  }

  // Addresses in the registry but absent from the snapshot → they zeroed out.
  // ONLY when the snapshot is authoritative for the whole zone (BTC). A partial
  // top-N snapshot (SOL/STX live sources) must never implode the wallets it simply
  // didn't return, so the absence sweep is skipped for those.
  if (completeSnapshot) {
    for (const prev of existing) {
      if (prev.zone !== zone) continue
      if (seen.has(prev.address)) continue
      if (prev.state === 'ruin') continue
      updates.push({ ...prev, state: 'ruin', last_balance: 0, height_tier: 0 })
      events.push({ address: prev.address, zone, district: prev.district, event: 'implode', lot_x: prev.lot_x, lot_z: prev.lot_z, height_tier: 0, footprint: prev.footprint })
    }
  }

  return { events, freshInputs, updates }
}

// Persist a diff: mint fresh lots, upsert updated lots, append events. Returns
// the counts so the caller (hourly job / deltas route) can report progress.
export async function commitSnapshot(
  chain: ChainId,
  snapshot: HolderInput[],
  supply: number,
  completeSnapshot = true,
): Promise<{ constructed: number; imploded: number; resized: number; rebuilt: number }> {
  const zone = CHAIN_TO_ZONE[chain]
  const existing = (await getAllLots(true)).filter(r => r.zone === zone)
  const diff = diffSnapshot(chain, snapshot, existing, supply, completeSnapshot)

  const fresh = await buildFreshLots(chain, diff.freshInputs, supply)
  const constructEvents: EventRow[] = fresh.map(r => ({
    address: r.address, zone: r.zone, district: r.district, event: 'construct',
    lot_x: r.lot_x, lot_z: r.lot_z, height_tier: r.height_tier, footprint: r.footprint,
  }))

  await upsertLots([...fresh, ...diff.updates])
  await insertEvents([...constructEvents, ...diff.events])
  await pruneEvents()

  const count = (e: CityEvent) => diff.events.filter(x => x.event === e).length
  return {
    constructed: fresh.length,
    imploded: count('implode'),
    resized: count('resize'),
    rebuilt: count('rebuild'),
  }
}

// Initial migration (BLOCO A point 4): populate the registry from a full snapshot
// WITHOUT emitting construct events (this is the baseline, not a live delta). Safe
// to re-run — addresses that already have a lot are left untouched.
export async function backfillSnapshot(
  chain: ChainId,
  snapshot: HolderInput[],
  supply: number,
): Promise<{ minted: number; skipped: number }> {
  const zone = CHAIN_TO_ZONE[chain]
  const existing = new Set((await getAllLots(true)).filter(r => r.zone === zone).map(r => r.address))
  const fresh: FreshHolder[] = []
  let skipped = 0
  for (const h of snapshot) {
    if (existing.has(h.address)) { skipped++; continue }
    if (h.balance < DUST_MAX) { skipped++; continue }
    fresh.push({ ...h, district: assignDistrict(h.balance, h.utxo_count ?? 0) })
  }
  const rows = await buildFreshLots(chain, fresh, supply)
  await upsertLots(rows)
  return { minted: rows.length, skipped }
}

// Set the global BTC radial mint cursor (next free plot index) for future arrivals.
async function setBtcRadialCursor(nextIdx: number): Promise<void> {
  const sb = registryClient()
  const { error } = await sb.from('dogcity_cursors')
    .upsert([{ zone: 'btc-core', district: BTC_RADIAL_CURSOR, next_idx: nextIdx }], { onConflict: 'zone,district' })
  if (error) throw new Error(`setBtcRadialCursor: ${error.message}`)
}

// BTC initial migration ORGANISED BY AGE (crosschaincity.md + owner 2026-07-06):
// keeps the organic road-aligned Tokyo layout, but fills it CENTRE-OUT by holding
// age — the oldest coins take the dead-centre plots and the city fans outward to
// the freshest arrivals on the rim. Height/footprint still encode DOG balance, so a
// tall old whale can anchor the core. Deterministic + idempotent (stable age sort).
export async function backfillBtcByAge(
  holders: HolderInput[],
  supply: number,
): Promise<{ minted: number; skipped: number; deleted: number }> {
  const zone: ZoneId = 'btc-core'
  // BLOCO 3.1 occupancy: drop dust (<1 DOG). 1-10k → open green space, ≥10k → build.
  const active = holders.filter(h => h.balance >= DUST_MAX)
  const { layout } = freezeWorld(active.length)
  const ordered = ageOrderedPlots(layout)   // all plots, age-ordered (noisy radius)

  // Oldest first (age of oldest ≥10k UTXO, desc). Stable so re-runs reproduce positions.
  active.sort((a, b) => (b.age ?? 0) - (a.age ?? 0))
  const N = active.length

  const rows: LotRow[] = active.map((h, i) => {
    const p = btcBackfillPlot(ordered, N, i)   // strided across the full extent
    const d = ageBand(i, N)
    const addr = streetAddress(d, i)
    return {
      address: h.address, chain: 'bitcoin', zone, district: d,
      lot_x: Math.round(p.x * 10) / 10, lot_z: Math.round(p.z * 10) / 10, rot: Math.round(p.rot * 1000) / 1000,
      street: addr.street, number: addr.number,
      state: 'active', last_balance: h.balance,
      height_tier: heightTier(h.balance), footprint: footprintWidth(h.balance, supply),
      kind: lotKind(h.balance),
      utxo_count: h.utxo_count ?? 1,
      age_score: h.age ?? 0,
      prestige: prestigeStars(h.age ?? 0, h.balance, h.lth_pct ?? 0),
    }
  })

  await upsertLots(rows)
  await setBtcRadialCursor(N)   // next arrival lands on plot N (the frontier)

  // Clean up STALE lots: addresses left over from earlier backfills that aren't in
  // the current snapshot. Their old positions (e.g. from the first spiral backfill,
  // whose district-0 centre was at 0,0) can land inside the now-larger plaza. As a
  // one-time migration, the registry should mirror the current snapshot exactly.
  const sb = registryClient()
  const minted = new Set(rows.map(r => r.address))
  const existingAddrs: string[] = []
  for (let from = 0; ; from += PAGE) {
    const { data } = await sb.from('dogcity_lots').select('address').eq('zone', 'btc-core').range(from, from + PAGE - 1)
    if (!data || data.length === 0) break
    existingAddrs.push(...(data as { address: string }[]).map(d => d.address))
    if (data.length < PAGE) break
  }
  const stale = existingAddrs.filter(a => !minted.has(a))
  for (let i = 0; i < stale.length; i += 200) {
    const { error } = await sb.from('dogcity_lots').delete().in('address', stale.slice(i, i + 200))
    if (error) throw new Error(`backfill cleanup: ${error.message}`)
  }
  invalidateCityCache()
  return { minted: rows.length, skipped: holders.length - N, deleted: stale.length }
}

// Resolve a `to` address that has never been seen (a TX to a brand-new wallet):
// mint its lot in real time so the vehicle has a destination (BLOCO D point 1).
export async function ensureLot(chain: ChainId, address: string, balance: number, supply: number): Promise<LotRow> {
  const existing = await resolveAddresses([address])
  const found = existing.get(address)
  if (found) return found
  const district = assignDistrict(balance, 0)
  const [row] = await buildFreshLots(chain, [{ address, balance, district, utxo_count: 1 }], supply)
  await upsertLots([row])
  await insertEvents([{
    address: row.address, zone: row.zone, district: row.district, event: 'construct',
    lot_x: row.lot_x, lot_z: row.lot_z, height_tier: row.height_tier, footprint: row.footprint,
  }])
  return row
}
