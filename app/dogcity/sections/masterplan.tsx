"use client"

// ═══════════════════════════════════════════════════════════════════════════
// THE MASTERPLAN — one city, three chains.
//
// The audit called this the weakest section on the page: a map story told with
// one static reused image and four numbers, sitting directly under another
// 16:9 plate with identical framing. It had no interaction at all.
//
// THE MECHANISM — you survey the plate with a torch.
// The aerial plate sits under a near-black veil at ~10% visibility. A soft
// radial hole in that veil follows the pointer, so the city is not shown to
// you — you have to go and find it. On a page whose hero is 500vh of "your
// scroll builds the city", the map section earning its reveal from the
// visitor's own hand is the honest continuation of that idea.
//
// THE READOUT IS HONEST BY CONSTRUCTION.
// It would be easy — and a lie — to print selenographic offsets or metre
// distances under the cursor: we do not know this render's true scale. So the
// grid the readout references is visibly OUR OWN: columns A–L, rows 01–08,
// drawn over the plate. `GRID F-04` is then true by construction, and the page
// keeps its surveyor's voice without inventing a measurement.
//
// THE SHARE BARS ARE COMPUTED, NOT TYPED.
// Under each chain count sits a hairline whose width is that chain's real
// share of LOT_SEGMENTATION.total. The STX bar being a barely-visible sliver
// is the memorable, honest fact of "one city, three chains" — and because it
// is derived, it cannot drift out of sync with the numbers above it.
//
// PERF / SAFETY
//   · ONE rAF, and it is pointer-gated: it starts on pointerenter, runs the
//     presence tween down on pointerleave, then cancels. An IntersectionObserver
//     hard-stops it if the plate is scrolled away mid-hover.
//   · The mask is written straight to element.style — never through React state.
//   · Coarse pointers (no cursor) get no torch and no crosshair: the veil
//     irises open once, from the centre, on first entry.
//   · Reduced motion renders the plate at full visibility, grid static,
//     counters and share bars at their final values.
//   · The plate is a reserved aspect-[16/9] box that never changes size after
//     layout — the hero's body-portal geometry depends on that.
//
// Every string, number, id and the fine print are verbatim from the markup
// this replaces and from dogcity-data.ts.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { motion, useReducedMotion } from "framer-motion"
import {
  Counter, DrawRule, EASE, GRIDLINE, HAIR, HAIR_SOFT,
  Reveal, Scramble, SplitLine, Stagger, StaggerItem, useOnce,
} from "../motion"
import { LOT_SEGMENTATION } from "../dogcity-data"

// ── the section-head grammar — identical in every sheet of the folio ────────
function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="max-w-2xl">
      <Scramble text={eyebrow} className="font-mono text-[11px] tracking-[0.3em] text-lava" />
      <DrawRule className="mt-3 w-14" delay={0.06} duration={0.9} />
      <h2 className="font-display font-bold text-3xl md:text-4xl text-snow mt-4 leading-tight">
        <SplitLine text={title} delay={0.12} step={0.055} className="pb-[0.12em]" />
      </h2>
      {sub && (
        <Reveal delay={0.34} y={14}>
          <p className="text-sm text-mist mt-3 leading-relaxed">{sub}</p>
        </Reveal>
      )}
    </div>
  )
}

// ── the registration corner — team SKYLINE's shared mark ───────────────────
// Four L-ticks struck INSIDE a plate's hairline before its contents ink in.
// Duplicated per file on purpose: motion.tsx is frozen this pass.
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

// ── our own survey grid: the only thing the readout is allowed to reference ─
const COLS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"] as const
const ROWS = 8
const TORCH_R = 190          // radius of the hole in the veil, px
const FOLLOW = 14            // % of remaining distance closed per 60Hz frame

function SurveyGrid() {
  return (
    <span aria-hidden className="absolute inset-0 pointer-events-none z-10">
      {/* the ruled field */}
      <span
        className="absolute inset-0"
        style={{
          backgroundImage:
            `repeating-linear-gradient(90deg, rgba(240,240,242,0.06) 0 1px, transparent 1px ${100 / COLS.length}%),` +
            `repeating-linear-gradient(180deg, rgba(240,240,242,0.06) 0 1px, transparent 1px ${100 / ROWS}%)`,
        }}
      />
      {/* lettered ticks along the top */}
      <span className="absolute inset-x-0 top-0 flex">
        {COLS.map((c) => (
          <span
            key={c}
            className="flex-1 font-mono text-[8px] tracking-[0.2em] text-dusty pl-1 pt-1"
          >
            {c}
          </span>
        ))}
      </span>
      {/* numbered ticks down the left */}
      <span className="absolute inset-y-0 left-0 flex flex-col">
        {Array.from({ length: ROWS }, (_, i) => (
          <span
            key={i}
            className="flex-1 font-mono text-[8px] tracking-[0.2em] text-dusty pl-1 pt-0.5"
          >
            {String(i + 1).padStart(2, "0")}
          </span>
        ))}
      </span>
    </span>
  )
}

// ═══ the surveyed plate ════════════════════════════════════════════════════
function SurveyPlate() {
  const reduce = useReducedMotion()
  const frameRef = useRef<HTMLDivElement>(null)
  const veilRef = useRef<HTMLDivElement>(null)
  const crossXRef = useRef<HTMLSpanElement>(null)
  const crossYRef = useRef<HTMLSpanElement>(null)
  const readoutRef = useRef<HTMLSpanElement>(null)

  const [fine, setFine] = useState(false)
  const [irised, setIrised] = useState(false)

  // pointer target + eased position + presence, all in refs: never React state
  const target = useRef({ x: 0, y: 0 })
  const pos = useRef({ x: 0, y: 0 })
  const presence = useRef(0)
  const wanted = useRef(0)
  const raf = useRef(0)
  const lastT = useRef(0)

  useEffect(() => {
    setFine(window.matchMedia("(pointer: fine)").matches)
  }, [])

  const paint = useCallback(() => {
    const veil = veilRef.current
    const frame = frameRef.current
    if (!veil || !frame) return
    const r = TORCH_R * presence.current
    const mask = r < 1
      ? "linear-gradient(#000, #000)"      // fully veiled
      : `radial-gradient(circle ${r}px at ${pos.current.x}px ${pos.current.y}px, transparent 0px, transparent ${r * 0.55}px, #000 ${r}px)`
    veil.style.maskImage = mask
    veil.style.webkitMaskImage = mask

    if (crossXRef.current && crossYRef.current) {
      crossXRef.current.style.transform = `translateY(${pos.current.y}px)`
      crossYRef.current.style.transform = `translateX(${pos.current.x}px)`
      const o = String(Math.min(1, presence.current))
      crossXRef.current.style.opacity = o
      crossYRef.current.style.opacity = o
    }
    if (readoutRef.current) {
      const w = frame.clientWidth || 1
      const h = frame.clientHeight || 1
      const c = Math.min(COLS.length - 1, Math.max(0, Math.floor((pos.current.x / w) * COLS.length)))
      const rr = Math.min(ROWS, Math.max(1, Math.floor((pos.current.y / h) * ROWS) + 1))
      readoutRef.current.textContent = `GRID ${COLS[c]}-${String(rr).padStart(2, "0")}`
    }
  }, [])

  const tick = useCallback((t: number) => {
    const dt = lastT.current ? Math.min(0.1, (t - lastT.current) / 1000) : 1 / 60
    lastT.current = t
    // frame-rate-independent follow
    const f = 1 - Math.pow(1 - FOLLOW / 100, dt * 60)
    pos.current.x += (target.current.x - pos.current.x) * f
    pos.current.y += (target.current.y - pos.current.y) * f
    presence.current += (wanted.current - presence.current) * Math.min(1, dt * 4.5)
    paint()
    if (Math.abs(presence.current - wanted.current) > 0.002 || wanted.current > 0) {
      raf.current = requestAnimationFrame(tick)
    } else {
      presence.current = 0
      paint()
      raf.current = 0
      lastT.current = 0
    }
  }, [paint])

  const start = useCallback(() => {
    if (!raf.current) {
      lastT.current = 0
      raf.current = requestAnimationFrame(tick)
    }
  }, [tick])

  // Hard-stop the loop if the plate leaves the viewport mid-hover.
  //
  // Only on pointer devices. On a phone the veil is opened once, by the
  // one-shot iris below, and that tween never runs again (`irised`). Resetting
  // presence to 0 here would slam the veil shut the first time the plate
  // scrolled away and leave the aerial plate permanently 90% black on every
  // phone, for the rest of the session — the section's whole payload, gone.
  useEffect(() => {
    const el = frameRef.current
    if (!el || !fine) return
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) {
        wanted.current = 0
        if (raf.current) { cancelAnimationFrame(raf.current); raf.current = 0 }
        presence.current = 0
        paint()
      }
    })
    io.observe(el)
    return () => {
      io.disconnect()
      if (raf.current) cancelAnimationFrame(raf.current)
    }
  }, [paint, fine])

  // coarse pointer: the veil irises open once, from the centre, on first entry
  const { ref: gateRef, inView } = useOnce("-10% 0px")
  useEffect(() => {
    if (reduce || fine || !inView || irised) return
    const frame = frameRef.current
    if (!frame) return
    setIrised(true)
    const r = frame.getBoundingClientRect()
    target.current = { x: r.width / 2, y: r.height / 2 }
    pos.current = { ...target.current }
    // grow the hole past the diagonal so the whole plate ends up uncovered
    const full = Math.hypot(r.width, r.height)
    const t0 = performance.now()
    const run = (t: number) => {
      const k = Math.min(1, (t - t0) / 1600)
      const eased = 1 - Math.pow(1 - k, 3)
      presence.current = (eased * full) / TORCH_R
      paint()
      if (k < 1) raf.current = requestAnimationFrame(run)
      else raf.current = 0
    }
    raf.current = requestAnimationFrame(run)
  }, [reduce, fine, inView, irised, paint])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (reduce || !fine || e.pointerType !== "mouse") return
    const r = e.currentTarget.getBoundingClientRect()
    target.current = { x: e.clientX - r.left, y: e.clientY - r.top }
    start()
  }, [reduce, fine, start])

  const onPointerEnter = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (reduce || !fine || e.pointerType !== "mouse") return
    const r = e.currentTarget.getBoundingClientRect()
    pos.current = { x: e.clientX - r.left, y: e.clientY - r.top }
    target.current = { ...pos.current }
    wanted.current = 1
    start()
  }, [reduce, fine, start])

  const onPointerLeave = useCallback(() => {
    wanted.current = 0
    start()
  }, [start])

  // reduced motion: no veil at all, the plate simply reads
  const veilOn = !reduce

  return (
    <div ref={gateRef as never} className="relative mt-10">
      <div
        ref={frameRef}
        onPointerMove={onPointerMove}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        className={`relative aspect-[16/9] border ${HAIR} overflow-hidden`}
      >
        <Image
          src="/landing/hero.webp"
          alt="Aerial masterplan view of DogCity at night: glowing districts around the central plaza"
          fill
          sizes="100vw"
          className="object-cover"
        />

        {/* the veil the torch burns through */}
        {veilOn && (
          <div
            ref={veilRef}
            aria-hidden
            className="absolute inset-0 z-[5]"
            style={{
              background: "#0A0A0A",
              opacity: 0.9,
              maskImage: "linear-gradient(#000, #000)",
              WebkitMaskImage: "linear-gradient(#000, #000)",
            }}
          />
        )}

        <SurveyGrid />

        {/* the crosshair — pointer-only, never swallows a click */}
        {veilOn && fine && (
          <span aria-hidden className="absolute inset-0 pointer-events-none z-10">
            <span
              ref={crossXRef}
              className="absolute left-0 right-0 top-0 h-px opacity-0"
              style={{ background: "rgba(245,110,15,0.45)" }}
            />
            <span
              ref={crossYRef}
              className="absolute top-0 bottom-0 left-0 w-px opacity-0"
              style={{ background: "rgba(245,110,15,0.45)" }}
            />
          </span>
        )}

        <Corners delay={0.2} accent="#F56E0F" />

        {/* the readout plate */}
        <span className="absolute bottom-3 left-3 z-20 font-mono text-[9px] tracking-[0.2em] text-snow/70 bg-void/60 px-2 py-1 tabular-nums">
          {reduce || !fine ? "MASTERPLAN · SURVEYED PLATE" : <span ref={readoutRef}>GRID A-01</span>}
        </span>
      </div>

      {veilOn && fine && (
        <p className="mt-2 font-mono text-[9px] tracking-[0.2em] text-dusty">
          MOVE THE POINTER ACROSS THE PLATE TO SURVEY IT
        </p>
      )}
    </div>
  )
}

// ═══ the four counts, with computed share bars ═════════════════════════════
const CELLS = [
  { k: "TOTAL LOTS", v: LOT_SEGMENTATION.total, share: 1, color: "#F0F0F2" },
  { k: "BITCOIN DISTRICTS", v: LOT_SEGMENTATION.btc, share: LOT_SEGMENTATION.btc / LOT_SEGMENTATION.total, color: "#F56E0F" },
  { k: "SOLANA DISTRICT", v: LOT_SEGMENTATION.sol, share: LOT_SEGMENTATION.sol / LOT_SEGMENTATION.total, color: "#FB923C" },
  { k: "STACKS DISTRICT", v: LOT_SEGMENTATION.stx, share: LOT_SEGMENTATION.stx / LOT_SEGMENTATION.total, color: "#FFAD42" },
]

function ShareBar({ share, color, delay }: { share: number; color: string; delay: number }) {
  const reduce = useReducedMotion()
  const { ref, inView } = useOnce("-5% 0px")
  return (
    <span ref={ref as never} aria-hidden className="block mt-2 h-[2px] w-full bg-white/[0.06]">
      <motion.span
        className="block h-full origin-left"
        style={{ background: color, width: `${Math.max(share * 100, 0.35)}%` }}
        initial={reduce ? false : { scaleX: 0 }}
        animate={inView || reduce ? { scaleX: 1 } : undefined}
        transition={{ duration: 1.0, delay, ease: EASE }}
      />
    </span>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
export default function Masterplan() {
  return (
    <section className={`relative border-t ${HAIR_SOFT}`}>
      <DrawRule className="absolute -top-px left-0 w-24" duration={1.0} />

      <div className="max-w-6xl mx-auto px-6 md:px-10 py-20 md:py-28">
        <SectionHead
          eyebrow="THE MASTERPLAN"
          title="The city follows the terrain."
          sub="Eight organic districts radiate from the Central Event Plaza. Solana and Stacks holders build in satellite districts of the same city — one map, three chains."
        />

        <SurveyPlate />

        <Stagger
          className={`mt-4 grid grid-cols-2 md:grid-cols-4 gap-px ${GRIDLINE} border ${HAIR} font-mono`}
          step={0.075}
          delay={0.2}
        >
          {CELLS.map((c, i) => (
            <StaggerItem key={c.k} className="bg-void p-4">
              <div className="text-[9px] tracking-[0.25em] text-dusty">{c.k}</div>
              <div className="font-display font-bold text-xl text-snow mt-1 tabular-nums">
                <Counter value={c.v} />
              </div>
              <ShareBar share={c.share} color={c.color} delay={0.3 + i * 0.075} />
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal delay={0.4} y={10}>
          <p className="mt-3 font-mono text-[10px] text-dusty">
            One demarcated lot per eligible holder, segmented by chain at survey time.
          </p>
        </Reveal>
      </div>
    </section>
  )
}
