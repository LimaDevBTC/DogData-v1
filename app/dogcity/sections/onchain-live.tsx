"use client"

// ═══════════════════════════════════════════════════════════════════════════
// "ON CHAIN, LIVE" (16/11/2026, pedido do fundador: "isso vai nos dar autoridade"). Dentro da seção 02 (proveniência): o
// que a cadeia mostra de verdade, não só o diagrama.
//
//   - a City Charter: a arte INSCRITA (renderizada do conteúdo da inscrição 127,689,895, não a prancha "specimen" do atlas),
//     com o link da inscrição;
//   - o contador de escrituras inscritas (a rota do mint, lida no servidor; sem ela, o do minter);
//   - as últimas escrituras desenhadas pelos MESMOS bytes inscritos (a prévia do mint, que libera o enquadramento só para a
//     landing e o DogData; sandbox, origem opaca), cada uma com o link da inscrição. No celular, só 2 (memória);
//   - "See every deed on Bitcoin": as filhas da Charter no ordinals.com, em ordem, as novas entram sozinhas.
// Sem a rota do mint (fora, ou antes do merge dela), o bloco mostra a Charter, o contador do minter e o link, sem a faixa.
// ═══════════════════════════════════════════════════════════════════════════

import { Btn, Plate } from "../landing/ui"
import { CHARTER_CHILDREN_URL, CHARTER_ID, CHARTER_NUMBER, deedPreviewUrl, inscriptionUrl, type RecentDeed } from "./onchain-live-data"

const fmt = (n: number) => n.toLocaleString("en-US")

export default function OnChainLive({ deeds, inscribed }: { deeds: RecentDeed[]; inscribed: number | null }) {
  return (
    <div className="mt-16 dk:mt-20" data-onchain-live>
      <p className="dc-label text-dc-lava">ON CHAIN, LIVE</p>

      <div className="mt-6 grid gap-6 dkl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] dkl:items-center">
        <Plate className="px-3 py-3 dk:px-4 dk:py-4">
          <a href={inscriptionUrl(CHARTER_ID)} target="_blank" rel="noopener noreferrer" aria-label={`The City Charter, inscription ${fmt(CHARTER_NUMBER)}, on ordinals.com`}>
            <picture>
              <source media="(min-width: 900px)" srcSet="/landing/v3/charter/charter-127689895-1600.webp" type="image/webp" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/landing/v3/charter/charter-127689895-900.webp"
                alt="The City Charter: the whole city on one sheet, as inscribed on Bitcoin"
                width={1600}
                height={1131}
                loading="lazy"
                decoding="async"
                className="block h-auto w-full"
              />
            </picture>
          </a>
          <p className="mt-3 font-mono text-[10px] dk:text-[11px] tracking-[0.16em] text-dc-mist">
            THE CITY CHARTER · INSCRIPTION {fmt(CHARTER_NUMBER)} · PARENT OF EVERY DEED
          </p>
        </Plate>

        <div>
          {inscribed !== null && (
            <>
              <p className="font-cond text-[64px] dk:text-[88px] font-semibold leading-none text-dc-snow tabular-nums">{fmt(inscribed)}</p>
              <p className="mt-3 font-mono text-[11px] dk:text-[12px] tracking-[0.2em] text-dc-mist">DEEDS INSCRIBED ON BITCOIN</p>
            </>
          )}
          <p className="dc-body mt-6 text-dc-snow">
            Every deed is a child of the City Charter. Open the Charter&apos;s children on ordinals.com and every deed of the city
            is there, in the order it was inscribed, with new ones arriving as they are minted.
          </p>
          <div className="mt-6">
            <Btn href={CHARTER_CHILDREN_URL} external>See every deed on Bitcoin</Btn>
          </div>
        </div>
      </div>

      {deeds.length > 0 && (
        <div className="mt-10">
          <p className="dc-label text-dc-mist">LATEST DEEDS</p>
          <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 dkl:grid-cols-3">
            {deeds.map((d, i) => (
              <li key={d.inscriptionId} className={i >= 2 ? "hidden dk:block" : ""}>
                <Plate ticks={false} className="overflow-hidden">
                  <div className="relative w-full" style={{ aspectRatio: "1.414 / 1" }}>
                    <iframe
                      src={deedPreviewUrl(d.lotId)}
                      title={`Deed of lot ${d.lotId}`}
                      sandbox="allow-scripts"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="absolute inset-0 h-full w-full border-0"
                    />
                  </div>
                  <div className="flex items-baseline justify-between gap-3 px-3 py-2.5">
                    <span className="font-mono text-[11px] tracking-[0.06em] text-dc-snow">{d.lotId}</span>
                    <a href={inscriptionUrl(d.inscriptionId)} target="_blank" rel="noopener noreferrer" className="font-mono text-[10px] tracking-[0.14em] text-dc-lava hover:text-dc-hot">
                      {d.number !== null ? `#${fmt(d.number)}` : "INSCRIPTION"} ↗
                    </a>
                  </div>
                </Plate>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
