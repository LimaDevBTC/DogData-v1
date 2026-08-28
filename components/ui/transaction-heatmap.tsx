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
// Fora da grade conhecida (célula sem balde nenhum).
const EMPTY_CELL_COLOR = 'rgb(8,8,8)'
// ⚠️ BLOCO SEM DOG NÃO É BURACO. A grade é uma fita contínua de blocos, e um
// bloco que o nó leu e não tinha transação de DOG é um FATO, não ausência de
// dado. Pintado no mesmo preto do fundo, ele lia como falha do painel; com
// este piso, a fita nunca se rompe e o vazio ainda é o tom mais apagado dela.
const NO_ACTIVITY_COLOR = 'rgb(26,20,16)'

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

// A bucketização do 1d vivia AQUI, em cima do cache das 500 transações mais
// recentes, e era a origem do buraco de todo dia (ver o comentário no load()).
// Quem monta a grade agora é /api/dog-rune/heatmap, para os quatro recortes.

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
        // ⚠️ O BURACO DE TODO DIA ERA ESTA LINHA. O recorte de 1d se montava a
        // partir do cache Redis das 500 transações mais recentes, e 500
        // transações cobrem ~165 dos 364 blocos da grade: os outros 200 ficavam
        // pretos, não porque nada aconteceu ali, mas porque o cliente nunca
        // teve o dado. Medido em 28/08: nos últimos 364 blocos existem 1.104
        // transações de DOG em 278 blocos distintos, e a rota devolve a grade
        // inteira. Agora 1d lê a mesma rota que 7d, 30d e 1y.
        const res = await fetch(`/api/dog-rune/heatmap?timeframe=${timeframe}`, { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          setBuckets(data.buckets || [])
          setMeta(data.meta || null)
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
const res = await fetch(`/api/dog-rune/heatmap?timeframe=${timeframe}&drill=${bucket.index}`)
      if (res.ok) {
        const data = await res.json()
        setDrillTxs(data.transactions || [])
      }
    } catch {
      setDrillTxs([])
    } finally {
      setDrillLoading(false)
    }
  }, [timeframe, drillBucket])

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

              // Ativo: piso visível. Sem DOG naquele bloco: o tom apagado da
              // fita, que ainda diz "este bloco existe e foi lido".
              const cellColor = hasActivity
                ? interpolateColor(Math.max(0.08, rawRatio))
                : NO_ACTIVITY_COLOR

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
