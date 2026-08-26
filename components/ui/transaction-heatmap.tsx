'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Activity, Copy, Check, Download, ExternalLink, Flame } from 'lucide-react'

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
  // Enriquecimento por bucket: maior tx individual e remetentes unicos.
  // Vem null quando a fonte nao fornece (RPC antiga, timeframes longos).
  peakTx: number | null
  uniqueSenders: number | null
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
  // Honestidade da agregacao: quando o orcamento de paginacao do servidor estoura,
  // truncated=true e os campos abaixo dizem o que os buckets realmente cobrem.
  // totalTxSource: 'exact' (count completo), 'estimate' (planner), 'partial' (piso).
  totalTxSource?: 'exact' | 'estimate' | 'partial'
  aggregatedTx?: number
  truncated?: boolean
  coveredFromBlock?: number
  coveredBlocks?: number
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
  type?: string
  total_dog_moved: number
  net_transfer?: number
  fee_sats?: number
  sender_count: number
  receiver_count: number
  senders?: Array<{ address: string; amount_dog: number }>
  receivers?: Array<{ address: string; amount_dog: number; is_change?: boolean }>
}

// ─── Fixed grid: 7 rows × 52 cols for ALL timeframes ──────────
const GRID_ROWS = 7
const GRID_COLS = 52
const TOTAL_CELLS = GRID_ROWS * GRID_COLS // 364

const BLOCKS_PER_CELL: Record<HeatmapTimeframe, number> = {
  '1d':  1,     // 364 blocks  ≈ 2.5 days
  '7d':  3,     // 1,092 blocks ≈ 7.6 days
  '30d': 12,    // 4,368 blocks ≈ 30 days
  '1y':  144,   // 52,416 blocks ≈ 1 year
}

const CELL_GAP = 1
const MIN_CELL_SIZE = 8
const MAX_CELL_SIZE = 56

// ─── Color: empty cell ────────────────────────────────────────
const EMPTY_CELL_COLOR = 'rgb(8,8,8)'

// ─── Color gradient (orange/bitcoin) ──────────────────────────
// Starts at a visible warm tone so even low-activity cells stand out
function interpolateColor(ratio: number): string {
  const stops = [
    [45, 32, 10],     // 0.00: warm dark brown (visible floor)
    [80, 55, 10],     // 0.25: amber-brown
    [140, 90, 10],    // 0.50: medium orange
    [200, 125, 15],   // 0.75: strong orange
    [247, 147, 26],   // 1.00: peak bitcoin orange
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
  const bpc = BLOCKS_PER_CELL['1d'] // 1

  const heights = transactions.map(tx => tx.block_height).filter(h => h > 0)
  if (heights.length === 0) {
    return {
      buckets: Array.from({ length: TOTAL_CELLS }, (_, i) => ({
        index: i,
        row: i % GRID_ROWS,
        col: Math.floor(i / GRID_ROWS),
        value: 0, txCount: 0, volume: 0, avgFee: null,
        whaleVolume: 0, hasWhale: false, retailVolume: 0,
        mediumVolume: 0, largeVolume: 0, netFlow: 0,
        peakTx: null, uniqueSenders: null,
        label: '', startBlock: 0, endBlock: 0,
      })),
      meta: {
        timeframe: '1d',
        gridConfig: { rows: GRID_ROWS, cols: GRID_COLS, blocksPerBucket: bpc },
        startBlock: 0, endBlock: 0,
        totalTx: 0, totalVolume: 0,
        peakBucket: { index: 0, value: 0, label: '' },
        whaleCount: 0, activeSlots: 0,
      },
    }
  }

  const tipBlock = Math.max(...heights)
  const totalBlocks = TOTAL_CELLS * bpc
  const startBlock = tipBlock - totalBlocks + 1

  // Pre-create ALL cells (including future/empty ones)
  const grid: HeatmapBucket[] = []
  for (let i = 0; i < TOTAL_CELLS; i++) {
    const blockStart = startBlock + i * bpc
    const blockEnd = blockStart + bpc
    grid.push({
      index: i,
      row: i % GRID_ROWS,
      col: Math.floor(i / GRID_ROWS),
      value: 0, txCount: 0, volume: 0, avgFee: null,
      whaleVolume: 0, hasWhale: false, retailVolume: 0,
      mediumVolume: 0, largeVolume: 0, netFlow: 0,
      peakTx: null, uniqueSenders: null,
      label: blockEnd - blockStart === 1
        ? `Block ${fmtBlock(blockStart)}`
        : `Blocks ${fmtBlock(blockStart)} → ${fmtBlock(blockEnd - 1)}`,
      startBlock: blockStart,
      endBlock: blockEnd,
    })
  }

  let totalTx = 0
  let totalVolume = 0
  // Remetentes unicos por bucket: os enderecos ja vem no payload do Redis,
  // contar aqui nao custa nenhuma consulta extra.
  const senderSets = new Map<number, Set<string>>()

  for (const tx of transactions) {
    const h = tx.block_height
    if (!h || h < startBlock || h > tipBlock) continue

    // Self-transfers (UTXO consolidation / change-only) move no DOG:
    // skip entirely so volume, whale flags, and tx counts reflect real movement.
    if (tx.type === 'self_transfer') continue

    const idx = Math.min(TOTAL_CELLS - 1, Math.floor((h - startBlock) / bpc))
    const b = grid[idx]
    const vol = typeof tx.net_transfer === 'number' ? tx.net_transfer : (tx.total_dog_moved || 0)
    const fee = tx.fee_sats || 0

    b.txCount++
    b.volume += vol
    b.netFlow += tx.net_transfer || 0
    if (b.peakTx === null || vol > b.peakTx) b.peakTx = vol

    if (Array.isArray(tx.senders) && tx.senders.length > 0) {
      let set = senderSets.get(idx)
      if (!set) { set = new Set(); senderSets.set(idx, set) }
      for (const s of tx.senders) {
        if (s && typeof s.address === 'string') set.add(s.address)
      }
    }

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

  for (const b of grid) {
    b.value = b.volume
  }

  senderSets.forEach((set, idx) => {
    grid[idx].uniqueSenders = set.size
  })

  const peak = grid.reduce((best, b) => b.value > best.value ? b : best, grid[0])

  return {
    buckets: grid,
    meta: {
      timeframe: '1d',
      gridConfig: { rows: GRID_ROWS, cols: GRID_COLS, blocksPerBucket: bpc },
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
  const header = 'start_block,end_block,tx_count,volume_dog,avg_fee_sats,has_whale,whale_volume,retail_volume,net_flow,peak_tx_dog,unique_senders\n'
  const rows = buckets.map(b =>
    `${b.startBlock},${b.endBlock},${b.txCount},${b.volume},${b.avgFee ?? ''},${b.hasWhale},${b.whaleVolume},${b.retailVolume},${b.netFlow},${b.peakTx ?? ''},${b.uniqueSenders ?? ''}`
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
  const [copiedTxid, setCopiedTxid] = useState<string | null>(null)
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
        const matched = rawTransactions
          .filter(tx =>
            tx.block_height >= bucket.startBlock &&
            tx.block_height < bucket.endBlock &&
            tx.type !== 'self_transfer'
          )
          .sort((a, b) => {
            const aVol = typeof a.net_transfer === 'number' ? a.net_transfer : (a.total_dog_moved || 0)
            const bVol = typeof b.net_transfer === 'number' ? b.net_transfer : (b.total_dog_moved || 0)
            return bVol - aVol
          })

        setDrillTxs(matched.map(tx => ({
          txid: tx.txid,
          block_height: tx.block_height,
          timestamp: typeof tx.timestamp === 'number'
            ? new Date(tx.timestamp < 1e12 ? tx.timestamp * 1000 : tx.timestamp).toISOString()
            : String(tx.timestamp),
          type: tx.type || 'transfer',
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

  // ─── Current block (tip): pulse animation on latest cell ───
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
    const interval = 8
    return Array.from({ length: GRID_COLS }, (_, c) => {
      if (c % interval !== 0) return ''
      const cellIdx = c * GRID_ROWS
      const bucket = buckets[cellIdx]
      if (!bucket) return ''
      return fmtBlock(bucket.startBlock)
    })
  }, [meta, buckets])

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

  // Compute cell height only; width is handled by flex layout (flex: 1)
  const availableForCells = containerWidth - (GRID_COLS - 1) * CELL_GAP
  const cellSize = containerWidth > 0
    ? Math.max(4, Math.min(MAX_CELL_SIZE, Math.floor(availableForCells / GRID_COLS)))
    : 14

  const cellRadius = Math.max(1, Math.round(cellSize * 0.15))

  return (
    <div ref={gridContainerRef} className="rounded-xl bg-bg-surface/50 backdrop-blur-sm border border-border-subtle p-4 md:p-6">

      {/* ── Header ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <Activity className="w-4 h-4 text-text-accent" />
          <h3 className="font-sans text-sm font-semibold text-text-primary">
            Block Activity
          </h3>
        </div>

        <div className="flex gap-1">
          {(['1d', '7d', '30d', '1y'] as HeatmapTimeframe[]).map(tf => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-2.5 py-1 text-[10px] font-mono uppercase tracking-wide border rounded-md transition-all
                ${timeframe === tf
                  ? 'border-accent-primary/30 bg-accent-primary/10 text-text-accent'
                  : 'border-border-subtle bg-bg-elevated text-text-secondary hover:text-text-primary'
                }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* ── Summary Stats (compact row above grid) ────────── */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 mb-5">
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider">Txs</span>
          <span className="font-mono text-sm font-bold text-text-primary">
            {meta?.truncated && meta?.totalTxSource === 'estimate' && '≈'}
            {meta?.truncated && meta?.totalTxSource === 'partial' && '≥'}
            {(meta?.totalTx || 0).toLocaleString()}
          </span>
          {/* Selo de honestidade: agregacao truncada pelo orcamento do servidor */}
          {meta?.truncated && (
            <span
              className="font-mono text-[9px] uppercase tracking-wider text-text-accent border border-accent-primary/30 bg-accent-primary/10 rounded px-1 py-px cursor-help"
              title={`${
                meta.totalTxSource === 'exact' ? 'Exact total.'
                : meta.totalTxSource === 'estimate' ? 'Approximate total.'
                : 'Total is a floor.'
              } Cells cover the most recent ${(meta.aggregatedTx || 0).toLocaleString()} txs, from block #${(meta.coveredFromBlock || meta.startBlock).toLocaleString()} onward. Older cells are not painted.`}
            >
              partial grid
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider">Vol</span>
          <span className="font-mono text-sm font-bold text-text-accent">{fmtVolume(meta?.totalVolume || 0)} DOG</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider">Active</span>
          <span className="font-mono text-sm font-bold text-text-primary">{meta?.activeSlots || 0}<span className="text-text-tertiary font-normal">/{TOTAL_CELLS}</span></span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <Flame className="w-3 h-3 text-text-accent" />
          <span className="font-mono text-sm font-bold text-text-primary">{meta?.whaleCount || 0}</span>
        </div>
        {meta && (
          <span className="font-mono text-[10px] text-text-tertiary ml-auto hidden sm:inline">
            {fmtBlock(meta.startBlock)} → {fmtBlock(meta.endBlock - 1)}
          </span>
        )}
      </div>

      {/* ── Heatmap Grid (full width) ───────────────────────── */}
      <div className="w-full overflow-hidden">
        {/* Col labels (block heights) */}
        <div className="flex mb-1" style={{ gap: CELL_GAP }}>
          {colLabels.map((label, c) => (
            <div
              key={c}
              style={{ flex: 1, minWidth: 0, textAlign: 'center', overflow: 'hidden' }}
            >
              {label && (
                <span className="font-mono text-[8px] text-text-tertiary leading-none whitespace-nowrap">{label}</span>
              )}
            </div>
          ))}
        </div>

        {/* Grid rows */}
        {Array.from({ length: GRID_ROWS }).map((_, r) => (
          <div key={r} className="flex" style={{ gap: CELL_GAP, marginBottom: r < GRID_ROWS - 1 ? CELL_GAP : 0 }}>
            {Array.from({ length: GRID_COLS }).map((_, c) => {
              const bucket = gridLookup.get(`${r}:${c}`)
              if (!bucket) {
                return <div key={c} style={{ flex: 1, height: cellSize, borderRadius: cellRadius, backgroundColor: EMPTY_CELL_COLOR }} />
              }

              const hasActivity = bucket.txCount > 0
              const rawRatio = bucket.value / maxValue
              const isHovered = hovered?.index === bucket.index
              const isCurrentSlot = bucket.index === currentBucketIdx
              const isDrilling = drillBucket?.index === bucket.index

              // Empty cells stay dark; active cells get a visible floor
              const cellColor = hasActivity
                ? interpolateColor(Math.max(0.08, rawRatio))
                : EMPTY_CELL_COLOR

              return (
                <div
                  key={bucket.index}
                  className="relative"
                  style={{ flex: 1, height: cellSize }}
                >
                  <div
                    className={`absolute inset-0 transition-all duration-100 cursor-pointer
                      ${isCurrentSlot && hasActivity ? 'animate-breathe' : ''}`}
                    style={{
                      borderRadius: cellRadius,
                      backgroundColor: cellColor,
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
                      bucket.row <= Math.floor(GRID_ROWS / 2) - 1 ? 'top-full mt-1.5' : 'bottom-full mb-1.5'
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
                        {/* Enriquecimento: pico e remetentes unicos, quando a fonte fornece */}
                        {(() => {
                          const bits: string[] = []
                          if (bucket.peakTx != null && bucket.peakTx > 0 && bucket.txCount > 1) {
                            bits.push(`Peak ${fmtVolume(bucket.peakTx)} DOG`)
                          }
                          if (bucket.uniqueSenders != null && bucket.uniqueSenders > 0) {
                            bits.push(`${bucket.uniqueSenders} sender${bucket.uniqueSenders !== 1 ? 's' : ''}`)
                          }
                          return bits.length > 0 ? (
                            <p className="text-text-tertiary font-mono text-[10px] mt-0.5">
                              {bits.join(' · ')}
                            </p>
                          ) : null
                        })()}
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
        ))}

        {/* ── Grid footer: legend + export ───────────────── */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-[9px] h-[9px] rounded-[2px]" style={{ backgroundColor: EMPTY_CELL_COLOR }} />
            <span className="font-mono text-[9px] text-text-tertiary mx-0.5">0</span>
            <div className="flex gap-px">
              {[0, 0.25, 0.5, 0.75, 1].map((v, i) => (
                <div key={i} className="w-[9px] h-[9px] rounded-[2px]" style={{ backgroundColor: interpolateColor(v) }} />
              ))}
            </div>
            <span className="font-mono text-[9px] text-text-tertiary">Max</span>
          </div>
          <button
            onClick={() => exportCSV(buckets, timeframe)}
            className="flex items-center gap-1 text-text-tertiary hover:text-text-primary transition-colors"
            title="Export CSV"
          >
            <Download className="w-3 h-3" />
            <span className="font-mono text-[9px]">CSV</span>
          </button>
        </div>
      </div>

      {/* ── Drill-down Panel ─────────────────────────────── */}
      {drillBucket && (
        <div className="mt-4 border border-accent-primary/20 rounded-lg bg-bg-surface/80 p-3">
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
                {drillBucket.avgFee !== null ? `${Math.round(drillBucket.avgFee).toLocaleString()} sats` : 'n/a'}
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
                  <div key={tx.txid} className="flex items-center gap-2 py-1.5 px-2 rounded bg-bg-elevated/50 font-mono text-[11px] group">
                    {/* Txid + ações */}
                    <Link
                      href={`/transactions?txid=${tx.txid}`}
                      className="flex items-center gap-1 text-text-accent hover:text-text-primary transition-colors min-w-0 shrink-0"
                      title={tx.txid}
                    >
                      <span className="truncate">{tx.txid.slice(0, 8)}…{tx.txid.slice(-6)}</span>
                      <ExternalLink className="w-2.5 h-2.5 opacity-60 shrink-0" />
                    </Link>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(tx.txid)
                        setCopiedTxid(tx.txid)
                        setTimeout(() => setCopiedTxid(null), 2000)
                      }}
                      className="shrink-0 text-text-tertiary hover:text-text-primary transition-colors"
                      title="Copiar txid"
                    >
                      {copiedTxid === tx.txid
                        ? <Check className="w-2.5 h-2.5 text-green-400" />
                        : <Copy className="w-2.5 h-2.5" />
                      }
                    </button>

                    {/* Dados: usar net_transfer (DOG real movido, exclui change/self) */}
                    {(() => {
                      const realMoved = typeof tx.net_transfer === 'number' ? tx.net_transfer : (tx.total_dog_moved || 0)
                      return (
                        <span className={`font-bold ml-1 ${realMoved >= 1_000_000 ? 'text-text-accent' : 'text-text-primary'}`}>
                          {fmtVolume(realMoved)} DOG
                        </span>
                      )
                    })()}
                    <span className="text-text-tertiary text-[10px]">
                      {fmtBlock(tx.block_height)}
                    </span>
                    {tx.fee_sats && (
                      <span className="text-text-tertiary hidden sm:inline">{tx.fee_sats.toLocaleString()} sats</span>
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
    </div>
  )
}
