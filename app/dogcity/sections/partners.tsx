"use client"

// ═══════════════════════════════════════════════════════════════════════════
// INSTITUTIONAL PARTNERS — the folio's anchor-lots sheet.
//
// Two lots on the Satoshi Plaza ring are not in the holder draw: they are named
// in the masterplan for the projects DogCity is built with. This sheet is where
// the page says who they are, and it says it with the buildings themselves.
//
// THE MECHANISM — the dossier IS the selector.
// One WebGL plate shows one anchor at a time. There is no tab strip floating
// over the render, because a tab strip would be a second control saying the
// same thing as the two cards underneath it. Instead each partner's dossier
// carries the control that summons its building, and a single lava rule slides
// between the two cards (framer `layoutId`) so the connection between "this
// card" and "that tower" is drawn, not implied.
//
// WHY A LIVE MODEL AND NOT A RENDER.
// Both towers already exist as procedural builders — the same code the city
// runs. A baked image would go stale the first time either building is touched;
// the live model cannot, and orbiting it is the honest claim: this is the
// building, on its lot, not an artist's impression of one.
//
// PERF
//   · ONE canvas for both partners. WebGL boots on an IntersectionObserver 400px
//     out and hard-stops when the plate leaves the viewport (tower-viewer.tsx).
//   · Switching partners is a visibility toggle plus a camera tween — the
//     unselected tower is built once and kept, never rebuilt.
//   · The plate is a reserved aspect box that never changes size after layout —
//     the hero's body-portal geometry is measured off document.body.
//
// Tailwind note: this project's opacity scale is the stock one (multiples of
// 5). A white border at 8% written as a bare modifier does NOT compile — it
// falls through to preflight's #D1D5DB and paints a light-grey hairline on a
// black page. Hence HAIR / HAIR_SOFT / GRIDLINE from ../motion.
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from "react"
import Image from "next/image"
import dynamic from "next/dynamic"
import { motion, useReducedMotion } from "framer-motion"
import {
  EASE, HAIR, HAIR_SOFT, HAIR_STRONG, GRIDLINE,
  Reveal, Stagger, StaggerItem, SplitLine, Scramble, DrawRule,
  useOnce,
} from "../motion"
import { PARTNERS, type PartnerKey } from "../partners/partners-data"

const TowerViewer = dynamic(() => import("../partners/tower-viewer"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="font-mono text-[11px] tracking-[0.25em] text-dusty animate-pulse">RAISING THE ANCHOR…</div>
    </div>
  ),
})

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
// Small, dim, and still after entrance. Duplicated per file on purpose:
// motion.tsx is frozen.
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

// ═══ the dossier ═══════════════════════════════════════════════════════════
// A partner's record sheet, and the control that summons their building onto
// the plate above. Active state is carried by three things at once: full
// opacity, an accented top-left corner tick, and the sliding lava rule.
function Dossier({
  partner, active, onSelect, index,
}: {
  partner: (typeof PARTNERS)[number]
  active: boolean
  onSelect: () => void
  index: number
}) {
  const reduce = useReducedMotion()

  return (
    <StaggerItem className={`relative border ${active ? HAIR_STRONG : HAIR} bg-void transition-colors duration-500`}>
      {/* the rule that slides between the two cards — the only thing on this
          sheet that moves on its own, and it only moves when you ask it to */}
      {active && (
        <motion.span
          layoutId={reduce ? undefined : "partner-active-rule"}
          className="absolute -top-px inset-x-0 h-px bg-lava"
          transition={{ duration: 0.5, ease: EASE }}
        />
      )}
      <Corners accent={active ? partner.accent : undefined} delay={index * 0.08} />

      <div className={`p-5 md:p-6 transition-opacity duration-500 ${active ? "opacity-100" : "opacity-70"}`}>
        {/* head — mark, then designation */}
        <div className="flex items-start justify-between gap-4">
          <div className={`relative ${partner.logoClass} w-[150px]`}>
            <Image
              src={partner.logo}
              alt={partner.logoAlt}
              fill
              sizes="150px"
              className="object-contain object-left"
            />
          </div>
          <span className="font-mono text-[9px] tracking-[0.22em] text-dusty whitespace-nowrap pt-1">
            {partner.position.toUpperCase()}
          </span>
        </div>

        <div className="mt-5 flex items-baseline gap-3 flex-wrap">
          <h3 className="font-display font-bold text-xl text-snow">{partner.building}</h3>
          <span className="font-mono text-[9px] tracking-[0.22em] text-lava">{partner.lot}</span>
        </div>

        <p className="mt-3 text-sm text-mist leading-relaxed">{partner.blurb}</p>

        {/* the spec table — same four rows on both cards, so the two dossiers
            read as one comparison rather than two brochures */}
        <dl className={`mt-6 grid grid-cols-2 gap-px ${GRIDLINE} border ${HAIR} font-mono`}>
          {partner.specs.map(([k, v]) => (
            <div key={k} className="bg-void p-3">
              <dt className="text-[9px] tracking-[0.25em] text-dusty">{k}</dt>
              <dd className="text-[11px] text-snow mt-1 leading-snug">{v}</dd>
            </div>
          ))}
        </dl>

        {/* controls — select is a button, the partner's site is a link. Never
            one nested in the other. */}
        <div className={`mt-5 pt-4 border-t ${HAIR} flex items-center justify-between gap-4`}>
          <button
            type="button"
            onClick={onSelect}
            aria-pressed={active}
            className={`font-mono text-[10px] tracking-[0.22em] transition-colors ${
              active ? "text-lava cursor-default" : "text-dusty hover:text-snow"
            }`}
          >
            {active ? "◆ SHOWN ON THE PLATE" : "◇ SHOW ON THE PLATE"}
          </button>
          <a
            href={partner.href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[10px] tracking-[0.22em] text-mist hover:text-snow transition-colors"
          >
            {partner.hrefLabel} ↗
          </a>
        </div>
      </div>
    </StaggerItem>
  )
}

export default function Section() {
  const [active, setActive] = useState<PartnerKey>("bitflow")

  return (
    <section id="partners" className={`border-t ${HAIR_SOFT}`}>
      <div className="max-w-6xl mx-auto px-6 md:px-10 py-16 md:py-24">
        <SectionHead
          eyebrow="INSTITUTIONAL PARTNERS"
          title="The anchors of Satoshi Plaza."
          sub="Two lots on the plaza ring never enter the holder draw. They are named in the masterplan for the projects DogCity is built with — and both buildings are already standing in the city model. Orbit them."
        />

        {/* ── the plate — one canvas, one anchor at a time ─────────────────── */}
        <Reveal delay={0.2} y={20} className="mt-10 md:mt-12">
          <div className={`relative aspect-[4/3] sm:aspect-[16/10] md:aspect-[16/9] border ${HAIR} overflow-hidden`}>
            <TowerViewer partner={active} />
            <Corners accent="rgba(245,110,15,0.85)" delay={0.1} />
          </div>
        </Reveal>

        <Reveal delay={0.3} y={10}>
          <p className="mt-3 font-mono text-[10px] text-dusty leading-relaxed">
            Rendered live from the same builders the city runs — not a still. Drag to orbit, pinch or use ± to zoom.
          </p>
        </Reveal>

        {/* ── the dossiers ─────────────────────────────────────────────────── */}
        <Stagger className="mt-10 grid md:grid-cols-2 gap-4" step={0.1} delay={0.1}>
          {PARTNERS.map((p, i) => (
            <Dossier
              key={p.key}
              partner={p}
              index={i}
              active={active === p.key}
              onSelect={() => setActive(p.key)}
            />
          ))}
        </Stagger>

        <Reveal delay={0.2} y={10} className="mt-6">
          <p className="font-mono text-[10px] text-dusty leading-relaxed max-w-2xl">
            Anchor lots sit on the plaza ring, outside the lot assignment that follows wallet history.
            They are reserved in the masterplan and do not reduce the number of lots available to holders.
          </p>
        </Reveal>
      </div>
    </section>
  )
}
