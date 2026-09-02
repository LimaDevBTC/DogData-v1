"use client"

// The crosses: what the Runestone set looks like when you hold it against the
// other things we already track. Each of these joins the per address stone
// count to a dataset that exists for its own reasons, which is the only reason
// any of it is checkable.

import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"
import {
  AXIS_TICK, CAT, GRID, HAIR_SOFT, Plate, PlateHead, PlotGrid,
  RankRows, SectionHead, StatTile,
} from "@/components/plot/kit"
import { Fact, Frame, compact, n0, pct } from "./sections"
import type { Dossier } from "./types"

const STONE_BANDS = ["2y+", "1-2y", "6-12m", "<6m"]
const COIN_BANDS = [">1y", "6-12m", "3-6m", "<3m"]

// ── two clocks ─────────────────────────────────────────────────────────────
export function TwoClocks({ d }: { d: Dossier }) {
  const tc = d.crosses?.two_clocks
  if (!tc?.matrix?.length || tc.baseline_lth_pct == null) return null
  const w = tc.with_dog
  // a distribuicao vai de dezenas a 25 mil: rampa linear jogaria 15 das 16
  // celulas em cima do fundo. raiz quadrada devolve separacao ao meio da faixa.
  const max = Math.max(...tc.matrix.map(m => m.addresses), 1)
  const ramp = (v: number) => (v <= 0 ? 0 : Math.sqrt(v / max))
  const cell = (s: string, c: string) => tc.matrix.find(m => m.stone_band === s && m.coin_band === c)
  const delta = tc.stone_holders_lth_pct - tc.baseline_lth_pct

  return (
    <section className="space-y-6">
      <SectionHead
        eyebrow="TWO CLOCKS, ONE WALLET"
        title="The two clocks run together"
        sub="A wallet has two clocks: how long its Runestones have sat still, and how long its DOG has sat still. Measured across the wallets that carry both, the two move together. This is an association, not a cause: nothing here says the stone makes anyone patient."
      />

      <PlotGrid className="grid-cols-2 lg:grid-cols-4">
        {[
          <StatTile key="lth" label="Long term supply share" value={tc.stone_holders_lth_pct} format={pct}
            sub={`of the DOG that Runestone holders carry, against ${pct(tc.baseline_lth_pct)} of all DOG`} />,
          <StatTile key="delta" label="Difference" value={delta} accent={CAT[1]}
            format={(n) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}pp`}
            sub="both figures weighted by DOG, not by wallet count" />,
          w ? <StatTile key="wallets" label="Wallets holding old coin" value={w.lth_dominant} format={n0}
            accent={CAT[1]}
            sub={`of ${n0(w.addresses)} stone holders that carry DOG${w.addresses ? `, ${pct((w.lth_dominant / w.addresses) * 100)}` : ""}`} /> : null,
          w ? <StatTile key="age" label="Average coin age" value={w.avg_coin_age_days} accent={CAT[1]}
            format={(n) => `${Math.round(n)}d`}
            sub="mean across those wallets of their own DOG weighted output age" /> : null,
        ].filter(Boolean)}
      </PlotGrid>

      <div className="grid lg:grid-cols-3 gap-4">
        <Frame
          className="lg:col-span-2 min-w-0"
          eyebrow="Stone dormancy against DOG coin age"
          table={{
            head: ["Stone at rest", "Coin age", "Addresses", "Stones"],
            rows: tc.matrix.map(m => [m.stone_band, m.coin_band, m.addresses, m.stones]),
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px]">
              <thead>
                <tr>
                  <th className="w-24" />
                  {COIN_BANDS.map(c => (
                    <th key={c} scope="col" className="font-mono text-[9px] uppercase tracking-[0.16em] text-dusty pb-2 text-center">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {STONE_BANDS.map(s => (
                  <tr key={s}>
                    <th scope="row" className="font-mono text-[9px] uppercase tracking-[0.16em] text-dusty pr-3 text-right font-normal">{s}</th>
                    {COIN_BANDS.map(c => {
                      const m = cell(s, c)
                      const v = m?.addresses ?? 0
                      return (
                        <td key={c} className="p-[3px]">
                          <div
                            className="aspect-[3/2] flex flex-col items-center justify-center border border-white/[0.06]"
                            style={{ background: v ? `rgba(232,102,13,${(0.1 + 0.8 * ramp(v)).toFixed(3)})` : "transparent" }}
                            title={`${s} stones, ${c} coins: ${n0(v)} addresses, ${n0(m?.stones ?? 0)} stones`}
                          >
                            <span className="font-mono text-[11px] text-snow tabular-nums">{v ? compact(v) : "0"}</span>
                            <span className="font-mono text-[9px] text-snow/75 tabular-nums">{m?.stones ? compact(m.stones) : ""}</span>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[12px] text-mist leading-relaxed mt-4">
            Rows are how long the wallet has left its oldest stone alone, columns are the weighted age of its
            DOG outputs. Big number is addresses, small number is stones. The mass sits hard in the top left
            corner: {n0(cell("2y+", ">1y")?.addresses ?? 0)} wallets have touched neither in over a year.
            {tc.correlation ? ` Pearson r across the ${n0(tc.correlation.n)} wallets in both sets is ${tc.correlation.pearson_r.toFixed(2)}, but read it with care: most stones sit at the ceiling of possible dormancy, so the coefficient rests on the minority that ever moved.` : ""}
          </p>
        </Frame>

        {w && (
          <Plate className="min-w-0">
            <PlateHead swatch={CAT[1]}>Runestone holders who also hold DOG</PlateHead>
            <Fact k="Addresses" v={n0(w.addresses)} sub={`of ${n0(d.custody.holders)} stone holders`} />
            <Fact k="DOG they control" v={compact(w.total_dog)} sub={w.pct_of_dog_supply_in_snapshot ? `${pct(w.pct_of_dog_supply_in_snapshot)} of tracked supply` : undefined} />
            <Fact k="Long term dominant" v={n0(w.lth_dominant)} sub="majority of their DOG is old coin" />
            <Fact k="Stones they hold" v={n0(w.stones_held ?? 0)} />
            <p className="text-[12px] text-mist leading-relaxed mt-4">
              Under half of the collection overlaps with DOG at all, and that minority controls about a third
              of the rune. The overlap is small and heavy.
            </p>
          </Plate>
        )}
      </div>
    </section>
  )
}

// ── divergence ─────────────────────────────────────────────────────────────
export function Divergence({ d }: { d: Dossier }) {
  const ct = d.crosses?.cohort_timeseries
  if (!ct?.series?.length) return null
  const s = ct.series
  const k0 = s[0].keepers_dog || 1
  const v0 = s[0].sellers_dog || 1
  const data = s.map(p => ({
    date: p.date.slice(5),
    keepers: (p.keepers_dog / k0) * 100,
    sellers: (p.sellers_dog / v0) * 100,
  }))
  const sm = ct.summary

  return (
    <section className="space-y-6">
      <SectionHead
        eyebrow="THE SAME COHORT, SPLIT IN TWO"
        title="The two halves came apart"
        sub={`Take the ${n0(d.airdrop_cross.cohort_addresses)} airdrop wallets and split them by one question: do they still hold a Runestone. Then watch what each half did with its DOG across ${n0(sm.days)} daily snapshots.`}
      />
      <div className="grid lg:grid-cols-3 gap-4">
        <Frame
          className="lg:col-span-2 min-w-0"
          eyebrow="DOG held by each half, indexed to 100 at the start"
          legend={[
            { label: "Still hold a stone", color: CAT[0] },
            { label: "No longer hold one", color: CAT[2] },
          ]}
          table={{
            head: ["Date", "Still hold (idx)", "No longer hold (idx)", "Their share"],
            rows: s.map((p, i) => [
              p.date,
              data[i].keepers.toFixed(1),
              data[i].sellers.toFixed(1),
              `${p.keeper_share_pct.toFixed(2)}%`,
            ]),
          }}
        >
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="date" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID }}
                interval="preserveStartEnd" minTickGap={40} />
              <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={44}
                domain={[70, 105]} tickFormatter={(v: number) => String(Math.round(v))} />
              <Tooltip
                cursor={{ stroke: "#ffffff20" }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  return (
                    <div className={`border ${HAIR_SOFT} bg-void/95 px-3.5 py-2.5 font-mono text-[11px]`}>
                      <div className="text-dusty mb-1.5">{label}</div>
                      {payload.map((p, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="w-2 h-2" style={{ background: p.color }} />
                          <span className="text-mist">{p.name}</span>
                          <span className="text-snow font-bold tabular-nums ml-auto pl-3">
                            {typeof p.value === "number" ? p.value.toFixed(1) : p.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                }}
              />
              <Line type="monotone" dataKey="keepers" name="Still hold a stone" stroke={CAT[0]}
                strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="sellers" name="No longer hold one" stroke={CAT[2]}
                strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-[12px] text-mist leading-relaxed mt-4">
            Both lines start at 100 on {sm.first_date} so the shapes can be compared directly. Wallets that
            kept the stone finished at {(100 + sm.keepers_change_pct).toFixed(1)}. Wallets that sold it
            finished at {(100 + sm.sellers_change_pct).toFixed(1)}.
          </p>
        </Frame>

        <Plate>
          <PlateHead>Across {n0(sm.days)} daily snapshots</PlateHead>
          <Fact k="Still hold a stone" v={`${sm.keepers_change_pct >= 0 ? "+" : ""}${sm.keepers_change_pct.toFixed(2)}%`} sub="change in DOG held" />
          <Fact k="No longer hold one" v={`${sm.sellers_change_pct.toFixed(2)}%`} sub="change in DOG held" />
          <Fact k="Their share of the cohort DOG" v={`${s[0].keeper_share_pct.toFixed(1)}% → ${s[s.length - 1].keeper_share_pct.toFixed(1)}%`} />
          <Fact k="Of those, still holding DOG" v={n0(s[s.length - 1].keepers_live)} />
          <Fact k="Of the others, still holding DOG" v={n0(s[s.length - 1].sellers_live)} />
          <p className="text-[12px] text-mist leading-relaxed mt-4">
            The split was drawn by an ordinal, not by a rune balance, and the two halves still separate on the
            rune. The window runs {sm.first_date} to {sm.last_date}, a slice of a two year history, and it says
            nothing about which of the two a wallet let go of first.
          </p>
        </Plate>
      </div>
    </section>
  )
}

// ── the sealed ─────────────────────────────────────────────────────────────
export function Sealed({ d }: { d: Dossier }) {
  const dl = d.crosses?.diamond_lost
  if (!dl?.lost || !dl.diamond) return null
  return (
    <section className="space-y-6">
      <SectionHead
        eyebrow="SUPPLY THAT CANNOT MOVE"
        title="Stones in wallets that have never spent anything"
        sub="We track airdrop wallets with zero spent outputs in their entire life on chain. Not a partial spend, not a consolidation, nothing. Their stones are locked by that same fact, so this is a floor on dormant supply rather than a finding about behaviour."
      />
      <div className="grid lg:grid-cols-2 gap-4">
        <Plate corners accent={CAT[0]}>
          <PlateHead>Never spent an output, ever</PlateHead>
          <div className="flex items-baseline gap-3 mb-4">
            <span className="font-display font-bold text-[40px] leading-none text-snow tabular-nums">
              {n0(dl.lost.stones_held)}
            </span>
            <span className="font-mono text-[11px] text-dusty pb-1">
              stones, across {n0(dl.lost.cohort_size)} wallets
            </span>
          </div>
          <Fact k="Wallets in the cohort" v={n0(dl.lost.cohort_size)} sub="zero spent outputs, lifetime" />
          <Fact k="Share of the collection" v={d.custody.stones ? pct((dl.lost.stones_held / d.custody.stones) * 100) : "n/a"} />
          <Fact k="DOG they were airdropped" v={compact(dl.lost.airdrop_dog)} sub="also never spent" />
          <p className="text-[12px] text-mist leading-relaxed mt-4">
            All of them still hold their stone, but that is arithmetic, not conviction: a wallet that has
            never spent an output cannot have moved anything. What the number is good for is a floor. These
            addresses cannot be told apart from lost keys by anything on chain, so treat those
            {" "}{n0(dl.lost.stones_held)} stones as supply that is not coming back.
          </p>
        </Plate>

        <Plate>
          <PlateHead swatch={CAT[1]}>Diamond paws, the DOG cohort</PlateHead>
          <Fact k="Cohort size" v={n0(dl.diamond.cohort_size)} sub="wallets that never sold a DOG" />
          <Fact k="Still hold a Runestone" v={dl.diamond.cohort_size ? `${n0(dl.diamond.still_hold_stone)} (${pct((dl.diamond.still_hold_stone / dl.diamond.cohort_size) * 100)})` : n0(dl.diamond.still_hold_stone)} />
          <Fact k="Stones they hold" v={n0(dl.diamond.stones_held)} sub={d.custody.stones ? `${pct((dl.diamond.stones_held / d.custody.stones) * 100)} of the collection` : undefined} />
          <Fact k="DOG they hold" v={compact(dl.diamond.dog_held)} />
          <Fact k="Kept the DOG, sold the stone" v={n0(dl.diamond.kept_dog_sold_stone)} sub="the small contrarian corner" />
          {dl.diamond.tx_count_median != null && (
            <Fact k="Median lifetime BTC transactions" v={n0(dl.diamond.tx_count_median)} sub="across the whole wallet, not just DOG" />
          )}
        </Plate>
      </div>
    </section>
  )
}

// ── city ───────────────────────────────────────────────────────────────────
export function City({ d }: { d: Dossier }) {
  const c = d.crosses?.city
  if (!c?.totals || !c.districts?.length) return null
  const gc = c.genesis_core
  const ordered = [...c.districts].sort((a, b) => (b.share_pct ?? 0) - (a.share_pct ?? 0))
  return (
    <section className="space-y-6">
      <SectionHead
        eyebrow="WHERE THEY LIVE"
        title="The oldest districts of DogCity are Runestone country"
        sub="DogCity gives a lot to DOG holders, placed by coin age, and that registry was frozen long before we knew who held a stone. Overlay the collection and the inner districts come out almost solid."
      />
      <PlotGrid className="grid-cols-2 lg:grid-cols-4">
        <StatTile label="Lots held by stone holders" value={c.totals.lots_with_stones} format={n0}
          sub={`of ${n0(c.totals.lots)} lots in the city`} />
        <StatTile label="Stones inside the city" value={c.totals.stones} format={n0} accent={CAT[1]}
          sub={c.totals.stones_pct_of_all_stones ? `${pct(c.totals.stones_pct_of_all_stones)} of the collection` : undefined} />
        {gc ? <StatTile label="Genesis Core lots" value={gc.with_stones} format={n0} accent={CAT[2]}
          sub={`of ${gc.total} in the founding ring${gc.total ? `, ${pct((gc.with_stones / gc.total) * 100)}` : ""}`} /> : null}
        <StatTile label="Stone holders with no lot" value={c.totals.stone_addresses_outside_city ?? 0} format={n0}
          sub="mostly addresses holding no DOG at all, so the registry never gave them one" />
      </PlotGrid>

      <div className="grid lg:grid-cols-3 gap-4">
        <Frame
          className="lg:col-span-2 min-w-0"
          eyebrow="Share of each district held by Runestone holders"
          table={{
            head: ["District", "Share", "Lots", "With stones", "Stones"],
            rows: ordered.map(x => [
              x.district,
              `${(x.share_pct ?? (x.lots ? (x.lots_with_stones / x.lots) * 100 : 0)).toFixed(1)}%`,
              x.lots, x.lots_with_stones, x.stones,
            ]),
          }}
        >
          <RankRows
            rows={ordered.map(x => ({
              label: x.district,
              value: x.share_pct ?? (x.lots ? (x.lots_with_stones / x.lots) * 100 : 0),
              hint: `· ${n0(x.stones)} stones`,
            }))}
            valueFormat={(v) => `${v.toFixed(1)}%`}
          />
          <p className="text-[12px] text-mist leading-relaxed mt-5">
            Districts are assigned by how long a wallet has held its DOG, oldest at the centre. The Runestone
            share holds above 95 percent through Vanguard and then falls off a cliff, which is the shape you
            would expect if the collection sits with wallets that were already here before the airdrop.
          </p>
        </Frame>

        {gc?.holders?.length ? (
          <Plate className="min-w-0">
            <PlateHead swatch={CAT[2]}>Genesis Core, by stones</PlateHead>
            <ul className="space-y-2.5">
              {gc.holders.slice(0, 10).map((h, i) => (
                <li key={h.address} className="flex items-center gap-3 font-mono text-[11px]">
                  <span className="text-white/25 tabular-nums w-4">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-mist truncate">
                    {h.street} {h.number}
                    <span className="text-dusty/60 ml-1.5">{h.typology}</span>
                  </span>
                  <span className="text-snow tabular-nums ml-auto">{n0(h.stones)}</span>
                </li>
              ))}
            </ul>
            <p className="text-[12px] text-mist leading-relaxed mt-4">
              The founding ring holds {n0(gc.stones)} stones across {n0(gc.with_stones)} lots. The registry
              flags this ring as a provisional pick of the earliest wallets, and it was frozen in July 2026,
              so treat the lots as a snapshot while the stone counts stay live.
            </p>
          </Plate>
        ) : null}
      </div>
    </section>
  )
}
