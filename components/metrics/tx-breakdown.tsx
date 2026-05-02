'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts'

type Range = '7d' | '30d' | '90d' | 'all'

type DaySeries = {
  day: string
  total: number
  blocks: number
  classes: Record<string, number>
  class_subclasses: Record<string, Record<string, number>>
  pct: Record<string, number>
}

type ApiResponse = {
  range: string
  total_days: number
  series: DaySeries[]
  totals: {
    total_txs: number
    classes: Record<string, number>
    class_subclasses: Record<string, Record<string, number>>
    pct: Record<string, number>
  }
  last_updated: string | null
}

// Stack order (bottom-up in chart) and palette
const CLASSES = [
  { key: 'financial',          label: 'Financial',           color: '#4A4A52' },
  { key: 'runes',              label: 'Runes',               color: '#FF6B00' },
  { key: 'inscription',        label: 'Inscriptions',        color: '#F7931A' },
  { key: 'op_return_protocol', label: 'OP_RETURN Protocol',  color: '#FFAD42' },
  { key: 'op_return_other',    label: 'OP_RETURN Other',     color: '#9CA3AF' },
  { key: 'coinbase',           label: 'Coinbase',            color: '#2A2A2E' },
] as const

const RANGES: { key: Range; label: string }[] = [
  { key: '7d',  label: '7D'  },
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
  { key: 'all', label: 'ALL' },
]

function formatNumber(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return n.toString()
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s: number, p: any) => s + (p.value || 0), 0)
  return (
    <div className="bg-bg-elevated border border-border-default rounded-md p-3 shadow-lg">
      <div className="font-mono text-xs text-text-secondary mb-2">{label}</div>
      <div className="space-y-1">
        {payload.slice().reverse().map((p: any) => {
          const pct = total > 0 ? (p.value / total) * 100 : 0
          return (
            <div key={p.dataKey} className="flex items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-sm" style={{ background: p.color }} />
                <span className="text-text-primary">{p.name}</span>
              </div>
              <span className="font-mono text-text-secondary">
                {formatNumber(p.value)} <span className="opacity-50">({pct.toFixed(1)}%)</span>
              </span>
            </div>
          )
        })}
      </div>
      <div className="mt-2 pt-2 border-t border-border-subtle text-xs font-mono text-text-secondary">
        Total: {formatNumber(total)}
      </div>
    </div>
  )
}

export function TxBreakdown() {
  const [range, setRange] = useState<Range>('30d')
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/metrics/tx-breakdown?range=${range}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((d: ApiResponse) => {
        if (cancelled) return
        setData(d)
      })
      .catch(e => {
        if (cancelled) return
        setError(e.message || 'failed to load')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [range])

  const chartData = useMemo(() => {
    if (!data) return []
    return data.series.map(s => ({
      day: s.day,
      ...Object.fromEntries(CLASSES.map(c => [c.key, s.classes[c.key] || 0])),
    }))
  }, [data])

  const totals = data?.totals
  const classSubclasses = totals?.class_subclasses ?? {}
  const dogCount = classSubclasses['runes']?.dog ?? 0
  const runesCount = totals?.classes['runes'] ?? 0
  const totalTxs = totals?.total_txs ?? 0
  const dogPctOfTotal = totalTxs > 0 ? (dogCount / totalTxs) * 100 : 0
  const dogPctOfRunes = runesCount > 0 ? (dogCount / runesCount) * 100 : 0

  return (
    <Card variant="glass" className="border-accent-primary/10 max-w-7xl mx-auto">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="text-text-accent text-xl font-display">
              Bitcoin Transaction Breakdown
            </CardTitle>
            <p className="text-xs text-text-secondary mt-1 font-mono">
              Every tx classified · Runes · Inscriptions · OP_RETURN · Financial
            </p>
          </div>
          <div className="flex gap-1 bg-bg-elevated rounded-md p-1 border border-border-subtle">
            {RANGES.map(r => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                  range === r.key
                    ? 'bg-accent-primary/20 text-accent-primary'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* KPI tiles */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3">
          {CLASSES.map(c => {
            const pct = totals?.pct[c.key] ?? 0
            const count = totals?.classes[c.key] ?? 0
            const isRunes = c.key === 'runes'
            return (
              <div
                key={c.key}
                className={`bg-bg-elevated/50 border rounded-md p-3 ${
                  isRunes && dogCount > 0
                    ? 'border-accent-primary/30 ring-1 ring-accent-primary/10'
                    : 'border-border-subtle'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-sm" style={{ background: c.color }} />
                  <span className="text-[10px] uppercase tracking-wider text-text-secondary font-mono truncate">
                    {c.label}
                  </span>
                </div>
                <div className="font-mono text-lg font-semibold text-text-primary">
                  {pct.toFixed(2)}%
                </div>
                <div className="text-[10px] text-text-secondary font-mono">
                  {formatNumber(count)} txs
                </div>
                {isRunes && dogCount > 0 && (
                  <div className="mt-2 pt-2 border-t border-border-subtle">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase tracking-wider text-accent-primary font-mono">
                        DOG
                      </span>
                      <span className="font-mono text-xs text-text-primary font-semibold">
                        {dogPctOfTotal.toFixed(2)}%
                      </span>
                    </div>
                    <div className="text-[9px] text-text-secondary font-mono">
                      {formatNumber(dogCount)} · {dogPctOfRunes.toFixed(1)}% of Runes
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Per-class subclass breakdown */}
        {Object.keys(classSubclasses).length > 0 && (
          <div className="bg-bg-elevated/30 border border-border-subtle rounded-md p-3 space-y-2">
            {Object.entries(classSubclasses).map(([parent, subs]) => {
              const entries = Object.entries(subs).sort((a, b) => b[1] - a[1])
              if (entries.length === 0) return null
              const parentLabel =
                CLASSES.find(c => c.key === parent)?.label || parent
              return (
                <div key={parent}>
                  <div className="text-[10px] uppercase tracking-wider text-text-secondary font-mono mb-1">
                    {parentLabel} breakdown
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {entries.map(([name, n]) => (
                      <div key={name} className="font-mono text-xs">
                        <span className="text-text-secondary capitalize">{name}:</span>{' '}
                        <span className="text-text-accent">{formatNumber(n)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Stacked bar chart */}
        <div className="h-[320px] md:h-[380px]">
          {loading && !data ? (
            <div className="h-full flex items-center justify-center text-text-secondary font-mono text-sm">
              loading…
            </div>
          ) : error ? (
            <div className="h-full flex items-center justify-center text-accent-negative font-mono text-sm">
              error: {error}
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-text-secondary font-mono text-sm">
              no data for selected range
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fill: '#666666', fontSize: 11, fontFamily: 'monospace' }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.07)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#666666', fontSize: 11, fontFamily: 'monospace' }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.07)' }}
                  tickLine={false}
                  tickFormatter={formatNumber}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(247,147,26,0.05)' }} />
                <Legend
                  wrapperStyle={{ fontSize: 11, fontFamily: 'monospace' }}
                  iconType="square"
                  iconSize={10}
                />
                {CLASSES.map(c => (
                  <Bar
                    key={c.key}
                    dataKey={c.key}
                    name={c.label}
                    stackId="tx"
                    fill={c.color}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {data && (
          <div className="text-[10px] text-text-secondary font-mono text-right">
            {data.total_days} days · {formatNumber(totals?.total_txs ?? 0)} txs ·
            {' '}last updated: {data.last_updated ?? '-'}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
