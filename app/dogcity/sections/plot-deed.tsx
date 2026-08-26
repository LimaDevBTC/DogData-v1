"use client"

// ═══════════════════════════════════════════════════════════════════════════
// DogCity landing — PLOT DEED (#deed). The registry answers, about YOU.
//
// Second of the three SURVEY sections. #build is the registry reporting on
// itself; this one is the registry reporting on the visitor. The emotional job
// is "you are already on the map — go look", so the payoff is not a card that
// appears: it is a DOCUMENT BEING ISSUED. You type an address, a scanline runs
// the query, and a sheet unmasks downward out of a plotter with a holographic
// sheen across it, the district colour flooding the plate.
//
// THE ARCHITECTURE THAT MAKES IT WORK — read before editing:
//
//   The deed plate is ONE fixed-height box that never changes size. Empty,
//   searching, issued and no-match all render inside the same reserved plate;
//   only its CONTENTS change. That is simultaneously the design idea (the
//   instrument has exactly one output window) and a hard technical constraint:
//   the 500vh scrollytelling hero is portaled to <body> and glued to its
//   in-flow spacer by a ResizeObserver on document.body, so any below-fold
//   element that changes its own height after layout forces a full hero
//   re-measure. Nothing here grows. Every state is a swap inside a fixed box,
//   and every animation touches only transform / opacity / clip-path.
//
//   The EMPTY state is a SPECIMEN DEED — the real layout at 40% behind a
//   scrim, with a live PlotMap, a genuine district colour and legible field
//   LABELS whose VALUES are block-glyph redactions. It teaches the anatomy of
//   a lot, creates anticipation for exactly which fields are about to fill,
//   and reserves the precise height the issued deed will occupy.
//
// THE SHARED DEVICE — the SURVEY RAIL (see #build and #how) appears here in
// its vertical orientation, down the left gutter of the plate, tinted to the
// district colour, with the lot number riding at its head. Graduations are a
// repeating-linear-gradient background image: zero DOM nodes, zero JS per
// frame. The rail is STRUCK BEFORE THE VALUES LAND — clip-path wipe 0→0.7s,
// head travels 0.25→0.95s, values resolve on a 0.06 stagger. Surveyed, then
// filled.
//
// TWO PURPOSE-BUILT CSS ANIMATIONS ALREADY IN globals.css ARE USED HERE:
//   .registry-scan (:1174) — the scanline, while the fetch is in flight. It is
//     `infinite` and has NO reduced-motion rule, so it MUST be gated in JS.
//   .deed-sheen    (:1160) — the one-shot holographic sweep on the issued
//     deed. It IS handled for reduced motion in CSS (:1189).
//
// Only ONE PlotMap instance is ever mounted (it runs an un-gated rAF), and it
// is behind a useInView mount gate so its loop stops when the section leaves
// the viewport. No WebGL, no window scroll listener, no useScroll.
//
// Tailwind note: this project's opacity scale is the stock one. Off-scale
// modifiers (8, 12, …) DO NOT COMPILE — they fall through to preflight's
// #D1D5DB and paint light-grey hairlines on a black page. Use the HAIR*
// constants from ../motion, a stock step, or bracket syntax.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { motion, useInView, useReducedMotion } from "framer-motion"
import { ArrowRight, Loader2, Search } from "lucide-react"
import PlotMap from "../../donate/plot-map"
import { LOT_SEGMENTATION, LUNAR_SITE, formatDog, shortAddr } from "../dogcity-data"
import {
  DUR, EASE, EASE_CSS, GRIDLINE, HAIR, HAIR_SOFT,
  DrawRule, Reveal, Scramble, SplitLine,
} from "../motion"
import type { PlotData } from "../types"

// ── the specimen: a genuine district colour, a real point inside district 2's
// ring band, so the empty state is a true drawing of a lot and not a mock-up
const SPECIMEN = { districtId: 2, color: "#F7931A", nx: -0.164, nz: 0.281, rail: 2 / 9 }

const REDACT = "▚▚▚▚"
const REDACT_LONG = "▚▚▚▚▚▚▚▚"
const DEAD_INK = "rgba(240,240,242,0.25)"
const MAP_SIZE = 150

// real query stages, stepped on a setInterval — the scan runs for exactly as
// long as the fetch takes and not one millisecond longer. Never fake latency.
const STAGES = ["QUERYING REGISTRY…", "MATCHING UTXO SET…", "RESOLVING DISTRICT…"]

type Status = "empty" | "searching" | "found" | "notfound" | "error"
type GlyphTone = "live" | "planned" | "dead"

// nx/nz are normalised to [-1,1] — displayed honestly as a SITE OFFSET beside
// the site datum, never dressed up as a synthesised per-lot lat/lon
function fmtOffset(v: number): string {
  return `${v < 0 ? "−" : "+"}${Math.abs(v).toFixed(3)}`
}

// ═══ the status glyph — the rail's head, and the only "live" signal here ════
// filled + expanding ring = live today · hollow amber = planned · hollow grey
// = dead. The filled/hollow distinction is legally load-bearing across the
// whole SURVEY span; encode it once, reuse it everywhere.
function StatusGlyph({ tone, color = "#F56E0F" }: { tone: GlyphTone; color?: string }) {
  const ink = tone === "planned" ? "#FFAD42" : tone === "dead" ? DEAD_INK : color
  return (
    <span className="relative inline-block h-[5px] w-[5px] align-middle shrink-0" style={{ color: ink }} aria-hidden>
      {tone === "live" ? (
        <>
          <span className="absolute inset-0 bg-current" />
          <span className="sv-ping absolute inset-0 border border-current" />
        </>
      ) : (
        <span className="absolute inset-0 border border-current" />
      )}
    </span>
  )
}

// ═══ the vertical survey rail ══════════════════════════════════════════════
// A surveyor's graduated staff: CORE (district 00) at the top, RIM (09) at the
// bottom, the head parked at the queried lot's district. Graduations are two
// stacked repeating-linear-gradients of different tick LENGTH — background
// images, not elements. The head is moved with a percentage translateY on a
// full-height wrapper so nothing but `transform` ever animates.
function SurveyRail({
  pos, color, tone, readout, animate: doAnimate,
}: {
  pos: number
  color: string
  tone: GlyphTone
  readout: string
  animate: boolean
}) {
  const minor = "repeating-linear-gradient(to bottom, rgba(240,240,242,0.10) 0 1px, rgba(0,0,0,0) 1px 12px)"
  const major = "repeating-linear-gradient(to bottom, rgba(240,240,242,0.22) 0 1px, rgba(0,0,0,0) 1px 60px)"

  return (
    <div className={`relative w-12 md:w-20 shrink-0 border-r ${HAIR}`} aria-hidden>
      <div className="absolute top-3 left-2 font-mono text-[9px] tracking-[0.2em] text-dusty">00</div>
      <div className="absolute bottom-3 left-2 font-mono text-[9px] tracking-[0.2em] text-dusty">09</div>

      {/* the rail is STRUCK first — a clip wipe, so the graduation spacing is
          never distorted the way a scaleY would distort it */}
      <motion.div
        className="absolute inset-y-8 left-0 right-0"
        initial={doAnimate ? { clipPath: "inset(0 0 100% 0)" } : false}
        animate={doAnimate ? { clipPath: "inset(0 0 0% 0)" } : undefined}
        transition={{ duration: DUR.base, ease: EASE }}
      >
        <span className="absolute inset-y-0 right-3 w-px bg-white/10" />
        <span className="absolute inset-y-0 right-[13px] w-2" style={{ backgroundImage: minor }} />
        <span className="absolute inset-y-0 right-[13px] w-4" style={{ backgroundImage: major }} />
      </motion.div>

      {/* the head travels down the rail while the fill is still being struck */}
      <motion.div
        className="absolute inset-y-8 left-0 right-0 pointer-events-none"
        initial={doAnimate ? { y: "0%" } : false}
        animate={doAnimate ? { y: `${pos * 100}%` } : undefined}
        transition={{ duration: DUR.base, delay: 0.25, ease: EASE }}
        style={doAnimate ? undefined : { transform: `translateY(${pos * 100}%)` }}
      >
        <span className="absolute top-0 right-3 translate-x-1/2 -translate-y-1/2">
          <StatusGlyph tone={tone} color={color} />
        </span>
        <span className="absolute top-0 right-8 -translate-y-1/2 hidden md:block font-mono text-[9px] tabular-nums whitespace-nowrap" style={{ color }}>
          {readout}
        </span>
      </motion.div>
    </div>
  )
}

// ═══ LOCATE — a real <button>, with the encrypt-button scramble mechanism ═══
// The label decrypts through the address alphabet (hex). The layout trick is
// what makes it safe: the settled label sits in flow at visibility:hidden and
// the animating copy is painted absolutely over it, so junk glyphs can never
// resize the button mid-scramble. Writes textContent — never React state.
const HEX = "0123456789ABCDEF"
const LOCATE = "LOCATE"

function LocateButton({ loading, reduce }: { loading: boolean; reduce: boolean }) {
  const out = useRef<HTMLSpanElement>(null)
  const raf = useRef(0)

  const run = useCallback(() => {
    if (reduce) return
    const el = out.current
    if (!el) return
    cancelAnimationFrame(raf.current)
    const cycles = 4
    const total = LOCATE.length * cycles
    let step = 0
    let last = 0
    const tick = (t: number) => {
      if (t - last >= 1000 / 60) {
        last = t
        el.textContent = LOCATE.split("")
          .map((ch, i) => (step / cycles > i ? ch : HEX[Math.floor(Math.random() * HEX.length)]))
          .join("")
        step++
      }
      if (step <= total) raf.current = requestAnimationFrame(tick)
      else el.textContent = LOCATE
    }
    raf.current = requestAnimationFrame(tick)
  }, [reduce])

  useEffect(() => () => cancelAnimationFrame(raf.current), [])
  useEffect(() => { if (loading) run() }, [loading, run])

  return (
    <button
      type="submit"
      onPointerEnter={run}
      onFocus={run}
      className="shrink-0 inline-flex items-center gap-2 px-5 py-3 font-mono text-sm font-bold text-void bg-lava hover:bg-lava-light transition-colors"
    >
      {loading && !reduce ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
      <span className="sr-only">Locate</span>
      <span className="relative inline-block" aria-hidden>
        <span className="invisible">{LOCATE}</span>
        <span ref={out} className="absolute inset-0 text-left">{LOCATE}</span>
      </span>
    </button>
  )
}

// ═══ a field value that resolves into place once the deed is issued ════════
function Resolve({
  i, on, className, children,
}: { i: number; on: boolean; className?: string; children: ReactNode }) {
  if (!on) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DUR.fast, delay: 0.18 + i * 0.06, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════

export default function Section({}) {
  const reduceRaw = useReducedMotion()
  const reduce = reduceRaw === true

  const [addr, setAddr] = useState("")
  const [focused, setFocused] = useState(false)
  const [query, setQuery] = useState<{ addr: string; id: number } | null>(null)
  const [plot, setPlot] = useState<PlotData | null>(null)
  const [loading, setLoading] = useState(false)
  const [errored, setErrored] = useState(false)
  const [stage, setStage] = useState(0)

  const plateRef = useRef<HTMLDivElement>(null)
  // PlotMap runs its own un-gated rAF whenever mounted — mount it only while
  // the plate is near the viewport so the loop stops on the way past
  const mapLive = useInView(plateRef, { once: false, margin: "250px 0px 250px 0px" as never })

  // ── the lookup itself — exactly the fetch page.tsx used to own ────────────
  useEffect(() => {
    if (!query) return
    let cancelled = false
    setLoading(true)
    setErrored(false)
    fetch(`/api/plot?address=${encodeURIComponent(query.addr)}`, { signal: AbortSignal.timeout(15000) })
      // ⚠️ sem o r.ok, um 503 com corpo { error } entrava como PlotData e
      // estourava componente rio abaixo (mesma tela preta do leaderboard)
      .then((r) => { if (!r.ok) throw new Error(`status ${r.status}`); return r.json() })
      .then((d: PlotData) => { if (!cancelled) setPlot(d) })
      .catch(() => { if (!cancelled) { setPlot(null); setErrored(true) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [query])

  // the scan's status line steps through real stages on an interval (not rAF)
  // and is cut the instant the fetch resolves — never padded
  useEffect(() => {
    if (!loading) { setStage(0); return }
    const id = window.setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 620)
    return () => window.clearInterval(id)
  }, [loading])

  const status: Status = !query
    ? "empty"
    : loading
      ? "searching"
      : errored
        ? "error"
        : plot?.found
          ? "found"
          : plot
            ? "notfound"
            : "empty"

  const isSpecimen = status === "empty" || status === "searching"
  const found = status === "found" && !!plot?.district && !!plot.pin
  const district = plot?.district
  const pin = plot?.pin

  // ── one view object drives every state through the SAME layout ───────────
  const ribbon =
    found ? "MATCH IN REGISTRY"
      : status === "notfound" ? "NO MATCH IN REGISTRY"
        : status === "error" ? "REGISTRY UNAVAILABLE"
          : "SPECIMEN · NOT A REGISTRATION"

  const headline =
    found && district ? district.name
      : status === "notfound" ? "NO MATCH"
        : status === "error" ? "NO RETURN"
          : REDACT_LONG

  const headColor =
    found && district ? district.color
      : isSpecimen ? SPECIMEN.color
        : DEAD_INK

  const tagline =
    found ? shortAddr(query?.addr ?? "")
      : status === "notfound"
        ? "Address not found among eligible DOG holders — hold DOG in a self-custody wallet to receive a lot."
        : status === "error"
          ? "The registry did not respond. Run the query again."
          : "The anatomy of a lot — the four values a registry return fills in."

  const dash = isSpecimen ? REDACT : "—"

  const railPos = found && district ? district.id / 9 : isSpecimen ? SPECIMEN.rail : 0
  const railColor = found && district ? district.color : isSpecimen ? SPECIMEN.color : DEAD_INK
  const railTone: GlyphTone = found ? "live" : "dead"
  const railReadout = found && plot?.rank ? `#${plot.rank.toLocaleString()}` : isSpecimen ? REDACT : "——"

  const mapDistrict = found && district ? district.id : isSpecimen ? SPECIMEN.districtId : -1
  const mapColor = found && district ? district.color : isSpecimen ? SPECIMEN.color : "#6B6B78"
  const mapNx = found && pin ? pin.nx : isSpecimen ? SPECIMEN.nx : 0
  const mapNz = found && pin ? pin.nz : isSpecimen ? SPECIMEN.nz : 0

  const plateInk =
    found && district ? `${district.color}44`
      : status === "notfound" || status === "error" ? "rgba(240,240,242,0.20)"
        : "rgba(240,240,242,0.10)"

  const plateGlow = found && district ? `0 0 44px ${district.color}14` : undefined

  // remount (and therefore replay the unmask + sheen) on every new return;
  // empty and searching deliberately share a key so the specimen — and the one
  // PlotMap instance — sit still while the scan runs over them
  const plateKey =
    status === "found" ? `f${query?.id ?? 0}`
      : status === "notfound" || status === "error" ? `n${query?.id ?? 0}`
        : "spec"

  const cells: { label: string; value: ReactNode }[] = [
    { label: "LOT", value: found && plot?.rank ? `#${plot.rank.toLocaleString()}` : dash },
    {
      label: "DISTRICT",
      value: found && district ? `${district.tag} · district ${district.id} of 10` : dash,
    },
    {
      label: "SITE OFFSET",
      value: found && pin ? (
        <>
          <span className="block">nx {fmtOffset(pin.nx)}</span>
          <span className="block">nz {fmtOffset(pin.nz)}</span>
        </>
      ) : dash,
    },
    { label: "BALANCE", value: found ? `${formatDog(plot?.total_dog ?? 0)} DOG` : dash },
  ]

  return (
    <section id="deed" className={`border-t ${HAIR_SOFT} scroll-mt-16`}>
      <style jsx global>{`
        @keyframes sv-ping {
          0%        { transform: scale(0.6); opacity: 0.6; }
          70%, 100% { transform: scale(2.8); opacity: 0; }
        }
        .sv-ping { animation: sv-ping 2.4s cubic-bezier(0.16, 1, 0.3, 1) infinite; }
        @media (prefers-reduced-motion: reduce) {
          .sv-ping { animation: none; opacity: 0; }
        }
      `}</style>

      <div className="max-w-6xl mx-auto px-6 md:px-10 py-20 md:py-28">

        {/* ── section head — the SURVEY four-beat cadence ─────────────────── */}
        <div className="max-w-2xl">
          <DrawRule className="w-24" duration={1.0} />
          <div className="font-mono text-[11px] tracking-[0.3em] text-lava mt-5">
            <Scramble text="PLOT DEED" speed={34} />
          </div>
          <h2 className="font-display font-bold text-3xl md:text-4xl text-snow mt-3 leading-tight">
            <SplitLine text="You already live in DogCity." delay={0.12} step={0.055} />
          </h2>
          <Reveal delay={0.3} y={14}>
            <p className="text-sm text-mist mt-3 leading-relaxed">
              Every eligible DOG wallet holds one of the {LOT_SEGMENTATION.total.toLocaleString()} demarcated
              lots. Paste your address to see your district — placement is derived from your on-chain history, live.
            </p>
          </Reveal>
        </div>

        {/* ── the query bar ──────────────────────────────────────────────── */}
        <Reveal delay={0.45} y={16}>
          <div className="mt-10 max-w-xl">
            <div className="font-mono text-[9px] tracking-[0.25em] text-dusty">REGISTRY QUERY</div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const v = addr.trim()
                if (!v) return
                setPlot(null)
                setErrored(false)
                setLoading(true)
                setQuery((q) => ({ addr: v, id: (q?.id ?? 0) + 1 }))
              }}
              className="mt-2 flex gap-2"
            >
              <label htmlFor="deed-addr" className="sr-only">Your DOG wallet address</label>
              <div className="relative flex-1 min-w-0">
                <input
                  id="deed-addr"
                  value={addr}
                  onChange={(e) => setAddr(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  placeholder="bc1p… your DOG address"
                  spellCheck={false}
                  autoComplete="off"
                  className={`w-full bg-white/[0.03] border ${HAIR} focus:border-lava/60 outline-none px-4 py-3 font-mono text-sm text-snow placeholder:text-dusty transition-colors`}
                />
                {/* the line has been read: a lava rule draws under the field */}
                <span
                  className={`absolute left-0 bottom-0 h-px w-full bg-lava origin-left transition-transform duration-300 ${focused ? "scale-x-100" : "scale-x-0"}`}
                  style={{ transitionTimingFunction: EASE_CSS }}
                />
              </div>
              <LocateButton loading={loading} reduce={reduce} />
            </form>
          </div>
        </Reveal>

        {/* ── the deed plate — ONE fixed-height output window ─────────────── */}
        <Reveal delay={0.55} y={18}>
          <div ref={plateRef} aria-live="polite" className="mt-6">
            <div
              key={plateKey}
              className="relative overflow-hidden flex h-[540px] md:h-[400px] border"
              style={{
                borderColor: plateInk,
                boxShadow: plateGlow,
                backgroundImage: "radial-gradient(120% 100% at 0% 0%, rgba(240,240,242,0.035), rgba(0,0,0,0) 62%)",
              }}
            >
              <SurveyRail
                pos={railPos}
                color={railColor}
                tone={railTone}
                readout={railReadout}
                animate={!reduce}
              />

              {/* the sheet itself — unmasks DOWNWARD, because a document comes
                  out of a plotter top-first */}
              <motion.div
                className="relative flex-1 min-w-0 p-4 md:p-6 flex flex-col transition-opacity duration-300"
                style={{ opacity: status === "searching" ? 0.22 : status === "empty" ? 0.4 : 1 }}
                initial={found && !reduce ? { clipPath: "inset(0 0 100% 0)" } : false}
                animate={found && !reduce ? { clipPath: "inset(0 0 0% 0)" } : undefined}
                transition={{ duration: DUR.base, ease: EASE }}
              >
                {/* header block — fixed height so a 4-line no-match sentence
                    can never push the body down */}
                <div className="min-h-[120px] md:h-[100px] shrink-0 overflow-hidden">
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-mono text-[9px] tracking-[0.25em] text-dusty">REGISTRY RETURN</div>
                    {/* wraps below sm: the ribbon is 240px of tracked mono and
                        its host is 160px at 320w, so "SPECIMEN · NOT A
                        REGISTRATION" was sliced mid-word on every phone —
                        the one label on this plate that must stay unambiguous */}
                    <span
                      className="font-mono text-[9px] tracking-[0.25em] whitespace-normal sm:whitespace-nowrap border px-2 py-1"
                      style={{ color: found ? headColor : "#6B6B78", borderColor: plateInk }}
                    >
                      {ribbon}
                    </span>
                  </div>
                  <Resolve i={0} on={found && !reduce}>
                    <div
                      className="font-display font-bold text-2xl md:text-3xl leading-none mt-3 truncate"
                      style={{ color: headColor }}
                    >
                      {headline}
                    </div>
                  </Resolve>
                  <Resolve i={1} on={found && !reduce}>
                    <div className="font-mono text-[11px] text-dusty mt-2 leading-relaxed">{tagline}</div>
                  </Resolve>
                </div>

                {/* body — the map and the four fields */}
                <div className="mt-5 flex flex-col md:flex-row gap-5 items-start">
                  <div
                    className={`relative shrink-0 border ${HAIR} [&>canvas]:!rounded-none`}
                    style={{ width: MAP_SIZE, height: MAP_SIZE }}
                  >
                    {mapLive && (
                      <PlotMap
                        districtId={mapDistrict}
                        color={mapColor}
                        nx={mapNx}
                        nz={mapNz}
                        size={MAP_SIZE}
                      />
                    )}
                  </div>

                  <div className={`w-full md:flex-1 md:min-w-0 grid grid-cols-2 gap-px ${GRIDLINE} border ${HAIR}`}>
                    {cells.map((c, i) => (
                      <div key={c.label} className="bg-void px-3 py-3">
                        <div className="font-mono text-[9px] tracking-[0.25em] text-dusty">{c.label}</div>
                        <Resolve
                          i={i + 2}
                          on={found && !reduce}
                          className="font-mono text-[12px] text-snow mt-1.5 tabular-nums leading-snug"
                        >
                          {c.value}
                        </Resolve>
                      </div>
                    ))}
                  </div>
                </div>

                {/* bottom bar — the site datum, or the live query stage */}
                <div className={`mt-auto pt-3 border-t ${HAIR_SOFT} flex items-center justify-between gap-3 font-mono text-[10px] tabular-nums`}>
                  {status === "searching" ? (
                    <span className="flex items-center gap-2 text-lava">
                      <StatusGlyph tone="live" />
                      {reduce ? STAGES[0] : STAGES[stage]}
                    </span>
                  ) : (
                    <span className="text-dusty">
                      SITE DATUM <span className="text-snow">{LUNAR_SITE.latDeg}°N · {LUNAR_SITE.lonDeg}°E</span>
                    </span>
                  )}
                  <span className="text-dusty whitespace-nowrap">
                    lot{" "}
                    {found ? <span className="text-lava">Reserved</span> : <span>{dash}</span>}
                  </span>
                </div>
              </motion.div>

              {/* the scanline — infinite, and globals.css has NO reduced-motion
                  rule for it, so it is gated here in JS */}
              {status === "searching" && !reduce && <span className="registry-scan" />}

              {/* the one-shot holographic sweep on the issued deed
                  (.deed-sheen IS reduced-motion-safe in globals.css:1189) */}
              {found && <span className="deed-sheen" />}
            </div>

            {/* footer row — static, so no state can ever change the height */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="font-mono text-[11px] sm:text-[10px] text-dusty leading-relaxed">
                Read-only lookup. No seed phrase is ever requested — by anyone, ever.
              </p>
              <a
                href="#build"
                className={`inline-flex items-center gap-2 px-4 py-2.5 font-mono text-[12px] text-snow border ${HAIR} hover:border-white/50 transition-colors`}
              >
                Build DogCity <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
