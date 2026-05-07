/**
 * Collector: reads dog_holders.json and:
 *   1. Inserts a metrics snapshot into Supabase (dog_metrics_history) — historical chart
 *   2. Publishes a fresh "live snapshot" payload into Upstash Redis (dog:snapshot:latest)
 *      — read by file-bound API routes (/api/metrics/utxo, utxo-age, /api/dog-rune/stats)
 *      so they no longer depend on the Vercel deploy bundling public/data/dog_holders.json.
 *
 * Runs locally after automated_update.py via cron.
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, UPSTASH_KV_REST_API_URL,
 *           UPSTASH_KV_REST_API_TOKEN in .env.local
 *
 * Usage: npx tsx scripts/collect_metrics_history.ts
 */

import { createClient } from '@supabase/supabase-js'
import { Redis } from '@upstash/redis'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Load .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

function log(msg: string) {
  const ts = new Date().toISOString().replace('T', ' ').substring(0, 19)
  console.log(`[${ts}] ${msg}`)
}

// Gini calculation - matches holder-concentration/route.ts
function calculateGini(holdings: number[]): number {
  if (holdings.length === 0) return 0
  const sorted = [...holdings].sort((a, b) => a - b)
  const n = sorted.length
  const sum = sorted.reduce((acc, val) => acc + val, 0)
  if (sum === 0) return 0
  let weightedSum = 0
  for (let i = 0; i < n; i++) {
    weightedSum += (i + 1) * sorted[i]
  }
  return (2 * weightedSum) / (n * sum) - (n + 1) / n
}

async function main() {
  log('📊 Starting metrics collection...')

  // Read the freshly-updated holders JSON
  const dataPath = path.join(__dirname, '..', 'public', 'data', 'dog_holders.json')
  if (!fs.existsSync(dataPath)) {
    log('❌ dog_holders.json not found at ' + dataPath)
    process.exit(1)
  }

  log('📖 Reading dog_holders.json...')
  const holdersData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
  const holders = holdersData.holders || []
  const utxoAgeStats = holdersData.utxo_age_stats

  if (!utxoAgeStats) {
    log('❌ utxo_age_stats not found in dog_holders.json')
    process.exit(1)
  }

  // Compute Gini + top N (same logic as holder-concentration API)
  const holdings = holders
    .map((h: any) => h.total_dog || 0)
    .filter((h: number) => h > 0)
  const totalSupply = holdings.reduce((sum: number, h: number) => sum + h, 0)
  const sortedHoldings = [...holdings].sort((a: number, b: number) => b - a)

  const gini = calculateGini(holdings)
  const top10 = totalSupply > 0
    ? (sortedHoldings.slice(0, 10).reduce((s: number, h: number) => s + h, 0) / totalSupply) * 100
    : 0
  const top100 = totalSupply > 0
    ? (sortedHoldings.slice(0, 100).reduce((s: number, h: number) => s + h, 0) / totalSupply) * 100
    : 0
  const top1000 = totalSupply > 0
    ? (sortedHoldings.slice(0, 1000).reduce((s: number, h: number) => s + h, 0) / totalSupply) * 100
    : 0

  const row = {
    recorded_at: new Date().toISOString(),
    total_utxos: holdersData.total_utxos || 0,
    total_holders: holdersData.total_holders || holders.length,
    gini_coefficient: parseFloat(gini.toFixed(6)),
    top10_supply_pct: parseFloat(top10.toFixed(4)),
    top100_supply_pct: parseFloat(top100.toFixed(4)),
    top1000_supply_pct: parseFloat(top1000.toFixed(4)),
    avg_age_days: utxoAgeStats.avg_age_days || 0,
    median_age_days: utxoAgeStats.median_age_days || 0,
    sth_percentage: utxoAgeStats.sth_percentage || 0,
    lth_percentage: utxoAgeStats.lth_percentage || 0,
    realized_cap: utxoAgeStats.realized_cap || 0,
    market_cap: utxoAgeStats.market_cap || 0,
    mvrv_ratio: utxoAgeStats.mvrv_ratio || 0,
    supply_in_profit_pct: utxoAgeStats.supply_in_profit_pct || 0,
    supply_in_loss_pct: utxoAgeStats.supply_in_loss_pct || 0,
    current_price: utxoAgeStats.current_price || 0,
  }

  log(`📋 Snapshot: ${row.total_holders} holders, ${row.total_utxos} UTXOs, MVRV ${row.mvrv_ratio}, Gini ${row.gini_coefficient}`)

  const { error } = await supabase
    .from('dog_metrics_history')
    .insert(row)

  if (error) {
    // Unique constraint violation = duplicate run this hour, that's OK —
    // we still want to refresh the Redis live snapshot so API consumers
    // see the freshest holder/UTXO numbers between hourly buckets.
    if (error.code === '23505') {
      log('⏭️ Supabase row for this hour already exists (continuing to Redis publish)')
    } else {
      log(`❌ Supabase insert error: ${error.message}`)
      process.exit(1)
    }
  } else {
    log('✅ Metrics snapshot inserted into Supabase')
  }

  // ─── Publish live snapshot to Upstash Redis ────────────────────────────────
  // This payload is read by the file-bound API routes so they don't depend on
  // the Vercel deploy cycle. Keep it small (<50KB) — only what those routes
  // actually consume.
  try {
    const redisUrl = process.env.UPSTASH_KV_REST_API_URL
    const redisToken = process.env.UPSTASH_KV_REST_API_TOKEN
    if (!redisUrl || !redisToken) {
      log('⚠️ Upstash KV not configured, skipping Redis snapshot publish')
      process.exit(0)
    }

    const redis = new Redis({ url: redisUrl, token: redisToken })

    // Top10 with full holder objects (sortedHoldings above was numbers-only)
    const sortedHolders = [...holders].sort((a: any, b: any) => (b.total_dog || 0) - (a.total_dog || 0))
    const top10Holders = sortedHolders.slice(0, 10).map((h: any, i: number) => ({
      rank: h.rank || i + 1,
      address: h.address,
      total_amount: h.total_amount,
      total_dog: h.total_dog,
      utxo_count: h.utxo_count,
    }))

    const TOTAL_SUPPLY = 100_000_000_000
    const circulating = Math.round(totalSupply * 100) / 100
    const burned = Math.max(0, TOTAL_SUPPLY - circulating)
    const burnedPct = parseFloat(((burned / TOTAL_SUPPLY) * 100).toFixed(4))

    // Slim the utxo_age_stats — strip raw distributions only if too large.
    // Currently utxo_age_stats is ~5KB, well under any limit.
    const livePayload = {
      timestamp: holdersData.timestamp || new Date().toISOString(),
      published_at: new Date().toISOString(),
      total_holders: row.total_holders,
      total_utxos: row.total_utxos,
      circulating_supply: circulating,
      burned,
      burned_pct: burnedPct,
      top10_holders: top10Holders,
      utxo_age_stats: utxoAgeStats, // size_distribution, age_distribution, sth/lth, mvrv, etc.
      // Aggregates that match dog_metrics_history row (for cross-check)
      gini_coefficient: row.gini_coefficient,
      top10_supply_pct: row.top10_supply_pct,
      top100_supply_pct: row.top100_supply_pct,
      top1000_supply_pct: row.top1000_supply_pct,
    }

    // 4-hour TTL — if snapshotter dies, routes will fall back to file
    await redis.set('dog:snapshot:latest', JSON.stringify(livePayload), { ex: 4 * 3600 })
    const sizeKb = (JSON.stringify(livePayload).length / 1024).toFixed(1)
    log(`✅ Live snapshot published to Upstash (dog:snapshot:latest, ${sizeKb}KB)`)
  } catch (err) {
    log(`⚠️ Redis publish failed (non-fatal): ${err}`)
    // Don't fail the script — Supabase insert already succeeded
  }

  process.exit(0)
}

main().catch((err) => {
  log(`❌ Unhandled error: ${err}`)
  process.exit(1)
})
