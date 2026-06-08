"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, ExternalLink, Copy, Check, ChevronLeft, ChevronRight, Search, X } from "lucide-react"
import { Layout } from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LoadingScreen } from "@/components/loading-screen"
import { useDogPrice, fmtUsdCompact } from "@/lib/use-dog-price"

// ─── Types ─────────────────────────────────────────────────────────────

interface HolderByAge {
  rank: number
  address: string
  total_dog: number
  lth_dog: number
  sth_dog: number
  lth_pct: number
  sth_pct: number
  utxo_count: number
  lth_utxos: number
  sth_utxos: number
  weighted_avg_age_days: number
  oldest_age_days: number
  newest_age_days: number
}

interface WalletsPage {
  page: number
  limit: number
  total: number
  total_pages: number
  filter: string
  q: string | null
  wallets: HolderByAge[]
}

interface SummaryData {
  generated_at: string
  staleness_hours: number
  threshold_days: number
  total_holders: number
  lth_dominant_wallets: number | null
  sth_dominant_wallets: number | null
  supply: {
    total_dog: number
    lth_dog: number
    sth_dog: number
    lth_pct: number
    sth_pct: number
  }
  methodology: {
    threshold_days: number
    definition: string
    dominance_rule: string
    plain_text: string
    notes: string[]
    source: string
  }
}

type FilterKey = "all" | "lth" | "sth"

// ─── Helpers ───────────────────────────────────────────────────────────

function fmtDog(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + "B"
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M"
  if (n >= 1_000) return (n / 1_000).toFixed(2) + "K"
  return n.toFixed(0)
}

function fmtN(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n)
}

function fmtPct(n: number, dig = 2): string {
  return n.toFixed(dig) + "%"
}

function fmtAge(days: number): string {
  if (days >= 365) return (days / 365).toFixed(1) + "y"
  return Math.round(days) + "d"
}

const STH_COLOR = "#2ECC71"
const LTH_COLOR = "#F7931A"

// ─── Sub-components ────────────────────────────────────────────────────

function BackButton() {
  const router = useRouter()
  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back()
    else router.push("/metrics")
  }
  return (
    <button
      onClick={handleBack}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/[0.06] hover:border-lava/20 text-dusty/60 hover:text-snow text-xs font-mono transition-all duration-200"
    >
      <ArrowLeft className="w-3.5 h-3.5" />
      Back
    </button>
  )
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center justify-center text-dusty/50 hover:text-snow transition-colors p-1"
      title={copied ? "Copied!" : "Copy address"}
    >
      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
    </button>
  )
}

// Split bar showing the wallet's own LTH/STH balance composition.
function SplitBar({ lthPct }: { lthPct: number }) {
  const sthPct = 100 - lthPct
  return (
    <div className="h-2 w-full min-w-[60px] rounded-full overflow-hidden bg-white/[0.04] flex">
      <div style={{ width: `${sthPct}%`, background: STH_COLOR }} />
      <div style={{ width: `${lthPct}%`, background: LTH_COLOR }} />
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────

const PAGE_SIZE = 50

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All holders" },
  { key: "lth", label: "LTH-dominant" },
  { key: "sth", label: "STH-dominant" },
]

export default function HoldersByAgePage() {
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const { price: dogPrice } = useDogPrice()

  const [filter, setFilter] = useState<FilterKey>("all")
  const [searchInput, setSearchInput] = useState("")
  const [q, setQ] = useState("")
  const [walletsPage, setWalletsPage] = useState(1)
  const [walletsData, setWalletsData] = useState<WalletsPage | null>(null)
  const [walletsLoading, setWalletsLoading] = useState(false)
  const [goToPage, setGoToPage] = useState("")

  // Pre-select filter from ?filter=lth|sth when arriving from the metrics card.
  useEffect(() => {
    if (typeof window === "undefined") return
    const f = new URLSearchParams(window.location.search).get("filter")
    if (f === "lth" || f === "sth") setFilter(f)
  }, [])

  // Summary (headline stats + methodology) — loaded once.
  useEffect(() => {
    const run = async () => {
      try {
        const r = await fetch("/api/metrics/holders-by-age")
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        setSummary(await r.json())
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load")
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [])

  // Debounce the search box into `q`.
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(searchInput.trim())
      setWalletsPage(1)
    }, 350)
    return () => clearTimeout(t)
  }, [searchInput])

  // Reset to page 1 whenever the filter changes.
  useEffect(() => {
    setWalletsPage(1)
  }, [filter])

  // Paginated wallets fetch — reacts to page, filter, and search.
  useEffect(() => {
    const run = async () => {
      setWalletsLoading(true)
      try {
        const params = new URLSearchParams({
          page: String(walletsPage),
          limit: String(PAGE_SIZE),
          filter,
        })
        if (q) params.set("q", q)
        const r = await fetch(`/api/metrics/holders-by-age/wallets?${params.toString()}`)
        if (r.ok) setWalletsData(await r.json())
      } catch {
        // silent — keep prior page on failure
      } finally {
        setWalletsLoading(false)
      }
    }
    run()
  }, [walletsPage, filter, q])

  const goPage = (n: number) => {
    if (!walletsData) return
    const clamped = Math.max(1, Math.min(walletsData.total_pages, n))
    setWalletsPage(clamped)
    setGoToPage("")
    const el = document.getElementById("wallets-table")
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  if (loading) return <LoadingScreen message="Loading holders by age…" />

  if (error || !summary) {
    return (
      <Layout currentPage="metrics" setCurrentPage={() => {}}>
        <div className="pt-4 pb-12 px-3 md:px-6 max-w-3xl mx-auto space-y-6">
          <BackButton />
          <Card variant="glass" className="border-red-500/10">
            <CardContent className="pt-8 pb-8 text-center">
              <p className="text-red-400/80 font-mono text-sm">
                {error || "Failed to load holders-by-age data."}
              </p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    )
  }

  const { supply } = summary

  return (
    <Layout currentPage="metrics" setCurrentPage={() => {}}>
      <div className="pt-4 pb-12 px-3 md:px-6 space-y-6 max-w-6xl mx-auto animate-fade-in">
        <BackButton />

        {/* ── Header ── */}
        <div className="space-y-2">
          <h1 className="font-display text-2xl md:text-4xl font-bold text-text-accent">
            Long-Term vs Short-Term Holders
          </h1>
          <p className="text-dusty font-mono text-xs md:text-sm">
            Every DOG wallet broken down by coin age — Long-Term Holder supply (UTXOs ≥{summary.threshold_days}d)
            vs Short-Term Holder supply (&lt;{summary.threshold_days}d).
            Snapshot from {new Date(summary.generated_at).toLocaleDateString()} · {summary.staleness_hours}h ago.
          </p>
        </div>

        {/* ── Supply split bar ── */}
        <Card variant="elevated" className="border-accent-primary/20">
          <CardContent className="pt-4">
            <div className="h-12 w-full overflow-hidden relative border border-border-subtle rounded-lg flex">
              <div
                className="h-full flex items-center justify-center transition-all duration-500"
                style={{ width: `${supply.sth_pct}%`, background: `linear-gradient(135deg, ${STH_COLOR}, #27AE60)` }}
              >
                {supply.sth_pct > 12 && (
                  <span className="text-bg-surface font-mono font-bold text-sm px-2">STH {supply.sth_pct.toFixed(1)}%</span>
                )}
              </div>
              <div
                className="h-full flex items-center justify-center transition-all duration-500"
                style={{ width: `${supply.lth_pct}%`, background: `linear-gradient(135deg, ${LTH_COLOR}, #E8820E)` }}
              >
                {supply.lth_pct > 12 && (
                  <span className="text-bg-surface font-mono font-bold text-sm px-2">LTH {supply.lth_pct.toFixed(1)}%</span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
              <div>
                <div className="text-2xl md:text-3xl font-bold text-accent-positive font-mono">{fmtDog(supply.sth_dog)}</div>
                <p className="text-dusty text-xs font-mono mt-1">STH supply · {fmtPct(supply.sth_pct)}</p>
                {dogPrice && <p className="text-snow/60 text-[11px] font-mono mt-0.5">≈ {fmtUsdCompact(supply.sth_dog * dogPrice)}</p>}
              </div>
              <div>
                <div className="text-2xl md:text-3xl font-bold text-text-accent font-mono">{fmtDog(supply.lth_dog)}</div>
                <p className="text-dusty text-xs font-mono mt-1">LTH supply · {fmtPct(supply.lth_pct)}</p>
                {dogPrice && <p className="text-snow/60 text-[11px] font-mono mt-0.5">≈ {fmtUsdCompact(supply.lth_dog * dogPrice)}</p>}
              </div>
              <div>
                <div className="text-2xl md:text-3xl font-bold text-snow font-mono">
                  {summary.sth_dominant_wallets !== null ? fmtN(summary.sth_dominant_wallets) : "—"}
                </div>
                <p className="text-dusty text-xs font-mono mt-1">STH-dominant wallets</p>
                <p className="text-dusty/50 text-[10px] font-mono mt-0.5">of {fmtN(summary.total_holders)} total</p>
              </div>
              <div>
                <div className="text-2xl md:text-3xl font-bold text-snow font-mono">
                  {summary.lth_dominant_wallets !== null ? fmtN(summary.lth_dominant_wallets) : "—"}
                </div>
                <p className="text-dusty text-xs font-mono mt-1">LTH-dominant wallets</p>
                <p className="text-dusty/50 text-[10px] font-mono mt-0.5">≥50% balance is old coin</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Methodology ── */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="text-snow text-lg md:text-xl font-display">How we measured this</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-dusty text-xs md:text-sm font-mono leading-relaxed">
              <p className="text-snow/90">{summary.methodology.plain_text}</p>
              <p className="text-dusty/80">
                <span className="text-snow/80">Dominance label:</span> {summary.methodology.dominance_rule}
              </p>
              <ul className="list-disc list-outside pl-5 space-y-2 text-dusty/80">
                {summary.methodology.notes.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* ── Wallets — filter + search + paginated table ── */}
        <Card variant="glass" id="wallets-table">
          <CardHeader>
            <CardTitle className="text-snow text-lg md:text-xl font-display">Holders</CardTitle>
            <p className="text-dusty/70 text-xs font-mono">
              {walletsData ? (
                <>
                  Sorted by DOG (descending). {fmtN(walletsData.total)} wallets
                  {filter !== "all" && ` (${filter.toUpperCase()}-dominant)`}
                  {q && ` matching "${q}"`} — page {walletsData.page} of {walletsData.total_pages || 1}.
                </>
              ) : (
                <>Loading…</>
              )}
            </p>
          </CardHeader>
          <CardContent>
            {/* Filter tabs + search */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <div className="flex items-center gap-1.5 flex-wrap">
                {FILTER_TABS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setFilter(t.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all border ${
                      filter === t.key
                        ? "border-lava/40 text-snow bg-lava/10"
                        : "border-white/[0.06] text-dusty/70 hover:text-snow hover:border-lava/20"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="relative w-full md:w-72">
                <Search className="w-3.5 h-3.5 text-dusty/50 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search by address…"
                  className="w-full pl-8 pr-8 py-1.5 rounded-lg border border-white/[0.06] bg-bg-surface/40 text-snow text-xs font-mono focus:outline-none focus:border-lava/40"
                />
                {searchInput && (
                  <button
                    onClick={() => setSearchInput("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-dusty/50 hover:text-snow"
                    title="Clear"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto relative">
              {walletsLoading && (
                <div className="absolute inset-0 bg-bg-surface/40 backdrop-blur-sm z-10 flex items-center justify-center">
                  <span className="text-dusty/70 text-xs font-mono">Loading…</span>
                </div>
              )}
              <table className="w-full font-mono text-xs">
                <thead>
                  <tr className="border-b border-white/[0.05] text-left">
                    <th className="py-2 px-2 text-dusty/70 font-mono text-[11px] uppercase tracking-wider w-12">#</th>
                    <th className="py-2 px-2 text-dusty/70 font-mono text-[11px] uppercase tracking-wider">Address</th>
                    <th className="py-2 px-2 text-dusty/70 font-mono text-[11px] uppercase tracking-wider text-right">Total DOG</th>
                    <th className="py-2 px-2 text-dusty/70 font-mono text-[11px] uppercase tracking-wider text-right hidden md:table-cell">LTH</th>
                    <th className="py-2 px-2 text-dusty/70 font-mono text-[11px] uppercase tracking-wider text-right hidden md:table-cell">STH</th>
                    <th className="py-2 px-2 text-dusty/70 font-mono text-[11px] uppercase tracking-wider hidden lg:table-cell w-32">Split</th>
                    <th className="py-2 px-2 text-dusty/70 font-mono text-[11px] uppercase tracking-wider text-right hidden md:table-cell">Avg age</th>
                  </tr>
                </thead>
                <tbody>
                  {walletsData?.wallets.map((w) => (
                    <tr key={w.address} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                      <td className="py-2 px-2 text-dusty/60">{w.rank}</td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1">
                          <Link
                            href={`/address/bitcoin/${w.address}`}
                            className="text-snow/80 hover:text-lava break-all transition-colors"
                          >
                            <span className="md:hidden">{w.address.slice(0, 16)}…{w.address.slice(-10)}</span>
                            <span className="hidden md:inline">{w.address}</span>
                          </Link>
                          <CopyBtn text={w.address} />
                          <a
                            href={`https://mempool.space/address/${w.address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-dusty/40 hover:text-snow transition-colors p-1"
                            title="View on mempool.space"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right text-snow font-semibold">{fmtDog(w.total_dog)}</td>
                      <td className="py-2 px-2 text-right hidden md:table-cell" style={{ color: LTH_COLOR }}>
                        {fmtPct(w.lth_pct, 0)}
                      </td>
                      <td className="py-2 px-2 text-right hidden md:table-cell" style={{ color: STH_COLOR }}>
                        {fmtPct(w.sth_pct, 0)}
                      </td>
                      <td className="py-2 px-2 hidden lg:table-cell">
                        <SplitBar lthPct={w.lth_pct} />
                      </td>
                      <td className="py-2 px-2 text-right text-dusty hidden md:table-cell">{fmtAge(w.weighted_avg_age_days)}</td>
                    </tr>
                  ))}
                  {walletsData && walletsData.wallets.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-dusty/60 font-mono text-xs">
                        No wallets found{q && ` for "${q}"`}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination controls */}
            {walletsData && walletsData.total_pages > 1 && (
              <div className="flex items-center justify-between gap-3 mt-5 pt-4 border-t border-white/[0.05] flex-wrap">
                <p className="text-dusty/70 text-xs font-mono">
                  Showing {(walletsData.page - 1) * walletsData.limit + 1}–{Math.min(walletsData.page * walletsData.limit, walletsData.total)} of {fmtN(walletsData.total)}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => goPage(walletsData.page - 1)}
                    disabled={walletsData.page <= 1 || walletsLoading}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/[0.06] hover:border-lava/20 text-dusty/70 hover:text-snow text-xs font-mono transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-white/[0.06] disabled:hover:text-dusty/70"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Prev
                  </button>
                  <span className="text-dusty text-xs font-mono px-2">
                    Page {walletsData.page} / {walletsData.total_pages}
                  </span>
                  <button
                    onClick={() => goPage(walletsData.page + 1)}
                    disabled={walletsData.page >= walletsData.total_pages || walletsLoading}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/[0.06] hover:border-lava/20 text-dusty/70 hover:text-snow text-xs font-mono transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-white/[0.06] disabled:hover:text-dusty/70"
                  >
                    Next <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-dusty/40 mx-1">·</span>
                  <input
                    type="number"
                    min={1}
                    max={walletsData.total_pages}
                    value={goToPage}
                    onChange={(e) => setGoToPage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const n = parseInt(goToPage, 10)
                        if (!isNaN(n)) goPage(n)
                      }
                    }}
                    placeholder="Go to"
                    className="w-20 px-2 py-1.5 rounded-lg border border-white/[0.06] bg-bg-surface/40 text-snow text-xs font-mono focus:outline-none focus:border-lava/40"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}
