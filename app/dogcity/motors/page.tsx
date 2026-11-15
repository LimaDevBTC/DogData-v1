// ═══════════════════════════════════════════════════════════════════════════
// DOG MOTORS (/dogcity/motors; no domínio da cidade, dogcity.space/motors): a vitrine dos carros da concessionária da
// DOG CITY. Desde 15/11/2026 os carros custam DC POINTS, pontos do jogo (decisão do fundador,
// assets_carros/projeto/CARROS_DC_POINTS.md): a vitrine lê GET /api/dogcity/car-buy e a garagem GET /api/dogcity/cars.
// A venda em $DOG/BTC (car-quote) segue atrás de CAR_SALES_OPEN, desligada, e saiu da vitrine.
//
// Componente de SERVIDOR: os metadados, a pré-carga da imagem do herói (o LCP) e a VITRINE JÁ NO HTML. A página pede
// a própria rota (como a landing faz com o fundo), com teto de 800 ms: a primeira pintura já tem os preços em DC
// Points, sem piscar um estado e trocar por outro. Estourou ou falhou, o HTML sai em "loading" e o cliente busca.
// ═══════════════════════════════════════════════════════════════════════════

import type { Metadata } from "next"
import { headers } from "next/headers"
import MotorsPage from "./motors"
import { parseDcShowroom, type DcShowroomState } from "./quote"
import { HERO } from "./media"

const DESCRIPTION =
  "The dealership of DOG CITY, on the Orla Nobre. Sixteen cars in six classes, bought with DC Points earned by playing, registered to the wallet that buys them."
const OG = "https://www.dogdata.xyz/dogcity-motors/og-dog-motors-r2.jpg"

export const metadata: Metadata = {
  title: "DOG MOTORS · The dealership of DOG CITY",
  description: DESCRIPTION,
  alternates: { canonical: "https://dogcity.space/motors" },
  openGraph: {
    title: "DOG MOTORS · The dealership of DOG CITY",
    description: DESCRIPTION,
    type: "website",
    url: "https://dogcity.space/motors",
    siteName: "DogCity",
    images: [{ url: OG, width: 1200, height: 630, alt: "DOG MOTORS at night: the two pylons on the AN7, the glass gallery and the DOG TOWER" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "DOG MOTORS · The dealership of DOG CITY",
    description: DESCRIPTION,
    images: [OG],
  },
}

async function vitrineInicial(): Promise<DcShowroomState> {
  try {
    // ⚠️ só o `host`, nunca o x-forwarded-host (o cliente forja esse)
    const h = await headers()
    const host = h.get("host")
    if (!host || !/^[a-z0-9.-]+(:\d+)?$/i.test(host)) return { kind: "loading" }
    const proto = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ? "http" : "https"
    const r = await fetch(`${proto}://${host}/api/dogcity/car-buy`, { signal: AbortSignal.timeout(800), next: { revalidate: 30 } })
    const state = parseDcShowroom(r.status, await r.json().catch(() => null))
    // uma falha de leitura no servidor não vira "Prices unavailable" na primeira pintura: o cliente tenta de novo
    return state.kind === "unavailable" ? { kind: "loading" } : state
  } catch {
    return { kind: "loading" }
  }
}

export default async function DogMotorsPage() {
  const initial = await vitrineInicial()
  return (
    <>
      {/* o herói é o LCP: pré-carga por proporção, o mesmo corte do <source media> (retrato pega o 4:5) */}
      <link rel="preload" as="image" type="image/avif" imageSrcSet={HERO.mobile.avif} imageSizes="100vw" media="(max-aspect-ratio: 4/5)" fetchPriority="high" />
      <link rel="preload" as="image" type="image/avif" imageSrcSet={HERO.desktop.avif} imageSizes="100vw" media="not all and (max-aspect-ratio: 4/5)" fetchPriority="high" />
      <MotorsPage initial={initial} />
    </>
  )
}
