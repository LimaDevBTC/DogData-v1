"use client"

// A moldura DOG CITY das paginas secundarias do dogcity.space (docs, support, founders, referrals, ranking, atlas, profile).
// Antes elas usavam o <Layout> do DogData (menu do explorer, faixa da BitFlow, rodape do DOG DATA). Aqui: o mesmo
// cromo da landing (tokens, fontes, Footer), sem nada do explorer.
//
// ⚠️ <nav>, NUNCA <header>, e NAO fixo: globals.css tem `header { position: relative }` fora de @layer, e a barra da landing
// so fica fixa por ser <nav>. Nestas paginas o conteudo nasce logo abaixo, entao a barra fica no fluxo (sticky nao
// serve: `main { overflow-x: hidden }` do globals.css nao atrapalha, mas o fluxo simples basta).
import "./landing/landing.css"
import { useState, type ReactNode } from "react"
import { FaviconMark, Wordmark } from "./landing/ui"
import { Footer } from "./landing/chrome"
import { CITY_URL, MINT_URL } from "./landing/mint-state"

const LINKS = [
  { label: "Docs", href: "/docs" },
  { label: "Referrals", href: "/referrals" },
  { label: "Ranking", href: "/ranking" },
  { label: "Profile", href: "/profile" },
]

export function CityLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div data-dogcity-landing className="min-h-screen bg-dc-void text-dc-snow flex flex-col">
      <nav aria-label="DogCity" className="relative z-[60] h-14 lg:h-[72px] border-b border-dc-snow/[0.12] bg-dc-void">
        <div className="mx-auto flex h-full max-w-[calc(1360px+2*var(--dc-gutter))] items-center gap-4 px-[var(--dc-gutter)]">
          <a href="/" aria-label="DogCity, home" className="shrink-0">
            <span className="hidden lg:block"><Wordmark height={32} alt="" /></span>
            <span className="lg:hidden"><FaviconMark size={32} alt="" /></span>
          </a>
          <div className="flex-1" />
          <ul className="hidden lg:flex items-center gap-6">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="inline-flex h-10 items-center dc-label !text-[11px] text-dc-snow hover:text-dc-hot transition-colors">{l.label}</a>
              </li>
            ))}
          </ul>
          <a href={MINT_URL} className="dc-btn dc-btn-fill dc-btn-sm max-lg:!h-9 max-lg:!px-3 max-lg:!text-[11px] max-lg:!tracking-[0.12em]">Mint</a>
          <a href={CITY_URL} className="dc-btn dc-btn-line dc-btn-sm max-lg:!h-9 max-lg:!px-3 max-lg:!text-[11px] max-lg:!tracking-[0.12em]">Play</a>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="dc-city-menu"
            aria-label="Menu"
            className="lg:hidden inline-flex h-10 items-center px-1 dc-label !text-[11px] text-dc-snow"
          >
            {open ? "Close" : "Menu"}
          </button>
        </div>
        {open && (
          <ul id="dc-city-menu" className="lg:hidden absolute inset-x-0 top-full bg-dc-void border-b border-dc-snow/[0.12] px-[var(--dc-gutter)] py-3">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="flex h-12 items-center dc-label !text-[12px] text-dc-snow hover:text-dc-hot transition-colors">{l.label}</a>
              </li>
            ))}
          </ul>
        )}
      </nav>
      <main className="relative flex-1 pt-3 md:pt-4">{children}</main>
      <Footer base="/" />
    </div>
  )
}
