/**
 * One-time backfill: seeds dog_metrics_history with data from existing JSON files.
 *
 * For dates where we only have partial data (utxo count + price),
 * we insert what we have and set other fields to 0.
 *
 * Usage: npx tsx scripts/backfill_metrics_history.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: path.join(__dirname, '..', '.env.local') })
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function main() {
  console.log('📊 Starting metrics history backfill...')

  // Load UTXO history
  const utxoHistoryPath = path.join(__dirname, '..', 'data', 'utxo_count_history.json')
  if (!fs.existsSync(utxoHistoryPath)) {
    console.error('❌ utxo_count_history.json not found')
    process.exit(1)
  }
  const utxoHistory = JSON.parse(fs.readFileSync(utxoHistoryPath, 'utf-8'))

  // Load price history
  const priceHistoryPath = path.join(__dirname, '..', 'data', 'dog_price_history.json')
  let priceHistory: Record<string, number> = {}
  if (fs.existsSync(priceHistoryPath)) {
    priceHistory = JSON.parse(fs.readFileSync(priceHistoryPath, 'utf-8'))
    console.log(`📈 Loaded ${Object.keys(priceHistory).length} price history entries`)
  } else {
    console.log('⚠️ dog_price_history.json not found, prices will be 0')
  }

  const rows = []

  for (const entry of utxoHistory.history) {
    const date = entry.date // "2026-01-07"
    const price = priceHistory[date] || 0

    rows.push({
      recorded_at: `${date}T12:00:00Z`,
      total_utxos: entry.total_utxos,
      total_holders: 0,
      gini_coefficient: 0,
      top10_supply_pct: 0,
      top100_supply_pct: 0,
      top1000_supply_pct: 0,
      avg_age_days: 0,
      median_age_days: 0,
      sth_percentage: 0,
      lth_percentage: 0,
      realized_cap: 0,
      market_cap: 0,
      mvrv_ratio: 0,
      supply_in_profit_pct: 0,
      supply_in_loss_pct: 0,
      current_price: price,
    })
  }

  console.log(`📦 Inserting ${rows.length} backfill rows...`)

  // Insert in batches of 50
  let inserted = 0
  let skipped = 0

  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50)
    const { error } = await supabase
      .from('dog_metrics_history')
      .insert(batch)

    if (error) {
      if (error.code === '23505') {
        console.log(`  Batch ${i + 1}-${i + batch.length}: skipped (already exists)`)
        skipped += batch.length
      } else {
        console.error(`  Batch ${i + 1}-${i + batch.length}: error - ${error.message}`)
      }
    } else {
      console.log(`  Batch ${i + 1}-${i + batch.length}: ✅ OK`)
      inserted += batch.length
    }
  }

  console.log(`\n✅ Backfill complete: ${inserted} inserted, ${skipped} skipped`)
}

main().catch((err) => {
  console.error('❌ Unhandled error:', err)
  process.exit(1)
})
