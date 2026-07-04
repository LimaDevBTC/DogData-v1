'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  Eye, Users, Layers, Globe, Monitor, Smartphone, Tablet,
  Zap, TrendingUp, RefreshCw, Activity, Chrome,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Report {
  period: { days: number; from: string; to: string }
  summary: { pageviews: number; unique_sessions: number; avg_pages_per_session: number }
  by_day: Record<string, number>
  top_pages: { page: string; views: number }[]
  by_country: { country: string; views: number }[]
  by_device: Record<string, number>
  by_browser: { browser: string; views: number }[]
  by_referrer: { referrer: string; views: number }[]
  web_vitals: Record<string, { p75: number; avg: number; good_pct: number; rating: string }>
  realtime: Record<string, number>
}

// ─── Theme ───────────────────────────────────────────────────────────────────

const C = {
  orange: '#f97316',
  blue:   '#3b82f6',
  green:  '#22c55e',
  purple: '#a855f7',
  cyan:   '#06b6d4',
  yellow: '#eab308',
  red:    '#ef4444',
  muted:  '#6b7280',
  border: 'rgba(255,255,255,0.06)',
  card:   'rgba(255,255,255,0.02)',
}

const DEVICE_COLORS  = [C.orange, C.blue, C.purple]
const BROWSER_COLORS = [C.orange, C.blue, C.green, C.purple, C.cyan, C.yellow]
const COUNTRY_FLAGS: Record<string, string> = {
  US:'🇺🇸', BR:'🇧🇷', GB:'🇬🇧', DE:'🇩🇪', FR:'🇫🇷', CA:'🇨🇦', AU:'🇦🇺',
  JP:'🇯🇵', IN:'🇮🇳', MX:'🇲🇽', AR:'🇦🇷', PT:'🇵🇹', ES:'🇪🇸', NL:'🇳🇱',
  KR:'🇰🇷', SG:'🇸🇬', TR:'🇹🇷', PL:'🇵🇱', IT:'🇮🇹', RU:'🇷🇺',
}

// ─── Vital thresholds (ms, except CLS × 1000) ────────────────────────────────

const VITAL_META: Record<string, { label: string; unit: string; good: number; poor: number; desc: string }> = {
  LCP:  { label: 'LCP',  unit: 'ms', good: 2500, poor: 4000, desc: 'Largest Contentful Paint' },
  FCP:  { label: 'FCP',  unit: 'ms', good: 1800, poor: 3000, desc: 'First Contentful Paint' },
  TTFB: { label: 'TTFB', unit: 'ms', good: 800,  poor: 1800, desc: 'Time to First Byte' },
  CLS:  { label: 'CLS',  unit: '',   good: 100,  poor: 250,  desc: 'Cumulative Layout Shift ×1000' },
  INP:  { label: 'INP',  unit: 'ms', good: 200,  poor: 500,  desc: 'Interaction to Next Paint' },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtPage = (p: string) =>
  p.replace('/address/bitcoin/', '/addr/').replace(/bc1[a-z0-9]{8,}/, a => a.slice(0, 8) + '…')

const fmtNum = (n: number) => n.toLocaleString('pt-BR')

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-white/10 bg-[#111] px-4 py-3 text-xs font-mono shadow-2xl">
      {label && <div className="text-gray-400 mb-2">{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color || p.fill }} />
          <span className="text-gray-300">{p.name}:</span>
          <span className="text-white font-bold">{typeof p.value === 'number' ? fmtNum(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border bg-white/[0.02] p-5 border-white/[0.06] ${className}`}>
      {children}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[11px] font-mono uppercase tracking-widest text-gray-500 mb-5">{children}</h2>
}

function StatCard({ icon: Icon, label, value, sub, color, delta }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string; delta?: string
}) {
  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg" style={{ background: `${color}18` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <span className="text-[11px] font-mono uppercase tracking-widest text-gray-500">{label}</span>
      </div>
      <div className="text-3xl font-bold font-mono mb-1" style={{ color }}>{typeof value === 'number' ? fmtNum(value) : value}</div>
      {sub && <div className="text-xs font-mono text-gray-600">{sub}</div>}
    </Card>
  )
}

function VitalCard({ name, data }: { name: string; data: { p75: number; avg: number; good_pct: number; rating: string } }) {
  const meta = VITAL_META[name]
  if (!meta) return null
  const color = data.rating === 'good' ? C.green : data.rating === 'needs-improvement' ? C.yellow : C.red
  const label = data.rating === 'good' ? 'Bom' : data.rating === 'needs-improvement' ? 'Melhorar' : 'Ruim'
  return (
    <Card>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-xs font-mono font-bold text-white">{meta.label}</div>
          <div className="text-[10px] font-mono text-gray-600 mt-0.5">{meta.desc}</div>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full" style={{ background: `${color}18`, color }}>
          {label}
        </span>
      </div>
      <div className="text-2xl font-bold font-mono mb-1" style={{ color }}>
        {fmtNum(data.p75)}{meta.unit && <span className="text-sm text-gray-500 ml-1">{meta.unit}</span>}
      </div>
      <div className="text-[10px] font-mono text-gray-600">p75 · {data.good_pct}% bom</div>
      {/* Rating bar */}
      <div className="mt-3 h-1 rounded-full bg-white/[0.06] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${data.good_pct}%`, background: color }} />
      </div>
    </Card>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AnalyticsDashboard() {
  const [data, setData] = useState<Report | null>(null)
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const load = useCallback((d: number) => {
    setLoading(true)
    fetch(`/api/analytics/report?days=${d}`)
      .then(r => r.json())
      .then(r => { setData(r); setLastRefresh(new Date()); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { load(days) }, [days, load])

  // Auto-refresh every 60s
  useEffect(() => {
    const t = setInterval(() => load(days), 60_000)
    return () => clearInterval(t)
  }, [days, load])

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#0A0A0C] flex items-center justify-center">
        <div className="text-center font-mono">
          <div className="text-orange-500 text-sm animate-pulse mb-2">Carregando analytics...</div>
          <div className="text-gray-700 text-xs">Buscando dados do Supabase</div>
        </div>
      </div>
    )
  }

  if (!data) return null

  // — Derived data —
  const dailyData = Object.entries(data.by_day)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, views]) => ({ date: date.slice(5), Views: views }))

  const deviceData = Object.entries(data.by_device).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
  }))

  const realtimeData = Object.entries(data.realtime)
    .reverse()
    .map(([label, value]) => ({ label, value }))

  const totalViews = data.summary.pageviews
  const topCountryViews = data.by_country[0]?.views ?? 1

  return (
    <div className="min-h-screen bg-[#0A0A0C] text-white px-4 py-10 md:px-10">
      <div className="max-w-7xl mx-auto">

        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4 text-orange-500" />
              <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-orange-500/70">DOG DATA Analytics</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold font-mono">Site Performance</h1>
            <p className="text-xs font-mono text-gray-600 mt-1">
              {new Date(data.period.from).toLocaleDateString('pt-BR')} → {new Date(data.period.to).toLocaleDateString('pt-BR')}
              <span className="ml-3 text-gray-700">· refresh {lastRefresh.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => load(days)} className="p-2 rounded-lg border border-white/[0.06] text-gray-500 hover:text-white transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
            <div className="flex gap-2">
              {[7, 14, 30, 60, 90].map(d => (
                <button key={d} onClick={() => setDays(d)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                    days === d
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                      : 'text-gray-500 border border-white/[0.06] hover:text-gray-300'
                  }`}
                >{d}d</button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Summary cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard icon={Eye}       label="Page Views"       value={data.summary.pageviews}           color={C.orange} />
          <StatCard icon={Users}     label="Sessões únicas"   value={data.summary.unique_sessions}     color={C.blue} />
          <StatCard icon={Layers}    label="Páginas/Sessão"   value={data.summary.avg_pages_per_session} sub="média"  color={C.purple} />
          <StatCard icon={Globe}     label="Países"           value={data.by_country.length}           color={C.green} />
        </div>

        {/* ── Pageviews over time ── */}
        <Card className="mb-8">
          <SectionTitle>Page Views por Dia</SectionTitle>
          {dailyData.length > 1 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={dailyData}>
                <defs>
                  <linearGradient id="gViews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.orange} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={C.orange} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff06" />
                <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 11, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: C.muted, fontSize: 11, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="Views" stroke={C.orange} fill="url(#gViews)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[220px] text-gray-700 font-mono text-sm">
              Dados insuficientes — aguarde mais acessos
            </div>
          )}
        </Card>

        {/* ── Real-time + Top pages ── */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">

          {/* Real-time */}
          <Card>
            <div className="flex items-center gap-2 mb-5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <SectionTitle>Últimos 30 minutos</SectionTitle>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={realtimeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff06" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: C.muted, fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="Views" fill={C.green} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Top pages */}
          <Card>
            <SectionTitle>Top Páginas</SectionTitle>
            <div className="space-y-2">
              {data.top_pages.slice(0, 7).map((p, i) => (
                <div key={p.page} className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-gray-700 w-4">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-mono text-gray-300 truncate">{fmtPage(p.page)}</span>
                      <span className="text-xs font-mono text-white ml-2 flex-shrink-0">{fmtNum(p.views)}</span>
                    </div>
                    <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(p.views / (data.top_pages[0]?.views || 1)) * 100}%`, background: C.orange, opacity: 0.7 - i * 0.07 }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ── Device + Browser + Referrer ── */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">

          {/* Device */}
          <Card>
            <SectionTitle>Dispositivo</SectionTitle>
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie data={deviceData} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={3}>
                  {deviceData.map((_, i) => <Cell key={i} fill={DEVICE_COLORS[i]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 mt-2">
              {deviceData.map((d, i) => {
                const Icon = d.name === 'Mobile' ? Smartphone : d.name === 'Tablet' ? Tablet : Monitor
                return (
                  <div key={d.name} className="flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5" style={{ color: DEVICE_COLORS[i] }} />
                      <span className="text-gray-400">{d.name}</span>
                    </div>
                    <span className="text-white">{fmtNum(d.value)} <span className="text-gray-600">({Math.round(d.value / totalViews * 100)}%)</span></span>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Browser */}
          <Card>
            <SectionTitle>Browser</SectionTitle>
            <div className="space-y-2.5 mt-2">
              {data.by_browser.map((b, i) => (
                <div key={b.browser} className="flex items-center gap-3">
                  <Chrome className="w-3.5 h-3.5 flex-shrink-0" style={{ color: BROWSER_COLORS[i] }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between mb-0.5">
                      <span className="text-xs font-mono text-gray-300">{b.browser}</span>
                      <span className="text-xs font-mono text-white">{fmtNum(b.views)}</span>
                    </div>
                    <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(b.views / (data.by_browser[0]?.views || 1)) * 100}%`, background: BROWSER_COLORS[i] }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Referrers */}
          <Card>
            <SectionTitle>Fontes de Tráfego</SectionTitle>
            <div className="space-y-2.5 mt-2">
              {data.by_referrer.slice(0, 7).map((r, i) => (
                <div key={r.referrer} className="flex items-center gap-3">
                  <TrendingUp className="w-3.5 h-3.5 flex-shrink-0 text-gray-600" />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between mb-0.5">
                      <span className="text-xs font-mono text-gray-300 truncate">{r.referrer}</span>
                      <span className="text-xs font-mono text-white ml-2 flex-shrink-0">{fmtNum(r.views)}</span>
                    </div>
                    <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden">
                      <div className="h-full rounded-full bg-cyan-500" style={{ width: `${(r.views / (data.by_referrer[0]?.views || 1)) * 100}%`, opacity: 0.8 - i * 0.08 }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ── Countries ── */}
        <Card className="mb-8">
          <SectionTitle>Top Países</SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {data.by_country.slice(0, 15).map((c, i) => (
              <div key={c.country} className="flex items-center gap-2.5 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <span className="text-xl">{COUNTRY_FLAGS[c.country] ?? '🌐'}</span>
                <div className="min-w-0">
                  <div className="text-xs font-mono text-gray-400">{c.country}</div>
                  <div className="text-sm font-bold font-mono text-white">{fmtNum(c.views)}</div>
                  <div className="text-[10px] font-mono text-gray-700">{Math.round(c.views / topCountryViews * 100)}%</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* ── Web Vitals ── */}
        {Object.keys(data.web_vitals).length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-5">
              <Zap className="w-4 h-4 text-yellow-500" />
              <h2 className="text-[11px] font-mono uppercase tracking-widest text-gray-500">Core Web Vitals</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {Object.entries(data.web_vitals).map(([name, vdata]) => (
                <VitalCard key={name} name={name} data={vdata} />
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-[10px] font-mono text-gray-800 pb-4">
          dogdata.xyz analytics · auto-refresh a cada 60s · {new Date().toLocaleString('pt-BR')}
        </div>
      </div>
    </div>
  )
}
