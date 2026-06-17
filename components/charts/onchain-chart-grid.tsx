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
    const day = (d: string) => d.slice(0, 10)
    ;(async () => {
      try {
        // Two sources, merged by day. <OnChainChart> filters range client-side.
        //  B = surviving-cohort history (rich, daily, back to genesis): valuation,
        //      profit/loss, cohort, age, price, coverage.
        //  A = dog_metrics_history (forward-only, accurate): concentration, holders,
        //      utxo count — metrics the cohort model can't reconstruct.
        const [bRes, aRes] = await Promise.all([
          fetch('/data/surviving_cohort_history.json', { cache: 'no-store' }),
          fetch('/api/metrics/history?range=all', { cache: 'no-store' }),
        ])
        const bJson = bRes.ok ? await bRes.json() : { daily: [] }
        const aJson = aRes.ok ? await aRes.json() : { history: [] }

        const byDate = new Map<string, Row>()
        for (const r of bJson.daily || []) {
          byDate.set(r.date, { ...r, date: r.date })
        }
        // merge forward-only metrics in by day (last write per day wins)
        for (const r of aJson.history || []) {
          const d = day(r.recorded_at)
          const prev = byDate.get(d) || { date: d }
          byDate.set(d, {
            ...prev,
            gini_coefficient: r.gini_coefficient ?? prev.gini_coefficient,
            top10_supply_pct: r.top10_supply_pct ?? prev.top10_supply_pct,
            top100_supply_pct: r.top100_supply_pct ?? prev.top100_supply_pct,
            top1000_supply_pct: r.top1000_supply_pct ?? prev.top1000_supply_pct,
            total_holders: r.total_holders ?? prev.total_holders,
            total_utxos: r.total_utxos ?? prev.total_utxos,
            median_age_days: r.median_age_days ?? prev.median_age_days,
            // prefer live price from A when the day has no cohort price
            price: prev.price ?? r.current_price,
          })
        }
        const merged = Array.from(byDate.values()).sort((a, b) =>
          a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
        )
        if (!cancelled) setRows(merged)
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
