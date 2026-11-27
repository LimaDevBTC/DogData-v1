// A tela do ranking dos DC Points, SEM estado e SEM hook: recebe o que mostrar (como app/dogcity/referrals/board-view.tsx), para o
// teste renderizar no servidor e conferir o texto publico. O estado (aba, periodo, dados) mora em page.tsx.
//
// ⚠️ O TEXTO E PUBLICO E EM INGLES, SEM TRAVESSAO (nem em dash nem en dash) e SEM PROMESSA DE PREMIO. O ranking soma pontos
// GANHOS, nunca o saldo. A conta mora em supabase/migrations/050 (a tabela de origens esta no cabecalho dela).
// ⚠️ Dado remoto so entra como texto de React (nunca HTML). Nenhum endereco inteiro chega aqui: a API entrega o abreviado.

import type { Board, Period, PublicRanking } from "@/lib/game/points/ranking"

const HAIR = "border-white/10"
const HAIR_SOFT = "border-white/[0.06]"

export type RankingState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: PublicRanking }

export const BOARD_TABS: { id: Board; label: string }[] = [
  { id: "total", label: "Total" },
  { id: "login", label: "Login" },
  { id: "ambassador", label: "Ambassador" },
]
export const PERIOD_TABS: { id: Period; label: string }[] = [
  { id: "all", label: "All time" },
  { id: "week", label: "This week" },
]

export const RULES: { lead: string; text: string }[] = [
  {
    lead: "Earned, not balance",
    text: "The ranking adds up the points a wallet has earned. Spending points, on a car for example, never moves anyone down.",
  },
  {
    lead: "Total",
    text: "Everything a wallet has earned: daily check-ins, the first steps and the other ways of earning in the city, Ambassador points, and the points brought over from the earlier points system.",
  },
  {
    lead: "Login",
    text: "Points from the daily check-in only.",
  },
  {
    lead: "Ambassador",
    text: "Points credited for the neighbours you invited.",
  },
  {
    lead: "This week",
    text: "The last 7 days of the game. Points brought over from the earlier system count in all time only, since they were not earned this week.",
  },
  {
    lead: "Ties",
    text: "Equal points share the same position. Among them, the wallet that reached that score first is listed first.",
  },
  {
    lead: "Privacy",
    text: "The ranking shows handles, or a shortened address when there is none. Only wallets with a handle earn points.",
  },
]

export const EMPTY_TEXT: Record<Board, string> = {
  total: "No points on the board yet. The first ones will show up here.",
  login: "No check-in points yet. The first ones will show up here.",
  ambassador: "No ambassador points yet. The first ones will show up here.",
}

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 })

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-[10px] md:text-[11px] tracking-[0.3em] text-lava">{children}</div>
}

function P({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-[13px] md:text-[15px] text-mist leading-relaxed mt-3 max-w-3xl ${className}`}>{children}</p>
}

export function updatedLabel(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 16).replace("T", " ") + " UTC"
}

function Tab({ active, onSelect, children }: { active: boolean; onSelect?: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      className={`inline-flex items-center justify-center px-4 min-h-[44px] font-mono text-[12px] tracking-[0.08em] border transition-colors ${
        active ? "bg-lava text-void border-lava font-bold" : `text-mist ${HAIR} hover:text-snow hover:border-white/30`
      }`}
    >
      {children}
    </button>
  )
}

function Avatar({ id, name }: { id: string | null; name: string }) {
  const initial = (name.replace(/^@/, "").charAt(0) || "?").toUpperCase()
  if (id) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/api/inscription/${id}/content`} alt="" width={28} height={28} loading="lazy" className="h-7 w-7 rounded-full object-cover bg-white/5" />
  }
  return (
    <span aria-hidden className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.07] font-mono text-[11px] text-mist">
      {initial}
    </span>
  )
}

export function RankingView({
  state, board, period, onBoard, onPeriod,
}: {
  state: RankingState
  board: Board
  period: Period
  onBoard?: (b: Board) => void
  onPeriod?: (p: Period) => void
}) {
  const data = state.status === "ready" ? state.data : null
  const stamp = data ? updatedLabel(data.updatedAt) : null
  return (
    <div className="bg-void text-snow">
      <div className="max-w-6xl mx-auto px-6 md:px-10 pt-10 pb-10 md:pt-16 md:pb-12">
        <Eyebrow>DOGCITY RANKING</Eyebrow>
        <h1 className="font-display font-bold text-snow text-[30px] leading-[1.05] md:text-[48px] md:leading-[1.03] mt-3 max-w-3xl">
          DC Points ranking
        </h1>
        <P className="max-w-2xl">Who has earned the most DC Points in the city. It counts points earned, never the balance.</P>
        <P className="max-w-2xl">Nothing on this page is a promise of a reward or of a value.</P>
      </div>

      <section className={`border-t ${HAIR_SOFT}`}>
        <div className="max-w-6xl mx-auto px-6 md:px-10 py-10 md:py-14">
          <Eyebrow>THE BOARD</Eyebrow>
          <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div role="tablist" aria-label="Board" className="flex flex-wrap gap-2">
              {BOARD_TABS.map((t) => (
                <Tab key={t.id} active={t.id === board} onSelect={() => onBoard?.(t.id)}>{t.label}</Tab>
              ))}
            </div>
            <div role="tablist" aria-label="Period" className="flex flex-wrap gap-2">
              {PERIOD_TABS.map((t) => (
                <Tab key={t.id} active={t.id === period} onSelect={() => onPeriod?.(t.id)}>{t.label}</Tab>
              ))}
            </div>
          </div>

          {data && data.total > 0 && (
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] tracking-[0.14em] text-dusty">
              <span>WALLETS <span className="text-snow tabular-nums">{fmt(data.total)}</span></span>
              {stamp && <span>UPDATED <span className="text-snow">{stamp}</span></span>}
            </div>
          )}

          {state.status === "loading" && <P>Reading the board.</P>}
          {state.status === "error" && <P>Unavailable right now. Try again in a few minutes.</P>}
          {data && data.rows.length === 0 && <P>{EMPTY_TEXT[board]}</P>}
          {data && data.rows.length > 0 && (
            <div className={`mt-6 border ${HAIR} overflow-x-auto`}>
              <table className="w-full min-w-[320px] font-mono text-[12px]">
                <thead>
                  <tr className={`border-b ${HAIR} text-left text-[10px] tracking-[0.2em] text-dusty`}>
                    <th className="px-3 md:px-4 py-3 font-normal w-12">#</th>
                    <th className="px-3 md:px-4 py-3 font-normal">PLAYER</th>
                    <th className="px-3 md:px-4 py-3 font-normal text-right">POINTS</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r, i) => {
                    const name = r.handle ? `@${r.handle}` : r.wallet
                    return (
                      <tr key={`${r.rank}-${i}-${name}`} className={`border-b ${HAIR_SOFT} last:border-0`}>
                        <td className={`px-3 md:px-4 py-2.5 tabular-nums ${r.rank <= 3 ? "text-lava font-bold" : "text-dusty"}`}>{r.rank}</td>
                        <td className="px-3 md:px-4 py-2.5 text-snow">
                          <span className="flex items-center gap-3 min-w-0">
                            <Avatar id={r.avatar} name={name} />
                            {r.walletPath ? (
                              <a href={r.walletPath} className="truncate hover:text-lava transition-colors">{name}</a>
                            ) : (
                              <span className="truncate">{name}</span>
                            )}
                          </span>
                        </td>
                        <td className="px-3 md:px-4 py-2.5 text-right text-snow tabular-nums">{fmt(r.points)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {data && data.me && (
            <div className={`mt-3 flex items-center justify-between gap-4 border border-lava/60 bg-lava/[0.06] px-3 md:px-4 py-3 font-mono text-[12px]`}>
              <span className="flex items-center gap-3">
                <span className="text-lava font-bold tabular-nums">{data.me.rank}</span>
                <span className="text-snow">You</span>
              </span>
              <span className="text-snow tabular-nums">{fmt(data.me.points)}</span>
            </div>
          )}
        </div>
      </section>

      <section className={`border-t ${HAIR_SOFT}`}>
        <div className="max-w-6xl mx-auto px-6 md:px-10 py-12 md:py-14">
          <Eyebrow>HOW WE COUNT</Eyebrow>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 max-w-4xl list-none p-0">
            {RULES.map((r) => (
              <li key={r.lead} className={`border ${HAIR} bg-white/[0.02] px-5 py-4`}>
                <p className="font-display font-bold text-snow">{r.lead}</p>
                <p className="mt-1 text-[13px] text-mist leading-relaxed">{r.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
