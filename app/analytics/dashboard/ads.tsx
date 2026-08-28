"use client"

// ═══════════════════════════════════════════════════════════════════════════
// ADS — banner delivery for the current advertiser.
//
// Impressions and clicks are the same unit (events), so they share one axis
// legitimately, and the fact that the clicks bar is a sliver IS the story: it
// is the CTR, drawn. What is gone is the two-slice device donut — a pie with
// two segments is a stat pair wearing a chart.
// ═══════════════════════════════════════════════════════════════════════════

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"
import { Monitor, MousePointerClick, Smartphone } from "lucide-react"
import { Reveal } from "@/app/dogcity/motion"
import type { AdsReport } from "./types"
import {
  AXIS_TICK, CAT, ChartFrame, ChartTooltip, EmptyPlot, GRID, HAIR, HAIR_SOFT,
  Plate, PlateHead, PlotGrid, SectionHead, ShareBar, StatTile,
  fmtCompact, fmtNum, fmtPage,
} from "./ui"

const SERIES = [
  { key: "Impressions", color: CAT[0] },
  { key: "Clicks", color: CAT[1] },
]

export default function Ads({ data }: { data: AdsReport }) {
  const daily = Object.entries(data.by_day)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date: date.slice(5), full: date,
      "Impressions": v.impressions, "Clicks": v.clicks,
    }))

  const pages = Object.entries(data.by_page)
    .filter(([p]) => p !== "/test")
    .sort(([, a], [, b]) => b.impressions - a.impressions)
    .slice(0, 8)
    .map(([page, v]) => ({
      page: fmtPage(page),
      "Impressions": v.impressions, "Clicks": v.clicks,
    }))

  const devices = Object.entries(data.by_device).map(([device, v], i) => ({
    label: device === "mobile" ? "Mobile" : "Desktop",
    value: v.impressions,
    clicks: v.clicks,
    ctr: v.impressions ? `${((v.clicks / v.impressions) * 100).toFixed(2)}%` : "—",
    color: CAT[Math.min(1, i)],
  }))

  const reach = Object.keys(data.by_page).filter((p) => p !== "/test").length
  const impTrend = daily.slice(-14).map((d) => d["Impressions"])
  const impPerDay = daily.length ? data.summary.impressions / daily.length : 0

  return (
    <div className="space-y-12 md:space-y-16">

      <section>
        <SectionHead
          eyebrow={`ENTREGA · ${data.advertiser.toUpperCase()}`}
          title="Banner performance in the period."
          sub="An impression counts when the banner enters the viewport; a click, when it is opened. Both are first-party, measured by the site itself."
        />

        <Reveal delay={0.48} y={16}>
          <div className={`mt-10 flex items-center gap-4 border ${HAIR} bg-white/[0.02] p-4`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/Bitflow.png" alt={data.advertiser} className="h-8 object-contain shrink-0" />
            <div className={`h-8 w-px ${HAIR} border-l shrink-0`} />
            <div>
              <div className="font-mono text-[11px] font-bold text-snow tracking-wide">
                {data.advertiser} — banner
              </div>
              <div className="font-mono text-[10px] text-dusty mt-0.5 tabular-nums">
                {new Date(data.period.from).toLocaleDateString("pt-BR")} → {new Date(data.period.to).toLocaleDateString("pt-BR")}
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.56} y={16}>
          <PlotGrid className="mt-6 grid-cols-2 lg:grid-cols-4">
            <StatTile label="Clicks" value={data.summary.clicks} accent={CAT[1]}
              sub="destino aberto" delay={0.05} />
            <StatTile label="CTR" value={parseFloat(data.summary.ctr) || 0}
              format={(n) => `${n.toFixed(2)}%`} accent={CAT[2]}
              sub="clicks / impressions" delay={0.1} />
            <StatTile label="Impressions / day" value={impPerDay} format={(n) => n.toFixed(0)}
              trend={impTrend} accent={CAT[0]} sub="average in the period" delay={0.15} />
            <StatTile label="Pages reached" value={reach} accent={CAT[1]}
              sub="with at least 1 impression" delay={0.2} />
          </PlotGrid>
        </Reveal>
      </section>

      <Reveal y={18}>
        <ChartFrame
          eyebrow="Impressions and clicks per day"
          legend={SERIES.map((s) => ({ label: s.key, color: s.color }))}
          table={{
            head: ["Dia", "Impressions", "Clicks"],
            rows: daily.map((d) => [d.full, d["Impressions"], d["Clicks"]]),
          }}
        >
          {daily.length > 1 ? (
            <ResponsiveContainer width="100%" height={252}>
              <AreaChart data={daily} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  {SERIES.map((s, i) => (
                    <linearGradient key={s.key} id={`ads-g${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={s.color} stopOpacity={0.2} />
                      <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="date" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={52} tickFormatter={fmtCompact} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#ffffff25", strokeWidth: 1 }} />
                {SERIES.map((s, i) => (
                  <Area key={s.key} type="monotone" dataKey={s.key} stroke={s.color} strokeWidth={2}
                    fill={`url(#ads-g${i})`} dot={false}
                    activeDot={{ r: 4, fill: s.color, stroke: "#050505", strokeWidth: 2 }} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyPlot height={252}>sem dados no período</EmptyPlot>
          )}
        </ChartFrame>
      </Reveal>

      <div className="grid xl:grid-cols-3 gap-6">
        <Reveal y={18} className="xl:col-span-2">
          <ChartFrame
            eyebrow="Onde o banner apareceu"
            legend={SERIES.map((s) => ({ label: s.key, color: s.color }))}
            table={{
              head: ["Página", "Impressions", "Clicks"],
              rows: pages.map((p) => [p.page, p["Impressions"], p["Clicks"]]),
            }}
          >
            {pages.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(200, pages.length * 42)}>
                <BarChart data={pages} layout="vertical" barGap={2}
                  margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} horizontal={false} />
                  <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false}
                    tickFormatter={fmtCompact} />
                  <YAxis dataKey="page" type="category" tick={{ ...AXIS_TICK, fill: "#9CA3AF" }}
                    axisLine={false} tickLine={false} width={116} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "#ffffff08" }} />
                  {SERIES.map((s) => (
                    <Bar key={s.key} dataKey={s.key} fill={s.color} maxBarSize={12} radius={[0, 4, 4, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyPlot height={200}>no impressions recorded</EmptyPlot>
            )}
          </ChartFrame>
        </Reveal>

        <Reveal y={18} delay={0.08}>
          <Plate className="h-full">
            <PlateHead icon={MousePointerClick}>By device</PlateHead>
            <ShareBar parts={devices} total={devices.reduce((s, d) => s + d.value, 0)} />
            <ul className="mt-5 space-y-4">
              {devices.map((d) => {
                const Icon = d.label === "Mobile" ? Smartphone : Monitor
                return (
                  <li key={d.label} className={`pb-4 border-b ${HAIR_SOFT} last:border-0 last:pb-0`}>
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 shrink-0" style={{ background: d.color }} />
                      <Icon className="w-3.5 h-3.5 text-dusty shrink-0" />
                      <span className="font-mono text-[11px] text-mist">{d.label}</span>
                      <span className="ml-auto font-mono text-[11px] text-snow tabular-nums">
                        CTR {d.ctr}
                      </span>
                    </div>
                    <div className="flex gap-4 mt-2 ml-[26px] font-mono text-[10px] text-dusty tabular-nums">
                      <span>{fmtNum(d.value)} impressions</span>
                      <span>{fmtNum(d.clicks)} clicks</span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </Plate>
        </Reveal>
      </div>
    </div>
  )
}
