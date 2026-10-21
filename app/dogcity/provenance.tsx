// ═══════════════════════════════════════════════════════════════════════════
// PROVENIÊNCIA ON-CHAIN DA DOGCITY: dados e diagrama compartilhados entre
// /dogcity/docs (seção "Fully on Bitcoin") e a landing v3 (sections/provenance.tsx).
//
// ⚠️ UMA FONTE SÓ. Os ids, os tamanhos e a raiz Merkle abaixo são das inscrições
// de BASE em mainnet (conferidos em ordinals.com em 20/10/2026: bytes de
// /content/<id> batem com os tamanhos daqui). Se uma peça for reinscrita, muda
// AQUI e as duas páginas seguem. Os dois textos dizem a mesma coisa de propósito.
//
// Sem hook e sem diretiva: é só marcação, serve a Server e a Client Component.
// O diagrama é HTML (não imagem, não SVG com texto escalado): no celular a
// árvore continua legível em 390 px, e o texto é texto de verdade (leitor de
// tela, cópia, busca).
// ═══════════════════════════════════════════════════════════════════════════

import { ATLAS_LOTS } from "./atlas/atlas-data"

export const ORDINALS_URL = "https://ordinals.com/inscription/"
export const VERIFY_URL = "https://mint.dogcity.space/verify"
export const DID_SAT = "1548688143300961"
/** a raiz Merkle que a Charter carrega (abreviada como a escritura a imprime) */
export const MERKLE_ROOT = "d0f0d655…c26cdefb"
export const LOT_COUNT = ATLAS_LOTS
/** a escritura de ensaio em mainnet (pai descartável, não a Charter) */
export const REHEARSAL_DEED = "737b2771954c2b13560fa0ce1dfbc1e358c8a7f0c3d3ff6e0a69a753e0de83ebi0"
export const REHEARSAL_DEED_BYTES = 1569

export type Piece = {
  key: "r" | "charter" | "ground" | "template" | "sans" | "mono"
  name: string
  role: string
  /** bytes crus da inscrição */
  bytes: number
  /** bytes gravados na cadeia, quando a peça vai comprimida (brotli do ord) */
  onChain?: number
  id: string
}

export const PIECES: Piece[] = [
  {
    key: "r", name: "R", role: `The city's DID, anchored on sat ${DID_SAT}`, bytes: 3929,
    id: "ff598145973e62baa32b84389d3752f90d40c2dcc55933c612e6b10ddff25cd6i0",
  },
  {
    key: "charter", name: "City Charter", role: "The plan of the whole city. Child of R", bytes: 751442, onChain: 152167,
    id: "d7dc12d0df773e1cbf9605ae8b1e09f38f7cde5f9fb797651fb698aa7964e794i0",
  },
  {
    key: "ground", name: "Ground layer", role: "The surroundings of the plan. Child of the Charter", bytes: 651165, onChain: 129790,
    id: "6b0159f159ce09f19cdd2d81055db3340f891337d4992d55b5232e53f2bf980ci0",
  },
  {
    key: "template", name: "Deed template", role: "The code that draws every deed", bytes: 28135,
    id: "224599c77cc119d133732337b3782c3f652293d846883d688ad5913544bfc312i0",
  },
  {
    key: "sans", name: "Sans font", role: "Typeface of the deeds", bytes: 6364,
    id: "3f4ba3653e0df0128c9f5da825c59790364bad5e1c4413ce0050868ea8e2a5a2i0",
  },
  {
    key: "mono", name: "Mono font", role: "Monospace typeface of the deeds", bytes: 5036,
    id: "a5fa723e5eb994c790588928d65d81d98bebd9c1f7b9b403075c7bc06261f680i0",
  },
]

export const fmtBytes = (n: number) => `${n.toLocaleString("en-US")} B`
/** "ff598145…25cd6i0": legível numa célula estreita; o link leva o id inteiro */
export const shortId = (id: string) => `${id.slice(0, 8)}…${id.slice(-7)}`
export const inscriptionUrl = (id: string) => `${ORDINALS_URL}${id}`

// ── o diagrama ──────────────────────────────────────────────────────────────
// Duas relações, desenhadas de formas diferentes de propósito:
//   linha cheia   = pai e filho (a cadeia de proveniência: R > Charter > escritura)
//   caixa tracejada = dependência (o que a escritura pede por /content/<id> para se desenhar)
export type ProvenanceTone = "docs" | "landing"

const TONES = {
  docs: {
    line: "border-white/10",
    rail: "bg-white/[0.18]",
    plate: "bg-white/[0.02]",
    ink: "text-snow",
    mute: "text-mist",
    dim: "text-dusty",
    accent: "text-lava",
    accentLine: "border-lava/60",
    title: "font-display font-bold text-[15px] md:text-base",
  },
  landing: {
    line: "border-dc-snow/[0.12]",
    rail: "bg-dc-snow/[0.24]",
    plate: "bg-dc-plate",
    ink: "text-dc-snow",
    mute: "text-dc-mist",
    dim: "text-dc-dusty",
    accent: "text-dc-lava",
    accentLine: "border-dc-lava/60",
    title: "font-cond text-[24px] font-semibold uppercase leading-none",
  },
} as const

type Tone = (typeof TONES)[ProvenanceTone]

function Node({
  t, tag, title, children, strong = false,
}: {
  t: Tone
  tag: string
  title: string
  children?: React.ReactNode
  strong?: boolean
}) {
  return (
    <div className={`border ${strong ? t.accentLine : t.line} ${t.plate} px-4 py-3.5`}>
      <div className={`font-mono text-[10px] tracking-[0.2em] uppercase ${strong ? t.accent : t.dim}`}>{tag}</div>
      <div className={`mt-1.5 ${t.title} ${t.ink}`}>{title}</div>
      {children}
    </div>
  )
}

// cada filho da Charter: trilho vertical + dente horizontal, na altura do rótulo da caixa
function Branch({ t, last, children }: { t: Tone; last?: boolean; children: React.ReactNode }) {
  return (
    <li className="relative pl-7 pt-3">
      <span aria-hidden className={`absolute left-0 top-0 w-px ${t.rail} ${last ? "h-[36px]" : "h-full"}`} />
      <span aria-hidden className={`absolute left-0 top-[36px] h-px w-6 ${t.rail}`} />
      {children}
    </li>
  )
}

export function ProvenanceDiagram({ tone = "docs", className = "" }: { tone?: ProvenanceTone; className?: string }) {
  const t = TONES[tone]
  const small = `mt-1.5 text-[12px] md:text-[13px] leading-snug ${t.mute}`
  const chip = `border border-dashed ${t.line} px-2 py-1 font-mono text-[10px] tracking-[0.12em] uppercase ${t.mute}`
  return (
    <div className={className}>
      <Node t={t} tag="Root" title="R">
        <p className={small}>The city&apos;s DID, anchored on sat {DID_SAT}.</p>
      </Node>

      <div className="flex items-center gap-3 ml-5 h-9" aria-hidden>
        <span className={`h-full w-px ${t.rail}`} />
        <span className={`font-mono text-[10px] tracking-[0.2em] uppercase ${t.dim}`}>parent of</span>
      </div>

      <Node t={t} tag="City Charter" title="The plan of the whole city" strong>
        <p className={small}>
          Carries the Merkle root <span className="font-mono">{MERKLE_ROOT}</span>, which commits the geometry of all{" "}
          {LOT_COUNT.toLocaleString("en-US")} lots.
        </p>
      </Node>

      <ol className="ml-5">
        <Branch t={t}>
          <Node t={t} tag="Child of the Charter" title="Ground layer">
            <p className={small}>The surroundings of the plan.</p>
          </Node>
        </Branch>
        <Branch t={t}>
          <Node t={t} tag="Child of the Charter · inscribed at block 972,421" title="Mint calendar">
            <p className={small}>The phases of the mint, counted in blocks from B.</p>
          </Node>
        </Branch>
        <Branch t={t} last>
          <Node t={t} tag="Child of the Charter · one per lot" title="Lot deed" strong>
            <p className={small}>About 1.5 KB. Only the first valid deed of each lot counts.</p>
            <div className={`mt-3 border-t border-dashed ${t.line} pt-3`}>
              <p className={`font-mono text-[10px] tracking-[0.2em] uppercase ${t.dim}`}>
                Draws itself through <span className="normal-case tracking-normal">/content/&lt;id&gt;</span> from
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {["Deed template", "City Charter", "Ground layer", "Sans font", "Mono font"].map((c) => (
                  <li key={c} className={chip}>{c}</li>
                ))}
              </ul>
            </div>
          </Node>
        </Branch>
      </ol>
    </div>
  )
}
