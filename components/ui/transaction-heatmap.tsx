'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Activity } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────
interface Transaction {
  txid: string
  block_height: number
  timestamp: string | number
  total_dog_moved: number
  sender_count: number
  receiver_count: number
}

interface Bucket {
  index: number
  hour: number
  quarter: number
  txCount: number
  volume: number
  timeLabel: string
  startTime: number
}

// ─── Color: black → dim amber → warm orange → vivid bitcoin orange ──
function interpolateColor(ratio: number): string {
  // 0.0 = empty (near-black)
  // 0.15 = barely there (very dim warm tint)
  // 0.4 = low activity (muted amber/yellow)
  // 0.7 = medium (warm orange)
  // 1.0 = peak (vivid bitcoin orange, almost glowing)
  const stops = [
    [12, 12, 12],       // 0.00 — near-black (empty)
    [30, 25, 10],       // 0.15 — faintest warm hint
    [80, 60, 10],       // 0.35 — dim amber/yellow
    [180, 110, 10],     // 0.60 — warm orange
    [247, 147, 26],     // 1.00 — vivid bitcoin orange
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

// ─── Component ────────────────────────────────────────────────
export function TransactionHeatmap() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [hovered, setHovered] = useState<Bucket | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/dog-rune/transactions-kv', { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          setTransactions(Array.isArray(data) ? data : data.transactions || [])
        }
      } catch {
        // silent fail
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // ─── Process into 96 buckets (24h × 4 quarters) ──────────
  const { buckets, maxCount, totalTx, totalVolume, peakBucket, activeBlocks } = useMemo(() => {
    const now = Date.now()
    const dayAgo = now - 24 * 60 * 60 * 1000
    const BUCKET_MS = 15 * 60 * 1000

    // Init 96 buckets
    const grid: Bucket[] = []
    for (let i = 0; i < 96; i++) {
      const bucketStart = dayAgo + i * BUCKET_MS
      const d = new Date(bucketStart)
      grid.push({
        index: i,
        hour: Math.floor(i / 4),
        quarter: i % 4,
        txCount: 0,
        volume: 0,
        timeLabel: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
        startTime: bucketStart,
      })
    }

    let total = 0
    let vol = 0
    const blocks = new Set<number>()

    for (const tx of transactions) {
      let ts: number
      if (typeof tx.timestamp === 'number') {
        ts = tx.timestamp < 1e12 ? tx.timestamp * 1000 : tx.timestamp
      } else {
        ts = new Date(tx.timestamp).getTime()
      }
      if (isNaN(ts) || ts < dayAgo || ts > now) continue

      const idx = Math.min(95, Math.floor((ts - dayAgo) / BUCKET_MS))
      grid[idx].txCount++
      grid[idx].volume += tx.total_dog_moved || 0
      total++
      vol += tx.total_dog_moved || 0
      if (tx.block_height) blocks.add(tx.block_height)
    }

    const peak = grid.reduce((best, b) => b.txCount > best.txCount ? b : best, grid[0])
    const mc = Math.max(1, ...grid.map(b => b.txCount))

    return { buckets: grid, maxCount: mc, totalTx: total, totalVolume: vol, peakBucket: peak, activeBlocks: blocks.size }
  }, [transactions])

  const handleMouseEnter = useCallback((bucket: Bucket) => {
    setHovered(bucket)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setHovered(null)
  }, [])

  // ─── Loading ──────────────────────────────────────────────
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

  // Quarter-row labels
  const qLabels = [':00', ':15', ':30', ':45']

  return (
    <div className="rounded-xl bg-bg-surface/50 backdrop-blur-sm border border-border-subtle p-4 md:p-5">
      {/* ── Header ────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-text-accent" />
          <h3 className="font-sans text-sm font-semibold text-text-primary">
            24h Transaction Activity
          </h3>
          <span className="font-mono text-[10px] text-text-tertiary bg-bg-elevated px-1.5 py-0.5 rounded">
            15min intervals
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] text-text-tertiary">Less</span>
          <div className="flex gap-px">
            {[0, 0.15, 0.35, 0.6, 1].map((v, i) => (
              <div key={i} className="w-[10px] h-[10px] rounded-[2px]" style={{ backgroundColor: interpolateColor(v) }} />
            ))}
          </div>
          <span className="font-mono text-[10px] text-text-tertiary">More</span>
        </div>
      </div>

      {/* ── Heatmap Grid ──────────────────────────────────── */}
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Hour labels top */}
          <div className="flex mb-1" style={{ paddingLeft: 28 }}>
            {Array.from({ length: 24 }).map((_, h) => (
              <div key={h} className="flex-1 text-center">
                {h % 3 === 0 && (
                  <span className="font-mono text-[9px] text-text-tertiary leading-none">
                    {(() => {
                      const d = new Date(Date.now() - 24 * 60 * 60 * 1000 + h * 60 * 60 * 1000)
                      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
                    })()}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Grid rows */}
          {[0, 1, 2, 3].map(q => (
            <div key={q} className="flex items-center gap-0 mb-[2px]">
              {/* Quarter label */}
              <div className="w-7 flex-shrink-0 text-right pr-1.5">
                <span className="font-mono text-[9px] text-text-tertiary">{qLabels[q]}</span>
              </div>
              {/* Cells row */}
              <div className="flex-1 flex gap-[2px]">
                {buckets.filter(b => b.quarter === q).map(bucket => {
                  const ratio = bucket.txCount / maxCount
                  const isHovered = hovered?.index === bucket.index
                  return (
                    <div
                      key={bucket.index}
                      className="flex-1 relative"
                      style={{ aspectRatio: '1' }}
                    >
                      <div
                        className="absolute inset-0 rounded-[2px] cursor-default transition-all duration-100"
                        style={{
                          backgroundColor: interpolateColor(ratio),
                          outline: isHovered ? '1.5px solid rgba(247,147,26,0.6)' : 'none',
                          outlineOffset: '0.5px',
                        }}
                        onMouseEnter={() => handleMouseEnter(bucket)}
                        onMouseLeave={handleMouseLeave}
                      />
                      {/* Tooltip — below for top rows, above for bottom rows */}
                      {isHovered && (
                        <div className={`absolute left-1/2 -translate-x-1/2 z-50 pointer-events-none ${
                          bucket.quarter <= 1 ? 'top-full mt-1.5' : 'bottom-full mb-1.5'
                        }`}>
                          <div className="bg-black/95 border border-accent-primary/30 rounded-md px-3 py-2 shadow-bitcoin whitespace-nowrap">
                            <p className="text-text-accent font-mono text-[11px] font-semibold">{bucket.timeLabel}</p>
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

      {/* ── Summary Stats ─────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-border-subtle">
        <div>
          <p className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider">Transactions</p>
          <p className="font-mono text-lg font-bold text-text-primary mt-0.5">{totalTx.toLocaleString()}</p>
        </div>
        <div>
          <p className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider">Volume</p>
          <p className="font-mono text-lg font-bold text-text-accent mt-0.5">{fmtVolume(totalVolume)} DOG</p>
        </div>
        <div>
          <p className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider">Blocks</p>
          <p className="font-mono text-lg font-bold text-text-primary mt-0.5">{activeBlocks.toLocaleString()}</p>
        </div>
        <div>
          <p className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider">Peak</p>
          <p className="font-mono text-lg font-bold text-text-accent mt-0.5">
            {peakBucket.txCount} tx
            <span className="text-text-tertiary text-xs font-normal ml-1">@ {peakBucket.timeLabel}</span>
          </p>
        </div>
      </div>

    </div>
  )
}
