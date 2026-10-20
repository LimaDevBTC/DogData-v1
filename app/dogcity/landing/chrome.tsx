"use client"

// ═══════════════════════════════════════════════════════════════════════════
// O CROMO DA DOGCITY (brief §4.0). A landing não usa o <Layout> do DogData: sem
// o cabeçalho, sem a faixa da BitFlow, sem o rodapé do site. Navegação mínima,
// como a Rockstar faz no VI. A volta para o DogData tem porta visível (fundador, 18/10:
// "o usuário acessa o DogData pela landing e não tem mais como entrar"): link na barra do
// desktop, ao lado do Menu, e item numerado na gaveta; o rodapé segue com o dele.
//
// ⚠️ <nav>, NUNCA <header>: globals.css tem `header { position: relative }`
// fora de @layer, e um <header> fixo aqui nunca ficaria fixo (o mesmo defeito
// do cabeçalho do site, project_header_never_fixed).
//
// A ação viva (o contador compacto) entra na navegação DEPOIS do herói e não
// sai mais, como o "Pre-Order Now" do VI. Nada flutua no rodapé da tela.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react"
import { setMotionPref } from "../motion-pref"
import { Btn, FaviconMark, TextLink, Wordmark, WORDMARK_RATIO, useReduced } from "./ui"
import type { CountdownState } from "./mint-state"
import { CITY_URL, MINT_HOST, MINT_URL } from "./mint-state"

const DRAWER_LINKS: { label: string; href: string; note?: string }[] = [
  { label: "Find your lot", href: "#lookup" },
  { label: "The deeds", href: "#deeds" },
  { label: "The city", href: "#city" },
  { label: "The calendar", href: "#calendar" },
  { label: "Become a founder", href: "#fund", note: "Fund the city" },
  { label: "Docs", href: "/dogcity/docs" },
  { label: "Atlas", href: "/dogcity/atlas" },
  // a raiz do DogData: a landing grava `dogdata-session`, então "/" não manda de volta para cá
  { label: "DogData", href: "/", note: "Holders, charts, live data" },
]

export function MotionSwitch({ className = "" }: { className?: string }) {
  const reduced = useReduced()
  const on = !reduced
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => setMotionPref(on ? "off" : "on")}
      className={`group inline-flex items-center gap-3 dc-label text-dc-mist hover:text-dc-snow transition-colors ${className}`}
    >
      <span>Motion: {on ? "on" : "off"}</span>
      <span aria-hidden className={`relative inline-block h-[14px] w-[26px] border ${on ? "border-dc-lava" : "border-dc-snow/[0.3]"}`}>
        <span
          className={`absolute left-0 top-[2px] h-[8px] w-[8px] transition-transform duration-200 ${on ? "bg-dc-lava translate-x-[14px]" : "bg-dc-mist translate-x-[2px]"}`}
        />
      </span>
    </button>
  )
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <span aria-hidden className="relative block h-[12px] w-[22px]">
      <span className={`absolute left-0 h-[2px] w-full bg-current transition-transform duration-300 ${open ? "top-[5px] rotate-45" : "top-0"}`} />
      <span className={`absolute left-0 h-[2px] w-full bg-current transition-transform duration-300 ${open ? "top-[5px] -rotate-45" : "top-[10px]"}`} />
    </span>
  )
}

export function Nav({
  cd, live, solid, quiet,
}: { cd: CountdownState; live: boolean; solid: boolean; quiet: boolean }) {
  const [open, setOpen] = useState(false)
  // quiet: a busca está na tela; o botão "FIND MY LOT" da navegação seria a quarta
  // vez da mesma ação na mesma tela, então fica só a leitura do contador
  const reading = cd.nav.desktop.split(" · ")[0]
  return (
    <>
      <nav
        aria-label="DogCity"
        className={`fixed inset-x-0 top-0 z-[60] h-14 lg:h-[72px] transition-[background-color,border-color] duration-300
          border-b ${solid ? "bg-dc-void border-dc-snow/[0.12]" : "bg-transparent border-transparent"}`}
      >
        <div className="mx-auto flex h-full max-w-[calc(1360px+2*var(--dc-gutter))] items-center gap-4 px-[var(--dc-gutter)]">
          {/* a marca: wordmark a 32 px no desktop; D· no celular (o wordmark não cabe a 32 px) */}
          <a href="#top" aria-label="DogCity, back to the top" className="shrink-0" id="dc-nav-mark">
            <span className="hidden lg:block"><Wordmark height={32} alt="" /></span>
            <span className="lg:hidden"><FaviconMark size={32} alt="" /></span>
          </a>

          {/* P7 (2ª volta, 18/10): sem links no centro. Com o filme, a Terra de T1 nasce
              no alto e no meio da tela, bem embaixo deles; a navegação fica com a marca,
              a pílula viva e o menu (a gaveta tem todos os links) */}
          <div className="flex-1" />

          {/* a pílula viva: SEMPRE no layout (o trilho do herói voa até ela, então a
              caixa dela tem de existir), invisível até o voo terminar */}
          <div
            data-dc-pill
            className={`flex items-center gap-3 transition-opacity duration-300 ${live ? "opacity-100" : "opacity-0 invisible pointer-events-none"}`}
            aria-hidden={!live}
          >
            {/* desktop: o botão inteiro, como o "Pre-Order Now" do VI */}
            {quiet ? (
              <span className="hidden lg:inline-flex h-10 items-center font-mono text-[11px] tracking-[0.14em] text-dc-snow tabular-nums whitespace-nowrap">
                {reading}
              </span>
            ) : (
              <a href={cd.nav.href} tabIndex={live ? 0 : -1} className="hidden lg:inline-flex dc-btn dc-btn-fill dc-btn-sm">
                <span className="tabular-nums">{cd.nav.desktop}</span>
              </a>
            )}
            {/* celular e tablet: a leitura em mono e o botão curto */}
            {cd.nav.mobile && (
              <span className="lg:hidden max-[359px]:hidden font-mono text-[11px] tracking-[0.12em] text-dc-snow tabular-nums whitespace-nowrap">
                {cd.nav.mobile}
              </span>
            )}
            {!quiet && (
              <a href={cd.nav.href} tabIndex={live ? 0 : -1} className="lg:hidden dc-btn dc-btn-fill !h-9 !px-3 !text-[11px] !tracking-[0.12em]">
                {cd.nav.cta}
              </a>
            )}
          </div>

          {/* P7: sobre o herói o "Enter the city" já está no bloco do contador; aqui só depois */}
          <Btn href={CITY_URL} variant="line" size="sm" className={`hidden lg:inline-flex ${live ? "" : "!hidden"}`}>
            Enter the city
          </Btn>
          {/* a porta para o DogData: sempre na barra do desktop, no tom do "Menu" (no celular, na gaveta) */}
          <a
            href="/"
            className={`hidden lg:inline-flex h-10 items-center px-1 dc-label !text-[11px] text-dc-snow hover:text-dc-hot transition-colors ${solid ? "" : "dc-halo"}`}
          >
            DogData
          </a>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-controls="dc-drawer"
            aria-label="Menu"
            className={`inline-flex h-10 items-center gap-3 px-1 text-dc-snow ${solid ? "" : "dc-halo"}`}
          >
            <span aria-hidden className="hidden lg:inline dc-label !text-[11px]">Menu</span>
            <MenuIcon open={open} />
          </button>
        </div>
      </nav>
      <Drawer open={open} onClose={() => setOpen(false)} />
    </>
  )
}

function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)
  const reduced = useReduced()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (open) setMounted(true)
  }, [open])

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const html = document.documentElement
    const overflow = html.style.overflow
    html.style.overflow = "hidden"
    const t = setTimeout(() => closeBtn.current?.focus(), 30)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key !== "Tab" || !panel.current) return
      const f = panel.current.querySelectorAll<HTMLElement>("a,button")
      if (!f.length) return
      const first = f[0], last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    window.addEventListener("keydown", onKey)
    return () => {
      clearTimeout(t)
      html.style.overflow = overflow
      window.removeEventListener("keydown", onKey)
      prev?.focus?.()
    }
  }, [open, onClose])

  if (!mounted) return null
  const dur = reduced ? "duration-0" : "duration-500"
  return (
    <div
      className={`fixed inset-0 z-[70] ${open ? "" : "pointer-events-none"}`}
      aria-hidden={!open}
      onTransitionEnd={() => { if (!open) setMounted(false) }}
    >
      {/* o fundo escurece e, no desktop, o wordmark grande mora à esquerda (o gesto do VI) */}
      <div
        className={`absolute inset-0 bg-dc-deep/[0.94] lg:bg-dc-deep/[0.97] transition-opacity ${dur} ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      >
        <div className="hidden lg:flex absolute inset-y-0 left-0 right-[40%] items-center justify-center">
          <Wordmark height={Math.round(Math.min(520, 0.42 * 1440) / WORDMARK_RATIO)} alt="" className="opacity-90 w-[42%] h-auto" />
        </div>
      </div>
      <div
        ref={panel}
        id="dc-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className={`absolute inset-y-0 right-0 flex w-[85%] lg:w-[40%] flex-col bg-dc-void border-l border-dc-snow/[0.12]
          transition-transform ${dur} ease-[cubic-bezier(0.16,1,0.3,1)] ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex h-14 lg:h-[72px] items-center justify-between px-6 lg:px-12 border-b border-dc-snow/[0.12]">
          <MotionSwitch />
          <button ref={closeBtn} type="button" onClick={onClose} className="inline-flex h-10 items-center gap-3 text-dc-snow">
            <span className="dc-label !text-[11px]">Close</span>
            <MenuIcon open />
          </button>
        </div>
        <ul className="flex-1 overflow-y-auto px-6 lg:px-12 pt-8 lg:pt-12 space-y-3 lg:space-y-4">
          {DRAWER_LINKS.map((l, i) => (
            <li key={l.href}>
              <a
                href={l.href}
                onClick={onClose}
                className="dc-drawer-link group inline-flex items-baseline gap-4 text-dc-snow hover:text-dc-hot transition-colors"
              >
                <span className="font-mono text-[11px] tracking-[0.2em] text-dc-lava translate-y-[-0.6em]">{String(i + 1).padStart(2, "0")}</span>
                <span className="flex flex-col">
                  {l.label}
                  {l.note && <span className="mt-1 font-mono text-[11px] tracking-[0.12em] uppercase text-dc-mist group-hover:text-dc-snow transition-colors">{l.note}</span>}
                </span>
              </a>
            </li>
          ))}
        </ul>
        <div className="px-6 lg:px-12 py-6 border-t border-dc-snow/[0.12] space-y-3 pb-[max(24px,env(safe-area-inset-bottom))]">
          <p className="dc-label text-dc-mist">
            Mint only at <TextLink href={MINT_URL} className="text-dc-lava">{MINT_HOST}</TextLink>
          </p>
        </div>
      </div>
    </div>
  )
}

export function Footer() {
  return (
    <footer className="relative border-t border-dc-snow/[0.12] bg-dc-void pt-20 lg:pt-28 pb-[max(32px,env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-[calc(1360px+2*var(--dc-gutter))] px-[var(--dc-gutter)]">
        <div className="flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/landing/v3/brand/dogcity-negativa.svg" alt="DogCity" width={760} height={115} className="w-[min(760px,88vw)] h-auto" />
          <p className="mt-6 font-body text-[16px] lg:text-[18px] text-dc-mist">A city on the Moon, drawn from block 966,670.</p>
        </div>
        <div className="mt-16 lg:mt-20 grid grid-cols-2 lg:grid-cols-3 gap-10 border-t border-dc-snow/[0.12] pt-10">
          <FooterCol title="City" links={[
            { label: "Enter the city", href: CITY_URL },
            { label: "Atlas", href: "/dogcity/atlas" },
          ]} />
          <FooterCol title="Mint" links={[
            { label: "Calendar", href: "#calendar" },
            { label: "Docs", href: "/dogcity/docs" },
            { label: MINT_HOST, href: MINT_URL },
          ]} />
          <FooterCol title="DogData" links={[{ label: "dogdata.xyz", href: "/" }]} />
        </div>
        <div className="mt-12 flex flex-col-reverse gap-6 lg:flex-row lg:items-center lg:justify-between border-t border-dc-snow/[0.12] pt-6">
          <p className="dc-label text-dc-dusty">
            The only place to mint is <span className="text-dc-snow">{MINT_HOST}</span>.
          </p>
          <div className="flex items-center justify-between gap-8">
            <MotionSwitch />
            <p className="dc-label text-dc-dusty">Built by <TextLink href="/" className="text-dc-snow">DogData</TextLink></p>
          </div>
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
