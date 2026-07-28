"use client"

// ═══════════════════════════════════════════════════════════════════════════
// REAL LUNAR TERRAIN — sheet 03 of the masterplan folio: the survey certificate.
//
// The job is one sentence: "this is a real place, and they can prove it."
// The old block proved it with a reused hero frame and four 12px text cells,
// which is the one thing the visitor has already seen. So the section's single
// loud element is now the COORDINATE READOUT: 0.674°N · 23.473°E promoted out
// of its <dd> to 32px, counted up with the shared Counter, with the SAME
// position restated underneath in degrees-minutes-seconds — computed at render
// from LUNAR_SITE.latDeg / lonDeg, never typed by hand. That is evidence the
// reader can check against a lunar atlas; it is instrumentation, not decor.
//
// Two non-obvious mechanisms:
//
//  1. NO-TWITCH READOUT. A three-decimal figure ticking at 60Hz inside a 32px
//     line would shove the layout on every frame. So the *settled* string is
//     rendered underneath at visibility:hidden to own the box, and the counting
//     copy is painted absolutely over it (the encrypt-button layout trick),
//     with tabular-nums on top. The °N / °E glyphs are fixed siblings outside
//     the animated box, so they can never move.
//
//  2. THE CONTOUR UNDER-DRAWING. One 2D canvas behind the readout traces 7
//     nested closed contours outward from the site centre over ~1.8s and then
//     CANCELS ITSELF — a one-shot rAF, IntersectionObserver-gated at 200px,
//     paused offscreen, dpr-capped, ResizeObserver'd, fully torn down. Its
//     shape comes from deterministic seeded harmonics (never Math.random —
//     hydration), so it is stable across mounts.
//     HONESTY: that trace is a GENERATED SCHEMATIC of the site, never measured
//     SLDEM2015 data, and it is never captioned as such. LUNAR_SITE.creditLine
//     is rendered exactly as written — an attribution is not a design element.
//
// Everything else stays quiet: the terrain plate drifts on the page's second
// and last useParallax budget slot behind a fixed lava reticle, so the ground
// moves and the instrument does not. No hover states, no per-cell colour.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef } from "react"
import Image from "next/image"
import { MapPin } from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"
import {
  Counter, DrawRule, EASE, GRIDLINE, HAIR, HAIR_SOFT,
  Reveal, Scramble, SplitLine, Stagger, StaggerItem, useOnce, useParallax,
} from "../motion"
import { LUNAR_SITE, PHASES } from "../dogcity-data"

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
// Small, dim, and still after entrance. If it glows it is a HUD bracket and
// it is wrong. Duplicated per file on purpose: motion.tsx is frozen.
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
    <span ref={ref as never} aria-hidden className="absolute inset-0 pointer-events-none">
      {C.map((c, i) => (
        <span key={c.box} className={`absolute ${c.box}`} style={{ width: 10, height: 10 }}>
          <motion.span
            className={`absolute ${c.h} h-px w-full`}
            style={{ background: paint(i), transformOrigin: c.ox }}
            initial={reduce ? false : { scaleX: 0 }}
            animate={show ? { scaleX: 1 } : undefined}
            transition={{ duration: 0.35, delay: (delay ?? 0) + i * 0.04, ease: EASE }}
          />
          <motion.span
            className={`absolute ${c.v} w-px h-full`}
            style={{ background: paint(i), transformOrigin: c.oy }}
            initial={reduce ? false : { scaleY: 0 }}
            animate={show ? { scaleY: 1 } : undefined}
            transition={{ duration: 0.35, delay: (delay ?? 0) + i * 0.04, ease: EASE }}
          />
        </span>
      ))}
    </span>
  )
}

// ── degrees → degrees/minutes/seconds, carried properly ────────────────────
// Derived from the same LUNAR_SITE constants the decimal readout uses, so the
// two figures can never disagree. Nothing here is hardcoded.
function toDms(deg: number, hemisphere: string): string {
  const abs = Math.abs(deg)
  let d = Math.floor(abs)
  let m = Math.floor((abs - d) * 60)
  let s = Math.round(((abs - d) * 60 - m) * 60)
  if (s === 60) { s = 0; m += 1 }
  if (m === 60) { m = 0; d += 1 }
  return `${d}°${String(m).padStart(2, "0")}'${String(s).padStart(2, "0")}"${hemisphere}`
}

const toFixed3 = (v: number) => v.toFixed(3)

// ── one counting figure that cannot move the layout ────────────────────────
// The settled string owns the box (visibility:hidden); the counter paints over
// it. The hemisphere glyph lives outside the animated box entirely.
function Figure({ value, hemisphere, delay }: { value: number; hemisphere: string; delay: number }) {
  return (
    <span className="inline-flex items-baseline">
      <span className="relative inline-block">
        <span aria-hidden className="invisible tabular-nums">{toFixed3(value)}</span>
        <Counter
          value={value}
          format={toFixed3}
          duration={1.6}
          delay={delay}
          className="absolute left-0 top-0 whitespace-nowrap"
        />
      </span>
      <span className="text-lava text-lg md:text-xl ml-0.5">{hemisphere}</span>
    </span>
  )
}

// ── the contour under-drawing ──────────────────────────────────────────────
// A generated schematic of the site: 7 nested closed contours, each a circle
// perturbed by four seeded harmonics (periodic in θ, so every loop closes),
// traced outward from the centre. One rAF, ~1.8s, then it cancels itself and
// disconnects its observer — it never ticks again for the life of the page.
const RINGS = 7
const TRACE_MS = 1800
const STEPS = 132

interface Harmonic { k: number; a: number; p: number }
interface Contour { r: number; harm: Harmonic[]; delay: number }

// deterministic pseudo-random — same shape every mount, no hydration flicker
function seeded(i: number): number {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

function ContourField() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const host = cv.parentElement
    const ctx = cv.getContext("2d")
    if (!host || !ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    let w = 0
    let h = 0
    let cx = 0
    let cy = 0
    let contours: Contour[] = []
    let elapsed = reduce ? TRACE_MS : 0
    let last = 0
    let raf = 0
    let done = reduce

    const build = () => {
      // Size from the CONSTRAINING edge, not the larger one. `Math.max(w,h)`
      // gave a 174px radius inside a 310x199 cell on a phone: the field spilled
      // 93px past the right edge and only 2 of the 7 rings closed. The other
      // five terminated on the cell border, and `overflow-hidden` rendered
      // those terminations as straight vertical lines flush with the edges —
      // which is exactly the "bare rectangular box" that was reported. On a
      // wide desktop cell the old maths happened to look right, so it shipped.
      // The 0.6 below is the ellipse's vertical squash factor.
      const narrow = w < 420
      cx = w * (narrow ? 0.6 : 0.74)
      cy = h * (narrow ? 0.5 : 0.42)
      const maxR = Math.min(w * (1 - (narrow ? 0.6 : 0.74)), (h * 0.5) / 0.6) * 0.92
      contours = []
      for (let i = 0; i < RINGS; i++) {
        const harm: Harmonic[] = []
        for (let k = 2; k <= 5; k++) {
          harm.push({ k, a: seeded(i * 7 + k) - 0.5, p: seeded(i * 13 + k * 3) * Math.PI * 2 })
        }
        contours.push({
          r: maxR * (0.14 + 0.86 * ((i + 1) / RINGS)),
          harm,
          delay: (i / RINGS) * 0.55,
        })
      }
    }

    const radiusAt = (c: Contour, t: number) => {
      let wob = 0
      for (const x of c.harm) wob += (x.a * Math.sin(x.k * t + x.p)) / x.k
      return c.r * (1 + 0.13 * wob)
    }

    const render = (p: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      ctx.lineWidth = 1
      ctx.strokeStyle = "rgba(240,240,242,0.55)"
      for (const c of contours) {
        const frac = Math.max(0, Math.min(1, (p - c.delay) / 0.45))
        if (frac <= 0) continue
        const upto = Math.max(2, Math.round(STEPS * frac))
        ctx.beginPath()
        for (let i = 0; i <= upto; i++) {
          const t = (i / STEPS) * Math.PI * 2
          const r = radiusAt(c, t)
          const x = cx + Math.cos(t) * r
          const y = cy + Math.sin(t) * r * 0.6
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        if (frac >= 1) ctx.closePath()
        ctx.stroke()
      }
    }

    const resize = () => {
      const rect = host.getBoundingClientRect()
      const nw = Math.max(1, Math.round(rect.width))
      const nh = Math.max(1, Math.round(rect.height))
      if (nw === w && nh === h) return
      w = nw
      h = nh
      cv.width = Math.round(w * dpr)
      cv.height = Math.round(h * dpr)
      build()
      render(Math.min(1, elapsed / TRACE_MS))
    }

    const tick = (ts: number) => {
      if (!last) last = ts
      elapsed += Math.min(64, ts - last)
      last = ts
      const p = Math.min(1, elapsed / TRACE_MS)
      render(p)
      if (p >= 1) {
        done = true
        cancelAnimationFrame(raf)
        raf = 0
        io.disconnect()
        return
      }
      raf = requestAnimationFrame(tick)
    }

    const io = new IntersectionObserver(
      (entries) => {
        const on = entries[0]?.isIntersecting ?? false
        if (done) { io.disconnect(); return }
        if (on) {
          if (!raf) { last = 0; raf = requestAnimationFrame(tick) }
        } else if (raf) {
          cancelAnimationFrame(raf)
          raf = 0
        }
      },
      { rootMargin: "200px" },
    )

    const ro = new ResizeObserver(resize)
    resize()
    ro.observe(host)
    if (reduce) render(1)
    else io.observe(cv)

    return () => {
      if (raf) cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.28 }}
    />
  )
}

// ═══ the sheet ═════════════════════════════════════════════════════════════
export default function Section({}) {
  const { ref: plateRef, y } = useParallax(40)

  const coords = `${LUNAR_SITE.latDeg}°N · ${LUNAR_SITE.lonDeg}°E`

  return (
    <section className={`border-t ${HAIR_SOFT}`}>
      <div className="max-w-6xl mx-auto px-6 md:px-10 py-20 md:py-28">
        <div className="grid md:grid-cols-2 gap-10 items-center">

          {/* ── the certificate ───────────────────────────────────────────── */}
          <div>
            <SectionHead
              eyebrow="REAL LUNAR TERRAIN"
              title="A real place on the Moon."
              sub="DogCity is not built over a generic backdrop. The city uses mapped elevation data, so roads, lots and landmarks respond to real terrain."
            />

            <div className={`relative mt-8 border ${HAIR}`}>
              <Corners delay={0.5} />
              <Stagger
                as="dl"
                delay={0.62}
                step={0.075}
                className={`grid grid-cols-2 gap-px ${GRIDLINE} font-mono`}
              >
                {/* the readout — the section's one loud element */}
                <StaggerItem className="col-span-2 relative overflow-hidden bg-void p-5 md:p-6">
                  <ContourField />
                  <div className="relative">
                    <dt className="text-[9px] tracking-[0.25em] text-dusty">COORDINATES</dt>
                    <dd
                      // wraps instead of clipping: the full readout is ~276px and
                      // the cell is ~206px on a phone, which sliced the "°E"
                      className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 md:gap-x-3 text-2xl sm:text-3xl md:text-4xl text-snow tabular-nums leading-none"
                      aria-label={coords}
                    >
                      <Figure value={LUNAR_SITE.latDeg} hemisphere="&deg;N" delay={0.7} />
                      <span aria-hidden className="text-dusty text-xl">&middot;</span>
                      <Figure value={LUNAR_SITE.lonDeg} hemisphere="&deg;E" delay={0.8} />
                    </dd>
                    <div className="mt-2 text-[10px] text-dusty tabular-nums">
                      {toDms(LUNAR_SITE.latDeg, "N")} &middot; {toDms(LUNAR_SITE.lonDeg, "E")}
                    </div>
                    <div className="mt-4 text-[9px] tracking-[0.25em] text-dusty">
                      SITE SECTION &middot; {LUNAR_SITE.siteRadiusM.toLocaleString()} M RADIUS &middot; V.E.{" "}
                      {LUNAR_SITE.verticalExaggeration}
                    </div>
                  </div>
                </StaggerItem>

                <StaggerItem className="bg-void p-4">
                  <dt className="text-[9px] tracking-[0.25em] text-dusty">SITE</dt>
                  <dd className="text-[12px] text-snow mt-1">{LUNAR_SITE.name}</dd>
                </StaggerItem>

                <StaggerItem className="bg-void p-4">
                  <dt className="text-[9px] tracking-[0.25em] text-dusty">VERTICAL SCALE</dt>
                  <dd className="text-[12px] text-snow mt-1 tabular-nums">
                    {LUNAR_SITE.verticalExaggeration} exaggeration
                  </dd>
                </StaggerItem>

                <StaggerItem className="col-span-2 bg-void p-4">
                  <dt className="text-[9px] tracking-[0.25em] text-dusty">ELEVATION DATA</dt>
                  <dd className="text-[12px] text-snow mt-1">{LUNAR_SITE.demSource}</dd>
                </StaggerItem>
              </Stagger>
            </div>

            {/* attribution — rendered exactly as written, never a design element */}
            <Reveal delay={0.86} y={10}>
              <p className="mt-4 font-mono text-[10px] text-dusty">{LUNAR_SITE.creditLine}</p>
            </Reveal>
          </div>

          {/* ── the surveyed site ─────────────────────────────────────────── */}
          <Reveal delay={0.18} y={16}>
            <div ref={plateRef} className={`relative aspect-[16/10] overflow-hidden border ${HAIR}`}>
              {/* the ground drifts; the instrument glass over it does not */}
              <motion.div className="absolute inset-x-0" style={{ y, top: "-12%", bottom: "-12%" }}>
                <Image
                  src={PHASES[0].image}
                  alt={PHASES[0].alt}
                  fill
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="object-cover"
                />
              </motion.div>

              {/* site-radius reticle — our own instrument overlay, no scale claimed */}
              <div aria-hidden className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-[40%] aspect-square relative">
                  <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
                    <circle cx="50" cy="50" r="46" fill="none" stroke="#F56E0F" strokeOpacity="0.4" strokeWidth="0.5" />
                    <circle cx="50" cy="50" r="1.3" fill="#F56E0F" fillOpacity="0.85" />
                    <path
                      d="M50 28 V42 M50 58 V72 M28 50 H42 M58 50 H72"
                      stroke="#F56E0F"
                      strokeOpacity="0.3"
                      strokeWidth="0.5"
                    />
                  </svg>
                </div>
              </div>

              <Corners delay={0.5} />

              <div className="absolute bottom-3 left-3 font-mono text-[9px] tracking-[0.2em] text-snow/70 bg-void/60 px-2 py-1">
                <MapPin className="w-3 h-3 inline mr-1 text-lava" />
                MARE TRANQUILLITATIS &middot; SURVEYED SITE
              </div>
            </div>
          </Reveal>

        </div>
      </div>
    </section>
  )
}
