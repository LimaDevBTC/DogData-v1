"use client"

// The Runestone dossier, section by section.
//
// Visual language is the plot-map kit from app/analytics/dashboard/ui.tsx:
// square hairline plates, one hue per series, marks in #E8660D. The kit ships
// pt-BR number formatting and two Portuguese chrome labels, so this file
// carries its own en-US formatters and its own Frame; everything else is the
// shared instrument.

import { useState, type ReactNode } from "react"
import {
  Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts"
import Link from "next/link"
import { Check, Copy, ExternalLink } from "lucide-react"
import {
  AXIS_TICK, CAT, GRID, HAIR, HAIR_SOFT, Legend, Plate, PlateHead,
  PlotGrid, RankRows, STATUS, SectionHead, ShareBar, StatTile,
} from "@/app/analytics/dashboard/ui"
import type { Dossier, HolderRow } from "./types"

// ── formatters (en-US; the shared kit formats pt-BR) ───────────────────────
export const n0 = (n: number) => Math.round(n).toLocaleString("en-US")
export const n1 = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 1 })
export const pct = (n: number) => `${n.toFixed(1)}%`
export const compact = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(2)}B`
  : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M`
  : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K`
  : n0(n)
export const btc = (sats: number) => `${(sats / 1e8).toFixed(4)} BTC`
export const shortAddr = (a: string) => `${a.slice(0, 8)}…${a.slice(-6)}`
// as chaves do banco sao estaveis por contrato de API; o rotulo e livre.
// dog_legend mostra "DOG Supporter" por decisao de produto.
export const BEHAVIOR_LABEL: Record<string, string> = {
  satoshi_visionary: "Satoshi Visionary",
  btc_maximalist: "BTC Maximalist",
  rune_master: "Rune Master",
  ordinal_believer: "Ordinal Believer",
  dog_legend: "DOG Supporter",
  diamond_paws: "Diamond Paws",
  hodl_hero: "Hodl Hero",
  steady_holder: "Steady Holder",
  profit_taker: "Profit Taker",
  early_exit: "Early Exit",
  panic_seller: "Panic Seller",
  paper_hands: "Paper Hands",
}
export const behaviorLabel = (k: string) => BEHAVIOR_LABEL[k] ?? k.replace(/_/g, " ")

export const monthLabel = (m: string) => {
  const [y, mm] = m.split("-")
  return `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][+mm - 1]} ${y.slice(2)}`
}

// ── chrome ─────────────────────────────────────────────────────────────────
export function Frame({
  eyebrow, table, children, legend, className = "", right,
}: {
  eyebrow: string
  table?: { head: string[]; rows: (string | number)[][] }
  children: ReactNode
  legend?: { label: string; color: string }[]
  className?: string
  right?: ReactNode
}) {
  const [asTable, setAsTable] = useState(false)
  return (
    <Plate className={className}>
      <PlateHead
        right={
          right ?? (table ? (
            <button
              onClick={() => setAsTable(v => !v)}
              aria-pressed={asTable}
              className={`font-mono text-[9px] uppercase tracking-[0.2em] px-3 min-h-[44px] md:min-h-[28px]
                border transition-colors ${asTable
                  ? "border-lava/60 text-lava"
                  : "border-white/10 text-dusty hover:text-mist hover:border-white/25"}`}
            >
              {asTable ? "chart" : "table"}
            </button>
          ) : undefined)
        }
      >
        {eyebrow}
      </PlateHead>

      {asTable && table ? (
        <div className="max-h-[300px] overflow-auto">
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
                      {typeof c === "number" ? n0(c) : c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : children}

      {legend && legend.length > 1 && !asTable && (
        <div className={`mt-4 pt-3 border-t ${HAIR_SOFT}`}><Legend items={legend} /></div>
      )}
    </Plate>
  )
}

function Tip({ active, payload, label, fmt }: {
  active?: boolean
  payload?: { name?: string; value?: number | string; color?: string; fill?: string }[]
  label?: string
  fmt?: (n: number) => string
}) {
  if (!active || !payload?.length) return null
  const f = fmt ?? n0
  return (
    <div className={`border ${HAIR_SOFT} bg-void/95 px-3.5 py-2.5 font-mono text-[11px]
      shadow-[0_8px_32px_rgba(0,0,0,0.75)]`}>
      {label && <div className="text-dusty mb-1.5 tracking-wide">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 shrink-0" style={{ background: p.color ?? p.fill }} />
          <span className="text-mist">{p.name}</span>
          <span className="text-snow font-bold tabular-nums ml-auto pl-3">
            {typeof p.value === "number" ? f(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// rotulo a esquerda, valor a direita, e nenhum dos dois pode empurrar a linha
// alem da placa: o lado do valor encolhe e quebra, o rotulo segura no maximo
// metade da largura.
export function Fact({ k, v, sub }: { k: string; v: ReactNode; sub?: string }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-2.5 border-b ${HAIR_SOFT} last:border-0`}>
      <span className="font-mono text-[11px] text-dusty shrink-0 max-w-[45%]">{k}</span>
      <span className="text-right min-w-0 flex-1">
        <span className="font-mono text-[12px] text-snow tabular-nums break-words">{v}</span>
        {sub && (
          <span className="block font-mono text-[10px] text-dusty/70 mt-0.5 break-words leading-relaxed">
            {sub}
          </span>
        )}
      </span>
    </div>
  )
}

// O endereço leva para a nossa própria página de carteira, não para fora: a
// análise do endereço mora aqui. O mempool fica como ícone separado, que é o
// mesmo arranjo de /airdrop/lost e /metrics/holders-by-age.
function Addr({ a, note }: { a: string; note?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <Link
        href={`/address/bitcoin/${a}`}
        className="font-mono text-[11px] text-mist hover:text-lava transition-colors truncate"
        title={a}
      >
        {shortAddr(a)}
      </Link>
      {note && <span className="font-mono text-[10px] text-dusty/60 shrink-0">{note}</span>}
      <button
        type="button"
        aria-label={`Copy address ${a}`}
        onClick={() => {
          navigator.clipboard?.writeText(a)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1400)
        }}
        className="shrink-0 text-dusty hover:text-snow transition-colors"
      >
        {copied
          ? <Check className="w-2.5 h-2.5" style={{ color: STATUS.good }} />
          : <Copy className="w-2.5 h-2.5" />}
      </button>
      <a
        href={`https://mempool.space/address/${a}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open ${a} on mempool.space`}
        className="shrink-0 text-dusty hover:text-lava transition-colors"
      >
        <ExternalLink className="w-2.5 h-2.5" />
      </a>
    </span>
  )
}

// ── 1. custody ─────────────────────────────────────────────────────────────
export function Custody({ d }: { d: Dossier }) {
  const c = d.custody
  const x = d.airdrop_cross
  return (
    <section className="space-y-6">
      <SectionHead
        eyebrow="WHO HOLDS IT"
        title="Custody today"
        sub={`${n0(c.stones)} stones across ${n0(c.holders)} addresses. The median address holds ${c.median} stone, the largest holds ${n0(c.max)}.`}
      />
      <div className="grid lg:grid-cols-2 gap-4">
        <Frame
          eyebrow="Holders by stones held"
          table={{
            head: ["Band", "Addresses", "Stones"],
            rows: c.buckets.map(b => [b.label, b.holders, b.stones]),
          }}
        >
          <RankRows
            rows={c.buckets.map(b => ({
              label: b.label === "1" ? "1 stone" : `${b.label} stones`,
              value: b.holders,
              hint: `· ${n0(b.stones)} stones`,
            }))}
            valueFormat={n0}
          />
        </Frame>

        <div className="space-y-4">
          <Plate>
            <PlateHead>Concentration</PlateHead>
            <Fact k="Top 10 addresses" v={pct(c.share_top10)} sub="of all stones" />
            <Fact k="Top 100 addresses" v={pct(c.share_top100)} />
            <Fact k="Top 1,000 addresses" v={pct(c.share_top1000)} />
            <Fact k="Gini coefficient" v={c.gini.toFixed(4)} sub="0 is perfectly even, 1 is one owner" />
            <Fact k="Single stone holders" v={`${n0(c.singletons)} (${pct((c.singletons / c.holders) * 100)})`} />
          </Plate>
          <Plate>
            <PlateHead>Veteran hands vs new hands</PlateHead>
            <ShareBar
              total={c.stones}
              parts={[
                { label: "Held by airdrop wallets", value: x.stones_veteran, color: CAT[0] },
                { label: "Held by wallets that arrived later", value: x.stones_new, color: CAT[1] },
              ]}
            />
            <div className="mt-3">
              <Legend items={[
                { label: "Airdrop wallets", color: CAT[0] },
                { label: "Arrived later", color: CAT[1] },
              ]} />
            </div>
            <div className="flex justify-between mt-2 font-mono text-[11px]">
              <span className="text-mist">{n0(x.stones_veteran)} veteran <span className="text-dusty">({pct((x.stones_veteran / c.stones) * 100)})</span></span>
              <span className="text-mist">{n0(x.stones_new)} new <span className="text-dusty">({pct((x.stones_new / c.stones) * 100)})</span></span>
            </div>
            <p className="text-[12px] text-mist leading-relaxed mt-4">
              A wallet counts as veteran if it received the DOG airdrop at block {n0(x.snapshot_block)}, which
              is to say it held a Runestone in April 2024 and still holds one now.
            </p>
          </Plate>
        </div>
      </div>
    </section>
  )
}

// ── 2. dormancy ────────────────────────────────────────────────────────────
export function Dormancy({ d }: { d: Dossier }) {
  const dm = d.dormancy
  const price = d.crosses?.price_moves
  const byMonth = dm.by_month.map(m => {
    const p = price?.monthly.find(x => x.month === m.month)
    return { ...m, label: monthLabel(m.month), price: p?.avg_price ?? null }
  })
  const hasPrice = byMonth.some(m => m.price != null)

  return (
    <section className="space-y-6">
      <SectionHead
        eyebrow="THE STONE CLOCK"
        title="Nobody is moving these"
        sub={`${pct(dm.age_buckets[0]?.pct ?? 0)} of the collection has not moved in two years or more, and ${n0(dm.never_moved)} stones have never moved at all since the day they were inscribed.`}
      />
      <PlotGrid className="grid-cols-2 lg:grid-cols-4">
        <StatTile label="Never moved" value={dm.never_moved} format={n0}
          sub={`${pct(dm.never_moved_pct)} still sit in the exact output they were inscribed into`} />
        <StatTile label="Still at rest 2y+" value={dm.age_buckets[0]?.stones ?? 0} format={n0}
          accent={CAT[1]} sub={`${pct(dm.age_buckets[0]?.pct ?? 0)} of supply`} />
        <StatTile label="Moved in 30 days" value={dm.age_buckets[dm.age_buckets.length - 1]?.stones ?? 0} format={n0}
          accent={CAT[2]} sub="every stone that changed output in the last month" />
        <StatTile label="Sealed vaults" value={dm.vaults} format={n0}
          sub="addresses where every stone they own has never moved" />
      </PlotGrid>

      <div className="grid lg:grid-cols-3 gap-4">
        <Frame
          className="lg:col-span-2 min-w-0"
          eyebrow={hasPrice ? "Stones by the month they last moved, against the DOG price" : "Stones by the month they last moved"}
          legend={hasPrice ? [
            { label: "Stones whose last move was that month", color: CAT[0] },
            { label: "Average DOG price", color: CAT[1] },
          ] : undefined}
          table={{
            head: ["Month", "Stones", "Avg price"],
            rows: byMonth.map(m => [m.label, m.stones, m.price ? `$${m.price.toFixed(6)}` : "n/a"]),
          }}
        >
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={byMonth} margin={{ top: 8, right: hasPrice ? 8 : 0, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID }} interval="preserveStartEnd" minTickGap={24} />
              <YAxis yAxisId="l" tick={AXIS_TICK} tickLine={false} axisLine={false} width={48} tickFormatter={compact} />
              {hasPrice && (
                <YAxis yAxisId="r" orientation="right" tick={AXIS_TICK} tickLine={false} axisLine={false}
                  width={58} tickFormatter={(v: number) => `$${v.toFixed(4)}`} />
              )}
              <Tooltip content={<Tip />} cursor={{ fill: "#ffffff08" }} />
              <Bar yAxisId="l" dataKey="stones" name="Last moved here" fill={CAT[0]} isAnimationActive={false} />
              {hasPrice && (
                <Line yAxisId="r" type="monotone" dataKey="price" name="DOG price" stroke={CAT[1]}
                  strokeWidth={1.5} dot={false} connectNulls isAnimationActive={false} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
          <p className="text-[12px] text-mist leading-relaxed mt-4">
            Each bar counts the stones whose most recent movement happened that month, so the March and April
            2024 columns are largely the distribution itself. A bar only ever counts a stone once, at its
            latest move, so this is not a transfer volume chart.
          </p>
        </Frame>

        <Frame
          eyebrow="Time since last move"
          table={{ head: ["Age", "Stones", "Share"], rows: dm.age_buckets.map(b => [b.label, b.stones, pct(b.pct)]) }}
        >
          <RankRows
            rows={dm.age_buckets.map(b => ({ label: b.label, value: b.stones, hint: `· ${pct(b.pct)}` }))}
            valueFormat={n0}
          />
          <p className="text-[12px] text-mist leading-relaxed mt-5">
            This is the long term holder lens we run on DOG, pointed at an ordinal collection instead of a
            rune. The shape is the same and the tail is heavier.
          </p>
        </Frame>
      </div>
    </section>
  )
}

// ── 3. the airdrop cross ───────────────────────────────────────────────────
export function Cross({ d }: { d: Dossier }) {
  const x = d.airdrop_cross
  const m = x.matrix
  const cells: { k: string; v: number; note: string; accent: string }[] = [
    { k: "Still has both", v: m.stone_and_dog, note: "stone and DOG, at the same address", accent: CAT[0] },
    { k: "Stone yes, DOG no", v: m.stone_no_dog, note: "kept the artifact, let the rune go", accent: CAT[0] },
    { k: "Stone no, DOG yes", v: m.no_stone_dog, note: "the rarest of the four", accent: CAT[2] },
    { k: "Neither", v: m.no_stone_no_dog, note: "holds no stone and no DOG today", accent: CAT[2] },
  ]
  const cohort = x.cohort_addresses
  return (
    <section className="space-y-6">
      <SectionHead
        eyebrow="AIRDROP COHORT vs TODAY"
        title="What happened to the class of April 2024"
        sub={`${n0(cohort)} addresses received DOG for holding a Runestone at block ${n0(x.snapshot_block)}. ${n0(d.tip_height - x.snapshot_block)} blocks later, here is where they are.`}
      />

      <PlotGrid className="grid-cols-2 lg:grid-cols-4">
        <StatTile label="Still holding" value={x.still_here} format={n0}
          sub={`${pct((x.still_here / cohort) * 100)} of the original cohort still owns a stone`} />
        <StatTile label="Gone" value={x.left} format={n0} accent={CAT[2]}
          sub="received the airdrop, hold no stone today" />
        <StatTile label="Arrived after" value={x.entered} format={n0} accent={CAT[1]}
          sub="holders today who were never in the airdrop" />
        <StatTile label="Untouched since" value={x.untouched} format={n0}
          sub="hold the exact same number of stones as in April 2024" />
      </PlotGrid>

      <div className="grid lg:grid-cols-2 gap-4">
        <Plate>
          <PlateHead>The four quadrants</PlateHead>
          <div className={`grid grid-cols-2 gap-px ${HAIR} border`} style={{ background: "#ffffff1a" }}>
            {cells.map(c => (
              <div key={c.k} className="bg-void p-4 min-h-[112px] flex flex-col justify-between">
                <div className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 shrink-0 mt-1" style={{ background: c.accent }} />
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-dusty leading-relaxed">{c.k}</span>
                </div>
                <div className="mt-3">
                  <div className="font-display font-bold text-[26px] leading-none text-snow tabular-nums">{n0(c.v)}</div>
                  <span className="font-mono text-[10px] text-dusty/70">{c.note}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[12px] text-mist leading-relaxed mt-4">
            Only {n0(m.no_stone_dog)} wallets let the stone go and kept the rune, against
            {" "}{n0(m.stone_no_dog)} that did the reverse. The chain shows what an address holds, never why:
            a stone can leave a wallet through a sale, a gift or a move to another wallet of the same owner.
          </p>
        </Plate>

        <Frame
          eyebrow="Stones today, by what that wallet did with its DOG"
          table={{
            head: ["Behavior", "Addresses", "Stones"],
            rows: x.by_behavior.map(b => [behaviorLabel(b.pattern), b.addresses, b.stones_today]),
          }}
        >
          <RankRows
            rows={x.by_behavior.slice(0, 8).map(b => ({
              label: behaviorLabel(b.pattern),
              value: b.stones_today,
              hint: `· ${n0(b.addresses)} addr`,
            }))}
            valueFormat={n0}
          />
          <p className="text-[12px] text-mist leading-relaxed mt-5">
            The labels come from our DOG behavioral model. Read it as a cross, not a judgement: a wallet
            tagged paper hands on the rune can still be sitting on a stone it has never moved.
          </p>
        </Frame>
      </div>
    </section>
  )
}

// ── 4. provenance ──────────────────────────────────────────────────────────
export function Provenance({ d }: { d: Dossier }) {
  const p = d.provenance
  // sat_years so traz os anos com pedras. sem preencher os vazios, o eixo
  // categorico encosta 2021 em 2024 e o vao some justamente na hora em que o
  // texto aponta pra ele.
  const anos = p.sat_years.map(y => y.year)
  const years = Array.from(
    { length: Math.max(...anos) - Math.min(...anos) + 1 },
    (_, i) => {
      const year = Math.min(...anos) + i
      return { year, label: String(year), stones: p.sat_years.find(y => y.year === year)?.stones ?? 0 }
    },
  )
  const vazios = years.filter(y => y.stones === 0).map(y => y.year)
  const gap = { from: Math.min(...vazios, 2022), to: Math.max(...vazios, 2023) }
  return (
    <section className="space-y-6">
      <SectionHead
        eyebrow="WHAT THE STONES SIT ON"
        title="Provenance"
        sub="Every stone lives on one specific satoshi. Those sats were mined across fifteen years of Bitcoin, and the spread is not random."
      />
      <div className="grid lg:grid-cols-3 gap-4">
        <Frame
          className="lg:col-span-2 min-w-0"
          eyebrow="Stones by the year their sat was mined"
          table={{ head: ["Year", "Stones"], rows: years.map(y => [y.label, y.stones]) }}
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={years} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID }} />
              <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={48} tickFormatter={compact} />
              <Tooltip content={<Tip />} cursor={{ fill: "#ffffff08" }} />
              <Bar dataKey="stones" name="Stones" fill={CAT[0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[12px] text-mist leading-relaxed mt-4">
            No stone in the collection sits on a sat mined between {gap.from} and {gap.to}. The sats came out
            of a handful of old coin bases, so the collection carries a fingerprint of whoever funded it.
          </p>
        </Frame>

        <div className="space-y-4">
          <Plate>
            <PlateHead>The oldest sat in the collection</PlateHead>
            <Fact k="Mined in block" v={n0(p.oldest_sat.sat_block)} sub={`year ${p.oldest_sat.sat_year}`} />
            <Fact k="Inscription" v={`#${n0(p.oldest_sat.number)}`} />
            <Fact k="Sat" v={n0(p.oldest_sat.sat)} />
            <div className="pt-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-dusty block mb-2">Currently held by</span>
              <Addr a={p.oldest_sat.address} />
            </div>
          </Plate>
          {p.uncommon && (
            <Plate>
              <PlateHead swatch={CAT[2]}>The only uncommon sat</PlateHead>
              <p className="text-[12px] text-mist leading-relaxed mb-3">
                One stone out of {n0(d.collection.supply)} sits on the first sat of its block, the rarity tier
                ordinal theory calls uncommon. Every other stone in the collection is common.
              </p>
              <Fact k="Inscription" v={`#${n0(p.uncommon.number)}`} />
              <Fact k="Sat block" v={n0(p.uncommon.sat_block)} />
              <div className="pt-3"><Addr a={p.uncommon.address} /></div>
            </Plate>
          )}
        </div>
      </div>

      <Plate>
        <PlateHead swatch={CAT[2]}>Relics: stones that are not coming back</PlateHead>
        <p className="text-[12px] text-mist leading-relaxed mb-5 max-w-3xl">
          The distribution followed the ordinals holder list mechanically, so addresses nobody can spend from
          were served too. {p.burned_stones} stones sit in burn addresses today, and the parent of the whole
          collection was sent to the genesis address. One of the three is unspendable by construction, the
          other two by the fact that no key for them has ever surfaced.
        </p>
        <div className="grid sm:grid-cols-2 gap-px" style={{ background: "#ffffff1a" }}>
          {p.relics.map(r => (
            <div key={r.address} className="bg-void p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-1.5 h-1.5 shrink-0" style={{ background: r.burned ? CAT[2] : CAT[0] }} />
                <span className="font-mono text-[11px] text-snow">{r.name}</span>
                <span className="font-mono text-[10px] text-dusty ml-auto tabular-nums">
                  {r.stones} {r.stones === 1 ? "stone" : "stones"}
                </span>
              </div>
              <p className="font-mono text-[10px] text-dusty/80 mb-2">{r.note}</p>
              <Addr a={r.address} />
            </div>
          ))}
        </div>
      </Plate>
    </section>
  )
}

// ── 5. how it was built ────────────────────────────────────────────────────
export function Built({ d }: { d: Dossier }) {
  const c = d.collection
  const h = d.how_built
  const r = d.run ?? {
    stones: c.supply, blocks: c.blocks_used, hours: 0,
    first_block: c.first_block, last_block: c.last_block,
    model_block: null as number | null, model_lead_days: null as number | null,
  }
  return (
    <section className="space-y-6">
      <SectionHead
        eyebrow="ON CHAIN ARCHITECTURE"
        title="How 112,384 inscriptions weigh almost nothing"
        sub="The collection is a single 3D model that every stone points at. That is why it could be minted at this size at all."
      />
      <div className="grid lg:grid-cols-2 gap-4">
        <Plate>
          <PlateHead>The inscription run</PlateHead>
          <Fact k="Stones inscribed" v={n0(r.stones)} sub={r.hours ? `in ${r.blocks} blocks over ${r.hours} hours` : `in ${r.blocks} blocks`} />
          <Fact k="The run" v={`${n0(r.first_block)} to ${n0(r.last_block)}`}
            sub={r.model_block ? `the model they delegate to landed ${r.model_lead_days} days earlier, in block ${n0(r.model_block)}` : undefined} />
          <Fact k="Total fees paid" v={btc(c.total_fees_sats)} sub="paid to miners by the collection itself" />
          <Fact k="Most expensive single inscription" v={btc(h.delegate_fee_sats)} sub={`#${n0(h.delegate_number)}, the model everything points at`} />
          <Fact k="Parent inscription fee" v={btc(c.parent_fee_sats)} sub={`#${n0(c.parent_number)}, ${(c.parent_bytes / 1e6).toFixed(2)} MB of ${h.parent_content_type}`} />
        </Plate>
        <Plate>
          <PlateHead swatch={CAT[1]}>Delegation</PlateHead>
          <Fact k="Bytes carried by a stone" v={`${h.child_bytes_each}`} sub={`sampled ${h.sampled} of the ${n0(r.stones)}, all zero`} />
          <Fact k="What they delegate to" v={`#${n0(h.delegate_number)}`} sub={h.delegate_content_type} />
          <Fact k="Size of that one file" v={`${(h.delegate_bytes / 1e6).toFixed(2)} MB`} />
          <Fact k="Parent, now beyond reach" v={`#${n0(c.parent_number)}`} sub={`${(c.parent_bytes / 1e6).toFixed(2)} MB, ${h.parent_content_type}`} />
          <p className="text-[12px] text-mist leading-relaxed mt-4">
            Every stone is an empty envelope with a pointer. Sending the parent to an address nobody can spend
            from closed the supply, because a new child can no longer be signed into the collection.
          </p>
          <p className="text-[12px] text-mist leading-relaxed mt-3">
            The model is itself the {n0(c.supply)}th child, which is why the collection counts
            {" "}{n0(c.supply)} and the airdrop counts {n0(r.stones)}. It still sits with the address that
            inscribed it, so the holder table below shows that address holding one.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={`https://ordinals.com/inscription/${c.parent_id}`} target="_blank" rel="noopener noreferrer"
              className="font-mono text-[10px] uppercase tracking-[0.18em] px-3 py-2 border border-white/10 text-dusty hover:text-lava hover:border-lava/40 transition-colors">
              Parent on ordinals.com
            </a>
            <a href={`https://ordinals.com/inscription/${h.delegate_target}`} target="_blank" rel="noopener noreferrer"
              className="font-mono text-[10px] uppercase tracking-[0.18em] px-3 py-2 border border-white/10 text-dusty hover:text-lava hover:border-lava/40 transition-colors">
              The 3D model
            </a>
          </div>
        </Plate>
      </div>
    </section>
  )
}

// ── 6. top holders table ───────────────────────────────────────────────────
export function Leaderboard({ rows, total, loading, page, pages, onPage, query, onQuery, cohort, onCohort }: {
  rows: HolderRow[]
  total: number
  loading: boolean
  page: number
  pages: number
  onPage: (p: number) => void
  query: string
  onQuery: (q: string) => void
  cohort: string
  onCohort: (c: string) => void
}) {
  const [draft, setDraft] = useState(query)
  return (
    <section className="space-y-6">
      <SectionHead
        eyebrow="LOOKUP"
        title="Every holder, ranked"
        sub="Search any Bitcoin address to see what it holds today and what it did with the airdrop."
      />
      <Plate pad="p-0">
        <div className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 border-b ${HAIR_SOFT}`}>
          <div className="flex gap-1">
            {[["", "all"], ["veteran", "airdrop wallets"], ["new", "arrived later"]].map(([v, label]) => (
              <button
                key={v}
                onClick={() => onCohort(v)}
                aria-pressed={cohort === v}
                className={`font-mono text-[10px] uppercase tracking-[0.16em] px-3 py-2 border transition-colors ${
                  cohort === v ? "border-lava/60 text-lava" : "border-white/10 text-dusty hover:text-mist hover:border-white/25"}`}
              >
                {cohort === v ? "\u00b7 " : ""}{label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 sm:ml-auto">
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => e.key === "Enter" && onQuery(draft.trim())}
              aria-label="Search holders by Bitcoin address"
              placeholder="bc1p…"
              className="h-9 px-3 bg-white/[0.03] border border-white/10 text-snow text-[12px] font-mono
                placeholder:text-dusty/50 focus:outline-none focus:border-lava/40 w-full sm:w-64"
            />
            <button
              onClick={() => onQuery(draft.trim())}
              className="font-mono text-[10px] uppercase tracking-[0.16em] px-4 border border-white/10
                text-dusty hover:text-lava hover:border-lava/40 transition-colors"
            >
              find
            </button>
          </div>
        </div>

        <div className={`overflow-x-auto transition-opacity ${loading ? "opacity-40" : ""}`}>
          <table className="w-full font-mono text-[11px] min-w-[640px]">
            <thead>
              <tr className={`text-dusty uppercase text-[9px] tracking-[0.18em] border-b ${HAIR_SOFT}`}>
                <th className="text-left py-3 pl-4 w-14">#</th>
                <th className="text-left py-3">Address</th>
                <th className="text-right py-3">Stones</th>
                <th className="text-right py-3">Share</th>
                <th className="text-right py-3">In airdrop</th>
                <th className="text-right py-3 pr-4">DOG today</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.address} className={`border-b ${HAIR_SOFT} hover:bg-white/[0.02] transition-colors`}>
                  <td className="py-2.5 pl-4 text-dusty tabular-nums">{n0(r.rank)}</td>
                  <td className="py-2.5"><Addr a={r.address} /></td>
                  <td className="py-2.5 text-right text-snow tabular-nums font-bold">{n0(r.stones)}</td>
                  <td className="py-2.5 text-right text-dusty tabular-nums">{r.share.toFixed(3)}%</td>
                  <td className="py-2.5 text-right tabular-nums">
                    {r.veteran
                      ? <span className="text-mist">{n0(r.stones_at_airdrop ?? 0)}</span>
                      : <span className="text-dusty/40">no</span>}
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">
                    {r.current_dog ? <span className="text-mist">{compact(r.current_dog)}</span> : <span className="text-dusty/30">0</span>}
                  </td>
                </tr>
              ))}
              {!rows.length && !loading && (
                <tr><td colSpan={6} className="py-10 text-center text-dusty/50">No address matches that search</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className={`flex items-center justify-between p-4 border-t ${HAIR_SOFT}`}>
          <span className="font-mono text-[10px] text-dusty">
            {n0(total)} addresses{pages > 1 ? ` · page ${n0(page)} of ${n0(pages)}` : ""}
          </span>
          {pages > 1 && (
            <div className="flex gap-1">
              <button onClick={() => onPage(Math.max(1, page - 1))} disabled={page === 1}
                className="font-mono text-[10px] uppercase tracking-[0.16em] px-3 py-2 border border-white/10 text-dusty hover:text-lava hover:border-lava/40 disabled:opacity-25 transition-colors">prev</button>
              <button onClick={() => onPage(Math.min(pages, page + 1))} disabled={page === pages}
                className="font-mono text-[10px] uppercase tracking-[0.16em] px-3 py-2 border border-white/10 text-dusty hover:text-lava hover:border-lava/40 disabled:opacity-25 transition-colors">next</button>
            </div>
          )}
        </div>
      </Plate>
    </section>
  )
}
