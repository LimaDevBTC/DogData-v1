/**
 * CrossChainCity — initial registry migration (crosschaincity.md · BLOCO A point 4).
 *
 * Populates `dogcity_lots` from the three current holder snapshots so every wallet
 * gets its permanent lot. From then on the hourly delta job keeps it incremental.
 * Idempotent: re-running only mints addresses that don't yet have a lot.
 *
 *   BTC  → data/dog_holders.json (full ~86k snapshot, always available)
 *   SOL  → /api/multichain/holders?chain=solana  (top holders the live source gives)
 *   STX  → /api/multichain/holders?chain=stacks
 *
 * Usage:
 *   npx tsx scripts/dogcity_backfill.ts                 # BTC + SOL + STX (needs server up for SOL/STX)
 *   npx tsx scripts/dogcity_backfill.ts --btc-only      # BTC only, fully offline
 *   CITY_API_BASE=http://localhost:3000 npx tsx scripts/dogcity_backfill.ts
 *
 * Prereq: run migrations/006_dogcity_lots.sql in the Supabase SQL editor first.
 */

import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'
import { backfillSnapshot, backfillBtcByAge, type HolderInput } from '../lib/city/registry'
import type { ChainId } from '../lib/city/zones'

dotenv.config({ path: path.join(__dirname, '..', '.env.local') })
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const API_BASE = process.env.CITY_API_BASE || 'http://localhost:3000'
const BTC_ONLY = process.argv.includes('--btc-only')

// Centrality metric (reorganizecity.md · BLOCO 2): the AGE of the wallet's oldest
// UTXO ≥ 10.000 DOG (its oldest substantial holding — ignores dust). Fallback: the
// wallet's single oldest UTXO. Computed from dog_utxos_by_address.json (age_days per
// UTXO). Returns a map address → age_score(days).
const BUILD_MIN = 10_000
function loadAgeScores(): Map<string, number> {
  const p = path.join(__dirname, '..', 'data', 'dog_utxos_by_address.json')
  const scores = new Map<string, number>()
  if (!fs.existsSync(p)) return scores
  const raw = JSON.parse(fs.readFileSync(p, 'utf8')) as Record<string, { dog: number; age_days: number }[]>
  for (const [address, utxos] of Object.entries(raw)) {
    let bigOldest = -1, anyOldest = -1
    for (const u of utxos) {
      if (u.age_days > anyOldest) anyOldest = u.age_days
      if (u.dog >= BUILD_MIN && u.age_days > bigOldest) bigOldest = u.age_days
    }
    scores.set(address, bigOldest >= 0 ? bigOldest : Math.max(anyOldest, 0))
  }
  return scores
}

// BTC holders with age_score (oldest ≥10k UTXO), utxo_count and LTH%. holders_by_age
// carries balance/utxo/LTH; the UTXO file supplies the precise age metric.
function loadBtc(): { holders: HolderInput[]; supply: number } {
  const ages = loadAgeScores()
  const agePath = path.join(__dirname, '..', 'data', 'holders_by_age.json')
  const src = fs.existsSync(agePath)
    ? path.join(__dirname, '..', 'data', 'holders_by_age.json')
    : path.join(__dirname, '..', 'data', 'dog_holders.json')
  const raw = JSON.parse(fs.readFileSync(src, 'utf8'))
  const holders: HolderInput[] = (raw.holders || []).map((h: any) => ({
    address: h.address,
    balance: h.total_dog,
    utxo_count: h.utxo_count,
    // Prefer the precise oldest-≥10k-UTXO age; fall back to weighted avg / oldest.
    age: ages.get(h.address) ?? h.weighted_avg_age_days ?? h.oldest_age_days ?? 0,
    lth_pct: h.lth_pct ?? 0,
  }))
  const supply = holders.reduce((m, h) => Math.max(m, h.balance), 1)
  return { holders, supply }
}

async function loadExternal(chain: 'solana' | 'stacks'): Promise<{ holders: HolderInput[]; supply: number }> {
  // Stacks (Tenero/Hiro) rejects large page sizes with a 500 → keep it modest.
  const limit = chain === 'stacks' ? 200 : 1000
  const url = `${API_BASE}/api/multichain/holders?chain=${chain}&limit=${limit}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${chain} holders HTTP ${res.status}`)
  const json: any = await res.json()
  const list: any[] = json?.[chain]?.holders || []
  const holders: HolderInput[] = list
    .filter(h => h.address && h.balance > 0)
    .map(h => ({ address: h.address, balance: h.balance }))
  // Supply normaliser: reuse the BTC max (DOG is one token across chains) so the
  // √-footprint scale is consistent everywhere. Falls back to the chain's own max.
  const supply = holders.reduce((m, h) => Math.max(m, h.balance), 1)
  return { holders, supply }
}

async function run(chain: ChainId, load: () => Promise<{ holders: HolderInput[]; supply: number }> | { holders: HolderInput[]; supply: number }, sharedSupply?: number) {
  try {
    const { holders, supply } = await load()
    if (holders.length === 0) { console.log(`  ${chain}: no holders, skipped`); return }
    const res = await backfillSnapshot(chain, holders, sharedSupply ?? supply)
    console.log(`  ${chain}: minted ${res.minted}, skipped ${res.skipped} (already present)`)
  } catch (err) {
    console.warn(`  ${chain}: FAILED — ${(err as Error).message}`)
  }
}

async function main() {
  console.log('🏙️  CrossChainCity registry backfill')
  const btc = loadBtc()
  console.log(`  BTC snapshot: ${btc.holders.length} holders, supply≈${Math.round(btc.supply)}`)
  // BTC: organic road-aligned layout, filled CENTRE-OUT by holding age.
  try {
    const res = await backfillBtcByAge(btc.holders, btc.supply)
    console.log(`  bitcoin: minted ${res.minted} (centre-out by age), skipped ${res.skipped}`)
  } catch (err) {
    console.warn(`  bitcoin: FAILED — ${(err as Error).message}`)
  }

  if (!BTC_ONLY) {
    // Use the BTC max as the shared √-footprint normaliser across all three zones.
    await run('solana', () => loadExternal('solana'), btc.supply)
    await run('stacks', () => loadExternal('stacks'), btc.supply)
  }

  console.log('✅ backfill complete')
  process.exit(0)
}

main().catch(err => { console.error('❌', err); process.exit(1) })
