// ═══════════════════════════════════════════════════════════════════════════
// OS 138 FOUNDERS (/dogcity/founders, servida em dogcity.space/founders), pública, em inglês.
//
// 23/10/2026 (revisão da landing, fundador): a página de OFERTA do Founders Pack virou a página de HONRA. O programa
// fechou no bloco 972.336 (B), quando o fundo de construção chegou a 10.000.000 $DOG; a oferta antiga ("open until the
// fund reaches 10,000,000", "Fund the city") contradizia a landing para quem clicava em "138 FOUNDERS". O texto
// completo das regras segue publicado nas docs, seção 6 (o contrato), e é para lá que esta página aponta.
//
// A LISTA é a inscrita em F (filha da City Charter, f73352f7…i0), a mesma que o mint usa para o Founder: public/data/
// founders-972336.json, exportada de dogcity-mint/apps/web/public/data/founders-donations-972336.json (scripts/
// fundadores_doacoes.py de lá confere 138/138 contra F). A soma dá os 10.407.345,6 $DOG da linha FUNDED da landing.
// Nada aqui é ao vivo: é história, fechada.
//
// O degrau de cada founder é o do total em $DOG no fechamento (mais o BTC creditado, que só soma na licença). Quem
// ficou abaixo de 10.000 $DOG é Citizen: founder sem licença de construção (docs, seção 6).
// ═══════════════════════════════════════════════════════════════════════════

"use client"

import { useEffect, useMemo, useState } from "react"
import { Layout } from "@/components/layout"

const HAIR = "border-white/10"
const HAIR_SOFT = "border-white/[0.06]"

interface Founder { n: number; address: string; dog: number; btc_dog: number }
interface Arquivo { f_inscription: string; block_b: number; founders: Founder[] }

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 })
const curto = (a: string) => `${a.slice(0, 10)}…${a.slice(-6)}`

function rung(f: Founder): { name: string; color: string } {
  const t = f.dog + f.btc_dog
  if (t >= 500_000) return { name: "Patron", color: "#FFAD42" }
  if (t >= 50_000) return { name: "Commercial", color: "#FB923C" }
  if (t >= 10_000) return { name: "Personal", color: "#F56E0F" }
  return { name: "Citizen", color: "#9CA3AF" }
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-[10px] md:text-[11px] tracking-[0.3em] text-lava">{children}</div>
}

function P({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-[13px] md:text-[15px] text-mist leading-relaxed mt-3 max-w-3xl ${className}`}>{children}</p>
}

// what only the 138 keep: the docs, section 6, in short; the full terms live there
const KEEP = [
  { lead: "A Founder number", text: "Assigned by order of arrival and never issued again." },
  { lead: "The Founders' Monument", text: "Every name on it, in the order the wallets arrived." },
  { lead: "The Founders Club", text: "Access to the club on its island in the city's bay." },
  { lead: "The Founders' draw", text: "One entry per Founder." },
  { lead: "Minting first, free", text: "From Personal up: the Founder phase, before anyone else, paying only the network fee and postage." },
  { lead: "The Founder's light", text: "From Personal up: on the building, visible from above at night." },
]

export default function DogCityFoundersPage() {
  const [arq, setArq] = useState<Arquivo | null>(null)
  const [erro, setErro] = useState(false)
  const [q, setQ] = useState("")
  useEffect(() => {
    fetch("/data/founders-972336.json")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setArq)
      .catch(() => setErro(true))
  }, [])

  const contagem = useMemo(() => {
    const c: Record<string, number> = { Citizen: 0, Personal: 0, Commercial: 0, Patron: 0 }
    for (const f of arq?.founders ?? []) c[rung(f).name]++
    return c
  }, [arq])
  const lista = useMemo(() => {
    const t = q.trim().toLowerCase().replace(/^#/, "")
    if (!arq) return []
    if (!t) return arq.founders
    return arq.founders.filter((f) => f.address.toLowerCase().includes(t) || String(f.n) === t)
  }, [arq, q])

  return (
    <Layout currentPage="donate" setCurrentPage={() => {}}>
      <div className="bg-void text-snow">
        <div className="max-w-6xl mx-auto px-6 md:px-10 pt-10 pb-10 md:pt-16 md:pb-14">
          <Eyebrow>THE FOUNDERS</Eyebrow>
          <h1 className="font-display font-bold text-snow text-[30px] leading-[1.05] md:text-[48px] md:leading-[1.03] mt-3 max-w-3xl">
            138 wallets funded the city.
          </h1>
          <P className="max-w-2xl">
            The construction fund reached 10,000,000 $DOG at block 972,336. The 138 wallets that put $DOG into it before
            that block are the Founders of DogCity. The list is closed, and it is inscribed on Bitcoin as a child of the
            City Charter.
          </P>

          <div className={`mt-6 border ${HAIR} bg-white/[0.02] px-5 py-4 font-mono text-[11px] tracking-[0.18em] text-mist max-w-3xl`}>
            <span className="text-lava">CLOSED</span>
            <span className="mx-2 text-dusty" aria-hidden>·</span>BLOCK 972,336
            <span className="mx-2 text-dusty" aria-hidden>·</span>10,407,345 $DOG
            <span className="mx-2 text-dusty" aria-hidden>·</span>138 FOUNDERS
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <a
              href="https://mint.dogcity.space"
              className="inline-flex items-center justify-center px-5 py-3 min-h-[44px] font-mono text-[12px] font-bold text-void bg-lava hover:bg-lava-light transition-colors"
            >
              Founders: mint your lot
            </a>
            <a
              href="/dogcity#tiers"
              className="inline-flex items-center justify-center px-5 py-3 min-h-[44px] font-mono text-[12px] font-bold text-snow border border-white/20 hover:border-white/[0.45] transition-colors"
            >
              Get a building licence
            </a>
          </div>
          <p className="mt-4 font-mono text-[11px] text-dusty leading-relaxed max-w-2xl">
            A Founder mints from the wallet that funded the city.{" "}
            <a href="https://mint.dogcity.space/#founder-wallets" className="text-lava hover:text-lava-light">
              Which wallet did you donate from?
            </a>
          </p>
        </div>

        <section className={`border-t ${HAIR_SOFT}`}>
          <div className="max-w-6xl mx-auto px-6 md:px-10 py-12 md:py-16">
            <Eyebrow>WHAT ONLY THE FOUNDERS KEEP</Eyebrow>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2 max-w-4xl">
              {KEEP.map((k) => (
                <li key={k.lead} className={`border ${HAIR} bg-white/[0.02] px-5 py-4`}>
                  <p className="font-display font-bold text-snow">{k.lead}</p>
                  <p className="mt-1 text-[13px] text-mist leading-relaxed">{k.text}</p>
                </li>
              ))}
            </ul>
            <P>
              Nothing here moves a lot: where every wallet lives was decided by block 966,670. A building licence is still
              open to anyone, in $DOG or Bitcoin, but what is on this list cannot be bought any more.{" "}
              <a href="/dogcity/docs#founders-program" className="text-lava hover:text-lava-light">
                The full terms are in the docs, section 6.
              </a>
            </P>
          </div>
        </section>

        <section className={`border-t ${HAIR_SOFT}`}>
          <div className="max-w-6xl mx-auto px-6 md:px-10 py-12 md:py-16">
            <Eyebrow>THE LIST, AS INSCRIBED</Eyebrow>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] tracking-[0.14em] text-dusty">
              {(["Patron", "Commercial", "Personal", "Citizen"] as const).map((k) => (
                <span key={k}>
                  {k.toUpperCase()} <span className="text-snow tabular-nums">{arq ? contagem[k] : "—"}</span>
                </span>
              ))}
            </div>
            <div className="mt-5 max-w-xl">
              <label htmlFor="fd-q" className="sr-only">Search by address or Founder number</label>
              <input
                id="fd-q"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by address or #number"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                className={`w-full bg-white/[0.03] border ${HAIR} px-4 py-3 min-h-[44px] font-mono text-[13px] text-snow placeholder:text-dusty focus:outline-none focus:border-lava/60`}
              />
            </div>

            {erro ? (
              <P>The list did not load. Refresh the page to try again.</P>
            ) : !arq ? (
              <P>Reading the list…</P>
            ) : (
              <div className={`mt-6 border ${HAIR} overflow-x-auto`}>
                <table className="w-full min-w-[520px] font-mono text-[12px]">
                  <thead>
                    <tr className={`border-b ${HAIR} text-left text-[10px] tracking-[0.2em] text-dusty`}>
                      <th className="px-4 py-3 font-normal">#</th>
                      <th className="px-4 py-3 font-normal">WALLET</th>
                      <th className="px-4 py-3 font-normal text-right">$DOG</th>
                      <th className="px-4 py-3 font-normal">RUNG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map((f) => {
                      const r = rung(f)
                      return (
                        <tr key={f.address} className={`border-b ${HAIR_SOFT} last:border-0`}>
                          <td className="px-4 py-2.5 text-dusty tabular-nums">{f.n}</td>
                          <td className="px-4 py-2.5">
                            <a href={`/address/bitcoin/${f.address}`} title={f.address} className="text-mist hover:text-lava">
                              {curto(f.address)}
                            </a>
                          </td>
                          <td className="px-4 py-2.5 text-right text-snow tabular-nums">{fmt(f.dog)}</td>
                          <td className="px-4 py-2.5" style={{ color: r.color }}>{r.name}</td>
                        </tr>
                      )
                    })}
                    {lista.length === 0 && (
                      <tr><td colSpan={4} className="px-4 py-4 text-dusty">No Founder matches that search.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {arq && (
              <p className="mt-4 font-mono text-[11px] text-dusty leading-relaxed max-w-3xl">
                The order is the order of arrival: the block of each wallet&apos;s first contribution, then its place in the
                block. This list is inscription{" "}
                <a href={`https://ordinals.com/inscription/${arq.f_inscription}`} target="_blank" rel="noopener noreferrer" className="text-lava hover:text-lava-light">
                  {arq.f_inscription.slice(0, 8)}…{arq.f_inscription.slice(-4)} ↗
                </a>
                , a child of the City Charter, cut at block {fmt(arq.block_b)}.
              </p>
            )}
          </div>
        </section>
      </div>
    </Layout>
  )
}
