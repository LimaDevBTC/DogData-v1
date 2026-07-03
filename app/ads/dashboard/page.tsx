'use client'

import { useEffect, useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { TrendingUp, MousePointer, Eye, Percent, Monitor, Smartphone } from 'lucide-react'

interface ReportData {
  advertiser: string
  period: { days: number; from: string; to: string }
  summary: { impressions: number; clicks: number; ctr: string }
  by_page: Record<string, { impressions: number; clicks: number }>
  by_device: Record<string, { impressions: number; clicks: number }>
  by_day: Record<string, { impressions: number; clicks: number }>
}

const ORANGE = '#f97316'
const BLUE = '#3b82f6'
const VOID = '#0A0A0C'

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
  color: string
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg" style={{ background: `${color}18` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <span className="text-[11px] font-mono uppercase tracking-widest text-gray-500">{label}</span>
      </div>
      <div className="text-3xl font-bold font-mono" style={{ color }}>{value}</div>
      {sub && <div className="text-xs font-mono text-gray-600">{sub}</div>}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-white/10 bg-[#111] px-4 py-3 text-xs font-mono shadow-xl">
      <div className="text-gray-400 mb-2">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-300">{p.name}:</span>
          <span className="text-white font-bold">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function AdsDashboard() {
  const [data, setData] = useState<ReportData | null>(null)
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/ads/report?days=${days}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [days])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0C] flex items-center justify-center">
        <div className="text-orange-500 font-mono text-sm animate-pulse">Loading...</div>
      </div>
    )
  }

  if (!data) return null

  // — Daily chart data —
  const dailyData = Object.entries(data.by_day)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date: date.slice(5), // MM-DD
      Impressões: v.impressions,
      Cliques: v.clicks,
    }))

  // — Page breakdown (top 8, excluding /test) —
  const pageData = Object.entries(data.by_page)
    .filter(([p]) => p !== '/test')
    .sort(([, a], [, b]) => (b.impressions + b.clicks) - (a.impressions + a.clicks))
    .slice(0, 8)
    .map(([page, v]) => ({
      page: page.replace('/address/bitcoin/', '/addr/').replace(/bc1[a-z0-9]{10,}/, addr => addr.slice(0, 8) + '…'),
      Impressões: v.impressions,
      Cliques: v.clicks,
    }))

  // — Device pie —
  const deviceData = Object.entries(data.by_device).map(([device, v]) => ({
    name: device === 'mobile' ? 'Mobile' : 'Desktop',
    value: v.impressions + v.clicks,
    impressions: v.impressions,
    clicks: v.clicks,
  }))
  const DEVICE_COLORS = ['#f97316', '#3b82f6']

  const totalEvents = data.summary.impressions + data.summary.clicks

  return (
    <div className="min-h-screen bg-[#0A0A0C] text-white px-4 py-10 md:px-10">

      {/* Header */}
      <div className="max-w-6xl mx-auto mb-10">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <img src="/Bitflow.png" alt="Bitflow" className="h-7 object-contain" />
              <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-orange-500/70">Ads Report</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold font-mono text-white">
              Banner Performance
            </h1>
            <p className="text-xs font-mono text-gray-500 mt-1">
              {new Date(data.period.from).toLocaleDateString('pt-BR')} → {new Date(data.period.to).toLocaleDateString('pt-BR')} · dogdata.xyz
            </p>
          </div>

          {/* Period selector */}
          <div className="flex gap-2">
            {[7, 14, 30, 60].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                  days === d
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                    : 'text-gray-500 border border-white/[0.06] hover:text-gray-300'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-8">

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Eye} label="Impressões" value={data.summary.impressions.toLocaleString('pt-BR')} color={ORANGE} />
          <StatCard icon={MousePointer} label="Cliques" value={data.summary.clicks.toLocaleString('pt-BR')} color={BLUE} />
          <StatCard icon={Percent} label="CTR" value={data.summary.ctr} sub="Cliques / Impressões" color="#a855f7" />
          <StatCard
            icon={TrendingUp}
            label="Páginas alcançadas"
            value={Object.keys(data.by_page).filter(p => p !== '/test').length}
            sub="com pelo menos 1 impressão"
            color="#22c55e"
          />
        </div>

        {/* Daily chart */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
          <h2 className="text-sm font-mono uppercase tracking-widest text-gray-400 mb-6">Impressões e Cliques por Dia</h2>
          {dailyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={dailyData}>
                <defs>
                  <linearGradient id="imp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={ORANGE} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={ORANGE} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="clk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={BLUE} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={BLUE} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'monospace', color: '#6b7280' }} />
                <Area type="monotone" dataKey="Impressões" stroke={ORANGE} fill="url(#imp)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="Cliques" stroke={BLUE} fill="url(#clk)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[220px] text-gray-600 font-mono text-sm">Sem dados suficientes ainda</div>
          )}
        </div>

        {/* Page breakdown + Device */}
        <div className="grid md:grid-cols-3 gap-6">

          {/* By page */}
          <div className="md:col-span-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
            <h2 className="text-sm font-mono uppercase tracking-widest text-gray-400 mb-6">Impressões por Página</h2>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={pageData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                <YAxis dataKey="page" type="category" tick={{ fill: '#9ca3af', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} width={90} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="Impressões" fill={ORANGE} radius={[0, 4, 4, 0]} />
                <Bar dataKey="Cliques" fill={BLUE} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* By device */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
            <h2 className="text-sm font-mono uppercase tracking-widest text-gray-400 mb-6">Por Dispositivo</h2>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={deviceData} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3}>
                  {deviceData.map((_, i) => (
                    <Cell key={i} fill={DEVICE_COLORS[i % DEVICE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-3 mt-4">
              {deviceData.map((d, i) => (
                <div key={d.name} className="flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2">
                    {d.name === 'Mobile' ? <Smartphone className="w-3.5 h-3.5" style={{ color: DEVICE_COLORS[i] }} /> : <Monitor className="w-3.5 h-3.5" style={{ color: DEVICE_COLORS[i] }} />}
                    <span className="text-gray-400">{d.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-white">{d.impressions} imp</span>
                    <span className="text-gray-600 mx-1">/</span>
                    <span style={{ color: BLUE }}>{d.clicks} cli</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-[10px] font-mono text-gray-700 pb-4">
          dogdata.xyz · dados atualizados em tempo real · {new Date().toLocaleString('pt-BR')}
        </div>
      </div>
    </div>
  )
}
