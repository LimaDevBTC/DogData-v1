"use client"

// ═══════════════════════════════════════════════════════════════════════════
// FOUNDING ERA REGISTRATIONS (#tiers) — four DEEDS, not four pricing columns.
//
// The audit's sharpest note on this section was that there is no visual
// escalation between 10k / 50k / 500k: "Patron looks the same weight as
// Founder". So the escalation became the material of the card.
//
// THE MECHANISM — the lot fill.
// Every deed is backed by a 7px survey lot-grid drawn in that tier's own
// colour, cut off from above at a REST HEIGHT that steps up with the tier
// (22 · 44 · 66 · 100 %). Read left to right at rest, the four cards are an
// ascending bar of ground you own. On hover the cut runs to the top over 0.9s
// and you literally fill your lot — the visitor's own pointer is the reveal.
//
// It is driven by ONE interpolated custom property, `--lot`, registered with
// @property so it can be transitioned as a <percentage>. Two layers read it:
// the grid (clip-path: inset(--lot 0 0 0)) and the ground line
// (transform: translateY(--lot) — a percentage translate resolves against the
// element's OWN height, which here is the card's, so the line lands exactly
// on the cut). clip-path and transform only: no rAF, no canvas, no React
// state, and nothing that can change this card's box after layout and force a
// re-measure of the hero portal's geometry. `--lot-rest` is set inline per
// tier (colour-as-data, house rule 2.11) and the stylesheet reads it, so the
// :hover rule can still win over the inline value.
//
// `SectionHead` and `Corners` (the folio's shared registration mark) are the
// team's shared grammar, copied in verbatim — motion.tsx is frozen this pass,
// so identical local copies across the six section files are intended.
//
// One deviation from the shared entrance table: the corners are struck at
// beat 4 PLUS the card's own stagger slot rather than at a flat 0.50. Here the
// plate IS the staggered item, so a corner drawn before its card has faded in
// is a corner nobody sees.
//
// Every string, threshold, perk, note, href and id below is verbatim from
// dogcity-data.ts and the markup this replaces. The Founder note is a legal
// distinction between recognition and mint licence — it is not copy.
// ═══════════════════════════════════════════════════════════════════════════

import { motion, useReducedMotion } from "framer-motion"
import { TIERS } from "../dogcity-data"
import {
  EASE, HAIR, DrawRule, Reveal, Scramble, SplitLine,
  Stagger, StaggerItem, useOnce, useSpotlight,
} from "../motion"

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

// ── the section head — the folio's shared opening beat ──────────────────────
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

// ── the lot ramp ───────────────────────────────────────────────────────────
// A DESIGN parameter, not project data: how much of the sheet each tier's
// ground already covers at rest. It is the section's escalation, expressed as
// material. Nothing here is a claim about the product.
const LOT_REST_FILL: Record<string, number> = {
  founder: 22,
  personal: 44,
  commercial: 66,
  patron: 100,
}

interface Tier {
  key: string
  name: string
  threshold: string
  usd?: string
  color: string
  featured?: boolean
  perks: string[]
  note?: string
  cta: string
}

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

// ── one deed ───────────────────────────────────────────────────────────────
function Deed({ t, index, count }: { t: Tier; index: number; count: number }) {
  const { ref, onPointerMove } = useSpotlight<HTMLDivElement>()
  const fill = LOT_REST_FILL[t.key] ?? 22
  const slot = index * 0.075   // this card's place in the deck's stagger

  return (
    <StaggerItem>
      <div
        ref={ref}
        onPointerMove={onPointerMove}
        className={`dc-deed spotlight-card relative h-full border p-6 flex flex-col transition-colors duration-500 ${
          t.featured
            ? "border-lava/50 bg-lava/[0.04] hover:border-lava/75"
            : `${HAIR} hover:border-white/25`
        }`}
        style={{ ["--lot-rest" as string]: `${100 - fill}%` }}
      >
        {/* the lot — the ground this deed grants, drawn at survey pitch */}
        <span aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
          <span
            className="dc-lot absolute inset-0"
            style={{
              backgroundImage:
                `linear-gradient(to right, ${t.color}1A 1px, transparent 1px),` +
                `linear-gradient(to bottom, ${t.color}1A 1px, transparent 1px)`,
              backgroundSize: "7px 7px",
              backgroundPosition: "left bottom",
              WebkitMaskImage: "linear-gradient(to top, #000 0%, #000 45%, rgba(0,0,0,0.22) 100%)",
              maskImage: "linear-gradient(to top, #000 0%, #000 45%, rgba(0,0,0,0.22) 100%)",
            }}
          />
          {/* the boundary markers — struck at the fill height, at the lot's
              two edges only. A full-width rule here would run straight
              through the Founder's legal note and read as a strikethrough. */}
          <span
            className="dc-lotline absolute inset-x-0 top-0 h-full border-t"
            style={{
              borderColor: `${t.color}66`,
              WebkitMaskImage:
                "linear-gradient(to right, #000 0 22px, transparent 22px calc(100% - 22px), #000 calc(100% - 22px))",
              maskImage:
                "linear-gradient(to right, #000 0 22px, transparent 22px calc(100% - 22px), #000 calc(100% - 22px))",
            }}
          />
        </span>

        <Corners accent={t.featured ? "#F56E0F" : undefined} delay={0.8 + slot} />

        {t.featured && (
          <span className="absolute -top-px right-4 font-mono text-[9px] tracking-[0.2em] text-void bg-lava px-2 py-0.5">
            MINT LICENSE
          </span>
        )}

        {/* contents sit above the lot: a positioned wrapper, no z-index war */}
        <div className="relative flex flex-col flex-1">
          <div className="flex items-baseline justify-between gap-3 font-mono text-[9px] tracking-[0.25em] text-dusty">
            <span>DEED OF REGISTRATION</span>
            <span className="tabular-nums shrink-0">{pad2(index + 1)} / {pad2(count)}</span>
          </div>

          {/* colour-as-data: `bg-current` inherits the tier hue from the
              wrapper's inline `color`, so DrawRule stays the shared primitive */}
          <span aria-hidden className="block" style={{ color: t.color }}>
            <DrawRule className="mt-3 w-10" color="bg-current" delay={0.9 + slot} duration={0.7} />
          </span>

          <div className="font-display font-bold text-xl mt-3" style={{ color: t.color }}>{t.name}</div>
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
            <p className={`mt-4 pt-3 border-t ${HAIR} font-mono text-[10px] text-dusty leading-relaxed`}>
              {t.note}
            </p>
          )}

          <a
            href="#build"
            className={`mt-5 inline-flex justify-center items-center gap-2 px-4 py-2.5 font-mono text-[12px] font-bold transition-colors ${
              t.featured
                ? "text-void bg-lava hover:bg-lava-light"
                : "text-snow border border-white/20 hover:border-white/[0.45]"
            }`}
          >
            {t.cta}
          </a>
        </div>
      </div>
    </StaggerItem>
  )
}

export default function Section({}) {
  const tiers = TIERS as Tier[]

  return (
    <section id="tiers" className="border-t border-white/[0.06] scroll-mt-16">
      <div className="max-w-6xl mx-auto px-6 md:px-10 py-20 md:py-28">
        <SectionHead
          eyebrow="FOUNDING ERA REGISTRATIONS"
          title="Choose how you enter the Founding Era."
          sub="These are not subscriptions — they are one-time founding property registrations. Your contribution funds construction and defines your participation level."
        />

        <Stagger className="mt-10 grid md:grid-cols-2 xl:grid-cols-4 gap-4" delay={0.62} step={0.075}>
          {tiers.map((t, i) => (
            <Deed key={t.key} t={t} index={i} count={tiers.length} />
          ))}
        </Stagger>
      </div>

      <style jsx global>{`
        /* the lot fill — one interpolated percentage, two layers reading it */
        @property --lot {
          syntax: "<percentage>";
          inherits: true;
          initial-value: 100%;
        }
        .dc-deed {
          --lot: var(--lot-rest, 100%);
          transition: --lot 0.9s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .dc-lot { clip-path: inset(var(--lot) 0 0 0); }
        .dc-lotline { transform: translateY(var(--lot)); }

        /* pointer-only: a touch tap must not leave a lot filled forever */
        @media (hover: hover) and (pointer: fine) {
          .dc-deed:hover { --lot: 0%; }
        }

        /* the finished state under reduced motion is the REST state — the
           escalation between the four tiers stays fully legible, it just
           never animates */
        @media (prefers-reduced-motion: reduce) {
          .dc-deed { transition: none; }
          .dc-deed:hover { --lot: var(--lot-rest, 100%); }
        }
      `}</style>
    </section>
  )
}
