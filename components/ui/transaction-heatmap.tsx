'use client'

import { useState, useEffect, useMemo } from 'react'

interface BucketData {
  hour: number
  quarter: number
  value: number
  label: string
}

function interpolateColor(ratio: number): string {
  const stops = [
    { r: 15, g: 15, b: 15 },
    { r: 50, g: 35, b: 10 },
    { r: 180, g: 90, b: 0 },
    { r: 247, g: 147, b: 26 },
  ]
  const clamped = Math.max(0, Math.min(1, ratio))
  const segment = clamped * (stops.length - 1)
  const idx = Math.min(Math.floor(segment), stops.length - 2)
  const t = segment - idx
  const from = stops[idx]
  const to = stops[idx + 1]
  return `rgb(${Math.round(from.r + (to.r - from.r) * t)}, ${Math.round(from.g + (to.g - from.g) * t)}, ${Math.round(from.b + (to.b - from.b) * t)})`
}

export function TransactionHeatmap() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredCell, setHoveredCell] = useState<BucketData | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/dog-rune/transactions-kv', { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          const txList = Array.isArray(data) ? data : data.transactions || []
          setTransactions(txList)
        }
      } catch (err) {
        console.error('Failed to fetch transaction data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const { buckets, maxVal } = useMemo(() => {
    const now = Date.now()
    const dayAgo = now - 24 * 60 * 60 * 1000

    // Initialize 96 buckets (24h x 4 quarters)
    const grid: BucketData[] = []
    for (let h = 0; h < 24; h++) {
      for (let q = 0; q < 4; q++) {
        const bucketTime = new Date(dayAgo + (h * 60 + q * 15) * 60 * 1000)
        const hourStr = bucketTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
        grid.push({ hour: h, quarter: q, value: 0, label: hourStr })
      }
    }

    // Count transactions per bucket
    for (const tx of transactions) {
      const ts = tx.timestamp
        ? (typeof tx.timestamp === 'string' ? new Date(tx.timestamp).getTime() : tx.timestamp * (tx.timestamp < 1e12 ? 1000 : 1))
        : 0
      if (ts < dayAgo || ts > now) continue

      const elapsed = ts - dayAgo
      const bucketIdx = Math.min(95, Math.floor(elapsed / (15 * 60 * 1000)))
      if (bucketIdx >= 0 && bucketIdx < 96) {
        grid[bucketIdx].value++
      }
    }

    const max = Math.max(1, ...grid.map(b => b.value))
    return { buckets: grid, maxVal: max }
  }, [transactions])

  if (loading) {
    return (
      <div className="p-4 rounded-xl bg-bg-surface/50 border border-border-subtle">
        <div className="h-4 w-32 bg-bg-elevated rounded animate-shimmer mb-3" />
        <div className="h-[72px] bg-bg-elevated rounded animate-shimmer" />
      </div>
    )
  }

  const cellSize = 10
  const gap = 2
  const step = cellSize + gap
  const cols = 24
  const rows = 4

  // Show hour labels every 3 hours
  const hourLabels = [0, 3, 6, 9, 12, 15, 18, 21]

  return (
    <div className="p-4 rounded-xl bg-bg-surface/50 backdrop-blur-sm border border-border-subtle">
      {/* Header row: title + legend — tight */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-sans text-sm font-semibold text-text-primary">
          24h Transaction Activity
        </h3>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] text-text-tertiary">Less</span>
          <div className="flex gap-px">
            {[0, 0.25, 0.5, 0.75, 1].map((v, i) => (
              <div key={i} className="w-[10px] h-[10px] rounded-sm" style={{ backgroundColor: interpolateColor(v) }} />
            ))}
          </div>
          <span className="font-mono text-[10px] text-text-tertiary">More</span>
        </div>
      </div>

      {/* Grid */}
      <div className="relative">
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
            gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
            gap: `${gap}px`,
            width: 'fit-content',
            margin: '0 auto',
          }}
        >
          {buckets.map((bucket, idx) => {
            const col = bucket.hour
            const row = bucket.quarter
            const ratio = bucket.value / maxVal
            return (
              <div
                key={idx}
                className="rounded-sm cursor-default transition-transform hover:scale-125"
                style={{
                  gridColumn: col + 1,
                  gridRow: row + 1,
                  width: cellSize,
                  height: cellSize,
                  backgroundColor: interpolateColor(ratio),
                }}
                onMouseEnter={(e) => {
                  const rect = (e.target as HTMLElement).getBoundingClientRect()
                  setHoveredCell(bucket)
                  setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top })
                }}
                onMouseLeave={() => { setHoveredCell(null); setTooltipPos(null) }}
              />
            )
          })}
        </div>

        {/* Hour labels below */}
        <div
          className="flex mt-1.5"
          style={{ width: cols * step - gap, margin: '0 auto' }}
        >
          {Array.from({ length: cols }).map((_, h) => (
            <div key={h} style={{ width: step, flexShrink: 0 }}>
              {hourLabels.includes(h) && (
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
      </div>

      {/* Tooltip */}
      {hoveredCell && tooltipPos && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: tooltipPos.x, top: tooltipPos.y - 6, transform: 'translate(-50%, -100%)' }}
        >
          <div className="bg-black/95 border border-accent-primary/30 rounded-md px-3 py-1.5 shadow-bitcoin">
            <p className="text-text-accent font-mono text-[11px] font-semibold">{hoveredCell.label}</p>
            <p className="text-text-primary font-mono text-xs">
              {hoveredCell.value} tx{hoveredCell.value !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
