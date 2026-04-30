"use client"

import { useState, useEffect, useMemo } from "react"
import { Layout } from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  RefreshCw,
  Database,
  Cloud,
  Zap,
  Globe,
  Cog,
} from "lucide-react"

type Status = "ok" | "degraded" | "down" | "unknown"
type Category = "cron" | "infra" | "external_api" | "data_source"
type Tier = "critical" | "high" | "medium" | "low"

interface DailyBucket {
  day: string
  status: Status
}

interface ComponentStatus {
  id: string
  name: string
  category: Category
  tier?: Tier
  description: string
  current: {
    status: Status
    latency_ms: number | null
    last_checked_at: string | null
    error: string | null
  }
  uptime: {
    days_30: number | null
    days_90: number | null
    daily: DailyBucket[]
  }
  metadata: Record<string, any> | null
}

interface OverallSummary {
  status: "operational" | "degraded" | "major_outage"
  components_total: number
  components_operational: number
  components_degraded: number
  components_down: number
  components_unknown: number
}

interface StatusResponse {
  overall: OverallSummary
  generated_at: string
  components: ComponentStatus[]
}

const STATUS_LABELS: Record<Status, string> = {
  ok: "Operational",
  degraded: "Degraded",
  down: "Down",
  unknown: "Unknown",
}

const OVERALL_LABELS: Record<OverallSummary["status"], { label: string; tone: string }> = {
  operational: { label: "All Systems Operational", tone: "text-emerald-400" },
  degraded: { label: "Partial Degradation", tone: "text-amber-400" },
  major_outage: { label: "Major Outage", tone: "text-red-400" },
}

const TIER_LABELS: Record<Tier, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
}

function statusDotClass(s: Status): string {
  switch (s) {
    case "ok":
      return "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]"
    case "degraded":
      return "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]"
    case "down":
      return "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]"
    default:
      return "bg-zinc-600"
  }
}

function statusBarClass(s: Status): string {
  switch (s) {
    case "ok":
      return "bg-emerald-500/80"
    case "degraded":
      return "bg-amber-400/90"
    case "down":
      return "bg-red-500/90"
    default:
      return "bg-zinc-700/50"
  }
}

function statusTextClass(s: Status): string {
  switch (s) {
    case "ok":
      return "text-emerald-400"
    case "degraded":
      return "text-amber-400"
    case "down":
      return "text-red-400"
    default:
      return "text-zinc-500"
  }
}

function formatRelative(iso: string | null): string {
  if (!iso) return "—"
  const ms = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(ms)) return "—"
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const d = Math.floor(hr / 24)
  return `${d}d ago`
}

function formatLatency(ms: number | null): string {
  if (ms == null) return "—"
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function CategoryIcon({ category }: { category: Category }) {
  const cls = "w-4 h-4 text-text-secondary"
  switch (category) {
    case "cron":
      return <Cog className={cls} />
    case "infra":
      return <Database className={cls} />
    case "external_api":
      return <Globe className={cls} />
    case "data_source":
      return <Cloud className={cls} />
  }
}

function UptimeBar({ daily }: { daily: DailyBucket[] }) {
  // Render last 90 days as thin vertical bars.
  return (
    <div className="flex items-end gap-[1px] h-7 w-full">
      {daily.map((d) => (
        <div
          key={d.day}
          title={`${d.day} — ${STATUS_LABELS[d.status]}`}
          className={`flex-1 rounded-[1px] ${statusBarClass(d.status)} hover:opacity-80 transition-opacity`}
          style={{ minWidth: 1, height: "100%" }}
        />
      ))}
    </div>
  )
}

function ComponentRow({ c }: { c: ComponentStatus }) {
  return (
    <div className="border-t border-white/[0.04] py-4 first:border-t-0 first:pt-0">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2 h-2 rounded-full ${statusDotClass(c.current.status)}`} />
            <CategoryIcon category={c.category} />
            <span className="font-mono font-semibold text-snow text-sm md:text-base">{c.name}</span>
            {c.tier && (
              <span className="text-[10px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded border border-white/[0.06] text-text-secondary">
                {TIER_LABELS[c.tier]}
              </span>
            )}
            <span className={`ml-auto md:ml-2 text-xs font-mono ${statusTextClass(c.current.status)}`}>
              {STATUS_LABELS[c.current.status]}
            </span>
          </div>
          <p className="text-xs md:text-sm text-text-secondary font-mono leading-relaxed">{c.description}</p>
          {c.current.error && (
            <p className="text-xs font-mono text-red-400/80 mt-1 truncate" title={c.current.error}>
              {c.current.error}
            </p>
          )}
        </div>
        <div className="flex flex-col items-start md:items-end gap-1 text-xs font-mono text-text-secondary shrink-0">
          <div>
            Last:{" "}
            <span className="text-snow">{formatRelative(c.current.last_checked_at)}</span>
          </div>
          {c.current.latency_ms != null && (
            <div>
              Latency: <span className="text-snow">{formatLatency(c.current.latency_ms)}</span>
            </div>
          )}
          {c.uptime.days_30 != null && (
            <div>
              30d: <span className="text-snow">{c.uptime.days_30.toFixed(2)}%</span>
              <span className="mx-1 text-white/20">·</span>
              90d: <span className="text-snow">{c.uptime.days_90?.toFixed(2)}%</span>
            </div>
          )}
        </div>
      </div>
      <div className="mt-3">
        <UptimeBar daily={c.uptime.daily} />
        <div className="flex justify-between text-[10px] font-mono text-text-secondary/60 mt-1">
          <span>90 days ago</span>
          <span>Today</span>
        </div>
      </div>
    </div>
  )
}

function Section({
  title,
  icon,
  components,
  emptyHint,
}: {
  title: string
  icon: React.ReactNode
  components: ComponentStatus[]
  emptyHint?: string
}) {
  if (!components.length) return null
  return (
    <Card variant="glass" className="border-white/[0.06]">
      <CardHeader>
        <CardTitle variant="mono" className="flex items-center gap-2 uppercase tracking-wider">
          {icon}
          {title}
          <span className="ml-auto text-xs font-normal text-text-secondary">
            {components.length} component{components.length === 1 ? "" : "s"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {components.map((c) => (
          <ComponentRow key={c.id} c={c} />
        ))}
        {emptyHint && (
          <p className="text-[11px] font-mono text-text-secondary/60 mt-4">{emptyHint}</p>
        )}
      </CardContent>
    </Card>
  )
}

export default function StatusPage() {
  const [data, setData] = useState<StatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = async (silent = false) => {
    if (!silent) setRefreshing(true)
    try {
      const res = await fetch("/api/status/full", { cache: "no-store" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const payload = (await res.json()) as StatusResponse
      setData(payload)
      setError(null)
    } catch (e: any) {
      setError(e?.message || "Failed to load status")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    const id = setInterval(() => fetchStatus(true), 30_000)
    return () => clearInterval(id)
  }, [])

  const grouped = useMemo(() => {
    const empty = { cron: [] as ComponentStatus[], data_source: [] as ComponentStatus[], infra: [] as ComponentStatus[], externals: [] as ComponentStatus[] }
    if (!data) return empty
    return data.components.reduce((acc, c) => {
      if (c.category === "cron") acc.cron.push(c)
      else if (c.category === "data_source") acc.data_source.push(c)
      else if (c.category === "infra") acc.infra.push(c)
      else acc.externals.push(c)
      return acc
    }, empty)
  }, [data])

  // Order externals by tier
  const externalsByTier = useMemo(() => {
    const order: Tier[] = ["critical", "high", "medium", "low"]
    const sorted = [...grouped.externals].sort((a, b) => {
      const ai = a.tier ? order.indexOf(a.tier) : 99
      const bi = b.tier ? order.indexOf(b.tier) : 99
      return ai - bi
    })
    return sorted
  }, [grouped.externals])

  const overallLabel = data ? OVERALL_LABELS[data.overall.status] : OVERALL_LABELS.operational

  return (
    <Layout currentPage="status" setCurrentPage={() => {}}>
      <div className="min-h-screen pt-1 pb-8 md:py-4 space-y-4 md:space-y-6 max-w-6xl mx-auto px-3 md:px-0">
        {/* Hero */}
        <Card variant="glass" className="border-white/[0.06]">
          <CardContent className="p-5 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="relative">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      data ? statusDotClass(
                        data.overall.status === "operational"
                          ? "ok"
                          : data.overall.status === "degraded"
                          ? "degraded"
                          : "down"
                      ) : "bg-zinc-600"
                    }`}
                  />
                  {data?.overall.status === "operational" && (
                    <span className="absolute inset-0 rounded-full bg-emerald-400/30 animate-ping" />
                  )}
                </div>
                <div>
                  <h1 className={`font-display font-bold text-2xl md:text-4xl tracking-tight ${overallLabel.tone}`}>
                    {loading ? "Checking systems…" : overallLabel.label}
                  </h1>
                  <p className="text-xs md:text-sm font-mono text-text-secondary mt-1">
                    Live health of every DOG DATA component, cron, and upstream — passively observed from real traffic.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 self-start md:self-center">
                <div className="text-right text-xs font-mono text-text-secondary">
                  <div>Last check</div>
                  <div className="text-snow">{data ? formatRelative(data.generated_at) : "—"}</div>
                </div>
                <button
                  onClick={() => fetchStatus()}
                  disabled={refreshing}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:border-lava/30 hover:bg-white/[0.05] transition-colors disabled:opacity-50"
                  title="Refresh"
                >
                  <RefreshCw className={`w-4 h-4 text-lava ${refreshing ? "animate-spin" : ""}`} />
                  <span className="text-xs font-mono text-snow">Refresh</span>
                </button>
              </div>
            </div>

            {/* Stat tiles */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mt-6">
              {[
                { label: "Operational", count: data?.overall.components_operational ?? 0, icon: CheckCircle2, color: "text-emerald-400", border: "border-emerald-500/20" },
                { label: "Degraded", count: data?.overall.components_degraded ?? 0, icon: AlertTriangle, color: "text-amber-400", border: "border-amber-500/20" },
                { label: "Down", count: data?.overall.components_down ?? 0, icon: XCircle, color: "text-red-400", border: "border-red-500/20" },
                { label: "Unknown", count: data?.overall.components_unknown ?? 0, icon: HelpCircle, color: "text-zinc-500", border: "border-white/[0.06]" },
              ].map((tile) => (
                <div key={tile.label} className={`rounded-lg border ${tile.border} bg-bg-surface/40 p-3 md:p-4 backdrop-blur`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] md:text-xs font-mono uppercase tracking-wider text-text-secondary">{tile.label}</span>
                    <tile.icon className={`w-4 h-4 ${tile.color}`} />
                  </div>
                  <div className={`text-xl md:text-3xl font-mono font-bold ${tile.color}`}>{tile.count}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Error banner */}
        {error && (
          <Card variant="glass" className="border-red-500/30">
            <CardContent className="p-4 flex items-center gap-2 text-sm font-mono text-red-400">
              <XCircle className="w-4 h-4" />
              Failed to load status: {error}
            </CardContent>
          </Card>
        )}

        {/* Loading */}
        {loading && !data && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center space-y-3">
              <RefreshCw className="w-10 h-10 text-lava animate-spin mx-auto" />
              <p className="text-text-secondary font-mono text-sm">Loading status…</p>
            </div>
          </div>
        )}

        {/* Sections */}
        {data && (
          <>
            <Section
              title="Scheduled Jobs"
              icon={<Cog className="w-4 h-4 text-lava" />}
              components={grouped.cron}
              emptyHint="Each row reflects the last cron execution. Bars show daily uptime over the past 90 days."
            />

            <Section
              title="Data Freshness"
              icon={<Cloud className="w-4 h-4 text-lava" />}
              components={grouped.data_source}
              emptyHint="Freshness is read directly from the underlying caches (Redis) and tables (Supabase)."
            />

            <Section
              title="Infrastructure"
              icon={<Database className="w-4 h-4 text-lava" />}
              components={grouped.infra}
              emptyHint="Live ping every 30 seconds while this page is open."
            />

            <Section
              title="External APIs"
              icon={<Globe className="w-4 h-4 text-lava" />}
              components={externalsByTier}
              emptyHint="Probes are passive — observed from real upstream calls made by the crons. Components without recent traffic show as Unknown."
            />

            {/* Footer */}
            <div className="text-center text-[11px] font-mono text-text-secondary/60 pt-2">
              Status auto-refreshes every 30s · 30/90-day uptime aggregated from{" "}
              <span className="text-text-secondary">system_health_log</span> · Built passively from real traffic
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}
