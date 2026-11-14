"use client"

// ═══════════════════════════════════════════════════════════════════════════
// A FAIXA FINA "UNCLAIMED LOTS" (06/11/2026). Aparece so durante a Whitelist e some sozinha quando a altura passa do fim dela
// (o calendario vem do mint, nenhuma altura aqui). Leva ao verificador, que e' onde a pessoa ve o proprio lote.
//
// ⚠️ NUNCA position: fixed. globals.css:296 deixa o <header> relativo e a faixa rola com a pagina. Na landing ela fica
// ABSOLUTA logo abaixo da barra (que e' fixa e tem 56/72 px), sem empurrar o herói; no site (variante "site") e' um bloco
// normal no topo do conteudo.
// ═══════════════════════════════════════════════════════════════════════════
import { fmtInt } from "./mint-state"
import { bannerText } from "./unclaimed"
import { useMintClock } from "./use-mint-clock"

export function UnclaimedBanner({ variant }: { variant: "landing" | "site" }) {
  const { clock, claimed } = useMintClock()
  if (!clock || !clock.active) return null
  const pos = variant === "landing"
    ? "absolute inset-x-0 top-14 lg:top-[72px] z-[55]"
    : "relative mb-3"
  return (
    <div data-unclaimed-banner className={`${pos} bg-[#E8660D] text-[#08080A]`}>
      <a
        href="/dogcity#lookup"
        className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-center gap-x-3 gap-y-0.5 px-4 py-1.5 text-center font-mono text-[11px] md:text-[12px] font-bold tracking-[0.04em] hover:underline"
      >
        <span>
          {bannerText(clock)}
          {claimed != null && claimed > 0 && <span className="font-normal"> {fmtInt(claimed)} lots claimed so far.</span>}
        </span>
      </a>
    </div>
  )
}
