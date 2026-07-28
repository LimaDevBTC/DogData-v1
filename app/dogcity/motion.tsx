"use client"

// ═══════════════════════════════════════════════════════════════════════════
// DogCity landing — the shared motion vocabulary.
//
// Every section below the hero draws from this file so the page reads as one
// instrument instead of nine unrelated widgets. The rules encoded here:
//
//   · one easing curve for the whole page (the same one globals.css uses)
//   · reveals fire ONCE, on enter, and never replay on scroll-back
//   · every primitive collapses to its finished state under reduced motion
//   · anything that ticks per frame writes to the DOM directly, never through
//     React state — the hero is already streaming 180 webp frames and the
//     below-fold budget is tight
//
// Tailwind note: this project's opacity scale is the stock one (multiples of
// 5). `border-white/8` and `border-white/12` DO NOT COMPILE — they fall through
// to preflight's #D1D5DB and paint light-grey hairlines on a black page. Use
// the HAIR* constants below rather than hand-writing border opacities.
// ═══════════════════════════════════════════════════════════════════════════

import {
  createElement, useEffect, useRef, useState, useCallback,
  type ReactNode, type CSSProperties, type ElementType,
} from "react"
import {
  motion, animate, useInView, useReducedMotion,
  useMotionValue, useMotionValueEvent, type MotionValue,
} from "framer-motion"

// ── the page's single easing curve + timing scale ──────────────────────────
export const EASE = [0.16, 1, 0.3, 1] as const   // matches globals.css
export const EASE_CSS = "cubic-bezier(0.16, 1, 0.3, 1)"
export const DUR = { fast: 0.4, base: 0.7, slow: 1.1 } as const

// ── hairline constants (see the Tailwind note above) ───────────────────────
export const HAIR = "border-white/10"             // standard cell/card border
export const HAIR_SOFT = "border-white/[0.06]"    // section seams
export const HAIR_STRONG = "border-white/25"      // hover / active
export const GRIDLINE = "bg-white/10"             // gap-px grid backdrop

// ── viewport gate: fires once, slightly before the element is fully in ─────
export function useOnce(margin = "-12% 0px -12% 0px") {
  const ref = useRef<HTMLDivElement>(null)
  // framer types `margin` as a template-literal union; ours is valid at runtime
  const inView = useInView(ref, { once: true, margin: margin as never })
  return { ref, inView }
}

// ═══ Reveal ════════════════════════════════════════════════════════════════
// The page's default entrance: rise + fade + a hair of blur coming off.
// Blur is what separates a "fade in" from something that feels focused-into.
export function Reveal({
  children, delay = 0, y = 18, blur = true, className, as = "div",
}: {
  children: ReactNode
  delay?: number
  y?: number
  blur?: boolean
  className?: string
  as?: "div" | "section" | "li" | "span"
}) {
  const reduce = useReducedMotion()
  const { ref, inView } = useOnce()
  const M = motion[as] as typeof motion.div

  // the fallback must keep the caller's element — an <li> that degrades to a
  // <div> is invalid inside <ol>/<ul>, which is exactly where reveals get used
  if (reduce) return createElement(as as ElementType, { className }, children)

  return (
    <M
      ref={ref as never}
      className={className}
      initial={{ opacity: 0, y, filter: blur ? "blur(6px)" : "none" }}
      animate={inView ? { opacity: 1, y: 0, filter: "blur(0px)" } : undefined}
      transition={{ duration: DUR.base, delay, ease: EASE }}
    >
      {children}
    </M>
  )
}

// ═══ Stagger ═══════════════════════════════════════════════════════════════
// Grids and lists enter as a wave, not a block. Wrap the container in
// <Stagger> and each cell in <StaggerItem>.
export function Stagger({
  children, className, step = 0.075, delay = 0, style, as = "div",
}: {
  children: ReactNode
  className?: string
  step?: number
  delay?: number
  style?: CSSProperties
  as?: "div" | "ul" | "ol" | "dl"
}) {
  const reduce = useReducedMotion()
  const { ref, inView } = useOnce()
  const M = motion[as] as typeof motion.div

  if (reduce) return createElement(as as ElementType, { className, style }, children)

  return (
    <M
      ref={ref}
      className={className}
      style={style}
      initial="hidden"
      animate={inView ? "shown" : "hidden"}
      variants={{ shown: { transition: { staggerChildren: step, delayChildren: delay } } }}
    >
      {children}
    </M>
  )
}

export const staggerItem = {
  hidden: { opacity: 0, y: 16, filter: "blur(5px)" },
  shown: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: DUR.base, ease: EASE } },
}

export function StaggerItem({
  children, className, style, as = "div",
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
  as?: "div" | "li"
}) {
  const reduce = useReducedMotion()
  const M = motion[as] as typeof motion.div
  if (reduce) return createElement(as as ElementType, { className, style }, children)
  return <M className={className} style={style} variants={staggerItem}>{children}</M>
}

// ═══ SplitLine ═════════════════════════════════════════════════════════════
// Per-word mask reveal for headlines — words rise out from behind a clean
// edge rather than fading in place. This is the single biggest "why does this
// feel expensive" upgrade available to a text-heavy page, and it costs one
// wrapper span per word.
export function SplitLine({
  text, className, delay = 0, step = 0.055, once = true,
}: {
  text: string
  className?: string
  delay?: number
  step?: number
  once?: boolean
}) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once, margin: "-10% 0px" as never })
  const words = text.split(" ")

  if (reduce) return <span className={className}>{text}</span>

  return (
    <span ref={ref} className={className} aria-label={text}>
      {words.map((w, i) => (
        <span key={`${w}-${i}`} aria-hidden className="inline-block overflow-hidden align-bottom">
          <motion.span
            className="inline-block will-change-transform"
            initial={{ y: "108%" }}
            animate={inView ? { y: "0%" } : undefined}
            transition={{ duration: 0.85, delay: delay + i * step, ease: EASE }}
          >
            {w}
            {i < words.length - 1 ? " " : ""}
          </motion.span>
        </span>
      ))}
    </span>
  )
}

// ═══ Scramble ══════════════════════════════════════════════════════════════
// Mono eyebrows resolve out of glyph noise — the surveyor's-instrument tell.
// Writes straight to textContent; no React state per frame.
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/\\#*·+="

export function Scramble({
  text, className, speed = 34,
}: { text: string; className?: string; speed?: number }) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLSpanElement>(null)
  const { ref: gate, inView } = useOnce("-5% 0px")

  useEffect(() => {
    if (reduce || !inView) return
    const el = ref.current
    if (!el) return
    let frame = 0
    let raf = 0
    let last = 0
    const total = text.length * 3 + 12

    const tick = (t: number) => {
      if (t - last >= speed) {
        last = t
        const settled = Math.floor(frame / 3)
        el.textContent = text
          .split("")
          .map((ch, i) => {
            if (ch === " ") return " "
            if (i < settled) return ch
            return GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
          })
          .join("")
        frame++
      }
      if (frame <= total) raf = requestAnimationFrame(tick)
      else el.textContent = text
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, reduce, text, speed])

  // renders settled by default so SSR, reduced motion and no-JS all read
  // correctly and nothing shifts; the effect scrambles it only once, on enter
  return (
    <span ref={gate as never} className={className}>
      <span ref={ref} aria-label={text}>{text}</span>
    </span>
  )
}

// ═══ Counter ═══════════════════════════════════════════════════════════════
// Numbers count up once, on enter, written directly to the DOM node so a
// 60fps tick never re-renders React. Always pair with `tabular-nums`.
export function Counter({
  value, format = (v: number) => Math.round(v).toLocaleString(),
  className, duration = 1.6, delay = 0,
}: {
  value: number | null | undefined
  format?: (v: number) => string
  className?: string
  duration?: number
  delay?: number
}) {
  const reduce = useReducedMotion()
  const out = useRef<HTMLSpanElement>(null)
  const { ref: gate, inView } = useOnce("-5% 0px")
  const mv = useMotionValue(0)
  const started = useRef(false)

  useMotionValueEvent(mv, "change", (v) => {
    if (out.current) out.current.textContent = format(v)
  })

  useEffect(() => {
    if (value === null || value === undefined) return
    if (reduce) {
      if (out.current) out.current.textContent = format(value)
      return
    }
    if (!inView) return
    // a value that arrives after the first run (live API) re-targets smoothly
    const from = started.current ? mv.get() : 0
    started.current = true
    mv.set(from)
    const controls = animate(mv, value, { duration, delay, ease: EASE })
    return () => controls.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, value, reduce])

  return (
    <span ref={gate as never} className={className}>
      <span ref={out} className="tabular-nums">
        {value === null || value === undefined ? "—" : reduce ? format(value) : format(0)}
      </span>
    </span>
  )
}

// ═══ DrawRule ══════════════════════════════════════════════════════════════
// The hairline that draws itself left-to-right. Used as a section seam and
// under eyebrows — it reads as a drafting line being struck.
export function DrawRule({
  className = "", delay = 0, duration = 1.0, color = "bg-lava",
}: { className?: string; delay?: number; duration?: number; color?: string }) {
  const reduce = useReducedMotion()
  const { ref, inView } = useOnce("-5% 0px")
  if (reduce) return <span className={`block h-px ${color} ${className}`} />
  return (
    <motion.span
      ref={ref as never}
      className={`block h-px origin-left ${color} ${className}`}
      initial={{ scaleX: 0 }}
      animate={inView ? { scaleX: 1 } : undefined}
      transition={{ duration, delay, ease: EASE }}
    />
  )
}

// ═══ Parallax ══════════════════════════════════════════════════════════════
// Scroll-linked drift for imagery. `distance` is in px across the element's
// full pass through the viewport; keep it small (24–80) or it reads as a gimmick.
//
// Deliberately NOT built on framer-motion's `useScroll({ target })`. Two
// reasons, both learned the hard way in this repo:
//   1. `useScroll({ target })` has frozen silently on this page before — it
//      resolves its target against a scroll container, and this page's hero
//      lives in a body-level portal with `overflow-x: clip` overrides, so the
//      container it finds is not always the one that scrolls.
//   2. The audit's perf rule: N independent `useScroll` instances each measure
//      and tick on their own. There are already three window scroll listeners
//      on this page and only one is rAF-coalesced.
// So every consumer shares ONE rAF-coalesced listener, registered on the first
// subscriber and torn down with the last, using the same
// getBoundingClientRect maths the hero's scrubber uses.
type ParallaxSub = { el: HTMLElement; distance: number; mv: MotionValue<number> }

const subs = new Set<ParallaxSub>()
let raf = 0
let listening = false

function measure() {
  raf = 0
  const vh = window.innerHeight || 1
  subs.forEach((s) => {
    const r = s.el.getBoundingClientRect()
    // 0 when the element's top touches the viewport bottom,
    // 1 when its bottom leaves the viewport top
    const p = Math.max(0, Math.min(1, (vh - r.top) / (vh + r.height)))
    s.mv.set(s.distance * (1 - 2 * p))
  })
}

function schedule() {
  if (!raf) raf = requestAnimationFrame(measure)
}

function subscribe(sub: ParallaxSub) {
  subs.add(sub)
  if (!listening) {
    listening = true
    window.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule)
  }
  schedule()
  return () => {
    subs.delete(sub)
    if (subs.size === 0 && listening) {
      listening = false
      window.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", schedule)
      if (raf) { cancelAnimationFrame(raf); raf = 0 }
    }
  }
}

export function useParallax(distance = 48): {
  ref: React.RefObject<HTMLDivElement>
  y: MotionValue<number>
} {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const y = useMotionValue(0)

  useEffect(() => {
    const el = ref.current
    if (!el || reduce) return          // reduced motion: the value stays pinned at 0
    return subscribe({ el, distance, mv: y })
  }, [distance, reduce, y])

  return { ref, y }
}

// ═══ Spotlight ═════════════════════════════════════════════════════════════
// Feeds --mx/--my to the `.spotlight-card` rule that already lives in
// globals.css. Pointer-only: no listeners are attached on touch.
export function useSpotlight<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null)
  const onPointerMove = useCallback((e: React.PointerEvent<T>) => {
    if (e.pointerType !== "mouse") return
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty("--mx", `${e.clientX - r.left}px`)
    el.style.setProperty("--my", `${e.clientY - r.top}px`)
  }, [])
  return { ref, onPointerMove }
}

// ═══ Magnetic ══════════════════════════════════════════════════════════════
// Buttons lean toward the cursor. Subtle (max ~6px) — the tell is that it
// feels alive on approach, not that it visibly moves.
export function useMagnetic<T extends HTMLElement = HTMLAnchorElement>(strength = 0.28, max = 7) {
  const ref = useRef<T>(null)
  const reduce = useReducedMotion()

  const onPointerMove = useCallback((e: React.PointerEvent<T>) => {
    if (reduce || e.pointerType !== "mouse") return
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const dx = e.clientX - (r.left + r.width / 2)
    const dy = e.clientY - (r.top + r.height / 2)
    const cx = Math.max(-max, Math.min(max, dx * strength))
    const cy = Math.max(-max, Math.min(max, dy * strength))
    el.style.transform = `translate3d(${cx}px, ${cy}px, 0)`
  }, [reduce, strength, max])

  const onPointerLeave = useCallback(() => {
    const el = ref.current
    if (el) el.style.transform = "translate3d(0,0,0)"
  }, [])

  return { ref, onPointerMove, onPointerLeave, style: { transition: `transform 0.45s ${EASE_CSS}` } as CSSProperties }
}

// ═══ useClientMounted ══════════════════════════════════════════════════════
// Guard for anything that must not render during SSR (canvas, WebGL, portals).
export function useClientMounted() {
  const [m, setM] = useState(false)
  useEffect(() => setM(true), [])
  return m
}
