"use client"

// ═══════════════════════════════════════════════════════════════════════════
// DogCity landing — BITCOIN & ORDINALS. The disclosure sheet of the folio.
//
// ONE JOB: "these people are being straight with me." Everything here is a
// specification sheet, not marketing — the precision IS the design.
//
// THE HERO MOVE — the pipeline draws itself, and you can see where the promise
// stops. The chain buried in the sub-headline (wallet → property → lunar
// coordinates → Ordinal representation → Bitcoin L1) is drawn as a real rail
// above the ledger: five 5px square nodes on one hairline. Solid lava while the
// stage exists, dashed amber once it is only intended — so the visitor sees the
// precise point where fact becomes intention. That is the section's argument,
// drawn in one line.
//
// NON-OBVIOUS MECHANISMS
//  · THE FLAG IS THE DRAWING. Node state is never typed by hand: it is read
//    from FEATURES (plotLookupLive, inscriptionsLive). ORDINALS_LIVE is read
//    once and drives BOTH the last PLANNED ledger row's sentence AND the state
//    of the final two nodes, so the graphic and the copy can never disagree if
//    the flag flips at the Grand Opening. This distinction is legally
//    load-bearing.
//  · THE RAIL DRAWS WITH A CURTAIN, NOT A DASH OFFSET. Each segment is a
//    static 1px line (solid fill, or a repeating-gradient for the dashed half)
//    with a void-black curtain over it retracting on scaleX/scaleY. Pure
//    transform — the dashes never rubber-band, nothing re-measures, and the
//    hero's ResizeObserver on <body> is never touched. Timing uses the
//    fixed-total stagger: RAIL_TOTAL is fixed and per-segment duration/delay
//    are derived from the segment count, so the rail lands on one beat.
//  · TWO ORIENTATIONS, ONE COMPONENT. The rail is horizontal at md+ and
//    vertical below it (five wrapped labels in five columns is unreadable).
//    Both instances live in the DOM, so both are aria-hidden — the chain is
//    already stated verbatim in the sub-headline and the live/planned split is
//    stated in the ledger headers, so screen readers lose nothing.
//  · ZERO rAF loops, zero scroll listeners, zero parallax in this section.
// ═══════════════════════════════════════════════════════════════════════════

import { type ReactNode } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { Bitcoin, ShieldCheck, type LucideIcon } from "lucide-react"
import {
  DrawRule, EASE, GRIDLINE, HAIR, HAIR_SOFT,
  Reveal, Scramble, SplitLine, Stagger, StaggerItem, useOnce,
} from "../motion"
import { FEATURES, LOT_SEGMENTATION } from "../dogcity-data"

// ── the only two colours in this section ───────────────────────────────────
const C_LIVE = "#F56E0F"      // lava   — it exists
const C_PLANNED = "#FFAD42"   // amber  — it is intended

// ── the one flag, read once ────────────────────────────────────────────────
// Both the sentence and the drawing hang off this constant on purpose.
const ORDINALS_LIVE = FEATURES.inscriptionsLive
const INSCRIPTION_STATUS = ORDINALS_LIVE
  ? "Inscriptions are live"
  : "Inscription support is planned, not live yet"

// ═══ SectionHead ═══════════════════════════════════════════════════════════
// The folio's shared opening beat — identical in all six SKYLINE sections.
function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="max-w-2xl">
      <Scramble text={eyebrow} className="font-mono text-[11px] tracking-[0.3em] text-lava" />
      <DrawRule className="mt-3 w-14" delay={0.06} duration={0.9} />
      <h2 className="font-display font-bold text-3xl md:text-4xl text-snow mt-4 leading-tight">
        <SplitLine text={title} delay={0.12} step={0.055} />
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
// Small, dim, and still after entrance. If it glows it is a HUD bracket and
// it is wrong. Duplicated per file on purpose: motion.tsx is frozen.
function Corners({ accent, delay = 0 }: { accent?: string; delay?: number }) {
  const reduce = useReducedMotion()
  const { ref, inView } = useOnce("-5% 0px")
  const show = reduce || inView
  const C = [
    { box: "top-0 left-0",      h: "top-0 left-0",     v: "top-0 left-0",     ox: "left",  oy: "top" },
    { box: "top-0 right-0",     h: "top-0 right-0",    v: "top-0 right-0",    ox: "right", oy: "top" },
    { box: "bottom-0 right-0",  h: "bottom-0 right-0", v: "bottom-0 right-0", ox: "right", oy: "bottom" },
    { box: "bottom-0 left-0",   h: "bottom-0 left-0",  v: "bottom-0 left-0",  ox: "left",  oy: "bottom" },
  ]
  const paint = (i: number) => (i === 0 && accent ? accent : "rgba(240,240,242,0.22)")
  return (
    <span ref={ref as never} aria-hidden className="absolute inset-0 pointer-events-none">
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

// ═══ the pipeline ══════════════════════════════════════════════════════════
interface PipelineNode {
  id: string
  label: string
  live: boolean
}

// Labels are the sub-headline's own chain, word for word. State comes from the
// feature flags — never from a hand-written boolean.
const PIPELINE: PipelineNode[] = [
  { id: "wallet", label: "WALLET", live: true },
  { id: "property", label: "PROPERTY", live: FEATURES.plotLookupLive },
  { id: "coords", label: "LUNAR COORDINATES", live: FEATURES.plotLookupLive },
  { id: "ordinal", label: "ORDINAL REPRESENTATION", live: ORDINALS_LIVE },
  { id: "l1", label: "BITCOIN L1", live: ORDINALS_LIVE },
]

const SEG_COUNT = PIPELINE.length - 1
const RAIL_TOTAL = 1.4                                   // the fixed total beat
const RAIL_BASE = 0.46                                   // after the sub, before the ledger
const SEG_DUR = RAIL_TOTAL * 0.55
const SEG_GAP = SEG_COUNT > 1 ? (RAIL_TOTAL - SEG_DUR) / (SEG_COUNT - 1) : 0

// a segment is only live when both of the nodes it joins are
const segLive = (i: number) => PIPELINE[i].live && PIPELINE[i + 1].live
const segDelay = (i: number) => RAIL_BASE + i * SEG_GAP
const nodeDelay = (i: number) => (i === 0 ? RAIL_BASE : segDelay(i - 1) + SEG_DUR * 0.72)

function segBackground(live: boolean, axis: "h" | "v"): string {
  if (live) return C_LIVE
  const dir = axis === "h" ? "to right" : "to bottom"
  return `repeating-linear-gradient(${dir}, ${C_PLANNED} 0px, ${C_PLANNED} 4px, transparent 4px, transparent 8px)`
}

// filled square = it exists · hollow square = it is intended
function markStyle(live: boolean): { background: string } | { border: string } {
  return live ? { background: C_LIVE } : { border: `1px solid ${C_PLANNED}` }
}

// ── the curtain that draws a segment ───────────────────────────────────────
// A void-black cover retracting on scale. The line underneath never moves, so
// the dashes stay 4px whatever the viewport, and nothing re-measures.
function Curtain({
  axis, show, delay, duration,
}: { axis: "h" | "v"; show: boolean; delay: number; duration: number }) {
  return (
    <motion.span
      aria-hidden
      className={`absolute inset-0 bg-void ${axis === "h" ? "origin-right" : "origin-bottom"}`}
      initial={axis === "h" ? { scaleX: 1 } : { scaleY: 1 }}
      animate={show ? (axis === "h" ? { scaleX: 0 } : { scaleY: 0 }) : undefined}
      transition={{ duration, delay, ease: EASE }}
    />
  )
}

function Rail({ axis, className }: { axis: "h" | "v"; className?: string }) {
  const reduce = useReducedMotion()
  const { ref, inView } = useOnce("-5% 0px")
  const show = reduce || inView
  const last = PIPELINE.length - 1

  // ── horizontal: five columns, the rail across their node centres ─────────
  if (axis === "h") {
    return (
      <div ref={ref} aria-hidden className={className}>
        <div className="grid grid-cols-5">
          {PIPELINE.map((n, i) => (
            <div key={n.id} className="relative">
              {i > 0 && (
                <span
                  className="absolute block"
                  style={{
                    top: 4, left: "-50%", width: "100%", height: 1,
                    background: segBackground(segLive(i - 1), "h"),
                  }}
                >
                  {!reduce && (
                    <Curtain axis="h" show={show} delay={segDelay(i - 1)} duration={SEG_DUR} />
                  )}
                </span>
              )}
              <motion.span
                className="absolute block"
                style={{ top: 2, left: "50%", marginLeft: -2.5, width: 5, height: 5, ...markStyle(n.live) }}
                initial={reduce ? false : { opacity: 0 }}
                animate={show ? { opacity: 1 } : undefined}
                transition={{ duration: 0.35, delay: nodeDelay(i), ease: EASE }}
              />
              <div className="pt-4 px-1 text-center font-mono text-[9px] tracking-[0.2em] text-dusty leading-[1.6]">
                {n.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── vertical: the same rail, stacked, for narrow viewports ───────────────
  // Each connector runs from its own node centre to `-7px` past the row's
  // bottom edge — which is exactly the next node's centre, because the rows
  // are adjacent boxes. No height measurement anywhere.
  return (
    <div ref={ref} aria-hidden className={className}>
      {PIPELINE.map((n, i) => (
        <div key={n.id} className={`relative pl-6 ${i < last ? "pb-5" : ""}`}>
          {i < last && (
            <span
              className="absolute block"
              style={{ top: 7, bottom: -7, left: 2, width: 1, background: segBackground(segLive(i), "v") }}
            >
              {!reduce && <Curtain axis="v" show={show} delay={segDelay(i)} duration={SEG_DUR} />}
            </span>
          )}
          <motion.span
            className="absolute block"
            style={{ top: 4.5, left: 0, width: 5, height: 5, ...markStyle(n.live) }}
            initial={reduce ? false : { opacity: 0 }}
            animate={show ? { opacity: 1 } : undefined}
            transition={{ duration: 0.35, delay: nodeDelay(i), ease: EASE }}
          />
          <div className="font-mono text-[10px] tracking-[0.2em] text-dusty leading-[1.4]">{n.label}</div>
        </div>
      ))}
    </div>
  )
}

// ═══ the ledger ════════════════════════════════════════════════════════════
interface LedgerRow {
  id: string
  text: ReactNode
}
interface LedgerColumn {
  key: string
  label: string
  color: string
  live: boolean
  Icon: LucideIcon
  datum: string
  rows: LedgerRow[]
}

const pad2 = (n: number) => String(n).padStart(2, "0")
const LIVE_STAGES = PIPELINE.filter((n) => n.live).length
const PLANNED_STAGES = PIPELINE.length - LIVE_STAGES

// The one datum each plate carries is a count of the pipeline stages drawn
// directly above it — true by construction, and it moves with the flag.
const LEDGER: LedgerColumn[] = [
  {
    key: "live",
    label: "LIVE TODAY",
    color: C_LIVE,
    live: true,
    Icon: ShieldCheck,
    datum: `STAGES ${pad2(LIVE_STAGES)} / ${pad2(PIPELINE.length)}`,
    rows: [
      { id: "identity", text: "Wallet-based participation — your address is your identity" },
      { id: "fund", text: "Contribution registration on the live construction fund" },
      { id: "lookup", text: <>District &amp; lot lookup derived from real on-chain history</> },
      {
        id: "lots",
        text: (
          <>
            <span className="tabular-nums">{LOT_SEGMENTATION.total.toLocaleString()}</span>{" "}
            lots demarcated across BTC, SOL and STX holders
          </>
        ),
      },
    ],
  },
  {
    key: "planned",
    label: "PLANNED — GRAND OPENING",
    color: C_PLANNED,
    live: false,
    Icon: Bitcoin,
    datum: `STAGES ${pad2(PLANNED_STAGES)} / ${pad2(PIPELINE.length)}`,
    rows: [
      { id: "design", text: "Properties are being designed for representation through Bitcoin Ordinals" },
      { id: "mint", text: "Licensed wallets mint their building — paying only BTC network fees" },
      { id: "records", text: "Bitcoin L1 records for minted properties" },
      { id: "inscriptions", text: INSCRIPTION_STATUS },
    ],
  },
]

// ═══════════════════════════════════════════════════════════════════════════
export default function Section({}) {
  return (
    <section className={`border-t ${HAIR_SOFT}`}>
      <div className="max-w-6xl mx-auto px-6 md:px-10 py-20 md:py-28">
        <SectionHead
          eyebrow="BITCOIN & ORDINALS"
          title="Your property can live on Bitcoin."
          sub="Wallet → property → lunar coordinates → Ordinal representation → Bitcoin L1. We separate precisely what is live today from what is planned."
        />

        {/* ── THE PIPELINE RAIL — where fact becomes intention ─────────────── */}
        <Rail axis="h" className="hidden md:block mt-12" />
        <Rail axis="v" className="md:hidden mt-10" />

        {/* ── THE LEDGER — one sheet, two columns, one rule per row ────────── */}
        <Stagger
          className={`mt-10 grid md:grid-cols-2 gap-px ${GRIDLINE} border ${HAIR}`}
          step={0.09}
          delay={0.62}
        >
          {LEDGER.map((col) => {
            const Icon = col.Icon
            // flex-col, not grid: the header keeps its natural height in both
            // columns (so the two labels stay on one line) and the <ul> takes
            // the slack, so no gridline-coloured void is ever left over
            return (
              <StaggerItem key={col.key} className={`relative flex flex-col gap-px ${GRIDLINE}`}>
                <Corners accent={col.color} delay={0.62} />

                <div className="bg-void px-4 md:px-5 py-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <div
                    className="flex items-center gap-2 font-mono text-[10px] tracking-[0.25em]"
                    style={{ color: col.color }}
                  >
                    <Icon className="w-3.5 h-3.5" /> {col.label}
                  </div>
                  <div className="font-mono text-[9px] tracking-[0.25em] text-dusty tabular-nums whitespace-nowrap">
                    {col.datum}
                  </div>
                </div>

                <Stagger as="ul" className={`flex-1 grid gap-px ${GRIDLINE}`} step={0.055} delay={0.8}>
                  {col.rows.map((r) => (
                    <StaggerItem
                      as="li"
                      key={r.id}
                      className="group relative bg-void px-4 md:px-5 py-3.5 flex gap-3"
                    >
                      {/* row rule: colour on the left edge, opacity only */}
                      <span
                        aria-hidden
                        className="absolute left-0 top-0 bottom-0 w-[2px] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                        style={{ background: col.color }}
                      />
                      <span aria-hidden className="shrink-0 w-4 flex justify-center pt-[7px]">
                        <span className="block w-[7px] h-[7px]" style={markStyle(col.live)} />
                      </span>
                      <span className="text-[13px] text-mist leading-relaxed transition-colors group-hover:text-snow">
                        {r.text}
                      </span>
                    </StaggerItem>
                  ))}
                </Stagger>
              </StaggerItem>
            )
          })}
        </Stagger>

        {/* ── the signature: arrives last, on purpose ───────────────────────── */}
        <Reveal delay={0.86} y={10} className="mt-6">
          <p className="font-mono text-[10px] text-dusty leading-relaxed max-w-2xl">
            You always control your own wallet. Bitcoin network fees and confirmation times depend on network
            conditions. No seed phrase is ever requested — by anyone, ever.
          </p>
        </Reveal>
      </div>
    </section>
  )
}
