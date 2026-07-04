'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  Eye, Users, Layers, Globe, Monitor, Smartphone, Tablet,
  Zap, TrendingUp, RefreshCw, Activity, Chrome, Gauge,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface VitalData {
  p75: number; avg: number; good_pct: number; needs_pct: number; poor_pct: number
  rating: string; score: number; samples: number
}
interface Report {
  period: { days: number; from: string; to: string }
  summary: { pageviews: number; unique_sessions: number; avg_pages_per_session: number }
  by_day: Record<string, number>
  top_pages: { page: string; views: number }[]
  by_country: { country: string; views: number }[]
  by_device: Record<string, number>
  by_browser: { browser: string; views: number }[]
  by_referrer: { referrer: string; views: number }[]
  realtime: Record<string, number>
  web_vitals: Record<string, VitalData>
  performance_score: number | null
  vitals_by_day: Record<string, number | string>[]
  vitals_by_device: Record<string, number | string>[]
  slowest_pages: Record<string, { page: string; p75: number }[]>
}

// ─── Constants ───────────────────────────────────────────────────────────────

const C = {
  orange: '#f97316', blue: '#3b82f6', green: '#22c55e',
  purple: '#a855f7', cyan: '#06b6d4', yellow: '#eab308', red: '#ef4444',
  muted: '#6b7280',
}

const VITAL_META: Record<string, { label: string; unit: string; desc: string; good: number; poor: number; color: string }> = {
  LCP:  { label: 'LCP',  unit: 'ms', desc: 'Largest Contentful Paint',  good: 2500, poor: 4000, color: C.orange },
  FCP:  { label: 'FCP',  unit: 'ms', desc: 'First Contentful Paint',    good: 1800, poor: 3000, color: C.blue },
  TTFB: { label: 'TTFB', unit: 'ms', desc: 'Time to First Byte',        good: 800,  poor: 1800, color: C.purple },
  INP:  { label: 'INP',  unit: 'ms', desc: 'Interaction to Next Paint', good: 200,  poor: 500,  color: C.cyan },
  CLS:  { label: 'CLS',  unit: '',   desc: 'Cumulative Layout Shift',   good: 100,  poor: 250,  color: C.yellow },
}

const VITAL_ORDER = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB']
const DEVICE_COLORS  = [C.orange, C.blue, C.purple]
const BROWSER_COLORS = [C.orange, C.blue, C.green, C.purple, C.cyan, C.yellow]
const COUNTRY_FLAGS: Record<string, string> = {
  US:'🇺🇸',BR:'🇧🇷',GB:'🇬🇧',DE:'🇩🇪',FR:'🇫🇷',CA:'🇨🇦',AU:'🇦🇺',
  JP:'🇯🇵',IN:'🇮🇳',MX:'🇲🇽',AR:'🇦🇷',PT:'🇵🇹',ES:'🇪🇸',NL:'🇳🇱',
  KR:'🇰🇷',SG:'🇸🇬',TR:'🇹🇷',PL:'🇵🇱',IT:'🇮🇹',RU:'🇷🇺',
}

// ─── Utils ───────────────────────────────────────────────────────────────────

const fmtPage = (p: string) =>
  p.replace('/address/bitcoin/', '/addr/')
   .replace(/bc1[a-z0-9]{8,}/, a => a.slice(0, 8) + '…')

const fmtNum = (n: number) => n.toLocaleString('pt-BR')

const scoreColor = (s: number) =>
  s >= 90 ? C.green : s >= 50 ? C.yellow : C.red

const ratingColor = (r: string) =>
  r === 'good' ? C.green : r === 'needs-improvement' ? C.yellow : C.red

const ratingLabel = (r: string) =>
  r === 'good' ? 'Bom' : r === 'needs-improvement' ? 'Melhorar' : 'Ruim'

// ─── Shared components ────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-white/10 bg-[#111] px-4 py-3 text-xs font-mono shadow-2xl">
      {label && <div className="text-gray-400 mb-2">{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color ?? p.fill }} />
          <span className="text-gray-300">{p.name}:</span>
          <span className="text-white font-bold">{typeof p.value === 'number' ? fmtNum(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border bg-white/[0.02] p-5 border-white/[0.06] ${className}`}>{children}</div>
}

function SectionTitle({ children, icon: Icon, color = C.muted }: { children: React.ReactNode; icon?: React.ElementType; color?: string }) {
  return (
    <div className="flex items-center gap-2 mb-5">
      {Icon && <Icon className="w-4 h-4" style={{ color }} />}
      <h2 className="text-[11px] font-mono uppercase tracking-widest text-gray-500">{children}</h2>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string
}) {
  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg" style={{ background: `${color}18` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <span className="text-[11px] font-mono uppercase tracking-widest text-gray-500">{label}</span>
      </div>
      <div className="text-3xl font-bold font-mono mb-1" style={{ color }}>
        {typeof value === 'number' ? fmtNum(value) : value}
      </div>
      {sub && <div className="text-xs font-mono text-gray-600">{sub}</div>}
    </Card>
  )
}

// ─── Gauge SVG ────────────────────────────────────────────────────────────────

function ScoreGauge({ score }: { score: number }) {
  const color = scoreColor(score)
  const label = score >= 90 ? 'Ótimo' : score >= 50 ? 'Médio' : 'Ruim'
  const R = 52, cx = 70, cy = 70
  const startAngle = Math.PI * 0.75
  const endAngle   = Math.PI * 2.25
  const totalArc   = endAngle - startAngle
  const fillAngle  = startAngle + totalArc * (score / 100)
  const toXY = (a: number) => ({
    x: cx + R * Math.cos(a),
    y: cy + R * Math.sin(a),
  })
  const s = toXY(startAngle), e = toXY(fillAngle), bg = toXY(endAngle)
  const large = (angle: number) => angle > Math.PI ? 1 : 0
  return (
    <svg width={140} height={110} className="mx-auto">
      {/* background arc */}
      <path d={`M ${s.x} ${s.y} A ${R} ${R} 0 ${large(totalArc)} 1 ${bg.x} ${bg.y}`}
        stroke="#ffffff0a" strokeWidth={10} fill="none" strokeLinecap="round" />
      {/* fill arc */}
      {score > 0 && (
        <path d={`M ${s.x} ${s.y} A ${R} ${R} 0 ${large(fillAngle - startAngle)} 1 ${e.x} ${e.y}`}
          stroke={color} strokeWidth={10} fill="none" strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${color}66)` }} />
      )}
      <text x={cx} y={cy + 6} textAnchor="middle" fill="white" fontSize={26} fontWeight="bold" fontFamily="monospace">{score}</text>
      <text x={cx} y={cy + 22} textAnchor="middle" fill={color} fontSize={11} fontFamily="monospace">{label}</text>
    </svg>
  )
}

// ─── Vital Card (Speed section) ───────────────────────────────────────────────

function VitalCard({ name, data }: { name: string; data: VitalData }) {
  const meta = VITAL_META[name]
  if (!meta) return null
  const color  = ratingColor(data.rating)
  const label  = ratingLabel(data.rating)
  const fmtVal = name === 'CLS' ? (data.p75 / 1000).toFixed(3) : fmtNum(data.p75)

  return (
    <Card>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: meta.color }} />
            <span className="text-sm font-mono font-bold text-white">{meta.label}</span>
          </div>
          <div className="text-[10px] font-mono text-gray-600 mt-0.5 ml-4">{meta.desc}</div>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ background: `${color}18`, color }}>
          {label}
        </span>
      </div>

      {/* Value */}
      <div className="mb-3 ml-4">
        <span className="text-2xl font-bold font-mono" style={{ color }}>{fmtVal}</span>
        {meta.unit && <span className="text-sm text-gray-500 ml-1 font-mono">{meta.unit}</span>}
        <span className="text-[10px] text-gray-700 ml-2 font-mono">p75 · {data.samples} amostras</span>
      </div>

      {/* Distribution bar */}
      <div className="space-y-1.5">
        <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
          <div className="h-full rounded-l-full" style={{ width: `${data.good_pct}%`,  background: C.green }}  title={`Bom: ${data.good_pct}%`} />
          <div className="h-full"                style={{ width: `${data.needs_pct}%`, background: C.yellow }} title={`Médio: ${data.needs_pct}%`} />
          <div className="h-full rounded-r-full" style={{ width: `${data.poor_pct}%`,  background: C.red }}    title={`Ruim: ${data.poor_pct}%`} />
        </div>
        <div className="flex gap-3 text-[9px] font-mono">
          <span style={{ color: C.green  }}>● {data.good_pct}% bom</span>
          <span style={{ color: C.yellow }}>● {data.needs_pct}% médio</span>
          <span style={{ color: C.red    }}>● {data.poor_pct}% ruim</span>
        </div>
      </div>
    </Card>
  )
}

// ─── Tab button ───────────────────────────────────────────────────────────────

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-5 py-2.5 text-xs font-mono uppercase tracking-widest transition-all border-b-2 ${
        active
          ? 'text-orange-400 border-orange-500'
          : 'text-gray-600 border-transparent hover:text-gray-400'
      }`}>
      {children}
    </button>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function AnalyticsDashboard() {
  const [data,    setData]    = useState<Report | null>(null)
  const [days,    setDays]    = useState(30)
  const [tab,     setTab]     = useState<'traffic' | 'speed'>('traffic')
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const load = useCallback((d: number) => {
    setLoading(true)
    fetch(`/api/analytics/report?days=${d}`)
      .then(r => r.json())
      .then(r => { setData(r); setLastRefresh(new Date()); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { load(days) }, [days, load])
  useEffect(() => {
    const t = setInterval(() => load(days), 60_000)
    return () => clearInterval(t)
  }, [days, load])

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#0A0A0C] flex items-center justify-center">
        <div className="text-center font-mono">
          <div className="text-orange-500 text-sm animate-pulse mb-2">Carregando analytics...</div>
          <div className="text-gray-700 text-xs">Aguarde...</div>
        </div>
      </div>
    )
  }
  if (!data) return null

  // — Derived —
  const dailyData    = Object.entries(data.by_day).sort(([a],[b])=>a.localeCompare(b)).map(([date,views])=>({ date: date.slice(5), Views: views }))
  const deviceData   = Object.entries(data.by_device).map(([name,value])=>({ name: name.charAt(0).toUpperCase()+name.slice(1), value }))
  const realtimeData = Object.entries(data.realtime).reverse().map(([label,value])=>({ label, value }))
  const totalViews   = data.summary.pageviews || 1
  const topCtry      = data.by_country[0]?.views || 1
  const vitalNames   = VITAL_ORDER.filter(n => data.web_vitals[n])
  const score        = data.performance_score

  return (
    <div className="min-h-screen bg-[#0A0A0C] text-white px-4 py-10 md:px-10">
      <div className="max-w-7xl mx-auto">

        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4 text-orange-500" />
              <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-orange-500/70">DOG DATA Analytics</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold font-mono">Site Dashboard</h1>
            <p className="text-xs font-mono text-gray-600 mt-1">
              {new Date(data.period.from).toLocaleDateString('pt-BR')} → {new Date(data.period.to).toLocaleDateString('pt-BR')}
              <span className="ml-3 text-gray-700">· atualizado {lastRefresh.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => load(days)} className="p-2 rounded-lg border border-white/[0.06] text-gray-500 hover:text-white transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
            <div className="flex gap-2">
              {[7,14,30,60,90].map(d => (
                <button key={d} onClick={() => setDays(d)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${days===d?'bg-orange-500/20 text-orange-400 border border-orange-500/30':'text-gray-500 border border-white/[0.06] hover:text-gray-300'}`}>
                  {d}d
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex border-b border-white/[0.06] mb-8">
          <Tab active={tab==='traffic'} onClick={()=>setTab('traffic')}>📊 Tráfego</Tab>
          <Tab active={tab==='speed'}   onClick={()=>setTab('speed')}>⚡ Velocidade</Tab>
        </div>

        {/* ════════════════════════════════ TRAFFIC TAB ═════════════════════ */}
        {tab === 'traffic' && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard icon={Eye}      label="Page Views"     value={data.summary.pageviews}             color={C.orange} />
              <StatCard icon={Users}    label="Sessões"        value={data.summary.unique_sessions}       color={C.blue} />
              <StatCard icon={Layers}   label="Páginas/Sessão" value={data.summary.avg_pages_per_session} color={C.purple} sub="média" />
              <StatCard icon={Globe}    label="Países"         value={data.by_country.length}             color={C.green} />
            </div>

            {/* Timeline */}
            <Card className="mb-8">
              <SectionTitle>Page Views por Dia</SectionTitle>
              {dailyData.length > 1 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={dailyData}>
                    <defs>
                      <linearGradient id="gV" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={C.orange} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={C.orange} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff06" />
                    <XAxis dataKey="date" tick={{fill:C.muted,fontSize:11,fontFamily:'monospace'}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fill:C.muted,fontSize:11,fontFamily:'monospace'}} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="Views" stroke={C.orange} fill="url(#gV)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[220px] text-gray-700 font-mono text-sm">Aguardando dados suficientes...</div>
              )}
            </Card>

            {/* Real-time + Top pages */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <Card>
                <div className="flex items-center gap-2 mb-5">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <h2 className="text-[11px] font-mono uppercase tracking-widest text-gray-500">Últimos 30 minutos</h2>
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={realtimeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff06" vertical={false} />
                    <XAxis dataKey="label" tick={{fill:C.muted,fontSize:10,fontFamily:'monospace'}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fill:C.muted,fontSize:10,fontFamily:'monospace'}} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Views" fill={C.green} radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
              <Card>
                <SectionTitle>Top Páginas</SectionTitle>
                <div className="space-y-2.5">
                  {data.top_pages.slice(0,7).map((p,i)=>(
                    <div key={p.page} className="flex items-center gap-3">
                      <span className="text-[10px] font-mono text-gray-700 w-4">{i+1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between mb-0.5">
                          <span className="text-xs font-mono text-gray-300 truncate">{fmtPage(p.page)}</span>
                          <span className="text-xs font-mono text-white ml-2 flex-shrink-0">{fmtNum(p.views)}</span>
                        </div>
                        <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden">
                          <div className="h-full rounded-full" style={{width:`${(p.views/(data.top_pages[0]?.views||1))*100}%`,background:C.orange,opacity:0.7-i*0.07}} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Device + Browser + Referrer */}
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <Card>
                <SectionTitle>Dispositivo</SectionTitle>
                <ResponsiveContainer width="100%" height={130}>
                  <PieChart>
                    <Pie data={deviceData} dataKey="value" cx="50%" cy="50%" innerRadius={38} outerRadius={58} paddingAngle={3}>
                      {deviceData.map((_,i)=><Cell key={i} fill={DEVICE_COLORS[i]} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-2">
                  {deviceData.map((d,i)=>{
                    const Icon = d.name==='Mobile'?Smartphone:d.name==='Tablet'?Tablet:Monitor
                    return (
                      <div key={d.name} className="flex items-center justify-between text-xs font-mono">
                        <div className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5" style={{color:DEVICE_COLORS[i]}} />
                          <span className="text-gray-400">{d.name}</span>
                        </div>
                        <span className="text-white">{fmtNum(d.value)} <span className="text-gray-600">({Math.round(d.value/totalViews*100)}%)</span></span>
                      </div>
                    )
                  })}
                </div>
              </Card>
              <Card>
                <SectionTitle>Browser</SectionTitle>
                <div className="space-y-2.5 mt-1">
                  {data.by_browser.map((b,i)=>(
                    <div key={b.browser} className="flex items-center gap-3">
                      <Chrome className="w-3.5 h-3.5 flex-shrink-0" style={{color:BROWSER_COLORS[i]}} />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between mb-0.5">
                          <span className="text-xs font-mono text-gray-300">{b.browser}</span>
                          <span className="text-xs font-mono text-white">{fmtNum(b.views)}</span>
                        </div>
                        <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden">
                          <div className="h-full rounded-full" style={{width:`${(b.views/(data.by_browser[0]?.views||1))*100}%`,background:BROWSER_COLORS[i]}} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
              <Card>
                <SectionTitle>Fontes de Tráfego</SectionTitle>
                <div className="space-y-2.5 mt-1">
                  {data.by_referrer.slice(0,7).map((r,i)=>(
                    <div key={r.referrer} className="flex items-center gap-3">
                      <TrendingUp className="w-3.5 h-3.5 flex-shrink-0 text-gray-700" />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between mb-0.5">
                          <span className="text-xs font-mono text-gray-300 truncate">{r.referrer}</span>
                          <span className="text-xs font-mono text-white ml-2 flex-shrink-0">{fmtNum(r.views)}</span>
                        </div>
                        <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden">
                          <div className="h-full rounded-full bg-cyan-500" style={{width:`${(r.views/(data.by_referrer[0]?.views||1))*100}%`,opacity:0.8-i*0.08}} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Countries */}
            <Card className="mb-8">
              <SectionTitle>Top Países</SectionTitle>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {data.by_country.slice(0,15).map(c=>(
                  <div key={c.country} className="flex items-center gap-2.5 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <span className="text-xl">{COUNTRY_FLAGS[c.country]??'🌐'}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-gray-400">{c.country}</div>
                      <div className="text-sm font-bold font-mono text-white">{fmtNum(c.views)}</div>
                      <div className="text-[10px] font-mono text-gray-700">{Math.round(c.views/topCtry*100)}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}

        {/* ═══════════════════════════════ SPEED TAB ════════════════════════ */}
        {tab === 'speed' && (
          <>
            {/* Score + Vital Cards */}
            <div className="grid md:grid-cols-3 gap-6 mb-8">

              {/* Performance Score */}
              <Card className="flex flex-col items-center justify-center text-center">
                <SectionTitle icon={Gauge} color={C.yellow}>Performance Score</SectionTitle>
                {score != null ? (
                  <>
                    <ScoreGauge score={score} />
                    <p className="text-[10px] font-mono text-gray-700 mt-2">Ponderado: LCP 25% · INP 25% · CLS 25% · FCP 15% · TTFB 10%</p>
                  </>
                ) : (
                  <div className="text-gray-700 font-mono text-sm py-8">Aguardando amostras de Web Vitals...</div>
                )}
              </Card>

              {/* Score breakdown per vital */}
              <div className="md:col-span-2">
                <Card className="h-full">
                  <SectionTitle icon={Zap} color={C.yellow}>Score por Métrica</SectionTitle>
                  <div className="space-y-3">
                    {VITAL_ORDER.filter(n=>data.web_vitals[n]).map(name=>{
                      const v = data.web_vitals[name]
                      const m = VITAL_META[name]
                      const col = ratingColor(v.rating)
                      return (
                        <div key={name} className="flex items-center gap-3">
                          <span className="w-10 text-xs font-mono font-bold text-white flex-shrink-0">{name}</span>
                          <div className="flex-1 h-2 rounded-full bg-white/[0.04] overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700" style={{width:`${v.score}%`,background:col}} />
                          </div>
                          <span className="w-8 text-xs font-mono font-bold flex-shrink-0" style={{color:col}}>{v.score}</span>
                          <span className="text-[10px] font-mono text-gray-600 w-16 flex-shrink-0">
                            {name==='CLS'?(v.p75/1000).toFixed(3):`${fmtNum(v.p75)}ms`}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              </div>
            </div>

            {/* Vital Cards grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {VITAL_ORDER.filter(n=>data.web_vitals[n]).map(name=>(
                <VitalCard key={name} name={name} data={data.web_vitals[name]} />
              ))}
            </div>

            {/* Vitals trend over time */}
            {data.vitals_by_day.length > 1 && (
              <Card className="mb-8">
                <SectionTitle icon={TrendingUp} color={C.cyan}>Tendência de Vitals por Dia</SectionTitle>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={data.vitals_by_day}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff06" />
                    <XAxis dataKey="date" tick={{fill:C.muted,fontSize:11,fontFamily:'monospace'}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fill:C.muted,fontSize:11,fontFamily:'monospace'}} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{fontSize:11,fontFamily:'monospace',color:C.muted}} />
                    {vitalNames.filter(n=>n!=='CLS').map(name=>(
                      <Line key={name} type="monotone" dataKey={name} stroke={VITAL_META[name].color} strokeWidth={2} dot={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            )}

            {/* Mobile vs Desktop */}
            {data.vitals_by_device.length > 0 && (
              <Card className="mb-8">
                <SectionTitle icon={Smartphone} color={C.blue}>Mobile vs Desktop — p75 por Vital (ms)</SectionTitle>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="text-gray-600 uppercase text-[10px] tracking-wider">
                        <th className="text-left py-2 pr-4">Dispositivo</th>
                        {VITAL_ORDER.filter(n=>data.web_vitals[n]).map(n=>(
                          <th key={n} className="text-right py-2 px-3">{n}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.vitals_by_device.map((row,i)=>(
                        <tr key={i} className="border-t border-white/[0.04]">
                          <td className="py-3 pr-4 text-gray-300 capitalize flex items-center gap-2">
                            {row.device === 'mobile' ? <Smartphone className="w-3.5 h-3.5 text-orange-500" /> : <Monitor className="w-3.5 h-3.5 text-blue-500" />}
                            {String(row.device)}
                          </td>
                          {VITAL_ORDER.filter(n=>data.web_vitals[n]).map(name=>{
                            const val = row[name] as number | undefined
                            if (val == null) return <td key={name} className="text-right py-3 px-3 text-gray-700">—</td>
                            const meta = VITAL_META[name]
                            const col  = val <= meta.good ? C.green : val <= meta.poor ? C.yellow : C.red
                            return (
                              <td key={name} className="text-right py-3 px-3 font-bold" style={{color:col}}>
                                {name==='CLS'?(val/1000).toFixed(3):`${fmtNum(val)}ms`}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* Slowest pages */}
            {Object.keys(data.slowest_pages).length > 0 && (
              <div className="mb-8">
                <SectionTitle icon={Activity} color={C.red}>Páginas mais lentas por Métrica</SectionTitle>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {VITAL_ORDER.filter(n=>data.slowest_pages[n]?.length).map(name=>{
                    const meta   = VITAL_META[name]
                    const pages  = data.slowest_pages[name]
                    const maxVal = pages[0]?.p75 || 1
                    return (
                      <Card key={name}>
                        <div className="flex items-center gap-2 mb-4">
                          <span className="w-2 h-2 rounded-full" style={{background:meta.color}} />
                          <span className="text-xs font-mono font-bold text-white">{meta.label}</span>
                          <span className="text-[10px] font-mono text-gray-600">— {meta.desc}</span>
                        </div>
                        <div className="space-y-2">
                          {pages.slice(0,5).map(p=>{
                            const col = p.p75<=meta.good?C.green:p.p75<=meta.poor?C.yellow:C.red
                            return (
                              <div key={p.page} className="flex items-center gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex justify-between mb-0.5">
                                    <span className="text-[10px] font-mono text-gray-400 truncate">{fmtPage(p.page)}</span>
                                    <span className="text-[10px] font-mono ml-2 flex-shrink-0 font-bold" style={{color:col}}>
                                      {name==='CLS'?(p.p75/1000).toFixed(3):`${fmtNum(p.p75)}ms`}
                                    </span>
                                  </div>
                                  <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden">
                                    <div className="h-full rounded-full" style={{width:`${(p.p75/maxVal)*100}%`,background:col}} />
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </Card>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Thresholds reference */}
            <Card className="mb-8">
              <SectionTitle>Referência de Thresholds (Google)</SectionTitle>
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="text-gray-600 uppercase text-[10px] tracking-wider">
                      <th className="text-left py-2 pr-6">Métrica</th>
                      <th className="text-left py-2 pr-6">Descrição</th>
                      <th className="text-center py-2 px-4">🟢 Bom</th>
                      <th className="text-center py-2 px-4">🟡 Melhorar</th>
                      <th className="text-center py-2 px-4">🔴 Ruim</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(VITAL_META).map(([name,m])=>(
                      <tr key={name} className="border-t border-white/[0.04]">
                        <td className="py-2.5 pr-6 font-bold" style={{color:m.color}}>{name}</td>
                        <td className="py-2.5 pr-6 text-gray-500">{m.desc}</td>
                        <td className="py-2.5 px-4 text-center text-green-400">≤ {name==='CLS'?(m.good/1000).toFixed(2):`${m.good}ms`}</td>
                        <td className="py-2.5 px-4 text-center text-yellow-400">&lt; {name==='CLS'?(m.poor/1000).toFixed(2):`${m.poor}ms`}</td>
                        <td className="py-2.5 px-4 text-center text-red-400">≥ {name==='CLS'?(m.poor/1000).toFixed(2):`${m.poor}ms`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}

        <div className="text-center text-[10px] font-mono text-gray-800 pb-4">
          dogdata.xyz analytics · auto-refresh 60s · {new Date().toLocaleString('pt-BR')}
        </div>
      </div>
    </div>
  )
}
