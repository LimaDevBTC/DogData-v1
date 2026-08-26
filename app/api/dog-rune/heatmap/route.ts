import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// ─── In-memory cache ──────────────────────────────────────────────
let cachedData: {
  data: any
  timestamp: number
  key: string
} | null = null

const CACHE_DURATION = 3 * 60 * 1000 // 3 minutes

// ─── Fixed grid: 7 rows × 52 cols for ALL timeframes ──────────────
const GRID_ROWS = 7
const GRID_COLS = 52
const TOTAL_CELLS = GRID_ROWS * GRID_COLS // 364

const BLOCKS_PER_CELL: Record<string, number> = {
  '1d':  1,     // 364 blocks  ≈ 2.5 days
  '7d':  3,     // 1,092 blocks ≈ 7.6 days
  '30d': 12,    // 4,368 blocks ≈ 30 days
  '1y':  144,   // 52,416 blocks ≈ 1 year
}

// ─── Supabase client ──────────────────────────────────────────────
function getSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase not configured')
  return createClient(url, key)
}

// ─── Bucket label (block-based) ──────────────────────────────────
function getBucketLabel(startBlock: number, endBlock: number): string {
  if (endBlock - startBlock === 1) {
    return `Block #${startBlock.toLocaleString()}`
  }
  return `Blocks #${startBlock.toLocaleString()} – #${(endBlock - 1).toLocaleString()}`
}

// ─── Row/Col from bucket index (column-first fill) ───────────────
function getBucketRowCol(bucketIdx: number): { row: number; col: number } {
  return { row: bucketIdx % GRID_ROWS, col: Math.floor(bucketIdx / GRID_ROWS) }
}

// ─── Main handler ─────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const timeframe = searchParams.get('timeframe') || '7d'
  const drillIdx = searchParams.get('drill')

  const bpc = BLOCKS_PER_CELL[timeframe]
  if (!bpc) {
    return NextResponse.json({ error: 'Invalid timeframe' }, { status: 400 })
  }

  const cacheKey = `block:${timeframe}:${drillIdx || ''}`

  // Check cache
  if (cachedData && cachedData.key === cacheKey && Date.now() - cachedData.timestamp < CACHE_DURATION) {
    return NextResponse.json(cachedData.data, {
      headers: { 'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=30' }
    })
  }

  try {
    const supabase = getSupabase()

    // Get tip block height
    const { data: tipRow, error: tipError } = await supabase
      .from('dog_transactions')
      .select('block_height')
      .order('block_height', { ascending: false })
      .limit(1)
      .single()

    if (tipError || !tipRow) {
      return NextResponse.json({
        buckets: [],
        meta: {
          timeframe,
          gridConfig: { rows: GRID_ROWS, cols: GRID_COLS, blocksPerBucket: bpc },
          startBlock: 0,
          endBlock: 0,
          totalTx: 0,
          totalVolume: 0,
          peakBucket: { index: 0, value: 0, label: '' },
          whaleCount: 0,
          activeSlots: 0,
        }
      })
    }

    const tipBlock = tipRow.block_height
    const totalBlocks = TOTAL_CELLS * bpc
    const startBlock = tipBlock - totalBlocks + 1
    const endBlock = tipBlock + 1

    // ─── Drill-down: return transactions for a specific bucket ────
    if (drillIdx !== null && drillIdx !== undefined) {
      const idx = parseInt(drillIdx)
      if (isNaN(idx) || idx < 0 || idx >= TOTAL_CELLS) {
        return NextResponse.json({ error: 'Invalid drill index' }, { status: 400 })
      }

      const bucketStartBlock = startBlock + idx * bpc
      const bucketEndBlock = bucketStartBlock + bpc

      const { data: txs, error } = await supabase
        .from('dog_transactions')
        .select('*')
        .gte('block_height', bucketStartBlock)
        .lt('block_height', bucketEndBlock)
        .order('total_dog_moved', { ascending: false })
        .limit(50)

      if (error) throw error

      return NextResponse.json({
        bucketIndex: idx,
        label: getBucketLabel(bucketStartBlock, bucketEndBlock),
        startBlock: bucketStartBlock,
        endBlock: bucketEndBlock,
        transactions: txs || []
      })
    }

    // ─── Aggregated bucket query ─────────────────────────────────
    const { data: rawRows, error } = await supabase.rpc('heatmap_block_buckets', {
      p_start_block: startBlock,
      p_end_block: endBlock,
      p_blocks_per_bucket: bpc,
    })

    let bucketMap: Map<number, any> = new Map()

    if (error) {
      // Fallback: query raw transactions and bucket client-side
      console.warn('RPC heatmap_block_buckets not found, using fallback query')
      const { data: fallbackRows, error: fbError } = await supabase
        .from('dog_transactions')
        .select('block_height, total_dog_moved, net_transfer, fee_sats')
        .gte('block_height', startBlock)
        .lt('block_height', endBlock)
        .order('block_height', { ascending: true })

      if (fbError) throw fbError

      for (const row of fallbackRows || []) {
        const idx = Math.min(
          TOTAL_CELLS - 1,
          Math.floor((row.block_height - startBlock) / bpc)
        )

        if (!bucketMap.has(idx)) {
          bucketMap.set(idx, {
            tx_count: 0, volume: 0, avg_fee: 0, fee_sum: 0,
            whale_volume: 0, has_whale: false, net_flow: 0,
            retail_volume: 0, medium_volume: 0, large_volume: 0,
          })
        }
        const b = bucketMap.get(idx)!
        const vol = Number(row.total_dog_moved) || 0
        const fee = row.fee_sats || 0

        b.tx_count++
        b.volume += vol
        b.fee_sum += fee
        b.avg_fee = b.fee_sum / b.tx_count
        b.net_flow += Number(row.net_transfer) || 0

        if (vol >= 1_000_000) { b.whale_volume += vol; b.has_whale = true }
        else if (vol >= 100_000) b.large_volume += vol
        else if (vol >= 10_000) b.medium_volume += vol
        else b.retail_volume += vol
      }
    } else {
      for (const row of rawRows || []) {
        bucketMap.set(Number(row.bucket_idx), row)
      }
    }

    // ─── Build response buckets ──────────────────────────────────
    const buckets = []
    let totalTx = 0
    let totalVolume = 0
    let peakValue = 0
    let peakIdx = 0
    let whaleCount = 0

    for (let i = 0; i < TOTAL_CELLS; i++) {
      const raw = bucketMap.get(i)
      const { row, col } = getBucketRowCol(i)
      const bucketStartBlock = startBlock + i * bpc
      const bucketEndBlock = bucketStartBlock + bpc

      const txCount = raw?.tx_count || 0
      const volume = Number(raw?.volume || 0)
      const avgFee = raw?.avg_fee ? Number(raw.avg_fee) : null
      const whaleVolume = Number(raw?.whale_volume || 0)
      const hasWhale = raw?.has_whale || false
      const netFlow = Number(raw?.net_flow || 0)
      const retailVolume = Number(raw?.retail_volume || 0)
      const mediumVolume = Number(raw?.medium_volume || 0)
      const largeVolume = Number(raw?.large_volume || 0)

      totalTx += txCount
      totalVolume += volume
      if (hasWhale) whaleCount++
      if (volume > peakValue) { peakValue = volume; peakIdx = i }

      buckets.push({
        index: i,
        row,
        col,
        value: Math.round(volume * 100) / 100,
        txCount,
        volume: Math.round(volume * 100) / 100,
        avgFee: avgFee !== null ? Math.round(avgFee) : null,
        whaleVolume: Math.round(whaleVolume * 100) / 100,
        hasWhale,
        retailVolume: Math.round(retailVolume * 100) / 100,
        mediumVolume: Math.round(mediumVolume * 100) / 100,
        largeVolume: Math.round(largeVolume * 100) / 100,
        netFlow: Math.round(netFlow * 100) / 100,
        label: getBucketLabel(bucketStartBlock, bucketEndBlock),
        startBlock: bucketStartBlock,
        endBlock: bucketEndBlock,
      })
    }

    const peakBucket = buckets[peakIdx]
    const response = {
      buckets,
      meta: {
        timeframe,
        gridConfig: {
          rows: GRID_ROWS,
          cols: GRID_COLS,
          blocksPerBucket: bpc,
        },
        startBlock,
        endBlock,
        totalTx,
        totalVolume: Math.round(totalVolume * 100) / 100,
        peakBucket: {
          index: peakIdx,
          value: Math.round(peakValue * 100) / 100,
          label: peakBucket?.label || '',
        },
        whaleCount,
        activeSlots: buckets.filter(b => b.txCount > 0).length,
      },
    }

    cachedData = { data: response, timestamp: Date.now(), key: cacheKey }

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=30' }
    })

  } catch (error: any) {
    console.error('Heatmap API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch heatmap data', details: error.message },
      { status: 500 }
    )
  }
}
