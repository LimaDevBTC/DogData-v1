"use client"

// ═══════════════════════════════════════════════════════════════════════════
// Analytics dashboard — the shared surface vocabulary.
//
// Two rules govern this file:
//
// 1. VISUAL: it speaks the DogCity dialect (app/dogcity/motion.tsx) — void
//    ground, hairline plates with square corners, mono eyebrows over a struck
//    rule, display-face figures. Motion primitives are imported from there
//    rather than re-implemented so the two surfaces stay one instrument.
//
// 2. DATA: every chart colour below is a validated slot, not a taste call.
//    CAT was checked with the dataviz validator against this page's surface
//    (#050505) under the ALL-PAIRS test — the hard one, needed because these
//    hues also appear as legend keys and share-bar segments sitting side by
//    side. Result: lightness band, chroma floor, CVD separation (worst pair
//    17.8 ΔE deutan), normal-vision floor (19.4) and 3:1 contrast all PASS.
//    Brand lava #F56E0F sits at OKLCH L 0.692 — outside the dark band's 0.67
//    ceiling — so marks use #E8660D, the deepest step that still reads as the
//    brand. Lava itself stays on UI chrome (eyebrows, rules, buttons), where
//    the band does not apply.
//    Re-run before changing a hex:
//      node scripts/validate_palette.js "#E8660D,#3B82F6,#BE185D" \
//        --mode dark --surface "#050505" --pairs all
//
// Tailwind trap (learned on the landing): this project's opacity scale is the
// stock one. `border-white/8` and `/12` DO NOT COMPILE and fall through to a
// light-grey hairline. Arbitrary values (`white/[0.06]`) are safe.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState, type ReactNode, type ElementType } from "react"
import {
  animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion,
} from "framer-motion"
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react"
import {
  Counter, DrawRule, EASE, Reveal, Scramble, SplitLine,
  useOnce, useSpotlight,
} from "@/app/dogcity/motion"
import { ScrubChart, type ScrubPoint } from "@/components/charts/scrub-chart"

// ── colour ─────────────────────────────────────────────────────────────────
// Series identity, fixed order, never cycled. Three slots is the cap for the
// all-pairs forms on this page; a fourth series folds into "Other" or facets.
export const CAT = ["#E8660D", "#3B82F6", "#BE185D"] as const

// Reserved meaning. Never a series colour — and green is kept OUT of CAT so a
// status swatch can never be mistaken for one. Always shipped with icon+label.
export const STATUS = { good: "#10B981", warn: "#F59E0B", poor: "#EF4444" } as const

// Text tokens. Values, labels and legends wear these — never the series hue.
export const INK = { primary: "#F0F0F2", secondary: "#9CA3AF", muted: "#6B6B78" } as const

export const SURFACE = "#050505"
export const GRID = "#ffffff0f"        // hairline, solid — never dashed
export const AXIS_TICK = { fill: INK.muted, fontSize: 11, fontFamily: "JetBrains Mono, monospace" }

export const HAIR = "border-white/10"
export const HAIR_SOFT = "border-white/[0.06]"
export const GRIDLINE = "bg-white/10"  // backdrop for gap-px plot grids

export type StatusKey = keyof typeof STATUS

export const statusOf = (rating: string): StatusKey =>
  rating === "good" ? "good" : rating === "needs-improvement" ? "warn" : "poor"

const STATUS_ICON = { good: CheckCircle2, warn: AlertTriangle, poor: XCircle } as const
export const STATUS_WORD = { good: "Good", warn: "Improve", poor: "Poor" } as const

// Status never travels as colour alone: the chip is icon + word + hue, always
// all three, so it survives CVD, greyscale print and forced-colors.
export function StatusChip({ status, className = "" }: { status: StatusKey; className?: string }) {
  const Icon = STATUS_ICON[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 font-mono text-[9px]
        uppercase tracking-[0.16em] border shrink-0 ${className}`}
      style={{ color: STATUS[status], borderColor: `${STATUS[status]}59` }}
    >
      <Icon className="w-3 h-3" aria-hidden />
      {STATUS_WORD[status]}
    </span>
  )
}

// The bare icon, for table cells where a full chip would not fit. The word
// still reaches a screen reader through aria-label.
export function StatusMark({ status }: { status: StatusKey }) {
  const Icon = STATUS_ICON[status]
  return <Icon className="w-3 h-3 shrink-0" style={{ color: STATUS[status] }} aria-label={STATUS_WORD[status]} />
}

// ── numbers ────────────────────────────────────────────────────────────────
export const fmtNum = (n: number) => n.toLocaleString("en-US")

export const fmtCompact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`
  : n >= 10_000   ? `${(n / 1000).toFixed(0)}K`
  : fmtNum(n)

export const fmtPage = (p: string) =>
  p.replace("/address/bitcoin/", "/addr/")
   .replace(/bc1[a-z0-9]{8,}/, (a) => `${a.slice(0, 8)}…`)

// ── Corners ────────────────────────────────────────────────────────────────
// The registration mark team SKYLINE struck on every DogCity plate: four
// L-ticks inside the hairline, drawn before the contents ink in. Small, dim,
// still after entrance — if it glows it is a HUD bracket and it is wrong.
export function Corners({ accent, delay = 0 }: { accent?: string; delay?: number }) {
  const reduce = useReducedMotion()
  const { ref, inView } = useOnce("-5% 0px")
  const show = reduce || inView
  const C = [
    { box: "top-0 left-0",     h: "top-0 left-0",     v: "top-0 left-0",     ox: "left",  oy: "top" },
    { box: "top-0 right-0",    h: "top-0 right-0",    v: "top-0 right-0",    ox: "right", oy: "top" },
    { box: "bottom-0 right-0", h: "bottom-0 right-0", v: "bottom-0 right-0", ox: "right", oy: "bottom" },
    { box: "bottom-0 left-0",  h: "bottom-0 left-0",  v: "bottom-0 left-0",  ox: "left",  oy: "bottom" },
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

// ── Plate ──────────────────────────────────────────────────────────────────
// The page's only container. Square corners, one hairline, cursor spotlight.
// No rounded cards, no glass: this is a plot map, not a widget board.
export function Plate({
  children, className = "", corners = false, accent, pad = "p-5",
}: {
  children: ReactNode
  className?: string
  corners?: boolean
  accent?: string
  pad?: string
}) {
  const { ref, onPointerMove } = useSpotlight<HTMLDivElement>()
  return (
    <div
      ref={ref}
      onPointerMove={onPointerMove}
      className={`spotlight-card relative border ${HAIR} bg-white/[0.02] ${pad}
        transition-colors duration-500 hover:border-white/25 ${className}`}
    >
      {corners && <Corners accent={accent} delay={0.35} />}
      <div className="relative">{children}</div>
    </div>
  )
}

// ── SectionHead ────────────────────────────────────────────────────────────
export function SectionHead({
  eyebrow, title, sub, className = "",
}: { eyebrow: string; title: string; sub?: string; className?: string }) {
  return (
    <div className={`max-w-2xl ${className}`}>
      <Scramble text={eyebrow} className="font-mono text-[11px] tracking-[0.3em] text-lava" />
      <DrawRule className="mt-3 w-14" delay={0.06} duration={0.9} />
      <h2 className="font-display font-bold text-2xl md:text-3xl text-snow mt-4 leading-tight">
        <SplitLine text={title} delay={0.12} step={0.055} className="pb-[0.12em]" />
      </h2>
      {sub && (
        <Reveal delay={0.3} y={12}>
          <p className="text-[13px] text-mist mt-3 leading-relaxed">{sub}</p>
        </Reveal>
      )}
    </div>
  )
}

// ── PlateHead ──────────────────────────────────────────────────────────────
// The quieter head a single plate carries: a mono label, optionally a swatch.
export function PlateHead({
  children, icon: Icon, swatch, live, right,
}: {
  children: ReactNode
  icon?: ElementType
  swatch?: string
  live?: boolean
  right?: ReactNode
}) {
  return (
    <div className="flex items-center gap-2 mb-5">
      {live && <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse-dot shrink-0" />}
      {swatch && <span className="w-2 h-2 shrink-0" style={{ background: swatch }} />}
      {Icon && <Icon className="w-3.5 h-3.5 text-dusty shrink-0" />}
      <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] text-dusty">{children}</h3>
      {right && <div className="ml-auto">{right}</div>}
    </div>
  )
}

// ── Sparkline ──────────────────────────────────────────────────────────────
// Trend channel for a stat tile: the run in the de-emphasis ink, the current
// period in the accent. Inline SVG — no library, no layout cost.
export function Sparkline({
  values, color = CAT[0], width = 96, height = 26,
}: { values: number[]; color?: string; width?: number; height?: number }) {
  if (values.length < 3) return null
  const pad = 3
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || 1
  const x = (i: number) => pad + (i / (values.length - 1)) * (width - pad * 2)
  const y = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2)
  const path = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ")
  const last = values.length - 1

  return (
    <svg width={width} height={height} aria-hidden className="overflow-visible">
      <path d={path} fill="none" stroke={INK.muted} strokeWidth={1.5}
        strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last)} cy={y(values[last])} r={2.5} fill={color}
        stroke={SURFACE} strokeWidth={2} />
    </svg>
  )
}

// ── TrendChart ─────────────────────────────────────────────────────────────
// A linha do herói mora em components/charts/scrub-chart.tsx desde 28/08: o
// mesmo gráfico que se lê com o dedo aqui vai ser o gráfico de preço do DOG no
// celular, e um componente que serve às duas telas não pode viver dentro do
// módulo de UI de uma aba interna. Aqui fica só o apelido e o tipo.
export type TrendPoint = ScrubPoint

export function TrendChart(props: React.ComponentProps<typeof ScrubChart>) {
  return <ScrubChart {...props} />
}

// ── StatTile ───────────────────────────────────────────────────────────────
export function StatTile({
  label, value, sub, trend, accent = CAT[0], format = fmtNum, delay = 0,
}: {
  label: string
  value: number | null
  sub?: string
  trend?: number[]
  accent?: string
  format?: (n: number) => string
  delay?: number
}) {
  return (
    <div className="relative bg-void p-5 min-h-[124px] flex flex-col justify-between">
      <div className="flex items-start justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-dusty">{label}</span>
        <span className="w-1.5 h-1.5 shrink-0 mt-1" style={{ background: accent }} />
      </div>
      <div className="mt-4">
        <div className="font-display font-bold text-[30px] leading-none text-snow tabular-nums">
          <Counter value={value} format={format} delay={delay} duration={1.4} />
        </div>
        <div className="flex items-end justify-between gap-2 mt-2 min-h-[26px]">
          {sub
            ? <span className="font-mono text-[10px] text-dusty leading-relaxed">{sub}</span>
            : <span />}
          {trend && <Sparkline values={trend} color={accent} />}
        </div>
      </div>
    </div>
  )
}

// ── MountCounter ───────────────────────────────────────────────────────────
// Counts up on MOUNT, not on scroll-into-view.
//
// The shared <Counter/> gates on an IntersectionObserver with a -5% top
// margin, and anything sitting in that top band never gets released — it
// renders format(0) forever. Below the fold that is exactly right (the number
// should animate when you reach it); for a figure that is above the fold by
// construction it is a bug, and on a short viewport it reads as a live
// dashboard reporting zero. Same trap that kept the sticky <h1> invisible.
function MountCounter({
  value, format, duration = 1.7,
}: { value: number | null; format: (n: number) => string; duration?: number }) {
  const reduce = useReducedMotion()
  const out = useRef<HTMLSpanElement>(null)
  const mv = useMotionValue(0)

  useMotionValueEvent(mv, "change", (v) => {
    if (out.current) out.current.textContent = format(v)
  })

  useEffect(() => {
    if (value === null) return
    if (reduce) {
      if (out.current) out.current.textContent = format(value)
      return
    }
    const controls = animate(mv, value, { duration, ease: EASE })
    return () => controls.stop()
    // format is inlined at every call site; re-running on its identity would
    // restart the count on every parent render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduce, duration])

  return (
    <span ref={out} className="tabular-nums">
      {value === null ? "—" : format(reduce ? value : 0)}
    </span>
  )
}

// ── HeroFigure ─────────────────────────────────────────────────────────────
// The one number a view leads with. Exactly one per tab — a second hero is
// just two stat tiles at the wrong size.
//
// `tabular-nums` is deliberate here despite big standalone figures normally
// wanting proportional ones: the value COUNTS UP on enter, and proportional
// digits reflow the box on every frame of the count.
export function HeroFigure({
  label, value, unit, sub, pontos, trendUnidade = "days", badge, accent = CAT[0], format = fmtNum,
}: {
  label: string
  value: number | null
  unit?: string
  sub?: string
  /** A série do herói COM RÓTULO em cada ponto: sem o rótulo não há o que
   *  mostrar quando o dedo para em cima de um pico. */
  pontos?: TrendPoint[]
  /** O que cada ponto da sparkline representa. A série do painel muda de passo
   *  conforme a janela (24h vem por hora), e "últimos 14 dias" cravado embaixo
   *  de 14 baldes horários é um rótulo que mente. */
  trendUnidade?: string
  badge?: ReactNode
  accent?: string
  format?: (n: number) => string
}) {
  return (
    <Plate corners accent={accent} pad="p-6 md:p-8" className="overflow-hidden">
      {/* survey pitch — the drafting ground every DogCity plate is measured on */}
      <span
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            `linear-gradient(to right, ${accent}14 1px, transparent 1px),` +
            `linear-gradient(to bottom, ${accent}14 1px, transparent 1px)`,
          backgroundSize: "7px 7px",
          maskImage: "linear-gradient(to right, #000, transparent 62%)",
          WebkitMaskImage: "linear-gradient(to right, #000, transparent 62%)",
        }}
      />
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-dusty">{label}</span>
            {badge}
          </div>
          <div className="flex items-baseline gap-3 mt-3">
            <span className="font-display font-bold text-[52px] md:text-[68px] leading-[0.9] text-snow tabular-nums">
              <MountCounter value={value} format={format} />
            </span>
            {unit && <span className="font-mono text-sm text-mist pb-1">{unit}</span>}
          </div>
          {sub && <p className="font-mono text-[11px] text-dusty mt-3">{sub}</p>}
        </div>
        {/* ⚠️ O GRÁFICO DE ABERTURA SE LÊ COM O DEDO (fundador, 28/08). Era uma
            sparkline decorativa de 200px: o pico da semana estava desenhado e
            não havia como perguntar de que dia ele era. Agora ocupa a largura
            inteira no celular, que é onde o painel é lido, e devolve rótulo,
            número e o segundo dado do ponto tocado. */}
        {pontos && pontos.length > 2 && (
          <div className="w-full md:w-[19rem] md:shrink-0">
            <TrendChart
              points={pontos}
              color={accent}
              format={format}
              caption={`last ${pontos.length} ${trendUnidade}`}
            />
          </div>
        )}
      </div>
    </Plate>
  )
}

// ── PlotGrid ───────────────────────────────────────────────────────────────
// The signature: cells on a hairline lattice, the gap IS the rule. Children
// must paint their own opaque ground (`bg-void`) or the lattice bleeds through.
export function PlotGrid({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`grid gap-px ${GRIDLINE} border ${HAIR} ${className}`}>{children}</div>
}

// ── Legend ─────────────────────────────────────────────────────────────────
// Always present at two or more series. Text wears ink; the swatch carries id.
export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-2 font-mono text-[10px] text-mist">
          <span className="w-2.5 h-[3px] shrink-0" style={{ background: it.color }} />
          {it.label}
        </li>
      ))}
    </ul>
  )
}

// ── Tooltip ────────────────────────────────────────────────────────────────
export function ChartTooltip({ active, payload, label, unit }: {
  active?: boolean
  payload?: { name?: string; value?: number | string; color?: string; fill?: string }[]
  label?: string
  unit?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className={`border ${HAIR_SOFT} bg-void/95 px-3.5 py-2.5 font-mono text-[11px]
      shadow-[0_8px_32px_rgba(0,0,0,0.75)]`}>
      {label && <div className="text-dusty mb-1.5 tracking-wide">{label}</div>}
      {payload.map((p, i) => (
        <div key={`${p.name}-${i}`} className="flex items-center gap-2">
          <span className="w-2 h-2 shrink-0" style={{ background: p.color ?? p.fill }} />
          <span className="text-mist">{p.name}</span>
          <span className="text-snow font-bold tabular-nums ml-auto pl-3">
            {typeof p.value === "number" ? fmtNum(p.value) : p.value}{unit}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── ChartFrame ─────────────────────────────────────────────────────────────
// Every plotted chart carries a table twin, so no value is ever gated behind a
// hover. The toggle swaps the plot for the same numbers as rows.
export function ChartFrame({
  eyebrow, icon, legend, table, children, className = "", live,
}: {
  eyebrow: string
  icon?: ElementType
  legend?: { label: string; color: string }[]
  table: { head: string[]; rows: (string | number)[][] }
  children: ReactNode
  className?: string
  live?: boolean
}) {
  const [asTable, setAsTable] = useState(false)
  return (
    <Plate className={className}>
      <PlateHead
        icon={icon}
        live={live}
        right={
          <button
            onClick={() => setAsTable((v) => !v)}
            aria-pressed={asTable}
            // 44px floor on touch, compact once a mouse is doing the aiming
            className={`font-mono text-[9px] uppercase tracking-[0.2em] px-3 min-h-[44px] md:min-h-[28px]
              border transition-colors ${
              asTable ? "border-lava/60 text-lava" : "border-white/10 text-dusty hover:text-mist hover:border-white/25"
            }`}
          >
            {asTable ? "gráfico" : "tabela"}
          </button>
        }
      >
        {eyebrow}
      </PlateHead>

      {asTable ? (
        <div className="max-h-[280px] overflow-auto">
          <table className="w-full font-mono text-[11px]">
            <thead className="sticky top-0 bg-void">
              <tr className="text-dusty uppercase text-[9px] tracking-[0.18em]">
                {table.head.map((h, i) => (
                  <th key={h} className={`py-2 ${i ? "text-right pl-4" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, ri) => (
                <tr key={ri} className={`border-t ${HAIR_SOFT}`}>
                  {r.map((c, ci) => (
                    <td key={ci} className={`py-2 ${ci ? "text-right pl-4 text-snow tabular-nums" : "text-mist"}`}>
                      {typeof c === "number" ? fmtNum(c) : c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}

      {legend && legend.length > 1 && !asTable && (
        <div className={`mt-4 pt-3 border-t ${HAIR_SOFT}`}><Legend items={legend} /></div>
      )}
    </Plate>
  )
}

// ── ShareBar ───────────────────────────────────────────────────────────────
// Part-to-whole without a donut. Segments separated by a 2px surface gap — the
// gap does the separating, never a stroke. Replaces the pies a 2- or 3-slice
// breakdown never justified.
export function ShareBar({ parts, total }: {
  parts: { label: string; value: number; color: string }[]
  total: number
}) {
  const safe = total || 1
  return (
    <div className="flex h-2.5 w-full gap-[2px] bg-white/[0.04]">
      {parts.map((p) => (
        <div
          key={p.label}
          className="h-full"
          style={{ width: `${(p.value / safe) * 100}%`, background: p.color }}
          title={`${p.label}: ${fmtNum(p.value)}`}
        />
      ))}
    </div>
  )
}

// ── RankRows ───────────────────────────────────────────────────────────────
// Ranked nominal categories — pages, browsers, referrers. ONE hue for every
// row: fading the bar by rank would re-encode length as colour and spend the
// identity channel on what the bar already shows.
export function RankRows({
  rows, color = CAT[0], numbered = false, icon: Icon, valueFormat = fmtNum,
}: {
  rows: { label: string; value: number; hint?: string }[]
  color?: string
  numbered?: boolean
  icon?: ElementType
  valueFormat?: (n: number) => string
}) {
  const max = rows[0]?.value || 1
  return (
    <ul className="space-y-3">
      {rows.map((r, i) => (
        <li key={r.label} className="flex items-center gap-3">
          {numbered && (
            <span className="font-mono text-[10px] text-white/25 w-4 shrink-0 tabular-nums">
              {String(i + 1).padStart(2, "0")}
            </span>
          )}
          {Icon && <Icon className="w-3.5 h-3.5 shrink-0" style={{ color }} />}
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-baseline gap-3 mb-1">
              <span className="font-mono text-[11px] text-mist truncate">{r.label}</span>
              <span className="font-mono text-[11px] text-snow shrink-0 tabular-nums">
                {valueFormat(r.value)}
                {r.hint && <span className="text-dusty ml-1.5">{r.hint}</span>}
              </span>
            </div>
            <div className="h-[3px] bg-white/[0.05]">
              <div className="h-full" style={{ width: `${(r.value / max) * 100}%`, background: color }} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

// ── EmptyPlot ──────────────────────────────────────────────────────────────
export function EmptyPlot({ height = 220, children = "Not enough data yet" }: {
  height?: number
  children?: ReactNode
}) {
  return (
    <div
      className="flex items-center justify-center font-mono text-[11px] tracking-[0.15em] uppercase text-white/25"
      style={{ height }}
    >
      {children}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// GEOGRAFIA
// ═══════════════════════════════════════════════════════════════════════════
// A versão anterior tinha um mapa fixo de 20 emojis de bandeira. O site recebe
// visita de 85 países, então 65 deles apareciam como 🌐 e o painel tratava a
// Suíça e o Paquistão como "o resto do mundo".
//
// Não existe motivo pra manter lista: a bandeira de QUALQUER código ISO-3166
// alfa-2 é o par de Regional Indicator Symbols correspondente às duas letras.
// 'B','R' → U+1F1E7 U+1F1F7 → 🇧🇷. Uma conta, 250 países, zero manutenção.
export function bandeira(iso: string): string {
  if (!iso || iso.length !== 2 || !/^[A-Za-z]{2}$/.test(iso)) return "🏴"
  const base = 0x1f1e6 // 🇦 — o indicador regional da letra A
  return String.fromCodePoint(
    ...iso.toUpperCase().split("").map((c) => base + c.charCodeAt(0) - 65),
  )
}

// Nome por extenso, traduzido pelo próprio navegador. "AT" não diz nada a
// ninguém; "Áustria" diz. Intl.DisplayNames existe em todo navegador que este
// painel suporta, mas é embrulhado porque um código inválido lança.
const nomeadorPais =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null

export function nomePais(iso: string): string {
  if (!iso || iso === "??") return "Unknown"
  try {
    return nomeadorPais?.of(iso.toUpperCase()) ?? iso
  } catch {
    return iso
  }
}

const nomeadorIdioma =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["en"], { type: "language" })
    : null

export function nomeIdioma(cod: string): string {
  try {
    return nomeadorIdioma?.of(cod) ?? cod
  } catch {
    return cod
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// NÚMEROS
// ═══════════════════════════════════════════════════════════════════════════

// Duração legível. Segundo cru ("187 s") obriga quem lê a fazer a divisão de
// cabeça toda vez, e é o número que mais se olha num painel de audiência.
export function fmtDuracao(seg: number | null | undefined): string {
  if (seg == null || !Number.isFinite(seg)) return "—"
  const s = Math.round(seg)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const r = s % 60
  if (m < 60) return r ? `${m}m ${r}s` : `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

export const fmtPct = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? "—" : `${Math.round(n * 10) / 10}%`

// ═══════════════════════════════════════════════════════════════════════════
// Delta — a variação contra a janela anterior
// ═══════════════════════════════════════════════════════════════════════════
// Número sozinho não sustenta decisão: "1.200 sessões" não diz se o que foi
// feito no período funcionou. Aqui vai o mesmo número na janela anterior de
// igual tamanho.
//
// `inverso` existe porque em rejeição e tempo de carregamento CAIR é bom. Sem
// esse parâmetro o painel pintaria de vermelho exatamente a melhora que o
// trabalho produziu — a forma mais rápida de um dashboard ensinar a coisa
// errada.
//
// A seta e o sinal viajam junto com a cor, nunca a cor sozinha: o verde e o
// vermelho de STATUS são os únicos hues reservados da paleta e precisam
// sobreviver a daltonismo e a impressão em cinza.
export function Delta({
  atual, anterior, inverso = false, sufixo = "",
}: {
  atual: number | null | undefined
  anterior: number | null | undefined
  inverso?: boolean
  sufixo?: string
}) {
  if (atual == null || anterior == null || !Number.isFinite(atual) || !Number.isFinite(anterior)) {
    return <span className="font-mono text-[10px] text-white/25">no baseline</span>
  }
  if (anterior === 0) {
    return (
      <span className="font-mono text-[10px] text-white/25 tabular-nums">
        new · was 0{sufixo}
      </span>
    )
  }
  const varPct = ((atual - anterior) / Math.abs(anterior)) * 100
  // Meio ponto percentual é ruído, não movimento. Pintar isso de verde ou
  // vermelho transforma flutuação normal em sinal e treina a ignorar a cor.
  const parado = Math.abs(varPct) < 0.5
  const bom = inverso ? varPct < 0 : varPct > 0
  const cor = parado ? INK.muted : bom ? STATUS.good : STATUS.poor
  const seta = parado ? "→" : varPct > 0 ? "↑" : "↓"
  return (
    <span
      className="font-mono text-[10px] tabular-nums inline-flex items-center gap-1"
      style={{ color: cor }}
      title={`Previous window: ${fmtNum(Math.round(anterior * 10) / 10)}${sufixo}`}
    >
      <span aria-hidden>{seta}</span>
      {parado ? "flat" : `${varPct > 0 ? "+" : ""}${varPct.toFixed(1)}%`}
    </span>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Funil — as etapas e o que se perde entre elas
// ═══════════════════════════════════════════════════════════════════════════
// Barras proporcionais à PRIMEIRA etapa, não a cada anterior: é a queda
// absoluta que interessa. E a perda entre degraus é escrita, não deduzida da
// diferença de largura — quando a queda é de 99% as duas barras ficam
// visualmente iguais a zero e a informação sumiria.
export function Funil({
  etapas, cor = CAT[0],
}: {
  etapas: { etapa: string; n: number }[]
  cor?: string
}) {
  const topo = etapas[0]?.n || 1
  return (
    <ol className="space-y-0">
      {etapas.map((e, i) => {
        const anterior = i > 0 ? etapas[i - 1].n : null
        const queda = anterior && anterior > 0 ? ((anterior - e.n) / anterior) * 100 : null
        return (
          <li key={e.etapa}>
            {i > 0 && (
              <div className="flex items-center gap-2 py-1.5 pl-1">
                <span className="text-white/20 font-mono text-[10px]" aria-hidden>↓</span>
                <span className="font-mono text-[10px] text-dusty tabular-nums">
                  {queda == null ? "—" : `loses ${queda.toFixed(1)}%`}
                </span>
              </div>
            )}
            <div className={`border ${HAIR} p-3.5 relative overflow-hidden`}>
              <div
                className="absolute inset-y-0 left-0 pointer-events-none"
                style={{ width: `${Math.max((e.n / topo) * 100, 0.5)}%`, background: `${cor}22` }}
                aria-hidden
              />
              <div className="relative flex items-baseline justify-between gap-3">
                <span className="font-mono text-[11px] text-mist">{e.etapa}</span>
                <span className="font-display font-bold text-lg text-snow tabular-nums">
                  {fmtNum(e.n)}
                </span>
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Tabela — quando a pergunta tem mais de duas colunas
// ═══════════════════════════════════════════════════════════════════════════
// "Top páginas por views" é uma lista; "esta página prende quem chega nela?"
// precisa de views, tempo, rolagem e saída lado a lado, e nenhum gráfico lê
// quatro grandezas de unidades diferentes melhor que uma tabela alinhada.
//
// O contêiner rola sozinho no eixo x: a regra da casa é que o corpo da página
// nunca rola na horizontal.
export function Tabela({
  cabecalho, linhas, alinhar = [],
}: {
  cabecalho: string[]
  linhas: ReactNode[][]
  alinhar?: ("l" | "r")[]
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse min-w-[560px]">
        <thead>
          <tr className={`border-b ${HAIR}`}>
            {cabecalho.map((h, i) => (
              <th
                key={h}
                scope="col"
                className={`py-2.5 px-3 font-mono text-[10px] uppercase tracking-[0.18em]
                  text-dusty font-normal ${alinhar[i] === "r" ? "text-right" : "text-left"}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha, i) => (
            <tr key={i} className={`border-b ${HAIR_SOFT} last:border-0 hover:bg-white/[0.02]`}>
              {linha.map((celula, j) => (
                <td
                  key={j}
                  className={`py-2.5 px-3 font-mono text-[11px] text-mist tabular-nums
                    ${alinhar[j] === "r" ? "text-right" : "text-left"}`}
                >
                  {celula}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── rótulo do eixo do tempo ────────────────────────────────────────────────
// A série muda de passo conforme a janela (24h vem por hora, o resto por dia),
// então o rótulo precisa mudar junto. Formatar hora como "08-27" repetiria a
// mesma string 24 vezes no eixo; formatar dia como "14h" perderia a data.
//
// A conversão é para o fuso de QUEM LÊ, não UTC: o banco carimba em UTC, e um
// pico às 22h de Brasília apareceria como 01h do dia seguinte se o eixo não
// convertesse — o que faria a leitura "o post das 22h funcionou" ficar
// impossível de fazer no gráfico.
export function rotuloSerie(inicio: string, granularidade: "hora" | "dia"): string {
  const d = new Date(inicio)
  if (Number.isNaN(d.getTime())) return inicio
  return granularidade === "hora"
    ? d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
    : d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" })
}

// O mesmo instante por extenso, para a tabela alternativa do ChartFrame e para
// o tooltip: ali cabe a data inteira e ela evita a ambiguidade de "14h de qual
// dia" numa janela que atravessa a meia-noite.
export function rotuloSerieLongo(inicio: string, granularidade: "hora" | "dia"): string {
  const d = new Date(inicio)
  if (Number.isNaN(d.getTime())) return inicio
  return granularidade === "hora"
    ? d.toLocaleString("en-US", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
    : d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })
}
