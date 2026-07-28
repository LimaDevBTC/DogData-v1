"use client"

// ═══════════════════════════════════════════════════════════════════════════
// HOW IT WORKS (#how) — wallet to lunar property, as a construction drawing.
//
// CONTENT BUG THIS FIXES: WALLET_STEPS has SIX steps; the markup this replaces
// rendered them in a `md:grid-cols-3` grid, so the page silently claimed a
// three-step process. All six now read as one sequence.
//
// THE MECHANISM — one line, drawn by the scroll, that changes character.
// A single spine runs down the left gutter through all six steps. Five segments
// are solid lava; the sixth is DASHED AMBER and its node is a hollow square that
// never fills. A dashed line is the universal drafting convention for *proposed,
// not built* — so `FEATURES.inscriptionsLive === false` is stated in the language
// of an engineering drawing rather than a sentence of legalese. That distinction
// is legally load-bearing, so it is semantic, not decorative: it survives
// reduced motion fully intact.
//
// WHY PER-ROW SEGMENTS AND NOT ONE SVG PATH.
// A single <path> would have to guess where each row's node falls, and the rows
// are typographic — their heights change with the viewport and with font swap.
// Each row therefore owns its own segment and node, so the line is registered to
// the content by construction at any width. The segments still animate from ONE
// shared progress value, so it reads as one continuous stroke, not six.
//
// SCROLL SOURCE. Not `useScroll({ target })` — it has frozen silently on this
// page (see the note in ../motion.tsx). One rAF-coalesced listener, the same
// maths the hero's scrubber uses, torn down on unmount. Under reduced motion a
// completely separate component renders, so no listener is ever registered.
//
// Every `title` and `text` string is verbatim from dogcity-data.ts; the eyebrow,
// headline, sub, `id` and `scroll-mt-16` are verbatim from the markup replaced.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react"
import { motion, useReducedMotion, type MotionValue, useMotionValue, useTransform } from "framer-motion"
import {
  DrawRule, EASE, HAIR_SOFT, Reveal, Scramble, SplitLine,
} from "../motion"
import { FEATURES, WALLET_STEPS } from "../dogcity-data"

// ── the derivation ledger ──────────────────────────────────────────────────
// One mono micro-line per step making the machine legible at a glance. These
// are literal reductions of the WALLET_STEPS prose above them — nothing here
// claims anything the source strings do not already say.
const LEDGER = [
  { from: "ADDRESS", to: "IDENTITY" },
  { from: "BALANCE", to: "REGISTRATION LEVEL" },
  { from: "OLDEST UTXO AGE", to: "DISTANCE FROM CORE" },
  { from: "DISTRICT", to: "LOT" },
  { from: "LOT", to: "SELENOGRAPHIC COORDINATES" },
  { from: "PROPERTY", to: "ORDINAL ON BITCOIN L1" },
]

// The last step is the only planned one. Driven by the feature flag rather than
// hardcoded, so it flips itself at the Grand Opening.
const PLANNED_INDEX = FEATURES.inscriptionsLive ? -1 : WALLET_STEPS.length - 1

const LAVA = "#F56E0F"
const AMBER = "#FFAD42"

// ═══ shared scroll progress ════════════════════════════════════════════════
// 0 when the sequence's top reaches 75% of the viewport, 1 when its bottom
// passes 40% — the band in which the reader is actually travelling through it.
function useSequenceProgress(ref: React.RefObject<HTMLElement>): MotionValue<number> {
  const p = useMotionValue(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0

    const measure = () => {
      raf = 0
      const vh = window.innerHeight || 1
      const r = el.getBoundingClientRect()
      const start = vh * 0.75          // progress begins when the top crosses this
      const end = vh * 0.4             // progress completes when the bottom crosses this
      const travelled = start - r.top
      const total = r.height + (start - end)
      p.set(Math.max(0, Math.min(1, total > 0 ? travelled / total : 0)))
    }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(measure) }

    measure()
    window.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule)
    return () => {
      window.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", schedule)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [ref, p])

  return p
}

// ═══ the node — a survey station on the spine ══════════════════════════════
function Node({ planned, lit }: { planned: boolean; lit?: MotionValue<number> }) {
  const style = planned
    ? { border: `1px solid ${AMBER}`, background: "transparent" }
    : { background: LAVA }
  const box = <span className="block h-[9px] w-[9px]" style={style} />
  if (!lit) return <span aria-hidden className="block">{box}</span>
  return <motion.span aria-hidden className="block" style={{ opacity: lit }}>{box}</motion.span>
}

// ═══ step 03's inline diagram — the conceptual heart of the project ════════
// "older coins live closer to the core" is the single most important sentence
// on this page and it previously got 22 words in 13px grey. One row, so it
// reads as emphasis rather than clutter.
function AgeRail() {
  return (
    <div aria-hidden className="mt-3 max-w-sm select-none">
      <div className="relative h-5">
        <span
          className="absolute inset-x-0 top-1/2 h-px"
          style={{
            backgroundImage:
              `repeating-linear-gradient(90deg, rgba(240,240,242,0.22) 0 1px, transparent 1px 34px),` +
              `linear-gradient(90deg, ${LAVA} 0%, rgba(245,110,15,0.15) 100%)`,
          }}
        />
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-[9px] w-[9px]" style={{ background: LAVA }} />
        <span
          className="absolute right-0 top-1/2 -translate-y-1/2 h-[7px] w-[7px]"
          style={{ border: "1px solid rgba(240,240,242,0.35)" }}
        />
      </div>
      <div className="flex justify-between font-mono text-[9px] tracking-[0.2em] text-dusty mt-1">
        <span className="text-lava">CORE</span>
        <span>OLDER COINS ← → NEWER</span>
        <span>RIM</span>
      </div>
    </div>
  )
}

// ═══ one step ══════════════════════════════════════════════════════════════
function Step({
  index, progress,
}: {
  index: number
  progress?: MotionValue<number>
}) {
  const s = WALLET_STEPS[index]
  const led = LEDGER[index]
  const planned = index === PLANNED_INDEX
  const accent = planned ? AMBER : LAVA
  const last = index === WALLET_STEPS.length - 1

  // Both derived from the SAME progress value — no extra listeners.
  // `settled` is always constructed (hooks cannot be conditional); it is the
  // source when there is no scroll progress, and it reads as fully drawn.
  const settled = useMotionValue(1)
  const src = progress ?? settled
  const span = 1 / WALLET_STEPS.length
  const fill = useTransform(src, [index * span, (index + 1) * span], [0, 1], { clamp: true })
  const lit = useTransform(src, [index * span - 0.02, index * span + 0.02], [0.25, 1], { clamp: true })

  return (
    <li className="relative grid grid-cols-[28px_1fr] md:grid-cols-[44px_1fr] gap-x-4 md:gap-x-6 pb-10 last:pb-0">
      {/* The connector hangs off the <li>, NOT off the grid cell: a grid item's
          box stops at the content edge, so a segment anchored there would end
          ~40px short of the next node and the spine would read as dashes. The
          <li> box includes its own pb-10, so the line lands on the next node. */}
      {!last && (
        <div className="absolute top-[19px] bottom-0 left-[14px] md:left-[22px] -translate-x-1/2 w-px overflow-hidden">
          {/* the segment: solid lava, or dashed amber for the planned leg */}
          {progress ? (
            <motion.span
              className="block w-px h-full origin-top"
              style={{
                scaleY: fill,
                backgroundImage:
                  index + 1 === PLANNED_INDEX
                    ? `repeating-linear-gradient(180deg, ${AMBER} 0 4px, transparent 4px 8px)`
                    : `linear-gradient(180deg, ${LAVA}, ${LAVA})`,
              }}
            />
          ) : (
            <span
              className="block w-px h-full"
              style={{
                backgroundImage:
                  index + 1 === PLANNED_INDEX
                    ? `repeating-linear-gradient(180deg, ${AMBER} 0 4px, transparent 4px 8px)`
                    : `linear-gradient(180deg, ${LAVA}, ${LAVA})`,
              }}
            />
          )}
        </div>
      )}

      {/* ── the spine gutter: the node only ── */}
      <div className="relative">
        <div className="absolute left-1/2 -translate-x-1/2 top-[6px]">
          <Node planned={planned} lit={progress ? lit : undefined} />
        </div>
      </div>

      {/* ── the row ── */}
      <Reveal delay={index * 0.07} y={14}>
        <div className="relative">
          {/* the promoted numeral — it labels the step, so it outranks the body */}
          <span
            aria-hidden
            className="font-display font-bold text-3xl md:text-4xl leading-none tabular-nums"
            style={{ color: planned ? "rgba(255,173,66,0.22)" : "rgba(245,110,15,0.22)" }}
          >
            {s.n}
          </span>

          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mt-1">
            <h3 className="font-display font-bold text-lg text-snow">{s.title}</h3>
            {planned && (
              <span
                className="font-mono text-[9px] tracking-[0.25em] px-1.5 py-0.5"
                style={{ color: AMBER, border: `1px solid rgba(255,173,66,0.4)` }}
              >
                PLANNED
              </span>
            )}
          </div>

          <p className="text-[13px] text-mist mt-2 leading-relaxed max-w-xl">{s.text}</p>

          {index === 2 && <AgeRail />}

          <div className="font-mono text-[10px] tracking-[0.18em] text-dusty mt-3">
            <span style={{ color: accent }}>{led.from}</span>
            <span className="mx-2">→</span>
            <span>{led.to}</span>
          </div>
        </div>
      </Reveal>
    </li>
  )
}

// ═══ the sequence, in two flavours ═════════════════════════════════════════
// Split into two components so the reduced-motion path never instantiates the
// scroll listener at all — hooks cannot be called conditionally inside one.
function SequenceAnimated() {
  const ref = useRef<HTMLOListElement>(null)
  const progress = useSequenceProgress(ref)
  return (
    <ol ref={ref} className="mt-12">
      {WALLET_STEPS.map((s, i) => <Step key={s.n} index={i} progress={progress} />)}
    </ol>
  )
}

function SequenceStatic() {
  return (
    <ol className="mt-12">
      {WALLET_STEPS.map((s, i) => <Step key={s.n} index={i} />)}
    </ol>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
export default function HowItWorks() {
  const reduce = useReducedMotion()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <section id="how" className={`relative border-t ${HAIR_SOFT} scroll-mt-16`}>
      {/* beat 0 — the seam is struck */}
      <DrawRule className="absolute -top-px left-0 w-24" duration={1.0} />

      <div className="max-w-6xl mx-auto px-6 md:px-10 py-20 md:py-28">
        {/* ── section head — the four-beat cadence, identical across #build/#deed/#how */}
        <div className="max-w-2xl">
          <Scramble
            text="HOW IT WORKS"
            speed={34}
            className="block font-mono text-[11px] tracking-[0.3em] text-lava"
          />
          <h2 className="font-display font-bold text-3xl md:text-4xl text-snow mt-3 leading-tight">
            <SplitLine text="From wallet to lunar property." delay={0.12} step={0.055} />
          </h2>
          <Reveal delay={0.3} y={14}>
            <p className="text-sm text-mist mt-3 leading-relaxed">
              The wallet authenticates the participant. Balance sets the level, history sets the
              place — and the representation is being designed for Bitcoin.
            </p>
          </Reveal>
        </div>

        {/* Static until mounted so SSR and the reduced-motion tree agree, then the
            animated sequence takes over. Both render identical boxes, so the
            swap cannot change this section's height and disturb the hero's
            body-portal geometry. */}
        {mounted && !reduce ? <SequenceAnimated /> : <SequenceStatic />}
      </div>
    </section>
  )
}
