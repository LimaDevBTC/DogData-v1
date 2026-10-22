"use client"

// ═══════════════════════════════════════════════════════════════════════════
// A LANDING v3 DA DOGCITY (/dogcity), montada. Brief: landing-v3/brief.md.
//
// A sala de lançamento das escrituras: um relógio que anda em $DOG e depois em
// blocos, sobre um filme da cidade à noite, e cada rolagem aproxima o visitante
// do próprio lote. Seis batidas e um rodapé, nada mais:
//
//   Hero (filme + contador) · 01 Find your lot · Fund the city + os quatro degraus
//   (#fund, #tiers) · 02 Fully on Bitcoin · 03 The deeds · 04 The city ·
//   05 The calendar · 06 Docs and atlas · rodapé
//
// 19/10: o fundo de construção e os cartões Citizen, Personal, Commercial e Patron
// VOLTARAM, no modelo da landing anterior (../sections/construction-fund.tsx e
// ../sections/tiers.tsx, intactos). A v3 os tinha tirado e com eles o único caminho
// de contribuição da página (o fundo está perto da meta e é ele que dispara o mint).
// A janela da carteira (DonateProvider) mora na raiz (app/layout.tsx), então esta
// página, sem o <Layout>, já está dentro dela.
//
// Página própria: SEM o <Layout> do DogData (cabeçalho, faixa da BitFlow,
// rodapé do site). O cromo é o de ./chrome.tsx.
// ═══════════════════════════════════════════════════════════════════════════

import "./landing.css"
import { useCallback, useEffect, useState } from "react"
import { ResumePill } from "@/components/resume-pill"
import { MotionScope } from "./ui"
import { Footer, Nav } from "./chrome"
import { useCountdown, type FundData, type MinterRead } from "./use-countdown"
import type { MintBInfo } from "./mint-state"
import Opening, { type ChromeState } from "../sections/opening"
import Provenance from "../sections/provenance"
import Deeds from "../sections/deeds"
import TheCity from "../sections/the-city"
import Calendar from "../sections/calendar"
import DocsAtlas from "../sections/docs-atlas"
import ConstructionFund from "../sections/construction-fund"
import Tiers from "../sections/tiers"
import { useLeaderboard } from "./use-leaderboard"

const TITLE_KEY = "dc-title-card"

export default function DogCityLanding({ initialFund = null, initialMintB = null, initialMinter = null }: { initialFund?: FundData | null; initialMintB?: MintBInfo | null; initialMinter?: MinterRead | null }) {
  const cd = useCountdown(initialFund, initialMintB, initialMinter)
  const lb = useLeaderboard()

  // ── o cartão de título: só na primeira visita da sessão ──
  // Quem decide é o script pré-hidratação de ../layout.tsx (marca <html
  // data-dc-intro>), para o wordmark da navegação já nascer oculto e nada
  // piscar. Aqui só se lê a marca.
  // (o cartão em si é CSS ancorado na primeira pintura; ver ../sections/hero.tsx)
  const [intro, setIntro] = useState(false)
  useEffect(() => { setIntro(document.documentElement.hasAttribute("data-dc-intro")) }, [])
  const introDone = useCallback(() => {
    try { sessionStorage.setItem(TITLE_KEY, "1") } catch { /* modo privado */ }
  }, [])

  // a navegação: o palco da abertura diz quando a pílula viva entra (depois do voo do
  // trilho), quando a faixa fica sólida e quando a busca está na tela (sem CTA repetido)
  const [chrome, setChrome] = useState<ChromeState>({ live: false, solid: false, quiet: false })

  // a raiz do site manda a primeira visita da sessão para cá; esta chave fecha o laço
  useEffect(() => {
    try { sessionStorage.setItem("dogdata-session", "1") } catch { /* repete o desvio, inofensivo */ }
  }, [])

  // a página abre sempre no topo (o script de ../layout.tsx faz o mesmo antes da hidratação)
  useEffect(() => {
    const prev = history.scrollRestoration
    try { history.scrollRestoration = "manual" } catch { /* navegador que proíbe */ }
    const h = window.location.hash
    if (!h || h === "#snapshot" || h === "#build") window.scrollTo(0, 0)
    return () => { try { history.scrollRestoration = prev } catch { /* nada */ } }
  }, [])

  return (
    <MotionScope>
      {(reduced) => (
        <div data-dogcity-landing data-motion={reduced ? "off" : "on"} className="relative min-h-screen bg-dc-void text-dc-snow font-body">
          <a href="#lookup" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[90] focus:bg-dc-lava focus:px-4 focus:py-2 focus:text-dc-void">
            Skip to Find your lot
          </a>
          <Nav cd={cd} live={chrome.live} solid={chrome.solid} quiet={chrome.quiet} />
          <main>
            <Opening cd={cd} intro={intro} onIntroDone={introDone} onChrome={setChrome} />
            {/* o modelo da landing anterior, no mínimo para encaixar (cores: landing.css); 20/10, fundador: logo depois do
                hero, como segunda e terceira seções (o fundo é o que dispara o mint) */}
            <div data-dc-legacy>
              <ConstructionFund lb={lb} />
              <Tiers />
            </div>
            <Provenance />
            <Deeds />
            <TheCity />
            <Calendar cd={cd} />
            <DocsAtlas />
          </main>
          <Footer />
          <ResumePill />
        </div>
      )}
    </MotionScope>
  )
}
