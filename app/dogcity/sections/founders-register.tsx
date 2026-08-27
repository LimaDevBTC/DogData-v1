"use client"

// ═══════════════════════════════════════════════════════════════════════════
// O REGISTRO DE FUNDADORES.
//
// De onde veio: a página /donate (a landing antiga, aposentada em 27/08) tinha
// duas coisas que a landing atual não tinha. Esta é a primeira: a lista com
// NOME de quem já financiou, em duas lentes.
//
//   · FOUNDERS   ordenados por CHEGADA (`founder_seq`, a primeira doação da
//                carteira). A posição não muda quando alguém doa mais depois:
//                é uma fila, não um placar. Fila é o produto aqui, porque o que
//                se vende é "seu lugar é permanente".
//   · BUILDERS   a mesma gente por VOLUME acumulado (`rank`).
//
// O que NÃO veio junto: os cartões de vidro, os cantos arredondados e as abas
// em pílula da página velha. Aqui é a gramática de grade da landing atual:
// filete de 1px, rótulo mono em caixa alta, número tabular. Duas abas que são
// duas células de uma régua, não dois botões flutuando.
//
// ⚠️ REGRAS DURAS:
//
// 1. O endereço leva para /address/bitcoin/<addr>, a nossa própria página. A
//    página velha mandava para mempool.space e entregava o visitante para
//    fora do site no exato momento em que ele estava mais interessado.
// 2. border-white/8 e /12 NÃO COMPILAM nesta escala (múltiplos de 5) e caem no
//    #D1D5DB do preflight, pintando filete cinza CLARO em página preta. Usar
//    HAIR/HAIR_SOFT/GRIDLINE de ../motion ou a forma /[0.04].
// 3. `founders` e `leaderboard` são OPCIONAIS no tipo porque a rota tem
//    disjuntor de 8s (incidente de IO de 26/08) e devolve 503 sem corpo útil.
//    Toda leitura aqui passa por ?? [] e a seção se desenha vazia, nunca
//    quebra a árvore.
// ═══════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import {
  DUR, EASE, GRIDLINE, HAIR, HAIR_SOFT, Reveal, SplitLine,
} from "../motion"
import { formatDog, shortAddr } from "../dogcity-data"
import type { BuilderEntry, FounderEntry, LeaderboardData } from "../types"

const ROWS = 10

// ⚠️ A LICENÇA SAIU DA LENTE DE VOLUME e a contagem de aportes entrou. Medido
// no dado real: as dez maiores carteiras são TODAS `commercial`, então a
// coluna imprimia a mesma palavra dez vezes e não separava ninguém de
// ninguém. Quantas vezes a carteira voltou varia de linha para linha, que é o
// que uma coluna de tabela precisa fazer. A escada de licenças continua
// explicada inteira na seção de tiers, logo acima.

// Data da chegada em UTC, curta. `crossed_at` vem do timestamp da transação;
// se vier vazio (evento sem carimbo, só altura de bloco) a célula fica muda em
// vez de imprimir "Invalid Date".
function arrivalDay(iso: string): string {
  if (!iso) return "·"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "·"
  return d.toLocaleDateString("en-US", { day: "2-digit", month: "short", timeZone: "UTC" }).toUpperCase()
}

function Row({
  lead, addr, right, sub,
}: { lead: string; addr: string; right: string; sub: string }) {
  return (
    <a
      href={`/address/bitcoin/${addr}`}
      className={`group grid grid-cols-[3.25rem_1fr_auto] items-baseline gap-3 border-b ${HAIR_SOFT} px-3 py-2.5 last:border-b-0 hover:bg-white/[0.03]`}
    >
      <span className="font-mono text-[11px] tabular-nums text-lava">{lead}</span>
      <span className="min-w-0 truncate font-mono text-[12px] text-snow/85 group-hover:text-snow">
        {shortAddr(addr)}
        <span className="ml-2 text-[10px] uppercase tracking-[0.18em] text-dusty/60">{sub}</span>
      </span>
      <span className="font-mono text-[12px] tabular-nums text-snow">{right}</span>
    </a>
  )
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className={`flex h-[41px] items-center border-b ${HAIR_SOFT} px-3 last:border-b-0`}>
      <span className="font-mono text-[11px] text-dusty/50">{text}</span>
    </div>
  )
}

export default function Section({ lb }: { lb: LeaderboardData | null }) {
  const reduce = useReducedMotion()
  const [lens, setLens] = useState<"founders" | "builders">("founders")

  const founders: FounderEntry[] = useMemo(() => (lb?.founders ?? []).slice(0, ROWS), [lb])
  const builders: BuilderEntry[] = useMemo(() => (lb?.leaderboard ?? []).slice(0, ROWS), [lb])

  const list = lens === "founders" ? founders : builders
  const total = lens === "founders" ? (lb?.founders_count ?? 0) : (lb?.donor_count ?? 0)
  const empty = lb ? "The register opens with the first contribution." : "Loading the register…"

  return (
    <section id="founders" className={`relative border-t ${HAIR_SOFT} scroll-mt-16`}>
      <div className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <Reveal y={10}>
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-lava">The Founders Register</p>
        </Reveal>

        <h2 className="font-display mt-3 text-3xl font-bold leading-tight text-snow md:text-4xl">
          <SplitLine text="Your place in the city is permanent." delay={0.12} step={0.055} />
        </h2>

        <Reveal delay={0.3} y={14}>
          <p className="mt-4 max-w-2xl font-mono text-[13px] leading-relaxed text-dusty">
            Every wallet that funds the city before the grand opening is a Founder, at any amount.
            The order is arrival, not size: the seat you take is the seat you keep. Read it the other
            way round with the second lens.
          </p>
        </Reveal>

        <div className={`mt-8 border ${HAIR}`}>
          {/* régua de lentes: duas células de uma grade, não duas pílulas */}
          <div className={`grid grid-cols-2 border-b ${GRIDLINE}`}>
            {([
              ["founders", "Founders", "by arrival"],
              ["builders", "Top builders", "by volume"],
            ] as const).map(([key, label, sub], i) => {
              const on = lens === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setLens(key)}
                  aria-pressed={on}
                  // ⚠️ Em 390px "Top builders" + "by volume" lado a lado quebram
                  // no meio da palavra e a célula fica com quatro linhas tortas.
                  // Empilhado embaixo de sm, em linha a partir de sm.
                  className={`relative flex flex-col gap-0.5 px-3 py-3 text-left sm:flex-row sm:items-baseline sm:gap-2 ${
                    i === 0 ? `border-r ${GRIDLINE}` : ""
                  } ${on ? "bg-lava/[0.06]" : "hover:bg-white/[0.02]"}`}
                >
                  <span
                    className={`font-mono text-[11px] uppercase tracking-[0.22em] ${
                      on ? "text-lava" : "text-dusty"
                    }`}
                  >
                    {label}
                  </span>
                  <span className="font-mono text-[10px] text-dusty/50">{sub}</span>
                  {on && <span aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-lava" />}
                </button>
              )
            })}
          </div>

          {/* cabeçalho da tabela */}
          <div
            className={`grid grid-cols-[3.25rem_1fr_auto] gap-3 border-b ${GRIDLINE} px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-dusty/60`}
          >
            <span>{lens === "founders" ? "Seat" : "Rank"}</span>
            <span>Wallet</span>
            <span>DOG</span>
          </div>

          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={lens}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: DUR.fast, ease: EASE }}
            >
              {list.length === 0
                ? Array.from({ length: 3 }, (_, i) => (
                    <EmptyRow key={i} text={i === 0 ? empty : ""} />
                  ))
                : list.map((e) =>
                    lens === "founders" ? (
                      <Row
                        key={`f-${e.address}`}
                        lead={String((e as FounderEntry).founder_seq).padStart(3, "0")}
                        addr={e.address}
                        sub={arrivalDay((e as FounderEntry).crossed_at)}
                        right={formatDog(e.total)}
                      />
                    ) : (
                      <Row
                        key={`b-${e.address}`}
                        lead={String((e as BuilderEntry).rank).padStart(3, "0")}
                        addr={e.address}
                        sub={
                          (e as BuilderEntry).txCount > 0
                            ? `${(e as BuilderEntry).txCount} TX${(e as BuilderEntry).txCount > 1 ? "S" : ""}`
                            : ""
                        }
                        right={formatDog(e.total)}
                      />
                    )
                  )}
            </motion.div>
          </AnimatePresence>

          {/* rodapé: quantos ficaram de fora das dez linhas */}
          <div
            className={`flex items-baseline justify-between border-t ${GRIDLINE} px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-dusty/60`}
          >
            <span>
              {total > ROWS
                ? `Showing ${list.length} of ${total.toLocaleString("en-US")}`
                : `${total.toLocaleString("en-US")} on the register`}
            </span>
            <a href="#build" className="text-lava hover:text-lava-light">
              Take a seat →
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
