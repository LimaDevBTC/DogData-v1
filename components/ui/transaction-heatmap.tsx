'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Activity, Download, ArrowLeftRight, Flame } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────
type HeatmapTimeframe = '1d' | '7d' | '30d' | '1y'
type HeatmapLayer = 'volume' | 'count' | 'fee' | 'whale' | 'retail'

interface HeatmapBucket {
  index: number
  row: number
  col: number
  value: number
  txCount: number
  volume: number
  avgFee: number | null
  whaleVolume: number
  hasWhale: boolean
  retailVolume: number
  mediumVolume: number
  largeVolume: number
  netFlow: number
  label: string
  startTime: string
}

interface HeatmapMeta {
  timeframe: string
  layer: string
  gridConfig: { rows: number; cols: number; rowLabel: string; colLabel: string }
  totalTx: number
  totalVolume: number
  peakBucket: { index: number; value: number; label: string }
  whaleCount: number
  activeSlots: number
}

interface DrillTransaction {
  txid: string
  block_height: number
  timestamp: string
  type: string
  total_dog_moved: number
  net_transfer: number
  fee_sats: number | null
  sender_count: number
  receiver_count: number
}

interface RedisTransaction {
  txid: string
  block_height: number
  timestamp: string | number
  total_dog_moved: number
  net_transfer?: number
  fee_sats?: number
  sender_count: number
  receiver_count: number
  senders?: Array<{ address: string; amount_dog: number }>
  receivers?: Array<{ address: string; amount_dog: number; is_change?: boolean }>
}

// ─── Cell sizes per timeframe (px) — square cells ────────────
const CELL_SIZES: Record<HeatmapTimeframe, { size: number; gap: number }> = {
  '1d':  { size: 18, gap: 2 },
  '7d':  { size: 18, gap: 2 },
  '30d': { size: 16, gap: 2 },
  '1y':  { size: 12, gap: 1 },
}

// ─── Color gradients ──────────────────────────────────────────
function interpolateColor(ratio: number): string {
  const stops = [
    [12, 12, 12],
    [30, 25, 10],
    [80, 60, 10],
    [180, 110, 10],
    [247, 147, 26],
  ]
  const c = Math.max(0, Math.min(1, ratio))
  const seg = c * (stops.length - 1)
  const i = Math.min(Math.floor(seg), stops.length - 2)
  const t = seg - i
  return `rgb(${Math.round(stops[i][0] + (stops[i + 1][0] - stops[i][0]) * t)}, ${Math.round(stops[i][1] + (stops[i + 1][1] - stops[i][1]) * t)}, ${Math.round(stops[i][2] + (stops[i + 1][2] - stops[i][2]) * t)})`
}

function interpolateBlue(ratio: number): string {
  const stops = [
    [12, 12, 16],
    [15, 20, 40],
    [20, 50, 100],
    [40, 100, 180],
    [60, 150, 247],
  ]
  const c = Math.max(0, Math.min(1, ratio))
  const seg = c * (stops.length - 1)
  const i = Math.min(Math.floor(seg), stops.length - 2)
  const t = seg - i
  return `rgb(${Math.round(stops[i][0] + (stops[i + 1][0] - stops[i][0]) * t)}, ${Math.round(stops[i][1] + (stops[i + 1][1] - stops[i][1]) * t)}, ${Math.round(stops[i][2] + (stops[i + 1][2] - stops[i][2]) * t)})`
}

function getColor(layer: HeatmapLayer, ratio: number): string {
  if (layer === 'fee') return interpolateBlue(ratio)
  return interpolateColor(ratio)
}

// ─── Compact number format ────────────────────────────────────
function fmtVolume(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`
  return v.toFixed(0)
}

// ─── Row/Col labels ───────────────────────────────────────────
function getRowLabels(timeframe: HeatmapTimeframe): string[] {
  switch (timeframe) {
    case '1d': return [':00', ':15', ':30', ':45']
    case '7d': {
      const labels: string[] = []
      for (let i = 0; i < 7; i++) {
        const d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + i * 24 * 60 * 60 * 1000)
        labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }))
      }
      return labels
    }
    case '30d': return ['00-06', '06-12', '12-18', '18-24']
    case '1y': return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  }
}

function getColLabels(timeframe: HeatmapTimeframe): string[] {
  switch (timeframe) {
    case '1d': {
      return Array.from({ length: 24 }, (_, h) => {
        if (h % 3 !== 0) return ''
        const d = new Date(Date.now() - 24 * 60 * 60 * 1000 + h * 60 * 60 * 1000)
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
      })
    }
    case '7d': {
      return Array.from({ length: 24 }, (_, h) => {
        if (h % 3 !== 0) return ''
        return `${String(h).padStart(2, '0')}:00`
      })
    }
    case '30d': {
      return Array.from({ length: 30 }, (_, i) => {
        if (i % 5 !== 0) return ''
        const d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000 + i * 24 * 60 * 60 * 1000)
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      })
    }
    case '1y': {
      return Array.from({ length: 52 }, (_, i) => {
        if (i % 8 !== 0) return ''
        const d = new Date(Date.now() - 364 * 24 * 60 * 60 * 1000 + i * 7 * 24 * 60 * 60 * 1000)
        return d.toLocaleDateString('en-US', { month: 'short' })
      })
    }
  }
}

// ─── Process Redis data into heatmap buckets (1d only) ────────
function processRedisData(transactions: RedisTransaction[], layer: HeatmapLayer): { buckets: HeatmapBucket[]; meta: HeatmapMeta } {
  const now = Date.now()
  const dayAgo = now - 24 * 60 * 60 * 1000
  const BUCKET_MS = 15 * 60 * 1000
  const totalBuckets = 96

  const grid: HeatmapBucket[] = []
  for (let i = 0; i < totalBuckets; i++) {
    const bucketStart = dayAgo + i * BUCKET_MS
    const d = new Date(bucketStart)
    grid.push({
      index: i,
      row: i % 4,
      col: Math.floor(i / 4),
      value: 0,
      txCount: 0,
      volume: 0,
      avgFee: null,
      whaleVolume: 0,
      hasWhale: false,
      retailVolume: 0,
      mediumVolume: 0,
      largeVolume: 0,
      netFlow: 0,
      label: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      startTime: d.toISOString(),
    })
  }

  let totalTx = 0
  let totalVolume = 0

  for (const tx of transactions) {
    let ts: number
    if (typeof tx.timestamp === 'number') {
      ts = tx.timestamp < 1e12 ? tx.timestamp * 1000 : tx.timestamp
    } else {
      ts = new Date(tx.timestamp).getTime()
    }
    if (isNaN(ts) || ts < dayAgo || ts > now) continue

    const idx = Math.min(95, Math.floor((ts - dayAgo) / BUCKET_MS))
    const b = grid[idx]
    const vol = tx.total_dog_moved || 0
    const fee = tx.fee_sats || 0

    b.txCount++
    b.volume += vol
    b.netFlow += tx.net_transfer || 0

    if (vol >= 1_000_000) { b.whaleVolume += vol; b.hasWhale = true }
    else if (vol >= 100_000) b.largeVolume += vol
    else if (vol >= 10_000) b.mediumVolume += vol
    else b.retailVolume += vol

    if (fee > 0) {
      b.avgFee = b.avgFee !== null ? (b.avgFee * (b.txCount - 1) + fee) / b.txCount : fee
    }

    totalTx++
    totalVolume += vol
  }

  // Set value based on layer
  for (const b of grid) {
    switch (layer) {
      case 'count': b.value = b.txCount; break
      case 'fee': b.value = b.avgFee || 0; break
      case 'whale': b.value = b.whaleVolume; break
      case 'retail': b.value = b.retailVolume; break
      default: b.value = b.volume; break
    }
  }

  const peak = grid.reduce((best, b) => b.value > best.value ? b : best, grid[0])

  return {
    buckets: grid,
    meta: {
      timeframe: '1d',
      layer,
      gridConfig: { rows: 4, cols: 24, rowLabel: 'quarter', colLabel: 'hour' },
      totalTx,
      totalVolume,
      peakBucket: { index: peak.index, value: peak.value, label: peak.label },
      whaleCount: grid.filter(b => b.hasWhale).length,
      activeSlots: grid.filter(b => b.txCount > 0).length,
    },
  }
}

// ─── CSV Export ────────────────────────────────────────────────
function exportCSV(buckets: HeatmapBucket[], timeframe: string) {
  const header = 'time,tx_count,volume_dog,avg_fee_sats,has_whale,whale_volume,retail_volume,net_flow\n'
  const rows = buckets.map(b =>
    `${b.startTime},${b.txCount},${b.volume},${b.avgFee ?? ''},${b.hasWhale},${b.whaleVolume},${b.retailVolume},${b.netFlow}`
  ).join('\n')
  const blob = new Blob([header + rows], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `dog_heatmap_${timeframe}_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Component ────────────────────────────────────────────────
export function TransactionHeatmap() {
  const [timeframe, setTimeframe] = useState<HeatmapTimeframe>('1d')
  const [layer, setLayer] = useState<HeatmapLayer>('volume')
  const [buckets, setBuckets] = useState<HeatmapBucket[]>([])
  const [meta, setMeta] = useState<HeatmapMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [hovered, setHovered] = useState<HeatmapBucket | null>(null)
  const [drillBucket, setDrillBucket] = useState<HeatmapBucket | null>(null)
  const [drillTxs, setDrillTxs] = useState<DrillTransaction[]>([])
  const [drillLoading, setDrillLoading] = useState(false)
  const [rawTransactions, setRawTransactions] = useState<RedisTransaction[]>([])
  const [compareMode, setCompareMode] = useState(false)
  const [compareBuckets, setCompareBuckets] = useState<HeatmapBucket[]>([])
  const [compareMeta, setCompareMeta] = useState<HeatmapMeta | null>(null)

  // ─── Fetch data ─────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true)
      setDrillBucket(null)
      setDrillTxs([])

      try {
        if (timeframe === '1d') {
          const res = await fetch('/api/dog-rune/transactions-kv', { cache: 'no-store' })
          if (res.ok) {
            const data = await res.json()
            const txs: RedisTransaction[] = Array.isArray(data) ? data : data.transactions || []
            setRawTransactions(txs)
            const result = processRedisData(txs, layer)
            setBuckets(result.buckets)
            setMeta(result.meta)
          }
        } else {
          const res = await fetch(`/api/dog-rune/heatmap?timeframe=${timeframe}&layer=${layer}`, { cache: 'no-store' })
          if (res.ok) {
            const data = await res.json()
            setBuckets(data.buckets || [])
            setMeta(data.meta || null)
          }
        }

        if (compareMode) {
          const prevRes = await fetch(`/api/dog-rune/heatmap?timeframe=${timeframe}&layer=${layer}&compare=prev`, { cache: 'no-store' })
          if (prevRes.ok) {
            const prevData = await prevRes.json()
            setCompareBuckets(prevData.buckets || [])
            setCompareMeta(prevData.meta || null)
          }
        } else {
          setCompareBuckets([])
          setCompareMeta(null)
        }
      } catch {
        // silent fail
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [timeframe, layer, compareMode])

  // Recalculate values when layer changes for 1d (client-side data)
  useEffect(() => {
    if (timeframe === '1d' && buckets.length > 0) {
      const updated = buckets.map(b => {
        let value = 0
        switch (layer) {
          case 'count': value = b.txCount; break
          case 'fee': value = b.avgFee || 0; break
          case 'whale': value = b.whaleVolume; break
          case 'retail': value = b.retailVolume; break
          default: value = b.volume; break
        }
        return { ...b, value }
      })
      setBuckets(updated)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer])

  // ─── Drill-down handler ─────────────────────────────────────
  const handleCellClick = useCallback(async (bucket: HeatmapBucket) => {
    if (bucket.txCount === 0 && bucket.volume === 0) return // skip empty cells

    if (drillBucket?.index === bucket.index) {
      setDrillBucket(null)
      setDrillTxs([])
      return
    }
    setDrillBucket(bucket)
    setDrillLoading(true)
    try {
      if (timeframe === '1d' && rawTransactions.length > 0) {
        const now = Date.now()
        const dayAgo = now - 24 * 60 * 60 * 1000
        const BUCKET_MS = 15 * 60 * 1000
        const bucketStart = dayAgo + bucket.index * BUCKET_MS
        const bucketEnd = bucketStart + BUCKET_MS

        const matched = rawTransactions.filter(tx => {
          let ts: number
          if (typeof tx.timestamp === 'number') {
            ts = tx.timestamp < 1e12 ? tx.timestamp * 1000 : tx.timestamp
          } else {
            ts = new Date(tx.timestamp).getTime()
          }
          return ts >= bucketStart && ts < bucketEnd
        }).sort((a, b) => (b.total_dog_moved || 0) - (a.total_dog_moved || 0))

        setDrillTxs(matched.map(tx => ({
          txid: tx.txid,
          block_height: tx.block_height,
          timestamp: typeof tx.timestamp === 'number' ? new Date(tx.timestamp < 1e12 ? tx.timestamp * 1000 : tx.timestamp).toISOString() : String(tx.timestamp),
          type: 'transfer',
          total_dog_moved: tx.total_dog_moved || 0,
          net_transfer: tx.net_transfer || 0,
          fee_sats: tx.fee_sats || null,
          sender_count: tx.sender_count || 0,
          receiver_count: tx.receiver_count || 0,
        })))
      } else {
        const res = await fetch(`/api/dog-rune/heatmap?timeframe=${timeframe}&drill=${bucket.index}`)
        if (res.ok) {
          const data = await res.json()
          setDrillTxs(data.transactions || [])
        }
      }
    } catch {
      setDrillTxs([])
    } finally {
      setDrillLoading(false)
    }
  }, [timeframe, drillBucket, rawTransactions])

  // ─── Computed values ────────────────────────────────────────
  const maxValue = useMemo(() => Math.max(1, ...buckets.map(b => b.value)), [buckets])

  const handleMouseEnter = useCallback((bucket: HeatmapBucket) => setHovered(bucket), [])
  const handleMouseLeave = useCallback(() => setHovered(null), [])

  // ─── Current time slot (for pulse animation) ────────────────
  const currentBucketIdx = useMemo(() => {
    if (timeframe !== '1d' || buckets.length === 0) return -1
    const now = Date.now()
    const dayAgo = now - 24 * 60 * 60 * 1000
    return Math.min(95, Math.floor((now - dayAgo) / (15 * 60 * 1000)))
  }, [timeframe, buckets])

  // ─── Build 2D grid lookup ──────────────────────────────────
  const gridLookup = useMemo(() => {
    const lookup = new Map<string, HeatmapBucket>()
    for (const b of buckets) {
      lookup.set(`${b.row}:${b.col}`, b)
    }
    return lookup
  }, [buckets])

  const compareGridLookup = useMemo(() => {
    const lookup = new Map<string, HeatmapBucket>()
    for (const b of compareBuckets) {
      lookup.set(`${b.row}:${b.col}`, b)
    }
    return lookup
  }, [compareBuckets])

  // ─── Loading ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="rounded-xl bg-bg-surface/50 border border-border-subtle p-4 md:p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="h-5 w-44 bg-bg-elevated rounded animate-shimmer" />
          <div className="h-4 w-24 bg-bg-elevated rounded animate-shimmer" />
        </div>
        <div className="h-[100px] bg-bg-elevated rounded animate-shimmer" />
        <div className="flex gap-4 mt-4">
          <div className="h-12 flex-1 bg-bg-elevated rounded animate-shimmer" />
          <div className="h-12 flex-1 bg-bg-elevated rounded animate-shimmer" />
          <div className="h-12 flex-1 bg-bg-elevated rounded animate-shimmer" />
        </div>
      </div>
    )
  }

  const gridConfig = meta?.gridConfig || { rows: 4, cols: 24, rowLabel: 'quarter', colLabel: 'hour' }
  const rowLabels = getRowLabels(timeframe)
  const colLabels = getColLabels(timeframe)
  const { size: cellSize, gap: cellGap } = CELL_SIZES[timeframe]
  const labelWidth = 44

  // ─── Render grid — square cells with fixed pixel sizes ─────
  const renderGrid = (lookup: Map<string, HeatmapBucket>, gridMax: number, interactive: boolean = true) => {
    const gridWidth = gridConfig.cols * cellSize + (gridConfig.cols - 1) * cellGap

    return (
      <div className="overflow-x-auto">
        <div style={{ display: 'inline-block' }}>
          {/* Col labels top */}
          <div className="flex mb-1" style={{ paddingLeft: labelWidth }}>
            {colLabels.map((label, c) => (
              <div
                key={c}
                style={{ width: cellSize, marginRight: c < colLabels.length - 1 ? cellGap : 0, textAlign: 'center' }}
              >
                {label && (
                  <span className="font-mono text-[9px] text-text-tertiary leading-none">{label}</span>
                )}
              </div>
            ))}
          </div>

          {/* Grid rows */}
          {Array.from({ length: gridConfig.rows }).map((_, r) => (
            <div key={r} className="flex items-center" style={{ marginBottom: r < gridConfig.rows - 1 ? cellGap : 0 }}>
              {/* Row label */}
              <div style={{ width: labelWidth, flexShrink: 0, textAlign: 'right', paddingRight: 6 }}>
                <span className="font-mono text-[9px] text-text-tertiary">{rowLabels[r] || ''}</span>
              </div>
              {/* Cells — fixed-size squares */}
              <div className="flex" style={{ gap: cellGap }}>
                {Array.from({ length: gridConfig.cols }).map((_, c) => {
                  const bucket = lookup.get(`${r}:${c}`)
                  if (!bucket) {
                    return <div key={c} style={{ width: cellSize, height: cellSize, borderRadius: 2, backgroundColor: 'rgb(12,12,12)' }} />
                  }

                  const ratio = bucket.value / gridMax
                  const isHovered = interactive && hovered?.index === bucket.index
                  const isCurrentSlot = interactive && bucket.index === currentBucketIdx
                  const isDrilling = interactive && drillBucket?.index === bucket.index

                  return (
                    <div key={bucket.index} className="relative" style={{ width: cellSize, height: cellSize }}>
                      <div
                        className={`absolute inset-0 rounded-[2px] transition-all duration-100
                          ${interactive ? 'cursor-pointer' : 'cursor-default'}
                          ${isCurrentSlot && bucket.txCount > 0 ? 'animate-breathe' : ''}`}
                        style={{
                          backgroundColor: getColor(layer, ratio),
                          outline: isHovered ? '1.5px solid rgba(247,147,26,0.6)' : isDrilling ? '1.5px solid rgba(247,147,26,0.8)' : 'none',
                          outlineOffset: '0.5px',
                          boxShadow: bucket.hasWhale ? '0 0 6px rgba(247,147,26,0.4), inset 0 0 3px rgba(247,147,26,0.2)' : 'none',
                          border: bucket.hasWhale ? '1px solid rgba(247,147,26,0.35)' : '1px solid transparent',
                        }}
                        onMouseEnter={() => interactive && handleMouseEnter(bucket)}
                        onMouseLeave={() => interactive && handleMouseLeave()}
                        onClick={() => interactive && handleCellClick(bucket)}
                      />

                      {/* Tooltip */}
                      {isHovered && (
                        <div className={`absolute left-1/2 -translate-x-1/2 z-50 pointer-events-none ${
                          bucket.row <= Math.floor(gridConfig.rows / 2) - 1 ? 'top-full mt-1.5' : 'bottom-full mb-1.5'
                        }`}>
                          <div className="bg-black/95 border border-accent-primary/30 rounded-md px-3 py-2 shadow-bitcoin whitespace-nowrap">
                            <p className="text-text-accent font-mono text-[11px] font-semibold">{bucket.label}</p>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-text-primary font-mono text-xs font-bold">
                                {bucket.txCount} tx{bucket.txCount !== 1 ? 's' : ''}
                              </span>
                              {bucket.volume > 0 && (
                                <span className="text-text-secondary font-mono text-[11px]">
                                  {fmtVolume(bucket.volume)} DOG
                                </span>
                              )}
                            </div>
                            {bucket.hasWhale && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <Flame className="w-3 h-3 text-text-accent" />
                                <span className="text-text-accent font-mono text-[10px]">
                                  {fmtVolume(bucket.whaleVolume)} whale
                                </span>
                              </div>
                            )}
                            {bucket.avgFee !== null && bucket.avgFee > 0 && (
                              <p className="text-text-tertiary font-mono text-[10px] mt-0.5">
                                Avg fee: {bucket.avgFee.toLocaleString()} sats
                              </p>
                            )}
                            {bucket.volume > 0 && (
                              <div className="flex gap-px mt-1 h-1.5 rounded-full overflow-hidden" style={{ width: 80 }}>
                                {bucket.retailVolume > 0 && <div className="bg-green-500/60" style={{ flex: bucket.retailVolume }} />}
                                {bucket.mediumVolume > 0 && <div className="bg-yellow-500/60" style={{ flex: bucket.mediumVolume }} />}
                                {bucket.largeVolume > 0 && <div className="bg-orange-500/60" style={{ flex: bucket.largeVolume }} />}
                                {bucket.whaleVolume > 0 && <div className="bg-red-500/60" style={{ flex: bucket.whaleVolume }} />}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-bg-surface/50 backdrop-blur-sm border border-border-subtle p-4 md:p-5">
      {/* ── Header ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-text-accent" />
          <h3 className="font-sans text-sm font-semibold text-text-primary">
            Transaction Activity
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Timeframe selector */}
          <div className="flex gap-1">
            {(['1d', '7d', '30d', '1y'] as HeatmapTimeframe[]).map(tf => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2 py-1 text-[10px] font-mono uppercase tracking-wide border rounded-md transition-all
                  ${timeframe === tf
                    ? 'border-accent-primary/30 bg-accent-primary/10 text-text-accent'
                    : 'border-border-subtle bg-bg-elevated text-text-secondary hover:text-text-primary'
                  }`}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Layer toggle */}
          <div className="flex gap-1">
            {([
              { key: 'volume' as const, label: 'Vol' },
              { key: 'count' as const, label: '#' },
              { key: 'fee' as const, label: 'Fee' },
              { key: 'whale' as const, label: '🐋' },
              { key: 'retail' as const, label: 'Retail' },
            ]).map(l => (
              <button
                key={l.key}
                onClick={() => setLayer(l.key)}
                className={`px-1.5 py-1 text-[10px] font-mono border rounded-md transition-all
                  ${layer === l.key
                    ? 'border-accent-primary/30 bg-accent-primary/10 text-text-accent'
                    : 'border-border-subtle bg-bg-elevated text-text-tertiary hover:text-text-primary'
                  }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          {/* Compare toggle */}
          <button
            onClick={() => setCompareMode(!compareMode)}
            className={`p-1 border rounded-md transition-all ${
              compareMode
                ? 'border-accent-primary/30 bg-accent-primary/10 text-text-accent'
                : 'border-border-subtle bg-bg-elevated text-text-tertiary hover:text-text-primary'
            }`}
            title="Compare with previous period"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
          </button>

          {/* Export CSV */}
          <button
            onClick={() => exportCSV(buckets, timeframe)}
            className="p-1 border border-border-subtle bg-bg-elevated text-text-tertiary hover:text-text-primary rounded-md transition-all"
            title="Export CSV"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* Color legend */}
          <div className="flex items-center gap-1.5 ml-1">
            <span className="font-mono text-[10px] text-text-tertiary">Less</span>
            <div className="flex gap-px">
              {[0, 0.15, 0.35, 0.6, 1].map((v, i) => (
                <div key={i} className="w-[10px] h-[10px] rounded-[2px]" style={{ backgroundColor: getColor(layer, v) }} />
              ))}
            </div>
            <span className="font-mono text-[10px] text-text-tertiary">More</span>
          </div>
        </div>
      </div>

      {/* ── Heatmap Grid(s) ──────────────────────────────── */}
      {compareMode && compareBuckets.length > 0 ? (
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <p className="font-mono text-[10px] text-text-accent uppercase tracking-wider mb-2">Current</p>
            {renderGrid(gridLookup, maxValue)}
          </div>
          <div className="flex-1">
            <p className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider mb-2">Previous</p>
            {renderGrid(compareGridLookup, Math.max(1, ...compareBuckets.map(b => b.value)), false)}
          </div>
        </div>
      ) : (
        renderGrid(gridLookup, maxValue)
      )}

      {/* ── Drill-down Panel ─────────────────────────────── */}
      {drillBucket && (
        <div className="mt-3 border border-accent-primary/20 rounded-lg bg-bg-surface/80 p-3">
          {/* Bucket summary — always shows full stats */}
          <div className="flex items-center justify-between mb-2">
            <p className="font-mono text-xs text-text-accent font-semibold">
              {drillBucket.label}
            </p>
            <button
              onClick={() => { setDrillBucket(null); setDrillTxs([]) }}
              className="text-text-tertiary hover:text-text-primary text-xs font-mono"
            >
              ✕
            </button>
          </div>

          {/* Bucket stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            <div className="bg-bg-elevated/60 rounded px-2 py-1.5">
              <p className="font-mono text-[9px] text-text-tertiary uppercase">Transactions</p>
              <p className="font-mono text-sm font-bold text-text-primary">{drillBucket.txCount}</p>
            </div>
            <div className="bg-bg-elevated/60 rounded px-2 py-1.5">
              <p className="font-mono text-[9px] text-text-tertiary uppercase">Volume</p>
              <p className="font-mono text-sm font-bold text-text-accent">{fmtVolume(drillBucket.volume)} DOG</p>
            </div>
            <div className="bg-bg-elevated/60 rounded px-2 py-1.5">
              <p className="font-mono text-[9px] text-text-tertiary uppercase">Net Flow</p>
              <p className={`font-mono text-sm font-bold ${drillBucket.netFlow >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {drillBucket.netFlow >= 0 ? '+' : ''}{fmtVolume(drillBucket.netFlow)}
              </p>
            </div>
            <div className="bg-bg-elevated/60 rounded px-2 py-1.5">
              <p className="font-mono text-[9px] text-text-tertiary uppercase">Avg Fee</p>
              <p className="font-mono text-sm font-bold text-text-primary">
                {drillBucket.avgFee !== null ? `${Math.round(drillBucket.avgFee).toLocaleString()} sats` : '—'}
              </p>
            </div>
          </div>

          {/* Volume composition bar */}
          {drillBucket.volume > 0 && (
            <div className="mb-3">
              <p className="font-mono text-[9px] text-text-tertiary uppercase mb-1">Volume Breakdown</p>
              <div className="flex h-2 rounded-full overflow-hidden gap-px">
                {drillBucket.retailVolume > 0 && (
                  <div className="bg-green-500/70 rounded-sm" style={{ flex: drillBucket.retailVolume }} title={`Retail: ${fmtVolume(drillBucket.retailVolume)}`} />
                )}
                {drillBucket.mediumVolume > 0 && (
                  <div className="bg-yellow-500/70 rounded-sm" style={{ flex: drillBucket.mediumVolume }} title={`Medium: ${fmtVolume(drillBucket.mediumVolume)}`} />
                )}
                {drillBucket.largeVolume > 0 && (
                  <div className="bg-orange-500/70 rounded-sm" style={{ flex: drillBucket.largeVolume }} title={`Large: ${fmtVolume(drillBucket.largeVolume)}`} />
                )}
                {drillBucket.whaleVolume > 0 && (
                  <div className="bg-red-500/70 rounded-sm" style={{ flex: drillBucket.whaleVolume }} title={`Whale: ${fmtVolume(drillBucket.whaleVolume)}`} />
                )}
              </div>
              <div className="flex gap-3 mt-1">
                {drillBucket.retailVolume > 0 && <span className="font-mono text-[9px] text-green-400">Retail {fmtVolume(drillBucket.retailVolume)}</span>}
                {drillBucket.mediumVolume > 0 && <span className="font-mono text-[9px] text-yellow-400">Medium {fmtVolume(drillBucket.mediumVolume)}</span>}
                {drillBucket.largeVolume > 0 && <span className="font-mono text-[9px] text-orange-400">Large {fmtVolume(drillBucket.largeVolume)}</span>}
                {drillBucket.whaleVolume > 0 && <span className="font-mono text-[9px] text-red-400">Whale {fmtVolume(drillBucket.whaleVolume)}</span>}
              </div>
            </div>
          )}

          {/* Transaction list */}
          {drillLoading ? (
            <div className="h-16 bg-bg-elevated rounded animate-shimmer" />
          ) : drillTxs.length === 0 ? (
            <p className="text-text-tertiary font-mono text-xs">
              {drillBucket.txCount > 0 ? 'Individual transactions not available for this timeframe' : 'No transactions in this slot'}
            </p>
          ) : (
            <>
              <p className="font-mono text-[9px] text-text-tertiary uppercase mb-1">Transactions ({drillTxs.length})</p>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {drillTxs.map(tx => (
                  <div key={tx.txid} className="flex items-center gap-3 py-1 px-2 rounded bg-bg-elevated/50 font-mono text-[11px]">
                    <span className="text-text-secondary truncate w-24" title={tx.txid}>
                      {tx.txid.slice(0, 8)}…{tx.txid.slice(-6)}
                    </span>
                    <span className={`font-bold ${Number(tx.total_dog_moved) >= 1_000_000 ? 'text-text-accent' : 'text-text-primary'}`}>
                      {fmtVolume(Number(tx.total_dog_moved))} DOG
                    </span>
                    <span className="text-text-tertiary">{tx.type}</span>
                    {tx.fee_sats && (
                      <span className="text-text-tertiary">{tx.fee_sats.toLocaleString()} sats</span>
                    )}
                    <span className="text-text-tertiary ml-auto">
                      {tx.sender_count}→{tx.receiver_count}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Summary Stats ─────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3 mt-4 pt-4 border-t border-border-subtle">
        <div>
          <p className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider">Transactions</p>
          <p className="font-mono text-lg font-bold text-text-primary mt-0.5">{(meta?.totalTx || 0).toLocaleString()}</p>
        </div>
        <div>
          <p className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider">Volume</p>
          <p className="font-mono text-lg font-bold text-text-accent mt-0.5">{fmtVolume(meta?.totalVolume || 0)} DOG</p>
        </div>
        <div>
          <p className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider">Active Slots</p>
          <p className="font-mono text-lg font-bold text-text-primary mt-0.5">{(meta?.activeSlots || 0).toLocaleString()}</p>
        </div>
        <div>
          <p className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider">Peak</p>
          <p className="font-mono text-lg font-bold text-text-accent mt-0.5">
            {meta?.peakBucket ? fmtVolume(meta.peakBucket.value) : '0'}
            <span className="text-text-tertiary text-xs font-normal ml-1">@ {meta?.peakBucket?.label || '-'}</span>
          </p>
        </div>
        <div>
          <p className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider">Whale Slots</p>
          <p className="font-mono text-lg font-bold text-text-primary mt-0.5">
            {(meta?.whaleCount || 0).toLocaleString()}
            <Flame className="w-3.5 h-3.5 text-text-accent inline ml-1 -mt-0.5" />
          </p>
        </div>
        <div>
          <p className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider">Timeframe</p>
          <p className="font-mono text-lg font-bold text-text-primary mt-0.5 uppercase">{timeframe}</p>
        </div>
      </div>
    </div>
  )
}
