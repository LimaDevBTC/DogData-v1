"use client"

// ═══════════════════════════════════════════════════════════════════════════
// DogCity landing — RUNESTONE ORDINAL PARK. The folio's protected-lands sheet.
//
// This is the slow sheet, and the one section whose memorable thing is an
// ABSENCE. Everything here is tuned to make the page go quiet: the entrance
// envelope is roughly doubled (≈2.6s against the span's 1.9s), nothing loops,
// nothing hovers except the two gallery captions, and there is no rAF loop and
// no canvas anywhere in this file.
//
// Three mechanisms, in order:
//
//   1. THE DESCENT — the full-bleed plate settles from scale 1.06 → 1.00 while
//      its image drifts on useParallax(60). The parallax ref is deliberately on
//      the STATIC frame and the motion value is applied to an inner wrapper:
//      useScroll measures with getBoundingClientRect, so pointing it at a
//      transformed element feeds that element's own transform back into its
//      progress. The wrapper is inset ±72px so ±60px of drift can never expose
//      an edge, and the reserved aspect-[16/9] max-h-[76vh] box never changes
//      size after layout — the hero's body-portal geometry depends on that.
//
//   2. THE PLAQUE — `leave no footprints.` is lifted out of its inline <span>
//      onto its own display line between two struck rules, and the three prose
//      beats sit at 0 / 0.45 / 0.9 so the gaps are long enough to be felt. Every
//      word and every mark of the original copy is preserved, including the
//      terminal period that now closes the promoted line.
//
//   3. THE SHUTTER — the 2-up gallery wipes down through an animated
//      `clip-path: inset()`. One CSS property, no mosaic, no duotone pass:
//      restraint beats spectacle here, and these plates are already
//      near-monochrome lunar imagery so a duotone would be invisible labour.
//
// The RunestoneViewer is a LIVE OBJECT, not a plate — no registration corners,
// no glow behind it, no motion on its container, dynamic(ssr:false) with the
// same in-world loading string. The one change from the previous markup is that
// its `bg-gradient-to-b from-white/[0.02]` fill is gone: the renderer is
// `alpha: true` and that fill fought the transparent render.
//
// Tailwind note: this project's opacity scale is the stock one (multiples of
// 5). A white border at 8% written as a bare modifier does NOT compile — it
// falls through to preflight's #D1D5DB and paints a light-grey hairline on a
// black page. Hence HAIR / HAIR_SOFT / GRIDLINE from ../motion wherever a
// hairline is drawn, and bracket syntax for anything sub-5%.
// ═══════════════════════════════════════════════════════════════════════════

import Image from "next/image"
import dynamic from "next/dynamic"
import { motion, useReducedMotion } from "framer-motion"
import {
  EASE, HAIR, HAIR_SOFT, GRIDLINE,
  Reveal, Stagger, StaggerItem, SplitLine, Scramble, DrawRule,
  useOnce, useParallax,
} from "../motion"

const RunestoneViewer = dynamic(() => import("../runestone-viewer"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="font-mono text-[11px] tracking-[0.25em] text-dusty animate-pulse">SUMMONING RUNESTONE…</div>
    </div>
  ),
})

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

// ── content constants (copy preserved verbatim from page.tsx:452-534) ──────
interface ParkPlate {
  src: string
  label: string
  alt: string
  wide?: boolean
}

const GALLERY: ParkPlate[] = [
  {
    src: "/landing/park-wide.webp",
    label: "THE VALE · THREE SCALES OF ONE STONE",
    alt: "From the valley-floor trail: three rune-marked crystal giants stacked in depth, amber walkways threading the dark valley below",
  },
  {
    src: "/landing/park-finger.webp",
    label: "THE MARK · A HUNDRED-METRE GLYPH",
    alt: "From The Last Step: the Great Runestone's white rune mark, a hundred metres tall, glowing on the black crystal face",
  },
  {
    // 2026-08-19: o templo saiu do pódio e entrou na caverna (praca-ajustes.md
    // item 14). A chapa antiga mostrava o jardim rebaixado que já não é o lugar
    // dele; esta é a boca da caverna, capturada da cena viva.
    src: "/landing/plaza/plaza-temple.webp",
    label: "THE LEONIDAS TEMPLE · HIDDEN AMONG THE MONARCH STONES",
    alt: "The arched mouth of the Leonidas cave in a black basalt buttress, boulders screening the entrance, the black temple burning orange inside",
    wide: true,
  },
]

const PARK_FACTS: ReadonlyArray<readonly [string, string]> = [
  ["THE GREAT RUNESTONE", "500 m visible · summit 714 m"],
  ["THE RANGE", "crystal blooms · 4.8 km chain"],
  ["STONE CENSUS", "112,383 — one per Runestone"],
  ["EVERY STONE", "belongs to a wallet · 78,588 owners"],
  ["ACCESS", "public · every stone, open ground"],
  ["PARK AREA", "~1,400 hectares"],
  ["TRAILS", "11 km of walkway · roam free"],
]

// the register of named places — the tour below walks most of them
const GAZETTEER: ReadonlyArray<readonly [string, string]> = [
  ["THE GATE", "the range detonates into view"],
  ["LONGSHADOW PLAZA", "wheels end here"],
  ["VALE OF THE MARK", "a valley that ends at a stone"],
  ["VALLEY OF HANDS", "120 stones at your own scale"],
  ["FIRST GROUND", "regolith untouched since the fall"],
  ["THE LAST STEP", "49° of sky"],
  ["THE UMBRA CROSSING", "~160 m of walkable night"],
  ["LEONIDAS TEMPLE", "the park keeps one secret"],
]

// ═══ the shutter ═══════════════════════════════════════════════════════════
// A ticked plate whose image wipes down through clip-path. The corners strike
// first (frame before contents), the shutter runs, the caption plate settles
// last. Two figures, 0.12s apart. The caption is the section's only hover.
function GalleryFigure({ plate, index }: { plate: ParkPlate; index: number }) {
  const reduce = useReducedMotion()
  const { ref, inView } = useOnce("-8% 0px")
  const show = reduce || inView
  const base = index * 0.12

  return (
    <figure
      ref={ref as never}
      className={`group relative border ${HAIR} overflow-hidden ${plate.wide ? "aspect-[21/9] md:col-span-2" : "aspect-[16/10]"}`}
    >
      <motion.div
        className="absolute inset-0"
        initial={reduce ? false : { clipPath: "inset(0% 0% 100% 0%)" }}
        animate={show ? { clipPath: "inset(0% 0% 0% 0%)" } : undefined}
        transition={{ duration: 1.1, delay: base + 0.15, ease: EASE }}
      >
        <Image
          src={plate.src}
          alt={plate.alt}
          fill
          sizes={plate.wide ? "100vw" : "(min-width: 768px) 50vw, 100vw"}
          className="object-cover"
        />
      </motion.div>

      <Corners delay={base} />

      <motion.figcaption
        className="absolute bottom-3 left-3 font-mono text-[9px] tracking-[0.2em] text-snow/75 group-hover:text-snow bg-void/60 px-2 py-1 transition-colors"
        initial={reduce ? false : { opacity: 0 }}
        animate={show ? { opacity: 1 } : undefined}
        transition={{ duration: 0.6, delay: base + 0.65, ease: EASE }}
      >
        {plate.label}
      </motion.figcaption>
    </figure>
  )
}

export default function Section({}) {
  const reduce = useReducedMotion()
  const plate = useParallax(60)
  const { ref: settleGate, inView: settleIn } = useOnce("-5% 0px")
  const settled = reduce || settleIn

  return (
    <section className={`border-t ${HAIR_SOFT}`}>

      {/* ── the descent — full-bleed cinematic plate ───────────────────────── */}
      {/* the reserved box is exactly the previous one: any change to its height
          after layout re-measures document.body and re-registers the hero's
          scroll listeners */}
      <div ref={plate.ref} className="relative w-full aspect-[16/9] max-h-[76vh] overflow-hidden">
        <motion.div className="absolute inset-x-0" style={{ y: plate.y, top: -72, bottom: -72 }}>
          <motion.div
            ref={settleGate as never}
            className="absolute inset-0 will-change-transform"
            initial={reduce ? false : { scale: 1.06 }}
            animate={settled ? { scale: 1 } : undefined}
            transition={{ duration: 1.6, ease: EASE }}
          >
            <Image
              src="/landing/park-hero.webp"
              alt="Runestone Ordinal Park from the south-east: the whole chain of black-crystal outcrops standing across kilometres of lunar plain, the Great Runestone at its centre, the amber ring trail curving through the foreground"
              fill
              sizes="100vw"
              className="object-cover"
            />
          </motion.div>
        </motion.div>

        <div aria-hidden className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-void via-void/40 to-transparent" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-void via-void/60 to-transparent" />

        {/* the section head, at plate scale — same grammar as every other sheet
            in the folio (scramble · struck rule · masked headline), only the
            headline size is the plate's own */}
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-6xl mx-auto w-full px-6 md:px-10 pb-10">
            <Scramble text="RUNESTONE ORDINAL PARK" className="block font-mono text-[11px] tracking-[0.3em] text-lava" />
            <DrawRule className="mt-3 w-14" delay={0.06} duration={0.9} />
            <h2 className="font-display font-bold text-3xl md:text-5xl text-snow mt-4 max-w-2xl leading-tight">
              <SplitLine text="Beyond the skyline." delay={0.12} step={0.055} className="pb-[0.12em]" />
            </h2>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 md:px-10 py-16 md:py-24">
        <div className="grid md:grid-cols-2 gap-12 items-start">

          {/* ── the plaque ─────────────────────────────────────────────────── */}
          <div>
            <Reveal delay={0} y={14}>
              <p className="text-lg md:text-xl leading-[1.55] text-snow">
                Far northeast of the city, a mountain range of black crystal stands on a single
                descent line — from stones that fit in a glove to the 500-metre Great Runestone,
                all leaning the same way, all carrying the same white mark. One colossal stone
                broke apart falling, and wrote the whole park.
              </p>
            </Reveal>

            <Reveal delay={0.22} y={14} className="mt-5">
              <p className="text-sm text-mist leading-relaxed">
                There are 112,383 stones here — exactly the number of Runestones held when DOG
                was dropped. Every one is spoken for: the earliest recipients hold the tallest
                stones, and no wallet takes a second until all 78,588 have their first.
              </p>
            </Reveal>

            {/* the park's single rule, engraved: promoted off the line it used to
                sit inside, between two struck rules. Every word is preserved. */}
            <Reveal delay={0.45} y={14} className="mt-9">
              <p className="text-sm text-mist leading-relaxed">
                The park is built on a single promise:
              </p>
            </Reveal>
            <DrawRule className="mt-5 w-full" color="bg-white/20" delay={0.52} duration={1.1} />
            <div className="py-5">
              <span className="block font-display text-2xl text-snow">
                <SplitLine text="every stone is public ground." delay={0.62} step={0.07} className="pb-[0.12em]" />
              </span>
            </div>
            <DrawRule className="w-full" color="bg-white/20" delay={0.72} duration={1.1} />

            <Reveal delay={0.9} y={14} className="mt-7">
              <p className="text-sm text-mist leading-relaxed">
                At one-sixth gravity you can walk the whole basin — and you should. Footprints
                last a million years here; the park invites you to add yours. Eleven kilometres
                of walkway carry you to the far ridges, and everything between them is open
                ground, from the valley floor to the foot of the Great Runestone.
              </p>
            </Reveal>

            <Stagger
              as="dl"
              step={0.09}
              delay={1.24}
              className={`mt-8 grid grid-cols-2 gap-px ${GRIDLINE} border ${HAIR} font-mono`}
            >
              {PARK_FACTS.map(([k, v]) => (
                <StaggerItem key={k} className="bg-void p-4">
                  <dt className="text-[9px] tracking-[0.25em] text-dusty">{k}</dt>
                  <dd className="text-[12px] text-snow mt-1 tabular-nums">{v}</dd>
                </StaggerItem>
              ))}
            </Stagger>

            <Stagger
              as="dl"
              step={0.06}
              delay={1.5}
              className={`mt-4 grid grid-cols-2 gap-px ${GRIDLINE} border ${HAIR} font-mono`}
            >
              {GAZETTEER.map(([k, v]) => (
                <StaggerItem key={k} className="bg-void p-3">
                  <dt className="text-[9px] tracking-[0.25em] text-dusty">{k}</dt>
                  <dd className="text-[11px] text-snow mt-1">{v}</dd>
                </StaggerItem>
              ))}
            </Stagger>

            <Reveal delay={1.7} y={10} className="mt-4">
              <p className="font-mono text-[10px] text-dusty leading-relaxed">
                Connected to DogCity by a single scenic road. Protected from dense development,
                forever outside the urban core. One path is on no map: it leaves the ring
                unmarked, passes between two leaning giants, and ends at the Leonidas Temple.
              </p>
              <p className="mt-3 font-mono text-[10px] tracking-[0.2em] text-dusty">
                SCROLL TO WALK THE PARK ↓
              </p>
              <a
                href="/city?view=park"
                className="mt-2 inline-block font-mono text-[10px] tracking-[0.2em] text-lava hover:text-lava-light transition-colors"
              >
                OR STAND AT THE GATE, LIVE ↗
              </a>
            </Reveal>
          </div>

          {/* ── the artifact — a live object, not a plate. Untouched. ───────── */}
          <div>
            {/* An explicit height below lg, because the viewer inside carries a
                min-h-[420px] of its own: against an aspect-square parent that
                is only ~248px tall on a phone, the WebGL canvas overflowed its
                own plate by ~172px. Heights are fixed per breakpoint so the box
                never resizes after layout — the hero's body-portal geometry is
                measured off document.body. */}
            <div className={`relative h-[320px] sm:h-[420px] lg:h-auto lg:aspect-square max-h-[520px] border ${HAIR}`}>
              <RunestoneViewer />
            </div>
            <p className="mt-3 font-mono text-[10px] text-dusty">
              The official Runestone artifact — drag to rotate, ± to zoom.
            </p>
          </div>
        </div>

        {/* ── the 2-up gallery — shutters wiping down ─────────────────────── */}
        <div className="mt-14 grid md:grid-cols-2 gap-4">
          {GALLERY.map((p, i) => (
            <GalleryFigure key={p.src} plate={p} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
