"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Layout } from "@/components/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Copy, Check, ArrowRight, Server, Code2, ShieldCheck,
  Trophy, Medal, Target, Loader2, ChevronDown, Zap, Users, Activity,
} from "lucide-react"
import Image from "next/image"
import dogStatsFallback from '@/data/dog_stats_fallback.json'
import externalHoldersFallback from '@/data/external_holders.json'

// ── Constants ────────────────────────────────────────────────────────────────

const DONATION_GOAL = 10_000_000

const FALLBACK_HOLDERS = {
  btc:    (dogStatsFallback as any).totalHolders ?? 91963,
  solana: externalHoldersFallback.solana.holders,
  stacks: externalHoldersFallback.stacks.holders,
}

const DONATIONS = [
  {
    key: "bitcoin",
    title: "Bitcoin",
    symbol: "BTC",
    logo: "/BTC.png",
    qr: "/qrbtc.jpeg",
    address: "bc1qkq43gqyr7gjzj0mxz0v7e0nzs3cm59g9jspc63",
    note: "Native SegWit",
  },
  {
    key: "dog",
    title: "DOG Rune",
    symbol: "DOG",
    logo: "/DOG.png",
    qr: "/qrdog.jpeg",
    address: "bc1pxk7aw9ug55jkkz02z7ayhlkxxq92ya0ctegcwm5j8jumgaavjlkqdylk2p",
    note: "Bitcoin L1 Rune",
    featured: true,
  },
  {
    key: "stacks",
    title: "Stacks",
    symbol: "STX",
    logo: "/STX .png",
    qr: "/qrstx.jpeg",
    address: "SP18DX0ANJTAA3WWWA501QHR27J76KPGV9MQ0J01Y",
    note: "Stacks L2",
  },
]

const PLATFORM_STATS_STATIC = [
  { label: "UTXOs Indexed",      value: "250K+" },
  { label: "Free API Endpoints", value: "35"    },
  { label: "Bitcoin Node",       value: "24/7"  },
]

const WHY_DONATE = [
  {
    icon: Server,
    color: "text-lava",
    bg: "bg-lava/10",
    border: "border-lava/20",
    title: "Real Infrastructure, Not Cloud Shortcuts",
    body: "We run a full Bitcoin Core + Ord node synced from genesis — not a third-party API proxy. When the chain moves, you see it in seconds.",
  },
  {
    icon: Code2,
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    border: "border-blue-400/20",
    title: "Free for Every Builder, Forever",
    body: "No API keys. No paywalls. No rate limits for the community. 35 endpoints, MCP Server, SSE streams — all free. Your support makes that possible.",
  },
  {
    icon: ShieldCheck,
    color: "text-green-400",
    bg: "bg-green-400/10",
    border: "border-green-400/20",
    title: "Immutable. Permanent. On-Chain.",
    body: "Every sat lands on Bitcoin L1 — no middleman takes a cut, no black box. Your contribution is verifiable by anyone, forever. Your wallet joins the Hall of Sats.",
  },
]

// ── Types ────────────────────────────────────────────────────────────────────

interface DonorEntry {
  rank: number
  address: string
  total: number
  txCount: number
  lastTx: string
}

interface LeaderboardData {
  goal: number
  total_received: number
  progress_pct: number
  donor_count: number
  leaderboard: DonorEntry[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDog(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M"
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K"
  return Math.floor(n).toLocaleString()
}

function shortAddr(addr: string): string {
  return addr.slice(0, 8) + "…" + addr.slice(-6)
}

const MEDAL_COLOR = ["text-yellow-400", "text-slate-300", "text-amber-600"]
const MEDAL_BG    = ["bg-yellow-400/[0.06]", "bg-slate-300/[0.04]", "bg-amber-600/[0.05]"]
const MEDAL_ICON  = ["🥇", "🥈", "🥉"]

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DonatePage() {
  const router    = useRouter()
  const donateRef = useRef<HTMLDivElement>(null)

  const [copied,      setCopied]      = useState<string | null>(null)
  const [lb,          setLb]          = useState<LeaderboardData | null>(null)
  const [lbLoading,   setLbLoading]   = useState(true)
  const [progressWidth, setProgressWidth] = useState(0)
  const [holders, setHolders] = useState(FALLBACK_HOLDERS)

  useEffect(() => {
    // Leaderboard
    fetch("/api/donate/leaderboard")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d) {
          setLb(d)
          setTimeout(() => setProgressWidth(Math.max(d.progress_pct, 0.5)), 400)
        }
      })
      .catch(() => {})
      .finally(() => setLbLoading(false))

    // Holder counts — same sources as the overview page
    Promise.allSettled([
      fetch('/api/dog-rune/holders?page=1&limit=1').then(r => r.ok ? r.json() : null),
      fetch('/api/multichain/stats').then(r => r.ok ? r.json() : null),
    ]).then(([btcRes, multiRes]) => {
      const btc =
        btcRes.status === 'fulfilled' && btcRes.value
          ? (btcRes.value.pagination?.total ?? FALLBACK_HOLDERS.btc)
          : FALLBACK_HOLDERS.btc
      const solana =
        multiRes.status === 'fulfilled' && multiRes.value
          ? (multiRes.value.chains?.find((c: any) => c.chain === 'solana')?.holder_count ?? FALLBACK_HOLDERS.solana)
          : FALLBACK_HOLDERS.solana
      const stacks =
        multiRes.status === 'fulfilled' && multiRes.value
          ? (multiRes.value.chains?.find((c: any) => c.chain === 'stacks')?.holder_count ?? FALLBACK_HOLDERS.stacks)
          : FALLBACK_HOLDERS.stacks
      setHolders({ btc, solana, stacks })
    })
  }, [])

  const copyAddress = async (address: string, key: string) => {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    } catch { /* clipboard not available */ }
  }

  const scrollToDonate = () => {
    donateRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const enterApp = () => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("dogdata-session", "1")
    }
    router.push("/")
  }

  return (
    <Layout currentPage="donate" setCurrentPage={() => {}}>
      <div className="flex flex-col">

        {/* ════════════════════════════════════════════════════════════
            SECTION 1 — HERO
        ════════════════════════════════════════════════════════════ */}
        <section className="relative flex flex-col items-center justify-center text-center px-4 pt-10 pb-12 md:pt-16 md:pb-20 overflow-hidden">
          {/* Ambient glow */}
          <div
            className="pointer-events-none absolute inset-0 z-0"
            style={{ background: "radial-gradient(ellipse 80% 60% at 50% 30%, rgba(245,110,15,0.09) 0%, transparent 70%)" }}
          />

          {/* Live badge */}
          <div className="relative z-10 mb-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-green-500/30 bg-green-500/[0.07] text-green-400 font-mono text-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            Bitcoin Node Online — Syncing Live
          </div>

          {/* DOG logo */}
          <div className="relative z-10 mb-6 animate-float">
            <div className="relative w-24 h-24 md:w-32 md:h-32">
              <div
                className="absolute inset-0 rounded-full animate-breathe"
                style={{ background: "radial-gradient(circle, rgba(245,110,15,0.25) 0%, transparent 70%)" }}
              />
              <Image
                src="/DOG.png"
                alt="DOG Rune"
                width={128}
                height={128}
                className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(245,110,15,0.4)]"
              />
            </div>
          </div>

          {/* Headline */}
          <h1 className="relative z-10 font-display font-bold leading-tight text-3xl md:text-5xl lg:text-6xl max-w-3xl">
            <span className="gradient-text">
              {(holders.btc + holders.solana + holders.stacks).toLocaleString('en-US')}+ Holders Tracked.
            </span>
            <br />
            <span className="text-snow">One Full Node.</span>
            <br />
            <span className="text-snow/55">No Corporate Funding.</span>
          </h1>

          {/* Sub-headline */}
          <p className="relative z-10 mt-5 font-mono text-sm md:text-base text-snow/55 max-w-xl leading-relaxed">
            You're not donating.{" "}
            <span className="text-snow/80">You're funding infrastructure you use.</span>
            {" "}{(holders.btc + holders.solana + holders.stacks).toLocaleString('en-US')}+ DOG holders across Bitcoin, Solana & Stacks depend on this data — free, on-chain, and running 24/7.
          </p>

          {/* Scroll hint */}
          <button
            onClick={scrollToDonate}
            className="relative z-10 mt-10 text-dusty/40 hover:text-dusty transition-colors animate-float"
            style={{ animationDelay: "0.6s" }}
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        </section>

        {/* ════════════════════════════════════════════════════════════
            SECTION 2 — COMMUNITY GOAL (prominent)
        ════════════════════════════════════════════════════════════ */}
        <section className="px-4 py-8 md:py-10 border-y border-snow/[0.04]">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-6 space-y-1">
              <div className="inline-flex items-center gap-2 text-lava font-mono text-xs uppercase tracking-widest">
                <Target className="w-3.5 h-3.5" />
                Community Fundraising Goal
              </div>
              <div className="font-display font-bold text-4xl md:text-5xl gradient-text">
                10,000,000 DOG
              </div>
              <p className="font-mono text-xs text-dusty">
                Help the DOG community reach this milestone — every DOG donated keeps this platform running free.
              </p>
            </div>

            {/* Progress block */}
            {lbLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-dusty" />
              </div>
            ) : lb ? (
              <div className="space-y-3">
                {/* Bar */}
                <div className="relative w-full h-5 rounded-full bg-snow/[0.05] overflow-hidden border border-snow/[0.06]">
                  <div
                    className="h-full rounded-full transition-all duration-[1800ms] ease-out"
                    style={{
                      width: `${progressWidth}%`,
                      background: "linear-gradient(90deg, #D45D0D 0%, #F56E0F 40%, #FFAD42 100%)",
                      boxShadow: "0 0 16px rgba(245,110,15,0.35)",
                    }}
                  />
                  {/* Shimmer overlay */}
                  <div
                    className="absolute inset-0 rounded-full animate-shimmer opacity-40"
                    style={{ width: `${progressWidth}%` }}
                  />
                </div>

                {/* Numbers */}
                <div className="flex items-center justify-between text-sm font-mono">
                  <div className="space-y-0.5">
                    <div className="text-lava font-bold">{formatDog(lb.total_received)} DOG</div>
                    <div className="text-dusty text-xs">raised so far</div>
                  </div>
                  <div className="text-center">
                    <div className="text-snow/70 font-bold text-lg">{lb.progress_pct.toFixed(2)}%</div>
                    <div className="text-dusty text-xs">{lb.donor_count} donors</div>
                  </div>
                  <div className="text-right space-y-0.5">
                    <div className="text-snow/50 font-bold">{formatDog(DONATION_GOAL - lb.total_received)} DOG</div>
                    <div className="text-dusty text-xs">remaining</div>
                  </div>
                </div>

                {/* CTA under goal */}
                <div className="pt-2 text-center">
                  <button
                    onClick={scrollToDonate}
                    className="font-mono text-xs text-lava hover:text-lava-light underline-offset-4 hover:underline transition-colors"
                  >
                    Be part of it — contribute now ↓
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-center font-mono text-xs text-dusty py-4">Goal data unavailable</p>
            )}
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════
            SECTION 3 — PLATFORM STATS BAR
        ════════════════════════════════════════════════════════════ */}
        <section className="border-b border-snow/[0.04] bg-snow/[0.01] px-4 py-4 md:py-5">
          <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-0 md:divide-x md:divide-snow/[0.06]">
            {/* Dynamic holder count */}
            <div className="flex flex-col items-center gap-1 md:px-6">
              <span className="text-2xl md:text-3xl font-bold font-display gradient-text">
                {(holders.btc + holders.solana + holders.stacks).toLocaleString('en-US')}+
              </span>
              <span className="font-mono text-xs text-dusty text-center">Holders Tracked</span>
            </div>
            {/* Static stats */}
            {PLATFORM_STATS_STATIC.map(({ label, value }) => (
              <div key={label} className="flex flex-col items-center gap-1 md:px-6">
                <span className="text-2xl md:text-3xl font-bold font-display gradient-text">{value}</span>
                <span className="font-mono text-xs text-dusty text-center">{label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════
            SECTION 4 — WHY SUPPORT
        ════════════════════════════════════════════════════════════ */}
        <section className="px-4 py-10 md:py-14">
          <div className="max-w-5xl mx-auto space-y-6 md:space-y-0 md:grid md:grid-cols-3 md:gap-6">
            {WHY_DONATE.map(({ icon: Icon, color, bg, border, title, body }) => (
              <Card key={title} variant="glass" className="border-snow/[0.05] stagger-item">
                <CardContent className="p-5 md:p-6 space-y-3">
                  <div className={`w-10 h-10 rounded-xl ${bg} border ${border} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                  <h3 className="font-display font-semibold text-snow text-base leading-snug">{title}</h3>
                  <p className="font-mono text-xs text-dusty leading-relaxed">{body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════
            SECTION 5 — DONATION METHODS
        ════════════════════════════════════════════════════════════ */}
        <section ref={donateRef} className="px-4 py-10 md:py-14 border-t border-snow/[0.04] scroll-mt-16">
          <div className="max-w-5xl mx-auto space-y-8">
            <div className="text-center space-y-2">
              <h2 className="font-display font-bold text-2xl md:text-3xl text-snow">
                Choose Your Donation Method
              </h2>
              <p className="font-mono text-sm text-dusty">
                Scan the QR code or copy the address — every satoshi counts.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              {DONATIONS.map((d) => (
                <Card
                  key={d.key}
                  variant="glass"
                  className={`stagger-item transition-all ${
                    d.featured
                      ? "border-lava/30 shadow-[0_0_30px_rgba(245,110,15,0.08)]"
                      : "border-snow/[0.05]"
                  }`}
                >
                  <CardContent className="p-5 md:p-6 flex flex-col items-center gap-4">
                    {/* Token header */}
                    <div className="flex items-center gap-2 w-full">
                      <Image src={d.logo} alt={d.title} width={28} height={28} className="w-7 h-7 object-contain" />
                      <div>
                        <div className="font-display font-bold text-snow text-sm">{d.title}</div>
                        <div className="font-mono text-xs text-dusty">{d.note}</div>
                      </div>
                      {d.featured && (
                        <span className="ml-auto text-[10px] font-mono px-2 py-0.5 rounded-full bg-lava/15 text-lava border border-lava/25">
                          NATIVE
                        </span>
                      )}
                    </div>

                    {/* QR Code */}
                    <Image
                      src={d.qr}
                      alt={`QR ${d.title}`}
                      width={200}
                      height={200}
                      className="w-[180px] h-[180px] md:w-[200px] md:h-[200px] object-contain rounded-lg"
                    />

                    {/* Address */}
                    <div className="w-full px-3 py-2 rounded-lg bg-snow/[0.03] border border-snow/[0.07]">
                      <p className="font-mono text-[10px] break-all text-snow/70 text-center leading-relaxed select-all">
                        {d.address}
                      </p>
                    </div>

                    {/* Copy */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyAddress(d.address, d.key)}
                      className={`w-full rounded-lg transition-all ${
                        d.featured
                          ? "border-lava/40 bg-lava/10 hover:bg-lava/20"
                          : "border-snow/10 bg-snow/[0.03] hover:bg-snow/[0.07]"
                      }`}
                    >
                      {copied === d.key ? (
                        <>
                          <Check className="w-3.5 h-3.5 mr-2 text-green-400" />
                          <span className="text-green-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 mr-2" />
                          Copy Address
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            <p className="text-center font-mono text-xs text-dusty/55">
              No middleman takes a cut. Every sat reaches the node directly.{" "}
              <span className="text-dusty/80">Verify any donation on-chain.</span>
            </p>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════
            SECTION 6 — HALL OF SATS
        ════════════════════════════════════════════════════════════ */}
        <section className="px-4 py-10 md:py-14 border-t border-snow/[0.04]">
          <div className="max-w-3xl mx-auto space-y-8">

            {/* Header */}
            <div className="text-center space-y-3">
              <div className="inline-flex items-center gap-2 text-yellow-400 font-mono text-xs uppercase tracking-widest">
                <Trophy className="w-3.5 h-3.5" />
                Hall of Sats
              </div>
              <h2 className="font-display font-bold text-2xl md:text-3xl text-snow">
                Your Contribution Is Permanent
              </h2>
              <p className="font-mono text-sm text-dusty max-w-lg mx-auto leading-relaxed">
                Every DOG donation is indexed and displayed here — immutably, on Bitcoin L1.
                Your wallet is visible to every DOG DATA visitor.{" "}
                <span className="text-snow/80">That's {(holders.btc + holders.solana + holders.stacks).toLocaleString('en-US')}+ holders seeing your support.</span>
              </p>
            </div>

            {/* Leaderboard */}
            <Card variant="glass" className="border-snow/[0.05] overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-snow/[0.05]">
                <Medal className="w-4 h-4 text-lava" />
                <span className="font-display font-semibold text-snow text-sm">DOG Donors Ranking</span>
              </div>

              {lbLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-dusty" />
                </div>
              ) : !lb || lb.leaderboard.length === 0 ? (
                <div className="text-center py-16 space-y-3">
                  <Trophy className="w-10 h-10 text-dusty/20 mx-auto" />
                  <p className="text-snow/70 font-display font-semibold text-base">
                    The Hall of Sats is empty.
                  </p>
                  <p className="text-dusty font-mono text-xs max-w-xs mx-auto leading-relaxed">
                    Be the first. Your wallet claims the #1 spot permanently — visible to every one of the {(holders.btc + holders.solana + holders.stacks).toLocaleString('en-US')}+ DOG holders who visits.
                  </p>
                </div>
              ) : (
                <>
                  {/* Column labels */}
                  <div className="grid grid-cols-[2.5rem_1fr_auto_auto] gap-2 px-5 py-2 text-[10px] font-mono text-dusty/50 uppercase tracking-wider border-b border-snow/[0.04]">
                    <span>#</span>
                    <span>Wallet</span>
                    <span className="text-right">DOG</span>
                    <span className="text-right pr-1">Txs</span>
                  </div>

                  {/* Rows */}
                  <div className="divide-y divide-snow/[0.03]">
                    {lb.leaderboard.slice(0, 50).map((entry) => {
                      const isTop3   = entry.rank <= 3
                      const color    = isTop3 ? MEDAL_COLOR[entry.rank - 1] : "text-dusty/60"
                      const rowBg    = isTop3 ? MEDAL_BG[entry.rank - 1]    : ""
                      return (
                        <div
                          key={entry.address}
                          className={`grid grid-cols-[2.5rem_1fr_auto_auto] gap-2 items-center px-5 py-3 hover:bg-snow/[0.02] transition-colors ${rowBg}`}
                        >
                          <span className={`font-bold font-mono text-sm ${color}`}>
                            {isTop3 ? MEDAL_ICON[entry.rank - 1] : `#${entry.rank}`}
                          </span>
                          <span className="font-mono text-xs text-snow/70 truncate" title={entry.address}>
                            {shortAddr(entry.address)}
                          </span>
                          <span className={`text-right font-mono text-xs font-bold ${isTop3 ? color : "text-snow/55"}`}>
                            {formatDog(entry.total)}
                          </span>
                          <span className="text-right font-mono text-xs text-dusty/50 pr-1">
                            {entry.txCount}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  {lb.leaderboard.length > 50 && (
                    <p className="text-center text-xs text-dusty font-mono py-3 border-t border-snow/[0.04]">
                      Showing top 50 of {lb.leaderboard.length} donors
                    </p>
                  )}
                </>
              )}
            </Card>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════
            SECTION 7 — ENTER APP
        ════════════════════════════════════════════════════════════ */}
        <section className="px-4 py-10 md:py-14 border-t border-snow/[0.04]">
          <div className="max-w-md mx-auto text-center space-y-4">
            <p className="font-mono text-sm text-dusty">Already a supporter? Or just exploring?</p>
            <Button
              size="lg"
              variant="outline"
              onClick={enterApp}
              className="rounded-xl px-8 text-base font-semibold border-snow/10 hover:border-lava/30 hover:bg-lava/5"
            >
              Enter DOG DATA
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <p className="text-dusty/45 font-mono text-xs">
              The Donate button is always in the menu — come back anytime.
            </p>
          </div>
        </section>

      </div>
    </Layout>
  )
}
