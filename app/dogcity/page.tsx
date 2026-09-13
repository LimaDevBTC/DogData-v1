"use client"

// ═══════════════════════════════════════════════════════════════════════════
// DogCity landing — the folio of the lunar city.
//
// 2026-08-19 (praca-ajustes.md itens 6, 7 e 12): o herói de 500vh que rolava 180
// quadros do Blender SAIU. Aqueles quadros mostram a cidade antes da reforma da
// praça, e a cidade de verdade já abriu em /city — o fundador pediu para tirar.
//
// 2026-09-13, PRIMEIRA REESTRUTURAÇÃO EM FUNIL (revertida no mesmo dia). Um
// bloco de "oferta única" (hero-funil.tsx) seguido de fundo → escada → doc por
// objeção. O fundador viu e chamou de GENÉRICA: "Get your license to build in
// DogCity" podia estar em qualquer projeto de metaverso. O erro, dele mesmo,
// foi briefar uma ORDEM DE SEÇÕES em vez de um DESENHO.
//
// 2026-09-13, SEGUNDA REESTRUTURAÇÃO, A QUE FICOU (marketing/LANDING-V3-DESENHO.md).
// A ideia que organiza tudo: A CARTEIRA DO VISITANTE É A ÚNICA COISA QUE A CASA
// TEM QUE NÃO É PITCH. "Uma cidade na Lua" é promessa; "você já é dono de 931 m²,
// e quem decidiu isso foi o bloco 966.670" é um fato sobre ELE, verificável, que
// existia antes de ele chegar no site. A página deixa de abrir com qualquer
// headline de produto e abre com um CAMPO DE ENDEREÇO — sete dobras, cada uma
// com um propósito e um dado exato, nesta ordem:
//
//   1. wallet-lookup.tsx (hero)  o veredicto pessoal: cole um endereço, receba
//                                 um documento (lote, saldo, Genesis Badge) ou
//                                 os anéis de expansão, ou o aviso de corretora
//   2. proof.tsx                 "diz quem?" — bloco, hora, hash, totais
//   3. map-full.tsx               o mapa real, largura total, link pra /city
//   4. offer-intro + a oferta     "you own the land" — fundo, escada, monumento
//   5. objections.tsx (4 cartões) a dúvida, na ordem em que ela chega
//   6. mistakes.tsx                o que a casa errou, em público
//   7. Partners + wallet-lookup (repeat) + FinalCta
//
// Nenhum arquivo de seção foi apagado nesta reestruturação nem na anterior: o
// que sai do funil continua importado logo abaixo, comentado, com a data e o
// motivo, para poder voltar.
//
// This file is now a conductor, not a canvas. Each movement below the hero
// lives in ./sections/* so the page can be reasoned about one beat at a time;
// the shared motion vocabulary they all draw from is ./motion.tsx.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Layout } from "@/components/layout"

// ── as sete dobras, na ordem de marketing/LANDING-V3-DESENHO.md ────────────
import { WalletLookupHero, WalletLookupRepeat } from "./sections/wallet-lookup"
import Proof from "./sections/proof"
import MapFull from "./sections/map-full"
import OfferIntro from "./sections/offer-intro"
import ConstructionFund from "./sections/construction-fund"
import Tiers from "./sections/tiers"
import FoundersRegister from "./sections/founders-register"
import {
  ObjectionAirdrop, ObjectionWhales, ObjectionToken, ObjectionWait, ObjectionMultipleWallets,
} from "./sections/objections"
import Mistakes from "./sections/mistakes"
import Partners from "./sections/partners"
import FinalCta from "./sections/final-cta"

// ─ SAÍRAM DO FUNIL (comentadas, não apagadas — voltam a qualquer momento;
//   são o tour da cidade ou peças de uma reestruturação anterior, não esta) ──
// import MempoolBand from "./sections/mempool-band"
// import HeroLive from "./sections/hero-live" — as três portas (cidade, price
//   war, galáxia) são o "cheio de coisas" que o fundador pediu pra tirar
// import HeroFunil from "./sections/hero-funil" — a oferta única da PRIMEIRA
//   reestruturação de 13/09, substituída no mesmo dia pelo campo de endereço
//   de ./sections/wallet-lookup.tsx (dobra 1 do desenho v3)
// import TwoPaths from "./sections/two-paths" — "os dois caminhos" da primeira
//   reestruturação; o desenho v3 resolve a mesma ideia dentro do próprio
//   resultado da busca (branch not_in_snapshot) e na objeção "e se eu esperar?"
// import Snapshot from "./sections/snapshot" — o countdown pro bloco 966.670;
//   o bloco já foi minerado, então a seção inteira (que ainda fala em "blocks
//   until the snapshot") ficou no passado. ./sections/proof.tsx é a dobra 2
//   que ocupa este lugar agora, com o bloco já selado.
// import PlazaLive from "./sections/plaza-live"
// import Galaxy from "./sections/galaxy"
// import Ordinals from "./sections/ordinals"
// import LunarTerrain from "./sections/lunar-terrain"
// import Masterplan from "./sections/masterplan"
// import Needle from "./sections/needle"
// import Park from "./sections/park"
import { ResumePill } from "@/components/resume-pill"
import type { LeaderboardData } from "./types"

export default function LandingPage() {
  const [lb, setLb] = useState<LeaderboardData | null>(null)

  useEffect(() => {
    // ⚠️ r.ok E a forma são obrigatórios: no incidente de 26/08 a rota
    // devolveu 503 com corpo { error }, o objeto passava pelo guard de null
    // dos componentes e um .toLocaleString() de campo inexistente derrubava a
    // árvore inteira (tela preta de client-side exception em produção).
    // Sem dado a landing renderiza com os placeholders, nunca quebra.
    fetch("/api/donate/leaderboard", { signal: AbortSignal.timeout(10000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j && typeof j.total_received === "number") setLb(j)
      })
      .catch(() => {})
  }, [])

  // Close the loop on the root's once-per-session redirect (app/page.tsx).
  // The root bounces a new session here and then checks this key to decide
  // whether to bounce again. /donate used to set it; now that the root points
  // at this page instead, this page has to, or the overview dashboard at "/"
  // becomes permanently unreachable — every visit would bounce back here.
  useEffect(() => {
    try {
      sessionStorage.setItem("dogdata-session", "1")
    } catch {
      // private-mode / storage-disabled: the redirect simply repeats, which is
      // the old behaviour and is harmless
    }
  }, [])

  // ── this page must always open at the top ────────────────────────────────
  // The document is several screens tall, and the browser's default
  // `history.scrollRestoration = "auto"` will happily drop a returning visitor
  // — on reload, on back, or when a phone restores a backgrounded tab — several
  // thousand pixels in, past the hero entirely. Landing anywhere but the top is
  // always wrong here, so restoration is taken over for this page and handed
  // back on unmount.
  //
  // An explicit #anchor is honoured: arriving at /dogcity#build is a deliberate
  // request for that section, not a restored position.
  useEffect(() => {
    const prev = typeof history !== "undefined" ? history.scrollRestoration : undefined
    try {
      if (prev !== undefined) history.scrollRestoration = "manual"
    } catch {
      // some browsers disallow it; the reset below still runs
    }
    // ⚠️ #snapshot E #lookup CONTAM COMO TOPO. O anúncio de 04/09 publicou
    // /dogcity#snapshot; a dobra 1 do desenho v3 (13/09) é agora o campo de
    // endereço em id="lookup". As duas têm que concordar com o script pré
    // hidratação de ./layout.tsx.
    const h = window.location.hash
    if (!h || h === "#snapshot" || h === "#lookup") window.scrollTo(0, 0)
    return () => {
      try {
        if (prev !== undefined) history.scrollRestoration = prev
      } catch {
        /* nothing to restore to */
      }
    }
  }, [])

  // ── the persistent Build CTA ─────────────────────────────────────────────
  // An IntersectionObserver on a sentinel placed after the hero decides when the
  // CTA is allowed, and it portals to <body> above every layer but the grain.
  const afterHero = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  const [showCta, setShowCta] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    const el = afterHero.current
    if (!el) return
    // Num flick rápido (ou scroll suave) a entrada E a saída do sentinela
    // chegam em LOTE num único callback; desestruturar [e] lia a entrada mais
    // antiga e descartava o estado final, deixando o CTA apagado. O último
    // registro do lote é sempre o estado mais novo.
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[entries.length - 1]
        setShowCta(!e.isIntersecting && e.boundingClientRect.top < 0)
      },
      { threshold: 0 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Phones get a full-width bottom bar, not a floating pill. As a pill it sat
  // on top of section content — on a real phone it covered the Stacks donation
  // address outright, which is a usability bug, not a cosmetic one. A bar owns
  // its own strip of screen instead of hovering over someone else's, is a much
  // bigger tap target, and the page reserves matching bottom padding below so
  // nothing is ever permanently hidden behind it. From md up the original
  // floating pill is unchanged.
  // ⚠️ PÍLULA, não barra colada no fundo: a barra full-bleed em bottom-0
  // fazia o Safari do iPhone TINGIR a própria barra de navegação de laranja
  // (o navegador herda a cor da página no rodapé) e o CTA parecia um paredão
  // (fundador fotografou em 26/08). A pílula flutua RECUADA da borda, então o
  // rodapé da página volta a ser escuro e o Safari fica escuro junto.
  //
  // ⚠️ SIMPLIFICADA EM 13/09: até então esta pílula trocava de texto e de
  // âncora enquanto a janela do bloco 966.670 estivesse aberta ("N blocks to
  // snapshot" → "#snapshot"). O bloco já foi minerado (data/snapshots/
  // dog_snapshot_966670.json, 2026-09-12): a condição nunca mais fica
  // verdadeira, e manter o ramo morto apontando pra uma âncora que só existia
  // na hero antiga era pior que remover. A pílula agora é uma coisa só.
  const cta = (
    <a
      href="#build"
      aria-hidden={!showCta}
      tabIndex={showCta ? 0 : -1}
      className={`fixed z-[100] font-mono font-bold text-void bg-lava hover:bg-lava-light transition-all duration-500
        inset-x-4 bottom-3 flex items-center justify-center h-11 px-5 text-[13px] rounded
        shadow-[0_4px_24px_rgba(0,0,0,0.6)]
        md:inset-x-auto md:bottom-5 md:right-5 md:h-auto md:inline-flex md:gap-2 md:py-3
        md:text-[12px] md:rounded-none md:shadow-[0_0_30px_rgba(245,110,15,0.35)] ${
        showCta ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"
      }`}
    >
      Build DogCity
    </a>
  )

  return (
    <Layout currentPage="donate" setCurrentPage={() => {}}>
      {/* pb-14 reserves the 56px the mobile CTA bar occupies, so the end of the
          page can never sit underneath it */}
      <div data-dogcity-landing className="bg-void text-snow pb-14 md:pb-0">
        {/* ═══ DOBRA 1 · O VEREDICTO PESSOAL ═════════════════════════════════
            Sem headline de produto: um campo de endereço. Ver
            ./sections/wallet-lookup.tsx para as três respostas possíveis e por
            que nenhuma delas mostra posição, bairro ou tag institucional. */}
        <WalletLookupHero />

        {/* sentinel: everything past this point is allowed to show page chrome */}
        <div ref={afterHero} aria-hidden className="h-px w-full" />

        {/* ═══ DOBRA 2 · "SAYS WHO?" ══════════════════════════════════════════
            A prova, antes que alguém pergunte: bloco, hora, hash, totais.
            Todo número em ./sections/proof.tsx vem de SNAPSHOT_PROOF, copiado
            do próprio arquivo do snapshot. */}
        <Proof />

        {/* ═══ DOBRA 3 · O MAPA, LARGURA TOTAL ════════════════════════════════
            O mapa é o produto, não ilustração — ver ./sections/map-full.tsx. */}
        <MapFull />

        {/* ═══ DOBRA 4 · A OFERTA ════════════════════════════════════════════
            "You own the land." só faz sentido AQUI, depois de três dobras que
            provam a frase. O corpo é o mesmo desde a v2: <ConstructionFund />,
            <Tiers /> (primeiro degrau agora chamado Citizen, não Founder — ver
            dogcity-data.ts) e <FoundersRegister />. */}
        <OfferIntro />
        <ConstructionFund lb={lb} />
        <Tiers />
        <FoundersRegister lb={lb} />

        {/* ═══ DOBRA 5 · AS OBJEÇÕES, NA ORDEM EM QUE A DÚVIDA CHEGA ══════════
            Cada cartão é curto: a afirmação, o número que prova, um link para
            /dogcity/docs. Ver ./sections/objections.tsx. A quinta ("várias
            carteiras") entrou em 13/09 a pedido do fundador (masterplan.md
            §14.1) e usa a mesma gramática das quatro do desenho original. */}
        <ObjectionAirdrop />
        <ObjectionWhales />
        <ObjectionToken />
        <ObjectionWait />
        <ObjectionMultipleWallets />

        {/* ═══ DOBRA 6 · O QUE A GENTE ERROU ══════════════════════════════════
            A dobra que ninguém copia: publicar o que deu certo é fácil.
            Ver ./sections/mistakes.tsx. */}
        <Mistakes />

        {/* ═══ DOBRA 7 · O FECHO ══════════════════════════════════════════════
            Partners, depois o campo de endereço se repete para quem chegou
            até aqui sem digitar nada, e só então o CTA final. */}
        <Partners />
        <WalletLookupRepeat />
        <FinalCta />

        {/* ─ SAÍRAM DA LANDING (comentadas, não apagadas) ────────────────────
            São o tour da cidade, não o funil: o fundador gosta delas, elas só
            não pertencem a nenhuma das sete dobras agora. Reimportar de
            ./sections/* para trazer qualquer uma de volta. */}
        {/* <MempoolBand /> — a faixa viva do topo competia com o campo de
            endereço pela primeira dobra. */}
        {/* <PlazaLive /> — "a praça já está aberta" é convite de tour, não
            resposta sobre a carteira de quem chegou. */}
        {/* <Galaxy /> — censo de carteiras; pertence ao tour, não às sete
            dobras. */}
        {/* <Ordinals /> — vitrine de inscrições da coleção. */}
        {/* <LunarTerrain /> — a explicação do terreno lunar é tour; a dobra 3
            (./sections/map-full.tsx) já cobre a autenticidade do dado da NASA
            na medida que o desenho pede. */}
        {/* <Masterplan /> — visão geral do masterplan; o que ela cobria de
            processo agora está distribuído pelas dobras 1, 2 e 4. */}
        {/* <Needle /> — a única construção que o projeto possui; tour. */}
        {/* <Park /> e <ParkTour /> — o parque já tinha saído em 30/08 (os 150
            quadros foram assados numa posição do parque que não existe mais,
            ver sections/park-tour.tsx). */}
        {/* <PlotDeed /> já estava fora desde 04/09: mostra o lote de uma
            carteira antes do snapshot decidir, o que era posição publicada
            antes de ser decidida (ver sections/plot-deed.tsx). O bloco já foi
            minerado, mas o arquivo lê `data/snapshots/` com `fs`, que não
            existe no build da Vercel — por isso a dobra 1 usa a rota nova
            (/api/dogcity/lookup), não este componente. */}
      </div>
      {mounted && createPortal(cta, document.body)}
      <ResumePill />
    </Layout>
  )
}
