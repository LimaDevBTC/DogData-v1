"use client"

// ═══════════════════════════════════════════════════════════════════════════
// DOG DATA — internal analytics dashboard (unlisted route).
//
// This file is a conductor, not a canvas: it owns the shell, the one filter
// row and the fetch loop; each tab lives in its own file, and the shared
// surface + validated chart palette live in ./ui.
//
// The filter row is deliberately ONE row above everything it scopes. Filters
// inside a chart card let two plates disagree about the period they're showing
// — the fastest way to make a dashboard lie.
//
// Refetch never flashes a skeleton. The loader appears only on first paint;
// after that the previous render is held at reduced opacity so the layout
// never jumps under someone reading it.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react"
import { BarChart3, Megaphone, RefreshCw, Zap } from "lucide-react"
import { Reveal, Scramble } from "@/app/dogcity/motion"
import Ads from "./ads"
import Speed from "./speed"
import Traffic from "./traffic"
import type { AdsReport, Report } from "./types"
import { CAT, HAIR, HAIR_SOFT, HeroFigure, STATUS, StatusChip, fmtNum } from "./ui"

const RANGES = [7, 14, 30, 60, 90]

const TABS = [
  { key: "traffic", label: "Tráfego",    icon: BarChart3 },
  { key: "speed",   label: "Velocidade", icon: Zap },
  { key: "ads",     label: "Ads",        icon: Megaphone },
] as const

type TabKey = (typeof TABS)[number]["key"]

export default function AnalyticsDashboard() {
  const [data, setData] = useState<Report | null>(null)
  const [adsData, setAdsData] = useState<AdsReport | null>(null)
  const [days, setDays] = useState(30)
  const [tab, setTab] = useState<TabKey>("traffic")
  const [loading, setLoading] = useState(true)
  const [adsLoading, setAdsLoading] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const load = useCallback((d: number) => {
    setLoading(true)
    fetch(`/api/analytics/report?days=${d}`)
      .then((r) => r.json())
      .then((r) => { setData(r); setLastRefresh(new Date()) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const loadAds = useCallback((d: number) => {
    setAdsLoading(true)
    fetch(`/api/ads/report?days=${d}`)
      .then((r) => r.json())
      .then(setAdsData)
      .catch(() => {})
      .finally(() => setAdsLoading(false))
  }, [])

  useEffect(() => { load(days) }, [days, load])
  useEffect(() => { if (tab === "ads") loadAds(days) }, [tab, days, loadAds])
  useEffect(() => {
    const t = setInterval(() => {
      load(days)
      if (tab === "ads") loadAds(days)
    }, 60_000)
    return () => clearInterval(t)
  }, [days, tab, load, loadAds])

  if (!data) {
    return (
      <main className="min-h-screen bg-void text-snow flex items-center justify-center px-6">
        <div className="text-center">
          <Scramble text="CARREGANDO ANALYTICS" className="font-mono text-[11px] tracking-[0.3em] text-lava" />
          <div className="mt-4 h-px w-40 mx-auto bg-white/10">
            <div className="h-full w-1/3 bg-lava animate-pulse-slow" />
          </div>
        </div>
      </main>
    )
  }

  const daily = Object.entries(data.by_day).sort(([a], [b]) => a.localeCompare(b))
  const trend = daily.slice(-14).map(([, v]) => v)
  const score = data.performance_score
  const scoreStatus = score == null ? "warn" : score >= 90 ? "good" : score >= 50 ? "warn" : "poor"

  const hero =
    tab === "traffic" ? (
      <HeroFigure
        label="Page views no período"
        value={data.summary.pageviews}
        trend={trend}
        accent={CAT[0]}
        sub={`janela de ${data.period.days} dias · ${daily.length} dias com registro`}
      />
    ) : tab === "speed" ? (
      <HeroFigure
        label="Performance score"
        value={score}
        unit="/ 100"
        accent={STATUS[scoreStatus]}
        badge={score != null ? <StatusChip status={scoreStatus} /> : undefined}
        sub="percentil 75 de visitas reais, ponderado entre as cinco Core Web Vitals"
      />
    ) : adsData ? (
      <HeroFigure
        label="Impressões de banner"
        value={adsData.summary.impressions}
        accent={CAT[0]}
        sub={`${adsData.advertiser} · janela de ${adsData.period.days} dias`}
      />
    ) : null

  return (
    <main className="min-h-screen bg-void text-snow">

      {/* ── shell head + the single filter row ─────────────────────────────── */}
      <header className={`sticky top-0 z-30 bg-void border-b ${HAIR_SOFT}`}>
        <div className="max-w-[1400px] mx-auto px-5 md:px-10">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 pt-7 pb-5">
            <div>
              <Scramble text="DOG DATA · TELEMETRIA INTERNA"
                className="font-mono text-[10px] tracking-[0.3em] text-lava" />
              {/* NOT a SplitLine: the shared reveal primitives gate on an
                  IntersectionObserver with a -10% top margin, and a sticky
                  header sits inside that dead band — the words would never be
                  released. A title that animates on scroll-back is wrong here
                  anyway; this one is pinned to the top of every view. */}
              <h1 className="font-display font-bold text-2xl md:text-[32px] text-snow mt-2.5 leading-none">
                Site Dashboard
              </h1>
              <p className="font-mono text-[10px] text-dusty mt-2.5 tabular-nums">
                {new Date(data.period.from).toLocaleDateString("pt-BR")} → {new Date(data.period.to).toLocaleDateString("pt-BR")}
                {lastRefresh && (
                  <span className="text-white/25 ml-3">
                    · atualizado {lastRefresh.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className={`flex border ${HAIR}`}>
                {RANGES.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDays(d)}
                    aria-pressed={days === d}
                    className={`px-3.5 min-h-[40px] font-mono text-[11px] tabular-nums transition-colors
                      border-r ${HAIR} last:border-r-0 ${
                      days === d
                        ? "bg-lava text-void font-bold"
                        : "text-dusty hover:text-snow hover:bg-white/[0.04]"
                    }`}
                  >
                    {d}d
                  </button>
                ))}
              </div>
              <button
                onClick={() => { load(days); if (tab === "ads") loadAds(days) }}
                aria-label="Atualizar agora"
                className={`grid place-items-center w-10 h-10 border ${HAIR} text-dusty
                  hover:text-snow hover:border-white/25 transition-colors`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading || adsLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* ── tabs ──────────────────────────────────────────────────────── */}
          <nav className="flex -mb-px overflow-x-auto">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                aria-current={tab === key ? "page" : undefined}
                className={`flex items-center gap-2 px-4 md:px-5 min-h-[46px] shrink-0
                  font-mono text-[11px] uppercase tracking-[0.2em] border-b-2 transition-colors ${
                  tab === key
                    ? "text-lava border-lava"
                    : "text-dusty border-transparent hover:text-mist"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* ── body ──────────────────────────────────────────────────────────── */}
      <div
        className={`max-w-[1400px] mx-auto px-5 md:px-10 py-10 md:py-14 transition-opacity duration-300 ${
          loading || (tab === "ads" && adsLoading) ? "opacity-60" : "opacity-100"
        }`}
      >
        {hero && <Reveal y={14} className="block mb-12 md:mb-16">{hero}</Reveal>}

        {tab === "traffic" && <Traffic data={data} />}
        {tab === "speed" && <Speed data={data} />}
        {tab === "ads" && (
          adsData
            ? <Ads data={adsData} />
            : (
              <div className="py-24 text-center">
                <Scramble text="CARREGANDO DADOS DE ADS"
                  className="font-mono text-[11px] tracking-[0.3em] text-dusty" />
              </div>
            )
        )}
      </div>

      <footer className={`border-t ${HAIR_SOFT} mt-8`}>
        <div className="max-w-[1400px] mx-auto px-5 md:px-10 py-6 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-white/25">
            dogdata.xyz
          </span>
          <span className="font-mono text-[10px] text-white/25">
            auto-refresh 60s · rota não listada
          </span>
        </div>
      </footer>
    </main>
  )
}
