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
// 19/10: the card TEXT is the published contract's (/dogcity/docs, sections 6 and 8, "The
// ladder"), word for word; see the note on TIERS in dogcity-data.ts.
//
// 28/10: each card also shows WHAT THE LICENCE GIVES, not only what it costs: the building (hero image) and every item
// of the rung; see the note on TIERS in dogcity-data.ts.
// 12/11: the card was laid out again for what it holds today (building, vehicles, rifle, boat): six fixed bands and a
// two-shelf garage of equal tiles, three deeds side by side from `lg` with the bands aligned; see the note above `Tile`.
//
// Every string, threshold, perk, note, href and id below is verbatim from
// dogcity-data.ts and the markup this replaces. The Founder note is a legal
// distinction between recognition and mint licence — it is not copy.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { useDonate } from "@/components/donate/donate-modal"
import type { LicenceTier } from "@/lib/dog/licence-btc"
import { FUND_CLOSE_BLOCK, LICENCES_AT_FUND_CLOSE, TIERS } from "../dogcity-data"
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
  // ⚠️ CHAVE RENOMEADA DE "founder" PARA "citizen" EM 13/09, junto de
  // dogcity-data.ts (LANDING-V3-DESENHO.md, dobra 4). Sem este ajuste o
  // primeiro degrau perde o --lot-rest (cai no default do :root, 100%) e
  // nasce cheio em vez de 22%, quebrando a escalada visual que é o ponto
  // inteiro desta seção (ver o comentário de topo do arquivo).
  citizen: 22,
  personal: 44,
  commercial: 66,
  patron: 100,
}

interface LicenceImage { src: string; w: number; h: number; alt: string }

interface Tier {
  key: string
  name: string
  threshold: string
  /** the three licences also take Bitcoin at the same value (19/10): the docs' own sentence */
  btcLine?: string
  /** what a licence paid in Bitcoin does and does not include (docs, section 6) */
  btcNote?: string
  usd?: string
  color: string
  featured?: boolean
  perks: string[]
  note?: string
  /** the building this licence gives: the hero image, what it is (`kind`) and where its style comes from (`note`) */
  building?: LicenceImage & { kind: string; note: string }
  /** every vehicle the licence includes, in order (the moto first, each rung adds to the right); `credit` is a CC BY condition, shown on the card */
  vehicles?: Array<LicenceImage & { label: string; credit?: { text: string; href: string } }>
  /** the hunting rifle of this licence (10/11): one per rung, bound to the licence; `credit` is a CC BY condition, shown on the card */
  rifle?: LicenceImage & { label: string; credit?: { text: string; href: string } }
  /** the boat of this licence (12/11): one per rung, bound to the licence; `credit` is a CC BY condition, shown on the card */
  boat?: LicenceImage & { label: string; credit?: { text: string; href: string } }
  cta: string
}

type LicenceCount = { personal: number; commercial: number; patron: number }

// How many licences exist. Since 12/11 the licence belongs to the lot: the leaderboard sends `lot_licences` (one lot,
// one rung, migration 037) and that is the count. Before the migration, from the fund ledger the construction fund
// section already reads (one wallet, one rung: its $DOG plus any credited Bitcoin); a wallet under 10,000 $DOG is a
// founder without a licence and is not counted.
// No answer, no strip: the section never shows a number it did not read.
function useLicenceCount(): LicenceCount | null {
  const [n, setN] = useState<LicenceCount | null>(null)
  useEffect(() => {
    let alive = true
    const load = () =>
      fetch("/api/donate/leaderboard")
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          // the licence belongs to the lot (12/11): count lots when the API has them, wallets otherwise
          const byLot = j?.lot_licences
          if (alive && byLot && ["personal", "commercial", "patron"].every((k) => Number.isSafeInteger(byLot[k]) && byLot[k] >= 0)) {
            setN({ personal: byLot.personal, commercial: byLot.commercial, patron: byLot.patron })
            return
          }
          const rows: Array<{ license?: string }> = Array.isArray(j?.leaderboard) ? j.leaderboard : []
          if (!alive || rows.length === 0) return
          const c: LicenceCount = { personal: 0, commercial: 0, patron: 0 }
          for (const r of rows) if (r.license === "personal" || r.license === "commercial" || r.license === "patron") c[r.license]++
          setN(c)
        })
        .catch(() => {})
    load()
    const id = setInterval(load, 300_000)
    return () => { alive = false; clearInterval(id) }
  }, [])
  return n
}

function LicenceStrip({ n }: { n: LicenceCount | null }) {
  const total = n ? n.personal + n.commercial + n.patron : 0
  const since = Math.max(0, total - LICENCES_AT_FUND_CLOSE)
  const cells: Array<[string, number | null, string]> = [
    ["LICENCES ISSUED", n ? total : null, "#F0F0F2"],
    ["PERSONAL", n?.personal ?? null, TIERS[0].color],
    ["COMMERCIAL", n?.commercial ?? null, TIERS[1].color],
    ["PATRON", n?.patron ?? null, TIERS[2].color],
  ]
  return (
    <Reveal delay={0.5} y={10}>
      <div className={`mt-8 border ${HAIR}`} aria-live="polite">
        <dl className="grid grid-cols-2 md:grid-cols-4">
          {cells.map(([label, v, color], i) => (
            <div
              key={label}
              className={`px-5 py-4 ${i > 0 ? "border-l" : ""} ${i >= 2 ? "border-t md:border-t-0" : ""} ${i === 2 ? "border-l-0 md:border-l" : ""} ${HAIR}`}
            >
              <dt className="font-mono text-[10px] tracking-[0.22em] text-dusty">{label}</dt>
              <dd className="font-display font-bold text-3xl mt-1 tabular-nums" style={{ color }}>
                {v === null ? "\u2014" : v.toLocaleString("en-US")}
              </dd>
            </div>
          ))}
        </dl>
        <p className={`px-5 py-3 border-t ${HAIR} font-mono text-[11px] text-dusty leading-relaxed`}>
          {n
            ? `${LICENCES_AT_FUND_CLOSE} held by the 138 founders when the fund closed at block ${FUND_CLOSE_BLOCK.toLocaleString("en-US")}, ${since} issued since. Read live from the construction fund.`
            : "Reading the construction fund\u2026"}
        </p>
      </div>
    </Reveal>
  )
}

// The sats each licence costs RIGHT NOW, from the same median the quote uses (indicative only:
// the locked price comes when the wallet window opens). One fetch, refreshed once a minute; if
// there is no reliable price the line simply stays empty, the card never invents a number.
function useLicenceSats(): Record<string, number> | null {
  const [sats, setSats] = useState<Record<string, number> | null>(null)
  useEffect(() => {
    let alive = true
    const load = () =>
      fetch("/api/dogcity/licence-quote")
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          const t = j?.tiers
          if (alive) setSats(t && typeof t === "object" ? t : null)
        })
        .catch(() => { if (alive) setSats(null) })
    load()
    const id = setInterval(load, 60_000)
    return () => { alive = false; clearInterval(id) }
  }, [])
  return sats
}

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

// ── a licence picture ──────────────────────────────────────────────────────
// A transparent cut-out that fills the box its parent gives it. If the file is missing or fails to load the box stays
// (the layout never jumps) and the browser's broken-image icon and alt text never show.
function Pic({ img, className }: { img: LicenceImage; className: string }) {
  const [failed, setFailed] = useState(false)
  const ref = useRef<HTMLImageElement>(null)
  // an image that failed before hydration never fires onError in React: look at it once on mount
  useEffect(() => {
    const el = ref.current
    if (el && el.complete && el.naturalWidth === 0) setFailed(true)
  }, [])
  if (failed) return null
  return (
    <img
      ref={ref}
      src={img.src}
      alt={img.alt}
      width={img.w}
      height={img.h}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={className}
    />
  )
}

// ── what the licence gives ─────────────────────────────────────────────────
// 12/11 (the founder, on a phone): the card had grown one item at a time (vehicles in 1/3 tiles, the rifle and the boat full
// width, the yacht taller than the house) and ran past a screen and a half on an iPhone. The card is now SIX FIXED BANDS, in
// the same order on every screen: head, building, garage, CTA, "What's included" (the contract's own lines, untouched) and
// the CC BY credits on one grouped line. On a phone the bands stack. From `sm` to `lg` each card is one wide deed: the head
// across the top, the building and the garage side by side, then the CTA, the perks and the credits. From `lg` the three
// deeds stand side by side and the bands are rows of one shared `subgrid`, so building, garage, CTA and perks line up.
//
// THE GARAGE is an inventory grid of two shelves of the SAME height on a 6-column grid. The top shelf holds the vehicles of
// the rung, each in a 1/3 tile, centred: Personal 1, Commercial 2, Patron 3, the ladder read across the deck. The bottom
// shelf is always the rifle and the boat, half the width each. Every vehicle has the same tile on every card, so the same
// Cyber is the same size in Commercial and Patron, and no vehicle sits alone in a wide, empty tile. Every tile has the same
// image height (24% of the grid width, 84 px at most), the same inset and the same caption (two lines kept), with the
// picture `object-contain` in the middle: the moto and the yacht weigh the same, as in a game inventory.

type Item = LicenceImage & { label: string; credit?: { text: string; href: string } }

// the top shelf: n vehicles in 1/3 tiles, centred on the 6 columns (1: columns 3-4; 2: columns 2-3 and 4-5; 3: all six)
function vehicleSpan(i: number, n: number): string {
  if (n === 1) return "col-span-2 col-start-3"
  if (n === 2 && i === 0) return "col-span-2 col-start-2"
  return "col-span-2"
}
// the bottom shelf: the rifle and the boat share the width
const GEAR_SPAN: Record<number, string> = { 1: "col-span-6", 2: "col-span-3", 3: "col-span-2" }

function Tile({ it, span }: { it: Item; span: string }) {
  return (
    <li className={`${span} flex flex-col border border-dc-snow/[0.12] bg-dc-plate`}>
      <div className="relative mx-0.5 mt-1 h-[min(24cqi,84px)]">
        <Pic img={it} className="absolute inset-0 h-full w-full object-contain" />
      </div>
      <span className="flex min-h-[2.6em] items-center justify-center px-0.5 pb-0.5 text-center font-mono text-[9px] leading-[1.2] tracking-[0.12em] text-dc-mist">
        {it.label}
      </span>
    </li>
  )
}

function Building({ t }: { t: Tier }) {
  const b = t.building
  if (!b) return <div aria-hidden />
  return (
    <figure className="mt-4">
      <div
        // 2:1 on short screens (an iPhone SE, a phone held sideways), so the CTA still closes the first screen
        className="relative aspect-[16/9] [@media(max-height:700px)]:aspect-[2/1] max-h-[240px] w-full"
        style={{ background: `radial-gradient(70% 55% at 50% 80%, ${t.color}1A, transparent 70%)` }}
      >
        <Pic img={b} className="absolute inset-0 h-full w-full object-contain object-bottom" />
      </div>
      <span
        aria-hidden
        className="block h-px"
        style={{ background: `linear-gradient(to right, transparent, ${t.color}66 18%, ${t.color}66 82%, transparent)` }}
      />
      <figcaption className="mt-2 font-mono text-[10px] leading-snug">
        <span className="block tracking-[0.18em] text-dc-mist">{b.kind}</span>
        <span className="block mt-0.5 text-dc-dusty [text-wrap:pretty]">{b.note}</span>
      </figcaption>
    </figure>
  )
}

function Garage({ t }: { t: Tier }) {
  const vehicles: Item[] = t.vehicles ?? []
  const gear = [t.rifle, t.boat].filter(Boolean) as Item[]
  if (vehicles.length === 0 && gear.length === 0) return <div aria-hidden />
  return (
    <ul aria-label="Items included" className="mt-4 grid grid-cols-6 gap-1 [container-type:inline-size]">
      {vehicles.map((v, i) => <Tile key={v.src} it={v} span={vehicleSpan(i, vehicles.length)} />)}
      {gear.map((g) => <Tile key={g.src} it={g} span={GEAR_SPAN[gear.length] ?? "col-span-2"} />)}
    </ul>
  )
}

// "3D model: <title> by <author>, CC BY 4.0" (the form the tests lock in dogcity-data.ts) becomes one piece of the single line
const CREDIT = /^3D model: (.+) by (.+), CC BY 4\.0$/

// The CC BY credits are a condition of the models' licence: they stay on the card, but grouped on one line of fine print.
// Each "title by author" links to its source; "CC BY 4.0" links to the licence text.
function Credits({ t }: { t: Tier }) {
  const items = [...(t.vehicles ?? []), t.rifle, t.boat].filter((v): v is Item => !!v?.credit)
  if (items.length === 0) return <div aria-hidden />
  return (
    <p className="mt-4 pt-3 border-t border-dc-snow/[0.12] font-mono text-[9px] leading-relaxed text-dc-dusty sm:max-lg:col-span-2">
      3D models:{" "}
      {items.map((v, i) => {
        const m = CREDIT.exec(v.credit!.text)
        return (
          <span key={v.src}>
            {i > 0 && ", "}
            <a
              href={v.credit!.href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-dc-snow/20 underline-offset-2 hover:text-dc-mist"
            >
              {m ? `${m[1]} by ${m[2]}` : v.credit!.text}
            </a>
          </span>
        )
      })}{" "}
      <span className="whitespace-nowrap">
        (<a
          href="https://creativecommons.org/licenses/by/4.0/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-dc-snow/20 underline-offset-2 hover:text-dc-mist"
        >CC BY 4.0</a>)
      </span>
    </p>
  )
}

// ── one deed ───────────────────────────────────────────────────────────────
// lg+: the StaggerItem, the card and its contents are a 6-row `subgrid` (the six bands above); the outer grid sizes each
// band to the tallest of the three cards. No row gap: each band carries its own top margin.
const SUBGRID = "lg:row-span-6 lg:grid lg:grid-rows-subgrid"
// sm to lg: one wide deed per row, two columns: the head across, the building beside the garage, the rest across
const WIDE = "sm:max-lg:grid sm:max-lg:grid-cols-2 sm:max-lg:gap-x-6 sm:max-lg:content-start"
const ACROSS = "sm:max-lg:col-span-2"

function Deed({ t, index, count, sats }: { t: Tier; index: number; count: number; sats: number | null }) {
  const { ref, onPointerMove } = useSpotlight<HTMLDivElement>()
  // $DOG or BTC, chosen on the card (licences only); the wallet window opens on that choice
  const [pay, setPay] = useState<"dog" | "btc">("dog")
  // 19/10: o CTA abre a janela da carteira JÁ no valor do degrau (o limiar sai da própria
  // `threshold`, "10,000 DOG" → 10000); Citizen é "Any amount", abre sem valor
  const { open: openWallet } = useDonate()
  const amount = Number(t.threshold.replace(/[^\d]/g, "")) || undefined
  const fill = LOT_REST_FILL[t.key] ?? 22
  const slot = index * 0.075   // this card's place in the deck's stagger

  return (
    <StaggerItem className={SUBGRID}>
      <div
        ref={ref}
        onPointerMove={onPointerMove}
        className={`dc-deed spotlight-card relative h-full border px-3.5 pt-6 pb-4 sm:p-6 lg:px-5 lg:pb-5 flex flex-col ${SUBGRID} transition-colors duration-500 ${
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
            BUILDING LICENCE
          </span>
        )}

        {/* contents sit above the lot: a positioned wrapper, no z-index war. The six bands, in order: head, building,
            garage, CTA, what's included, credits (see the note above `Tile`). The CTA comes right after the garage so
            that, on a phone, the name, the price, the building, every item and the button fit in the first screen */}
        <div className={`relative flex flex-col flex-1 ${WIDE} ${SUBGRID}`}>
          {/* 1 · head */}
          <div className={ACROSS}>
            <div className="flex items-baseline justify-between gap-3 font-mono text-[9px] tracking-[0.25em] text-dc-dusty">
              <span>THE LADDER</span>
              <span className="tabular-nums shrink-0">{pad2(index + 1)} / {pad2(count)}</span>
            </div>

            {/* colour-as-data: `bg-current` inherits the tier hue from the
                wrapper's inline `color`, so DrawRule stays the shared primitive */}
            <span aria-hidden className="block" style={{ color: t.color }}>
              <DrawRule className="mt-3 w-10" color="bg-current" delay={0.9 + slot} duration={0.7} />
            </span>

            {/* the name and the price on the left, the $DOG / BTC choice on the right; it wraps under them when the
                card is too narrow (the three-up tablet) */}
            <div className="mt-3 flex flex-wrap items-end justify-between gap-x-2 gap-y-2.5 sm:gap-x-3">
              <div className="min-w-0">
                <div className="font-display font-bold text-xl" style={{ color: t.color }}>{t.name}</div>
                <div className="font-mono text-sm text-dc-snow mt-0.5 tabular-nums">
                  {t.threshold}{t.usd && <span className="text-dc-dusty text-[11px]"> · {t.usd}</span>}
                </div>
                {t.btcLine && (
                  <>
                    <p className="font-mono text-[11px] text-dc-dusty mt-1">{t.btcLine}</p>
                    <p className="font-mono text-[12px] text-dc-mist tabular-nums min-h-[1.25em]" aria-live="polite">
                      {sats && Number.isSafeInteger(sats) && sats > 0 ? `${sats.toLocaleString("en-US")} sats now` : " "}
                    </p>
                  </>
                )}
              </div>
              {t.btcLine && (
                <div role="group" aria-label="Pay with" className="inline-flex shrink-0 border border-dc-snow/[0.15]">
                  {(["dog", "btc"] as const).map((a) => (
                    <button
                      key={a}
                      type="button"
                      aria-pressed={pay === a}
                      onClick={() => setPay(a)}
                      className={`px-3 sm:px-4 py-2.5 min-h-[44px] min-w-[52px] font-mono text-[11px] tracking-[0.1em] transition-colors ${
                        pay === a ? "bg-dc-snow/[0.1] text-dc-snow" : "text-dc-dusty hover:text-dc-snow"
                      }`}
                    >
                      {a === "dog" ? "$DOG" : "BTC"}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {t.btcNote && (
              <p className="font-mono text-[11px] text-dc-dusty leading-relaxed mt-2.5">{t.btcNote}</p>
            )}
          </div>

          {/* 2 · the building */}
          <Building t={t} />

          {/* 3 · the garage: every item of the licence, one shelf of vehicles, one of gear */}
          <Garage t={t} />

          {/* 4 · the call to action */}
          <div className={`mt-4 ${ACROSS}`}>
            <button
              type="button"
              onClick={() =>
                openWallet(
                  t.btcLine
                    ? { asset: pay, amount, tier: t.key as LicenceTier }
                    : { asset: "dog", amount },
                )
              }
              // min-h-[44px]: these measured 192x40, under the 44px touch floor
              className={`w-full inline-flex justify-center items-center gap-2 px-4 py-2.5 min-h-[44px] font-mono text-[12px] font-bold transition-colors ${
                t.featured
                  ? "text-void bg-lava hover:bg-lava-light"
                  : "text-dc-snow border border-dc-snow/20 hover:border-dc-snow/[0.45]"
              }`}
            >
              {t.cta}
            </button>
          </div>

          {/* 5 · what's included: the contract's own lines, word for word (the tests lock them in dogcity-data.ts) */}
          <div className={`mt-5 ${ACROSS}`}>
            <p className="font-mono text-[9px] tracking-[0.25em] text-dc-dusty">WHAT&apos;S INCLUDED</p>
            {/* two columns on the wide deed, so a line never runs the whole card */}
            <ul className="mt-2 sm:max-lg:columns-2 sm:max-lg:gap-x-6">
              {t.perks.map((p) => (
                <li key={p} className="mb-1.5 last:mb-0 break-inside-avoid text-[12px] text-dc-mist leading-[1.5] flex gap-2 [text-wrap:pretty]">
                  <span aria-hidden className="text-lava shrink-0">▸</span>{p}
                </li>
              ))}
            </ul>
            {t.note && (
              <p className="mt-3 pt-3 border-t border-dc-snow/[0.12] font-mono text-[10px] text-dc-dusty leading-relaxed">
                {t.note}
              </p>
            )}
          </div>

          {/* 6 · the CC BY credits, one grouped line */}
          <Credits t={t} />
        </div>
      </div>
    </StaggerItem>
  )
}

export default function Section({}) {
  const tiers = TIERS as Tier[]
  const licenceSats = useLicenceSats()
  const licenceCount = useLicenceCount()

  return (
    <section id="tiers" className="scroll-mt-16">
      {/* 23/10: continua a frase do fundo (construction-fund.tsx, parte "topo"), sem a linha e o respiro de seção nova */}
      <div className="max-w-6xl mx-auto px-6 md:px-10 pt-12 md:pt-16 pb-12 md:pb-16">
        <SectionHead
          eyebrow="THE LICENCES"
          title="Three licences to build on your deed."
          sub="A licence is paid once, in $DOG or the same value in Bitcoin, to the construction fund, and it belongs to the lot. It is never sold on its own: when the deed changes hands, the licence goes with it. Every licence includes everything in the one below it. Moving up costs only the difference: the payments applied to a lot add up, and nobody buys two licences for the same lot. A higher licence changes how a building is used, not how big it is. Mint your lot, take a licence, and your house stands in the city."
        />

        <LicenceStrip n={licenceCount} />

        {/* lg+: three deeds side by side; each spans the six band rows (`subgrid`), so the bands line up across them */}
        <Stagger className="mt-6 grid gap-4 lg:grid-cols-3 lg:gap-x-4 lg:gap-y-0" delay={0.62} step={0.075}>
          {tiers.map((t, i) => (
            <Deed key={t.key} t={t} index={i} count={tiers.length} sats={licenceSats?.[t.key] ?? null} />
          ))}
        </Stagger>

        {/* ⚠️ SAIDA PROPRIA DA ESCADA, e UMA so, FORA do laco dos degraus. Quem se convence
            olhando a escada nao tinha para onde ir: o unico link para a pagina de oferta
            ficava la embaixo, na objecao "e se eu esperar?". Aqui e o momento em que a pessoa
            acabou de comparar os quatro. */}
        <div className="mt-8">
          <a
            href="/dogcity/founders"
            className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.12em] text-dusty hover:text-mist transition-colors duration-200"
          >
            THE 138 FOUNDERS WHO FUNDED THE CITY
            <span aria-hidden="true">&rarr;</span>
          </a>
        </div>
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
