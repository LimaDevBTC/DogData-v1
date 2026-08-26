"use client"

// ═══════════════════════════════════════════════════════════════════════════
// THE NEEDLE — the folio's own-landmark sheet.
//
// WHY IT SITS HERE, between the masterplan and the partners.
// The masterplan sheet above ends on "one city, three chains" and a plate of the
// whole site. The partners sheet below is about the two lots on the plaza RING.
// Between those two beats there is a hole: the page has never shown the thing at
// the CENTRE of the ring, which is the project's own building and the only one
// DogCity owns. So this sheet is the pivot — it zooms from the masterplan into
// the plaza, and hands over to the anchors that stand around it.
//
// It is deliberately NOT a third partner card. Kray and Bitflow lease anchor
// lots; DogCity does not lease a lot from itself, so the Needle gets no dossier,
// no lot number and no outbound link. It gets a plate and four facts.
//
// WHAT IS ON THE PLATE.
// The same viewer the partners section uses, pointed at `needle` — a
// Blender-modelled site: the tower plus Satoshi Plaza's radial paving, the lit
// water feature, the garden quadrants and the four anchor lot markers. Those
// four markers are the editorial link to the next sheet: two of them are the
// buildings you are about to meet.
//
// PERF — the third WebGL canvas on this page, and treated as such.
// The hero already scrubs a frame sequence, the park section runs the runestone
// viewer, and the partners section runs the anchors. This one inherits the same
// discipline from tower-viewer.tsx: WebGL boots on an IntersectionObserver 400px
// out and HARD STOPS when the plate leaves the viewport, so two canvases never
// tick at once. The Needle GLB is only fetched when the plate approaches.
//
// Tailwind note: this project's opacity scale is the stock one (multiples of 5).
// A white border at 8% written as a bare modifier does NOT compile — it falls
// through to preflight's #D1D5DB and paints a light-grey hairline on a black
// page. Hence HAIR / HAIR_SOFT / GRIDLINE from ../motion.
// ═══════════════════════════════════════════════════════════════════════════

import dynamic from "next/dynamic"
import { motion, useReducedMotion } from "framer-motion"
import {
  EASE, HAIR, HAIR_SOFT, GRIDLINE,
  Reveal, Stagger, StaggerItem, SplitLine, Scramble, DrawRule,
  useOnce,
} from "../motion"

const TowerViewer = dynamic(() => import("../partners/tower-viewer"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="font-mono text-[11px] tracking-[0.25em] text-dusty animate-pulse">RAISING THE NEEDLE…</div>
    </div>
  ),
})

// ── the registration corner — team SKYLINE's shared mark ───────────────────
// Four L-ticks struck INSIDE a plate's hairline before its contents ink in.
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

// ── the facts ──────────────────────────────────────────────────────────────
// Every one is a property of the model that actually renders or of the
// masterplan. No metre heights: the city has no published metre scale, and a
// number invented in a surveyor's voice is still invented. "Tallest structure"
// is a relation between our own buildings, and that IS true by construction.
const NEEDLE_FACTS: ReadonlyArray<readonly [string, string]> = [
  ["STANDING", "Satoshi Plaza · centre"],
  ["HEIGHT", "Tallest structure in the city"],
  ["CROWN", "Observation deck · LED band"],
  ["OWNERSHIP", "The project · never leased"],
]

export default function Section() {
  return (
    <section id="needle" className={`border-t ${HAIR_SOFT}`}>
      <div className="max-w-6xl mx-auto px-6 md:px-10 py-16 md:py-24">

        <div className="max-w-2xl">
          <Scramble text="THE CENTRAL LANDMARK" className="font-mono text-[11px] tracking-[0.3em] text-lava" />
          <DrawRule className="mt-3 w-14" delay={0.06} duration={0.9} />
          <h2 className="font-display font-bold text-3xl md:text-4xl text-snow mt-4 leading-tight">
            <SplitLine text="Everything is measured from here." delay={0.12} step={0.055} className="pb-[0.12em]" />
          </h2>
          <Reveal delay={0.34} y={14}>
            <p className="text-sm text-mist mt-3 leading-relaxed">
              At the centre of Satoshi Plaza stands the Needle, the one building DogCity owns.
              Its crown carries the <span className="text-snow">DOG · GO · TO · THE · MOON</span> band,
              and the four anchor lots ring its plaza.
            </p>
          </Reveal>
        </div>

        <div className="mt-10 md:mt-12 grid lg:grid-cols-[minmax(0,1fr)_300px] gap-6 lg:gap-8 items-start">

          {/* ── the plate ──────────────────────────────────────────────────── */}
          {/* Portrait on phones, as in the partners sheet: the Needle is a needle,
              and a landscape box on a 390px screen spends its width on plaza. */}
          <Reveal delay={0.2} y={20}>
            <div className={`relative aspect-[4/5] sm:aspect-[16/10] lg:aspect-[16/9] border ${HAIR} overflow-hidden`}>
              <TowerViewer partner="needle" />
              <Corners accent="rgba(245,110,15,0.85)" delay={0.1} />
            </div>
          </Reveal>

          {/* ── the facts, and the hand-off to the anchors ──────────────────── */}
          <div>
            <Stagger
              as="dl"
              step={0.09}
              delay={0.3}
              className={`grid grid-cols-2 lg:grid-cols-1 gap-px ${GRIDLINE} border ${HAIR} font-mono`}
            >
              {NEEDLE_FACTS.map(([k, v]) => (
                <StaggerItem key={k} className="bg-void p-4">
                  <dt className="text-[9px] tracking-[0.25em] text-dusty">{k}</dt>
                  <dd className="text-[12px] text-snow mt-1 leading-snug">{v}</dd>
                </StaggerItem>
              ))}
            </Stagger>

            <Reveal delay={0.7} y={12} className="mt-5">
              <p className="text-sm text-mist leading-relaxed">
                The plaza is drawn on a radial set-out: paving, water, garden quadrants and a ring
                road. Four lots sit on that ring, outside the assignment that follows wallet
                history; they are reserved in the masterplan.
              </p>
            </Reveal>

            <Reveal delay={0.85} y={10} className="mt-5 flex flex-col gap-2">
              <a
                href="#partners"
                className="font-mono text-[10px] tracking-[0.22em] text-lava hover:text-lava-light transition-colors"
              >
                TWO OF THEM ARE BUILT ↓
              </a>
              <a
                href="/city"
                className="font-mono text-[10px] tracking-[0.22em] text-lava hover:text-lava-light transition-colors"
              >
                STAND ON THE DECK, LIVE ↗
              </a>
            </Reveal>

            <Reveal delay={1} y={10} className="mt-5">
              <p className="font-mono text-[10px] text-dusty leading-relaxed">
                Drag to orbit, pinch or use ± to zoom. Modelled geometry, rendered live.
              </p>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  )
}
