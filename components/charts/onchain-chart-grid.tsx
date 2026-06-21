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
        // Three sources, merged by day. <OnChainChart> filters range client-side.
        //  B = surviving-cohort history (rich, daily, back to genesis): valuation,
        //      profit/loss, cohort, age, price, coverage.
        //  C = metrics_a_history.json (locally accumulated daily snapshots):
        //      concentration (gini, top-N), holders count, utxo count.
        //      Starts with total_utxos backfill from Jan 2026; full metrics from today.
        const [bRes, cRes] = await Promise.all([
          fetch('/data/surviving_cohort_history.json', { cache: 'no-store' }),
          fetch('/data/metrics_a_history.json', { cache: 'no-store' }),
        ])
        const bJson = bRes.ok ? await bRes.json() : { daily: [] }
        const cJson = cRes.ok ? await cRes.json() : { daily: [] }

        const HODL_RAW = [
          'hodl_wave_lt1d', 'hodl_wave_1_7d', 'hodl_wave_7_30d', 'hodl_wave_30_90d',
          'hodl_wave_90_155d', 'hodl_wave_155d_1y', 'hodl_wave_1_2y', 'hodl_wave_gt2y',
        ]
        const byDate = new Map<string, Row>()
        for (const r of bJson.daily || []) {
          const row: Row = { ...r, date: r.date }
          // Derive percentage-of-supply for HODL wave stacked chart
          if (r.supply) {
            for (const k of HODL_RAW) row[k + '_pct'] = (r[k] ?? 0) / r.supply * 100
          }
          byDate.set(r.date, row)
        }
        // merge locally-accumulated A metrics (C) by day
        for (const r of cJson.daily || []) {
          const d: string = r.date
          const prev = byDate.get(d) || { date: d }
          byDate.set(d, {
            ...prev,
            gini_coefficient:   r.gini_coefficient   ?? prev.gini_coefficient,
            top10_supply_pct:   r.top10_supply_pct   ?? prev.top10_supply_pct,
            top100_supply_pct:  r.top100_supply_pct  ?? prev.top100_supply_pct,
            top1000_supply_pct: r.top1000_supply_pct ?? prev.top1000_supply_pct,
            total_holders:      r.total_holders       ?? prev.total_holders,
            total_utxos:        r.total_utxos         ?? prev.total_utxos,
            median_age_days:    r.median_age_days     ?? prev.median_age_days,
            price:              (prev as any).price   ?? r.current_price,
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
                showCoverage={m.showCoverage}
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
