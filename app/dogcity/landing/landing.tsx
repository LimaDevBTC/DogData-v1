"use client"

// ═══════════════════════════════════════════════════════════════════════════
// A LANDING v3 DA DOGCITY (/dogcity), montada. Brief: landing-v3/brief.md.
//
// A sala de lançamento das escrituras: um relógio que anda em $DOG e depois em
// blocos, sobre um filme da cidade à noite, e cada rolagem aproxima o visitante
// do próprio lote. Seis batidas e um rodapé, nada mais:
//
//   Hero (filme + contador) · 01 Find your lot · 02 The deeds · 03 The city ·
//   04 The calendar · 05 Docs and atlas · rodapé
//
// Página própria: SEM o <Layout> do DogData (cabeçalho, faixa da BitFlow,
// rodapé do site). O cromo é o de ./chrome.tsx.
// ═══════════════════════════════════════════════════════════════════════════

import "./landing.css"
import { useCallback, useEffect, useRef, useState } from "react"
import { ResumePill } from "@/components/resume-pill"
import { MotionScope } from "./ui"
import { Footer, Nav } from "./chrome"
import { useCountdown, type FundData } from "./use-countdown"
import Hero from "../sections/hero"
import FindYourLot from "../sections/find-your-lot"
import Deeds from "../sections/deeds"
import TheCity from "../sections/the-city"
import Calendar from "../sections/calendar"
import DocsAtlas from "../sections/docs-atlas"

const TITLE_KEY = "dc-title-card"

export default function DogCityLanding({ initialFund = null }: { initialFund?: FundData | null }) {
  const cd = useCountdown(initialFund)

  // ── o cartão de título: só na primeira visita da sessão ──
  // Quem decide é o script pré-hidratação de ../layout.tsx (marca <html
  // data-dc-intro>), para o wordmark da navegação já nascer oculto e nada
  // piscar. Aqui só se lê a marca.
  const [intro, setIntro] = useState(false)
  const [markHidden, setMarkHidden] = useState(false)
  useEffect(() => {
    const on = document.documentElement.hasAttribute("data-dc-intro")
    setIntro(on)
    setMarkHidden(on)
  }, [])
  const introDone = useCallback(() => {
    setMarkHidden(false)
    document.documentElement.removeAttribute("data-dc-intro")
    try { sessionStorage.setItem(TITLE_KEY, "1") } catch { /* modo privado */ }
  }, [])

  // a navegação vira faixa sólida depois do herói
  const after = useRef<HTMLDivElement>(null)
  const [solid, setSolid] = useState(false)
  useEffect(() => {
    const el = after.current
    if (!el) return
    const io = new IntersectionObserver((es) => {
      const e = es[es.length - 1]
      setSolid(!e.isIntersecting && e.boundingClientRect.top < 80)
    }, { threshold: 0, rootMargin: "-72px 0px 0px 0px" })
    io.observe(el)
    return () => io.disconnect()
  }, [])

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
          <Nav cd={cd} solid={solid} hideMark={markHidden} />
          <main>
            <Hero cd={cd} intro={intro} onIntroDone={introDone} />
            <div ref={after} aria-hidden className="h-px" />
            <FindYourLot cd={cd} />
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
