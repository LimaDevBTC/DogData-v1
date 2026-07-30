"use client"

// ═══════════════════════════════════════════════════════════════════════════
// TRAFFIC — who arrived, from where, on what.
//
// Three corrections to the generated version this replaces:
//
//  · the device donut is gone. Three slices (two, on the ads tab) is a stat
//    list wearing a chart; the share now reads as one segmented bar with the
//    counts written out beside it.
//  · ranked nominal lists (pages, browsers, referrers) used to fade each bar
//    by its rank, which re-encodes bar length as colour and spends the only
//    free channel on information the bar already carries. One hue now.
//  · the realtime buckets were reversed, so the x-axis ran newest→oldest.
//    The API emits 25m…0m already — oldest to newest, left to right.
// ═══════════════════════════════════════════════════════════════════════════

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"
import { Chrome, Globe2, Monitor, Smartphone, Tablet, TrendingUp } from "lucide-react"
import { Reveal, Stagger, StaggerItem } from "@/app/dogcity/motion"
import type { Report } from "./types"
import {
  AXIS_TICK, CAT, ChartFrame, ChartTooltip, EmptyPlot, GRID, HAIR, HAIR_SOFT,
  Plate, PlateHead, PlotGrid, RankRows, SectionHead, ShareBar, StatTile,
  fmtCompact, fmtNum, fmtPage,
} from "./ui"

const COUNTRY_FLAGS: Record<string, string> = {
  US:"🇺🇸",BR:"🇧🇷",GB:"🇬🇧",DE:"🇩🇪",FR:"🇫🇷",CA:"🇨🇦",AU:"🇦🇺",
  JP:"🇯🇵",IN:"🇮🇳",MX:"🇲🇽",AR:"🇦🇷",PT:"🇵🇹",ES:"🇪🇸",NL:"🇳🇱",
  KR:"🇰🇷",SG:"🇸🇬",TR:"🇹🇷",PL:"🇵🇱",IT:"🇮🇹",RU:"🇷🇺",
}

const DEVICE_ICON: Record<string, typeof Monitor> = {
  Mobile: Smartphone, Tablet: Tablet, Desktop: Monitor,
}

export default function Traffic({ data }: { data: Report }) {
  const daily = Object.entries(data.by_day)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, views]) => ({ date: date.slice(5), full: date, Views: views }))

  // insertion order out of the API is 25m → 0m, i.e. oldest → newest
  const realtime = Object.entries(data.realtime)
    .map(([label, value]) => ({ label: label === "0m" ? "agora" : `-${label}`, value }))

  const devices = Object.entries(data.by_device)
    .map(([name, value]) => ({
      label: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: CAT[Math.min(2, Object.keys(data.by_device).indexOf(name))],
    }))
    .sort((a, b) => b.value - a.value)

  const totalViews = data.summary.pageviews || 1
  const trend = daily.slice(-14).map((d) => d.Views)
  const viewsPerDay = daily.length ? data.summary.pageviews / daily.length : 0
  const liveNow = realtime.reduce((s, r) => s + r.value, 0)

  return (
    <div className="space-y-12 md:space-y-16">

      {/* ── the headline row ─────────────────────────────────────────────── */}
      <section>
        <SectionHead
          eyebrow="AUDIÊNCIA"
          title="O que o site recebeu no período."
          sub="Page views contadas por evento, sessões por identificador anônimo de sessão. Nenhuma métrica abaixo é amostrada."
        />
        <Reveal delay={0.5} y={16}>
          <PlotGrid className="mt-10 grid-cols-2 lg:grid-cols-4">
            <StatTile label="Sessões" value={data.summary.unique_sessions} accent={CAT[1]}
              sub="visitantes únicos por sessão" delay={0.05} />
            <StatTile label="Páginas / sessão" value={data.summary.avg_pages_per_session}
              format={(n) => n.toFixed(1)} accent={CAT[2]} sub="profundidade média" delay={0.1} />
            <StatTile label="Views / dia" value={viewsPerDay} format={(n) => n.toFixed(0)}
              trend={trend} accent={CAT[0]} sub="média no período" delay={0.15} />
            <StatTile label="Países" value={data.by_country.length} accent={CAT[1]}
              sub={`liderado por ${data.by_country[0]?.country ?? "—"}`} delay={0.2} />
          </PlotGrid>
        </Reveal>
      </section>

      {/* ── the timeline ─────────────────────────────────────────────────── */}
      <Reveal y={18}>
        <ChartFrame
          eyebrow="Page views por dia"
          icon={TrendingUp}
          table={{ head: ["Dia", "Views"], rows: daily.map((d) => [d.full, d.Views]) }}
        >
          {daily.length > 1 ? (
            <ResponsiveContainer width="100%" height={252}>
              <AreaChart data={daily} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="an-views" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CAT[0]} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={CAT[0]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="date" tick={AXIS_TICK} axisLine={false} tickLine={false}
                  minTickGap={24} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false}
                  width={52} tickFormatter={fmtCompact} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#ffffff25", strokeWidth: 1 }} />
                <Area type="monotone" dataKey="Views" stroke={CAT[0]} strokeWidth={2}
                  fill="url(#an-views)" dot={false}
                  activeDot={{ r: 4, fill: CAT[0], stroke: "#050505", strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyPlot height={252} />
          )}
        </ChartFrame>
      </Reveal>

      {/* ── realtime + top pages ─────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Reveal y={18}>
          <ChartFrame
            eyebrow={`Últimos 30 minutos · ${fmtNum(liveNow)} views`}
            live
            table={{ head: ["Janela", "Views"], rows: realtime.map((r) => [r.label, r.value]) }}
          >
            <ResponsiveContainer width="100%" height={186}>
              <BarChart data={realtime} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false}
                  width={44} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "#ffffff08" }} />
                <Bar dataKey="value" name="Views" fill={CAT[0]} maxBarSize={24} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartFrame>
        </Reveal>

        <Reveal y={18} delay={0.08}>
          <Plate className="h-full">
            <PlateHead>Top páginas</PlateHead>
            <RankRows
              numbered
              rows={data.top_pages.slice(0, 8).map((p) => ({
                label: fmtPage(p.page),
                value: p.views,
                hint: `${Math.round((p.views / totalViews) * 100)}%`,
              }))}
            />
          </Plate>
        </Reveal>
      </div>

      {/* ── device / browser / referrer ───────────────────────────────────── */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
        <Reveal y={18}>
          <Plate className="h-full">
            <PlateHead>Dispositivo</PlateHead>
            <ShareBar parts={devices} total={devices.reduce((s, d) => s + d.value, 0)} />
            <ul className="mt-5 space-y-3">
              {devices.map((d) => {
                const Icon = DEVICE_ICON[d.label] ?? Monitor
                return (
                  <li key={d.label} className={`flex items-center gap-2.5 pb-3 border-b ${HAIR_SOFT} last:border-0 last:pb-0`}>
                    <span className="w-2 h-2 shrink-0" style={{ background: d.color }} />
                    <Icon className="w-3.5 h-3.5 text-dusty shrink-0" />
                    <span className="font-mono text-[11px] text-mist">{d.label}</span>
                    <span className="ml-auto font-mono text-[11px] text-snow tabular-nums">
                      {fmtNum(d.value)}
                      <span className="text-dusty ml-1.5">
                        {Math.round((d.value / totalViews) * 100)}%
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </Plate>
        </Reveal>

        <Reveal y={18} delay={0.08}>
          <Plate className="h-full">
            <PlateHead icon={Chrome}>Navegador</PlateHead>
            <RankRows
              rows={data.by_browser.slice(0, 8).map((b) => ({ label: b.browser, value: b.views }))}
            />
          </Plate>
        </Reveal>

        <Reveal y={18} delay={0.16}>
          <Plate className="h-full md:col-span-2 xl:col-span-1">
            <PlateHead icon={TrendingUp}>Fontes de tráfego</PlateHead>
            <RankRows
              rows={data.by_referrer.slice(0, 8).map((r) => ({ label: r.referrer, value: r.views }))}
            />
          </Plate>
        </Reveal>
      </div>

      {/* ── geography ─────────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-5">
          <Globe2 className="w-3.5 h-3.5 text-dusty" />
          <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] text-dusty">
            Origem geográfica · top {Math.min(15, data.by_country.length)}
          </h3>
        </div>
        <Stagger className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px ${HAIR} border bg-white/10`} step={0.04}>
          {data.by_country.slice(0, 15).map((c) => (
            <StaggerItem key={c.country}>
              <div className="bg-void p-4 h-full flex items-center gap-3">
                <span className="text-lg leading-none shrink-0">{COUNTRY_FLAGS[c.country] ?? "🌐"}</span>
                <div className="min-w-0">
                  <div className="font-mono text-[10px] tracking-[0.18em] text-dusty">{c.country}</div>
                  <div className="font-display font-bold text-base text-snow tabular-nums mt-0.5">
                    {fmtNum(c.views)}
                  </div>
                  <div className="font-mono text-[10px] text-white/25 tabular-nums">
                    {Math.round((c.views / totalViews) * 100)}% do total
                  </div>
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>
    </div>
  )
}
