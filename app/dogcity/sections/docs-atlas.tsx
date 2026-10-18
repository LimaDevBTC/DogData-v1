"use client"

// ═══════════════════════════════════════════════════════════════════════════
// 05 · DOCS AND ATLAS (#docs), brief landing v3 §4.7. Posso conferir? As regras,
// o atlas inteiro, o bloco e o hash.
//
// ⚠️ O número de pranchas vem de ATLAS_PLATES.length (app/dogcity/atlas/
// atlas-data.ts), NUNCA digitado. Os valores da fita de prova vêm de
// SNAPSHOT_PROOF (dogcity-data.ts) e de ATLAS_LOTS.
// ═══════════════════════════════════════════════════════════════════════════

import { Reveal, SplitLine } from "../landing/reveal"
import { Btn, Frame, Plate, SectionHead, useCopy } from "../landing/ui"
import { ATLAS_LOTS, ATLAS_PDF_MB, ATLAS_PLATES } from "../atlas/atlas-data"
import { SNAPSHOT_PROOF } from "../dogcity-data"

const DOC_SECTIONS = [
  { label: "What DogCity is", id: "what-is-dogcity" },
  { label: "The snapshot", id: "the-snapshot" },
  { label: "How land follows the coins", id: "how-land-follows-the-coins" },
  { label: "How we tell a person from a service", id: "person-from-a-service" },
  { label: "The Financial District", id: "financial-district" },
  { label: "The Founders Program", id: "founders-program" },
  { label: "How the mint works", id: "the-mint" },
  { label: "What this is not, yet", id: "not-yet" },
]

/** o carimbo da versão da cidade (docs §7, impresso em toda escritura) */
export const CITY_STAMP = "dogcity-966670-v1"

function utcStamp(iso: string) {
  return iso.replace("T", " ").replace(/Z$/, " UTC")
}

export default function DocsAtlas() {
  const { copied, copy } = useCopy()
  const h = SNAPSHOT_PROOF.hash
  const proof = [
    { key: "block", label: "SNAPSHOT BLOCK", show: SNAPSHOT_PROOF.block.toLocaleString("en-US"), value: String(SNAPSHOT_PROOF.block) },
    { key: "time", label: "", show: utcStamp(SNAPSHOT_PROOF.timeUtc), value: SNAPSHOT_PROOF.timeUtc },
    { key: "hash", label: "HASH", show: `${h.slice(0, 4)}…${h.slice(-5)}`, value: h },
    { key: "lots", label: "", show: `${ATLAS_LOTS.toLocaleString("en-US")} LOTS`, value: String(ATLAS_LOTS) },
    { key: "stamp", label: "STAMP", show: CITY_STAMP, value: CITY_STAMP },
  ]

  return (
    <section id="docs" aria-labelledby="dc-docs-h2" className="relative bg-dc-void pt-24 dk:pt-40 pb-24 dk:pb-40 scroll-mt-14">
      <Frame>
        <SectionHead n="05" label="VERIFY EVERYTHING" />
        <h2 id="dc-docs-h2" className="dc-h2 mt-4 text-dc-snow"><SplitLine text="Read the rules. Check the map." /></h2>

        <div className="mt-12 grid gap-6 dkl:grid-cols-2">
          <Reveal y={16} blur={false} className="h-full">
            <Plate className="dc-plate-hover flex h-full flex-col px-5 py-6 dk:px-8 dk:py-8">
              <p className="dc-label text-dc-lava">THE DOCS</p>
              <p className="dc-body mt-4 text-dc-snow">How the city was drawn, how land follows the coins, and how the mint runs.</p>
              <ol className="mt-6 flex-1 border-t border-dc-snow/[0.12]">
                {DOC_SECTIONS.map((d, i) => (
                  <li key={d.id} className="border-b border-dc-snow/[0.08]">
                    <a href={`/dogcity/docs#${d.id}`} className="group flex items-baseline gap-4 py-2.5 font-mono text-[12px] dk:text-[13px] tracking-[0.04em] text-dc-snow/[0.88] hover:text-dc-hot transition-colors">
                      <span className="w-6 shrink-0 text-dc-dusty group-hover:text-dc-hot">{String(i + 1).padStart(2, "0")}</span>
                      {d.label}
                    </a>
                  </li>
                ))}
              </ol>
              <div className="mt-8"><Btn href="/dogcity/docs">Read the docs</Btn></div>
            </Plate>
          </Reveal>

          <Reveal y={16} blur={false} delay={0.08} className="h-full">
            <Plate className="dc-plate-hover flex h-full flex-col px-5 py-6 dk:px-8 dk:py-8">
              <p className="dc-label text-dc-lava">THE ATLAS</p>
              {/* um preto só: a moldura usa o mesmo #0A0A0A do fundo da capa */}
              <a href="/dogcity/atlas" className="mt-5 block border border-dc-snow/[0.12] bg-[#0A0A0A]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/city/atlas/00-cover_1200.webp" alt="The cover of the DogCity atlas" width={1200} height={1320} loading="lazy" decoding="async" className="block h-auto w-full max-h-[420px] object-contain" />
              </a>
              <p className="dc-body mt-5 flex-1 text-dc-snow">
                {ATLAS_PLATES.length} plates. Every street, every block and every lot of City v1.
              </p>
              <div className="mt-8 flex flex-col dk:flex-row gap-3">
                <Btn href="/dogcity/atlas">Open the atlas</Btn>
                <Btn href="/city/atlas/dogcity-atlas.pdf" variant="line" external download>{`Download the PDF · ${ATLAS_PDF_MB} MB`}</Btn>
              </div>
            </Plate>
          </Reveal>
        </div>

        {/* ── a fita de prova: uma linha que quebra no celular, cada valor copiável ── */}
        <div className="mt-10 border-y border-dc-snow/[0.12] py-4">
          {/* celular: lista de duas colunas; desktop: uma linha com separadores */}
          <ul className="grid grid-cols-2 gap-x-4 gap-y-3 dk:flex dk:flex-wrap dk:items-center dk:gap-x-3 dk:gap-y-2 font-mono text-[11px] dk:text-[12px] tracking-[0.1em] text-dc-mist">
            {proof.map((p, i) => (
              <li key={p.key} className="flex items-center gap-3">
                {i > 0 && <span aria-hidden className="hidden dk:inline text-dc-dusty">·</span>}
                <button
                  type="button"
                  onClick={() => copy(p.key, p.value)}
                  title={`Copy ${p.value}`}
                  className="flex flex-col items-start gap-0.5 text-left dk:flex-row dk:items-baseline dk:gap-2 hover:text-dc-snow transition-colors"
                >
                  {p.label && <span className="text-dc-dusty">{p.label}</span>}
                  {/* o valor fica no fluxo (invisível enquanto copia): nada pula de lugar */}
                  <span className="relative tabular-nums text-dc-snow">
                    <span className={copied === p.key ? "invisible" : ""}>{p.show}</span>
                    {copied === p.key && <span className="absolute left-0 top-0 text-dc-lava">COPIED</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <p className="sr-only" aria-live="polite">{copied ? "Copied" : ""}</p>
      </Frame>
    </section>
  )
}
