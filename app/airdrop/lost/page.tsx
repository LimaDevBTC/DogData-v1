"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, ExternalLink, Copy, Check, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react"
import { Layout } from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LoadingScreen } from "@/components/loading-screen"
import { useDogPrice, fmtUsdCompact, fmtUsdFull } from "@/lib/use-dog-price"

// ─── Types ─────────────────────────────────────────────────────────────

interface ExtrasBucket { wallets: number; dog: number }

interface LostWallet {
  rank: number
  address: string
  airdrop_dog: number
  addr_type: string
  funded_txo_count: number
  receive_count: number
}

interface WalletsPage {
  page: number
  limit: number
  total: number
  total_pages: number
  wallets: LostWallet[]
}

interface LostData {
  generated_at: string
  staleness_hours: number
  diamond_paws_total: number
  diamond_paws_dog: number
  dog_total_supply: number
  lost: {
    wallets: number
    dog_locked: number
    pct_of_supply: number
    pct_of_diamond_paws: number
    pct_of_diamond_paws_dog: number
  }
  strict: {
    wallets: number
    dog_locked: number
    pct_of_supply: number
  }
  active: {
    wallets: number
    dog_held: number
    spent_txo_buckets: Record<string, number>
  }
  funded_unspent: {
    wallets: number
    dog: number
    extras: Record<string, ExtrasBucket>
  }
  address_type_breakdown: {
    lost_relaxed: Record<string, number>
    active: Record<string, number>
  }
  methodology: {
    plain_text: string
    notes: string[]
    ceiling_disclaimer: string
  }
}

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

const EXTRA_LABELS: Record<string, string> = {
  "0_only_airdrop": "Only the airdrop",
  "1_to_2": "1-2 extras",
  "3_to_5": "3-5 extras",
  "6_to_20": "6-20 extras",
  "21_to_100": "21-100 extras",
  "100_plus": "100+ extras",
}

const ADDR_TYPE_LABELS: Record<string, string> = {
  "p2tr": "P2TR (Taproot)",
  "p2wpkh/p2wsh": "P2WPKH / P2WSH",
  "p2sh": "P2SH",
  "p2pkh": "P2PKH (Legacy)",
}

// ─── Sub-components ────────────────────────────────────────────────────

function BackButton() {
  const router = useRouter()
  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back()
    else router.push("/airdrop")
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

// ─── Main page ─────────────────────────────────────────────────────────

const PAGE_SIZE = 50

export default function LostDogPage() {
  const [data, setData] = useState<LostData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const { price: dogPrice } = useDogPrice()

  // Wallets pagination state (separate fetch — keeps headline stats independent)
  const [walletsPage, setWalletsPage] = useState(1)
  const [walletsData, setWalletsData] = useState<WalletsPage | null>(null)
  const [walletsLoading, setWalletsLoading] = useState(false)
  const [goToPage, setGoToPage] = useState("")

  useEffect(() => {
    const run = async () => {
      try {
        const r = await fetch("/api/airdrop/lost")
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        setData(await r.json())
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load")
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [])

  useEffect(() => {
    const run = async () => {
      setWalletsLoading(true)
      try {
        const r = await fetch(`/api/airdrop/lost/wallets?page=${walletsPage}&limit=${PAGE_SIZE}`)
        if (r.ok) setWalletsData(await r.json())
      } catch {
        // silent — keep prior page if fetch fails
      } finally {
        setWalletsLoading(false)
      }
    }
    run()
  }, [walletsPage])

  const goPage = (n: number) => {
    if (!walletsData) return
    const clamped = Math.max(1, Math.min(walletsData.total_pages, n))
    setWalletsPage(clamped)
    setGoToPage("")
    // Scroll to wallets section
    const el = document.getElementById("wallets-table")
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  if (loading) return <LoadingScreen message="Loading investigation…" />

  if (error || !data) {
    return (
      <Layout currentPage="airdrop" setCurrentPage={() => {}}>
        <div className="pt-4 pb-12 px-3 md:px-6 max-w-3xl mx-auto space-y-6">
          <BackButton />
          <Card variant="glass" className="border-red-500/10">
            <CardContent className="pt-8 pb-8 text-center">
              <p className="text-red-400/80 font-mono text-sm">
                {error || "Failed to load lost-DOG analysis."}
              </p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    )
  }

  return (
    <Layout currentPage="airdrop" setCurrentPage={() => {}}>
      <div className="pt-4 pb-12 px-3 md:px-6 space-y-6 max-w-6xl mx-auto animate-fade-in">
        <BackButton />

        {/* ── Header ── */}
        <div className="space-y-2">
          <h1 className="font-display text-2xl md:text-4xl font-bold text-amber-400">
            Possible Lost DOG
          </h1>
          <p className="text-dusty font-mono text-xs md:text-sm">
            Investigation into how much $DOG sits in airdrop wallets that may have been abandoned forever.
            Updated hourly · last refresh {data.staleness_hours}h ago.
          </p>
        </div>

        {/* ── Hero stats ── */}
        <Card variant="elevated" className="border-amber-400/20">
          <CardContent className="pt-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              <div>
                <div className="text-3xl md:text-5xl font-bold text-amber-400 font-mono metric-value tracking-tight">
                  {fmtDog(data.lost.dog_locked)}
                </div>
                <p className="text-dusty text-xs md:text-sm font-mono mt-1">DOG locked</p>
                {dogPrice && (
                  <p
                    className="text-snow/70 text-sm md:text-base font-mono mt-2"
                    title={`@ $${dogPrice.toFixed(6)}/DOG`}
                  >
                    ≈ {fmtUsdCompact(data.lost.dog_locked * dogPrice)}{" "}
                    <span className="text-dusty/50 text-[11px]">USD</span>
                  </p>
                )}
                <p className="text-dusty/40 text-[10px] font-mono mt-1">
                  {fmtN(data.lost.dog_locked)} units
                </p>
              </div>
              <div>
                <div className="text-3xl md:text-5xl font-bold text-snow font-mono metric-value tracking-tight">
                  {fmtPct(data.lost.pct_of_supply)}
                </div>
                <p className="text-dusty text-xs md:text-sm font-mono mt-1">of total supply</p>
                <p className="text-dusty/50 text-[11px] font-mono mt-0.5">
                  out of 100B DOG
                </p>
              </div>
              <div>
                <div className="text-3xl md:text-5xl font-bold text-snow font-mono metric-value tracking-tight">
                  {fmtN(data.lost.wallets)}
                </div>
                <p className="text-dusty text-xs md:text-sm font-mono mt-1">
                  wallets that never signed a tx
                </p>
                <p className="text-dusty/50 text-[11px] font-mono mt-0.5">
                  {fmtPct(data.lost.pct_of_diamond_paws, 1)} of diamond paws
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Methodology ── */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="text-snow text-lg md:text-xl font-display">
              How we measured this
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-dusty text-xs md:text-sm font-mono leading-relaxed">
              <p className="text-snow/90">{data.methodology.plain_text}</p>
              <ul className="list-disc list-outside pl-5 space-y-2 text-dusty/80">
                {data.methodology.notes.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* ── Three layers comparison ── */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="text-snow text-lg md:text-xl font-display">
              Three layers of certainty
            </CardTitle>
            <p className="text-dusty/70 text-xs font-mono">
              From most-conservative ("possibly lost") to most-strict ("almost certainly never used again").
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full font-mono text-xs md:text-sm">
                <thead>
                  <tr className="border-b border-white/[0.05] text-left">
                    <th className="py-2 px-3 text-dusty/70 font-mono text-[11px] uppercase tracking-wider">Cohort</th>
                    <th className="py-2 px-3 text-dusty/70 font-mono text-[11px] uppercase tracking-wider text-right">Wallets</th>
                    <th className="py-2 px-3 text-dusty/70 font-mono text-[11px] uppercase tracking-wider text-right">DOG</th>
                    <th className="py-2 px-3 text-dusty/70 font-mono text-[11px] uppercase tracking-wider text-right hidden md:table-cell">% supply</th>
                    <th className="py-2 px-3 text-dusty/70 font-mono text-[11px] uppercase tracking-wider hidden lg:table-cell">Definition</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-white/[0.03]">
                    <td className="py-2.5 px-3 text-amber-400 font-semibold">Possibly lost (relaxed)</td>
                    <td className="py-2.5 px-3 text-right text-snow">{fmtN(data.lost.wallets)}</td>
                    <td className="py-2.5 px-3 text-right text-snow">{fmtDog(data.lost.dog_locked)}</td>
                    <td className="py-2.5 px-3 text-right text-snow hidden md:table-cell">{fmtPct(data.lost.pct_of_supply)}</td>
                    <td className="py-2.5 px-3 text-dusty/70 hidden lg:table-cell text-[11px]">spent_txo_count == 0 (never sent any UTXO)</td>
                  </tr>
                  <tr className="border-b border-white/[0.03]">
                    <td className="py-2.5 px-3 text-amber-300/80">Strictly lost</td>
                    <td className="py-2.5 px-3 text-right text-snow">{fmtN(data.strict.wallets)}</td>
                    <td className="py-2.5 px-3 text-right text-snow">{fmtDog(data.strict.dog_locked)}</td>
                    <td className="py-2.5 px-3 text-right text-snow hidden md:table-cell">{fmtPct(data.strict.pct_of_supply, 4)}</td>
                    <td className="py-2.5 px-3 text-dusty/70 hidden lg:table-cell text-[11px]">never sent + ≤2 extra deposits + no mempool</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 text-emerald-400">Active HODLers</td>
                    <td className="py-2.5 px-3 text-right text-snow">{fmtN(data.active.wallets)}</td>
                    <td className="py-2.5 px-3 text-right text-snow">{fmtDog(data.active.dog_held)}</td>
                    <td className="py-2.5 px-3 text-right text-snow hidden md:table-cell">{fmtPct((data.active.dog_held / data.dog_total_supply) * 100)}</td>
                    <td className="py-2.5 px-3 text-dusty/70 hidden lg:table-cell text-[11px]">spent something — keys are accessible</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-dusty/60 text-xs font-mono mt-4">
              Active HODLers spent BTC, dust, or other runes — but never their DOG. They are conscious holders, not abandoned wallets.
            </p>
          </CardContent>
        </Card>

        {/* ── By address type ── */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="text-snow text-lg md:text-xl font-display">
              By address type
            </CardTitle>
            <p className="text-dusty/70 text-xs font-mono">
              Taproot dominates — these were throwaway wallets minted for inscription / rare-sat hunting in 2023-2024.
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full font-mono text-xs md:text-sm">
                <thead>
                  <tr className="border-b border-white/[0.05] text-left">
                    <th className="py-2 px-3 text-dusty/70 font-mono text-[11px] uppercase tracking-wider">Address type</th>
                    <th className="py-2 px-3 text-dusty/70 font-mono text-[11px] uppercase tracking-wider text-right">Lost</th>
                    <th className="py-2 px-3 text-dusty/70 font-mono text-[11px] uppercase tracking-wider text-right">Active</th>
                    <th className="py-2 px-3 text-dusty/70 font-mono text-[11px] uppercase tracking-wider text-right">% lost</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(ADDR_TYPE_LABELS).map((t) => {
                    const lost = data.address_type_breakdown.lost_relaxed[t] || 0
                    const active = data.address_type_breakdown.active[t] || 0
                    const total = lost + active
                    if (total === 0) return null
                    return (
                      <tr key={t} className="border-b border-white/[0.03]">
                        <td className="py-2.5 px-3 text-snow">{ADDR_TYPE_LABELS[t]}</td>
                        <td className="py-2.5 px-3 text-right text-amber-400/90">{fmtN(lost)}</td>
                        <td className="py-2.5 px-3 text-right text-dusty">{fmtN(active)}</td>
                        <td className="py-2.5 px-3 text-right text-snow">{fmtPct((lost / total) * 100, 1)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* ── Extra deposits distribution ── */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="text-snow text-lg md:text-xl font-display">
              How many drops landed on these wallets
            </CardTitle>
            <p className="text-dusty/70 text-xs font-mono">
              Even though the owner never moved anything, third parties kept dropping dust / other runes / inscriptions on these addresses (most are on public airdrop lists).
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full font-mono text-xs md:text-sm">
                <thead>
                  <tr className="border-b border-white/[0.05] text-left">
                    <th className="py-2 px-3 text-dusty/70 font-mono text-[11px] uppercase tracking-wider">Bucket</th>
                    <th className="py-2 px-3 text-dusty/70 font-mono text-[11px] uppercase tracking-wider text-right">Wallets</th>
                    <th className="py-2 px-3 text-dusty/70 font-mono text-[11px] uppercase tracking-wider text-right">DOG locked</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(EXTRA_LABELS).map((b) => {
                    const bucket = data.funded_unspent.extras[b]
                    if (!bucket) return null
                    return (
                      <tr key={b} className="border-b border-white/[0.03]">
                        <td className="py-2.5 px-3 text-snow">{EXTRA_LABELS[b]}</td>
                        <td className="py-2.5 px-3 text-right text-snow">{fmtN(bucket.wallets)}</td>
                        <td className="py-2.5 px-3 text-right text-dusty">{fmtDog(bucket.dog)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-dusty/60 text-xs font-mono mt-4">
              The "fewer extras" buckets are the strongest "abandoned" signal — addresses nobody bothered to spam,
              consistent with throwaway wallets that never made the rounds of public airdrop lists.
            </p>
          </CardContent>
        </Card>

        {/* ── All lost wallets — paginated ── */}
        <Card variant="glass" id="wallets-table">
          <CardHeader>
            <CardTitle className="text-snow text-lg md:text-xl font-display">
              All lost wallets
            </CardTitle>
            <p className="text-dusty/70 text-xs font-mono">
              {walletsData ? (
                <>
                  Sorted by DOG (descending). {fmtN(walletsData.total)} wallets total —
                  page {walletsData.page} of {walletsData.total_pages}.
                  Click any address to inspect.
                </>
              ) : (
                <>Loading…</>
              )}
            </p>
          </CardHeader>
          <CardContent>
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
                    <th className="py-2 px-2 text-dusty/70 font-mono text-[11px] uppercase tracking-wider text-right">DOG</th>
                    <th className="py-2 px-2 text-dusty/70 font-mono text-[11px] uppercase tracking-wider text-right hidden md:table-cell">Type</th>
                    <th className="py-2 px-2 text-dusty/70 font-mono text-[11px] uppercase tracking-wider text-right hidden md:table-cell">UTXOs</th>
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
                      <td className="py-2 px-2 text-right text-amber-400/90 font-semibold">{fmtDog(w.airdrop_dog)}</td>
                      <td className="py-2 px-2 text-right text-dusty/70 hidden md:table-cell text-[11px]">{w.addr_type}</td>
                      <td className="py-2 px-2 text-right text-dusty hidden md:table-cell">{w.funded_txo_count}</td>
                    </tr>
                  ))}
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

        {/* ── Caveats ── */}
        <Card variant="glass" className="border-amber-400/10">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400/80" />
              <CardTitle className="text-snow text-lg md:text-xl font-display">
                Caveats
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-dusty text-xs md:text-sm font-mono leading-relaxed">
              {data.methodology.ceiling_disclaimer}
            </p>
            <p className="text-dusty/70 text-xs font-mono leading-relaxed mt-3">
              The pipeline runs hourly via local Bitcoin Core <code className="text-lava">scantxoutset</code> —
              if any "lost" wallet finally signs an outgoing transaction, the next refresh removes it from this set.
              The number can only shrink over time.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}
