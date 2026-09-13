// ═══════════════════════════════════════════════════════════════════════════
// A PÁGINA DE OFERTA DO FOUNDERS PACK (/dogcity/founders), pública, em inglês.
//
// A landing converte; esta página FECHA. É para onde vai quem já está quente, e
// é link que se manda direto para uma pessoa sem obrigá-la a passar pelo funil
// inteiro de /dogcity. Por isso ela repete de propósito o fundo ao vivo e o
// registro no fim: quem chega aqui por link externo não viu nenhum dos dois.
//
// FONTE: marketing/FOUNDERS-PACK.md, spec fechada em 12/09/2026. Toda frase,
// limiar, tabela e regra abaixo vem de lá. A liberdade tomada foi de
// APRESENTAÇÃO (markdown vira componente), nunca de conteúdo.
//
// ⚠️ O QUE FICOU DE FORA, E POR QUÊ:
//
//  1. O DEGRAU "INSTITUTIONAL PARTNER" (§3 do markdown) NÃO ENTRA, nem ele nem
//     preço nenhum dele. O próprio markdown diz: "NOT PUBLIC. Do not put this
//     rung, or a price, in any public document." A escada pública tem QUATRO
//     degraus e termina em Patron.
//  2. §7 (números vivos) NÃO É TRANSCRITO. "fund 4.901.656 de 10.000.000" e
//     "Founders 51" são fotografias de 12/09 e envelhecem sozinhas. O fundo
//     entra ao vivo, por <ConstructionFund lb={lb} />, que lê
//     /api/donate/leaderboard como a landing já lê. Nenhum número do fundo é
//     escrito à mão neste arquivo.
//  3. §8 ("Notes for whoever writes the copy") não é conteúdo, é instrução
//     interna para quem escreve copy A PARTIR do documento. Mesma decisão já
//     tomada em /dogcity/docs. As duas regras de lá que PRECISAM aparecer
//     viraram frase afirmativa na seção 7: um Founder escolhe quando e o que
//     construir, nunca onde, e nada aqui é retorno, participação ou rendimento.
//  4. A DATA DO SORTEIO NÃO EXISTE AINDA (§9, "Open"). A página diz que será
//     anunciada e que, uma vez anunciada, não muda. Nenhuma data inventada.
//
// ⚠️ A FRONTEIRA DO CUSTOM BUILDING (seção 3) É OBRIGATÓRIA NA PÁGINA. Sem ela,
// quem contribui 500.000 $DOG segurando 15.000 $DOG espera uma torre e recebe
// um prédio pequeno de desenho único. A reclamação teria razão, porque ninguém
// disse onde ficava o limite. Custom é na FORMA, nunca na MASSA.
//
// ⚠️ NENHUM LOTE É SORTEADO, NENHUM LOTE É BENEFÍCIO, E TERRA NÃO APARECE COMO
// VANTAGEM DE FOUNDER EM FORMA NENHUMA. Onde a carteira mora foi decidido pelo
// bloco 966.670 e por nada que se pague.
//
// A página não tem animação de scroll própria (é documento de fecho, não a
// folia da landing), mas é "use client" por dois motivos: o <Layout> da casa
// usa useRouter, e o fundo ao vivo precisa do useEffect. A metadata mora no
// layout.tsx irmão.
// ═══════════════════════════════════════════════════════════════════════════

"use client"

import { useEffect, useState } from "react"
import { Layout } from "@/components/layout"
import ConstructionFund from "../sections/construction-fund"
import FoundersRegister from "../sections/founders-register"
import type { LeaderboardData } from "../types"

// ── mesmas constantes de hairline de ../motion.tsx, copiadas localmente ────
// ⚠️ border-white/8 e /12 NÃO COMPILAM nesta escala e caem no #D1D5DB do
// preflight, pintando filete cinza CLARO em página preta. Só estas formas.
const HAIR = "border-white/10"
const HAIR_SOFT = "border-white/[0.06]"

// ═══════════════════════════════════════════════════════════════════════════
// primitivas de tipografia e layout, as mesmas de /dogcity/docs
// ═══════════════════════════════════════════════════════════════════════════

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-[10px] md:text-[11px] tracking-[0.3em] text-lava">{children}</div>
}

function P({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-[13px] md:text-[15px] text-mist leading-relaxed mt-3 max-w-3xl ${className}`}>{children}</p>
}

function Sub({ children }: { children: React.ReactNode }) {
  return <h3 className="font-display font-bold text-base md:text-lg text-snow mt-10 first:mt-0">{children}</h3>
}

function BulletList({ items }: { items: { lead: string; text: string }[] }) {
  return (
    <ul className="mt-4 space-y-3 max-w-3xl">
      {items.map((it, i) => (
        <li key={i} className="text-[13px] md:text-[15px] text-mist leading-relaxed flex gap-3">
          <span className="text-lava shrink-0">·</span>
          <span>
            <strong className="text-snow">{it.lead}</strong> {it.text}
          </span>
        </li>
      ))}
    </ul>
  )
}

// a linha rótulo/valor dos blocos monoespaçados. `flex-wrap` é o que segura
// 400px: o valor cai para a linha de baixo em vez de esticar a caixa.
function Row({ label, value, note }: { label: string; value?: string; note?: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
      <span className="text-dusty">{label}</span>
      {value && <span className="text-snow">{value}</span>}
      {note && <span className="text-dusty">{note}</span>}
    </div>
  )
}

function DataBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className={`mt-4 border ${HAIR} bg-white/[0.02] px-5 py-4 md:px-6 md:py-5 font-mono text-[11px] md:text-xs space-y-1.5 max-w-2xl`}>
      {children}
    </div>
  )
}

// o aviso duro. É a peça que impede a reclamação com razão, então tem material
// próprio: filete lava à esquerda, nunca um parágrafo a mais no meio do texto.
function Warning({ lead, children }: { lead: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 max-w-3xl border-l-2 border-lava bg-lava/[0.05] px-4 py-3.5 md:px-5">
      <div className="font-mono text-[10px] md:text-[11px] tracking-[0.22em] text-lava">{lead}</div>
      <div className="text-[13px] md:text-[15px] text-mist leading-relaxed mt-2">{children}</div>
    </div>
  )
}

function Section({
  id, n, title, children,
}: {
  id: string
  n: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className={`relative border-t ${HAIR_SOFT} scroll-mt-24`}>
      <div className="py-14 md:py-20">
        <Eyebrow>SECTION {n}</Eyebrow>
        <h2 className="font-display font-bold text-2xl md:text-[32px] text-snow mt-3 leading-tight max-w-2xl">
          {title}
        </h2>
        <div className="mt-6">{children}</div>
      </div>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// dados da página, todos transcritos de marketing/FOUNDERS-PACK.md
// ═══════════════════════════════════════════════════════════════════════════

// §2. A ordem é a do documento e a copy deve mantê-la.
const AXES = [
  { key: "Seen", text: "The building is standing on opening day and carries a marker only Founders have." },
  { key: "Remembered", text: "The name on the Founders' Monument, the number on the facade." },
  { key: "First", text: "Mints before the doors open, and is inside every test and update before anyone." },
]

// §3. Quatro degraus públicos. O quinto ("Institutional partner") NÃO ENTRA
// AQUI, por ordem expressa do próprio documento. As cores são as mesmas de
// TIERS em ../dogcity-data.ts, para a escada ser a mesma escada nas duas
// páginas; a copy é a do FOUNDERS-PACK, que é a spec fechada.
interface Rung {
  key: string
  name: string
  threshold: string
  color: string
  lead: string
  featured?: boolean
  perks: string[]
  note?: string
}

const RUNGS: Rung[] = [
  {
    key: "citizen",
    name: "Citizen",
    threshold: "Any amount",
    color: "#CBD5E1",
    lead: "Includes",
    perks: [
      "Name on the Founders' Monument, in order of arrival",
      "Founder number, permanent and never issued again",
      "Access to the Founders Club, on its island in the bay",
      "One entry in the Founders' draw",
    ],
    note: "There is no building licence below 10,000 $DOG. The recognition is permanent either way, and the order number is the one thing that cannot be obtained later.",
  },
  {
    key: "personal",
    name: "Personal",
    threshold: "10,000 $DOG",
    color: "#F56E0F",
    featured: true,
    lead: "Adds",
    perks: [
      "Building licence, paid once, permanent",
      "Mints before the Grand Opening, so the building is standing on day one",
      "Early access to the game, to every test and every update",
      "The Founder's light on the building, visible from above at night",
      "Base item pack: yard and house number plaque",
    ],
  },
  {
    key: "commercial",
    name: "Commercial",
    threshold: "50,000 $DOG",
    color: "#FB923C",
    lead: "Adds",
    perks: [
      "Extended item pack: leisure ground, garden, lighting",
      "A lunar rover parked on the lot",
    ],
  },
  {
    key: "patron",
    name: "Patron",
    threshold: "500,000 $DOG",
    color: "#FFAD42",
    lead: "Adds",
    perks: [
      "Names a street, and the name stays on the city map",
      "A custom building, designed outside the district catalogue",
    ],
  },
]

// quanto da folha cada degrau já ocupa em repouso. É PARÂMETRO DE DESENHO, não
// dado do projeto: a escalada da escada expressa como material, igual em
// ../sections/tiers.tsx. Nada aqui alega coisa alguma sobre o produto.
const LOT_REST_FILL: Record<string, number> = {
  citizen: 22,
  personal: 44,
  commercial: 66,
  patron: 100,
}

// §3, "The ladder escalates in kind, not only in count". Onde existe variante,
// o degrau de cima recebe a VERSÃO EXCLUSIVA do mesmo item.
const ESCALATION: { family: string; cells: [string, string][] }[] = [
  {
    family: "vehicle",
    cells: [
      ["PERSONAL", "none"],
      ["COMMERCIAL", "lunar rover"],
      ["PATRON", "black tuned rover"],
    ],
  },
  {
    family: "light",
    cells: [
      ["PERSONAL", "Founder's light"],
      ["COMMERCIAL", "pack lighting"],
      ["PATRON", "its own signature, seen from above at night"],
    ],
  },
  {
    family: "plaque",
    cells: [
      ["PERSONAL", "house number"],
      ["COMMERCIAL", "same"],
      ["PATRON", "own material and finish"],
    ],
  },
  {
    family: "ground",
    cells: [
      ["PERSONAL", "yard"],
      ["COMMERCIAL", "leisure ground, garden"],
      ["PATRON", "pieces from the closed catalogue"],
    ],
  },
]

// §4. Quatro prêmios, um sorteio, entre todo Founder de qualquer degrau.
const PRIZES: { title: string; text: string }[] = [
  { title: "A Runestone", text: "One of the 112,384, held by the project, given away once" },
  { title: "A custom building", text: "The Patron privilege, granted to a winner at any rung" },
  { title: "A street name", text: "Named by the winner, printed on the city map" },
  { title: "The 1 of 1", text: "The first lunar rover ever minted, the only one of its kind" },
]

// §5. As quatro famílias, todas vivendo no lote e não na casa.
const FAMILIES: { name: string; text: string }[] = [
  { name: "ground", text: "yard, pool, deck, court, fence, paving" },
  { name: "vehicle", text: "the lunar rover is the hero item" },
  { name: "light", text: "the Founder marker, lamps" },
  { name: "plaque", text: "the Founder number on the facade" },
]

const TOC = [
  { id: "what-a-founder-is", n: "1", label: "What a Founder is" },
  { id: "the-three-axes", n: "2", label: "The three axes" },
  { id: "the-ladder", n: "3", label: "The ladder" },
  { id: "the-draw", n: "4", label: "The Founders' draw" },
  { id: "items", n: "5", label: "Items" },
  { id: "the-island", n: "6", label: "The Founders Club island" },
  { id: "what-it-is-not", n: "7", label: "What a Founder is not" },
  { id: "build", n: "8", label: "The construction fund" },
]

// ── um degrau ──────────────────────────────────────────────────────────────
function RungCard({ r, index, count }: { r: Rung; index: number; count: number }) {
  const fill = LOT_REST_FILL[r.key] ?? 22
  return (
    <div
      className={`fp-rung relative h-full border p-5 md:p-6 flex flex-col transition-colors duration-500 ${
        r.featured ? "border-lava/50 bg-lava/[0.04] hover:border-lava/75" : `${HAIR} hover:border-white/25`
      }`}
      style={{ ["--fp-lot-rest" as string]: `${100 - fill}%` }}
    >
      {/* o lote: o chão que este degrau já cobre, na malha do levantamento */}
      <span aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
        <span
          className="fp-lot absolute inset-0"
          style={{
            backgroundImage:
              `linear-gradient(to right, ${r.color}1A 1px, transparent 1px),` +
              `linear-gradient(to bottom, ${r.color}1A 1px, transparent 1px)`,
            backgroundSize: "7px 7px",
            backgroundPosition: "left bottom",
            WebkitMaskImage: "linear-gradient(to top, #000 0%, #000 45%, rgba(0,0,0,0.22) 100%)",
            maskImage: "linear-gradient(to top, #000 0%, #000 45%, rgba(0,0,0,0.22) 100%)",
          }}
        />
        <span
          className="fp-lotline absolute inset-x-0 top-0 h-full border-t"
          style={{
            borderColor: `${r.color}66`,
            WebkitMaskImage:
              "linear-gradient(to right, #000 0 22px, transparent 22px calc(100% - 22px), #000 calc(100% - 22px))",
            maskImage:
              "linear-gradient(to right, #000 0 22px, transparent 22px calc(100% - 22px), #000 calc(100% - 22px))",
          }}
        />
      </span>

      {r.featured && (
        <span className="absolute -top-px right-4 font-mono text-[9px] tracking-[0.2em] text-void bg-lava px-2 py-0.5">
          MINT LICENCE
        </span>
      )}

      <div className="relative flex flex-col flex-1">
        <div className="flex items-baseline justify-between gap-3 font-mono text-[9px] tracking-[0.25em] text-dusty">
          <span>RUNG</span>
          <span className="tabular-nums shrink-0">
            {String(index + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
          </span>
        </div>

        <span aria-hidden className="mt-3 block h-px w-10" style={{ background: r.color }} />

        <div className="font-display font-bold text-xl mt-3" style={{ color: r.color }}>
          {r.name}
        </div>
        <div className="font-mono text-sm text-snow mt-1 tabular-nums">{r.threshold}</div>

        <div className="font-mono text-[9px] tracking-[0.25em] text-dusty mt-5">{r.lead.toUpperCase()}</div>
        <ul className="mt-2.5 space-y-2 flex-1">
          {r.perks.map((p) => (
            <li key={p} className="text-[12.5px] text-mist leading-relaxed flex gap-2">
              <span className="text-lava shrink-0">▸</span>
              {p}
            </li>
          ))}
        </ul>

        {r.note && (
          <p className={`mt-4 pt-3 border-t ${HAIR} font-mono text-[11px] sm:text-[10px] text-dusty leading-relaxed`}>
            {r.note}
          </p>
        )}

        <a
          href="#build"
          // min-h-[44px]: piso de toque. Sem isto o botão mede 40px de altura.
          className={`mt-5 inline-flex justify-center items-center px-4 py-2.5 min-h-[44px] font-mono text-[12px] font-bold transition-colors ${
            r.featured
              ? "text-void bg-lava hover:bg-lava-light"
              : "text-snow border border-white/20 hover:border-white/[0.45]"
          }`}
        >
          Fund the city
        </a>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
export default function DogCityFoundersPage() {
  const [lb, setLb] = useState<LeaderboardData | null>(null)

  // ⚠️ r.ok E a forma são obrigatórios: no incidente de IO de 26/08 a rota
  // devolveu 503 com corpo { error }, o objeto passava pelo guard de null e um
  // .toLocaleString() de campo inexistente derrubava a árvore inteira. Sem dado
  // as duas seções do fim desenham os placeholders delas, nunca quebram.
  useEffect(() => {
    fetch("/api/donate/leaderboard", { signal: AbortSignal.timeout(10000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j && typeof j.total_received === "number") setLb(j)
      })
      .catch(() => {})
  }, [])

  return (
    <Layout currentPage="donate" setCurrentPage={() => {}}>
      <div className="bg-void text-snow">
        {/* ── cabeçalho do documento ─────────────────────────────────────── */}
        <div className="max-w-6xl mx-auto px-6 md:px-10 pt-10 pb-8 md:pt-16 md:pb-10">
          <Eyebrow>THE FOUNDERS PROGRAM</Eyebrow>
          <h1 className="font-display font-bold text-snow text-[30px] leading-[1.05] md:text-[48px] md:leading-[1.03] mt-3 max-w-3xl">
            There is no cap on the number of Founders. What closes is the time.
          </h1>
          <P className="max-w-2xl">
            A Founder is anyone who contributes to the construction fund before it reaches
            10,000,000 $DOG. It is a goal, not a sale. A construction fund, not a raise. The
            licence to build is a product and can be bought; the fund is not a raise, and the two
            never mix.
          </P>

          <div className="mt-5 font-mono text-[11px] md:text-xs text-dusty leading-relaxed max-w-2xl">
            <span className="text-mist">STATUS</span> · open until the construction fund reaches
            10,000,000 $DOG
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <a
              href="#build"
              className="inline-flex items-center justify-center px-5 py-3 min-h-[44px] font-mono text-[12px] font-bold text-void bg-lava hover:bg-lava-light transition-colors"
            >
              Fund the city
            </a>
            <a
              href="#the-ladder"
              className="inline-flex items-center justify-center px-5 py-3 min-h-[44px] font-mono text-[12px] font-bold text-snow border border-white/20 hover:border-white/[0.45] transition-colors"
            >
              See the ladder
            </a>
          </div>

          {/* Esta página é feita para ser mandada por link direto, então quem
              chega pode não ter visto nada do projeto. A doc pública é a prova
              (bloco, hash, método), e fica a um toque daqui. */}
          <a
            href="/dogcity/docs"
            className="mt-5 inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-lava hover:text-lava-light transition-colors"
          >
            Read the public documentation →
          </a>
        </div>

        {/* ── corpo: índice + seções ──────────────────────────────────────── */}
        <div className="max-w-6xl mx-auto px-6 md:px-10 grid grid-cols-1 lg:grid-cols-[190px_minmax(0,1fr)] gap-x-10">
          {/* índice: barra horizontal rolável no celular, coluna fixa a partir de lg */}
          <nav aria-label="Table of contents" className="lg:border-t lg:border-white/[0.06] lg:pt-8">
            <div className="font-mono text-[9px] tracking-[0.25em] text-dusty mb-3 hidden lg:block">CONTENTS</div>
            <div className="flex gap-2 overflow-x-auto pb-4 lg:hidden min-w-0 -mx-6 px-6">
              {TOC.map((t) => (
                <a
                  key={t.id}
                  href={`#${t.id}`}
                  className={`shrink-0 whitespace-nowrap border ${HAIR} font-mono text-[10px] tracking-[0.1em] text-mist hover:text-lava hover:border-white/[0.35] px-3 py-1.5`}
                >
                  {t.n}. {t.label}
                </a>
              ))}
            </div>
            <ul className="hidden lg:block space-y-2.5 lg:sticky lg:top-24">
              {TOC.map((t) => (
                <li key={t.id}>
                  <a href={`#${t.id}`} className="block text-[12px] text-mist hover:text-lava leading-snug">
                    <span className="text-dusty font-mono mr-1.5">{t.n}</span>
                    {t.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            {/* ═══════════════════════════ 1 ═══════════════════════════ */}
            <Section id="what-a-founder-is" n="1" title="What a Founder is">
              <P className="mt-0">
                A Founder is anyone who contributes to the construction fund before it reaches
                10,000,000 $DOG.
              </P>
              <BulletList
                items={[
                  {
                    lead: "There is no cap on the number of Founders.",
                    text: "It is a goal, not a sale.",
                  },
                  {
                    lead: "What closes is the time,",
                    text: "never the seat.",
                  },
                  {
                    lead: "Contributions are counted per wallet and they add up.",
                    text: "A wallet can reach a rung across several transactions.",
                  },
                  {
                    lead: "The Founder number is assigned by order of arrival,",
                    text: "meaning the wallet's first contribution. Contributing more later does not move the number.",
                  },
                ]}
              />
            </Section>

            {/* ═══════════════════════════ 2 ═══════════════════════════ */}
            <Section id="the-three-axes" n="2" title="The three axes">
              <P className="mt-0">Everything a Founder gets falls under one of three.</P>
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-px bg-white/10 border border-white/10 max-w-3xl">
                {AXES.map((a) => (
                  <div key={a.key} className="bg-void p-5">
                    <div className="font-display font-bold text-snow text-base md:text-lg">{a.key}</div>
                    <p className="text-[13px] text-mist leading-relaxed mt-2">{a.text}</p>
                  </div>
                ))}
              </div>
            </Section>

            {/* ═══════════════════════════ 3 ═══════════════════════════ */}
            <Section id="the-ladder" n="3" title="The ladder">
              <P className="mt-0">Every rung includes everything below it.</P>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {RUNGS.map((r, i) => (
                  <RungCard key={r.key} r={r} index={i} count={RUNGS.length} />
                ))}
              </div>

              <Sub>Why the custom building stops at Patron</Sub>
              <P>
                Every district has its own architecture, with its own house types and variables, and
                that is what keeps the city coherent. The custom building is the single exception to
                that rule, so it stops at the top.
              </P>
              <P>
                This is also why the Founder&apos;s distinction lives in the items and not in the
                building. With per district typology, personality has to live around the house:
                yard, vehicle, light, plaque. Same reason a well built neighbourhood standardises
                facades and frees the garden.
              </P>

              <Sub>The ladder escalates in kind, not only in count</Sub>
              <P>
                Every rung includes everything below it, and that was already true. What this adds:
                where a variant exists, the higher rung receives the exclusive version of the same
                item, not only new items.
              </P>

              {/* Grade de escalada. Em 400px cada célula carrega o próprio rótulo
                  de coluna e as quatro empilham; a partir de sm vira tabela de
                  quatro colunas com cabeçalho. Nenhuma rolagem horizontal em
                  nenhuma das duas formas. */}
              <div className={`mt-4 border ${HAIR} max-w-3xl`}>
                <div
                  className={`hidden sm:grid sm:grid-cols-[5.5rem_repeat(3,minmax(0,1fr))] gap-x-4 border-b ${HAIR} px-4 py-2 font-mono text-[9px] tracking-[0.18em] text-dusty`}
                >
                  <span />
                  <span>PERSONAL</span>
                  <span>COMMERCIAL</span>
                  <span>PATRON</span>
                </div>
                {ESCALATION.map((row) => (
                  <div
                    key={row.family}
                    className={`border-b ${HAIR_SOFT} last:border-b-0 px-4 py-3.5 sm:grid sm:grid-cols-[5.5rem_repeat(3,minmax(0,1fr))] sm:gap-x-4 sm:items-baseline`}
                  >
                    <div className="font-mono text-[10px] tracking-[0.18em] text-lava uppercase">{row.family}</div>
                    {row.cells.map(([col, val]) => (
                      <div key={col} className="mt-2.5 sm:mt-0 text-[12.5px] text-snow leading-relaxed">
                        <span className="sm:hidden block font-mono text-[9px] tracking-[0.18em] text-dusty">
                          {col}
                        </span>
                        {val}
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <Warning lead="EVERY EXCLUSIVE VARIANT IS SOULBOUND">
                If the black rover could be sold, exclusivity becomes merchandise and anyone buys a
                Patron&apos;s standing on the secondary market. The tradable catalogue stays
                tradable, because it is taste. What proves merit does not circulate.
              </Warning>

              <Sub>What the custom building covers, and what it does not</Sub>
              <P>
                The custom building is custom in <strong className="text-snow">form</strong>, never
                in <strong className="text-snow">mass</strong>.
              </P>
              <DataBlock>
                <Row label="CUSTOM" value="shape, facade, materials, crown, ornament, plan, roof" />
                <Row label="NOT CUSTOM" value="height, mass, floors" note="come from the live balance" />
                <Row label="" value="footprint" note="comes from the lot area set by the snapshot" />
              </DataBlock>
              <Warning lead="A PATRON GETS A UNIQUE BUILDING, NOT A BIGGER ONE">
                The envelope stays honest, the design inside it is exclusive. This is the same logic
                the pack already uses for why a Founder&apos;s distinction lives in the items: a
                well built neighbourhood standardises the facade and frees the garden. Here, the
                city standardises the envelope and frees the design.
              </Warning>
            </Section>

            {/* ═══════════════════════════ 4 ═══════════════════════════ */}
            <Section id="the-draw" n="4" title="The Founders' draw">
              <P className="mt-0">
                One draw, among every Founder at any rung, on an announced date that will not move.
              </P>

              <div className={`mt-6 border ${HAIR} max-w-3xl`}>
                {PRIZES.map((p) => (
                  <div
                    key={p.title}
                    className={`border-b ${HAIR_SOFT} last:border-b-0 px-4 py-3.5 sm:grid sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-x-4 sm:items-baseline`}
                  >
                    <div className="font-display font-bold text-snow text-[14px]">{p.title}</div>
                    <div className="text-[12.5px] text-mist leading-relaxed mt-1 sm:mt-0">{p.text}</div>
                  </div>
                ))}
              </div>

              {/* ⚠️ A DATA NÃO FOI DECIDIDA (FOUNDERS-PACK §9). Nenhuma data
                  aparece aqui até ser anunciada. O valor do sorteio não é o
                  prêmio, é o relógio, e um relógio errado é pior que nenhum. */}
              <Warning lead="THE DATE HAS NOT BEEN ANNOUNCED YET">
                The date of the draw will be announced. Once it is announced, it does not move.
              </Warning>

              <Warning lead="NO LOT IS EVER DRAWN">
                Where a wallet lives is decided by its Bitcoin history at block 966,670 and by
                nothing that is paid. No lot is a prize, and no lot is a Founder benefit, in any
                form.
              </Warning>
            </Section>

            {/* ═══════════════════════════ 5 ═══════════════════════════ */}
            <Section id="items" n="5" title="Items">
              <P className="mt-0">Two kinds, and the difference is the whole design.</P>
              <DataBlock>
                <Row label="Founder and achievement items" value="SOULBOUND" note="they prove something you did" />
                <Row label="Catalogue items, bought" value="TRANSFERABLE" note="they are taste, so they can trade" />
              </DataBlock>
              <P>
                Nobody buys the proof of having been first. Everybody buys decoration. This gives the
                city a real item market without turning merit into merchandise.
              </P>

              <Sub>Item families</Sub>
              <P>All of them live on the lot rather than on the house.</P>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-px bg-white/10 border border-white/10 max-w-3xl">
                {FAMILIES.map((f) => (
                  <div key={f.name} className="bg-void p-4 md:p-5">
                    <div className="font-mono text-[10px] tracking-[0.22em] text-lava uppercase">{f.name}</div>
                    <p className="text-[13px] text-mist leading-relaxed mt-1.5">{f.text}</p>
                  </div>
                ))}
              </div>
            </Section>

            {/* ═══════════════════════════ 6 ═══════════════════════════ */}
            <Section id="the-island" n="6" title="The Founders Club island">
              <P className="mt-0">
                An island in the city&apos;s bay, carrying the Founders Club: a mooring, a hall, and
                the view of the city from across the water. Every Founder has access, at any rung.
              </P>
              <Warning lead="IT IS A CLUB, NOT A CONDOMINIUM">
                Nobody owns land on that island, no lot is assigned there, and no Founder&apos;s lot
                moves because of it. The island is new ground, made by the project inside its own
                water, so it costs no wallet a single square metre.
              </Warning>
              <P>
                There is no Founders&apos; district and there will not be one. Where a wallet lives
                comes from block 966,670. What the island gives is a place to meet, not an address.
              </P>
            </Section>

            {/* ═══════════════════════════ 7 ═══════════════════════════ */}
            <Section id="what-it-is-not" n="7" title="What a Founder is not">
              <P className="mt-0">
                Not equity. Not an investment. Not a yield. DogCity launches no new token. No
                staking, no APY, no emissions, no parallel economy. Everything runs on $DOG, which
                already exists on Bitcoin L1 and is already distributed.
              </P>
              <P>Being a Founder does not move your lot, and it does not move anyone else&apos;s.</P>
              <Warning lead="A FOUNDER CHOOSES WHEN AND WHAT TO BUILD, NEVER WHERE">
                Placement orders every wallet by measured criteria at block 966,670. A city that
                cannot print land cannot print promises.
              </Warning>
            </Section>
          </div>
        </div>

        {/* ═══════════════════════════ 8 ═══════════════════════════════════
            O FUNDO AO VIVO E O CTA. As duas seções são as MESMAS da landing,
            importadas, não copiadas: elas leem `lb` de /api/donate/leaderboard,
            então nenhum valor de fundo e nenhuma contagem de Founder é escrita
            à mão nesta página. <ConstructionFund /> traz id="build", que é o
            alvo de todos os CTAs acima, e <FoundersRegister /> traz id="founders",
            a fila por ordem de chegada que a seção 1 descreve. */}
        <ConstructionFund lb={lb} />
        <FoundersRegister lb={lb} />
      </div>

      <style jsx global>{`
        /* a escalada dos degraus: uma porcentagem interpolada, duas camadas
           lendo ela. Prefixo fp- próprio para nunca colidir com o --lot de
           ../sections/tiers.tsx. */
        @property --fp-lot {
          syntax: "<percentage>";
          inherits: true;
          initial-value: 100%;
        }
        .fp-rung {
          --fp-lot: var(--fp-lot-rest, 100%);
          transition: --fp-lot 0.9s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .fp-lot {
          clip-path: inset(var(--fp-lot) 0 0 0);
        }
        .fp-lotline {
          transform: translateY(var(--fp-lot));
        }

        /* só ponteiro: um toque no celular não pode deixar o lote cheio para
           sempre */
        @media (hover: hover) and (pointer: fine) {
          .fp-rung:hover {
            --fp-lot: 0%;
          }
        }

        /* sob movimento reduzido o estado final é o de REPOUSO: a escalada
           entre os quatro degraus continua legível, ela só não anima */
        @media (prefers-reduced-motion: reduce) {
          .fp-rung {
            transition: none;
          }
          .fp-rung:hover {
            --fp-lot: var(--fp-lot-rest, 100%);
          }
        }
      `}</style>
    </Layout>
  )
}
