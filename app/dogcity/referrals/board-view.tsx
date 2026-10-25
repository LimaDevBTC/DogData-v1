// A tela do placar de referral (fase 1: so contar), SEM estado e SEM hook: recebe o que mostrar.
// Fica separada da page.tsx para o teste renderiza-la no servidor (react-dom/server) e conferir o
// texto publico: regras, ausencia de travessao, nenhum endereco inteiro.
//
// ⚠️ O TEXTO E PUBLICO E EM INGLES, SEM TRAVESSAO (nem em dash nem en dash) e SEM PROMESSA DE VALOR.
// O que o referral destrava sera anunciado depois, com os dados na mao (decisao do fundador, 25/10/2026).
// As regras abaixo sao o contrato da contagem: mudou a conta, muda a lista (lib/referral/tally.ts).

import type { PublicBoard } from "@/lib/referral/board"

const HAIR = "border-white/10"
const HAIR_SOFT = "border-white/[0.06]"

export type BoardState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; board: PublicBoard }

export const RULES: { lead: string; text: string }[] = [
  {
    lead: "What counts as a referral",
    text: "A wallet that proves ownership for the first time after opening your link. A wallet that had already verified before can never be claimed by a link.",
  },
  {
    lead: "One referrer per wallet",
    text: "The first link that counts is the only one, for good. A second link does not replace it.",
  },
  {
    lead: "What does not count",
    text: "Referring yourself, with your own wallet or through your own handle. Links to a handle that does not exist. Only verified accounts with a handle can refer, and a link that does not qualify is ignored without any message.",
  },
  {
    lead: "Minted",
    text: "Referred wallets whose lot deed was minted after the link, read from the public mint API and the Bitcoin block of the mint. Mints before the link do not count. In this phase only lots registered to the referred wallet are seen.",
  },
  {
    lead: "Licences",
    text: "What referred wallets paid to the building fund after the link, in $DOG or in BTC at its locked $DOG value. The tier shown is the one those later payments reach on the usual ladder: Personal 10,000, Commercial 50,000, Patron 500,000 $DOG. Payments before the link do not count.",
  },
  {
    lead: "After the link",
    text: "In a Bitcoin block later than the one where the link was made. Counts are refreshed every few minutes, they are not live.",
  },
  {
    lead: "Abuse",
    text: "We may exclude accounts and referrals we judge to be abuse, such as wallets made only to farm this board, and we may correct the board. The rules can be refined before anything is announced.",
  },
  {
    lead: "Privacy",
    text: "The board shows handles, or a shortened address when there is none. The wallets you referred are never listed.",
  },
]

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 })

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-[10px] md:text-[11px] tracking-[0.3em] text-lava">{children}</div>
}

function P({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-[13px] md:text-[15px] text-mist leading-relaxed mt-3 max-w-3xl ${className}`}>{children}</p>
}

function licenceCell(l: { personal: number; commercial: number; patron: number }): { total: number; detail: string } {
  const parts: string[] = []
  if (l.patron) parts.push(`${l.patron} Patron`)
  if (l.commercial) parts.push(`${l.commercial} Commercial`)
  if (l.personal) parts.push(`${l.personal} Personal`)
  return { total: l.personal + l.commercial + l.patron, detail: parts.join(", ") }
}

function updatedLabel(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 16).replace("T", " ") + " UTC"
}

export function ReferralBoardView({ state }: { state: BoardState }) {
  const board = state.status === "ready" ? state.board : null
  const stamp = board ? updatedLabel(board.updated_at) : null
  return (
    <div className="bg-void text-snow">
      <div className="max-w-6xl mx-auto px-6 md:px-10 pt-10 pb-10 md:pt-16 md:pb-12">
        <Eyebrow>DOGCITY REFERRALS</Eyebrow>
        <h1 className="font-display font-bold text-snow text-[30px] leading-[1.05] md:text-[48px] md:leading-[1.03] mt-3 max-w-3xl">
          Referral board
        </h1>
        <P className="max-w-2xl">We&apos;re counting. What referrals unlock will be announced.</P>
        <P className="max-w-2xl">
          This phase only counts how many referrals each verified account brought. Nothing on this page is a promise of
          a reward or of a value.
        </P>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <a
            href="/profile"
            className="inline-flex items-center justify-center px-5 py-3 min-h-[44px] font-mono text-[12px] font-bold text-void bg-lava hover:bg-lava-light transition-colors"
          >
            Get your referral link
          </a>
          <span className="font-mono text-[11px] text-dusty">It lives in your profile, once you have verified a wallet and claimed a handle.</span>
        </div>
      </div>

      <section className={`border-t ${HAIR_SOFT}`}>
        <div className="max-w-6xl mx-auto px-6 md:px-10 py-12 md:py-14">
          <Eyebrow>THE BOARD</Eyebrow>
          {board && board.referrers > 0 && (
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] tracking-[0.14em] text-dusty">
              <span>REFERRERS <span className="text-snow tabular-nums">{fmt(board.referrers)}</span></span>
              <span>REFERRALS <span className="text-snow tabular-nums">{fmt(board.referred)}</span></span>
              {stamp && <span>LAST COUNT <span className="text-snow">{stamp}</span></span>}
            </div>
          )}

          {state.status === "loading" && <P>Reading the board.</P>}
          {state.status === "error" && <P>The board is not available right now. Try again in a few minutes.</P>}
          {board && board.rows.length === 0 && (
            <P>No referrals counted yet. The first ones will show up here.</P>
          )}
          {board && board.rows.length > 0 && (
            <div className={`mt-6 border ${HAIR} overflow-x-auto`}>
              <table className="w-full min-w-[560px] font-mono text-[12px]">
                <thead>
                  <tr className={`border-b ${HAIR} text-left text-[10px] tracking-[0.2em] text-dusty`}>
                    <th className="px-4 py-3 font-normal">#</th>
                    <th className="px-4 py-3 font-normal">REFERRER</th>
                    <th className="px-4 py-3 font-normal text-right">REFERRED</th>
                    <th className="px-4 py-3 font-normal text-right">MINTED</th>
                    <th className="px-4 py-3 font-normal text-right">LICENCES</th>
                    <th className="px-4 py-3 font-normal text-right">$DOG PAID</th>
                  </tr>
                </thead>
                <tbody>
                  {board.rows.map((r) => {
                    const lic = licenceCell(r.licences)
                    return (
                      <tr key={`${r.rank}-${r.name}`} className={`border-b ${HAIR_SOFT} last:border-0`}>
                        <td className="px-4 py-2.5 text-dusty tabular-nums">{r.rank}</td>
                        <td className="px-4 py-2.5 text-snow">{r.name}</td>
                        <td className="px-4 py-2.5 text-right text-snow tabular-nums">{fmt(r.referred)}</td>
                        <td className="px-4 py-2.5 text-right text-mist tabular-nums">{fmt(r.minted)}</td>
                        <td className="px-4 py-2.5 text-right text-mist tabular-nums">
                          {lic.total ? fmt(lic.total) : "0"}
                          {lic.detail && <span className="block text-[10px] text-dusty">{lic.detail}</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right text-mist tabular-nums">{fmt(r.licence_dog)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
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
