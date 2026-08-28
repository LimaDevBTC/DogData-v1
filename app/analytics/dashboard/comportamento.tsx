"use client"

// ═══════════════════════════════════════════════════════════════════════════
// COMPORTAMENTO — o que cada página faz com quem chega nela.
//
// Esta aba não existia de forma nenhuma. O painel antigo tinha "Top páginas
// por views", que diz o que foi ABERTO e nunca o que FUNCIONOU. Uma página com
// 4.000 views, 8 segundos de permanência e 90% de saída é um problema, e ali
// ela aparecia no topo da lista como se fosse o maior sucesso do site.
//
// Duas escolhas de leitura:
//
// · TEMPO MEDIANO, não médio. Permanência tem cauda longa — a leitura de uma
//   hora, a aba em segundo plano — e a média segue a cauda. A mediana responde
//   "o que acontece numa visita típica". O médio fica na tabela ao lado, e
//   quando os dois se afastam muito é sinal de audiência partida em duas.
//
// · AMOSTRAS À VISTA. Toda linha diz sobre quantas medições o tempo foi
//   calculado. Uma página com 3 amostras não sustenta conclusão, e sem esse
//   número ela pareceria igual a uma com 900.
// ═══════════════════════════════════════════════════════════════════════════

import { ArrowRight, DoorOpen, LogOut, MousePointerClick, Timer } from "lucide-react"
import { Reveal } from "@/app/dogcity/motion"
import type { Comportamento as TComportamento } from "./types"
import {
  CAT, HAIR, HAIR_SOFT, Plate, PlateHead, RankRows, SectionHead, STATUS, Tabela,
  fmtDuracao, fmtNum, fmtPct, fmtPage,
} from "./ui"

// Acima disto uma página de entrada está perdendo quase todo mundo que chega.
// Não é um limiar oficial: é o ponto em que vale parar e olhar.
const REJEICAO_ALTA = 80

export default function Comportamento({ data }: { data: TComportamento }) {
  const paginas = data.paginas
  const medidas = paginas.filter((p) => p.amostras_tempo > 0)

  const entradasRuins = data.entradas.filter(
    (e) => e.rejeicao != null && e.rejeicao >= REJEICAO_ALTA && e.sessoes >= 25,
  )

  return (
    <div className="space-y-12 md:space-y-16">

      {/* ── páginas ─────────────────────────────────────────────────────── */}
      <section>
        <SectionHead
          eyebrow="PAGES"
          title="What each page does with the people who land on it."
          sub="Median time, scroll reached and exit rate side by side. Views alone says what was opened, never what worked."
        />
        <Reveal delay={0.4} y={16}>
          <div className={`mt-10 border ${HAIR}`}>
            <Tabela
              cabecalho={["Page", "Views", "People", "Median time", "Scroll", "Exit", "Samples"]}
              alinhar={["l", "r", "r", "r", "r", "r", "r"]}
              linhas={paginas.map((p) => [
                <span key="p" className="text-snow">{fmtPage(p.pagina)}</span>,
                fmtNum(p.views),
                fmtNum(p.visitantes),
                p.amostras_tempo > 0 ? fmtDuracao(p.tempo_mediano_s) : <span className="text-white/25">not measured</span>,
                p.amostras_tempo > 0 ? `${p.rolagem_media}%` : <span className="text-white/25">—</span>,
                <span
                  key="s"
                  style={{ color: (p.taxa_saida ?? 0) >= REJEICAO_ALTA ? STATUS.poor : undefined }}
                >
                  {fmtPct(p.taxa_saida)}
                </span>,
                p.amostras_tempo > 0
                  ? fmtNum(p.amostras_tempo)
                  : <span className="text-white/25">0</span>,
              ])}
            />
          </div>
        </Reveal>
        {medidas.length === 0 && (
          <p className="font-mono text-[10px] text-dusty mt-4 leading-relaxed max-w-[70ch]">
            No page has time measurement in this window. Per-page time started being collected on
            2026-08-27 — before that the site sent a pageview and measured nothing else, and there
            is no way to rebuild time nobody recorded.
          </p>
        )}
      </section>

      {/* ── entrada e saída ─────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Reveal y={18}>
          <Plate className="h-full">
            <PlateHead icon={DoorOpen}>Landing pages</PlateHead>
            <p className="font-mono text-[10px] text-dusty mb-4 leading-relaxed">
              Where the visit started, and how many of those people left without going anywhere.
            </p>
            <ul className="space-y-3">
              {data.entradas.map((e) => {
                const alta = e.rejeicao != null && e.rejeicao >= REJEICAO_ALTA
                return (
                  <li key={e.pagina} className={`pb-3 border-b ${HAIR_SOFT} last:border-0 last:pb-0`}>
                    <div className="flex justify-between items-baseline gap-3 mb-1.5">
                      <span className="font-mono text-[11px] text-mist truncate">{fmtPage(e.pagina)}</span>
                      <span className="font-mono text-[11px] text-snow shrink-0 tabular-nums">
                        {fmtNum(e.sessoes)}
                        <span
                          className="ml-2"
                          style={{ color: alta ? STATUS.poor : "#6B6B78" }}
                        >
                          {fmtPct(e.rejeicao)}
                        </span>
                      </span>
                    </div>
                    {/* A barra mede REJEIÇÃO, não volume: aqui a pergunta é a
                        qualidade da porta de entrada, e desenhar volume de novo
                        gastaria a linha repetindo o número já escrito. */}
                    <div className="h-[3px] bg-white/[0.05]">
                      <div
                        className="h-full"
                        style={{
                          width: `${e.rejeicao ?? 0}%`,
                          background: alta ? STATUS.poor : CAT[1],
                        }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          </Plate>
        </Reveal>

        <Reveal y={18} delay={0.08}>
          <Plate className="h-full">
            <PlateHead icon={LogOut}>Exit pages</PlateHead>
            <p className="font-mono text-[10px] text-dusty mb-4 leading-relaxed">
              The last page of the visit. Not every exit is bad — a natural end of flow leaves
              from here too.
            </p>
            <RankRows
              rows={data.saidas.map((s) => ({ label: fmtPage(s.pagina), value: s.sessoes }))}
              color={CAT[2]}
            />
          </Plate>
        </Reveal>
      </div>

      {entradasRuins.length > 0 && (
        <Reveal y={16}>
          <div className={`border ${HAIR} p-5`} style={{ borderColor: `${STATUS.poor}40` }}>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] mb-3" style={{ color: STATUS.poor }}>
              Doors losing almost everyone
            </div>
            <ul className="space-y-1.5">
              {entradasRuins.map((e) => (
                <li key={e.pagina} className="font-mono text-[11px] text-mist tabular-nums">
                  <span className="text-snow">{fmtPage(e.pagina)}</span>
                  {" — "}
                  {fmtNum(e.sessoes)} sessions enter, {fmtPct(e.rejeicao)} leave without navigating
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      )}

      {/* ── caminhos e eventos ──────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Reveal y={18}>
          <Plate className="h-full">
            <PlateHead icon={ArrowRight}>Most travelled paths</PlateHead>
            <p className="font-mono text-[10px] text-dusty mb-4 leading-relaxed">
              Navigation pairs inside the same session, most frequent first.
            </p>
            <ul className="space-y-2.5">
              {data.caminhos.slice(0, 14).map((c, i) => (
                <li
                  key={`${c.de}->${c.para}-${i}`}
                  className={`flex items-center gap-2 pb-2.5 border-b ${HAIR_SOFT} last:border-0 last:pb-0`}
                >
                  <span className="font-mono text-[11px] text-mist truncate max-w-[38%]">{fmtPage(c.de)}</span>
                  <ArrowRight className="w-3 h-3 shrink-0 text-white/25" aria-hidden />
                  <span className="font-mono text-[11px] text-mist truncate max-w-[38%]">{fmtPage(c.para)}</span>
                  <span className="ml-auto font-mono text-[11px] text-snow shrink-0 tabular-nums">
                    {fmtNum(c.n)}
                  </span>
                </li>
              ))}
            </ul>
          </Plate>
        </Reveal>

        <Reveal y={18} delay={0.08}>
          <Plate className="h-full">
            <PlateHead icon={MousePointerClick}>Events</PlateHead>
            {data.eventos.length ? (
              <Tabela
                cabecalho={["Event", "Total", "Sessions", "People"]}
                alinhar={["l", "r", "r", "r"]}
                linhas={data.eventos.map((e) => [
                  <span key="e" className="text-snow">{e.evento}</span>,
                  fmtNum(e.total),
                  fmtNum(e.sessoes),
                  fmtNum(e.visitantes),
                ])}
              />
            ) : (
              <div className="py-6">
                <p className="font-mono text-[11px] text-dusty leading-relaxed">
                  No named event in this window.
                </p>
                <p className="font-mono text-[10px] text-white/25 leading-relaxed mt-3">
                  Instrumented so far: <span className="text-mist">donate_address_copied</span>{" "}
                  (copying the donation address, by method) and{" "}
                  <span className="text-mist">wallet_connected</span> (wallet connected with proof
                  of ownership). Any component can mark others with{" "}
                  <span className="text-mist">track(&apos;nome&apos;, {"{ ... }"})</span>.
                </p>
              </div>
            )}
          </Plate>
        </Reveal>
      </div>

      {/* ── tempo médio vs mediano ──────────────────────────────────────── */}
      {medidas.length > 0 && (
        <Reveal y={18}>
          <Plate>
            <PlateHead icon={Timer}>Median against mean</PlateHead>
            <p className="font-mono text-[10px] text-dusty mb-4 leading-relaxed max-w-[70ch]">
              When the mean is much larger than the median, the page has two audiences: the
              majority who pass through fast and a minority who stay a long time. Read them apart
              instead of treating the mean as the common behaviour.
            </p>
            <Tabela
              cabecalho={["Page", "Median", "Mean", "Skew", "Samples"]}
              alinhar={["l", "r", "r", "r", "r"]}
              linhas={medidas.slice(0, 14).map((p) => {
                const razao = p.tempo_mediano_s > 0 ? p.tempo_medio_s / p.tempo_mediano_s : null
                return [
                  <span key="p" className="text-snow">{fmtPage(p.pagina)}</span>,
                  fmtDuracao(p.tempo_mediano_s),
                  fmtDuracao(p.tempo_medio_s),
                  razao == null ? "—" : `${razao.toFixed(1)}×`,
                  fmtNum(p.amostras_tempo),
                ]
              })}
            />
          </Plate>
        </Reveal>
      )}
    </div>
  )
}
