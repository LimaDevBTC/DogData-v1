"use client"

// ═══════════════════════════════════════════════════════════════════════════
// 03 · THE CITY (#city), brief landing v3 §4.5.
//
// Prova que a cidade existe e entrega o controle. Duas metades: o $DOG
// interativo (three.js puro, carregado só a 600 px da seção, ./dog-stage.tsx) e
// os lugares, em cartões com laço de 4 s (à la "Only in Leonida").
//
// ⚠️ "$DOG ARENA · One seat for every wallet." NÃO entra: não está nos docs
// (decisão de 18/10). Os lugares são os do jogo e da carta.
// ⚠️ Sem laço ainda (landing-v3/video/places/ não chegou): o cartão mostra o
// recorte da própria carta da cidade naquele lugar, e o Spaceport, que fica fora
// da carta (11 km ao sul, fora do domo), mostra só a coordenada do catálogo.
// ═══════════════════════════════════════════════════════════════════════════

import dynamic from "next/dynamic"
import { useEffect, useRef, useState } from "react"
import { Reveal, SplitLine } from "../landing/reveal"
import { Btn, Frame, SectionHead, useNear, useReduced } from "../landing/ui"
import { MAP, VIDEO, metersToMap } from "../landing/media"
import { CITY_URL } from "../landing/mint-state"
import type { Clip, StageHandle } from "./dog-stage"

const DogStage = dynamic(() => import("./dog-stage"), { ssr: false })

const CHIPS: { clip: Clip; label: string }[] = [
  { clip: "Idle", label: "IDLE" },
  { clip: "Walk", label: "WALK" },
  { clip: "Run", label: "RUN" },
  { clip: "Jump", label: "JUMP" },
  { clip: "Swim", label: "SWIM" },
]
const DOG_POSTER = "/landing/v3/dog/poster.webp"

// ═══ o palco ═══════════════════════════════════════════════════════════════
function Stage() {
  const reduced = useReduced()
  const { ref, near } = useNear<HTMLDivElement>("600px 0px")
  const [clip, setClip] = useState<Clip>("Idle")
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const handle = useRef<StageHandle | null>(null)

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); handle.current?.rotate(-0.17) }
    if (e.key === "ArrowRight") { e.preventDefault(); handle.current?.rotate(0.17) }
    const n = Number(e.key)
    if (n >= 1 && n <= CHIPS.length) setClip(CHIPS[n - 1].clip)
  }

  return (
    <div>
      <div
        ref={ref}
        tabIndex={0}
        role="group"
        aria-label="The $DOG, your citizen in the city. Drag or use the arrow keys to turn him; keys 1 to 5 change what he does."
        onKeyDown={onKey}
        className="relative aspect-[4/5] dk:aspect-square w-full overflow-hidden border border-dc-snow/[0.12]"
        style={{ background: "radial-gradient(60% 55% at 50% 58%, rgba(232,102,13,0.075), rgba(232,102,13,0) 70%), #15130F" }}
      >
        {/* o pôster da mesma pose até o 3D chegar (e se ele não chegar) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={DOG_POSTER}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${ready && !failed ? "opacity-0" : "opacity-100"}`}
        />
        {near && !failed && (
          <DogStage
            clip={clip}
            reduced={reduced}
            handleRef={handle}
            onReady={() => setReady(true)}
            onError={(msg) => { console.warn("[dogcity] the $DOG stage did not load:", msg); setFailed(true) }}
          />
        )}
        <p className="pointer-events-none absolute left-4 top-4 dc-label text-dc-mist dc-halo">THE $DOG · YOUR CITIZEN IN THE CITY</p>
        {!ready && !failed && near && <p className="pointer-events-none absolute right-4 top-4 dc-label text-dc-dusty">LOADING</p>}
      </div>
      <div role="toolbar" aria-label="What the $DOG does" className="mt-3 grid grid-cols-5 gap-2">
        {CHIPS.map((c, i) => (
          <button
            key={c.clip}
            type="button"
            aria-pressed={clip === c.clip}
            disabled={failed}
            onClick={() => setClip(c.clip)}
            className={`h-11 dk:h-10 border font-mono text-[11px] tracking-[0.18em] transition-colors duration-200 disabled:opacity-40
              ${clip === c.clip ? "border-dc-lava bg-dc-lava text-dc-void" : "border-dc-snow/[0.2] text-dc-snow hover:border-dc-hot hover:text-dc-hot"}`}
          >
            <span className="sr-only">{i + 1} </span>{c.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ═══ os lugares ════════════════════════════════════════════════════════════
const PLACES: { slug: string; name: string; line: string; at?: [number, number]; coord?: string; desktopOnly?: boolean }[] = [
  { slug: "satoshi-plaza", name: "SATOSHI PLAZA", line: "The center of the city, and of every map.", at: [0, 0] },
  { slug: "the-bay", name: "THE BAY", line: "Yachts on the water, and the waterfront of tiers 1 to 3 on its shore.", at: [2550, -5400] },
  { slug: "the-spit", name: "THE SPIT", line: "The waterfront at the end of the Spit Bridge.", at: [5150, -4500] },
  // sítio do SPACEPORT no catálogo do jogo (public/dados/catalogo.json): x -508, z 11.188
  { slug: "spaceport", name: "SPACEPORT", line: "Outside the dome, on the open Moon.", coord: "X -508 · Z 11,188 · OUTSIDE THE DOME" },
]

function PlaceCard({ p, active, onHover }: { p: (typeof PLACES)[number]; active: boolean; onHover: (on: boolean) => void }) {
  const loop = VIDEO.places?.[p.slug]
  const vid = useRef<HTMLVideoElement>(null)
  const reduced = useReduced()

  useEffect(() => {
    const v = vid.current
    if (!v) return
    if (active && !reduced) v.play().catch(() => {})
    else { v.pause(); try { v.currentTime = 0 } catch { /* ainda sem metadados */ } }
  }, [active, reduced])

  // o recorte da carta: a imagem posicionada para pôr o lugar no centro do cartão
  // (4:5), mostrando ~5 km de largura (600 px da carta a 2400)
  let crop: React.CSSProperties | undefined
  if (!loop && p.at) {
    const [mx, my] = metersToMap(p.at[0], p.at[1])
    const S = (MAP.size / 600) * 100
    crop = {
      width: `${S}%`, maxWidth: "none",
      left: `${50 - (mx / MAP.size) * S}%`, top: `${50 - ((my / MAP.size) * S) / 1.25}%`,
      filter: "brightness(0.8) saturate(0.95)",
    }
  }
  return (
    <li
      data-slug={p.slug}
      className="w-[84vw] dk:w-[min(400px,29vw)] mr-3 dk:mr-6"
      onPointerEnter={(e) => { if (e.pointerType === "mouse") onHover(true) }}
      onPointerLeave={(e) => { if (e.pointerType === "mouse") onHover(false) }}
    >
      <div className="relative aspect-[4/5] overflow-hidden border border-dc-snow/[0.12] bg-dc-deep">
        {loop ? (
          <video
            ref={vid}
            muted
            playsInline
            loop
            preload="none"
            poster={loop.webp ?? loop.jpg}
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover"
          >
            {loop.webm && <source src={loop.webm} type="video/webm" />}
            {loop.mp4 && <source src={loop.mp4} type="video/mp4" />}
          </video>
        ) : crop ? (
          <div aria-hidden className={`absolute inset-0 transition-transform duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${active && !reduced ? "scale-[1.06]" : "scale-100"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={MAP.src2400} alt="" loading="lazy" decoding="async" className="absolute h-auto select-none" style={crop} draggable={false} />
          </div>
        ) : (
          <div aria-hidden className="absolute inset-0" style={{ background: "radial-gradient(120% 70% at 50% 110%, rgba(232,102,13,0.16), rgba(13,12,9,0) 60%), linear-gradient(#0D0C09, #1B1915)" }}>
            <div className="dc-ruler absolute inset-x-6 top-1/2 h-3 opacity-40" />
            {p.coord && <p className="absolute inset-x-6 top-[calc(50%+20px)] font-mono text-[11px] tracking-[0.14em] text-dc-mist">{p.coord}</p>}
          </div>
        )}
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-dc-deep/[0.85] to-transparent" />
        <div className="absolute inset-x-5 bottom-5 dc-halo">
          <h3 className="font-cond font-bold uppercase leading-[0.9] text-[40px] dk:text-[48px] text-dc-snow">{p.name}</h3>
          <p className="mt-2 font-body text-[16px] leading-[24px] text-dc-snow/[0.9]">{p.line}</p>
        </div>
      </div>
    </li>
  )
}

function Places() {
  const rail = useRef<HTMLUListElement>(null)
  const [centered, setCentered] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [fine, setFine] = useState(false)
  useEffect(() => { setFine(window.matchMedia("(pointer: fine)").matches) }, [])

  // no celular, toca o cartão que está no centro da faixa
  useEffect(() => {
    const r = rail.current
    if (!r || fine) return
    const io = new IntersectionObserver((es) => {
      for (const e of es) if (e.isIntersecting) setCentered((e.target as HTMLElement).dataset.slug ?? null)
    }, { root: r, threshold: 0.75 })
    r.querySelectorAll("li[data-slug]").forEach((li) => io.observe(li))
    return () => io.disconnect()
  }, [fine])

  return (
    <ul ref={rail} className="dc-rail mt-12 dk:mt-16 pb-2" aria-label="Places in the city">
      {PLACES.map((p) => (
        <PlaceCard
          key={p.slug}
          p={p}
          active={fine ? hovered === p.slug : centered === p.slug}
          onHover={(on) => setHovered(on ? p.slug : null)}
        />
      ))}
      <li aria-hidden className="w-[calc(var(--dc-gutter)-12px)] dk:w-[calc(var(--dc-gutter)-24px)]" />
    </ul>
  )
}

export default function TheCity() {
  return (
    <section id="city" aria-labelledby="dc-city-h2" className="relative bg-dc-void pt-24 dk:pt-40 scroll-mt-14">
      <Frame>
        <div className="mt-8 grid gap-10 dkl:grid-cols-12 dkl:gap-6 dkl:items-center">
          <div className="dkl:col-span-5">
            <SectionHead n="03" label="PLAYABLE IN YOUR BROWSER · DOGCITY.SPACE" />
            <h2 id="dc-city-h2" className="dc-h2 mt-4 text-dc-snow"><SplitLine text="Walk your street before you mint it." /></h2>
            <Reveal y={16} blur={false}>
              <p className="dc-lede mt-6">
                DogCity is built on real lunar terrain. Walk it as the $DOG, drive the Cybertruck down the ring roads, take
                a yacht across the bay, and find your own lot from the street.
              </p>
              <div className="mt-8"><Btn href={CITY_URL}>Enter the city</Btn></div>
            </Reveal>
          </div>
          <div className="dkl:col-span-7 dkl:pl-8">
            <Stage />
          </div>
        </div>
      </Frame>
      <Places />
    </section>
  )
}
