"use client"

// ═══════════════════════════════════════════════════════════════════════════
// SATOSHI PLAZA · OPEN NOW — the folio's news sheet.
//
// WHY IT SITS HERE, right under the hero.
// The hero spends 500vh building the city out of nothing. Since 2026-08-18 the
// centre of that city is not a promise: Satoshi Plaza is open at /city, on the
// real Mare Tranquillitatis terrain, and the DOG mempool is alive above it
// (praca-central.md). The page has to say so before it asks for anything, so
// this sheet comes first: the plates of the live plaza, the mission board
// reading the same feed the plaza reads, and the door.
//
// WHAT IS LIVE.
// The board polls /api/mempool/dog every 20 s: how many DOG transactions are
// in orbit (pending), how much DOG they carry, the last landing (block, ships,
// amount, minutes ago) and the whole mempool. Every number is what our node
// sees now; nothing is invented and nothing is cached beyond a few seconds.
// If the feed goes quiet for two minutes the label says SYNCING, not LIVE.
//
// THE PLATES are stills of the live scene itself (public/landing/plaza/*),
// captured from /city with the HUD off (?plate=1), not renders: what you see
// on the sheet is what opens when you press the button.
//
// Tailwind note: this project's opacity scale is the stock one (multiples of 5);
// odd opacities do NOT compile and fall through to preflight's #D1D5DB. Hence
// HAIR / HAIR_SOFT / GRIDLINE from ../motion.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react"
import Image from "next/image"
import { motion, useReducedMotion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import {
  EASE, EASE_CSS, HAIR, HAIR_SOFT, GRIDLINE,
  Counter, Reveal, Stagger, StaggerItem, SplitLine, Scramble, DrawRule,
  useMagnetic, useOnce,
} from "../motion"
import { formatDog } from "../dogcity-data"

// ── the registration corner — team SKYLINE's shared mark ───────────────────
// Duplicated per file on purpose: motion.tsx is frozen.
function Corners({ accent, delay = 0 }: { accent?: string; delay?: number }) {
  const reduce = useReducedMotion()
  const { ref, inView } = useOnce("-5% 0px")
  const show = reduce || inView
  const C = [
    { box: "top-0 left-0", h: "top-0 left-0", v: "top-0 left-0", ox: "left", oy: "top" },
    { box: "top-0 right-0", h: "top-0 right-0", v: "top-0 right-0", ox: "right", oy: "top" },
    { box: "bottom-0 right-0", h: "bottom-0 right-0", v: "bottom-0 right-0", ox: "right", oy: "bottom" },
    { box: "bottom-0 left-0", h: "bottom-0 left-0", v: "bottom-0 left-0", ox: "left", oy: "bottom" },
  ]
  const paint = (i: number) => (i === 0 && accent ? accent : "rgba(240,240,242,0.22)")
  return (
    <span ref={ref as never} aria-hidden className="absolute inset-0 pointer-events-none z-20">
      {C.map((c, i) => (
        <span key={c.box} className={`absolute ${c.box}`} style={{ width: 10, height: 10 }}>
          <motion.span
            className={`absolute ${c.h} h-px w-full`}
            style={{ background: paint(i), transformOrigin: c.ox }}
            initial={reduce ? false : { scaleX: 0 }}
            animate={show ? { scaleX: 1 } : undefined}
            transition={{ duration: 0.35, delay: delay + i * 0.04, ease: EASE }}
          />
          <motion.span
            className={`absolute ${c.v} w-px h-full`}
            style={{ background: paint(i), transformOrigin: c.oy }}
            initial={reduce ? false : { scaleY: 0 }}
            animate={show ? { scaleY: 1 } : undefined}
            transition={{ duration: 0.35, delay: delay + i * 0.04, ease: EASE }}
          />
        </span>
      ))}
    </span>
  )
}

// ── the feed ───────────────────────────────────────────────────────────────
interface Snapshot {
  updated_at: string
  tx_count: number
  fee_fast: number | null
  fee_slow: number | null
  tip_height: number | null
  dog_pending: number
  dog_pending_amount: number
  last_dog_block: number | null
  last_dog_block_time: string | null
  last_dog_block_count: number | null
  last_dog_block_amount: number | null
}
interface Feed { snapshot: Snapshot | null; stale_seconds: number | null; landed?: unknown[] }

const POLL_MS = 20_000
const STALE_S = 120

function useMempoolFeed(): { feed: Feed | null; now: number } {
  const [feed, setFeed] = useState<Feed | null>(null)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout> | null = null
    const tick = async () => {
      try {
        const r = await fetch("/api/mempool/dog", { cache: "no-store" })
        if (r.ok) {
          const j = (await r.json()) as Feed
          if (alive) setFeed(j)
        }
      } catch {
        // the board keeps the last reading; the label falls to SYNCING by age
      }
      if (alive) {
        setNow(Date.now())
        timer = setTimeout(tick, POLL_MS)
      }
    }
    void tick()
    return () => {
      alive = false
      if (timer) clearTimeout(timer)
    }
  }, [])
  return { feed, now }
}

function minutesAgo(iso: string | null | undefined, now: number): string {
  if (!iso) return "—"
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000))
  if (m < 1) return "just now"
  if (m === 1) return "1 min ago"
  if (m < 90) return `${m} min ago`
  const h = Math.round(m / 60)
  return `${h} h ago`
}

// ── the plates: stills of the live scene ───────────────────────────────────
const PLATES = [
  {
    src: "/landing/plaza/plaza-home.webp",
    alt: "Satoshi Plaza on the Moon: the Needle at the centre of the deck, Kray Tower and BitFlow HQ on the ring, the OrdCards Chalet to the south, the palace garden, and DOG ships in orbit above",
    label: "SATOSHI PLAZA · LIVE",
  },
  {
    src: "/landing/plaza/plaza-dsc.webp",
    alt: "The Dog Social Club gallery beside Kray Tower: the whole collection hung on a curved black wall under the club shield",
    label: "DOG SOCIAL CLUB · ALL OF IT",
  },
  {
    src: "/landing/plaza/plaza-leonidas.webp",
    alt: "The Leonidas statue: a yellow skull under a black hood, cape falling to the plinth, the bitcoin mark on his chest",
    label: "LEONIDAS · FOUNDER OF DOG",
  },
  {
    src: "/landing/plaza/plaza-chalet.webp",
    alt: "The OrdCards Chalet: two colossal official OrdCards leaning together in an A over a glass podium, with the Needle and Kray Tower behind",
    label: "THE ORDCARDS CHALET",
  },
] as const

const PRIMARY_LABEL = "Enter Satoshi Plaza"

export default function Section() {
  const { feed, now } = useMempoolFeed()
  const s = feed?.snapshot ?? null
  const stale = !s || (feed?.stale_seconds ?? Infinity) > STALE_S
  const primary = useMagnetic<HTMLAnchorElement>()

  return (
    <section id="plaza" className={`border-t ${HAIR_SOFT}`}>
      <div className="max-w-6xl mx-auto px-6 md:px-10 py-16 md:py-24">

        <div className="max-w-2xl">
          <div className="flex items-center gap-3">
            <Scramble text="SATOSHI PLAZA · OPEN NOW" className="font-mono text-[11px] tracking-[0.3em] text-lava" />
            <span className="inline-flex items-center gap-1.5 font-mono text-[9px] tracking-[0.25em] text-dusty">
              <span
                aria-hidden
                className={`inline-block w-1.5 h-1.5 rounded-full ${stale ? "bg-dusty" : "bg-emerald-400 animate-pulse"}`}
              />
              {stale ? "SYNCING" : "LIVE"}
            </span>
          </div>
          <DrawRule className="mt-3 w-14" delay={0.06} duration={0.9} />
          <h2 className="font-display font-bold text-3xl md:text-4xl text-snow mt-4 leading-tight">
            <SplitLine text="The plaza is open. The mempool is in orbit." delay={0.12} step={0.055} className="pb-[0.12em]" />
          </h2>
          <Reveal delay={0.34} y={14}>
            <p className="text-sm text-mist mt-3 leading-relaxed">
              You can walk into DogCity today. Satoshi Plaza stands on the real Mare Tranquillitatis
              terrain: the Needle at its centre, Kray Tower and BitFlow HQ on the ring, the OrdCards
              Chalet to the south, a palace garden between them, the spaceport down the axis, and
              Runestone Ordinal Park five kilometres to the north-east.
            </p>
          </Reveal>
          <Reveal delay={0.44} y={14}>
            <p className="text-sm text-mist mt-3 leading-relaxed">
              Above it, the DOG mempool is alive. Every DOG transaction our node sees becomes a ship
              in orbit: the fee sets the altitude, the amount sets the size, and the block is the
              landing. Paste a transaction id in the plaza and follow your DOG down to the apron.
            </p>
          </Reveal>
        </div>

        <div className="mt-10 md:mt-12 grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6 lg:gap-8 items-start">

          {/* ── the plates ─────────────────────────────────────────────────── */}
          <div>
            <Reveal delay={0.2} y={20}>
              <a href="/city" className={`group relative block aspect-[16/10] sm:aspect-[16/9] border ${HAIR} overflow-hidden bg-void`}>
                <Image
                  src={PLATES[0].src}
                  alt={PLATES[0].alt}
                  fill
                  sizes="(min-width: 1024px) 800px, 100vw"
                  className="object-cover transition-transform duration-[1400ms] group-hover:scale-[1.02]"
                  style={{ transitionTimingFunction: EASE_CSS }}
                  priority={false}
                />
                <Corners accent="rgba(245,110,15,0.85)" delay={0.1} />
                <span className="absolute left-3 bottom-3 border border-white/[0.12] bg-void/75 backdrop-blur-sm px-2.5 py-1.5 font-mono text-[10px] tracking-[0.18em] text-snow">
                  {PLATES[0].label}
                </span>
              </a>
            </Reveal>
            <Stagger step={0.08} delay={0.4} className="mt-3 grid grid-cols-3 gap-3">
              {PLATES.slice(1).map((p) => (
                <StaggerItem key={p.src}>
                  <div className={`relative aspect-[16/10] border ${HAIR} overflow-hidden bg-void`}>
                    <Image src={p.src} alt={p.alt} fill sizes="(min-width: 1024px) 260px, 33vw" className="object-cover" />
                    <span className="absolute left-2 bottom-2 hidden sm:block font-mono text-[9px] tracking-[0.18em] text-snow/80 [text-shadow:0_1px_4px_rgba(0,0,0,0.9)]">
                      {p.label}
                    </span>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          </div>

          {/* ── the mission board, and the door ─────────────────────────────── */}
          <div>
            <div className={`border ${HAIR} font-mono`}>
              <div className={`flex items-center justify-between px-4 py-2 border-b ${HAIR} text-[9px] tracking-[0.25em] text-dusty`}>
                <span>MISSION BOARD</span>
                <span>{s?.tip_height ? `BLOCK ${s.tip_height.toLocaleString()}` : "—"}</span>
              </div>
              <Stagger as="dl" step={0.09} delay={0.3} className={`grid grid-cols-2 lg:grid-cols-1 gap-px ${GRIDLINE}`}>
                <StaggerItem className="bg-void p-4">
                  <dt className="text-[9px] tracking-[0.25em] text-dusty">IN ORBIT</dt>
                  <dd className="text-[12px] text-snow mt-1 leading-snug">
                    {s && s.dog_pending === 0 ? (
                      <>
                        clear sky
                        <span className="block text-dusty">waiting for the next DOG transaction</span>
                      </>
                    ) : (
                      <>
                        <Counter value={s ? s.dog_pending : null} className="text-lava" /> {s?.dog_pending === 1 ? "ship" : "ships"} ·{" "}
                        <Counter value={s ? s.dog_pending_amount : null} format={formatDog} className="text-lava" /> DOG
                      </>
                    )}
                  </dd>
                </StaggerItem>
                <StaggerItem className="bg-void p-4">
                  <dt className="text-[9px] tracking-[0.25em] text-dusty">LAST LANDING</dt>
                  <dd className="text-[12px] text-snow mt-1 leading-snug">
                    {s?.last_dog_block ? (
                      <>
                        block {s.last_dog_block.toLocaleString()} · {s.last_dog_block_count ?? 0} {(s.last_dog_block_count ?? 0) === 1 ? "ship" : "ships"}
                        <span className="block text-dusty">
                          {formatDog(s.last_dog_block_amount ?? 0)} DOG · {minutesAgo(s.last_dog_block_time, now)}
                        </span>
                      </>
                    ) : "—"}
                  </dd>
                </StaggerItem>
                <StaggerItem className="bg-void p-4">
                  <dt className="text-[9px] tracking-[0.25em] text-dusty">FUEL · SAT/VB</dt>
                  <dd className="text-[12px] text-snow mt-1 leading-snug">
                    {s?.fee_fast != null ? `${s.fee_fast} fast · ${s.fee_slow ?? "—"} slow` : "—"}
                  </dd>
                </StaggerItem>
                <StaggerItem className="bg-void p-4">
                  <dt className="text-[9px] tracking-[0.25em] text-dusty">WHOLE MEMPOOL</dt>
                  <dd className="text-[12px] text-snow mt-1 leading-snug">
                    <Counter value={s ? s.tx_count : null} /> txs waiting
                  </dd>
                </StaggerItem>
              </Stagger>
            </div>

            <Reveal delay={0.7} y={12} className="mt-5">
              <a
                href="/city"
                ref={primary.ref}
                onPointerMove={primary.onPointerMove}
                onPointerLeave={primary.onPointerLeave}
                className="inline-flex w-full sm:w-auto items-center justify-center gap-2 px-6 py-3.5 font-mono text-sm font-bold text-void bg-lava hover:bg-lava-light"
                style={{ ...primary.style, transition: `transform 0.45s ${EASE_CSS}, background-color 0.25s ease` }}
              >
                {PRIMARY_LABEL}
                <ArrowRight aria-hidden className="w-4 h-4" />
              </a>
            </Reveal>

            <Reveal delay={0.82} y={10} className="mt-4">
              <a href="/city?view=park" className="font-mono text-[10px] tracking-[0.22em] text-lava hover:text-lava-light transition-colors">
                FLY TO THE PARK ↗
              </a>
            </Reveal>

            <Reveal delay={0.95} y={10} className="mt-5">
              <p className="font-mono text-[10px] text-dusty leading-relaxed">
                Preview: the plaza, its ring and garden, the spaceport and the park are open.
                Districts open by phase as the city is built. Runs in the browser, phone included.
              </p>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  )
}
