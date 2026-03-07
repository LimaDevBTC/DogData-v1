/**
 * Collector: reads dog_holders.json and inserts a metrics snapshot into Supabase.
 *
 * Runs locally after automated_update.py via cron.
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * Usage: npx tsx scripts/collect_metrics_history.ts
 */

import { createClient } from '@supabase/supabase-js'
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
    // Unique constraint violation = duplicate run this hour, that's OK
    if (error.code === '23505') {
      log('⏭️ Row for this hour already exists, skipping (duplicate run)')
      process.exit(0)
    }
    log(`❌ Supabase insert error: ${error.message}`)
    process.exit(1)
  }

  log('✅ Metrics snapshot inserted successfully')
  process.exit(0)
}

main().catch((err) => {
  log(`❌ Unhandled error: ${err}`)
  process.exit(1)
})
