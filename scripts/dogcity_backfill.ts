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
import { backfillSnapshot, backfillBtcOrganic, type HolderInput } from '../lib/city/registry'
import type { ChainId } from '../lib/city/zones'

dotenv.config({ path: path.join(__dirname, '..', '.env.local') })
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const API_BASE = process.env.CITY_API_BASE || 'http://localhost:3000'
const BTC_ONLY = process.argv.includes('--btc-only')

function loadBtc(): { holders: HolderInput[]; supply: number } {
  const p = path.join(__dirname, '..', 'data', 'dog_holders.json')
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'))
  const holders: HolderInput[] = (raw.holders || []).map((h: any) => ({
    address: h.address, balance: h.total_dog, utxo_count: h.utxo_count,
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
  // BTC uses the ORGANIC road-aligned layout (frozen v3 city), not the spiral.
  try {
    const res = await backfillBtcOrganic(btc.holders, btc.supply)
    console.log(`  bitcoin: minted ${res.minted} (overflow ${res.overflow}), skipped ${res.skipped}`)
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
