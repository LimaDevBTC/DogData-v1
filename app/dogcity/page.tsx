// ═══════════════════════════════════════════════════════════════════════════
// DogCity landing (/dogcity).
//
// 2026-10-18, LANDING v3 (landing-v3/brief.md). A era do funil passou: a cidade
// está pronta e jogável, o snapshot do bloco 966.670 está selado (70.714 lotes),
// e falta pouco para as escrituras (o mint abre quando o fundo de construção
// chega a 10.000.000 $DOG). A página inteira serve três perguntas: quanto falta,
// qual é o meu lote, onde e quando mintar. Seis batidas e um rodapé, montadas em
// ./landing/landing.tsx:
//
//   Hero (filme + contador) · Find your lot · The deeds · The city ·
//   The calendar · Docs and atlas · rodapé
//
// Este arquivo virou componente de SERVIDOR: só carrega os metadados da página
// (que o layout não pode dar só a ela) e a pré-carga do pôster do herói, o
// elemento LCP. O cabeçalho do DogData e a faixa da BitFlow SAÍRAM desta página
// (decisão do fundador, 18/10): a landing não usa mais o <Layout> do site; o
// cromo é o de ./landing/chrome.tsx. /dogcity/docs, /atlas, /founders e as
// demais seguem como estão.
//
// Regra da casa: nenhum arquivo de seção foi apagado. O que saiu fica abaixo,
// importado e comentado, com a data e o motivo.
// ═══════════════════════════════════════════════════════════════════════════

import type { Metadata } from "next"
import { headers } from "next/headers"
import { preload } from "react-dom"
import { OG_URL } from "@/lib/og"
import DogCityLanding from "./landing/landing"
import { POSTER } from "./landing/media"

// ─ SAÍRAM DA LANDING EM 18/10/2026 (landing v3, brief §12) ─────────────────
// import { WalletLookupHero, WalletLookupRepeat } from "./sections/wallet-lookup"
//   o motor (useLookup, os quatro ramos) foi para ./sections/find-your-lot.tsx,
//   com moldura nova sobre o mapa, tier e rua; sai o selo do Anel 2 e o "Lock
//   your Founder number" (era do funil). WalletLookupRepeat sai: a página é
//   curta e o botão vivo da navegação leva à busca.
// import Proof from "./sections/proof"
//   "Says who?" virou a fita de prova de ./sections/docs-atlas.tsx.
// import MapFull from "./sections/map-full"
//   o mapa largo antigo (citymap-2000-v9) vira o fundo da busca, na versão City v1.
// import OfferIntro from "./sections/offer-intro"            era do funil
// import ConstructionFund from "./sections/construction-fund"
//   o contador do herói substitui; o fluxo de contribuição segue em
//   /dogcity/founders. A fita LED (marquee) é linguagem rejeitada.
// import Tiers from "./sections/tiers"                         escada de licenças, era do funil
// import FoundersRegister from "./sections/founders-register" segue em /dogcity/founders
// import {
//   ObjectionAirdrop, ObjectionWhales, ObjectionToken, ObjectionWait, ObjectionMultipleWallets,
// } from "./sections/objections"                              os docs respondem
// import Mistakes from "./sections/mistakes"                   segue nos docs
// import Partners from "./sections/partners"
//   prédios dos parceiros (BitFlow HQ, Kray Tower, Needle) e os GLB deles saem
//   desta página por pedido do fundador.
// import FinalCta from "./sections/final-cta"                  a página é curta
// A pílula flutuante "Build DogCity" virou o botão vivo do contador, DENTRO da
// navegação (./landing/chrome.tsx). O <Layout currentPage="donate"> saiu.
//
// ─ JÁ ESTAVAM FORA ANTES (13/09 e antes), seguem fora ──────────────────────
// MempoolBand, HeroLive, HeroFunil, TwoPaths, Snapshot, PlazaLive, Galaxy,
// LunarTerrain, Masterplan, Needle, Park, ParkTour (ver git log deste arquivo).

const DESCRIPTION =
  "70,714 lots on real lunar terrain, decided by Bitcoin block 966,670. At 10,000,000 $DOG the mint clock starts and every lot becomes a deed on Bitcoin. Find yours."

// ⚠️ O OG NOVO (um quadro de T1, a Terra sobre o domo, com o wordmark) depende do
// filme, que ainda não chegou. Até lá vale o cartão atual (lib/og.ts). Ao trocar,
// ARQUIVO NOVO com nome novo: o X e o WhatsApp guardam a imagem pela URL.
export const metadata: Metadata = {
  title: "DogCity · Every lot becomes a deed on Bitcoin",
  description: DESCRIPTION,
  openGraph: {
    title: "DogCity · Every lot becomes a deed on Bitcoin",
    description: DESCRIPTION,
    type: "website",
    url: "https://www.dogdata.xyz/dogcity",
    siteName: "DogCity",
    images: [{ url: OG_URL, width: 1200, height: 630, alt: "DogCity, a city on the Moon drawn from Bitcoin block 966,670" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "DogCity · Every lot becomes a deed on Bitcoin",
    description: DESCRIPTION,
    images: [OG_URL],
  },
}

// O total do fundo JÁ NO HTML. No desktop o número grande do contador é o maior texto da
// tela (o Chrome não aceita o pôster de tela cheia como candidato a LCP: medido em 18/10,
// nem sem JS), então ele precisa pintar cedo. A página pede a própria rota (?slim=1,
// cache de 120 s na CDN), com teto de 800 ms: estourou ou falhou, o HTML sai sem número
// e o cliente busca como sempre. Nunca número de exemplo.
async function fundoInicial(): Promise<{ raised: number; goal: number } | null> {
  try {
    // ⚠️ só o `host`, nunca o x-forwarded-host (o cliente forja esse); na Vercel o host só
    // chega aqui se for um domínio do projeto
    const h = await headers()
    const host = h.get("host")
    if (!host || !/^[a-z0-9.-]+(:\d+)?$/i.test(host)) return null
    const proto = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ? "http" : "https"
    const r = await fetch(`${proto}://${host}/api/donate/leaderboard?slim=1`, {
      signal: AbortSignal.timeout(800),
      next: { revalidate: 60 },
    })
    if (!r.ok) return null
    const j = await r.json()
    if (typeof j?.total_received !== "number" || !Number.isFinite(j.total_received)) return null
    if (j.total_received < 0 || j.total_received > 1e9) return null
    return { raised: j.total_received, goal: typeof j.goal === "number" && j.goal > 0 ? j.goal : 10_000_000 }
  } catch {
    return null
  }
}

export default async function DogCityPage() {
  const fund = await fundoInicial()
  // o fundo do contador: o navegador busca o JSON (que sai do cache da CDN) em paralelo com o
  // JS, e o fetch de ./landing/use-countdown.ts reaproveita a resposta. No desktop o número
  // grande é o maior texto da tela: quanto antes ele chega, mais cedo fecha o LCP.
  preload("/api/donate/leaderboard?slim=1", { as: "fetch", crossOrigin: "anonymous" })
  return (
    <>
      {/* o pôster é o LCP: pré-carga por proporção (retrato pega o recorte em pé). <link>
          explícito porque o preload() do React descarta imagem com `media`; o React 19
          iça estas tags para o <head> */}
      <link rel="preload" as="image" type="image/avif" href={POSTER.mobile.avif} media="(max-aspect-ratio: 1/1)" fetchPriority="high" />
      <link rel="preload" as="image" type="image/avif" href={POSTER.desktop.avif} media="(min-aspect-ratio: 1/1)" fetchPriority="high" />
      {/* o wordmark do cartão de título é o LCP da PRIMEIRA visita (medido em 18/10:
          ele chegava 0,8 s depois da primeira pintura no 4G lento). Mesmo arquivo de
          WORDMARK_SRC em ./landing/ui.tsx (módulo de cliente: não dá para importar aqui) */}
      <link rel="preload" as="image" type="image/svg+xml" href="/landing/v3/brand/dogcity-negativa.svg" fetchPriority="high" />
      <DogCityLanding initialFund={fund} />
    </>
  )
}
