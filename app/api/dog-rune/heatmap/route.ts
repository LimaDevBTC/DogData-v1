import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── In-memory cache (same pattern as metrics/history) ─────────
let cachedData: {
  data: any
  timestamp: number
  key: string
} | null = null

const CACHE_DURATION = 3 * 60 * 1000 // 3 minutes

// ─── Grid configurations per timeframe ─────────────────────────
interface GridConfig {
  bucketMs: number
  rows: number
  cols: number
  rowLabel: string
  colLabel: string
}

const GRID_CONFIGS: Record<string, GridConfig> = {
  '1d':  { bucketMs: 15 * 60 * 1000,      rows: 4,  cols: 24, rowLabel: 'quarter', colLabel: 'hour' },
  '7d':  { bucketMs: 60 * 60 * 1000,       rows: 7,  cols: 24, rowLabel: 'day',     colLabel: 'hour' },
  '30d': { bucketMs: 6 * 60 * 60 * 1000,   rows: 4,  cols: 30, rowLabel: '6h-slot', colLabel: 'day' },
  '1y':  { bucketMs: 24 * 60 * 60 * 1000,  rows: 7,  cols: 52, rowLabel: 'weekday', colLabel: 'week' },
}

// ─── Supabase client ───────────────────────────────────────────
function getSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase not configured')
  return createClient(url, key)
}

// ─── Bucket label generators ───────────────────────────────────
function getBucketLabel(timeframe: string, bucketIdx: number, startTime: Date): string {
  const config = GRID_CONFIGS[timeframe]
  const bucketStart = new Date(startTime.getTime() + bucketIdx * config.bucketMs)

  switch (timeframe) {
    case '1d': {
      return bucketStart.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' })
    }
    case '7d': {
      const day = bucketStart.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
      const hour = bucketStart.toLocaleTimeString('en-US', { hour: '2-digit', hour12: false, timeZone: 'UTC' })
      return `${day} ${hour}:00`
    }
    case '30d': {
      const day = bucketStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
      const hour = bucketStart.getUTCHours()
      return `${day} ${String(hour).padStart(2, '0')}:00`
    }
    case '1y': {
      return bucketStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
    }
    default:
      return bucketStart.toISOString()
  }
}

function getBucketRowCol(timeframe: string, bucketIdx: number): { row: number; col: number } {
  const config = GRID_CONFIGS[timeframe]
  switch (timeframe) {
    case '1d':
      return { row: bucketIdx % 4, col: Math.floor(bucketIdx / 4) }
    case '7d':
      return { row: Math.floor(bucketIdx / 24), col: bucketIdx % 24 }
    case '30d':
      return { row: bucketIdx % 4, col: Math.floor(bucketIdx / 4) }
    case '1y': {
      return { row: bucketIdx % 7, col: Math.floor(bucketIdx / 7) }
    }
    default:
      return { row: 0, col: bucketIdx }
  }
}

// ─── Main handler ──────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const timeframe = searchParams.get('timeframe') || '1d'
  const layer = searchParams.get('layer') || 'volume'
  const drillIdx = searchParams.get('drill')

  if (!GRID_CONFIGS[timeframe]) {
    return NextResponse.json({ error: 'Invalid timeframe' }, { status: 400 })
  }

  const config = GRID_CONFIGS[timeframe]
  const cacheKey = `${timeframe}:${layer}:${drillIdx || ''}`

  // Check cache
  if (cachedData && cachedData.key === cacheKey && Date.now() - cachedData.timestamp < CACHE_DURATION) {
    return NextResponse.json(cachedData.data, {
      headers: { 'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=30' }
    })
  }

  try {
    const supabase = getSupabase()
    const now = new Date()
    const totalBuckets = config.rows * config.cols

    // Calculate time range
    const startTime = new Date(now.getTime() - totalBuckets * config.bucketMs)
    const bucketSecs = config.bucketMs / 1000

    // ─── Drill-down: return full transactions for a specific bucket ──
    if (drillIdx !== null && drillIdx !== undefined) {
      const idx = parseInt(drillIdx)
      if (isNaN(idx) || idx < 0 || idx >= totalBuckets) {
        return NextResponse.json({ error: 'Invalid drill index' }, { status: 400 })
      }

      const bucketStart = new Date(startTime.getTime() + idx * config.bucketMs)
      const bucketEnd = new Date(bucketStart.getTime() + config.bucketMs)

      const { data: txs, error } = await supabase
        .from('dog_transactions')
        .select('*')
        .gte('timestamp', bucketStart.toISOString())
        .lt('timestamp', bucketEnd.toISOString())
        .order('total_dog_moved', { ascending: false })
        .limit(50)

      if (error) throw error

      return NextResponse.json({
        bucketIndex: idx,
        label: getBucketLabel(timeframe, idx, startTime),
        startTime: bucketStart.toISOString(),
        endTime: bucketEnd.toISOString(),
        transactions: txs || []
      })
    }

    // ─── Aggregated bucket query ────────────────────────────────
    const { data: rawRows, error } = await supabase.rpc('heatmap_buckets', {
      p_start: startTime.toISOString(),
      p_end: now.toISOString(),
      p_bucket_secs: bucketSecs,
    })

    let bucketMap: Map<number, any> = new Map()

    if (error) {
      // Fallback: if RPC doesn't exist, use raw query via REST
      console.warn('RPC heatmap_buckets not found, using fallback query')
      const { data: fallbackRows, error: fbError } = await supabase
        .from('dog_transactions')
        .select('timestamp, total_dog_moved, net_transfer, fee_sats')
        .gte('timestamp', startTime.toISOString())
        .lt('timestamp', now.toISOString())
        .order('timestamp', { ascending: true })

      if (fbError) throw fbError

      // Client-side bucketing
      for (const row of fallbackRows || []) {
        const ts = new Date(row.timestamp).getTime()
        const idx = Math.min(totalBuckets - 1, Math.floor((ts - startTime.getTime()) / config.bucketMs))

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
      // Use RPC results
      for (const row of rawRows || []) {
        bucketMap.set(Number(row.bucket_idx), row)
      }
    }

    // ─── Build response buckets ─────────────────────────────────
    const buckets = []
    let totalTx = 0
    let totalVolume = 0
    let peakValue = 0
    let peakIdx = 0
    let whaleCount = 0

    for (let i = 0; i < totalBuckets; i++) {
      const raw = bucketMap.get(i)
      const { row, col } = getBucketRowCol(timeframe, i)
      const bucketStart = new Date(startTime.getTime() + i * config.bucketMs)

      const txCount = raw?.tx_count || 0
      const volume = Number(raw?.volume || 0)
      const avgFee = raw?.avg_fee ? Number(raw.avg_fee) : null
      const whaleVolume = Number(raw?.whale_volume || 0)
      const hasWhale = raw?.has_whale || false
      const netFlow = Number(raw?.net_flow || 0)
      const retailVolume = Number(raw?.retail_volume || 0)
      const mediumVolume = Number(raw?.medium_volume || 0)
      const largeVolume = Number(raw?.large_volume || 0)

      // Determine primary value based on layer
      let value = 0
      switch (layer) {
        case 'count': value = txCount; break
        case 'fee': value = avgFee || 0; break
        case 'whale': value = whaleVolume; break
        case 'retail': value = retailVolume; break
        default: value = volume; break
      }

      totalTx += txCount
      totalVolume += volume
      if (hasWhale) whaleCount++
      if (value > peakValue) { peakValue = value; peakIdx = i }

      buckets.push({
        index: i,
        row,
        col,
        value: Math.round(value * 100) / 100,
        txCount,
        volume: Math.round(volume * 100) / 100,
        avgFee: avgFee !== null ? Math.round(avgFee) : null,
        whaleVolume: Math.round(whaleVolume * 100) / 100,
        hasWhale,
        retailVolume: Math.round(retailVolume * 100) / 100,
        mediumVolume: Math.round(mediumVolume * 100) / 100,
        largeVolume: Math.round(largeVolume * 100) / 100,
        netFlow: Math.round(netFlow * 100) / 100,
        label: getBucketLabel(timeframe, i, startTime),
        startTime: bucketStart.toISOString(),
      })
    }

    const response = {
      buckets,
      meta: {
        timeframe,
        layer,
        gridConfig: {
          rows: config.rows,
          cols: config.cols,
          rowLabel: config.rowLabel,
          colLabel: config.colLabel,
        },
        totalTx,
        totalVolume: Math.round(totalVolume * 100) / 100,
        peakBucket: {
          index: peakIdx,
          value: Math.round(peakValue * 100) / 100,
          label: getBucketLabel(timeframe, peakIdx, startTime),
        },
        whaleCount,
        activeSlots: buckets.filter(b => b.txCount > 0).length,
      },
    }

    // Cache
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
