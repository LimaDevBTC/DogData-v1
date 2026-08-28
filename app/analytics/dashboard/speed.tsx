"use client"

// ═══════════════════════════════════════════════════════════════════════════
// SPEED — Core Web Vitals as measured on real visits (RUM), not a lab run.
//
// The generated version split every vital across three separate plates: a
// score bar list, a card grid, and one shared line chart. That last one was
// the real defect — LCP (~2500ms), FCP (~1800ms), TTFB (~800ms) and INP
// (~200ms) on ONE y-axis crushes INP into the baseline, so the metric most
// likely to be broken was the one you could not read.
//
// So the three plates collapse into ONE PLATE PER VITAL: name, p75, rating,
// its own trend on its own scale (small multiples — the fix for incompatible
// ranges), its 0–100 score meter, and its good/needs/poor distribution. Five
// plates, five scales, nothing crushed.
//
// Colour here is STATUS, not identity: a vital literally means good or bad, so
// it wears the reserved status scale — always with an icon and a word beside
// it, never colour alone.
// ═══════════════════════════════════════════════════════════════════════════

import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"
import { Monitor, Smartphone, TimerReset } from "lucide-react"
import { Reveal, Stagger, StaggerItem } from "@/app/dogcity/motion"
import type { Vitais } from "./types"
import {
  AXIS_TICK, ChartTooltip, EmptyPlot, GRID, HAIR_SOFT, Plate, PlateHead,
  SectionHead, STATUS, StatusChip, StatusMark, fmtNum, fmtPage, statusOf,
  type StatusKey,
} from "./ui"

const VITAL_META: Record<string, { desc: string; good: number; poor: number }> = {
  LCP:  { desc: "Largest Contentful Paint",  good: 2500, poor: 4000 },
  INP:  { desc: "Interaction to Next Paint", good: 200,  poor: 500 },
  CLS:  { desc: "Cumulative Layout Shift",   good: 100,  poor: 250 },
  FCP:  { desc: "First Contentful Paint",    good: 1800, poor: 3000 },
  TTFB: { desc: "Time to First Byte",        good: 800,  poor: 1800 },
}

const VITAL_ORDER = ["LCP", "INP", "CLS", "FCP", "TTFB"]

// CLS arrives multiplied by 1000 so it can share the integer pipeline
const fmtVital = (name: string, v: number) =>
  name === "CLS" ? (v / 1000).toFixed(3) : fmtNum(Math.round(v))

const unitOf = (name: string) => (name === "CLS" ? "" : "ms")

const statusForValue = (name: string, v: number): StatusKey => {
  const m = VITAL_META[name]
  return v <= m.good ? "good" : v <= m.poor ? "warn" : "poor"
}

// ── one vital, entire ──────────────────────────────────────────────────────
function VitalPlate({
  name, v, series, index,
}: {
  name: string
  v: VitalData
  series: { date: string; value: number }[]
  index: number
}) {
  const meta = VITAL_META[name]
  const status = statusOf(v.rating)
  const color = STATUS[status]
  const dist = [
    { pct: v.good_pct,  color: STATUS.good, label: "bom" },
    { pct: v.needs_pct, color: STATUS.warn, label: "médio" },
    { pct: v.poor_pct,  color: STATUS.poor, label: "ruim" },
  ]

  return (
    <StaggerItem>
      <Plate className="h-full flex flex-col" corners={index === 0} accent={color}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 shrink-0" style={{ background: color }} />
              <span className="font-mono text-[13px] font-bold text-snow tracking-wide">{name}</span>
            </div>
            <div className="font-mono text-[10px] text-dusty mt-1 ml-4">{meta.desc}</div>
          </div>
          <StatusChip status={status} />
        </div>

        <div className="mt-5 ml-4 flex items-baseline gap-2">
          <span className="font-display font-bold text-[28px] leading-none text-snow tabular-nums">
            {fmtVital(name, v.p75)}
          </span>
          {unitOf(name) && <span className="font-mono text-[11px] text-mist">{unitOf(name)}</span>}
          <span className="font-mono text-[10px] text-white/25 ml-1">
            p75 · {fmtNum(v.samples)} samples
          </span>
        </div>

        {/* own scale, own plate — the small-multiples fix.
            The y-axis needs its full width here: at 9px these ticks read
            "2.180", and a negative left margin clips them to "80". */}
        <div className="mt-4">
          {series.length > 1 ? (
            <ResponsiveContainer width="100%" height={84}>
              <LineChart data={series} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="date" tick={{ ...AXIS_TICK, fontSize: 9 }}
                  axisLine={false} tickLine={false} minTickGap={30} />
                <YAxis tick={{ ...AXIS_TICK, fontSize: 9 }} axisLine={false} tickLine={false}
                  width={46} tickCount={3} domain={["dataMin", "dataMax"]}
                  tickFormatter={(t: number) => fmtVital(name, t)} />
                <Tooltip content={<ChartTooltip unit={unitOf(name)} />}
                  cursor={{ stroke: "#ffffff25", strokeWidth: 1 }} />
                <Line type="monotone" dataKey="value" name={`${name} p75`} stroke={color}
                  strokeWidth={2} strokeLinecap="round" dot={false}
                  activeDot={{ r: 4, fill: color, stroke: "#050505", strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyPlot height={78}>sem histórico</EmptyPlot>
          )}
        </div>

        <div className={`mt-auto pt-4 border-t ${HAIR_SOFT} space-y-3`}>
          {/* score meter — track is a lighter step of the fill's own hue */}
          <div className="flex items-center gap-3">
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-dusty w-9 shrink-0">
              score
            </span>
            <div className="flex-1 h-1.5" style={{ background: `${color}24` }}>
              <div className="h-full transition-all duration-700" style={{ width: `${v.score}%`, background: color }} />
            </div>
            <span className="font-mono text-[11px] font-bold text-snow w-7 text-right tabular-nums">
              {v.score}
            </span>
          </div>

          {/* distribution — 2px surface gaps do the separating, no strokes.
              Same label gutter as the score meter above so the two bars share
              one left edge instead of stepping. */}
          <div className="flex items-start gap-3">
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-dusty w-9 shrink-0 pt-px">
              dist
            </span>
            <div className="flex-1">
              <div className="flex h-1.5 gap-[2px]">
                {dist.map((d) => (
                  <div key={d.label} style={{ width: `${d.pct}%`, background: d.color }}
                    title={`${d.label}: ${d.pct}%`} />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 font-mono text-[9px] text-mist">
                {dist.map((d) => (
                  <span key={d.label} className="flex items-center gap-1 tabular-nums">
                    <span className="w-1.5 h-1.5" style={{ background: d.color }} />
                    {d.pct}% {d.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Plate>
    </StaggerItem>
  )
}

// ── adaptador ──────────────────────────────────────────────────────────────
// As agregações de vitals mudaram de lugar: saíram do TypeScript e foram pro
// banco (migração 023), e lá saem em formato longo — uma linha por (dia,
// métrica) — porque é assim que o SQL agrupa sem pivotar.
//
// O desenho desta aba estava certo e não tinha por que ser reescrito, então a
// tradução acontece aqui, numa função só, em vez de espalhada por dez pontos
// do JSX. O que muda é a fonte; a leitura continua a mesma.
// Forma que o restante deste arquivo lê. Mora aqui e não em ./types porque
// é interna à adaptação: nenhum outro arquivo fala esse dialeto.
interface VitalData {
  p75: number; avg: number; good_pct: number; needs_pct: number; poor_pct: number
  rating: string; score: number; samples: number
}

function adaptar(v: Vitais) {
  const web_vitals: Record<string, VitalData> = {}
  for (const [nome, m] of Object.entries(v.metricas)) {
    web_vitals[nome] = {
      p75: m.p75, avg: m.media, samples: m.amostras, score: m.nota,
      good_pct: m.pct_bom, needs_pct: m.pct_medio, poor_pct: m.pct_ruim,
      // O vocabulário de estado do banco é pt; o de ./ui é o do Chrome.
      rating: m.estado === "bom" ? "good" : m.estado === "medio" ? "needs-improvement" : "poor",
    }
  }

  // Formato longo → largo. Um objeto por dia, uma chave por métrica.
  const porDia = new Map<string, Record<string, number | string>>()
  for (const r of v.por_dia) {
    const linha = porDia.get(r.dia) ?? { date: r.dia }
    linha[r.nome] = r.p75
    porDia.set(r.dia, linha)
  }

  const porDisp = new Map<string, Record<string, number | string>>()
  for (const r of v.por_dispositivo) {
    const linha = porDisp.get(r.dispositivo) ?? { device: r.dispositivo }
    linha[r.nome] = r.p75
    porDisp.set(r.dispositivo, linha)
  }

  const slowest_pages: Record<string, { page: string; p75: number }[]> = {}
  for (const g of v.paginas_lentas) {
    slowest_pages[g.nome] = g.paginas.map((p) => ({ page: p.pagina, p75: p.p75 }))
  }

  return {
    web_vitals,
    performance_score: v.nota_geral,
    vitals_by_day: Array.from(porDia.values()).sort((a, b) => String(a.date).localeCompare(String(b.date))),
    vitals_by_device: Array.from(porDisp.values()),
    slowest_pages,
  }
}

export default function Speed({ data: bruto }: { data: Vitais }) {
  const data = adaptar(bruto)
  const present = VITAL_ORDER.filter((n) => data.web_vitals[n])

  const seriesFor = (name: string) =>
    data.vitals_by_day
      .filter((r) => r[name] != null)
      .map((r) => ({ date: String(r.date).slice(5), value: Number(r[name]) }))

  return (
    <div className="space-y-12 md:space-y-16">

      <section>
        <SectionHead
          eyebrow="CORE WEB VITALS"
          title="How the site behaves on real visits."
          sub="75th percentile of real sessions (RUM) — not a lab run. Each metric carries its own scale; putting LCP and INP on one axis would hide exactly the one that tends to break."
        />

        {/* The aggregate score is the page hero; repeating it in a gauge here
            would put two 100s on one screen. This plate carries the breakdown
            the hero can't: where each of the five weights actually landed. */}
        <Reveal delay={0.5} y={16}>
          <Plate className="mt-10">
            <PlateHead icon={TimerReset}>Period reading · score per metric</PlateHead>
            <dl className="space-y-4">
              {present.map((name) => {
                const v = data.web_vitals[name]
                const status = statusOf(v.rating)
                return (
                  <div key={name} className={`flex items-center gap-3 pb-3.5 border-b ${HAIR_SOFT} last:border-0 last:pb-0`}>
                    <dt className="font-mono text-[11px] font-bold text-snow w-11 shrink-0">{name}</dt>
                    <dd className="flex-1 flex items-center gap-3 min-w-0">
                      {/* track is a lighter step of the fill's own hue */}
                      <div className="flex-1 h-1.5" style={{ background: `${STATUS[status]}24` }}>
                        <div className="h-full transition-all duration-700"
                          style={{ width: `${v.score}%`, background: STATUS[status] }} />
                      </div>
                      <span className="font-mono text-[11px] text-snow w-24 text-right tabular-nums shrink-0">
                        {fmtVital(name, v.p75)}{unitOf(name)}
                      </span>
                      <StatusChip status={status} />
                    </dd>
                  </div>
                )
              })}
            </dl>
            <p className="font-mono text-[9px] text-white/25 mt-5 leading-relaxed">
              Peso no score agregado: LCP 25% · INP 25% · CLS 25% · FCP 15% · TTFB 10%
            </p>
          </Plate>
        </Reveal>
      </section>

      {/* ── one plate per vital ───────────────────────────────────────────── */}
      <Stagger className="grid md:grid-cols-2 xl:grid-cols-3 gap-6" step={0.07}>
        {present.map((name, i) => (
          <VitalPlate key={name} name={name} v={data.web_vitals[name]}
            series={seriesFor(name)} index={i} />
        ))}
      </Stagger>

      {/* ── mobile vs desktop ─────────────────────────────────────────────── */}
      {data.vitals_by_device.length > 0 && (
        <Reveal y={18}>
          <Plate>
            <PlateHead icon={Smartphone}>Mobile vs desktop · p75 per metric</PlateHead>
            <div className="overflow-x-auto">
              <table className="w-full font-mono text-[11px]">
                <thead>
                  <tr className="text-dusty uppercase text-[9px] tracking-[0.18em]">
                    <th className="text-left py-2 pr-4">Device</th>
                    {present.map((n) => <th key={n} className="text-right py-2 px-3">{n}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {data.vitals_by_device.map((row, i) => (
                    <tr key={i} className={`border-t ${HAIR_SOFT}`}>
                      <td className="py-3 pr-4 text-mist whitespace-nowrap">
                        <span className="flex items-center gap-2 capitalize">
                          {row.device === "mobile"
                            ? <Smartphone className="w-3.5 h-3.5 text-dusty" />
                            : <Monitor className="w-3.5 h-3.5 text-dusty" />}
                          {String(row.device)}
                        </span>
                      </td>
                      {present.map((name) => {
                        const val = row[name] as number | undefined
                        if (val == null) {
                          return <td key={name} className="text-right py-3 px-3 text-white/25">—</td>
                        }
                        return (
                          <td key={name} className="text-right py-3 px-3 text-snow tabular-nums whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 justify-end">
                              <StatusMark status={statusForValue(name, val)} />
                              {fmtVital(name, val)}{unitOf(name)}
                            </span>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Plate>
        </Reveal>
      )}

      {/* ── slowest pages ─────────────────────────────────────────────────── */}
      {Object.keys(data.slowest_pages).length > 0 && (
        <section>
          <SectionHead eyebrow="SLOW SPOTS" title="Where each metric is worst." />
          <Stagger className="mt-8 grid md:grid-cols-2 xl:grid-cols-3 gap-6" step={0.07} delay={0.5}>
            {present.filter((n) => data.slowest_pages[n]?.length).map((name) => {
              const pages = data.slowest_pages[name]
              const max = pages[0]?.p75 || 1
              return (
                <StaggerItem key={name}>
                  <Plate className="h-full">
                    <PlateHead swatch={STATUS[statusOf(data.web_vitals[name]?.rating ?? "poor")]}>
                      {name} — {VITAL_META[name].desc}
                    </PlateHead>
                    <ul className="space-y-3">
                      {pages.slice(0, 5).map((p) => {
                        const status = statusForValue(name, p.p75)
                        return (
                          <li key={p.page}>
                            <div className="flex justify-between items-baseline gap-3 mb-1">
                              <span className="font-mono text-[10.5px] text-mist truncate" title={p.page}>
                                {fmtPage(p.page)}
                              </span>
                              <span className="font-mono text-[10.5px] text-snow shrink-0 tabular-nums inline-flex items-center gap-1.5">
                                <StatusMark status={status} />
                                {fmtVital(name, p.p75)}{unitOf(name)}
                              </span>
                            </div>
                            <div className="h-[3px] bg-white/[0.05]">
                              <div className="h-full" style={{ width: `${(p.p75 / max) * 100}%`, background: STATUS[status] }} />
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </Plate>
                </StaggerItem>
              )
            })}
          </Stagger>
        </section>
      )}

      {/* ── thresholds ────────────────────────────────────────────────────── */}
      <Reveal y={18}>
        <Plate>
          <PlateHead>Threshold reference · Google</PlateHead>
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-[11px]">
              <thead>
                <tr className="text-dusty uppercase text-[9px] tracking-[0.18em]">
                  <th className="text-left py-2 pr-6">Métrica</th>
                  <th className="text-left py-2 pr-6">Descrição</th>
                  <th className="text-right py-2 px-4">Bom</th>
                  <th className="text-right py-2 px-4">Melhorar</th>
                  <th className="text-right py-2 pl-4">Ruim</th>
                </tr>
              </thead>
              <tbody>
                {VITAL_ORDER.map((name) => {
                  const m = VITAL_META[name]
                  return (
                    <tr key={name} className={`border-t ${HAIR_SOFT}`}>
                      <td className="py-3 pr-6 font-bold text-snow">{name}</td>
                      <td className="py-3 pr-6 text-mist">{m.desc}</td>
                      <td className="py-3 px-4 text-right tabular-nums" style={{ color: STATUS.good }}>
                        ≤ {fmtVital(name, m.good)}{unitOf(name)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums" style={{ color: STATUS.warn }}>
                        &lt; {fmtVital(name, m.poor)}{unitOf(name)}
                      </td>
                      <td className="py-3 pl-4 text-right tabular-nums" style={{ color: STATUS.poor }}>
                        ≥ {fmtVital(name, m.poor)}{unitOf(name)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="font-mono text-[10px] text-white/25 mt-4 leading-relaxed">
            CLS é adimensional; as demais métricas em milissegundos.
          </p>
        </Plate>
      </Reveal>
    </div>
  )
}
