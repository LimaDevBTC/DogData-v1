"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Layout } from "@/components/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Copy, Check, ArrowRight, Server, Code2, ShieldCheck,
  Trophy, Medal, Target, Loader2, ChevronDown,
  Zap, Users, Activity,
} from "lucide-react"
import Image from "next/image"

// ── Constants ────────────────────────────────────────────────────────────────

const DONATION_GOAL = 10_000_000

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

const PLATFORM_STATS = [
  { label: "Holders Tracked", value: "91K+", icon: Users },
  { label: "UTXOs Indexed", value: "250K+", icon: Activity },
  { label: "Free API Endpoints", value: "35", icon: Zap },
  { label: "Bitcoin Node", value: "24/7", icon: Server },
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
const MEDAL_BG    = ["bg-yellow-400/10", "bg-slate-300/10", "bg-amber-600/10"]
const MEDAL_ICON  = ["🥇", "🥈", "🥉"]

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DonatePage() {
  const router  = useRouter()
  const donateRef = useRef<HTMLDivElement>(null)

  const [copied, setCopied] = useState<string | null>(null)
  const [lb, setLb]         = useState<LeaderboardData | null>(null)
  const [lbLoading, setLbLoading] = useState(true)
  const [progressWidth, setProgressWidth] = useState(0)

  useEffect(() => {
    fetch("/api/donate/leaderboard")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d) {
          setLb(d)
          // Animate progress bar in after a short delay
          setTimeout(() => setProgressWidth(Math.max(d.progress_pct, 0.4)), 300)
        }
      })
      .catch(() => {})
      .finally(() => setLbLoading(false))
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
            style={{
              background: "radial-gradient(ellipse 80% 60% at 50% 30%, rgba(245,110,15,0.10) 0%, transparent 70%)",
            }}
          />

          {/* Live node badge */}
          <div className="relative z-10 mb-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-green-500/30 bg-green-500/[0.07] text-green-400 font-mono text-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            Bitcoin Node Online — Syncing Live
          </div>

          {/* DOG Logo */}
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
            <span className="gradient-text">91,000+ Holders Tracked.</span>
            <br />
            <span className="text-snow">One Full Node.</span>
            <br />
            <span className="text-snow/60">No Corporate Funding.</span>
          </h1>

          {/* Sub-headline */}
          <p className="relative z-10 mt-5 font-mono text-sm md:text-base text-snow/60 max-w-xl leading-relaxed">
            You're not donating.{" "}
            <span className="text-snow/80">You're funding infrastructure you use.</span>
            {" "}91K+ DOG holders depend on this data — free, on-chain, and running 24/7 with no corporate backing.
          </p>

          {/* CTAs */}
          <div className="relative z-10 mt-8 flex flex-col sm:flex-row items-center gap-3">
            <Button
              size="lg"
              onClick={scrollToDonate}
              className="rounded-xl px-8 text-base font-semibold shadow-[0_0_30px_rgba(245,110,15,0.25)] hover:shadow-[0_0_40px_rgba(245,110,15,0.4)] transition-shadow"
            >
              Fund the Node
              <span className="ml-2">🐕</span>
            </Button>
            <button
              onClick={enterApp}
              className="text-dusty hover:text-snow font-mono text-sm transition-colors flex items-center gap-1.5 underline-offset-4 hover:underline"
            >
              Enter the app
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Scroll hint */}
          <button
            onClick={scrollToDonate}
            className="relative z-10 mt-10 text-dusty/50 hover:text-dusty transition-colors animate-float"
            style={{ animationDelay: "1s" }}
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        </section>

        {/* ════════════════════════════════════════════════════════════
            SECTION 2 — STATS BAR
        ════════════════════════════════════════════════════════════ */}
        <section className="border-y border-snow/[0.04] bg-snow/[0.01] px-4 py-4 md:py-6">
          <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-0 md:divide-x md:divide-snow/[0.06]">
            {PLATFORM_STATS.map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex flex-col items-center gap-1 md:px-6">
                <span className="text-2xl md:text-3xl font-bold font-display gradient-text">
                  {value}
                </span>
                <span className="font-mono text-xs text-dusty text-center">{label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════
            SECTION 3 — WHY SUPPORT US
        ════════════════════════════════════════════════════════════ */}
        <section className="px-4 py-10 md:py-16">
          <div className="max-w-5xl mx-auto space-y-6 md:space-y-0 md:grid md:grid-cols-3 md:gap-6">
            {WHY_DONATE.map(({ icon: Icon, color, bg, border, title, body }) => (
              <Card
                key={title}
                variant="glass"
                className="border-snow/[0.05] stagger-item"
              >
                <CardContent className="p-5 md:p-6 space-y-3">
                  <div className={`w-10 h-10 rounded-xl ${bg} border ${border} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                  <h3 className="font-display font-semibold text-snow text-base leading-snug">
                    {title}
                  </h3>
                  <p className="font-mono text-xs text-dusty leading-relaxed">{body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════
            SECTION 4 — DONATION METHODS
        ════════════════════════════════════════════════════════════ */}
        <section ref={donateRef} className="px-4 py-10 md:py-16 scroll-mt-20">
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
                      <Image
                        src={d.logo}
                        alt={d.title}
                        width={28}
                        height={28}
                        className="w-7 h-7 object-contain"
                      />
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
                    <div className="bg-white p-3 rounded-xl shadow-inner w-fit">
                      <Image
                        src={d.qr}
                        alt={`QR ${d.title}`}
                        width={168}
                        height={168}
                        className="w-[148px] h-[148px] md:w-[168px] md:h-[168px] object-contain"
                      />
                    </div>

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

            {/* Transparency note */}
            <p className="text-center font-mono text-xs text-dusty/60">
              All donations are on-chain and publicly verifiable on Bitcoin L1 — no middlemen, no mystery.
            </p>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════
            SECTION 5 — HALL OF FAME
        ════════════════════════════════════════════════════════════ */}
        <section className="px-4 py-10 md:py-16 border-t border-snow/[0.04]">
          <div className="max-w-3xl mx-auto space-y-8">

            {/* Header */}
            <div className="text-center space-y-3">
              <div className="inline-flex items-center gap-2 text-yellow-400 font-mono text-xs uppercase tracking-widest">
                <Trophy className="w-3.5 h-3.5" />
                Hall of Fame
              </div>
              <h2 className="font-display font-bold text-2xl md:text-3xl text-snow">
                Your Support Lives On the Chain
              </h2>
              <p className="font-mono text-sm text-dusty max-w-lg mx-auto leading-relaxed">
                Every DOG donation is indexed and displayed here — permanently. Your wallet
                appears in front of every visitor who opens DOG DATA. That's{" "}
                <span className="text-snow/80">91,000+ holders</span> seeing your name.
              </p>
            </div>

            {/* Goal Card */}
            <Card variant="glass" className="border-lava/[0.10]">
              <CardContent className="p-5 md:p-7 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-lava" />
                    <span className="font-mono text-sm text-dusty">Community Goal</span>
                  </div>
                  <span className="font-mono text-sm font-bold text-lava">
                    10,000,000 DOG
                  </span>
                </div>

                {lbLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-dusty" />
                  </div>
                ) : lb ? (
                  <>
                    {/* Progress bar */}
                    <div className="space-y-2">
                      <div className="w-full h-3 rounded-full bg-snow/[0.06] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-[1500ms] ease-out"
                          style={{
                            width: `${progressWidth}%`,
                            background: "linear-gradient(90deg, #F56E0F 0%, #FFAD42 60%, #F56E0F 100%)",
                            backgroundSize: "200% 100%",
                            animation: "shimmer 3s ease-in-out infinite",
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-xs font-mono text-dusty/60">
                        <span>{formatDog(lb.total_received)} DOG raised</span>
                        <span>{lb.progress_pct.toFixed(2)}% of goal</span>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="flex flex-wrap items-center gap-4 text-xs font-mono pt-1">
                      <span className="text-snow/70">
                        <span className="text-lava font-bold">{lb.donor_count}</span> unique donors
                      </span>
                      <span className="text-dusty/40">·</span>
                      <span className="text-snow/70">
                        <span className="text-snow/50">{formatDog(DONATION_GOAL - lb.total_received)}</span> DOG remaining
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-dusty font-mono text-xs text-center py-2">
                    Goal data unavailable
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Leaderboard */}
            <Card variant="glass" className="border-snow/[0.05] overflow-hidden">
              {/* Table header */}
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
                    No donors yet — be the first.
                  </p>
                  <p className="text-dusty font-mono text-xs">
                    Your wallet will claim the #1 spot in the Hall of Fame.
                  </p>
                </div>
              ) : (
                <>
                  {/* Column labels */}
                  <div className="grid grid-cols-[2.5rem_1fr_auto_auto] gap-2 px-5 py-2 text-[10px] font-mono text-dusty/50 uppercase tracking-wider border-b border-snow/[0.04]">
                    <span>Rank</span>
                    <span>Wallet</span>
                    <span className="text-right">DOG</span>
                    <span className="text-right pr-1">Txs</span>
                  </div>

                  {/* Rows */}
                  <div className="divide-y divide-snow/[0.03]">
                    {lb.leaderboard.slice(0, 50).map((entry) => {
                      const isTop3 = entry.rank <= 3
                      const color = isTop3 ? MEDAL_COLOR[entry.rank - 1] : "text-dusty/70"
                      const rowBg = isTop3 ? MEDAL_BG[entry.rank - 1] : ""
                      return (
                        <div
                          key={entry.address}
                          className={`grid grid-cols-[2.5rem_1fr_auto_auto] gap-2 items-center px-5 py-3
                            hover:bg-snow/[0.02] transition-colors ${rowBg}`}
                        >
                          <span className={`font-bold font-mono text-sm ${color}`}>
                            {isTop3 ? MEDAL_ICON[entry.rank - 1] : `#${entry.rank}`}
                          </span>
                          <span
                            className="font-mono text-xs text-snow/75 truncate"
                            title={entry.address}
                          >
                            {shortAddr(entry.address)}
                          </span>
                          <span className={`text-right font-mono text-xs font-bold ${isTop3 ? color : "text-snow/60"}`}>
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
            SECTION 6 — ENTER APP
        ════════════════════════════════════════════════════════════ */}
        <section className="px-4 py-12 md:py-16 border-t border-snow/[0.04]">
          <div className="max-w-xl mx-auto text-center space-y-4">
            <p className="font-mono text-sm text-dusty">
              Already a supporter? Or just exploring?
            </p>
            <Button
              size="lg"
              variant="outline"
              onClick={enterApp}
              className="rounded-xl px-8 text-base font-semibold border-snow/10 hover:border-lava/30 hover:bg-lava/5"
            >
              Enter DOG DATA
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <p className="text-dusty/50 font-mono text-xs">
              The Donate button is always in the menu — come back anytime.
            </p>
          </div>
        </section>

      </div>
    </Layout>
  )
}
