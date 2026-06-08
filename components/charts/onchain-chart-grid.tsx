'use client'

/**
 * Renders the full metric registry through the standardized <OnChainChart>,
 * grouped by category — the ChartInspect-style catalog. Fetches the historical
 * series once and remaps rows so every chart reads `date` / `price`.
 */

import { useEffect, useState } from 'react'
import { OnChainChart } from './onchain-chart'
import { METRICS, metricsByCategory, type MetricCategory } from './registry'

type Row = Record<string, any>

export function OnChainChartGrid() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // Pull the full history once; <OnChainChart> filters range client-side.
        const res = await fetch('/api/metrics/history?range=all', { cache: 'no-store' })
        const json = res.ok ? await res.json() : { history: [] }
        const mapped: Row[] = (json.history || []).map((r: Row) => ({
          ...r,
          date: r.recorded_at,
          price: r.current_price,
        }))
        if (!cancelled) setRows(mapped)
      } catch {
        if (!cancelled) setRows([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const grouped = metricsByCategory()

  return (
    <div className="space-y-12">
      {(Object.keys(grouped) as MetricCategory[]).map((cat) => (
        <section key={cat}>
          <div className="mb-4 flex items-center gap-3">
            <h2 className="font-display text-lg font-semibold text-text-primary">{cat}</h2>
            <span className="font-mono text-xs text-text-tertiary">
              {grouped[cat].length} {grouped[cat].length === 1 ? 'chart' : 'charts'}
            </span>
            <div className="h-px flex-1 bg-border-subtle" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-2">
            {grouped[cat].map((m) => (
              <OnChainChart
                key={m.slug}
                title={m.title}
                description={m.description}
                data={rows}
                series={m.series}
                bands={m.bands}
                leftAxis={m.leftAxis}
                showPrice={m.showPrice}
                defaultRange={m.defaultRange ?? '1Y'}
                loading={loading}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

export { METRICS }
