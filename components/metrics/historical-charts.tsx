'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SectionDivider } from '@/components/ui/section-divider'
import { TrendingUp } from 'lucide-react'
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts'

type TimeRange = '24h' | '7d' | '30d' | '90d' | 'all'

interface HistoryPoint {
  recorded_at: string
  total_utxos?: number
  total_holders?: number
  gini_coefficient?: number
  mvrv_ratio?: number
  realized_cap?: number
  market_cap?: number
  sth_percentage?: number
  lth_percentage?: number
  supply_in_profit_pct?: number
  current_price?: number
  avg_age_days?: number
  top10_supply_pct?: number
  top100_supply_pct?: number
  top1000_supply_pct?: number
}

const CHART_CONFIGS = [
  {
    key: 'mvrv_ratio',
    title: 'MVRV Ratio',
    color: '#F97316',
    format: (v: number) => v.toFixed(3),
    fixedDomain: undefined as [number, number] | undefined,
  },
  {
    key: 'total_holders',
    title: 'Total Holders',
    color: '#3b82f6',
    format: (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v.toString(),
    fixedDomain: undefined as [number, number] | undefined,
  },
  {
    key: 'total_utxos',
    title: 'Total UTXOs',
    color: '#06b6d4',
    format: (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v.toString(),
    fixedDomain: undefined as [number, number] | undefined,
  },
  {
    key: 'gini_coefficient',
    title: 'Gini Coefficient',
    color: '#a855f7',
    format: (v: number) => v.toFixed(4),
    fixedDomain: [0, 1] as [number, number],
  },
  {
    key: 'sth_percentage',
    title: 'STH Supply %',
    color: '#10B981',
    format: (v: number) => `${v.toFixed(2)}%`,
    fixedDomain: [0, 100] as [number, number],
  },
  {
    key: 'supply_in_profit_pct',
    title: 'Supply in Profit %',
    color: '#22C55E',
    format: (v: number) => `${v.toFixed(2)}%`,
    fixedDomain: [0, 100] as [number, number],
  },
  {
    key: 'current_price',
    title: 'DOG Price (USD)',
    color: '#F59E0B',
    format: (v: number) => `$${v.toFixed(6)}`,
    fixedDomain: undefined as [number, number] | undefined,
  },
  {
    key: 'realized_cap',
    title: 'Realized Cap (USD)',
    color: '#EF4444',
    format: (v: number) => v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${v.toFixed(0)}`,
    fixedDomain: undefined as [number, number] | undefined,
  },
]

// Tick count por range para ~6-8 ticks visíveis
function getTickCount(range: TimeRange): number {
  switch (range) {
    case '24h': return 8
    case '7d':  return 7
    case '30d': return 6
    case '90d': return 6
    case 'all': return 8
  }
}

const tooltipStyle = {
  contentStyle: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    border: '1px solid rgba(245, 110, 15, 0.3)',
    borderRadius: '0px',
    color: '#FBFBFB',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '12px',
    padding: '8px 12px',
  },
  itemStyle: { color: '#FBFBFB' },
  labelStyle: { color: '#878787' },
}

export function HistoricalChartsSection() {
  const [range, setRange] = useState<TimeRange>('30d')
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/metrics/history?range=${range}`, { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          setHistory(data.history || [])
        }
      } catch (err) {
        console.error('Error fetching metrics history:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchHistory()
  }, [range])

  const ranges: TimeRange[] = ['24h', '7d', '30d', '90d', 'all']

  const formatXAxis = (dateStr: string) => {
    const d = new Date(dateStr)
    switch (range) {
      case '24h':
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      case '7d':
        return d.toLocaleDateString('en-US', { weekday: 'short' }) + ' ' +
               d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      case '30d':
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      case '90d':
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      case 'all':
        return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      default:
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  }

  const formatTooltipLabel = (dateStr: string) => {
    const d = new Date(dateStr)
    switch (range) {
      case '24h':
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      case '7d':
        return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }) + ' ' +
               d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      case '30d':
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      case '90d':
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      case 'all':
        return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      default:
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }
  }

  const tickCount = getTickCount(range)

  return (
    <>
      <SectionDivider title="Historical Trends" icon={TrendingUp} />

      {/* Range selector */}
      <div className="flex justify-center gap-2 mb-6">
        {ranges.map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wide border transition-all
              ${range === r
                ? 'border-lava bg-lava/20 text-lava'
                : 'border-lava-dark/20 text-dusty hover:border-lava/40 hover:text-snow'
              }`}
          >
            {r}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-dusty font-mono text-sm py-8">Loading historical data...</div>
      ) : history.length === 0 ? (
        <div className="text-center text-dusty font-mono text-sm py-8">
          No historical data available yet. Data collection starts hourly.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {CHART_CONFIGS.map((cfg) => {
            // Filter out zero values (backfilled partial data)
            const chartData = history
              .map(p => ({
                date: p.recorded_at,
                value: (p as any)[cfg.key] || 0,
              }))
              .filter(p => p.value !== 0)

            if (chartData.length < 2) return null

            return (
              <Card key={cfg.key} variant="glass" className="stagger-item">
                <CardHeader className="pb-2">
                  <CardTitle variant="mono" className="text-sm text-dusty">
                    {cfg.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={chartData}
                        margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                      >
                        <defs>
                          <linearGradient id={`grad-${cfg.key}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={cfg.color} stopOpacity={0.4} />
                            <stop offset="95%" stopColor={cfg.color} stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                        <XAxis
                          dataKey="date"
                          stroke="#878787"
                          style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace' }}
                          tickFormatter={formatXAxis}
                          interval={Math.max(0, Math.ceil(chartData.length / tickCount) - 1)}
                        />
                        <YAxis
                          stroke="#878787"
                          style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace' }}
                          tickFormatter={cfg.format}
                          width={70}
                          domain={cfg.fixedDomain || [
                            (dataMin: number) => dataMin * 0.95,
                            (dataMax: number) => dataMax * 1.05,
                          ]}
                        />
                        <Tooltip
                          {...tooltipStyle}
                          labelFormatter={formatTooltipLabel}
                          formatter={(value: number) => [cfg.format(value), cfg.title]}
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke={cfg.color}
                          strokeWidth={2}
                          fill={`url(#grad-${cfg.key})`}
                          dot={false}
                          activeDot={{ r: 4, stroke: cfg.color, strokeWidth: 2, fill: '#000' }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}
