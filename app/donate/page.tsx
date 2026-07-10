"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { useRouter } from "next/navigation"
import { motion, useScroll, useTransform } from "framer-motion"
import { Layout } from "@/components/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Copy, Check, ArrowRight, ShieldCheck,
  Trophy, Loader2, Crown, Building2, Store, Gem,
  Sparkles, Search, ExternalLink, Radio,
  Bitcoin, Zap, Ruler, MapPin,
} from "lucide-react"
import Image from "next/image"
import dynamic from "next/dynamic"
import PlotMap from "./plot-map"
import CityMapHero from "./city-map-hero"
import dogStatsFallback from '@/data/dog_stats_fallback.json'
import externalHoldersFallback from '@/data/external_holders.json'

// The real Satoshi Plaza landmark (live Three.js), ssr:false — uses WebGL/canvas.
const FoundersTower = dynamic(() => import("./founders-tower"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-end justify-center pb-4">
      <div className="w-2 h-20 md:h-28 rounded-t-full opacity-40" style={{ background: "linear-gradient(to top, #D45D0D, #FFAD42)" }} />
    </div>
  ),
})

// ── Constants ────────────────────────────────────────────────────────────────

const DONATION_GOAL = 10_000_000
const PERSONAL_LICENSE = 10_000
const COMMERCIAL_LICENSE = 50_000
const DONATION_WALLET = "bc1pxk7aw9ug55jkkz02z7ayhlkxxq92ya0ctegcwm5j8jumgaavjlkqdylk2p"

const FALLBACK_HOLDERS = {
  btc:    (dogStatsFallback as any).totalHolders ?? 91963,
  solana: externalHoldersFallback.solana.holders,
  stacks: externalHoldersFallback.stacks.holders,
}

const DONATIONS = [
  {
    key: "dog",
    title: "DOG Rune",
    symbol: "DOG",
    logo: "/DOG.png",
    qr: "/qrdog.jpeg",
    address: DONATION_WALLET,
    note: "Bitcoin L1 Rune — counts toward your license",
    featured: true,
  },
  {
    key: "bitcoin",
    title: "Bitcoin",
    symbol: "BTC",
    logo: "/BTC.png",
    qr: "/qrbtc.jpeg",
    address: "bc1qkq43gqyr7gjzj0mxz0v7e0nzs3cm59g9jspc63",
    note: "Native SegWit — general support",
  },
  {
    key: "stacks",
    title: "Stacks",
    symbol: "STX",
    logo: "/STX .png",
    qr: "/qrstx.jpeg",
    address: "SP18DX0ANJTAA3WWWA501QHR27J76KPGV9MQ0J01Y",
    note: "Stacks L2 — general support",
  },
]

// The single-rail ladder: donate any amount → accumulate → licenses unlock.
// Every donor is a Founder (name on the monument); licenses gate the mint.
const LADDER = [
  {
    key: "citizen",
    icon: Sparkles,
    color: "#CBD5E1",
    name: "Founder",
    threshold: "Any amount",
    perks: [
      "Your name engraved on the Founders' Monument",
      "Counts toward the 10M Grand Opening",
      "Personal progress bar toward your license",
    ],
  },
  {
    key: "personal",
    icon: Building2,
    color: "#F56E0F",
    name: "Personal License",
    threshold: "10,000 DOG",
    usd: "~$6",
    perks: [
      "Mint your building at the Grand Opening — pay only BTC network fees",
      "One-time, permanent, tied to your wallet",
      "Customize your wallet profile modal",
    ],
    featured: true,
  },
  {
    key: "commercial",
    icon: Store,
    color: "#FB923C",
    name: "Commercial License",
    threshold: "50,000 DOG",
    usd: "~$30",
    perks: [
      "Everything in Personal",
      "Ad space on your building's facade",
      "Edit your building (model / color)",
    ],
  },
  {
    key: "patron",
    icon: Crown,
    color: "#FCD34D",
    name: "Patron",
    threshold: "500,000 DOG",
    usd: "~$300",
    perks: [
      "Everything in Commercial",
      "Fully bespoke building — designed for you within the city's guidelines",
      "Individual plaque on the Patrons' Walk, encircling the Founders' Monument",
    ],
  },
]

// The Grand Opening mint — buildings are Ordinal inscriptions on Bitcoin L1.
const MINT_FACTS = [
  {
    icon: Bitcoin,
    color: "#F7931A",
    title: "Minted on Bitcoin L1",
    body: "Your building is an Ordinal inscription — a permanent on-chain deed that lives in your wallet, not in a database.",
  },
  {
    icon: Zap,
    color: "#FFAD42",
    title: "Only network fees",
    body: "Your license (in DOG) funds the city. The mint itself has zero markup — you pay only the Bitcoin network fee.",
  },
  {
    icon: Ruler,
    color: "#F56E0F",
    title: "Sized by your balance",
    body: "Building height and plot size scale with your DOG balance. Skyscraper or cottage — the chain decides.",
  },
  {
    icon: MapPin,
    color: "#FB923C",
    title: "Placed by your history",
    body: "Your district is set by the age of your oldest UTXO above 20,000 DOG. Old paws live downtown.",
  },
]

// ── Types ────────────────────────────────────────────────────────────────────

interface DonorEntry {
  rank: number
  address: string
  total: number
  txCount: number
  lastTx: string
  license: "citizen" | "personal" | "commercial"
}

interface FounderEntry {
  founder_seq: number
  address: string
  crossed_at: string
  total: number
  license: string
}

interface RecentEntry {
  address: string
  amount: number
  timestamp: string
  txid: string
}

interface PlotData {
  found: boolean
  address?: string
  rank?: number
  total_dog?: number
  total_holders?: number
  district?: { id: number; name: string; color: string; tag: string }
  pin?: { nx: number; nz: number }
}

interface LeaderboardData {
  goal: number
  total_received: number
  progress_pct: number
  donor_count: number
  leaderboard: DonorEntry[]
  founders_count: number
  founders: FounderEntry[]
  recent: RecentEntry[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDog(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M"
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K"
  return Math.floor(n).toLocaleString()
}

function shortAddr(addr: string): string {
  if (addr === "anonymous") return "Anonymous Donor"
  return addr.slice(0, 8) + "…" + addr.slice(-6)
}

function timeAgo(ts: string): string {
  if (!ts) return ""
  const then = new Date(ts).getTime()
  if (Number.isNaN(then)) return ""
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

const MEDAL_COLOR = ["text-yellow-400", "text-slate-300", "text-amber-600"]
const MEDAL_BG    = ["bg-yellow-400/[0.06]", "bg-slate-300/[0.04]", "bg-amber-600/[0.05]"]
const MEDAL_ICON  = ["🥇", "🥈", "🥉"]

// ── BlurText (lightweight scroll reveal, matches coming-soon language) ─────────

function BlurText({ text, className, style, delay = 0, wordDelay = 60 }: {
  text: string; className?: string; style?: React.CSSProperties; delay?: number; wordDelay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect() }
    }, { threshold: 0.05 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  const words = text.split(" ")
  return (
    <div ref={ref} className={className} style={style} aria-label={text}>
      {words.map((word, i) => (
        <span
          key={i}
          style={{
            display: "inline-block",
            marginRight: i < words.length - 1 ? "0.28em" : 0,
            filter: visible ? "blur(0px)" : "blur(12px)",
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(10px)",
            transition: `filter 0.7s ease ${delay + i * wordDelay}ms, opacity 0.7s ease ${delay + i * wordDelay}ms, transform 0.65s ease ${delay + i * wordDelay}ms`,
          }}
        >
          {word}
        </span>
      ))}
    </div>
  )
}

// ── WordReveal (masked line-rise for display headlines — hero-grade) ──────────

function WordReveal({ text, className, style, delay = 0, stagger = 65 }: {
  text: string; className?: string; style?: React.CSSProperties; delay?: number; stagger?: number
}) {
  const words = text.split(" ")
  return (
    <h1 className={className} style={style} aria-label={text}>
      {words.map((word, i) => (
        <span
          key={i}
          style={{
            display: "inline-block",
            overflow: "hidden",
            verticalAlign: "bottom",
            paddingBottom: "0.12em",
            marginBottom: "-0.12em",
            marginRight: i < words.length - 1 ? "0.26em" : 0,
          }}
        >
          <motion.span
            style={{ display: "inline-block", willChange: "transform" }}
            initial={{ y: "115%", rotate: 4 }}
            animate={{ y: "0%", rotate: 0 }}
            transition={{ duration: 0.95, delay: (delay + i * stagger) / 1000, ease: [0.16, 1, 0.3, 1] }}
          >
            {word}
          </motion.span>
        </span>
      ))}
    </h1>
  )
}

// ── CountUp (eased tabular counter, fires once when scrolled into view) ───────

function CountUp({ value, format, className, style, duration = 1500 }: {
  value: number; format?: (n: number) => string; className?: string; style?: React.CSSProperties; duration?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [armed, setArmed] = useState(false)
  const [display, setDisplay] = useState(0)
  const fmt = format ?? ((n: number) => Math.round(n).toLocaleString("en-US"))

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setArmed(true); obs.disconnect() }
    }, { threshold: 0.4 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (!armed) return
    let raf = 0
    const start = performance.now()
    const from = 0
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p) // easeOutExpo
      setDisplay(from + (value - from) * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [armed, value, duration])

  return <span ref={ref} className={className} style={style}>{fmt(display)}</span>
}

// ── SpotlightCard (cursor spotlight + gentle 3D tilt) ─────────────────────────

function SpotlightCard({ children, className = "", style, tilt = true }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties; tilt?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const onMove = (e: React.MouseEvent) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    el.style.setProperty("--mx", `${x}px`)
    el.style.setProperty("--my", `${y}px`)
    if (tilt) {
      const rx = (y / r.height - 0.5) * -4.5
      const ry = (x / r.width - 0.5) * 4.5
      el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg)`
    }
  }
  const onLeave = () => {
    const el = ref.current
    if (el) el.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg)"
  }
  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={`spotlight-card ${className}`}
      style={{ ...style, transition: "transform 0.4s cubic-bezier(0.16,1,0.3,1), border-color 0.3s ease, box-shadow 0.3s ease" }}
    >
      {children}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DonatePage() {
  const router    = useRouter()
  const donateRef = useRef<HTMLDivElement>(null)
  const heroRef   = useRef<HTMLElement>(null)

  // Hero scroll parallax — the video sinks and swells as the page takes over.
  const { scrollYProgress: heroProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] })
  const videoScale  = useTransform(heroProgress, [0, 1], [1, 1.18])
  const videoY      = useTransform(heroProgress, [0, 1], ["0%", "14%"])
  const heroContentY = useTransform(heroProgress, [0, 1], ["0%", "-18%"])
  const heroFade    = useTransform(heroProgress, [0, 0.75], [1, 0])

  const [copied,      setCopied]      = useState<string | null>(null)
  const [lb,          setLb]          = useState<LeaderboardData | null>(null)
  const [lbLoading,   setLbLoading]   = useState(true)
  const [progressWidth, setProgressWidth] = useState(0)
  const [holders, setHolders] = useState(FALLBACK_HOLDERS)
  const [registerTab, setRegisterTab] = useState<"founders" | "builders">("founders")
  const [lookup, setLookup] = useState("")
  const [lookupAddr, setLookupAddr] = useState<string | null>(null)
  const [plot, setPlot] = useState<PlotData | null>(null)

  useEffect(() => {
    // Leaderboard + founders + live feed (single endpoint)
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

    // Holder counts — Redis-backed fallback first (fast), then live sources
    fetch('/api/holders-fallback')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d && (d.btc > 0 || d.solana > 0 || d.stacks > 0)) {
          setHolders({ btc: d.btc, solana: d.solana, stacks: d.stacks })
        }
      })
      .catch(() => {})

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

  const totalHolders = holders.btc + holders.solana + holders.stacks

  // Personal progress: look up a pasted address (read-only) against the
  // leaderboard the page already fetched — no wallet connect required.
  const myEntry = useMemo(() => {
    if (!lookupAddr || !lb) return null
    const a = lookupAddr.toLowerCase()
    return lb.leaderboard.find((e) => e.address.toLowerCase() === a) ?? null
  }, [lookupAddr, lb])

  const myFounder = useMemo(() => {
    if (!lookupAddr || !lb) return null
    const a = lookupAddr.toLowerCase()
    return lb.founders.find((f) => f.address.toLowerCase() === a) ?? null
  }, [lookupAddr, lb])

  // Resolve the pasted address to its DogCity plot (district + map pin). Works
  // for ANY $DOG holder, donor or not — the plot is on-chain history, not money.
  useEffect(() => {
    if (!lookupAddr) { setPlot(null); return }
    setPlot(null) // re-arm the surveying state on every new lookup
    let alive = true
    fetch(`/api/plot?address=${encodeURIComponent(lookupAddr)}`)
      .then((r) => r.json())
      .then((d: PlotData) => { if (alive) setPlot(d) })
      .catch(() => { if (alive) setPlot(null) })
    return () => { alive = false }
  }, [lookupAddr])

  const copyAddress = async (address: string, key: string) => {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    } catch { /* clipboard not available */ }
  }

  const scrollToDonate = () => donateRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })

  const enterApp = () => {
    if (typeof window !== "undefined") sessionStorage.setItem("dogdata-session", "1")
    router.push("/")
  }

  return (
    <Layout currentPage="donate" setCurrentPage={() => {}}>
      <div className="flex flex-col bg-void">

        {/* ════════════════════════════════════════════════════════════
            SECTION 1 — HERO (video, "The city can't be bought")
        ════════════════════════════════════════════════════════════ */}
        <section ref={heroRef} className="relative min-h-[88vh] flex flex-col items-center justify-center text-center px-4 py-20 overflow-hidden bg-black">
          <motion.div className="absolute inset-0" style={{ scale: videoScale, y: videoY }}>
            <CityMapHero />
          </motion.div>
          {/* soft vignette — the map is already dark, this just seats the edges */}
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 105% 95% at 50% 48%, transparent 0%, rgba(0,0,0,0.55) 100%)" }} />
          <div className="absolute inset-x-0 bottom-0 h-1/4 pointer-events-none" style={{ background: "linear-gradient(to top, #000 0%, transparent 100%)" }} />

          <motion.div className="relative z-10 w-full max-w-4xl mx-auto" style={{ y: heroContentY, opacity: heroFade }}>
            {/* Live badge */}
            <div className="mb-8 inline-flex items-center gap-2.5 liquid-glass rounded-lg px-4 py-1.5 border border-lava/[0.18]">
              <span className="w-1.5 h-1.5 rounded-full bg-lava animate-pulse-dot" />
              <span className="font-mono text-[10px] text-lava/70 tracking-[0.22em] uppercase">City Construction Fund</span>
              <span className="w-px h-3 bg-white/10" />
              <span className="font-mono text-[10px] text-dusty/60 tracking-[0.22em] uppercase">Live</span>
            </div>

            <WordReveal
              text="The city can't be bought. It can be built."
              className="text-snow mb-6"
              style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2.4rem, 7vw, 5.5rem)", fontWeight: 800, lineHeight: 1.02, letterSpacing: "-0.02em" }}
              delay={120} stagger={70}
            />

            <BlurText
              text="Every $DOG wallet already has a plot — earned by history, not money. At 10M DOG the city opens and every building is minted as an Ordinal on Bitcoin L1. Fund the construction. Found the city."
              className="text-snow/75 mb-10 mx-auto font-mono"
              style={{ fontSize: "clamp(0.8rem, 1.8vw, 0.95rem)", lineHeight: 1.7, letterSpacing: "0.01em", maxWidth: "40rem", textShadow: "0 1px 14px rgba(0,0,0,0.9)" }}
              delay={520} wordDelay={22}
            />

            {/* Construction Fund + compact bar — solid panel, same certificate
                language as the Plot Deed (no glass over the busy map) */}
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-md mx-auto rounded-2xl p-5 mb-8"
              style={{
                background: "linear-gradient(180deg, rgba(13,13,17,0.94), rgba(7,7,9,0.97))",
                border: "1px solid rgba(255,255,255,0.09)",
                boxShadow: "0 0 44px rgba(245,110,15,0.09), inset 0 1px 0 rgba(255,255,255,0.05)",
              }}
            >
              <div className="flex items-baseline justify-between mb-3">
                <span className="font-mono text-[10px] text-dusty/60 uppercase tracking-[0.18em]">Construction Fund</span>
                <span className="font-display font-bold text-2xl gradient-text tabular-nums">
                  {lbLoading || !lb ? "—" : <><CountUp value={lb.total_received} format={formatDog} /> / 10M</>}
                </span>
              </div>
              <div className="relative w-full h-2 rounded-full bg-snow/[0.06] overflow-hidden border border-white/[0.05]">
                <div
                  className="h-full rounded-full transition-all duration-[1600ms] ease-out"
                  style={{
                    width: `${progressWidth}%`,
                    background: "linear-gradient(90deg, #D45D0D 0%, #F56E0F 50%, #FFAD42 100%)",
                    boxShadow: "0 0 14px rgba(245,110,15,0.4)",
                  }}
                />
              </div>
              <p className="mt-3 font-mono text-[10px] text-dusty/50 leading-relaxed">
                At 10,000,000 DOG the mint opens. Everyone who funds it before that is a Founder{lb ? ` — ${lb.founders_count} so far.` : "."}
              </p>
            </motion.div>

            {/* Single primary CTA */}
            <motion.div
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.25, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col sm:flex-row gap-3 justify-center"
            >
              <button
                onClick={scrollToDonate}
                className="group flex items-center justify-center gap-2.5 px-8 py-3.5 bg-gradient-to-r from-lava to-lava-dark text-snow font-mono font-medium text-xs tracking-wide rounded-xl transition-all duration-300 shadow-[0_0_24px_rgba(245,110,15,0.2)] hover:shadow-[0_0_40px_rgba(245,110,15,0.34)] hover:scale-[1.02]"
              >
                <Crown className="w-4 h-4" />
                Become a Founder
              </button>
              <button
                onClick={enterApp}
                className="group flex items-center justify-center gap-2 px-8 py-3.5 bg-white/[0.03] border border-white/[0.07] hover:bg-white/[0.05] hover:border-lava/[0.2] text-dusty hover:text-snow font-mono font-medium text-xs tracking-wide rounded-xl transition-all duration-300"
              >
                Enter DOG DATA
                <span className="text-dusty/40 group-hover:text-lava/70 transition-colors">↗</span>
              </button>
            </motion.div>
          </motion.div>
        </section>

        {/* ════════════════════════════════════════════════════════════
            SECTION 2 — YOUR WALLET IS ALREADY THERE
        ════════════════════════════════════════════════════════════ */}
        <section className="relative z-10 px-4 py-16 md:py-24 border-t border-white/[0.04]">
          <div className="max-w-4xl mx-auto text-center">
            <p className="font-mono text-[10px] text-lava tracking-[0.28em] uppercase mb-5">Your address is merit, not money</p>
            <BlurText
              text={`${totalHolders.toLocaleString("en-US")} wallets. Yours is one of them.`}
              className="text-snow"
              style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.8rem, 4.5vw, 3.4rem)", fontWeight: 800, letterSpacing: "-0.015em", lineHeight: 1.05 }}
              delay={0} wordDelay={70}
            />
            <BlurText
              text="Your place in the city is assigned by on-chain history — when you received DOG, how long you've held, what you've built. That can't be bought. Founders don't get a better location; they get their names on the city itself."
              className="text-dusty mt-5 mx-auto font-mono"
              style={{ fontSize: "0.8rem", lineHeight: 1.8, letterSpacing: "0.01em", maxWidth: "42rem" }}
              delay={260} wordDelay={18}
            />

            {/* Paste-address → read-only personal progress (no city navigation) */}
            <div className="mt-9 max-w-lg mx-auto">
              <div className="flex items-center gap-2 liquid-glass rounded-xl border border-white/[0.07] p-1.5 focus-within:border-lava/30 transition-colors">
                <Search className="w-4 h-4 text-dusty/50 ml-2 shrink-0" />
                <input
                  value={lookup}
                  onChange={(e) => setLookup(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") setLookupAddr(lookup.trim()) }}
                  placeholder="Paste your $DOG address…"
                  spellCheck={false}
                  className="flex-1 bg-transparent outline-none font-mono text-xs text-snow/80 placeholder:text-dusty/40 min-w-0"
                />
                <Button
                  size="sm"
                  onClick={() => setLookupAddr(lookup.trim())}
                  className="rounded-lg bg-lava/15 hover:bg-lava/25 border border-lava/25 text-lava font-mono text-xs shrink-0"
                >
                  Find me
                </Button>
              </div>

              {/* Surveying state — while the registry resolves the address */}
              {lookupAddr && !plot && (
                <div className="mt-4 relative overflow-hidden text-left liquid-glass rounded-xl border border-white/[0.06] p-5">
                  <div className="registry-scan" />
                  <p className="font-mono text-[11px] text-dusty animate-pulse tracking-wide">Surveying the land registry…</p>
                </div>
              )}

              {/* Plot Deed — where this wallet's land sits in DogCity (any holder).
                  Styled as a land-registry certificate: corner ticks, one-shot
                  sheen sweep, district-colour theming, and the mint tie-in. */}
              {lookupAddr && plot?.found && plot.district && plot.pin && (
                <motion.div
                  key={lookupAddr}
                  initial={{ opacity: 0, y: 24, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                  className="mt-4 text-left relative overflow-hidden rounded-2xl"
                  style={{
                    background: "linear-gradient(180deg, rgba(14,14,18,0.92), rgba(8,8,10,0.96))",
                    border: `1px solid ${plot.district.color}38`,
                    boxShadow: `0 0 44px ${plot.district.color}16, inset 0 1px 0 rgba(255,255,255,0.05)`,
                  }}
                >
                  <div className="deed-sheen" />
                  {/* certificate corner ticks */}
                  <span className="absolute top-2 left-2 w-3 h-3 border-t border-l pointer-events-none" style={{ borderColor: `${plot.district.color}66` }} />
                  <span className="absolute top-2 right-2 w-3 h-3 border-t border-r pointer-events-none" style={{ borderColor: `${plot.district.color}66` }} />
                  <span className="absolute bottom-2 left-2 w-3 h-3 border-b border-l pointer-events-none" style={{ borderColor: `${plot.district.color}66` }} />
                  <span className="absolute bottom-2 right-2 w-3 h-3 border-b border-r pointer-events-none" style={{ borderColor: `${plot.district.color}66` }} />

                  <div className="h-px" style={{ background: `linear-gradient(90deg, transparent, ${plot.district.color}, transparent)`, opacity: 0.6 }} />
                  <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.05]">
                    <span className="flex items-center gap-2 font-mono text-[9px] tracking-[0.24em] uppercase text-dusty">
                      <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: plot.district.color, boxShadow: `0 0 8px ${plot.district.color}` }} />
                      DogCity Land Registry · Plot Deed
                    </span>
                    <span className="font-mono text-[10px] font-bold tabular-nums" style={{ color: plot.district.color }}>
                      LOT #{plot.rank?.toLocaleString("en-US")}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-5 p-5">
                    <div className="relative shrink-0">
                      <PlotMap districtId={plot.district.id} color={plot.district.color} nx={plot.pin.nx} nz={plot.pin.nz} size={168} />
                    </div>
                    <div className="flex flex-col justify-center gap-3.5 min-w-0 w-full">
                      <div>
                        <div className="font-display font-bold text-2xl leading-tight" style={{ color: plot.district.color }}>{plot.district.name}</div>
                        <div className="font-mono text-[10px] text-dusty mt-0.5">{plot.district.tag} · district {plot.district.id} of 10 · Satoshi Plaza at centre</div>
                      </div>
                      <div className="grid grid-cols-3 gap-x-4 gap-y-2">
                        <div>
                          <div className="font-mono text-[8.5px] tracking-widest uppercase text-dusty/70">$DOG held</div>
                          <div className="font-mono text-sm text-snow tabular-nums font-bold">{formatDog(plot.total_dog ?? 0)}</div>
                        </div>
                        <div>
                          <div className="font-mono text-[8.5px] tracking-widest uppercase text-dusty/70">City rank</div>
                          <div className="font-mono text-sm text-snow tabular-nums font-bold">#{plot.rank?.toLocaleString("en-US")}</div>
                        </div>
                        <div>
                          <div className="font-mono text-[8.5px] tracking-widest uppercase text-dusty/70">Status</div>
                          <div className="font-mono text-sm font-bold" style={{ color: plot.district.color }}>Reserved</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="px-5 py-3 border-t border-white/[0.05] font-mono text-[11px] text-dusty leading-relaxed" style={{ background: `linear-gradient(180deg, transparent, ${plot.district.color}0a)` }}>
                    This plot is already yours — assigned by on-chain history, not money.{" "}
                    <span className="text-snow/70">At the Grand Opening, this is where you mint your building.</span>
                  </div>
                </motion.div>
              )}

              {/* Address holds no DOG → no plot in the city */}
              {lookupAddr && plot && plot.found === false && (
                <div className="mt-4 text-left liquid-glass rounded-xl border border-white/[0.06] p-4">
                  <p className="font-mono text-[11px] text-dusty leading-relaxed">
                    This address doesn't hold $DOG yet, so it has no plot in DogCity. Every holder gets one automatically — it's your on-chain history, not a purchase.
                  </p>
                </div>
              )}

              {/* Personal progress result */}
              {lookupAddr && lb && (
                <div className="mt-4 text-left liquid-glass rounded-xl border border-white/[0.06] p-4">
                  {myEntry ? (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-xs text-snow/70">{shortAddr(myEntry.address)}</span>
                        <span className="flex items-center gap-1.5">
                          {myFounder && (
                            <span className="inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded-full bg-yellow-400/10 text-yellow-400 border border-yellow-400/25">
                              <Crown className="w-3 h-3" /> Founder #{myFounder.founder_seq}
                            </span>
                          )}
                          {myEntry.license !== "citizen" && (
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-lava/10 text-lava border border-lava/25 capitalize">
                              {myEntry.license} License
                            </span>
                          )}
                        </span>
                      </div>
                      {myEntry.license === "citizen" ? (
                        <>
                          <div className="relative w-full h-2.5 rounded-full bg-snow/[0.06] overflow-hidden border border-white/[0.05] mb-2">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min((myEntry.total / PERSONAL_LICENSE) * 100, 100)}%`,
                                background: "linear-gradient(90deg, #D45D0D, #F56E0F, #FFAD42)",
                              }}
                            />
                          </div>
                          <p className="font-mono text-[11px] text-dusty">
                            <span className="text-lava font-bold">{formatDog(myEntry.total)}</span> / 10,000 DOG until your Personal License.
                          </p>
                        </>
                      ) : (
                        <p className="font-mono text-[11px] text-dusty">
                          Unlocked with <span className="text-lava font-bold">{formatDog(myEntry.total)} DOG</span> donated
                          {myEntry.license === "personal" && <> — {formatDog(COMMERCIAL_LICENSE - myEntry.total)} more for Commercial.</>}
                          {myEntry.license === "commercial" && <> — top tier reached. 🏙️</>}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="font-mono text-[11px] text-dusty leading-relaxed">
                      This address hasn't donated yet. Every DOG counts twice — toward the city and toward your own license.
                      Donate below and watch your bar fill.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════
            SECTION 2.5 — THE MINT (buildings are Ordinals on Bitcoin L1)
        ════════════════════════════════════════════════════════════ */}
        <section className="relative z-10 px-4 py-16 md:py-24 border-t border-white/[0.04]">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <p className="font-mono text-[10px] text-lava tracking-[0.28em] uppercase mb-5">The Grand Opening Mint</p>
              <BlurText
                text="Your building will be a Bitcoin Ordinal."
                className="text-snow"
                style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.7rem, 4vw, 3rem)", fontWeight: 800, letterSpacing: "-0.015em", lineHeight: 1.06 }}
                delay={0} wordDelay={60}
              />
              <BlurText
                text="The land is already surveyed — every plot mapped, every wallet assigned. Paste your address above and see yours. When the fund reaches 10M DOG, the mint opens: you inscribe your building on Bitcoin L1, into your own wallet. The city takes nothing from the mint."
                className="text-dusty mt-4 mx-auto font-mono"
                style={{ fontSize: "0.78rem", lineHeight: 1.8, letterSpacing: "0.01em", maxWidth: "40rem" }}
                delay={220} wordDelay={16}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {MINT_FACTS.map((f, i) => {
                const Icon = f.icon
                return (
                  <motion.div
                    key={f.title}
                    initial={{ opacity: 0, y: 18 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.55, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
                    viewport={{ once: true, margin: "-40px" }}
                  >
                    <SpotlightCard
                      className="relative overflow-hidden rounded-2xl p-5 h-full"
                      style={{ background: "rgba(10,10,12,0.7)", border: "1px solid rgba(255,255,255,0.05)" }}
                    >
                      <span
                        className="absolute top-3 right-4 font-display font-extrabold text-5xl leading-none select-none pointer-events-none"
                        style={{ color: "transparent", WebkitTextStroke: `1px ${f.color}22` }}
                      >
                        0{i + 1}
                      </span>
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-4" style={{ background: `${f.color}14` }}>
                        <Icon style={{ color: f.color, width: 18, height: 18 }} />
                      </div>
                      <div className="font-display font-bold text-snow text-base tracking-tight mb-2">{f.title}</div>
                      <p className="font-mono text-[10px] text-dusty/60 leading-relaxed">{f.body}</p>
                    </SpotlightCard>
                  </motion.div>
                )
              })}
            </div>

            <p className="text-center font-mono text-[11px] text-dusty/45 mt-8 max-w-2xl mx-auto leading-relaxed">
              Two rails, one building: the license is paid in DOG and funds the city — the mint is paid in nothing
              but Bitcoin network fees. Your deed lives on the same chain as your DOG.
            </p>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════
            SECTION 3 — THE INAUGURATION BAR (10M countdown + live feed)
        ════════════════════════════════════════════════════════════ */}
        <section className="relative z-10 px-4 py-14 md:py-20 border-t border-white/[0.04] bg-snow/[0.01]">
          <div className="max-w-4xl mx-auto grid md:grid-cols-[1.4fr_1fr] gap-8 items-start">

            {/* The bar */}
            <div>
              <p className="font-mono text-[10px] text-lava tracking-[0.28em] uppercase mb-3">The Grand Inauguration</p>
              <h2 className="font-display font-bold text-2xl md:text-3xl text-snow leading-tight mb-2">
                10M DOG opens the city.<br /><span className="text-snow/55">All of it, at once.</span>
              </h2>
              <p className="font-mono text-xs text-dusty mb-6 leading-relaxed">
                No stretch goals. No feature drips. No founder quotas. When the City Construction Fund reaches 10,000,000 DOG, the whole city opens in one Grand Inauguration — and the building mint goes live.
              </p>

              {lbLoading ? (
                <div className="flex items-center py-6"><Loader2 className="w-5 h-5 animate-spin text-dusty" /></div>
              ) : lb ? (
                <div className="space-y-3">
                  <div className="relative w-full h-5 rounded-full bg-snow/[0.05] border border-white/[0.06]">
                    <div className="absolute inset-0 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-[1800ms] ease-out"
                        style={{
                          width: `${progressWidth}%`,
                          background: "linear-gradient(90deg, #D45D0D 0%, #F56E0F 40%, #FFAD42 100%)",
                          boxShadow: "0 0 16px rgba(245,110,15,0.35)",
                        }}
                      />
                      <div className="absolute inset-0 rounded-full animate-shimmer opacity-40" style={{ width: `${progressWidth}%` }} />
                      {/* milestone ticks */}
                      {[25, 50, 75].map((m) => (
                        <div key={m} className="absolute top-0 bottom-0 w-px bg-white/10" style={{ left: `${m}%` }} />
                      ))}
                    </div>
                    {/* glowing tip that rides the bar */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full"
                      style={{
                        left: `calc(${progressWidth}% - 5px)`,
                        background: "#FFAD42",
                        boxShadow: "0 0 14px 5px rgba(255,173,66,0.45)",
                        transition: "left 1800ms ease-out",
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-sm font-mono">
                    <div>
                      <div className="text-lava font-bold"><CountUp value={lb.total_received} format={formatDog} /> DOG</div>
                      <div className="text-dusty text-xs">raised of 10M</div>
                    </div>
                    <div className="text-center">
                      <div className="text-snow/70 font-bold text-lg"><CountUp value={lb.progress_pct} format={(n) => n.toFixed(2)} />%</div>
                      <div className="text-dusty text-xs"><CountUp value={lb.donor_count} /> builders</div>
                    </div>
                    <div className="text-right">
                      <div className="text-snow/50 font-bold"><CountUp value={DONATION_GOAL - lb.total_received} format={formatDog} /> DOG</div>
                      <div className="text-dusty text-xs">to opening</div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="font-mono text-xs text-dusty py-4">Fund data unavailable</p>
              )}
            </div>

            {/* Live feed */}
            <div className="liquid-glass rounded-2xl border border-white/[0.06] overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.05]">
                <Radio className="w-3.5 h-3.5 text-green-400" />
                <span className="font-mono text-[11px] text-snow/70 uppercase tracking-wider">Live donations</span>
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              </div>
              <div className="divide-y divide-white/[0.03] max-h-[280px] overflow-y-auto">
                {lbLoading ? (
                  <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-dusty" /></div>
                ) : lb && lb.recent.length > 0 ? (
                  lb.recent.map((r, i) => (
                    <div key={r.txid + i} className="flex items-center justify-between px-4 py-2.5">
                      <div className="min-w-0">
                        <div className="font-mono text-[11px] text-snow/70 truncate">{shortAddr(r.address)}</div>
                        <div className="font-mono text-[9px] text-dusty/45">{timeAgo(r.timestamp)}</div>
                      </div>
                      <span className="font-mono text-[11px] font-bold text-lava shrink-0 ml-2">+{formatDog(r.amount)}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-center font-mono text-[11px] text-dusty/60 py-10 px-4 leading-relaxed">
                    No donations yet. Be the first to lay a brick.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════
            SECTION 4 — THE LADDER (single rail + Founders' Monument)
        ════════════════════════════════════════════════════════════ */}
        <section className="relative z-10 px-4 py-16 md:py-24 border-t border-white/[0.04]">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <p className="font-mono text-[10px] text-lava tracking-[0.28em] uppercase mb-5">Every DOG counts twice</p>
              <BlurText
                text="One rail. Any amount. Your license unlocks itself."
                className="text-snow"
                style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.7rem, 4vw, 3rem)", fontWeight: 800, letterSpacing: "-0.015em", lineHeight: 1.06 }}
                delay={0} wordDelay={60}
              />
              <BlurText
                text="Toward the city — and toward your own license. Donate any amount; at 10,000 DOG your Personal License unlocks automatically: your right to mint your building at the Grand Opening. At 50,000, Commercial. No checkout, no second address."
                className="text-dusty mt-4 mx-auto font-mono"
                style={{ fontSize: "0.78rem", lineHeight: 1.8, letterSpacing: "0.01em", maxWidth: "38rem" }}
                delay={220} wordDelay={16}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {LADDER.map((t, i) => {
                const Icon = t.icon
                return (
                  <motion.div
                    key={t.key}
                    initial={{ opacity: 0, y: 18 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.55, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
                    viewport={{ once: true, margin: "-40px" }}
                    className="h-full"
                  >
                    <SpotlightCard
                      className="relative overflow-hidden rounded-2xl p-5 flex flex-col h-full"
                      style={{
                        background: "rgba(10,10,12,0.7)",
                        border: t.featured ? `1px solid ${t.color}45` : "1px solid rgba(255,255,255,0.05)",
                        boxShadow: t.featured ? `0 0 28px ${t.color}18` : "none",
                      }}
                    >
                      {t.featured && (
                        <span className="absolute top-3 right-3 font-mono text-[8px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-full bg-lava/15 text-lava border border-lava/25">
                          Unlocks the Mint
                        </span>
                      )}
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-4" style={{ background: `${t.color}14` }}>
                        <Icon className="w-4.5 h-4.5" style={{ color: t.color, width: 18, height: 18 }} />
                      </div>
                      <div className="font-display font-bold text-snow text-base tracking-tight">{t.name}</div>
                      <div className="flex items-baseline gap-1.5 mt-1 mb-4">
                        <span className="font-mono font-bold text-sm" style={{ color: t.color }}>{t.threshold}</span>
                        {t.usd && <span className="font-mono text-[10px] text-dusty/45">{t.usd} · once</span>}
                      </div>
                      <ul className="space-y-2 mt-auto">
                        {t.perks.map((p) => (
                          <li key={p} className="flex items-start gap-2 font-mono text-[10px] text-dusty/60 leading-relaxed">
                            <span className="mt-1 w-1 h-1 rounded-full shrink-0" style={{ background: t.color }} />
                            {p}
                          </li>
                        ))}
                      </ul>
                    </SpotlightCard>
                  </motion.div>
                )
              })}
            </div>

            <p className="text-center font-mono text-[11px] text-dusty/45 mt-8 max-w-2xl mx-auto leading-relaxed">
              Only DOG counts toward licenses and Founder status. BTC and STX are welcome as general support —
              the city belongs to the DOG. Licenses are one-time purchases of utility, not investments; the building
              mint costs only the Bitcoin network fee, and nothing a license buys changes your position in the city.
            </p>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════
            SECTION 4.5 — THE MONUMENT (full-bleed Satoshi Plaza stage)
        ════════════════════════════════════════════════════════════ */}
        <section className="relative z-10 border-t border-white/[0.04] overflow-hidden bg-black">
          <div className="relative h-[80vh] min-h-[600px] max-h-[880px]">
            {/* stage glow */}
            <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 75% 65% at 50% 100%, rgba(245,110,15,0.13), transparent 70%)" }} />

            {/* the real Satoshi Plaza tower — live 3D, full stage */}
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: 0, scale: 0.94 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
              viewport={{ once: true, margin: "-100px" }}
            >
              <FoundersTower />
            </motion.div>

            {/* caption */}
            <div className="absolute top-6 inset-x-0 text-center z-10 pointer-events-none">
              <span className="font-mono text-[9px] text-dusty/70 uppercase tracking-[0.26em]">Founders' Monument · Satoshi Plaza · live render</span>
            </div>

            {/* legibility gradients */}
            <div className="absolute inset-x-0 bottom-0 h-2/5 pointer-events-none" style={{ background: "linear-gradient(to top, #000 4%, transparent)" }} />
            <div className="absolute inset-y-0 left-0 w-full md:w-[58%] pointer-events-none" style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.5) 55%, transparent 100%)" }} />

            {/* copy — bottom sheet on mobile, left panel on desktop */}
            <div className="absolute inset-0 z-10 flex items-end md:items-center pointer-events-none">
              <div className="w-full max-w-6xl mx-auto px-6 md:px-10 pb-10 md:pb-0">
                <motion.div
                  className="max-w-md pointer-events-auto"
                  initial={{ opacity: 0, y: 26 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.9, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  viewport={{ once: true, margin: "-80px" }}
                >
                  <div className="inline-flex items-center gap-2 font-mono text-[10px] text-yellow-400 uppercase tracking-[0.2em] mb-4">
                    <Crown className="w-3.5 h-3.5" /> The Founders' Monument
                  </div>
                  <h3 className="font-display font-bold text-snow text-2xl md:text-4xl leading-tight mb-4" style={{ letterSpacing: "-0.015em" }}>
                    Every wallet that builds the city is carved into it.
                  </h3>
                  <p className="font-mono text-[11px] text-dusty/75 leading-relaxed mb-3">
                    Everyone who donates before the fund reaches 10,000,000 DOG is a Founder — any amount,
                    ranked by arrival, not by price. Your address is engraved on the monument, a Founder
                    badge marks your profile, and the register closes forever the moment the goal is hit.
                  </p>
                  <p className="font-mono text-[11px] leading-relaxed mb-5" style={{ color: "rgba(252,211,77,0.85)" }}>
                    Patrons get their own star: an individual plaque on the Patrons' Walk — the golden
                    ring encircling the monument.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {["Monument engraving", "Founder badge", "Ranked by arrival", "Patrons' Walk plaques", "Closes at 10M"].map((p) => (
                      <span key={p} className="font-mono text-[9px] px-2.5 py-1 rounded-full bg-yellow-400/[0.07] text-yellow-400/80 border border-yellow-400/20">{p}</span>
                    ))}
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════
            SECTION 5 — DONATION METHODS
        ════════════════════════════════════════════════════════════ */}
        <section ref={donateRef} className="relative z-10 px-4 py-16 md:py-24 border-t border-white/[0.04] scroll-mt-16">
          <div className="max-w-5xl mx-auto space-y-8">
            <div className="text-center space-y-2">
              <h2 className="font-display font-bold text-2xl md:text-3xl text-snow">You're not donating. You're founding a city.</h2>
              <p className="font-mono text-sm text-dusty">
                Any amount counts — toward the city, and toward your license. Scan the QR or copy the address.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              {DONATIONS.map((d) => (
                <Card
                  key={d.key}
                  variant="glass"
                  className={`stagger-item group transition-all duration-300 hover:-translate-y-1.5 ${d.featured ? "border-lava/30 shadow-[0_0_30px_rgba(245,110,15,0.08)] hover:shadow-[0_0_44px_rgba(245,110,15,0.16)]" : "border-snow/[0.05] hover:border-lava/[0.18]"}`}
                >
                  <CardContent className="p-5 md:p-6 flex flex-col items-center gap-4">
                    <div className="flex items-center gap-2 w-full">
                      <Image src={d.logo} alt={d.title} width={28} height={28} className="w-7 h-7 object-contain" />
                      <div>
                        <div className="font-display font-bold text-snow text-sm">{d.title}</div>
                        <div className="font-mono text-[10px] text-dusty">{d.note}</div>
                      </div>
                      {d.featured && (
                        <span className="ml-auto text-[10px] font-mono px-2 py-0.5 rounded-full bg-lava/15 text-lava border border-lava/25">COUNTS</span>
                      )}
                    </div>

                    <Image src={d.qr} alt={`QR ${d.title}`} width={200} height={200} className="w-[180px] h-[180px] md:w-[200px] md:h-[200px] object-contain rounded-lg transition-transform duration-500 group-hover:scale-[1.03]" />

                    <div className="w-full px-3 py-2 rounded-lg bg-snow/[0.03] border border-snow/[0.07]">
                      <p className="font-mono text-[10px] break-all text-snow/70 text-center leading-relaxed select-all">{d.address}</p>
                    </div>

                    <Button
                      variant="outline" size="sm"
                      onClick={() => copyAddress(d.address, d.key)}
                      className={`w-full rounded-lg transition-all ${d.featured ? "border-lava/40 bg-lava/10 hover:bg-lava/20" : "border-snow/10 bg-snow/[0.03] hover:bg-snow/[0.07]"}`}
                    >
                      {copied === d.key ? (
                        <><Check className="w-3.5 h-3.5 mr-2 text-green-400" /><span className="text-green-400">Copied!</span></>
                      ) : (
                        <><Copy className="w-3.5 h-3.5 mr-2" />Copy Address</>
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
            SECTION 6 — FOUNDERS REGISTER (ex-Hall of Sats)
        ════════════════════════════════════════════════════════════ */}
        <section className="relative z-10 px-4 py-16 md:py-24 border-t border-white/[0.04] bg-snow/[0.01]">
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="text-center space-y-3">
              <div className="inline-flex items-center gap-2 text-yellow-400 font-mono text-xs uppercase tracking-widest">
                <Trophy className="w-3.5 h-3.5" /> The Founders Register
              </div>
              <h2 className="font-display font-bold text-2xl md:text-3xl text-snow">Your place in the city is permanent.</h2>
              <p className="font-mono text-sm text-dusty max-w-lg mx-auto leading-relaxed">
                Indexed and displayed here, immutably, on Bitcoin L1 — visible to every one of the{" "}
                <span className="text-snow/80">{totalHolders.toLocaleString("en-US")}+ holders</span> who visits.
              </p>
            </div>

            {/* Tabs */}
            <div className="flex items-center justify-center gap-2">
              {([["founders", "Founders", "by arrival"], ["builders", "Top Builders", "by volume"]] as const).map(([key, label, sub]) => (
                <button
                  key={key}
                  onClick={() => setRegisterTab(key)}
                  className={`px-4 py-2 rounded-xl font-mono text-xs transition-all border ${
                    registerTab === key
                      ? "bg-lava/12 border-lava/30 text-lava"
                      : "bg-white/[0.02] border-white/[0.06] text-dusty hover:text-snow/70"
                  }`}
                >
                  {label}
                  <span className="ml-1.5 text-[9px] opacity-60">{sub}</span>
                </button>
              ))}
            </div>

            <Card variant="glass" className="border-snow/[0.05] overflow-hidden">
              {lbLoading ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-dusty" /></div>
              ) : registerTab === "founders" ? (
                // ── Founders (arrival order) ──
                !lb || lb.founders.length === 0 ? (
                  <div className="text-center py-16 space-y-3">
                    <Crown className="w-10 h-10 text-yellow-400/25 mx-auto" />
                    <p className="text-snow/70 font-display font-semibold text-base">No Founders yet.</p>
                    <p className="text-dusty font-mono text-xs max-w-xs mx-auto leading-relaxed">
                      Be Founder #1. The first donation — any amount — claims the first name on the monument, forever.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-[3.5rem_1fr_auto] gap-2 px-5 py-2 text-[10px] font-mono text-dusty/50 uppercase tracking-wider border-b border-snow/[0.04]">
                      <span>Founder</span><span>Wallet</span><span className="text-right pr-1">DOG</span>
                    </div>
                    <div className="divide-y divide-snow/[0.03]">
                      {lb.founders.slice(0, 100).map((f) => (
                        <div key={f.address} className="grid grid-cols-[3.5rem_1fr_auto] gap-2 items-center px-5 py-3 hover:bg-snow/[0.02] transition-colors">
                          <span className="font-bold font-mono text-xs text-yellow-400 flex items-center gap-1">
                            <Crown className="w-3 h-3" />#{f.founder_seq}
                          </span>
                          <span className="font-mono text-xs text-snow/70 truncate" title={f.address}>{shortAddr(f.address)}</span>
                          <span className="text-right font-mono text-xs font-bold text-snow/55 pr-1">{formatDog(f.total)}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-center text-[11px] text-dusty font-mono py-3 border-t border-snow/[0.04]">
                      {lb.founders_count} Founders — every one engraved at Satoshi Plaza · register closes at 10M DOG
                    </p>
                  </>
                )
              ) : (
                // ── Top Builders (volume) ──
                !lb || lb.leaderboard.length === 0 ? (
                  <div className="text-center py-16 space-y-3">
                    <Trophy className="w-10 h-10 text-dusty/20 mx-auto" />
                    <p className="text-snow/70 font-display font-semibold text-base">The register is empty.</p>
                    <p className="text-dusty font-mono text-xs max-w-xs mx-auto leading-relaxed">Be the first. Your wallet claims the #1 spot permanently.</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-[2.5rem_1fr_auto_auto] gap-2 px-5 py-2 text-[10px] font-mono text-dusty/50 uppercase tracking-wider border-b border-snow/[0.04]">
                      <span>#</span><span>Wallet</span><span className="text-right">DOG</span><span className="text-right pr-1">Txs</span>
                    </div>
                    <div className="divide-y divide-snow/[0.03]">
                      {lb.leaderboard.slice(0, 50).map((entry) => {
                        const isTop3 = entry.rank <= 3
                        const color  = isTop3 ? MEDAL_COLOR[entry.rank - 1] : "text-dusty/60"
                        const rowBg  = isTop3 ? MEDAL_BG[entry.rank - 1] : ""
                        return (
                          <div key={entry.address} className={`grid grid-cols-[2.5rem_1fr_auto_auto] gap-2 items-center px-5 py-3 hover:bg-snow/[0.02] transition-colors ${rowBg}`}>
                            <span className={`font-bold font-mono text-sm ${color}`}>
                              {isTop3 ? MEDAL_ICON[entry.rank - 1] : `#${entry.rank}`}
                            </span>
                            <span className="font-mono text-xs text-snow/70 truncate flex items-center gap-1.5" title={entry.address}>
                              {shortAddr(entry.address)}
                              {entry.license === "commercial" && <Store className="w-3 h-3 text-lava/70 shrink-0" />}
                              {entry.license === "personal" && <Building2 className="w-3 h-3 text-lava/60 shrink-0" />}
                            </span>
                            <span className={`text-right font-mono text-xs font-bold ${isTop3 ? color : "text-snow/55"}`}>{formatDog(entry.total)}</span>
                            <span className="text-right font-mono text-xs text-dusty/50 pr-1">{entry.txCount}</span>
                          </div>
                        )
                      })}
                    </div>
                    {lb.leaderboard.length > 50 && (
                      <p className="text-center text-xs text-dusty font-mono py-3 border-t border-snow/[0.04]">Showing top 50 of {lb.leaderboard.length} builders</p>
                    )}
                  </>
                )
              )}
            </Card>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════
            SECTION 7 — DON'T TRUST. VERIFY. + ENTER APP
        ════════════════════════════════════════════════════════════ */}
        <section className="relative z-10 px-4 py-16 md:py-24 border-t border-white/[0.04]">
          <div className="max-w-3xl mx-auto space-y-10">
            <div className="liquid-glass-strong rounded-2xl border border-white/[0.06] px-8 py-10 text-center">
              <div className="inline-flex items-center gap-2 font-mono text-[10px] text-lava uppercase tracking-[0.24em] mb-4">
                <ShieldCheck className="w-3.5 h-3.5" /> Don't trust. Verify.
              </div>
              <p className="font-display font-bold text-snow text-xl md:text-2xl leading-tight mb-4">
                Your address can't be bought. That's the point.
              </p>
              <p className="font-mono text-[11px] text-dusty/65 max-w-xl mx-auto leading-relaxed mb-6">
                The treasury is public and every donation is verifiable on Bitcoin's immutable ledger.
                Founders get their names on the city — never a better location.
              </p>
              <a
                href={`https://mempool.space/address/${DONATION_WALLET}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 font-mono text-xs text-lava hover:text-lava-light transition-colors"
              >
                <Gem className="w-3.5 h-3.5" /> View the treasury on-chain <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="max-w-md mx-auto text-center space-y-4">
              <p className="font-mono text-sm text-dusty">Already a supporter? Or just exploring?</p>
              <Button
                size="lg" variant="outline" onClick={enterApp}
                className="rounded-xl px-8 text-base font-semibold border-snow/10 hover:border-lava/30 hover:bg-lava/5"
              >
                Enter DOG DATA
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <p className="text-dusty/45 font-mono text-xs">The Donate button is always in the menu — come back anytime.</p>
            </div>
          </div>
        </section>

      </div>
    </Layout>
  )
}
