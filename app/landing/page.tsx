"use client"

// ═══════════════════════════════════════════════════════════════════════════
// DogCity landing — cinematic scrollytelling of the lunar masterplan.
// Built to take over /donate once approved: same shell, same live fund API,
// same Plot Deed lookup, plus the five-phase construction narrative.
// All dynamic numbers come from /api/donate/leaderboard and /api/plot.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react"
import Image from "next/image"
import {
  ArrowRight, Copy, Check, Search, Loader2, ShieldCheck,
  Bitcoin, MapPin, Radio, Sparkles,
} from "lucide-react"
import { Layout } from "@/components/layout"
import PlotMap from "../donate/plot-map"
import Scrollytelling from "./scrollytelling"
import {
  DONATION_GOAL, DONATION_METHODS, FEATURES, LOT_SEGMENTATION,
  LUNAR_SITE, PHASES, TIERS, WALLET_STEPS, formatDog, shortAddr,
} from "./dogcity-data"

interface RecentEntry { address: string; amount: number; timestamp: string; txid: string }
interface LeaderboardData {
  goal: number
  total_received: number
  progress_pct: number
  donor_count: number
  founders_count: number
  recent: RecentEntry[]
}
interface PlotData {
  found: boolean
  rank?: number
  total_dog?: number
  district?: { id: number; name: string; color: string; tag: string }
  pin?: { nx: number; nz: number }
}

function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="max-w-2xl">
      <div className="font-mono text-[11px] tracking-[0.3em] text-lava">{eyebrow}</div>
      <h2 className="font-display font-bold text-3xl md:text-4xl text-snow mt-3 leading-tight">{title}</h2>
      {sub && <p className="text-sm text-mist mt-3 leading-relaxed">{sub}</p>}
    </div>
  )
}

export default function LandingPage() {
  const [lb, setLb] = useState<LeaderboardData | null>(null)
  const [addr, setAddr] = useState("")
  const [lookupAddr, setLookupAddr] = useState("")
  const [plot, setPlot] = useState<PlotData | null>(null)
  const [plotLoading, setPlotLoading] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/donate/leaderboard")
      .then((r) => r.json())
      .then(setLb)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!lookupAddr) return
    setPlotLoading(true)
    fetch(`/api/plot?address=${encodeURIComponent(lookupAddr)}`)
      .then((r) => r.json())
      .then(setPlot)
      .catch(() => setPlot(null))
      .finally(() => setPlotLoading(false))
  }, [lookupAddr])

  const copy = (key: string, text: string) => {
    navigator.clipboard?.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 1600)
  }

  const raised = lb?.total_received ?? null
  const pct = lb ? Math.min(100, lb.progress_pct) : 0

  // persistent Build CTA after the hero
  const [showCta, setShowCta] = useState(false)
  useEffect(() => {
    const onScroll = () => setShowCta(window.scrollY > 700)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <Layout currentPage="donate" setCurrentPage={() => {}}>
      <div data-dogcity-landing className="bg-void text-snow -mt-14 md:-mt-16 w-screen ml-[calc(50%-50vw)]">

        <Scrollytelling raised={raised} founders={lb?.founders_count ?? null} />

        {/* ── LIVE CONSTRUCTION FUND ─────────────────────────────────────── */}
        <section id="build" className="relative border-t border-white/5 scroll-mt-16">
          <div className="max-w-6xl mx-auto px-6 md:px-10 py-20 md:py-28">
            <SectionHead
              eyebrow="LIVE CONSTRUCTION FUND"
              title="Help move DogCity from terrain to skyline."
              sub="The construction fund finances the systems, terrain, infrastructure and property tools needed to bring the city online. Every number below is live."
            />

            <div className="mt-10 grid md:grid-cols-[1fr_320px] gap-10">
              <div>
                {/* architectural progress bar */}
                <div className="flex items-baseline justify-between font-mono text-[11px] text-dusty mb-2">
                  <span>{raised !== null ? `${formatDog(raised)} DOG raised` : "loading…"}</span>
                  <span>goal {formatDog(DONATION_GOAL)} DOG</span>
                </div>
                <div className="relative h-3 border border-white/12 bg-white/[0.03]">
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-lava-dark via-lava to-amber transition-[width] duration-700"
                    style={{ width: `${Math.max(pct, 0.5)}%` }}
                  />
                  {[25, 50, 75].map((t) => (
                    <span key={t} className="absolute top-0 bottom-0 w-px bg-void/60" style={{ left: `${t}%` }} />
                  ))}
                </div>
                <div className="mt-2 font-mono text-[11px] text-lava tabular-nums">
                  {lb ? `${pct.toFixed(2)}% of the Grand Opening` : " "}
                </div>

                <div className="grid grid-cols-3 gap-px bg-white/8 border border-white/8 mt-8">
                  {[
                    { label: "Builders", value: lb?.donor_count },
                    { label: "Founders", value: lb?.founders_count },
                    { label: "Goal", value: DONATION_GOAL, fmt: true },
                  ].map((s) => (
                    <div key={s.label} className="bg-void p-4">
                      <div className="font-mono text-[10px] tracking-[0.2em] text-dusty">{s.label.toUpperCase()}</div>
                      <div className="font-display font-bold text-2xl text-snow mt-1 tabular-nums">
                        {s.value === undefined || s.value === null ? "—" : s.fmt ? formatDog(s.value) : s.value.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>

                {/* donation methods — the contribution flow itself */}
                <div className="mt-10 space-y-3">
                  {DONATION_METHODS.map((m) => (
                    <div
                      key={m.key}
                      className={`border p-4 flex items-center gap-4 ${m.featured ? "border-lava/40 bg-lava/[0.04]" : "border-white/10"}`}
                    >
                      <Image src={m.logo} alt={m.symbol} width={28} height={28} className="rounded-full shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="font-mono text-sm font-bold text-snow">{m.title}</span>
                          <span className="font-mono text-[10px] text-dusty">{m.note}</span>
                        </div>
                        <div className="font-mono text-[11px] text-mist truncate mt-1">{m.address}</div>
                      </div>
                      <button
                        onClick={() => copy(m.key, m.address)}
                        aria-label={`Copy ${m.title} address`}
                        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 font-mono text-[11px] border border-white/15 hover:border-lava/60 hover:text-lava transition-colors"
                      >
                        {copied === m.key ? <Check className="w-3.5 h-3.5 text-lava" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied === m.key ? "Copied" : "Copy"}
                      </button>
                    </div>
                  ))}
                  <p className="font-mono text-[10px] text-dusty leading-relaxed pt-1">
                    Send from the wallet you want registered — the sending address becomes your identity in DogCity.
                    No seed phrase is ever requested.
                  </p>
                </div>
              </div>

              {/* recent contributions */}
              <aside className="border border-white/8 bg-white/[0.02] p-5 h-fit">
                <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.25em] text-dusty">
                  <Radio className="w-3 h-3 text-lava animate-pulse" /> LIVE CONTRIBUTIONS
                </div>
                <ul className="mt-4 space-y-3">
                  {lb && lb.recent.length > 0 ? (
                    lb.recent.slice(0, 8).map((r, i) => (
                      <li key={r.txid + i} className="flex items-baseline justify-between gap-3 font-mono text-[11px]">
                        <span className="text-mist truncate">{shortAddr(r.address)}</span>
                        <span className="text-lava tabular-nums shrink-0">+{formatDog(r.amount)} DOG</span>
                      </li>
                    ))
                  ) : (
                    <li className="font-mono text-[11px] text-dusty">
                      {lb ? "Awaiting the next contribution." : "Loading live feed…"}
                    </li>
                  )}
                </ul>
              </aside>
            </div>
          </div>
        </section>

        {/* ── PLOT DEED — you are already on the map ─────────────────────── */}
        <section id="deed" className="border-t border-white/5 scroll-mt-16">
          <div className="max-w-6xl mx-auto px-6 md:px-10 py-20 md:py-28">
            <SectionHead
              eyebrow="PLOT DEED"
              title="You already live in DogCity."
              sub={`Every eligible DOG wallet holds one of the ${LOT_SEGMENTATION.total.toLocaleString()} demarcated lots. Paste your address to see your district — placement is derived from your on-chain history, live.`}
            />

            <div className="mt-8 max-w-xl">
              <form
                onSubmit={(e) => { e.preventDefault(); setLookupAddr(addr.trim()) }}
                className="flex gap-2"
              >
                <label htmlFor="deed-addr" className="sr-only">Your DOG wallet address</label>
                <input
                  id="deed-addr"
                  value={addr}
                  onChange={(e) => setAddr(e.target.value)}
                  placeholder="bc1p… your DOG address"
                  className="flex-1 bg-white/[0.03] border border-white/12 focus:border-lava/60 outline-none px-4 py-3 font-mono text-sm text-snow placeholder:text-dusty"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-5 font-mono text-sm font-bold text-void bg-lava hover:bg-lava-light transition-colors"
                >
                  {plotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Locate
                </button>
              </form>

              {lookupAddr && plot?.found && plot.district && plot.pin && (
                <div
                  className="mt-6 border p-5 flex items-center gap-6"
                  style={{ borderColor: `${plot.district.color}44`, boxShadow: `0 0 44px ${plot.district.color}14` }}
                >
                  <PlotMap districtId={plot.district.id} color={plot.district.color} nx={plot.pin.nx} nz={plot.pin.nz} size={150} />
                  <div className="min-w-0">
                    <div className="font-mono text-[10px] text-dusty">LOT #{plot.rank?.toLocaleString()}</div>
                    <div className="font-display font-bold text-2xl leading-tight" style={{ color: plot.district.color }}>
                      {plot.district.name}
                    </div>
                    <div className="font-mono text-[10px] text-dusty mt-1">
                      {plot.district.tag} · district {plot.district.id} of 10
                    </div>
                    <div className="font-mono text-xs text-snow mt-3 tabular-nums">
                      {formatDog(plot.total_dog ?? 0)} DOG · lot <span className="text-lava">Reserved</span>
                    </div>
                  </div>
                </div>
              )}
              {lookupAddr && plot && plot.found === false && (
                <p className="mt-4 font-mono text-[11px] text-dusty">
                  Address not found among eligible DOG holders — hold DOG in a self-custody wallet to receive a lot.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ── WALLET → BUILDING ──────────────────────────────────────────── */}
        <section id="how" className="border-t border-white/5 scroll-mt-16">
          <div className="max-w-6xl mx-auto px-6 md:px-10 py-20 md:py-28">
            <SectionHead
              eyebrow="HOW IT WORKS"
              title="From wallet to lunar property."
              sub="The wallet authenticates the participant. Balance sets the level, history sets the place — and the representation is being designed for Bitcoin."
            />
            <ol className="mt-10 grid md:grid-cols-3 gap-px bg-white/8 border border-white/8">
              {WALLET_STEPS.map((s) => (
                <li key={s.n} className="bg-void p-6">
                  <div className="font-mono text-[11px] text-lava tabular-nums">{s.n}</div>
                  <div className="font-display font-bold text-lg text-snow mt-2">{s.title}</div>
                  <p className="text-[13px] text-mist mt-2 leading-relaxed">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── PROPERTY REGISTRATION — the four deeds ─────────────────────── */}
        <section id="tiers" className="border-t border-white/5 scroll-mt-16">
          <div className="max-w-6xl mx-auto px-6 md:px-10 py-20 md:py-28">
            <SectionHead
              eyebrow="FOUNDING ERA REGISTRATIONS"
              title="Choose how you enter the Founding Era."
              sub="These are not subscriptions — they are one-time founding property registrations. Your contribution funds construction and defines your participation level."
            />
            <div className="mt-10 grid md:grid-cols-2 xl:grid-cols-4 gap-4">
              {TIERS.map((t) => (
                <div
                  key={t.key}
                  className={`relative border p-6 flex flex-col ${t.featured ? "border-lava/50 bg-lava/[0.04]" : "border-white/10"}`}
                >
                  {t.featured && (
                    <span className="absolute -top-px right-4 font-mono text-[9px] tracking-[0.2em] text-void bg-lava px-2 py-0.5">
                      MINT LICENSE
                    </span>
                  )}
                  <div className="font-mono text-[10px] tracking-[0.25em] text-dusty">DEED OF REGISTRATION</div>
                  <div className="font-display font-bold text-xl mt-2" style={{ color: t.color }}>{t.name}</div>
                  <div className="font-mono text-sm text-snow mt-1 tabular-nums">
                    {t.threshold}{t.usd && <span className="text-dusty text-[11px]"> · {t.usd}</span>}
                  </div>
                  <ul className="mt-4 space-y-2 flex-1">
                    {t.perks.map((p) => (
                      <li key={p} className="text-[12.5px] text-mist leading-relaxed flex gap-2">
                        <span className="text-lava shrink-0">▸</span>{p}
                      </li>
                    ))}
                  </ul>
                  {t.note && (
                    <p className="mt-4 pt-3 border-t border-white/10 font-mono text-[10px] text-dusty leading-relaxed">
                      {t.note}
                    </p>
                  )}
                  <a
                    href="#build"
                    className={`mt-5 inline-flex justify-center items-center gap-2 px-4 py-2.5 font-mono text-[12px] font-bold transition-colors ${
                      t.featured
                        ? "text-void bg-lava hover:bg-lava-light"
                        : "text-snow border border-white/20 hover:border-white/45"
                    }`}
                  >
                    {t.cta}
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── BITCOIN & ORDINALS — precise language ──────────────────────── */}
        <section className="border-t border-white/5">
          <div className="max-w-6xl mx-auto px-6 md:px-10 py-20 md:py-28">
            <SectionHead
              eyebrow="BITCOIN & ORDINALS"
              title="Your property can live on Bitcoin."
              sub="Wallet → property → lunar coordinates → Ordinal representation → Bitcoin L1. We separate precisely what is live today from what is planned."
            />
            <div className="mt-10 grid md:grid-cols-2 gap-4">
              <div className="border border-white/10 p-6">
                <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.25em] text-lava">
                  <ShieldCheck className="w-3.5 h-3.5" /> LIVE TODAY
                </div>
                <ul className="mt-4 space-y-2.5 text-[13px] text-mist leading-relaxed">
                  <li>Wallet-based participation — your address is your identity</li>
                  <li>Contribution registration on the live construction fund</li>
                  <li>District &amp; lot lookup derived from real on-chain history</li>
                  <li>{LOT_SEGMENTATION.total.toLocaleString()} lots demarcated across BTC, SOL and STX holders</li>
                </ul>
              </div>
              <div className="border border-white/10 p-6">
                <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.25em] text-amber">
                  <Bitcoin className="w-3.5 h-3.5" /> PLANNED — GRAND OPENING
                </div>
                <ul className="mt-4 space-y-2.5 text-[13px] text-mist leading-relaxed">
                  <li>Properties are being designed for representation through Bitcoin Ordinals</li>
                  <li>Licensed wallets mint their building — paying only BTC network fees</li>
                  <li>Bitcoin L1 records for minted properties</li>
                  <li>{FEATURES.inscriptionsLive ? "Inscriptions are live" : "Inscription support is planned, not live yet"}</li>
                </ul>
              </div>
            </div>
            <p className="mt-6 font-mono text-[10px] text-dusty leading-relaxed max-w-2xl">
              You always control your own wallet. Bitcoin network fees and confirmation times depend on network
              conditions. No seed phrase is ever requested — by anyone, ever.
            </p>
          </div>
        </section>

        {/* ── REAL LUNAR TERRAIN ─────────────────────────────────────────── */}
        <section className="border-t border-white/5">
          <div className="max-w-6xl mx-auto px-6 md:px-10 py-20 md:py-28">
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div>
                <SectionHead
                  eyebrow="REAL LUNAR TERRAIN"
                  title="A real place on the Moon."
                  sub="DogCity is not built over a generic backdrop. The city uses mapped elevation data, so roads, lots and landmarks respond to real terrain."
                />
                <dl className="mt-8 grid grid-cols-2 gap-px bg-white/8 border border-white/8 font-mono">
                  {[
                    ["SITE", LUNAR_SITE.name],
                    ["COORDINATES", `${LUNAR_SITE.latDeg}°N · ${LUNAR_SITE.lonDeg}°E`],
                    ["ELEVATION DATA", LUNAR_SITE.demSource],
                    ["VERTICAL SCALE", `${LUNAR_SITE.verticalExaggeration} exaggeration`],
                  ].map(([k, v]) => (
                    <div key={k} className="bg-void p-4">
                      <dt className="text-[9px] tracking-[0.25em] text-dusty">{k}</dt>
                      <dd className="text-[12px] text-snow mt-1">{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 font-mono text-[10px] text-dusty">{LUNAR_SITE.creditLine}</p>
              </div>
              <div className="relative aspect-[16/10] border border-white/10">
                <Image src={PHASES[0].image} alt={PHASES[0].alt} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
                <div className="absolute bottom-3 left-3 font-mono text-[9px] tracking-[0.2em] text-snow/70 bg-void/60 px-2 py-1">
                  <MapPin className="w-3 h-3 inline mr-1 text-lava" />
                  MARE TRANQUILLITATIS · SURVEYED SITE
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── MASTERPLAN — one city, three chains ────────────────────────── */}
        <section className="border-t border-white/5">
          <div className="max-w-6xl mx-auto px-6 md:px-10 py-20 md:py-28">
            <SectionHead
              eyebrow="THE MASTERPLAN"
              title="The city follows the terrain."
              sub="Eight organic districts radiate from the Central Event Plaza. Solana and Stacks holders build in satellite districts of the same city — one map, three chains."
            />
            <div className="relative mt-10 aspect-[16/9] border border-white/10">
              <Image src="/landing/hero.webp" alt="Aerial masterplan view of DogCity at night: glowing districts around the central plaza" fill sizes="100vw" className="object-cover" />
            </div>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-px bg-white/8 border border-white/8 font-mono">
              {[
                ["TOTAL LOTS", LOT_SEGMENTATION.total],
                ["BITCOIN DISTRICTS", LOT_SEGMENTATION.btc],
                ["SOLANA DISTRICT", LOT_SEGMENTATION.sol],
                ["STACKS DISTRICT", LOT_SEGMENTATION.stx],
              ].map(([k, v]) => (
                <div key={k as string} className="bg-void p-4">
                  <div className="text-[9px] tracking-[0.25em] text-dusty">{k}</div>
                  <div className="font-display font-bold text-xl text-snow mt-1 tabular-nums">
                    {(v as number).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 font-mono text-[10px] text-dusty">
              One demarcated lot per eligible holder, segmented by chain at survey time.
            </p>
          </div>
        </section>

        {/* ── RUNESTONE NATURAL PARK ─────────────────────────────────────── */}
        <section className="border-t border-white/5">
          <div className="max-w-6xl mx-auto px-6 md:px-10 py-20 md:py-28">
            <div className="max-w-2xl mx-auto text-center">
              <div className="mx-auto w-10 h-16 relative mb-8" aria-hidden>
                <div className="absolute inset-x-2 bottom-0 top-2 bg-[#101014] border border-white/15 -skew-x-3" />
                <Sparkles className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-4 text-snow/70" />
              </div>
              <div className="font-mono text-[11px] tracking-[0.3em] text-lava">RUNESTONE NATURAL PARK</div>
              <h2 className="font-display font-bold text-3xl md:text-4xl text-snow mt-3">Beyond the skyline.</h2>
              <p className="text-sm text-mist mt-4 leading-relaxed">
                Far northeast of the city, the black Runestone monolith stands half-embedded in preserved
                terrain — a natural and cultural landmark connected to DogCity by a single scenic road,
                and protected from dense development. Forever outside the urban core.
              </p>
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ──────────────────────────────────────────────────── */}
        <section className="border-t border-white/5">
          <div className="max-w-6xl mx-auto px-6 md:px-10 py-24 md:py-32 text-center">
            <h2 className="font-display font-bold text-4xl md:text-5xl text-snow leading-tight">
              The city is already on the map.
            </h2>
            <p className="text-sm text-mist mt-4 max-w-xl mx-auto leading-relaxed">
              The terrain is real. The first properties are registered. The Central Event Plaza is planned.
              The next foundation can begin with you.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <a href="#build" className="inline-flex items-center gap-2 px-7 py-3.5 font-mono text-sm font-bold text-void bg-lava hover:bg-lava-light transition-colors">
                Build DogCity <ArrowRight className="w-4 h-4" />
              </a>
              <a href="#deed" className="inline-flex items-center gap-2 px-7 py-3.5 font-mono text-sm text-snow border border-white/20 hover:border-white/45 transition-colors">
                Find Your Lot
              </a>
            </div>
            <div className="mt-8 font-mono text-[11px] text-dusty">
              Built by the DOG community. Connected to Bitcoin.
            </div>
          </div>
        </section>

        {/* persistent Build CTA */}
        <a
          href="#build"
          aria-hidden={!showCta}
          className={`fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 px-5 py-3 font-mono text-[12px] font-bold text-void bg-lava hover:bg-lava-light shadow-[0_0_30px_rgba(245,110,15,0.35)] transition-all duration-500 ${
            showCta ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"
          }`}
        >
          Build DogCity
        </a>
      </div>
    </Layout>
  )
}
