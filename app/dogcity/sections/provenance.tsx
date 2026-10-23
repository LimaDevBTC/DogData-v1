"use client"

// ═══════════════════════════════════════════════════════════════════════════
// 02 · FULLY ON BITCOIN (#provenance). A proveniência on-chain da escritura:
// o diagrama R > Charter > escritura (com as dependências por /content/<id>) e
// quatro números. Entra depois do fundo e dos degraus (Founders Program) e antes
// de "The deeds", que passa a ser 03.
//
// ⚠️ Os ids, tamanhos e o diagrama vêm de ../provenance.tsx, o MESMO módulo da seção
// "Fully on Bitcoin" de /dogcity/docs. "1.5 KB" e "0 servers" são o texto da escritura
// (cerca de 1,5 KB, tudo vem da cadeia); "6" é PIECES.length e os lotes são ATLAS_LOTS,
// nunca digitados aqui. As seis peças estão em mainnet; NENHUMA escritura de lote foi
// inscrita ainda, e a seção diz isso em vez de insinuar o contrário.
// ═══════════════════════════════════════════════════════════════════════════

import { Reveal, SplitLine } from "../landing/reveal"
import { Btn, Frame, Plate, SectionHead, TextLink } from "../landing/ui"
import { LOT_COUNT, PIECES, ProvenanceDiagram, VERIFY_URL } from "../provenance"

const STATS = [
  { n: "1.5 KB", label: "PER DEED" },
  { n: LOT_COUNT.toLocaleString("en-US"), label: "LOTS" },
  { n: String(PIECES.length), label: "PIECES ON CHAIN" },
  { n: "0", label: "SERVERS" },
]

export default function Provenance() {
  return (
    <section id="provenance" aria-labelledby="dc-prov-h2" className="relative bg-dc-void pt-24 dk:pt-40 scroll-mt-14">
      <Frame>
        <SectionHead n="02" label="FULLY ON BITCOIN" />
        <h2 id="dc-prov-h2" className="dc-h2 mt-4 text-dc-snow"><SplitLine text="Nothing lives off the chain." /></h2>
        <p className="dc-lede mt-6">
          A deed is about 1.5 KB. It draws itself from the city&apos;s own inscriptions on Bitcoin: no server, no IPFS,
          no hosted image.
        </p>

        <div className="mt-12 grid gap-6 dkl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <Reveal y={16} blur={false} className="h-full">
            <Plate className="h-full px-5 py-6 dk:px-8 dk:py-8">
              <p className="dc-label text-dc-lava">PROVENANCE</p>
              <ProvenanceDiagram tone="landing" className="mt-5" />
            </Plate>
          </Reveal>

          <Reveal y={16} blur={false} delay={0.08}>
            <div>
              <ul className="grid grid-cols-2 gap-4">
                {STATS.map((s) => (
                  <Plate as="li" key={s.label} className="px-5 py-5 dk:px-6 dk:py-6">
                    <p className="font-cond text-[44px] dk:text-[60px] font-semibold leading-none text-dc-lava tabular-nums">{s.n}</p>
                    <p className="mt-3 font-mono text-[10px] dk:text-[11px] tracking-[0.18em] text-dc-mist">{s.label}</p>
                  </Plate>
                ))}
              </ul>
              <p className="dc-body mt-8 text-dc-snow">
                Anyone can rebuild a deed byte for byte from these pieces and check its lot against the Merkle root
                the City Charter carries. The six pieces are inscribed on mainnet, and every deed of the mint is a child of the City Charter.
              </p>
              <div className="mt-8 flex flex-col gap-4 dk:flex-row dk:items-center">
                <Btn href="/dogcity/docs#fully-on-bitcoin">Read the provenance</Btn>
                <TextLink href={VERIFY_URL} external className="font-mono text-[11px] tracking-[0.16em] uppercase text-dc-snow">
                  Open the verifier
                </TextLink>
              </div>
            </div>
          </Reveal>
        </div>
      </Frame>
    </section>
  )
}
