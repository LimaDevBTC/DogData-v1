"use client"

// ═══════════════════════════════════════════════════════════════════════════
// #build — LIVE CONSTRUCTION FUND. The registry reporting on itself.
//
// One narrative beat: a structure is SURVEYED, then FILLED. The fund is not a
// bar with a label on it — the bar IS the number. A graduated surveyor's staff
// is struck left→right (a void curtain retracting from the right edge, 0→1.0s),
// and while it is still being drawn the fill starts travelling (0.55→1.65s).
// The percentage readout rides on the head of the fill and stops on the exact
// same frame the head does, because both are written by ONE motion value.
//
// THE SURVEY RAIL — the span's shared device, first appearance:
//   track      1px hairline (HAIR)
//   graduation two repeating-linear-gradients painted as background-image.
//              ZERO DOM nodes, ZERO JS per frame. The passed region carries the
//              warm graduations (they live on the fill layer, which is static
//              and full-width); the region ahead carries the dusty ones.
//   head       the 1px lava column + the status glyph (§ StatusGlyph)
//   readout    tabular-nums percentage pinned above the head
//   legend     0 · 25 · 50 · 75 · 100 under the graduations
//
// MECHANISM NOTES (non-obvious, read before editing):
//  · Nothing here animates width/height/margin. The hero portal runs a
//    ResizeObserver on document.body; a layout mutation below the fold forces a
//    full re-measure and re-registers its scroll listeners. Transforms only.
//  · The fill layer NEVER scales — scaling it would squash its graduation
//    gradients. Instead an opaque `bg-void` SHROUD anchored to the right edge
//    scales from 1 → 1−fraction and uncovers the fill. Same for the draw
//    curtain (scaleX 1 → 0, origin-right) which reveals the rail left→right.
//  · The head/readout translate in px, so the rail width is measured once by a
//    ResizeObserver into a ref (never state) and re-applied on resize.
//  · Every per-frame value is written straight to the DOM (style.transform /
//    textContent). No React state ticks in this file.
//  · Counting strings change length (0 → 1.2K → 4.18M) and twitch even with
//    tabular-nums, so every live number uses the encrypt-button layout trick:
//    the settled string sits in flow at `visibility:hidden` and the counting
//    copy is painted absolutely on top. Zero layout twitch.
//  · ONE rAF loop in the whole SURVEY span, and it belongs to the LED ticker
//    below. IntersectionObserver-gated, cancelled offscreen, one still frame
//    under reduced motion.
//
// Tailwind: this project's opacity scale is the stock one. `border-white/8`,
// `/12`, `bg-white/15` do not compile — they fall through to preflight's
// #D1D5DB and paint light-grey hairlines on black. Use HAIR/GRIDLINE or
// bracket syntax.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Check, Copy, Wallet } from "lucide-react"
import { useDonate } from "@/components/donate/donate-modal"
import {
  AnimatePresence, animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion,
} from "framer-motion"
import {
  Counter, DrawRule, DUR, EASE, GRIDLINE, HAIR, HAIR_SOFT,
  Reveal, Scramble, SplitLine, Stagger, StaggerItem, useOnce, useSpotlight,
} from "../motion"
import { DONATION_GOAL, DONATION_METHODS, DONATION_WALLET, formatDog, shortAddr } from "../dogcity-data"
import { track } from "@/lib/analytics/client"
import type { LeaderboardData, RecentEntry } from "../types"

// ── the rail's painted graduations ─────────────────────────────────────────
// major every 60px full height, minor every 12px across the bottom 42%.
const rulerBg = (major: string, minor: string) => ({
  backgroundImage:
    `repeating-linear-gradient(90deg, ${major} 0 1px, transparent 1px 60px),` +
    `repeating-linear-gradient(90deg, ${minor} 0 1px, transparent 1px 12px)`,
  backgroundSize: "100% 100%, 100% 42%",
  backgroundPosition: "0 0, 0 100%",
  backgroundRepeat: "no-repeat, no-repeat",
})

const AHEAD_BG = rulerBg("rgba(240,240,242,0.22)", "rgba(240,240,242,0.10)")
const PASSED_BG = {
  ...rulerBg("rgba(255,242,228,0.55)", "rgba(255,242,228,0.26)"),
  backgroundImage:
    rulerBg("rgba(255,242,228,0.55)", "rgba(255,242,228,0.26)").backgroundImage +
    ",linear-gradient(90deg,#D45D0D 0%,#F56E0F 62%,#FFAD42 100%)",
  backgroundSize: "100% 100%, 100% 42%, 100% 100%",
  backgroundPosition: "0 0, 0 100%, 0 0",
  backgroundRepeat: "no-repeat, no-repeat, no-repeat",
}

// ═══ StatusGlyph ═══════════════════════════════════════════════════════════
// The span's only "live" signal — a 5px square with an expanding ring. A radar
// return, not a heartbeat. filled+ringing = live today · hollow amber =
// planned · hollow grey = dead channel. The filled/hollow distinction is
// legally load-bearing; do not restyle it into a generic pulse.
type GlyphState = "live" | "planned" | "dead"

function StatusGlyph({ state, className = "" }: { state: GlyphState; className?: string }) {
  const reduce = useReducedMotion()
  const core =
    state === "live"
      ? { background: "#F56E0F" }
      : state === "planned"
        ? { border: "1px solid #FFAD42" }
        : { border: "1px solid rgba(240,240,242,0.25)" }
  return (
    <span aria-hidden className={`relative inline-block h-[5px] w-[5px] shrink-0 ${className}`}>
      <span className="absolute inset-0" style={core} />
      {state === "live" && !reduce && (
        <span className="sv-ring absolute inset-0" style={{ boxShadow: "0 0 0 1px rgba(245,110,15,0.6)" }} />
      )}
    </span>
  )
}

// ═══ Steady ════════════════════════════════════════════════════════════════
// encrypt-button layout trick: the settled string reserves the width in flow at
// visibility:hidden, the live copy is painted absolutely over it. `valueRef`
// has no React children, so per-frame textContent writes are never clobbered
// by a re-render when the API value lands.
function Steady({
  ghost, valueRef, className = "",
}: { ghost: string; valueRef: React.RefObject<HTMLSpanElement>; className?: string }) {
  return (
    <span className={`relative inline-block align-baseline ${className}`}>
      <span className="sr-only">{ghost}</span>
      <span aria-hidden className="invisible tabular-nums">{ghost}</span>
      <span aria-hidden ref={valueRef} className="absolute left-0 top-0 whitespace-nowrap tabular-nums" />
    </span>
  )
}

// same trick, but the counting is done by the shared <Counter/> primitive
function SteadyCounter({
  value, ghost, format, className = "",
}: {
  value: number | null | undefined
  ghost: string
  format: (v: number) => string
  className?: string
}) {
  return (
    <span className={`relative inline-block ${className}`}>
      <span aria-hidden className="invisible tabular-nums">{ghost}</span>
      <span className="absolute left-0 top-0 whitespace-nowrap">
        <Counter value={value} format={format} duration={1.4} delay={0.15} />
      </span>
    </span>
  )
}

// ═══ LED ticker ════════════════════════════════════════════════════════════
// The pixel-led-display mechanism, reimplemented at a tenth of the size: a 5×7
// glyph table authored as row strings and bit-packed at module load, flattened
// into one endless strip of column bitmasks, drawn in three passes (all dots
// off · a `lighter` bloom pass on the lit dots · the lit dots solid). Flicker is
// deterministic and biased low via v*v, so the board sits bright and dips hard
// instead of throbbing evenly. Square dots — round dots read retro-arcade.
//
// ⚠ This is THE one requestAnimationFrame loop in the SURVEY span. It is
// IO-gated, cancelled offscreen and draws exactly one still frame under
// reduced motion. Do not add a second.
// ⚠ The table is caps-only. Never feed it data where casing is meaningful.
const ROWS = 7
const CELL = 3
const DOT = 2
const SPEED = 26 // px per second

const GLYPH_ROWS: Record<string, string> = {
  "0": "01110/10001/10011/10101/11001/10001/01110",
  "1": "00100/01100/00100/00100/00100/00100/01110",
  "2": "01110/10001/00001/00010/00100/01000/11111",
  "3": "11111/00010/00100/00010/00001/10001/01110",
  "4": "00010/00110/01010/10010/11111/00010/00010",
  "5": "11111/10000/11110/00001/00001/10001/01110",
  "6": "00110/01000/10000/11110/10001/10001/01110",
  "7": "11111/00001/00010/00100/01000/01000/01000",
  "8": "01110/10001/10001/01110/10001/10001/01110",
  "9": "01110/10001/10001/01111/00001/00010/01100",
  A: "01110/10001/10001/11111/10001/10001/10001",
  B: "11110/10001/10001/11110/10001/10001/11110",
  C: "01110/10001/10000/10000/10000/10001/01110",
  D: "11100/10010/10001/10001/10001/10010/11100",
  E: "11111/10000/10000/11110/10000/10000/11111",
  F: "11111/10000/10000/11110/10000/10000/10000",
  G: "01110/10001/10000/10111/10001/10001/01111",
  H: "10001/10001/10001/11111/10001/10001/10001",
  I: "01110/00100/00100/00100/00100/00100/01110",
  J: "00111/00010/00010/00010/00010/10010/01100",
  K: "10001/10010/10100/11000/10100/10010/10001",
  L: "10000/10000/10000/10000/10000/10000/11111",
  M: "10001/11011/10101/10101/10001/10001/10001",
  N: "10001/10001/11001/10101/10011/10001/10001",
  O: "01110/10001/10001/10001/10001/10001/01110",
  P: "11110/10001/10001/11110/10000/10000/10000",
  Q: "01110/10001/10001/10001/10101/10010/01101",
  R: "11110/10001/10001/11110/10100/10010/10001",
  S: "01111/10000/10000/01110/00001/00001/11110",
  T: "11111/00100/00100/00100/00100/00100/00100",
  U: "10001/10001/10001/10001/10001/10001/01110",
  V: "10001/10001/10001/10001/10001/01010/00100",
  W: "10001/10001/10001/10101/10101/11011/10001",
  X: "10001/10001/01010/00100/01010/10001/10001",
  Y: "10001/10001/01010/00100/00100/00100/00100",
  Z: "11111/00001/00010/00100/01000/10000/11111",
  ".": "00000/00000/00000/00000/00000/01100/01100",
  ",": "00000/00000/00000/00000/01100/01100/11000",
  "%": "11001/11010/00010/00100/01000/01011/10011",
  "-": "00000/00000/00000/11111/00000/00000/00000",
  "·": "00000/00000/00000/01100/01100/00000/00000",
  "●": "00000/01110/11111/11111/11111/01110/00000",
}

const FONT: Map<string, number[]> = (() => {
  const m = new Map<string, number[]>()
  for (const ch of Object.keys(GLYPH_ROWS)) {
    const rows = GLYPH_ROWS[ch].split("/")
    const cols: number[] = []
    for (let c = 0; c < 5; c++) {
      let mask = 0
      for (let r = 0; r < ROWS; r++) if (rows[r][c] === "1") mask |= 1 << r
      cols.push(mask)
    }
    m.set(ch, cols)
  }
  return m
})()

function buildColumns(text: string): number[] {
  const out: number[] = []
  for (const raw of text.toUpperCase()) {
    if (raw === " ") { out.push(0, 0, 0); continue }
    const g = FONT.get(raw)
    if (!g) { out.push(0, 0, 0); continue }
    for (const c of g) out.push(c)
    out.push(0)
  }
  return out
}

function LedStrip({ text }: { text: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const ctx = cv.getContext("2d")
    if (!ctx) return

    const cols = buildColumns(text)
    const total = cols.length
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let W = 1, H = 1, raf = 0, offset = 0, last = 0
    let visible = false

    const draw = (time: number) => {
      ctx.clearRect(0, 0, W, H)
      if (total === 0) return
      const top = Math.max(0, Math.round((H - ROWS * CELL) / 2))
      const sub = offset % CELL
      const base = Math.floor(offset / CELL)
      const nx = Math.ceil(W / CELL) + 2
      // deterministic flicker, biased low: bright board, occasional hard dip
      const n = Math.sin(time * 0.0021) * 0.5 + 0.5
      const lit = 0.78 + 0.22 * (1 - n * n)

      ctx.save()
      ctx.translate(-sub, top)

      ctx.fillStyle = "rgba(245,110,15,0.06)"
      for (let x = 0; x < nx; x++) {
        for (let r = 0; r < ROWS; r++) ctx.fillRect(x * CELL, r * CELL, DOT, DOT)
      }

      ctx.globalCompositeOperation = "lighter"
      ctx.fillStyle = "#F56E0F"
      ctx.globalAlpha = 0.15 * lit
      for (let x = 0; x < nx; x++) {
        const c = cols[((base + x) % total + total) % total]
        if (!c) continue
        for (let r = 0; r < ROWS; r++) if ((c >> r) & 1) ctx.fillRect(x * CELL - 1, r * CELL - 1, DOT + 2, DOT + 2)
      }
      ctx.globalAlpha = lit
      for (let x = 0; x < nx; x++) {
        const c = cols[((base + x) % total + total) % total]
        if (!c) continue
        for (let r = 0; r < ROWS; r++) if ((c >> r) & 1) ctx.fillRect(x * CELL, r * CELL, DOT, DOT)
      }

      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = "source-over"
      ctx.restore()
    }

    const resize = () => {
      const r = cv.getBoundingClientRect()
      W = Math.max(1, Math.round(r.width))
      H = Math.max(1, Math.round(r.height))
      cv.width = Math.round(W * dpr)
      cv.height = Math.round(H * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      draw(last)
    }

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame)
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0
      last = t
      if (!visible) return
      offset += SPEED * dt
      if (offset > total * CELL) offset -= total * CELL
      draw(t)
    }

    resize()
    if (reduce) {
      draw(0) // one still frame, offset 0 — never starts the loop
    } else {
      raf = requestAnimationFrame(frame)
    }

    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting }, { threshold: 0.01 })
    io.observe(cv)
    const ro = new ResizeObserver(resize)
    ro.observe(cv)

    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
    }
  }, [text, reduce])

  return (
    <div className={`relative h-7 overflow-hidden border-y ${HAIR_SOFT} bg-lava/[0.03]`}>
      <canvas ref={ref} className="block h-full w-full" aria-hidden />
      <span className="sr-only">{text}</span>
      <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-void to-transparent" />
      <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-void to-transparent" />
    </div>
  )
}

// ═══ address typography ════════════════════════════════════════════════════
// first four and last four in lava — the checksum-eyeball every crypto user
// actually performs. Makes the string read as an artifact, not a blob.
function AddressGlyphs({ addr }: { addr: string }) {
  if (addr.length <= 8) return <span className="text-snow">{addr}</span>
  return (
    <>
      <span className="text-lava">{addr.slice(0, 4)}</span>
      <span className="text-snow">{addr.slice(4, -4)}</span>
      <span className="text-lava">{addr.slice(-4)}</span>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════

export default function Section({ lb }: { lb: LeaderboardData | null }) {
  const reduce = useReducedMotion()

  const raised = lb?.total_received ?? null
  const pct = lb ? Math.min(100, lb.progress_pct) : 0

  // ── the rail: one motion value drives head, shroud, readout and captions ──
  const { ref: railGate, inView } = useOnce()
  const t = useMotionValue(0)
  const railRef = useRef<HTMLDivElement>(null)
  const railWRef = useRef(0)
  const shroudRef = useRef<HTMLDivElement>(null)
  const headRef = useRef<HTMLDivElement>(null)
  const readoutRef = useRef<HTMLDivElement>(null)
  const pctHeadRef = useRef<HTMLSpanElement>(null)
  const pctCapRef = useRef<HTMLSpanElement>(null)
  const raisedRef = useRef<HTMLSpanElement>(null)

  const apply = useCallback((v: number) => {
    const w = railWRef.current
    const frac = pct / 100
    const x = v * frac * w
    if (shroudRef.current) shroudRef.current.style.transform = `scaleX(${1 - v * frac})`
    if (headRef.current) headRef.current.style.transform = `translate3d(${Math.min(x, Math.max(w - 1, 0))}px,0,0)`
    if (readoutRef.current) {
      const rx = Math.max(0, Math.min(x - 36, Math.max(w - 72, 0)))
      readoutRef.current.style.transform = `translate3d(${rx}px,0,0)`
    }
    const shown = (v * pct).toFixed(2) + "%"
    if (pctHeadRef.current) pctHeadRef.current.textContent = shown
    if (pctCapRef.current) pctCapRef.current.textContent = lb ? shown : ""
    if (raisedRef.current) raisedRef.current.textContent = raised === null ? "loading…" : formatDog(v * raised)
  }, [pct, raised, lb])

  const applyRef = useRef(apply)
  useEffect(() => { applyRef.current = apply; apply(t.get()) }, [apply, t])
  useMotionValueEvent(t, "change", (v) => applyRef.current(v))

  // measure the rail once (and on resize) into a ref — never state, never per frame
  useEffect(() => {
    const el = railRef.current
    if (!el) return
    const upd = () => { railWRef.current = el.clientWidth; applyRef.current(t.get()) }
    upd()
    const ro = new ResizeObserver(upd)
    ro.observe(el)
    return () => ro.disconnect()
  }, [t])

  // structure draws 0 → 1.0s; the value travels 0.55 → 1.65s. The overlap is
  // the point: surveyed, then filled.
  useEffect(() => {
    if (reduce) { t.set(1); applyRef.current(1); return }
    if (!inView) return
    const controls = animate(t, 1, { duration: 1.1, delay: 0.55, ease: EASE })
    return () => controls.stop()
  }, [inView, reduce, t])

  // Desde 28/08 a doação também sai daqui: a carteira conectada assina e
  // transmite sem a pessoa sair da página. O endereço e o COPY continuam
  // porque nem toda carteira sabe transferir a pedido de um site.
  const { open: openDonate } = useDonate()

  // ── copy interaction ─────────────────────────────────────────────────────
  const [copied, setCopied] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  const copy = (key: string, text: string) => {
    navigator.clipboard?.writeText(text)
    setCopied(key)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(null), 1600)
    // Último passo mensurável antes de uma doação: a partir daqui a pessoa sai
    // do site e vai pra carteira, e o resto acontece na cadeia. É o que amarra
    // o funil da /landing ao dinheiro que chega em bc1pxk7aw…, e por método —
    // DOG conta pra licença, BTC e STX não.
    track("donate_address_copied", { metodo: key })
  }

  const spotlight = useSpotlight<HTMLDivElement>()

  // ── the ticker's payload: live values only, never static copy ────────────
  const tickerText = lb
    ? `TOTAL RAISED ● ${formatDog(lb.total_received)} DOG ● ${pct.toFixed(2)}% OF THE GRAND OPENING ` +
      `● ${lb.donor_count.toLocaleString()} BUILDERS ● ${lb.founders_count.toLocaleString()} FOUNDERS ` +
      `● GOAL ${formatDog(DONATION_GOAL)} DOG ● `
    : "CONNECTING TO THE CONSTRUCTION FUND ● "

  const feed: (RecentEntry | null)[] = Array.from({ length: 8 }, (_, i) => lb?.recent?.[i] ?? null)
  const feedEmptyLine = lb ? "Awaiting the next contribution." : "Loading live feed…"

  return (
    <section id="build" className={`relative border-t ${HAIR_SOFT} scroll-mt-16`}>
      <style jsx global>{`
        @keyframes sv-ping {
          0%   { transform: scale(1);   opacity: 0.6; }
          70%  { transform: scale(3.4); opacity: 0; }
          100% { transform: scale(3.4); opacity: 0; }
        }
        .sv-ring { animation: sv-ping 2.2s cubic-bezier(0.16, 1, 0.3, 1) infinite; }
        @media (prefers-reduced-motion: reduce) {
          .sv-ring { animation: none; opacity: 0; }
        }
      `}</style>

      {/* beat 0 — the seam is struck */}
      <DrawRule className="absolute -top-px left-0 w-24" duration={1.0} />

      <div className="max-w-6xl mx-auto px-6 md:px-10 py-20 md:py-28">
        {/* ── section head — the four-beat cadence, identical across #build/#deed/#how */}
        <div className="max-w-2xl">
          <Scramble
            text="LIVE CONSTRUCTION FUND"
            speed={34}
            className="block font-mono text-[11px] tracking-[0.3em] text-lava"
          />
          <h2 className="font-display font-bold text-3xl md:text-4xl text-snow mt-3 leading-tight">
            <SplitLine text="Help move DogCity from terrain to skyline." delay={0.12} step={0.055} />
          </h2>
          <Reveal delay={0.3} y={14}>
            <p className="text-sm text-mist mt-3 leading-relaxed">
              The construction fund finances the systems, terrain, infrastructure and property tools
              needed to bring the city online. Every number below is live.
            </p>
          </Reveal>
        </div>

        <div className="mt-10 grid md:grid-cols-[1fr_320px] gap-10">
          <div>
            {/* ── LIVE TICKER ───────────────────────────────────────────── */}
            {/* Pointer/tablet up only. At 320px the two fixed 40px fade masks
                eat a third of the strip, leaving a 162px window — nine glyphs
                of a 102-character message, on a loop that takes 71 seconds to
                complete a pass. Nobody assembles a sentence from that. Every
                number it carries (raised · % · builders · founders · goal) is
                rendered statically a few pixels below, so hiding it on phones
                loses no information and takes this span's only rAF loop with
                it: the IntersectionObserver reports a display:none element as
                not intersecting, so the loop never starts. */}
            <div className="hidden sm:block">
              <Reveal delay={0.4} y={10} blur={false}>
                <LedStrip text={tickerText} />
              </Reveal>
            </div>

            {/* ── THE SURVEY RAIL ───────────────────────────────────────── */}
            <div ref={railGate} className="mt-6">
              <div className="flex items-baseline justify-between font-mono text-[11px] text-dusty">
                <span>
                  <Steady
                    ghost={raised !== null ? formatDog(raised) : "loading…"}
                    valueRef={raisedRef}
                    className="text-snow"
                  />
                  {raised !== null && " DOG raised"}
                </span>
                <span className="tabular-nums">goal {formatDog(DONATION_GOAL)} DOG</span>
              </div>

              {/* readout pinned to the head — fixed width so it never measures */}
              <div className="relative mt-3 h-4">
                <div
                  ref={readoutRef}
                  className="absolute left-0 top-0 w-[72px] text-center font-mono text-[11px] font-bold text-lava tabular-nums will-change-transform"
                >
                  <span className="sr-only">{pct.toFixed(2)}% of the Grand Opening</span>
                  <span aria-hidden ref={pctHeadRef} />
                </div>
              </div>

              <div ref={railRef} className={`relative h-12 md:h-14 overflow-hidden`}>
                {/* passed: warm graduations over the lava gradient — static, full width */}
                <div aria-hidden className="absolute inset-0" style={PASSED_BG} />
                {/* the shroud hides everything the fill has not reached yet */}
                <div
                  ref={shroudRef}
                  aria-hidden
                  className="absolute inset-0 origin-right bg-void will-change-transform"
                  style={{ transform: "scaleX(1)" }}
                />
                <div aria-hidden className="absolute inset-0 bg-white/[0.02]" />
                {/* ahead: the dusty ruler, drawn over both regions */}
                <div aria-hidden className="absolute inset-0" style={AHEAD_BG} />

                {/* the head — 1px lava column + status glyph */}
                <div
                  ref={headRef}
                  aria-hidden
                  className="absolute inset-y-0 left-0 w-px will-change-transform"
                  style={{ background: "#F56E0F", boxShadow: "0 0 12px rgba(245,110,15,0.9)" }}
                >
                  <StatusGlyph
                    state={lb ? "live" : "dead"}
                    className="absolute left-1/2 top-1/2 -ml-[2.5px] -mt-[2.5px]"
                  />
                </div>

                <div aria-hidden className={`absolute inset-0 border ${HAIR}`} />

                {/* the rail draws itself left→right, 0 → 1.0s */}
                {!reduce && (
                  <motion.div
                    aria-hidden
                    className="absolute inset-0 origin-right bg-void"
                    initial={{ scaleX: 1 }}
                    animate={inView ? { scaleX: 0 } : undefined}
                    transition={{ duration: 1.0, ease: EASE }}
                  />
                )}
              </div>

              {/* legend */}
              <div aria-hidden className="relative mt-2 h-3 font-mono text-[9px] tracking-[0.25em] text-dusty">
                {[0, 25, 50, 75, 100].map((n, i) => (
                  <span
                    key={n}
                    className="absolute top-0 tabular-nums"
                    style={{
                      left: `${n}%`,
                      transform: i === 0 ? "none" : i === 4 ? "translateX(-100%)" : "translateX(-50%)",
                    }}
                  >
                    {n}
                  </span>
                ))}
              </div>

              <div className="mt-3 font-mono text-[11px] text-dusty">
                <Steady ghost={`${pct.toFixed(2)}%`} valueRef={pctCapRef} className="text-lava" />
                {lb && " of the Grand Opening"}
              </div>
            </div>

            {/* ── STAT GRID — the signature gap-px hairline grid ─────────── */}
            <Stagger
              step={0.075}
              delay={0.45}
              // three across needs ~50px per cell at 320px, and "10.00M" in
              // 32px Syne is ~119px — it was clipped. Stack below sm.
              className={`grid grid-cols-1 sm:grid-cols-3 gap-px ${GRIDLINE} border ${HAIR} mt-8`}
            >
              {[
                { label: "Builders", value: lb?.donor_count ?? null, fmt: false },
                { label: "Founders", value: lb?.founders_count ?? null, fmt: false },
                { label: "Goal", value: DONATION_GOAL, fmt: true },
              ].map((s) => {
                const format = s.fmt ? formatDog : (v: number) => Math.round(v).toLocaleString()
                return (
                  <StaggerItem key={s.label} className="bg-void p-4">
                    <div className="font-mono text-[10px] tracking-[0.2em] text-dusty">
                      {s.label.toUpperCase()}
                    </div>
                    <div className="font-display font-bold text-xl sm:text-2xl text-snow mt-1 tabular-nums">
                      <SteadyCounter
                        value={s.value}
                        ghost={s.value === null ? "—" : format(s.value)}
                        format={format}
                      />
                    </div>
                  </StaggerItem>
                )
              })}
            </Stagger>

            {/* ── DONATION METHODS — the conversion point of the page ────── */}
            <div className="mt-10 space-y-3">
              <Reveal y={12}>
                <button
                  onClick={() => openDonate({ asset: "dog" })}
                  className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 border border-lava/60 bg-lava/[0.12] px-4 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-lava transition-colors hover:bg-lava/[0.2]"
                >
                  <Wallet className="w-4 h-4" />
                  Donate from your wallet
                </button>
              </Reveal>

              {DONATION_METHODS.map((m, i) => {
                const isCopied = copied === m.key
                const featured = Boolean(m.featured)
                return (
                  <Reveal key={m.key} delay={0.06 * i} y={14}>
                    <div
                      ref={featured ? spotlight.ref : undefined}
                      onPointerMove={featured ? spotlight.onPointerMove : undefined}
                      // Stacks below sm. Side by side, the fixed furniture —
                      // 48px padding + 28px logo + 32px of gaps + an 86px COPY
                      // button — eats 194 of the 242px available at 320w,
                      // leaving 48px for the address. `break-all` then shattered
                      // it into ~4 characters per line, 9 lines tall. Users
                      // verify an address by its first and last characters; at
                      // that width it is unverifiable and looks broken enough to
                      // cost trust in a real payment address.
                      className={
                        featured
                          ? "spotlight-card relative border border-lava/40 bg-lava/[0.04] p-4 sm:p-6 flex flex-col sm:flex-row items-start gap-3 sm:gap-4 shadow-[inset_0_0_60px_rgba(245,110,15,0.06)]"
                          : `relative border ${HAIR} p-4 flex flex-col sm:flex-row items-start gap-3 sm:gap-4`
                      }
                    >
                      <Image
                        src={m.logo}
                        alt={m.symbol}
                        width={28}
                        height={28}
                        className="rounded-full shrink-0 relative z-10 mt-0.5"
                      />
                      <div className="min-w-0 flex-1 relative z-10">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="font-mono text-sm font-bold text-snow">{m.title}</span>
                          {featured && <StatusGlyph state="live" className="translate-y-[-1px]" />}
                          <span className="font-mono text-[10px] text-dusty">{m.note}</span>
                        </div>
                        <div className="font-mono text-[11px] break-all leading-relaxed mt-1">
                          <AddressGlyphs addr={m.address} />
                        </div>
                        {/* the line has been read */}
                        <motion.span
                          aria-hidden
                          className="mt-1 block h-px origin-left bg-lava"
                          initial={false}
                          animate={{ scaleX: isCopied && !reduce ? 1 : 0 }}
                          transition={{ duration: 0.38, ease: EASE }}
                        />
                      </div>
                      <button
                        onClick={() => copy(m.key, m.address)}
                        aria-label={`Copy ${m.title} address`}
                        // full width when stacked, and min-h-[44px] to clear the
                        // 44px touch-target floor (it measured 86x35 before)
                        className={`relative z-10 shrink-0 w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center sm:justify-start px-3 py-2 font-mono text-[11px] border transition-colors ${
                          isCopied
                            ? "border-lava text-lava"
                            : "border-white/20 text-snow hover:border-lava/60 hover:text-lava"
                        }`}
                      >
                        <span aria-hidden className="invisible inline-flex items-center gap-1.5">
                          <Copy className="w-3.5 h-3.5" />
                          COPIED
                        </span>
                        <span aria-hidden className="absolute inset-0 inline-flex items-center justify-center gap-1.5">
                          {isCopied ? <Check className="w-3.5 h-3.5 text-lava" /> : <Copy className="w-3.5 h-3.5" />}
                          <Scramble key={isCopied ? "copied" : "copy"} text={isCopied ? "COPIED" : "COPY"} speed={26} />
                        </span>
                      </button>
                    </div>
                  </Reveal>
                )
              })}
              <Reveal delay={0.24} y={10}>
                <p className="font-mono text-[11px] sm:text-[10px] text-dusty leading-relaxed pt-1">
                  Send from the wallet you want registered; the sending address becomes your identity in DogCity.
                  No seed phrase is ever requested.
                </p>
              </Reveal>

              {/* ── DON'T TRUST. VERIFY. ────────────────────────────────────
                  Herdado da /donate (landing antiga, aposentada em 27/08). O
                  bloco existe porque pedir DOG sem oferecer o extrato e pedir
                  fe. A tesouraria e publica: o visitante confere o saldo e cada
                  entrada sem sair daqui.
                  ⚠️ O destino primario e a NOSSA pagina de endereco. A versao
                  velha mandava direto pro mempool.space e entregava a pessoa
                  pra fora do site no momento de maior interesse; o mempool fica
                  como segunda porta, em icone. */}
              <Reveal delay={0.3} y={10}>
                <div className={`mt-2 border ${HAIR} p-3`}>
                  <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-lava">
                    Don&apos;t trust. Verify.
                  </p>
                  <p className="mt-2 font-mono text-[11px] leading-relaxed text-dusty">
                    The treasury is one public address on Bitcoin. Every contribution above was read
                    from the chain, and so is the total: check the ledger yourself before you send.
                  </p>
                  <div className="mt-2.5 flex items-baseline gap-3">
                    <a
                      href={`/address/bitcoin/${DONATION_WALLET}`}
                      className="font-mono text-[11px] text-lava hover:text-lava-light"
                    >
                      Open the treasury &rarr;
                    </a>
                    <a
                      href={`https://mempool.space/address/${DONATION_WALLET}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[10px] text-dusty/60 hover:text-dusty"
                      aria-label="Open the treasury on mempool.space"
                      title="mempool.space"
                    >
                      mempool.space &#8599;
                    </a>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>

          {/* ── LIVE CONTRIBUTIONS — eight channels, some empty ──────────── */}
          <Reveal delay={0.5} y={16}>
            <aside className={`border ${HAIR} bg-white/[0.02] p-5 self-start`}>
              <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.25em] text-dusty">
                <StatusGlyph state={lb && lb.recent.length > 0 ? "live" : "dead"} />
                LIVE CONTRIBUTIONS
              </div>
              {/* exactly eight slots, always. A new contribution DISPLACES a row;
                  it never grows the aside, so the hero never re-measures. */}
              <ol className="mt-4">
                {feed.map((entry, i) => (
                  <li
                    key={i}
                    className="relative h-7 flex items-center overflow-hidden border-b border-white/[0.04] last:border-b-0"
                  >
                    {reduce ? (
                      entry ? (
                        <FeedRow entry={entry} />
                      ) : i === 0 && !lb?.recent?.length ? (
                        <span className="font-mono text-[11px] text-dusty">{feedEmptyLine}</span>
                      ) : (
                        <EmptySlot />
                      )
                    ) : (
                      <AnimatePresence initial={false} mode="wait">
                        {entry ? (
                          <motion.div
                            key={entry.txid}
                            className="w-full"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 6 }}
                            transition={{ duration: DUR.fast, ease: EASE, delay: i * 0.04 }}
                          >
                            <FeedRow entry={entry} />
                          </motion.div>
                        ) : (
                          <motion.div
                            key={`slot-${i}`}
                            className="w-full"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.18, ease: EASE }}
                          >
                            {i === 0 && !lb?.recent?.length ? (
                              <span className="font-mono text-[11px] text-dusty">{feedEmptyLine}</span>
                            ) : (
                              <EmptySlot />
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    )}
                  </li>
                ))}
              </ol>
            </aside>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

// ── feed row / empty channel ───────────────────────────────────────────────
function FeedRow({ entry }: { entry: RecentEntry }) {
  return (
    <span className="flex w-full items-baseline justify-between gap-3 font-mono text-[11px]">
      <span className="flex items-center gap-2 min-w-0">
        <StatusGlyph state="live" />
        <span className="text-mist truncate">{shortAddr(entry.address)}</span>
      </span>
      <span className="text-lava tabular-nums shrink-0">+{formatDog(entry.amount)} DOG</span>
    </span>
  )
}

function EmptySlot() {
  return (
    <span aria-hidden className="flex w-full items-center gap-2">
      <StatusGlyph state="dead" />
      <span className="h-px flex-1 bg-white/[0.05]" />
    </span>
  )
}
