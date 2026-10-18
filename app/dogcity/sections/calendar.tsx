"use client"

// ═══════════════════════════════════════════════════════════════════════════
// 04 · THE CALENDAR (#calendar), brief landing v3 §4.6. O roadmap do mint, em
// blocos a partir de B (o bloco em que o fundo chega a 10.000.000 $DOG).
// Régua horizontal no desktop, vertical no celular; o "YOU ARE HERE" vem do
// mesmo estado do contador do herói (./landing/mint-state.ts). Antes de B ele
// fica antes do primeiro segmento, sobre a palavra "B".
// ═══════════════════════════════════════════════════════════════════════════

import { Reveal, SplitLine } from "../landing/reveal"
import { Frame, Plate, SheetNo, TextLink } from "../landing/ui"
import { MINT_HOST, calendarRows, fmtInt, type CountdownState } from "../landing/mint-state"

export default function Calendar({ cd }: { cd: CountdownState }) {
  const rows = calendarRows(cd.B)
  const current = cd.rail.mode === "phases" ? cd.rail.current : -1
  // posição do marcador na régua (0..1); antes de B, no começo
  const at = cd.rail.mode === "phases" ? cd.rail.fraction : 0

  const Marker = ({ vertical }: { vertical?: boolean }) => (
    // na régua, o rótulo desliza de alinhado à esquerda (começo) a alinhado à direita (fim): nunca sai da tela
    <span className="inline-flex items-center gap-2 whitespace-nowrap font-mono text-[10px] dk:text-[11px] tracking-[0.2em] text-dc-lava" style={vertical ? undefined : { transform: `translateX(-${Math.round(at * 100)}%)` }}>
      <span aria-hidden className="relative inline-block h-[7px] w-[7px] bg-dc-lava">
        <span className="dc-ping absolute inset-0 border border-dc-lava" />
      </span>
      YOU ARE HERE
    </span>
  )

  return (
    <section id="calendar" aria-labelledby="dc-cal-h2" className="relative bg-dc-void pt-24 dk:pt-40 scroll-mt-14">
      <Frame>
        <SheetNo n="04" title="THE CALENDAR" />
        <div className="mt-8 grid gap-8 dkl:grid-cols-12 dkl:items-end">
          <div className="dkl:col-span-6">
            <p className="dc-label text-dc-lava">THE MINT CALENDAR</p>
            <h2 id="dc-cal-h2" className="dc-h2 mt-3 text-dc-snow"><SplitLine text="Counted in blocks, not dates." /></h2>
          </div>
          <p className="dkl:col-span-6 dc-body text-dc-mist">
            Call B the block in which the construction fund reaches 10,000,000 $DOG. Every phase is fixed in blocks from
            B, and the calendar is inscribed on chain once B is known. 144 blocks is about one day.
          </p>
        </div>

        {/* ── desktop: a régua horizontal, cinco segmentos de largura igual ── */}
        <div className="hidden dkl:block mt-16">
          <div className="relative h-16">
            <span className="absolute bottom-3 left-0 font-cond text-[28px] font-semibold leading-none text-dc-snow">B</span>
            {/* antes de B o marcador mora sobre a palavra "B"; depois, anda na régua */}
            {current < 0
              ? <span className="absolute bottom-11 left-0"><Marker vertical /></span>
              : <span className="absolute bottom-11" style={{ left: `${at * 100}%` }}><Marker /></span>}
          </div>
          <div className="relative h-[13px]">
            <div className="dc-ruler absolute inset-x-0 top-0 h-[9px]" />
            <div className="absolute inset-x-0 bottom-0 h-[3px] bg-dc-snow/[0.16]" />
            <div className="absolute bottom-0 left-0 h-[3px] bg-dc-lava" style={{ width: `${at * 100}%` }} />
            <div className="absolute inset-0 flex">
              {rows.map((r, i) => <span key={r.phase} className={`flex-1 ${i ? "border-l border-dc-snow/[0.5]" : ""}`} />)}
            </div>
          </div>
          <ol className="mt-6 grid grid-cols-5 gap-4">
            {rows.map((r, i) => (
              <li key={r.phase}>
                <Reveal y={16} blur={false} delay={i * 0.06}>
                  <PhasePlate r={r} n={i + 1} current={current === i} />
                </Reveal>
              </li>
            ))}
          </ol>
        </div>

        {/* ── celular: vertical, uma prancha por fase, o marcador na lateral ── */}
        <div className="dkl:hidden mt-12 grid grid-cols-[28px_1fr] gap-x-3">
          <div className="relative">
            <span className="absolute left-[13px] top-0 bottom-0 w-px bg-dc-snow/[0.16]" />
          </div>
          <p className="font-cond text-[28px] font-semibold leading-none text-dc-snow">B</p>
          {current < 0 && (
            <>
              <div className="relative"><span className="absolute left-[10px] top-2 h-[7px] w-[7px] bg-dc-lava" /></div>
              <div className="mt-1"><Marker vertical /></div>
            </>
          )}
          {rows.map((r, i) => (
            <div key={r.phase} className="contents">
              <div className="relative">
                <span className={`absolute left-[13px] top-0 bottom-0 w-px ${i <= current ? "bg-dc-lava" : "bg-dc-snow/[0.16]"}`} />
                <span className={`absolute left-[9px] top-6 h-[9px] w-[9px] border ${i === current ? "bg-dc-lava border-dc-lava" : "bg-dc-void border-dc-snow/[0.5]"}`} />
              </div>
              <div className="mt-4">
                {i === current && <div className="mb-2"><Marker vertical /></div>}
                <Reveal y={16} blur={false}><PhasePlate r={r} n={i + 1} current={i === current} /></Reveal>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-4 dk:flex-row dk:items-center dk:justify-between border-t border-dc-snow/[0.12] pt-6">
          <p className="font-mono text-[12px] dk:text-[13px] tracking-[0.08em] text-dc-snow">
            The only place to mint is <span className="text-dc-lava">{MINT_HOST}</span>.
          </p>
          <TextLink href="/dogcity/docs#the-mint" className="font-mono text-[11px] tracking-[0.16em] uppercase text-dc-snow">
            Every rule of the mint
          </TextLink>
        </div>
      </Frame>
    </section>
  )
}

function PhasePlate({ r, n, current }: { r: ReturnType<typeof calendarRows>[number]; n: number; current: boolean }) {
  return (
    <Plate className={`h-full px-5 py-5 ${current ? "!border-dc-lava" : ""}`}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-mono text-[11px] tracking-[0.18em] text-dc-lava">{String(n).padStart(2, "0")}</p>
        {r.startsAt != null && <p className="font-mono text-[11px] tracking-[0.06em] text-dc-mist tabular-nums">Block {fmtInt(r.startsAt)}</p>}
      </div>
      <h3 className="mt-3 font-cond text-[30px] font-semibold uppercase leading-none text-dc-snow">{r.name}</h3>
      <p className="mt-2 font-mono text-[11px] tracking-[0.06em] text-dc-mist">{r.span}</p>
      {r.price && <p className="mt-4 font-cond text-[36px] font-semibold leading-none text-dc-lava">{r.price}</p>}
      <p className="mt-4 font-body text-[15px] leading-[23px] text-dc-snow/[0.88]">{r.text}</p>
    </Plate>
  )
}
