"use client"

// ═══════════════════════════════════════════════════════════════════════════
// DOBRA 3, O MAPA, LARGURA TOTAL (marketing/LANDING-V3-DESENHO.md).
//
// "O mapa é o PRODUTO, não ilustração." Em v2 esta chapa vivia espremida numa
// coluna de 44vw ao lado do countdown (ver ./city-map.tsx, que continua ali
// para quando snapshot.tsx voltar a ser montada). Aqui ela ocupa a largura
// inteira da página, porque a alegação central da seção ("isto é terreno
// lunar real, não paisagem procedural") só convence em tamanho grande.
//
// ⚠️ MESMO ARQUIVO DE IMAGEM de ./city-map.tsx (/landing/citymap-1600.webp,
// 1.600px, 365 KB) — não existe versão maior versionada; a resolução real
// mora atrás do link para o SVG, que é onde ela pesa.
// ═══════════════════════════════════════════════════════════════════════════

import Image from "next/image"
import Link from "next/link"
import { HAIR, HAIR_SOFT } from "../motion"
import { LUNAR_SITE } from "../dogcity-data"

export default function MapFull() {
  return (
    <section id="map" className={`relative border-t ${HAIR_SOFT} scroll-mt-16`}>
      <div className="max-w-6xl mx-auto px-6 md:px-10 py-14 md:py-16">
        <p className="font-mono text-[10px] md:text-[11px] tracking-[0.28em] text-lava text-center">
          NOT PROCEDURAL. REAL TERRAIN.
        </p>
        <h2 className="font-display font-bold text-snow mt-2.5 text-xl md:text-2xl text-center max-w-2xl mx-auto leading-snug">
          {LUNAR_SITE.name}, mapped from NASA elevation data.
        </h2>

        <a
          href="/city/dogcity-map.svg"
          target="_blank"
          rel="noopener"
          className={`group relative mt-7 block border ${HAIR} bg-white/[0.02] overflow-hidden`}
        >
          <Image
            src="/landing/citymap-1600.webp"
            alt="City plan of DogCity: concentric districts around Satoshi Plaza, the spit along the bay, and the AN7 ring expressway, drawn over the real elevation of Mare Tranquillitatis."
            width={1600}
            height={1600}
            sizes="100vw"
            className="w-full h-auto transition-transform duration-700 group-hover:scale-[1.015]"
          />
          <span
            className={`absolute bottom-0 right-0 border-l border-t ${HAIR} bg-void/85 backdrop-blur-sm
              font-mono text-[10px] tracking-[0.14em] text-lava group-hover:text-lava-light px-3 py-2`}
          >
            OPEN AT FULL RESOLUTION →
          </span>
        </a>

        <p className="text-[12px] md:text-[13px] text-dusty mt-4 leading-relaxed text-center max-w-2xl mx-auto">
          Real elevation data from {LUNAR_SITE.demSource}, at {LUNAR_SITE.siteRadiusM.toLocaleString("en-US")} m
          around the landing site, vertical relief exaggerated {LUNAR_SITE.verticalExaggeration} so the terrain
          reads at map scale. {LUNAR_SITE.creditLine}.
        </p>

        <p className="font-mono text-[12px] md:text-sm text-snow mt-6 text-center">
          The city already exists, and you can walk it.{" "}
          <Link href="/city" className="text-lava hover:text-lava-light underline underline-offset-2">
            Enter DogCity →
          </Link>
        </p>
      </div>
    </section>
  )
}
