"use client"

// ═══════════════════════════════════════════════════════════════════════════
// DogCity landing — FINAL CTA. The signature block of the masterplan folio.
//
// The hero spent 500vh building the city; the five sheets below it recorded
// it. The last sheet has one job: land. So the page closes exactly where it
// opened — on the empty survey grid of phase 01, drawn in perspective and
// receding to a lava horizon behind the headline. After all that construction,
// the final image is the ground before any of it existed.
//
// Three non-obvious mechanisms:
//
//  1. THE HORIZON is generated, not photographed. Two crossed linear-gradients
//     on a `rotateX` plane inside a `perspective` parent, masked at the far and
//     near edges and vignetted to void at every side. No image, no canvas, no
//     rAF — the whole backdrop is four divs. It is revealed once on enter by a
//     `clip-path: inset()` iris that opens outward and downward from the
//     vanishing point over 1.8s, then holds forever.
//
//  2. THE PRIMARY CTA decrypts. OriginKit's `encrypt-button` mechanism: on
//     pointer-enter the label is overwritten with hex junk (the address
//     alphabet) and resolves back left-to-right at 60 steps/sec for
//     `letters × 4` steps. Two ports were mandatory. (a) The source is a
//     `motion.div` with an `aria-label` and no keyboard affordance at all;
//     here the mechanism lives INSIDE a real `<a href="#build">` and the
//     accessible name is a permanent `sr-only` copy of the true label, so
//     junk glyphs can never become the link text. (b) The settled label is
//     rendered underneath at `visibility: hidden` and the animating copy
//     painted absolutely over it, so the button cannot resize mid-decrypt.
//     It is driven by a self-terminating `setInterval` — a bounded ~0.9s
//     pointer-gated transient, deliberately NOT a rAF loop, because the
//     below-fold frame budget belongs to the terrain trace and the torch.
//
//  3. THE REGISTRATION CORNERS are struck at the SECTION's own bounds with
//     24px arms at delay 1.2 — the folio's last sheet being stamped. Their
//     label slot carries the one real datum this close is allowed:
//     LOT_SEGMENTATION.total, which is already true and already on the page.
//     Nothing here is invented.
//
// Tailwind note: this project's opacity scale is the stock one, so an opacity
// modifier outside 0/5/10/20/25/30/40/50/60/70/75/80/90/95/100 emits nothing
// and the bare `border` utility falls through to preflight's #D1D5DB — a
// bright hairline on a black page. Hence HAIR_SOFT from ../motion, and bracket
// syntax for everything else. Note the house secondary-button hover is written
// `/45` elsewhere on this page: that value is NOT on the scale, so it is set
// here as `border-white/[0.45]`, which renders what the original intended.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import {
  Counter, DrawRule, EASE, EASE_CSS, HAIR_SOFT, Reveal, SplitLine,
  useMagnetic, useOnce,
} from "../motion"
import { LOT_SEGMENTATION } from "../dogcity-data"

// ── the registration corner — team SKYLINE's shared mark ───────────────────
// Four L-ticks struck INSIDE a plate's hairline before its contents ink in.
// Small, dim, and still after entrance. If it glows it is a HUD bracket and
// it is wrong. Duplicated per file on purpose: motion.tsx is frozen. The only
// deviation from the shared reference is the `arm` prop — this sheet ticks the
// section's own bounds at 24px rather than a plate at 10px.
function Corners({ accent, delay = 0, arm = 10 }: { accent?: string; delay?: number; arm?: number }) {
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
    <span ref={ref as never} aria-hidden className="absolute inset-0 pointer-events-none">
      {C.map((c, i) => (
        <span key={c.box} className={`absolute ${c.box}`} style={{ width: arm, height: arm }}>
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

// ── the survey horizon ─────────────────────────────────────────────────────
// Phase 01, regenerated: the lot grid before a single foundation was poured.
// Local-space mask fades the plane at the vanishing point and at the near
// edge; a screen-space vignette dissolves the whole thing to void at the
// sides. The iris (clip-path) is the section's one entrance move.
const PLANE_MASK = "linear-gradient(to bottom, transparent 0%, #000 13%, #000 60%, transparent 100%)"
const GRID_LINES =
  "linear-gradient(to right, rgba(245,110,15,0.34) 1px, transparent 1px)," +
  "linear-gradient(to bottom, rgba(245,110,15,0.22) 1px, transparent 1px)"

function SurveyHorizon() {
  const reduce = useReducedMotion()
  const { ref, inView } = useOnce("-5% 0px")
  const OPEN = "inset(0% 0% 0% 0%)"
  const SHUT = "inset(0% 50% 62% 50%)"

  return (
    <div ref={ref} aria-hidden className="absolute inset-0 pointer-events-none">
      <motion.div
        className="absolute inset-0"
        initial={reduce ? false : { clipPath: SHUT }}
        animate={reduce || inView ? { clipPath: OPEN } : undefined}
        transition={{ duration: 1.8, delay: 0.1, ease: EASE }}
        style={reduce ? { clipPath: OPEN } : undefined}
      >
        {/* the ground plane, receding */}
        <div
          className="absolute inset-x-0 bottom-0 top-[44%]"
          style={{ perspective: "340px", perspectiveOrigin: "50% 0%" }}
        >
          <div
            className="absolute left-[-70%] right-[-70%] top-0 h-[260%]"
            style={{
              transform: "rotateX(76deg)",
              transformOrigin: "50% 0%",
              backgroundImage: GRID_LINES,
              backgroundSize: "84px 84px",
              maskImage: PLANE_MASK,
              WebkitMaskImage: PLANE_MASK,
            }}
          />
        </div>

        {/* the horizon itself: one hairline, and the sky it burns into */}
        <div
          className="absolute inset-x-0 top-[44%] h-px"
          style={{
            background:
              "linear-gradient(to right, transparent 0%, rgba(245,110,15,0.28) 26%, rgba(245,110,15,0.45) 50%, rgba(245,110,15,0.28) 74%, transparent 100%)",
          }}
        />
        <div
          className="absolute inset-x-0 top-[44%] h-28 -translate-y-full"
          style={{
            background:
              "radial-gradient(ellipse 42% 100% at 50% 100%, rgba(245,110,15,0.10) 0%, transparent 72%)",
          }}
        />
      </motion.div>

      {/* dissolve to void at every edge — sits outside the iris on purpose */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 74% 60% at 50% 76%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 54%, #000000 84%)",
        }}
      />
    </div>
  )
}

// ── the decrypting label ───────────────────────────────────────────────────
// `encrypt-button`'s step machine, verbatim in behaviour: a letter settles the
// moment `step / cycles > index`, so the label resolves strictly left to right.
// Math.random() runs only inside the timer, never at render — no hydration
// mismatch. The timer clears itself the frame after the last letter settles.
const CIPHER = "0123456789abcdef"   // the address alphabet
const STEPS_PER_SEC = 60
const CYCLES = 4

function useDecryptLabel(label: string) {
  const out = useRef<HTMLSpanElement>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const reduce = useReducedMotion()

  const stop = useCallback(() => {
    if (timer.current !== null) {
      clearInterval(timer.current)
      timer.current = null
    }
    if (out.current) out.current.textContent = label
  }, [label])

  const start = useCallback(
    (e: React.PointerEvent<HTMLAnchorElement>) => {
      if (reduce || e.pointerType !== "mouse") return
      if (timer.current !== null) return
      const chars = label.split("")
      const total = chars.length * CYCLES
      let step = 0
      timer.current = setInterval(() => {
        const el = out.current
        if (!el) return
        el.textContent = chars
          .map((ch, i) => {
            if (ch === " ") return " "
            if (step / CYCLES > i) return ch
            return CIPHER[Math.floor(Math.random() * CIPHER.length)]
          })
          .join("")
        step += 1
        if (step > total) stop()
      }, 1000 / STEPS_PER_SEC)
    },
    [label, reduce, stop],
  )

  useEffect(
    () => () => {
      if (timer.current !== null) clearInterval(timer.current)
    },
    [],
  )

  return { out, start, stop }
}

const PRIMARY_LABEL = "Build DogCity"

export default function Section({}) {
  const primary = useMagnetic<HTMLAnchorElement>()
  const secondary = useMagnetic<HTMLAnchorElement>()
  const decrypt = useDecryptLabel(PRIMARY_LABEL)

  return (
    <section className={`relative overflow-hidden border-t ${HAIR_SOFT}`}>
      <SurveyHorizon />
      <Corners arm={24} delay={1.2} />

      {/* the sheet's one real datum, in the registration mark's label slot */}
      <Reveal
        className="absolute top-6 right-6 md:top-7 md:right-9 font-mono text-[9px] tracking-[0.25em] text-dusty"
        delay={1.24}
        y={6}
        blur={false}
      >
        <Counter value={LOT_SEGMENTATION.total} /> LOTS DEMARCATED
      </Reveal>

      <div className="relative max-w-6xl mx-auto px-6 md:px-10 py-24 md:py-32 text-center">
        <DrawRule className="mx-auto w-14" duration={0.9} />

        <h2 className="font-display font-bold text-4xl md:text-5xl text-snow leading-tight mt-6">
          <SplitLine text="The city is already on the map." delay={0.12} step={0.055} className="pb-[0.12em]" />
        </h2>

        <Reveal delay={0.34} y={14}>
          <p className="text-sm text-mist mt-4 max-w-xl mx-auto leading-relaxed">
            The terrain is real. The first properties are registered. The Central Event Plaza is planned.
            The next foundation can begin with you.
          </p>
        </Reveal>

        <Reveal delay={0.62} y={14}>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {/* primary — the mechanism lives inside a real anchor; the accessible
                name is the sr-only copy and is never the scrambled text */}
            <a
              href="#build"
              ref={primary.ref}
              onPointerMove={primary.onPointerMove}
              onPointerEnter={decrypt.start}
              onPointerLeave={() => {
                primary.onPointerLeave()
                decrypt.stop()
              }}
              className="inline-flex items-center gap-2 px-7 py-3.5 font-mono text-sm font-bold text-void bg-lava hover:bg-lava-light"
              style={{
                ...primary.style,
                transition: `transform 0.45s ${EASE_CSS}, background-color 0.25s ease`,
              }}
            >
              <span className="sr-only">{PRIMARY_LABEL}</span>
              <span aria-hidden className="relative inline-block">
                <span className="invisible">{PRIMARY_LABEL}</span>
                <span ref={decrypt.out} className="absolute inset-0 whitespace-nowrap text-left">
                  {PRIMARY_LABEL}
                </span>
              </span>
              <ArrowRight aria-hidden className="w-4 h-4" />
            </a>

            {/* secondary — the magnetic lean, no scramble. One decrypt on the
                page's last screen, or it stops being an instrument tell. */}
            <a
              href="#deed"
              ref={secondary.ref}
              onPointerMove={secondary.onPointerMove}
              onPointerLeave={secondary.onPointerLeave}
              className="inline-flex items-center gap-2 px-7 py-3.5 font-mono text-sm text-snow border border-white/20 hover:border-white/[0.45]"
              style={{
                ...secondary.style,
                transition: `transform 0.45s ${EASE_CSS}, border-color 0.25s ease`,
              }}
            >
              Find Your Lot
            </a>
          </div>
        </Reveal>

        {/* already at rest when the section arrives — this line does not animate */}
        <div className="mt-8 font-mono text-[11px] text-dusty">
          Built by the DOG community. Connected to Bitcoin.
        </div>
      </div>
    </section>
  )
}
