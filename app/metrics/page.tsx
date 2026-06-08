"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Layout } from "@/components/layout"
import { LoadingScreen } from "@/components/loading-screen"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SectionDivider } from "@/components/ui/section-divider"
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Activity,
  Users,
  Coins,
  PieChart,
  Zap,
  ArrowRight
} from "lucide-react"
import { HistoricalChartsSection } from "@/components/metrics/historical-charts"
import { TxBreakdown } from "@/components/metrics/tx-breakdown"
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  Treemap
} from "recharts"


interface UTXOMetrics {
  total_utxos: number
  avg_utxo_size: number
  utxo_distribution: {
    range: string
    count: number
    supply: number
    percentage: number
  }[]
}

interface HolderConcentration {
  gini_coefficient: number
  top10_supply_pct: number
  top100_supply_pct: number
  top1000_supply_pct: number
}

interface UTXOCountHistoryItem {
  date: string
  total_utxos: number
}

type UTXOCountHistory = UTXOCountHistoryItem[]

interface UTXOAgeStats {
  total_utxos: number
  total_supply: number
  avg_age_days: number
  median_age_days: number
  sth_supply: number
  lth_supply: number
  sth_percentage: number
  lth_percentage: number
  hodl_waves: {
    range: string
    supply: number
    percentage: number
  }[]
}

interface RealizedCapMetrics {
  realized_cap: number
  market_cap: number
  mvrv_ratio: number
  current_price: number
  last_updated: string
}

interface SupplyProfitLoss {
  supply_in_profit: number
  supply_in_loss: number
  supply_in_profit_pct: number
  supply_in_loss_pct: number
  current_price: number
  last_updated: string
}

// ─── Premium Chart Tooltip ────────────────────────────────────
function ChartTooltip({ active, payload, label, labelFormatter, formatter }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-black/95 border border-accent-primary/30 rounded-md px-4 py-3 shadow-bitcoin backdrop-blur-sm">
      <p className="text-text-accent font-mono text-xs font-semibold mb-2">
        {labelFormatter ? labelFormatter(label) : label}
      </p>
      {payload.map((entry: any, i: number) => {
        const [val, name] = formatter ? formatter(entry.value, entry.name, entry) : [entry.value, entry.name]
        return (
          <p key={i} className="text-text-primary font-mono text-sm">
            {val}
          </p>
        )
      })}
    </div>
  )
}

export default function MetricsPage() {
  const [loading, setLoading] = useState(true)
  const [utxoMetrics, setUtxoMetrics] = useState<UTXOMetrics | null>(null)
  const [holderConcentration, setHolderConcentration] = useState<HolderConcentration | null>(null)
  const [utxoCountHistory, setUtxoCountHistory] = useState<UTXOCountHistory>([])
  const [utxoAgeStats, setUtxoAgeStats] = useState<UTXOAgeStats | null>(null)
  const [realizedCapMetrics, setRealizedCapMetrics] = useState<RealizedCapMetrics | null>(null)
  const [supplyProfitLoss, setSupplyProfitLoss] = useState<SupplyProfitLoss | null>(null)

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true)
        const cacheBuster = `?t=${Date.now()}`
        const [utxoResponse, concentrationResponse, historyResponse, ageResponse, realizedCapResponse, profitLossResponse] = await Promise.all([
          fetch(`/api/metrics/utxo${cacheBuster}`, { cache: 'no-store' }),
          fetch(`/api/metrics/holder-concentration${cacheBuster}`, { cache: 'no-store' }),
          fetch(`/api/metrics/utxo-count-history?range=all${cacheBuster}`, { cache: 'no-store' }),
          fetch(`/api/metrics/utxo-age${cacheBuster}`, { cache: 'no-store' }),
          fetch(`/api/metrics/realized-cap${cacheBuster}`, { cache: 'no-store' }),
          fetch(`/api/metrics/supply-profit-loss${cacheBuster}`, { cache: 'no-store' })
        ])

        const [utxoData, concentrationData, historyData, ageData, realizedCapData, profitLossData] = await Promise.all([
          utxoResponse.ok ? utxoResponse.json().catch(() => null) : null,
          concentrationResponse.ok ? concentrationResponse.json().catch(() => null) : null,
          historyResponse.ok ? historyResponse.json().catch(() => null) : null,
          ageResponse.ok ? ageResponse.json().catch(() => null) : (ageResponse.status === 404 ? { error: 'not_found' } : null),
          realizedCapResponse.ok ? realizedCapResponse.json().catch(() => null) : null,
          profitLossResponse.ok ? profitLossResponse.json().catch(() => null) : null
        ])

        if (utxoData) setUtxoMetrics(utxoData)
        if (concentrationData) setHolderConcentration(concentrationData)
        if (historyData) setUtxoCountHistory(historyData.history || [])
        if (ageData && !ageData.error) {
          setUtxoAgeStats(ageData)
        } else if (ageData?.error) {
          console.warn('UTXO age stats not available:', ageData.message || ageData.error)
        }
        if (realizedCapData && !realizedCapData.error) setRealizedCapMetrics(realizedCapData)
        if (profitLossData && !profitLossData.error) setSupplyProfitLoss(profitLossData)

} catch (error) {
        console.error('Error fetching metrics:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchMetrics()
  }, [])

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 2
    }).format(num)
  }

  const formatDOG = (num: number, alreadyInDOG: boolean = false) => {
    const dogAmount = alreadyInDOG ? num : num / 100000
    if (dogAmount >= 1_000_000_000) return `${(dogAmount / 1_000_000_000).toFixed(2)}B DOG`
    if (dogAmount >= 1_000_000) return `${(dogAmount / 1_000_000).toFixed(2)}M DOG`
    if (dogAmount >= 1_000) return `${(dogAmount / 1_000).toFixed(2)}K DOG`
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(dogAmount) + ' DOG'
  }

  if (loading) {
    return <LoadingScreen message="Loading on-chain metrics..." />
  }

  // HODL waves orange palette
  const hodlColors = ['#F7931A', '#E8820E', '#FF6B00', '#C45E00', '#FF8C3A', '#D47214', '#B35400']

  return (
    <Layout currentPage="metrics" setCurrentPage={() => {}}>
      <div className="min-h-screen pt-1 pb-2 md:py-2 space-y-6 md:space-y-8 px-4 md:px-6">
        {/* ═══ Hero ═══ */}
        <div className="text-center space-y-1 md:space-y-2 animate-fade-in px-4 mt-8 md:mt-10">
          <div className="hero-glow">
            <div className="space-y-3 md:space-y-4 max-w-full overflow-hidden">
              <h1 className="text-2xl md:text-4xl font-display font-bold tracking-tight">
                <span className="font-mono tracking-wider block text-text-accent">
                  <span className="inline-block">ON-CHAIN</span>
                  <span className="inline-block ml-4 md:ml-6">METRICS</span>
                </span>
              </h1>
              <div className="flex items-center justify-center">
                <span className="text-text-accent font-mono text-xs md:text-sm opacity-70">
                  UTXO-Based Indicators &bull; Node Exclusive Data
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ Transaction Breakdown (Runes vs Inscriptions vs OP_RETURN vs Financial) ═══ */}
        <SectionDivider title="Transaction Breakdown" icon={Activity} />
        <TxBreakdown />

        <SectionDivider title="UTXO Metrics" icon={Coins} />

        {/* ═══ Key Metrics Cards ═══ */}
        <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-6 max-w-7xl mx-auto">
          {/* UTXO Count */}
          <Card variant="glass" className="stagger-item h-full flex flex-col border-accent-primary/10 hover:border-accent-primary/40 transition-all">
            <CardHeader className="pb-3">
              <CardTitle variant="mono" className="text-sm text-text-secondary flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-text-accent" />
                  Total UTXOs
                </div>
                {utxoCountHistory.length >= 2 && (() => {
                  const latest = utxoCountHistory[utxoCountHistory.length - 1]
                  const previous = utxoCountHistory[utxoCountHistory.length - 2]
                  const change = latest.total_utxos - previous.total_utxos
                  const changePercent = previous.total_utxos > 0
                    ? ((change / previous.total_utxos) * 100)
                    : 0
                  const isPositive = change >= 0
                  return (
                    <div className={`flex items-center gap-1.5 text-xs ${isPositive ? 'text-accent-positive' : 'text-accent-negative'}`}>
                      {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                      <span>{Math.abs(changePercent).toFixed(3)}%</span>
                    </div>
                  )
                })()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="text-xl md:text-3xl font-bold text-text-primary font-mono metric-value tracking-tight">
                  {utxoMetrics ? utxoMetrics.total_utxos.toLocaleString('en-US') : '—'}
                </div>
                <p className="text-xs text-text-tertiary font-mono uppercase tracking-wide">
                  Unspent Transaction Outputs
                </p>
                {utxoCountHistory.length >= 2 && (() => {
                  const latest = utxoCountHistory[utxoCountHistory.length - 1]
                  const previous = utxoCountHistory[utxoCountHistory.length - 2]
                  const change = latest.total_utxos - previous.total_utxos
                  const isPositive = change >= 0
                  const date = new Date(previous.date)
                  return (
                    <div className="pt-2 border-t border-border-subtle">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-text-secondary font-mono">vs {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}:</span>
                        <span className={`font-mono font-semibold ${isPositive ? 'text-accent-positive' : 'text-accent-negative'}`}>
                          {isPositive ? '+' : ''}{change.toLocaleString('en-US')}
                        </span>
                      </div>
                    </div>
                  )
                })()}
              </div>
            </CardContent>
          </Card>

          {/* Average UTXO Size */}
          <Card variant="glass" className="stagger-item h-full flex flex-col border-accent-primary/10 hover:border-accent-primary/40 transition-all">
            <CardHeader className="pb-3">
              <CardTitle variant="mono" className="text-sm text-text-secondary flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-text-accent" />
                Average UTXO Size
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-xl md:text-3xl font-bold text-text-primary font-mono metric-value tracking-tight">
                  {utxoMetrics ? formatDOG(utxoMetrics.avg_utxo_size, true) : '—'}
                </div>
                <p className="text-xs text-text-tertiary font-mono uppercase tracking-wide">
                  Mean DOG per UTXO
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Gini Coefficient */}
          <Card variant="glass" className="stagger-item h-full flex flex-col border-accent-primary/10 hover:border-accent-primary/40 transition-all">
            <CardHeader className="pb-3">
              <CardTitle variant="mono" className="text-sm text-text-secondary flex items-center gap-2">
                <PieChart className="w-4 h-4 text-text-accent" />
                Holder Concentration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-xl md:text-3xl font-bold text-text-primary font-mono metric-value tracking-tight">
                  {holderConcentration
                    ? holderConcentration.gini_coefficient.toFixed(3)
                    : '—'}
                </div>
                <p className="text-xs text-text-tertiary font-mono uppercase tracking-wide">
                  Gini Coefficient (0 = equal, 1 = concentrated)
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Top 10 Supply % */}
          <Card variant="glass" className="stagger-item h-full flex flex-col border-accent-primary/10 hover:border-accent-primary/40 transition-all">
            <CardHeader className="pb-3">
              <CardTitle variant="mono" className="text-sm text-text-secondary flex items-center gap-2">
                <Users className="w-4 h-4 text-text-accent" />
                Top 10 Holders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-xl md:text-3xl font-bold text-text-primary font-mono metric-value tracking-tight">
                  {holderConcentration
                    ? `${holderConcentration.top10_supply_pct.toFixed(2)}%`
                    : '—'}
                </div>
                <p className="text-xs text-text-tertiary font-mono uppercase tracking-wide">
                  Of Total Supply
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ═══ HODL Waves ═══ */}
        {utxoAgeStats && utxoAgeStats.hodl_waves.length > 0 && (
          <>
            <SectionDivider title="HODL Waves" icon={BarChart3} />
            <Card variant="glass" className="max-w-7xl mx-auto border-accent-primary/10">
              <CardHeader>
                <CardTitle className="text-text-accent text-xl font-display">
                  Supply Distribution by UTXO Age
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={utxoAgeStats.hodl_waves.map((wave, idx) => ({
                        range: wave.range,
                        percentage: wave.percentage,
                        supply: wave.supply,
                        fill: hodlColors[idx % hodlColors.length]
                      }))}
                      margin={{ top: 10, right: 30, left: 0, bottom: 60 }}
                    >
                      <defs>
                        {hodlColors.map((color, i) => (
                          <linearGradient key={i} id={`hodlGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity={0.9}/>
                            <stop offset="100%" stopColor={color} stopOpacity={0.4}/>
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" opacity={0.5} />
                      <XAxis
                        dataKey="range"
                        stroke="#3A3A3A"
                        style={{ fontSize: '11px', fontFamily: 'var(--font-mono), monospace' }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        tick={{ fill: '#666666' }}
                      />
                      <YAxis
                        stroke="#3A3A3A"
                        style={{ fontSize: '12px', fontFamily: 'var(--font-mono), monospace' }}
                        tickFormatter={(value) => `${value.toFixed(1)}%`}
                        tick={{ fill: '#666666' }}
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null
                          const data = payload[0].payload
                          return (
                            <div className="bg-black/95 border border-accent-primary/30 rounded-md px-4 py-3 shadow-bitcoin">
                              <p className="text-text-accent font-mono text-xs font-semibold mb-1">
                                Age: {label}
                              </p>
                              <p className="text-text-primary font-mono text-sm">
                                {data.percentage.toFixed(2)}% &bull; {formatDOG(data.supply)}
                              </p>
                            </div>
                          )
                        }}
                      />
                      <Bar
                        dataKey="percentage"
                        radius={[4, 4, 0, 0]}
                        activeBar={false}
                      >
                        {utxoAgeStats.hodl_waves.map((_, idx) => (
                          <rect key={idx} fill={`url(#hodlGrad${idx % hodlColors.length})`} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* Legend */}
                <div className="mt-6">
                  <h3 className="text-text-accent font-mono text-sm uppercase tracking-wide mb-3">Legend</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {utxoAgeStats.hodl_waves.map((wave, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 bg-bg-elevated/50 border border-border-subtle rounded-lg hover:border-accent-primary/30 transition-all">
                        <div
                          className="w-4 h-4 flex-shrink-0 rounded-sm"
                          style={{ backgroundColor: hodlColors[idx % hodlColors.length] }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-text-primary font-mono text-sm font-medium truncate">{wave.range}</div>
                          <div className="text-text-accent font-mono text-xs font-bold">
                            {wave.percentage.toFixed(2)}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-center text-text-tertiary text-xs font-mono mt-4">
                  Average age: {utxoAgeStats.avg_age_days.toFixed(1)} days &bull;
                  Median age: {utxoAgeStats.median_age_days.toFixed(1)} days
                </p>
              </CardContent>
            </Card>
          </>
        )}

        {/* ═══ STH vs LTH Supply ═══ */}
        {utxoAgeStats && (
          <>
            <SectionDivider title="STH vs LTH Supply" icon={Zap} />
            <div className="max-w-7xl mx-auto space-y-6">
              <Card variant="glass" className="border-accent-primary/10">
                <CardHeader>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <CardTitle className="text-text-accent text-xl font-display">
                      STH vs LTH Supply Distribution
                    </CardTitle>
                    <Link
                      href="/metrics/holders-by-age"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-accent-primary/30 hover:border-accent-primary/60 text-text-accent text-xs font-mono transition-all"
                    >
                      View wallet list
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="relative">
                      <div className="h-32 w-full bg-transparent overflow-hidden relative border border-border-subtle rounded-lg">
                        {/* STH bar */}
                        <div
                          className="absolute top-0 left-0 h-full flex items-center justify-center transition-all duration-500"
                          style={{
                            width: `${utxoAgeStats.sth_percentage}%`,
                            background: 'linear-gradient(135deg, #2ECC71, #27AE60)'
                          }}
                        >
                          {utxoAgeStats.sth_percentage > 15 && (
                            <span className="text-text-primary font-mono font-bold text-lg px-4">
                              {utxoAgeStats.sth_percentage.toFixed(1)}%
                            </span>
                          )}
                        </div>
                        {/* LTH bar */}
                        <div
                          className="absolute top-0 right-0 h-full flex items-center justify-center transition-all duration-500"
                          style={{
                            width: `${utxoAgeStats.lth_percentage}%`,
                            background: 'linear-gradient(135deg, #F7931A, #E8820E)'
                          }}
                        >
                          {utxoAgeStats.lth_percentage > 15 && (
                            <span className="text-text-primary font-mono font-bold text-lg px-4">
                              {utxoAgeStats.lth_percentage.toFixed(1)}%
                            </span>
                          )}
                        </div>
                        {utxoAgeStats.sth_percentage <= 15 && (
                          <div className="absolute top-1/2 -translate-y-1/2 left-2 text-text-primary font-mono font-bold text-sm"
                            style={{ left: `${utxoAgeStats.sth_percentage / 2}%` }}>
                            STH: {utxoAgeStats.sth_percentage.toFixed(1)}%
                          </div>
                        )}
                        {utxoAgeStats.lth_percentage <= 15 && (
                          <div className="absolute top-1/2 -translate-y-1/2 text-text-primary font-mono font-bold text-sm"
                            style={{ right: `${utxoAgeStats.lth_percentage / 2}%` }}>
                            LTH: {utxoAgeStats.lth_percentage.toFixed(1)}%
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 md:gap-6">
                      <Link
                        href="/metrics/holders-by-age?filter=sth"
                        className="group p-4 bg-bg-elevated/50 border border-border-subtle rounded-lg hover:border-accent-positive/40 transition-all"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-4 h-4 rounded-sm" style={{ background: 'linear-gradient(135deg, #2ECC71, #27AE60)' }} />
                          <h3 className="text-text-primary font-mono font-semibold text-sm">Short-Term Holders</h3>
                          <ArrowRight className="w-3.5 h-3.5 text-text-tertiary ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="space-y-1">
                          <div className="text-2xl font-bold text-accent-positive font-mono">
                            {utxoAgeStats.sth_percentage.toFixed(2)}%
                          </div>
                          <div className="text-text-secondary font-mono text-sm">
                            {formatDOG(utxoAgeStats.sth_supply)}
                          </div>
                          <div className="text-text-tertiary font-mono text-xs">
                            UTXOs &lt; 155 days old
                          </div>
                        </div>
                      </Link>

                      <Link
                        href="/metrics/holders-by-age?filter=lth"
                        className="group p-4 bg-bg-elevated/50 border border-border-subtle rounded-lg hover:border-accent-primary/40 transition-all"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-4 h-4 rounded-sm" style={{ background: 'linear-gradient(135deg, #F7931A, #E8820E)' }} />
                          <h3 className="text-text-primary font-mono font-semibold text-sm">Long-Term Holders</h3>
                          <ArrowRight className="w-3.5 h-3.5 text-text-tertiary ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="space-y-1">
                          <div className="text-2xl font-bold text-text-accent font-mono">
                            {utxoAgeStats.lth_percentage.toFixed(2)}%
                          </div>
                          <div className="text-text-secondary font-mono text-sm">
                            {formatDOG(utxoAgeStats.lth_supply)}
                          </div>
                          <div className="text-text-tertiary font-mono text-xs">
                            UTXOs &ge; 155 days old
                          </div>
                        </div>
                      </Link>
                    </div>
                  </div>
                  <p className="text-center text-text-tertiary text-xs font-mono mt-4">
                    Complete data from {(utxoAgeStats.total_utxos || 0).toLocaleString()} tracked UTXOs (100% of supply) · click a cohort to browse wallets
                  </p>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* ═══ Holder Concentration — Bar Chart (was 3-point area = straight lines) ═══ */}
        {holderConcentration && (
          <>
            <SectionDivider title="Holder Concentration" icon={Users} />
            <div className="max-w-7xl mx-auto space-y-6">
              <Card variant="glass" className="border-accent-primary/10">
                <CardHeader>
                  <CardTitle className="text-text-accent text-xl font-display">
                    Supply Distribution by Top Holders
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="h-80 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={[
                            { name: 'Top 10', value: holderConcentration.top10_supply_pct, fill: '#F7931A' },
                            { name: 'Top 100', value: holderConcentration.top100_supply_pct, fill: '#E8820E' },
                            { name: 'Top 1000', value: holderConcentration.top1000_supply_pct, fill: '#C45E00' },
                            { name: 'Others', value: Math.max(0, 100 - holderConcentration.top1000_supply_pct), fill: '#3A3A3A' }
                          ]}
                          margin={{ top: 10, right: 30, left: 0, bottom: 10 }}
                        >
                          <defs>
                            <linearGradient id="barGrad1" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#F7931A" stopOpacity={1}/>
                              <stop offset="100%" stopColor="#F7931A" stopOpacity={0.5}/>
                            </linearGradient>
                            <linearGradient id="barGrad2" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#E8820E" stopOpacity={1}/>
                              <stop offset="100%" stopColor="#E8820E" stopOpacity={0.5}/>
                            </linearGradient>
                            <linearGradient id="barGrad3" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#C45E00" stopOpacity={1}/>
                              <stop offset="100%" stopColor="#C45E00" stopOpacity={0.5}/>
                            </linearGradient>
                            <linearGradient id="barGrad4" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#3A3A3A" stopOpacity={0.6}/>
                              <stop offset="100%" stopColor="#3A3A3A" stopOpacity={0.2}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" opacity={0.5} />
                          <XAxis
                            dataKey="name"
                            stroke="#3A3A3A"
                            style={{ fontSize: '12px', fontFamily: 'var(--font-mono), monospace' }}
                            tick={{ fill: '#666666' }}
                          />
                          <YAxis
                            stroke="#3A3A3A"
                            style={{ fontSize: '12px', fontFamily: 'var(--font-mono), monospace' }}
                            tickFormatter={(value) => `${value.toFixed(0)}%`}
                            tick={{ fill: '#666666' }}
                          />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null
                              const d = payload[0].payload
                              return (
                                <div className="bg-black/95 border border-accent-primary/30 rounded-md px-4 py-3 shadow-bitcoin">
                                  <p className="text-text-accent font-mono text-xs font-semibold mb-1">{d.name}</p>
                                  <p className="text-text-primary font-mono text-sm font-bold">{d.value.toFixed(2)}%</p>
                                </div>
                              )
                            }}
                          />
                          <Bar dataKey="value" radius={[6, 6, 0, 0]} activeBar={false}>
                            {[0,1,2,3].map(i => (
                              <rect key={i} fill={`url(#barGrad${i+1})`} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[
                        { label: 'Top 10', value: holderConcentration.top10_supply_pct, color: '#F7931A' },
                        { label: 'Top 100', value: holderConcentration.top100_supply_pct, color: '#E8820E' },
                        { label: 'Top 1000', value: holderConcentration.top1000_supply_pct, color: '#C45E00' },
                      ].map((item) => (
                        <div key={item.label} className="p-4 bg-bg-elevated/50 border border-border-subtle rounded-lg">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: item.color }} />
                            <h3 className="text-text-primary font-mono font-semibold text-sm">{item.label}</h3>
                          </div>
                          <div className="space-y-1">
                            <div className="text-2xl font-bold text-text-accent font-mono">
                              {item.value.toFixed(2)}%
                            </div>
                            <div className="text-text-tertiary font-mono text-xs">
                              of total supply
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* ═══ UTXO Distribution by Size ═══ */}
        {utxoMetrics && utxoMetrics.utxo_distribution.length > 0 && (
          <>
            <SectionDivider title="UTXO Distribution by Size" icon={PieChart} />
            <Card variant="glass" className="max-w-7xl mx-auto border-accent-primary/10">
              <CardHeader>
                <CardTitle className="text-text-accent text-xl font-display">
                  Distribution of UTXOs by Size
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="h-96 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <Treemap
                        data={(() => {
                          const sorted = [...utxoMetrics.utxo_distribution].sort((a, b) => b.supply - a.supply)
                          const orangeColors = ['#F7931A', '#E8820E', '#FF6B00', '#C45E00', '#FF8C3A', '#B35400']
                          return sorted.map((dist, index) => ({
                            name: dist.range,
                            size: dist.supply,
                            percentage: dist.percentage,
                            count: dist.count,
                            supply: dist.supply,
                            fill: orangeColors[index % orangeColors.length]
                          }))
                        })()}
                        dataKey="size"
                        aspectRatio={4/3}
                        stroke="#000000"
                        animationDuration={800}
                        nameKey="name"
                      >
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null
                            const data = payload[0].payload
                            const name = data.name || data.range || 'Unknown'
                            const originalData = utxoMetrics.utxo_distribution.find(d => d.range === name)
                            const percentage = originalData?.percentage || data.percentage || 0
                            const count = data.count || originalData?.count || 0
                            const supply = data.supply || data.size || originalData?.supply || 0
                            return (
                              <div className="bg-black/95 border border-accent-primary/30 rounded-md px-4 py-3 shadow-bitcoin">
                                <p className="text-text-accent font-mono text-xs font-semibold mb-1">{name}</p>
                                <p className="text-text-primary font-mono text-sm">
                                  {percentage.toFixed(2)}% &bull; {formatNumber(count)} UTXOs
                                </p>
                                <p className="text-text-secondary font-mono text-xs mt-1">
                                  {formatDOG(supply, true)} Supply
                                </p>
                              </div>
                            )
                          }}
                        />
                      </Treemap>
                    </ResponsiveContainer>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[...utxoMetrics.utxo_distribution]
                      .sort((a, b) => b.supply - a.supply)
                      .map((dist, idx) => {
                        const orangeColors = ['#F7931A', '#E8820E', '#FF6B00', '#C45E00', '#FF8C3A', '#B35400']
                        const color = orangeColors[idx % orangeColors.length]
                        return (
                          <div key={dist.range} className="flex items-center justify-between p-3 bg-bg-elevated/50 border border-border-subtle rounded-lg hover:border-accent-primary/30 transition-all">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="w-4 h-4 flex-shrink-0 rounded-sm" style={{ backgroundColor: color }} />
                              <div className="flex-1 min-w-0">
                                <div className="text-text-primary font-mono text-sm truncate">{dist.range}</div>
                                <div className="text-text-secondary font-mono text-xs truncate">
                                  {formatNumber(dist.count)} UTXOs &bull; {formatDOG(dist.supply, true)}
                                </div>
                              </div>
                            </div>
                            <div className="text-text-accent font-mono font-bold text-sm ml-2">
                              {dist.percentage.toFixed(1)}%
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* ═══ Realized Cap / MVRV Ratio ═══ */}
        {realizedCapMetrics && (
          <>
            <SectionDivider title="Realized Cap / MVRV Ratio" icon={Zap} />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-6 max-w-7xl mx-auto items-start">
              {/* MVRV Ratio Visual */}
              <Card variant="glass" className="border-accent-primary/10 lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-text-accent text-xl font-display">
                    MVRV Ratio
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-8">
                    <div className="text-center">
                      <div className="text-6xl font-bold bg-gradient-bitcoin bg-clip-text text-transparent font-mono mb-3">
                        {realizedCapMetrics.mvrv_ratio.toFixed(2)}
                      </div>
                      <div className="inline-flex items-center gap-2 px-4 py-2 bg-bg-elevated/50 border border-border-subtle rounded-lg">
                        <div className={`w-2 h-2 rounded-full ${
                          realizedCapMetrics.mvrv_ratio < 1.0 ? 'bg-accent-positive' :
                          realizedCapMetrics.mvrv_ratio > 3.7 ? 'bg-accent-negative' : 'bg-accent-primary'
                        }`} />
                        <p className="text-sm font-mono uppercase tracking-wide text-text-primary/80">
                          {realizedCapMetrics.mvrv_ratio < 1.0 ? 'Undervalued' : realizedCapMetrics.mvrv_ratio > 3.7 ? 'Overvalued' : 'Fair Value'}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-xs text-text-secondary font-mono uppercase tracking-wide">
                        <span>Market Cap</span>
                        <span>Realized Cap</span>
                      </div>
                      <div className="relative h-32 w-full bg-bg-elevated/30 border border-border-subtle rounded-lg overflow-hidden">
                        <div
                          className="absolute top-0 left-0 h-full flex items-center justify-center transition-all duration-500"
                          style={{
                            width: `${Math.min(100, (realizedCapMetrics.market_cap / realizedCapMetrics.realized_cap) * 100)}%`,
                            background: 'linear-gradient(135deg, #F7931A, #E8820E)'
                          }}
                        >
                          <span className="text-text-primary font-mono font-bold text-sm px-3">
                            ${(realizedCapMetrics.market_cap / 1_000_000).toFixed(2)}M
                          </span>
                        </div>
                        <div
                          className="absolute top-0 right-0 h-full w-full opacity-10"
                          style={{ background: 'linear-gradient(135deg, #F7931A, #C45E00)' }}
                        />
                        <div className="absolute bottom-2 right-4 text-text-primary font-mono font-semibold text-xs">
                          Realized: ${(realizedCapMetrics.realized_cap / 1_000_000).toFixed(2)}M
                        </div>
                      </div>

                      <div className="pt-4 border-t border-border-subtle">
                        <p className="text-xs text-text-secondary font-mono leading-relaxed">
                          MVRV Ratio compares Market Cap to Realized Cap.
                          {realizedCapMetrics.mvrv_ratio < 1.0
                            ? ' Values below 1.0 indicate the asset is trading below its average cost basis (undervalued).'
                            : realizedCapMetrics.mvrv_ratio > 3.7
                            ? ' Values above 3.7 suggest the asset may be overvalued relative to historical cost basis.'
                            : ' Values between 1.0 and 3.7 are considered within a fair valuation range.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Info Cards */}
              <div className="space-y-6 flex flex-col">
                <Card variant="glass" className="border-accent-primary/10 hover:border-accent-primary/40 transition-all">
                  <CardHeader className="pb-3">
                    <CardTitle variant="mono" className="text-sm text-text-secondary flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-text-accent" />
                      Realized Cap
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-text-primary font-mono">
                      ${(realizedCapMetrics.realized_cap / 1_000_000).toFixed(2)}M
                    </div>
                    <p className="text-xs text-text-tertiary font-mono uppercase tracking-wide mt-1">
                      Total Cost Basis
                    </p>
                  </CardContent>
                </Card>

                <Card variant="glass" className="border-accent-primary/10 hover:border-accent-primary/40 transition-all">
                  <CardHeader className="pb-3">
                    <CardTitle variant="mono" className="text-sm text-text-secondary flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-text-accent" />
                      Market Cap
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-text-primary font-mono">
                      ${(realizedCapMetrics.market_cap / 1_000_000).toFixed(2)}M
                    </div>
                    <p className="text-xs text-text-tertiary font-mono uppercase tracking-wide mt-1">
                      Current Valuation
                    </p>
                  </CardContent>
                </Card>

                <Card variant="glass" className="border-accent-primary/10 hover:border-accent-primary/40 transition-all">
                  <CardHeader className="pb-3">
                    <CardTitle variant="mono" className="text-sm text-text-secondary flex items-center gap-2">
                      <Coins className="w-4 h-4 text-text-accent" />
                      Current Price
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-text-primary font-mono">
                      ${realizedCapMetrics.current_price.toFixed(8)}
                    </div>
                    <p className="text-xs text-text-tertiary font-mono uppercase tracking-wide mt-1">
                      USD per DOG
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}

        {/* ═══ Supply in Profit/Loss ═══ */}
        {supplyProfitLoss && (
          <>
            <SectionDivider title="Supply in Profit/Loss" icon={TrendingUp} />
            <Card variant="glass" className="max-w-7xl mx-auto border-accent-primary/10">
              <CardHeader>
                <CardTitle className="text-text-accent text-xl font-display">
                  Supply Distribution by Profit/Loss Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="relative">
                    <div className="h-32 w-full bg-transparent overflow-hidden relative border border-border-subtle rounded-lg">
                      <div
                        className="absolute top-0 left-0 h-full flex items-center justify-center transition-all duration-500"
                        style={{
                          width: `${supplyProfitLoss.supply_in_profit_pct}%`,
                          background: 'linear-gradient(135deg, #2ECC71, #27AE60)'
                        }}
                      >
                        {supplyProfitLoss.supply_in_profit_pct > 15 && (
                          <span className="text-text-primary font-mono font-bold text-lg px-4">
                            {supplyProfitLoss.supply_in_profit_pct.toFixed(2)}%
                          </span>
                        )}
                      </div>
                      <div
                        className="absolute top-0 right-0 h-full flex items-center justify-center transition-all duration-500"
                        style={{
                          width: `${supplyProfitLoss.supply_in_loss_pct}%`,
                          background: 'linear-gradient(135deg, #E74C3C, #C0392B)'
                        }}
                      >
                        {supplyProfitLoss.supply_in_loss_pct > 15 && (
                          <span className="text-text-primary font-mono font-bold text-lg px-4">
                            {supplyProfitLoss.supply_in_loss_pct.toFixed(2)}%
                          </span>
                        )}
                      </div>
                      {supplyProfitLoss.supply_in_profit_pct <= 15 && (
                        <div className="absolute top-1/2 -translate-y-1/2 left-2 text-text-primary font-mono font-bold text-sm"
                          style={{ left: `${supplyProfitLoss.supply_in_profit_pct / 2}%` }}>
                          Profit: {supplyProfitLoss.supply_in_profit_pct.toFixed(2)}%
                        </div>
                      )}
                      {supplyProfitLoss.supply_in_loss_pct <= 15 && (
                        <div className="absolute top-1/2 -translate-y-1/2 text-text-primary font-mono font-bold text-sm"
                          style={{ right: `${supplyProfitLoss.supply_in_loss_pct / 2}%` }}>
                          Loss: {supplyProfitLoss.supply_in_loss_pct.toFixed(2)}%
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 md:gap-6">
                    <div className="p-4 bg-bg-elevated/50 border border-border-subtle rounded-lg">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-4 h-4 rounded-sm" style={{ background: 'linear-gradient(135deg, #2ECC71, #27AE60)' }} />
                        <h3 className="text-text-primary font-mono font-semibold text-sm">Supply in Profit</h3>
                      </div>
                      <div className="space-y-1">
                        <div className="text-2xl font-bold text-accent-positive font-mono">
                          {supplyProfitLoss.supply_in_profit_pct.toFixed(2)}%
                        </div>
                        <div className="text-text-secondary font-mono text-sm">
                          {formatDOG(supplyProfitLoss.supply_in_profit, true)}
                        </div>
                        <div className="text-text-tertiary font-mono text-xs">
                          Currently in profit
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-bg-elevated/50 border border-border-subtle rounded-lg">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-4 h-4 rounded-sm" style={{ background: 'linear-gradient(135deg, #E74C3C, #C0392B)' }} />
                        <h3 className="text-text-primary font-mono font-semibold text-sm">Supply in Loss</h3>
                      </div>
                      <div className="space-y-1">
                        <div className="text-2xl font-bold text-accent-negative font-mono">
                          {supplyProfitLoss.supply_in_loss_pct.toFixed(2)}%
                        </div>
                        <div className="text-text-secondary font-mono text-sm">
                          {formatDOG(supplyProfitLoss.supply_in_loss, true)}
                        </div>
                        <div className="text-text-tertiary font-mono text-xs">
                          Currently in loss
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* ═══ Historical Trends ═══ */}
        <HistoricalChartsSection />
      </div>
    </Layout>
  )
}
