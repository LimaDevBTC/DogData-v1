'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Activity, Download, Flame } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────
type HeatmapTimeframe = '1d' | '7d' | '30d' | '1y'

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
  startBlock: number
  endBlock: number
}

interface HeatmapMeta {
  timeframe: string
  gridConfig: { rows: number; cols: number; blocksPerBucket: number }
  startBlock: number
  endBlock: number
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

// ─── Block-based grid configs ─────────────────────────────────
const BLOCK_GRIDS: Record<HeatmapTimeframe, { blocksPerBucket: number; rows: number; cols: number }> = {
  '1d':  { blocksPerBucket: 1,   rows: 3,  cols: 48 },  // 144 blocks
  '7d':  { blocksPerBucket: 3,   rows: 7,  cols: 48 },  // 1,008 blocks
  '30d': { blocksPerBucket: 10,  rows: 9,  cols: 48 },  // 4,320 blocks
  '1y':  { blocksPerBucket: 144, rows: 7,  cols: 52 },  // 52,416 blocks
}

const CELL_GAPS: Record<HeatmapTimeframe, number> = {
  '1d':  2,
  '7d':  2,
  '30d': 1,
  '1y':  1,
}

const MIN_CELL_SIZE = 8
const MAX_CELL_SIZE = 56

// ─── Color gradient (orange/bitcoin) ──────────────────────────
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

// ─── Compact number format ────────────────────────────────────
function fmtVolume(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`
  return v.toFixed(0)
}

function fmtBlock(height: number): string {
  return `#${height.toLocaleString()}`
}

// ─── Process Redis data into block-based heatmap (1d) ─────────
function processRedisData(transactions: RedisTransaction[]): { buckets: HeatmapBucket[]; meta: HeatmapMeta } {
  const config = BLOCK_GRIDS['1d']
  const totalBuckets = config.rows * config.cols // 144

  const heights = transactions.map(tx => tx.block_height).filter(h => h > 0)
  if (heights.length === 0) {
    return {
      buckets: Array.from({ length: totalBuckets }, (_, i) => ({
        index: i,
        row: i % config.rows,
        col: Math.floor(i / config.rows),
        value: 0, txCount: 0, volume: 0, avgFee: null,
        whaleVolume: 0, hasWhale: false, retailVolume: 0,
        mediumVolume: 0, largeVolume: 0, netFlow: 0,
        label: '', startBlock: 0, endBlock: 0,
      })),
      meta: {
        timeframe: '1d', gridConfig: config,
        startBlock: 0, endBlock: 0,
        totalTx: 0, totalVolume: 0,
        peakBucket: { index: 0, value: 0, label: '' },
        whaleCount: 0, activeSlots: 0,
      },
    }
  }

  const tipBlock = Math.max(...heights)
  const startBlock = tipBlock - totalBuckets + 1

  const grid: HeatmapBucket[] = []
  for (let i = 0; i < totalBuckets; i++) {
    const blockStart = startBlock + i * config.blocksPerBucket
    const blockEnd = blockStart + config.blocksPerBucket
    grid.push({
      index: i,
      row: i % config.rows,
      col: Math.floor(i / config.rows),
      value: 0, txCount: 0, volume: 0, avgFee: null,
      whaleVolume: 0, hasWhale: false, retailVolume: 0,
      mediumVolume: 0, largeVolume: 0, netFlow: 0,
      label: `Block ${fmtBlock(blockStart)}`,
      startBlock: blockStart,
      endBlock: blockEnd,
    })
  }

  let totalTx = 0
  let totalVolume = 0

  for (const tx of transactions) {
    const h = tx.block_height
    if (!h || h < startBlock || h > tipBlock) continue

    const idx = Math.min(totalBuckets - 1, Math.floor((h - startBlock) / config.blocksPerBucket))
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

  // Value = volume for all buckets
  for (const b of grid) {
    b.value = b.volume
  }

  const peak = grid.reduce((best, b) => b.value > best.value ? b : best, grid[0])

  return {
    buckets: grid,
    meta: {
      timeframe: '1d',
      gridConfig: config,
      startBlock,
      endBlock: tipBlock + 1,
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
  const header = 'start_block,end_block,tx_count,volume_dog,avg_fee_sats,has_whale,whale_volume,retail_volume,net_flow\n'
  const rows = buckets.map(b =>
    `${b.startBlock},${b.endBlock},${b.txCount},${b.volume},${b.avgFee ?? ''},${b.hasWhale},${b.whaleVolume},${b.retailVolume},${b.netFlow}`
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
  const [buckets, setBuckets] = useState<HeatmapBucket[]>([])
  const [meta, setMeta] = useState<HeatmapMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [hovered, setHovered] = useState<HeatmapBucket | null>(null)
  const [drillBucket, setDrillBucket] = useState<HeatmapBucket | null>(null)
  const [drillTxs, setDrillTxs] = useState<DrillTransaction[]>([])
  const [drillLoading, setDrillLoading] = useState(false)
  const [rawTransactions, setRawTransactions] = useState<RedisTransaction[]>([])
  const gridContainerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  // ─── Measure container width ────────────────────────────────
  useEffect(() => {
    const el = gridContainerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

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
            const result = processRedisData(txs)
            setBuckets(result.buckets)
            setMeta(result.meta)
          }
        } else {
          const res = await fetch(`/api/dog-rune/heatmap?timeframe=${timeframe}`, { cache: 'no-store' })
          if (res.ok) {
            const data = await res.json()
            setBuckets(data.buckets || [])
            setMeta(data.meta || null)
          }
        }
      } catch {
        // silent fail
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [timeframe])

  // ─── Drill-down handler ─────────────────────────────────────
  const handleCellClick = useCallback(async (bucket: HeatmapBucket) => {
    if (bucket.txCount === 0 && bucket.volume === 0) return

    if (drillBucket?.index === bucket.index) {
      setDrillBucket(null)
      setDrillTxs([])
      return
    }
    setDrillBucket(bucket)
    setDrillLoading(true)
    try {
      if (timeframe === '1d' && rawTransactions.length > 0) {
        const matched = rawTransactions.filter(tx =>
          tx.block_height >= bucket.startBlock && tx.block_height < bucket.endBlock
        ).sort((a, b) => (b.total_dog_moved || 0) - (a.total_dog_moved || 0))

        setDrillTxs(matched.map(tx => ({
          txid: tx.txid,
          block_height: tx.block_height,
          timestamp: typeof tx.timestamp === 'number'
            ? new Date(tx.timestamp < 1e12 ? tx.timestamp * 1000 : tx.timestamp).toISOString()
            : String(tx.timestamp),
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

  // ─── Current block (tip) — pulse animation on latest cell ───
  const currentBucketIdx = useMemo(() => {
    if (buckets.length === 0 || !meta) return -1
    // Last non-empty bucket is the "current" one
    for (let i = buckets.length - 1; i >= 0; i--) {
      if (buckets[i].txCount > 0) return i
    }
    return -1
  }, [buckets, meta])

  // ─── Build 2D grid lookup ──────────────────────────────────
  const gridLookup = useMemo(() => {
    const lookup = new Map<string, HeatmapBucket>()
    for (const b of buckets) {
      lookup.set(`${b.row}:${b.col}`, b)
    }
    return lookup
  }, [buckets])

  // ─── Column labels (block heights) ─────────────────────────
  const colLabels = useMemo(() => {
    if (!meta || buckets.length === 0) return []
    const config = BLOCK_GRIDS[timeframe]
    const interval = timeframe === '1y' ? 8 : 6
    return Array.from({ length: config.cols }, (_, c) => {
      if (c % interval !== 0) return ''
      const cellIdx = c * config.rows
      const bucket = buckets[cellIdx]
      if (!bucket) return ''
      return fmtBlock(bucket.startBlock)
    })
  }, [meta, buckets, timeframe])

  // ─── Loading ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="rounded-xl bg-bg-surface/50 border border-border-subtle p-4 md:p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="h-5 w-44 bg-bg-elevated rounded animate-shimmer" />
          <div className="h-4 w-24 bg-bg-elevated rounded animate-shimmer" />
        </div>
        <div className="h-[200px] md:h-[280px] bg-bg-elevated rounded animate-shimmer" />
        <div className="flex gap-4 mt-4">
          <div className="h-12 flex-1 bg-bg-elevated rounded animate-shimmer" />
          <div className="h-12 flex-1 bg-bg-elevated rounded animate-shimmer" />
          <div className="h-12 flex-1 bg-bg-elevated rounded animate-shimmer" />
        </div>
      </div>
    )
  }

  const gridConfig = meta?.gridConfig || BLOCK_GRIDS[timeframe]
  const cellGap = CELL_GAPS[timeframe]
  const labelWidth = 0 // no row labels needed for block-based grid

  // Compute cell size to fill available width
  const availableForCells = containerWidth - (gridConfig.cols - 1) * cellGap
  const cellSize = containerWidth > 0
    ? Math.max(MIN_CELL_SIZE, Math.min(MAX_CELL_SIZE, Math.floor(availableForCells / gridConfig.cols)))
    : 14

  const cellRadius = Math.max(2, Math.round(cellSize * 0.08))

  return (
    <div ref={gridContainerRef} className="rounded-xl bg-bg-surface/50 backdrop-blur-sm border border-border-subtle p-4 md:p-5">
      {/* ── Header ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-text-accent" />
          <h3 className="font-sans text-sm font-semibold text-text-primary">
            Block Activity
          </h3>
          {meta && (
            <span className="font-mono text-[10px] text-text-tertiary">
              {fmtBlock(meta.startBlock)} → {fmtBlock(meta.endBlock - 1)}
            </span>
          )}
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
                <div key={i} className="w-[10px] h-[10px] rounded-[2px]" style={{ backgroundColor: interpolateColor(v) }} />
              ))}
            </div>
            <span className="font-mono text-[10px] text-text-tertiary">More</span>
          </div>
        </div>
      </div>

      {/* ── Heatmap Grid ──────────────────────────────────── */}
      <div className="overflow-x-auto">
        <div>
          {/* Col labels (block heights) */}
          <div className="flex mb-1">
            {colLabels.map((label, c) => (
              <div
                key={c}
                style={{ width: cellSize, marginRight: c < colLabels.length - 1 ? cellGap : 0, textAlign: 'center' }}
              >
                {label && (
                  <span className="font-mono text-[8px] text-text-tertiary leading-none whitespace-nowrap">{label}</span>
                )}
              </div>
            ))}
          </div>

          {/* Grid rows */}
          {Array.from({ length: gridConfig.rows }).map((_, r) => (
            <div key={r} className="flex items-center" style={{ marginBottom: r < gridConfig.rows - 1 ? cellGap : 0 }}>
              <div className="flex" style={{ gap: cellGap }}>
                {Array.from({ length: gridConfig.cols }).map((_, c) => {
                  const bucket = gridLookup.get(`${r}:${c}`)
                  if (!bucket) {
                    return <div key={c} style={{ width: cellSize, height: cellSize, borderRadius: cellRadius, backgroundColor: 'rgb(12,12,12)' }} />
                  }

                  const ratio = bucket.value / maxValue
                  const isHovered = hovered?.index === bucket.index
                  const isCurrentSlot = bucket.index === currentBucketIdx
                  const isDrilling = drillBucket?.index === bucket.index

                  return (
                    <div key={bucket.index} className="relative" style={{ width: cellSize, height: cellSize }}>
                      <div
                        className={`absolute inset-0 transition-all duration-100 cursor-pointer
                          ${isCurrentSlot && bucket.txCount > 0 ? 'animate-breathe' : ''}`}
                        style={{
                          borderRadius: cellRadius,
                          backgroundColor: interpolateColor(ratio),
                          outline: isHovered ? '1.5px solid rgba(247,147,26,0.6)' : isDrilling ? '1.5px solid rgba(247,147,26,0.8)' : 'none',
                          outlineOffset: '0.5px',
                          boxShadow: bucket.hasWhale ? '0 0 6px rgba(247,147,26,0.4), inset 0 0 3px rgba(247,147,26,0.2)' : 'none',
                          border: bucket.hasWhale ? '1px solid rgba(247,147,26,0.35)' : '1px solid transparent',
                        }}
                        onMouseEnter={() => handleMouseEnter(bucket)}
                        onMouseLeave={() => handleMouseLeave()}
                        onClick={() => handleCellClick(bucket)}
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

      {/* ── Drill-down Panel ─────────────────────────────── */}
      {drillBucket && (
        <div className="mt-3 border border-accent-primary/20 rounded-lg bg-bg-surface/80 p-3">
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

          {drillLoading ? (
            <div className="h-16 bg-bg-elevated rounded animate-shimmer" />
          ) : drillTxs.length === 0 ? (
            <p className="text-text-tertiary font-mono text-xs">
              {drillBucket.txCount > 0 ? 'Individual transactions not available for this timeframe' : 'No transactions in this block'}
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
                    <span className="text-text-tertiary text-[10px]">
                      {fmtBlock(tx.block_height)}
                    </span>
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4 pt-4 border-t border-border-subtle">
        <div>
          <p className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider">Transactions</p>
          <p className="font-mono text-lg font-bold text-text-primary mt-0.5">{(meta?.totalTx || 0).toLocaleString()}</p>
        </div>
        <div>
          <p className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider">Volume</p>
          <p className="font-mono text-lg font-bold text-text-accent mt-0.5">{fmtVolume(meta?.totalVolume || 0)} DOG</p>
        </div>
        <div>
          <p className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider">Active Blocks</p>
          <p className="font-mono text-lg font-bold text-text-primary mt-0.5">{(meta?.activeSlots || 0).toLocaleString()}</p>
        </div>
        <div>
          <p className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider">Peak</p>
          <p className="font-mono text-lg font-bold text-text-accent mt-0.5">
            {meta?.peakBucket ? fmtVolume(meta.peakBucket.value) : '0'}
          </p>
        </div>
        <div>
          <p className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider">Whale Blocks</p>
          <p className="font-mono text-lg font-bold text-text-primary mt-0.5">
            {(meta?.whaleCount || 0).toLocaleString()}
            <Flame className="w-3.5 h-3.5 text-text-accent inline ml-1 -mt-0.5" />
          </p>
        </div>
      </div>
    </div>
  )
}
