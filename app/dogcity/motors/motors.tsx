"use client"

// ═══════════════════════════════════════════════════════════════════════════
// DOG MOTORS (/dogcity/motors), montada. A gramática é a da landing v3 (../landing): o VISOR (texto sobre imagem,
// sem caixa, legível por halo) e a PRANCHA (placa opaca #1B1915, fio de cabelo, cantos retos, marcas de registro).
// Nada de vidro, nada de faixa rolante, nada de 3D fingido. Quatro batidas e o rodapé:
//
//   Herói (a entrada pela AN7) · 01 The place (Gallery, DOG TOWER, DOG RING, a corrida da AN7) ·
//   02 The showroom (os 18 por classe, preço do GET car-quote, compra pelo modo "car" da janela de pagamento) ·
//   03 How buying works · rodapé com os créditos CC BY
//
// Página própria, sem o <Layout> do DogData (como a landing). A janela da carteira (WalletProvider) e a de pagamento
// (DonateProvider) vêm da raiz; a de compra do carro abre no portal [data-motors-portal], dentro desta árvore, para
// herdar a fonte condensada e os tokens.
// ═══════════════════════════════════════════════════════════════════════════

import "../landing/landing.css"
import "./motors.css"
import { useEffect, useRef, useState } from "react"
import { useWallet } from "@/contexts/WalletContext"
import { FaviconMark, MotionScope, TextLink, Wordmark } from "../landing/ui"
import { MotionSwitch } from "../landing/chrome"
import { CITY_URL, MINT_HOST, MINT_URL } from "../landing/mint-state"
import type { ShowroomState } from "./quote"
import Hero from "./hero"
import Place from "./place"
import Showroom from "./showroom"
import HowToBuy from "./how"
import { CAR_CREDITS, RENDER_CREDITS, SHOWROOM } from "./cars"

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

function WalletChip({ solid }: { solid: boolean }) {
  const { account, openModal, disconnect } = useWallet()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey) }
  }, [open])
  if (!account) {
    return (
      <button type="button" onClick={openModal} className="dc-btn dc-btn-fill dc-btn-sm max-lg:!h-9 max-lg:!px-3 max-lg:!text-[11px] max-lg:!tracking-[0.12em]">
        Connect
      </button>
    )
  }
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Wallet ${account.ordinalsAddress}`}
        className={`inline-flex h-9 lg:h-10 items-center gap-2 whitespace-nowrap border border-dc-snow/[0.24] px-3 font-mono text-[11px] tracking-[0.06em] text-dc-snow transition-colors hover:border-dc-snow/[0.5] ${solid ? "" : "bg-dc-void/[0.6]"}`}
      >
        <span aria-hidden className="h-[6px] w-[6px] shrink-0 bg-dc-lava" />
        {/* no celular só o fim do endereço: a barra não tem largura para os dois pedaços */}
        <span className="whitespace-nowrap sm:hidden">…{account.ordinalsAddress.slice(-4)}</span>
        <span className="hidden whitespace-nowrap sm:inline">{short(account.ordinalsAddress)}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-10 min-w-[200px] border border-dc-snow/[0.16] bg-dc-void px-4 py-3">
          <p className="dc-label text-dc-dusty">Connected</p>
          <p className="mt-1 break-all font-mono text-[11px] text-dc-snow">{account.ordinalsAddress}</p>
          <button type="button" onClick={() => { setOpen(false); disconnect() }} className="dc-label mt-3 text-dc-mist transition-colors hover:text-dc-hot">
            Disconnect
          </button>
        </div>
      )}
    </div>
  )
}

function Nav({ solid }: { solid: boolean }) {
  return (
    <nav
      aria-label="DOG MOTORS"
      className={`fixed inset-x-0 top-0 z-[60] h-14 lg:h-[72px] border-b transition-[background-color,border-color] duration-300 ${solid ? "bg-dc-void border-dc-snow/[0.12]" : "bg-transparent border-transparent"}`}
    >
      <div className="mx-auto flex h-full max-w-[calc(1360px+2*var(--dc-gutter))] items-center gap-3 lg:gap-5 px-[var(--dc-gutter)]">
        {/* a marca é sempre o SVG: wordmark no desktop, D· no celular */}
        <a href="/dogcity" aria-label="DogCity, back to the city" className="shrink-0">
          <span className="hidden lg:block"><Wordmark height={28} alt="" /></span>
          <span className="lg:hidden"><FaviconMark size={30} alt="" /></span>
        </a>
        <span aria-hidden className="h-5 w-px bg-dc-snow/[0.28]" />
        <a href="#top" className={`dc-label !text-[11px] whitespace-nowrap text-dc-snow ${solid ? "" : "dc-halo"}`}>DOG MOTORS</a>
        <div className="flex-1" />
        <a href="#place" className={`hidden md:inline-flex h-10 items-center dc-label !text-[11px] text-dc-snow transition-colors hover:text-dc-hot ${solid ? "" : "dc-halo"}`}>The place</a>
        <a href="#cars" className={`hidden md:inline-flex h-10 items-center dc-label !text-[11px] text-dc-snow transition-colors hover:text-dc-hot ${solid ? "" : "dc-halo"}`}>The cars</a>
        <a href="#buy" className={`hidden lg:inline-flex h-10 items-center dc-label !text-[11px] text-dc-snow transition-colors hover:text-dc-hot ${solid ? "" : "dc-halo"}`}>How to buy</a>
        <WalletChip solid={solid} />
        <a href={CITY_URL} className={`dc-btn dc-btn-line dc-btn-sm max-lg:!h-9 max-lg:!px-3 max-lg:!text-[11px] max-lg:!tracking-[0.12em] max-[359px]:hidden ${solid ? "" : "dc-halo"}`}>Play</a>
      </div>
    </nav>
  )
}

function Footer() {
  // os créditos CC BY: cada autor com o link do modelo (a licença pede autor, link e aviso da licença)
  const byAuthor = new Map<string, string[]>()
  for (const c of SHOWROOM) {
    const k = c.credit.author
    byAuthor.set(k, [...(byAuthor.get(k) ?? []), c.id])
  }
  return (
    <footer className="relative border-t border-dc-snow/[0.12] bg-dc-void pt-20 dk:pt-28 pb-[max(32px,env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-[calc(1360px+2*var(--dc-gutter))] px-[var(--dc-gutter)]">
        <div className="flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/landing/v3/brand/dogcity-negativa.svg" alt="DogCity" width={760} height={115} loading="lazy" className="w-[min(560px,80vw)] h-auto" />
          <p className="mt-6 dc-label text-dc-mist">DOG MOTORS · Orla Nobre · The Spit</p>
        </div>
        <div className="mt-16 grid grid-cols-2 gap-10 border-t border-dc-snow/[0.12] pt-10 dk:grid-cols-4">
          <FooterCol title="DOG MOTORS" links={[{ label: "The place", href: "#place" }, { label: "The cars", href: "#cars" }, { label: "How to buy", href: "#buy" }]} />
          <FooterCol title="City" links={[{ label: "DogCity", href: "/dogcity" }, { label: "Play DogCity", href: CITY_URL }, { label: "Atlas", href: "/dogcity/atlas" }]} />
          <FooterCol title="Mint" links={[{ label: "Docs", href: "/dogcity/docs" }, { label: MINT_HOST, href: MINT_URL }]} />
          <FooterCol title="DogData" links={[{ label: "dogdata.xyz", href: "/" }]} />
        </div>
        <div className="mt-12 border-t border-dc-snow/[0.12] pt-6">
          <p className="font-mono text-[10px] leading-[17px] text-dc-dusty">
            The cars, the pickup and the palms are 3D models by{" "}
            {[...byAuthor.entries()].map(([author, ids], i, all) => (
              <span key={author}>
                {i > 0 && (i === all.length - 1 && RENDER_CREDITS.length === 0 ? " and " : ", ")}
                <a href={CAR_CREDITS[ids[0]].url} target="_blank" rel="noopener noreferrer" className="underline decoration-dc-snow/20 underline-offset-2 hover:text-dc-mist">{author}</a>
              </span>
            ))}
            {RENDER_CREDITS.map((c, i) => (
              <span key={c.author}>
                {i === RENDER_CREDITS.length - 1 ? " and " : ", "}
                <a href={c.url} target="_blank" rel="noopener noreferrer" className="underline decoration-dc-snow/20 underline-offset-2 hover:text-dc-mist">{c.author}</a>
              </span>
            ))}
            {" "}on Sketchfab, licensed{" "}
            <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" className="underline decoration-dc-snow/20 underline-offset-2 hover:text-dc-mist">CC BY 4.0</a>
            , and changed for DOG CITY: rescaled, badges and lettering removed, DOG CITY plates. The figures on each card are in-game figures, not factory specifications.
          </p>
        </div>
        <div className="mt-8 flex flex-col-reverse gap-6 border-t border-dc-snow/[0.12] pt-6 dk:flex-row dk:items-center dk:justify-between">
          <p className="dc-label text-dc-dusty">Built by <TextLink href="/" className="text-dc-snow">DogData</TextLink></p>
          <MotionSwitch />
        </div>
      </div>
    </footer>
  )
}

function FooterCol({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <p className="dc-label text-dc-lava">{title}</p>
      <ul className="mt-4 space-y-3">
        {links.map((l) => (
          <li key={l.href}>
            <TextLink href={l.href} className="font-mono text-[13px] text-dc-snow/[0.9]">{l.label}</TextLink>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function MotorsPage({ initial }: { initial: ShowroomState }) {
  // a navegação fica sólida quando o herói sai de baixo dela
  const heroEnd = useRef<HTMLDivElement>(null)
  const [solid, setSolid] = useState(false)
  useEffect(() => {
    const el = heroEnd.current
    if (!el) return
    // sólida só quando o fim do herói já passou para CIMA da barra (abaixo da tela ainda é herói)
    const io = new IntersectionObserver(([e]) => setSolid(!e.isIntersecting && e.boundingClientRect.top < 80), { rootMargin: "-72px 0px 0px 0px" })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <MotionScope>
      {(reduced) => (
        <div data-dogcity-landing data-motors data-motion={reduced ? "off" : "on"} id="top" className="relative min-h-screen bg-dc-void text-dc-snow font-body">
          <a href="#cars" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[90] focus:bg-dc-lava focus:px-4 focus:py-2 focus:text-dc-void">
            Skip to the cars
          </a>
          <Nav solid={solid} />
          <main>
            <Hero />
            <div ref={heroEnd} aria-hidden className="h-px" />
            <Place />
            <Showroom initial={initial} />
            <HowToBuy />
          </main>
          <Footer />
          {/* a janela de compra do carro abre aqui dentro (fonte condensada e tokens desta árvore) */}
          <div data-motors-portal />
        </div>
      )}
    </MotionScope>
  )
}
