"use client"

// ═══════════════════════════════════════════════════════════════════════════
// CRYPTOLUTION HOUSE — a chapa da transmissão diária da cidade.
//
// As duas chapas anteriores mostram os prédios de PROTOCOLO (Needle, e as
// âncoras BitFlow/Kray). Esta mostra o prédio da PESSOA que conta a história do
// $DOG: Vincent (@cryptolution101, canal "Cryptolution"), que publica um vídeo
// novo quase todo dia. A Cryptolution House é uma torre de transmissão cuja
// FACHADA é um telão — e o telão toca o vídeo de hoje, DENTRO da DogCity.
//
// O MECANISMO — o vídeo mais recente é lido do feed RSS público do canal por
// `/api/cryptolution` (ver lib/cryptolution/feed.ts): sem API key, cache de
// ~30 min, e um retrato embutido de vídeos reais que garante que a chapa nunca
// abre vazia nem quebra se o YouTube cair. O visitante só fala com o YouTube ao
// dar play (embed youtube-nocookie), então nada é carregado do YouTube até ele
// pedir. Clicar numa transmissão recente troca o telão e já toca.
//
// Por que embed e não o mp4 direto: os Termos do YouTube exigem tocar pelo
// player deles. O embed atende a isso E mantém o visitante na cidade — que é o
// pedido do fundador ("ver o vídeo sem precisar sair pro YouTube").
//
// Corners/SectionHead são duplicados de sections/partners.tsx de propósito: o
// vocabulário em motion.tsx está congelado e cada chapa carrega sua própria
// cópia dessas marcas de folha. Paleta e primitivas idênticas às outras chapas.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { Play } from "lucide-react"
import {
  EASE, HAIR, HAIR_SOFT, HAIR_STRONG, GRIDLINE,
  Reveal, Stagger, StaggerItem, SplitLine, Scramble, DrawRule,
  useOnce,
} from "../motion"
import {
  CRYPTOLUTION, embedUrl, fallbackFeed,
  type BroadcastFeed, type BroadcastVideo,
} from "@/lib/cryptolution/feed"

// ── o terreno ────────────────────────────────────────────────────────────────
// Vincent não ganha uma TORRE — torre é pra âncora institucional (BitFlow/Kray).
// Ele ganha uma CASA, num lote em evidência: a cabeça da avenida monumental, no
// alto que olha pra Satoshi Plaza e pra Needle. Lote reservado, fora do sorteio
// dos holders, como as âncoras — mas é casa, não prédio.
const LOCATION = {
  lot: "RESERVED LOT · AVENUE HEAD",
  view: "Overlooking Satoshi Plaza & the Needle",
} as const

// ── a folha de especificação da casa ────────────────────────────────────────
// Como nas âncoras: descreve a COMPOSIÇÃO da casa (verdadeira por construção),
// nunca uma métrica inventada. A CROWN é o farol que pulsa na chaminé; a FAÇADE
// é o próprio telão no quintal da frente.
const SPECS: ReadonlyArray<readonly [string, string]> = [
  ["STRUCTURE", "Lunar house · screen for a face"],
  ["CROWN", "Rooftop signal beacon"],
  ["FAÇADE", "The day's dispatch, live"],
  ["LOT", "Avenue head · plaza view"],
]

// ── the registration corner — team SKYLINE's shared mark ───────────────────
// (cópia idêntica à de partners.tsx — motion.tsx é congelado)
function Corners({ accent, delay = 0 }: { accent?: string; delay?: number }) {
  const reduce = useReducedMotion()
  const { ref, inView } = useOnce("-5% 0px")
  const show = reduce || inView
  const C = [
    { box: "top-0 left-0", h: "top-0 left-0", v: "top-0 left-0", ox: "left", oy: "top" },
    { box: "top-0 right-0", h: "top-0 right-0", v: "top-0 right-0", ox: "right", oy: "top" },
    { box: "bottom-0 right-0", h: "bottom-0 right-0", v: "bottom-0 right-0", ox: "right", oy: "bottom" },
    { box: "bottom-0 left-0", h: "bottom-0 left-0", v: "bottom-0 left-0", ox: "left", oy: "bottom" },
  ]
  const paint = (i: number) => (i === 0 && accent ? accent : "rgba(240,240,242,0.22)")
  return (
    <span ref={ref as never} aria-hidden className="absolute inset-0 pointer-events-none z-20">
      {C.map((c, i) => (
        <span key={c.box} className={`absolute ${c.box}`} style={{ width: 10, height: 10 }}>
          <motion.span
            className={`absolute ${c.h} h-px w-full`}
            style={{ background: paint(i), transformOrigin: c.ox }}
            initial={reduce ? false : { scaleX: 0 }}
            animate={show ? { scaleX: 1 } : undefined}
            transition={{ duration: 0.35, delay: delay + i * 0.04, ease: EASE }}
          />
          <motion.span
            className={`absolute ${c.v} w-px h-full`}
            style={{ background: paint(i), transformOrigin: c.oy }}
            initial={reduce ? false : { scaleY: 0 }}
            animate={show ? { scaleY: 1 } : undefined}
            transition={{ duration: 0.35, delay: delay + i * 0.04, ease: EASE }}
          />
        </span>
      ))}
    </span>
  )
}

function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="max-w-2xl">
      <Scramble text={eyebrow} className="font-mono text-[11px] tracking-[0.3em] text-lava" />
      <DrawRule className="mt-3 w-14" delay={0.06} duration={0.9} />
      <h2 className="font-display font-bold text-3xl md:text-4xl text-snow mt-4 leading-tight">
        <SplitLine text={title} delay={0.12} step={0.055} className="pb-[0.12em]" />
      </h2>
      {sub && (
        <Reveal delay={0.34} y={14}>
          <p className="text-sm text-mist mt-3 leading-relaxed">{sub}</p>
        </Reveal>
      )}
    </div>
  )
}

// "há 2 dias" na voz mono da cidade, em inglês como o resto do fólio
function relDate(iso: string): string {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ""
  const days = Math.floor((Date.now() - then) / 86_400_000)
  if (days <= 0) return "TODAY"
  if (days === 1) return "YESTERDAY"
  if (days < 7) return `${days} DAYS AGO`
  if (days < 14) return "1 WEEK AGO"
  if (days < 30) return `${Math.floor(days / 7)} WEEKS AGO`
  const months = Math.floor(days / 30)
  return months <= 1 ? "1 MONTH AGO" : `${months} MONTHS AGO`
}

// ═══ o telhado — o que faz disto uma CASA, não uma torre ═════════════════════
// Uma cumeeira de duas águas desenhada em linha de projeto, assentada em cima do
// telão. Chaminé com o farol que pulsa (o "sinal" de transmissão nova) e uma
// janelinha quente acesa na empena — a casa com a luz acesa. vector-effect mantém
// o traço fino mesmo com o SVG esticado à largura do telão (preserveAspect=none).
function HouseRoof() {
  const reduce = useReducedMotion()
  return (
    <div className="relative">
      <svg viewBox="0 0 1000 200" preserveAspectRatio="none" aria-hidden className="block w-full h-16 md:h-24">
        <polygon points="12,192 500,26 988,192" fill="rgba(245,110,15,0.03)" />
        <polyline points="12,192 500,26 988,192" fill="none" stroke="rgba(240,240,242,0.32)" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <polyline points="60,192 500,58 940,192" fill="none" stroke="rgba(240,240,242,0.12)" strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <line x1="0" y1="192" x2="1000" y2="192" stroke="rgba(240,240,242,0.20)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <rect x="724" y="44" width="46" height="70" fill="#000" stroke="rgba(240,240,242,0.30)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <circle cx="500" cy="122" r="26" fill="rgba(245,110,15,0.12)" stroke="rgba(245,110,15,0.6)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <line x1="500" y1="96" x2="500" y2="148" stroke="rgba(245,110,15,0.45)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        <line x1="474" y1="122" x2="526" y2="122" stroke="rgba(245,110,15,0.45)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
      {/* o farol pulsando no topo da chaminé */}
      <span className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: "74.6%", top: "22%" }}>
        <motion.span
          className="block h-2.5 w-2.5 rounded-full bg-lava"
          style={{ boxShadow: "0 0 14px rgba(245,110,15,0.8)" }}
          animate={reduce ? undefined : { opacity: [1, 0.2, 1], scale: [1, 0.75, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
      </span>
    </div>
  )
}

// ═══ o telão — a fachada da casa ═════════════════════════════════════════════
// 16:9, largura cheia (o vídeo é o herói). Fechado: pôster + play, com data e
// título sobre um degradê. Aberto: o embed do YouTube tocando ali mesmo. Telhado
// em cima, varanda embaixo — a casa emoldura o telão sem roubar tela dele.
function Screen({
  video, playing, onPlay,
}: {
  video: BroadcastVideo
  playing: boolean
  onPlay: () => void
}) {
  return (
    <div>
      <HouseRoof />

      {/* a fachada-telão */}
      <div className={`relative aspect-video border-x border-t ${HAIR} overflow-hidden bg-black`}>
        {playing ? (
          <iframe
            key={video.id}
            className="absolute inset-0 h-full w-full"
            src={embedUrl(video.id)}
            title={`${CRYPTOLUTION.name}: ${video.title}`}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button
            type="button"
            onClick={onPlay}
            aria-label={`Play the broadcast: ${video.title}`}
            className="group absolute inset-0 h-full w-full"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={video.thumb}
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/40" />

            {/* selo: transmissão · quando */}
            <span className="absolute top-3 left-3 flex items-center gap-2 font-mono">
              <span className="flex items-center gap-1.5 bg-void/75 px-2 py-1 text-[9px] tracking-[0.22em] text-lava">
                <span className="h-1.5 w-1.5 rounded-full bg-lava animate-pulse" />
                DAILY DISPATCH
              </span>
              <span className="bg-void/75 px-2 py-1 text-[9px] tracking-[0.22em] text-snow/80">
                {relDate(video.published)}
              </span>
            </span>

            {/* botão de play */}
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-lava text-void shadow-[0_0_34px_rgba(245,110,15,0.5)] transition-transform duration-300 group-hover:scale-110">
                <Play className="h-6 w-6 translate-x-[2px]" fill="currentColor" />
              </span>
            </span>

            {/* título do vídeo de hoje */}
            <span className="absolute inset-x-0 bottom-0 p-4 text-left">
              <span className="line-clamp-2 font-display text-sm md:text-base font-semibold leading-snug text-snow">
                {video.title}
              </span>
            </span>
          </button>
        )}
        <Corners accent="rgba(245,110,15,0.85)" delay={0.1} />
      </div>

      {/* a varanda — luz de varanda acesa, o nome da casa e onde ela fica */}
      <div className={`relative flex items-center justify-between gap-3 border ${HAIR} bg-void px-3 py-2.5 font-mono`}>
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full bg-lava/80 shadow-[0_0_10px_rgba(245,110,15,0.6)]" />
          <span className="truncate text-[10px] tracking-[0.22em] text-snow/85">{CRYPTOLUTION.building.toUpperCase()}</span>
          <span className="hidden truncate text-[9px] tracking-[0.22em] text-dusty sm:inline">· {LOCATION.lot}</span>
        </div>
        <a
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-[9px] tracking-[0.22em] text-dusty hover:text-snow transition-colors"
          title="Open on YouTube"
        >
          {relDate(video.published)} ↗
        </a>
      </div>
    </div>
  )
}

// ═══ a régua de transmissões recentes ═══════════════════════════════════════
function RecentRail({
  videos, activeId, onSelect,
}: {
  videos: BroadcastVideo[]
  activeId: string
  onSelect: (v: BroadcastVideo) => void
}) {
  return (
    <div className="mt-4 flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {videos.map((v, i) => {
        const on = v.id === activeId
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => onSelect(v)}
            aria-pressed={on}
            className={`group relative shrink-0 w-40 text-left transition-opacity ${on ? "opacity-100" : "opacity-60 hover:opacity-100"}`}
          >
            <div className={`relative aspect-video border ${on ? HAIR_STRONG : HAIR} overflow-hidden bg-black`}>
              {on && <span className="absolute inset-x-0 top-0 z-10 h-px bg-lava" />}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={v.thumb} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
              {i === 0 && (
                <span className="absolute top-1 left-1 bg-void/80 px-1.5 py-0.5 font-mono text-[8px] tracking-[0.2em] text-lava">
                  NEWEST
                </span>
              )}
            </div>
            <div className="mt-1.5 line-clamp-2 font-mono text-[10px] leading-tight text-mist group-hover:text-snow">
              {v.title}
            </div>
            <div className="mt-0.5 font-mono text-[9px] tracking-[0.18em] text-dusty">{relDate(v.published)}</div>
          </button>
        )
      })}
    </div>
  )
}

// ═══ o dossiê do cronista ════════════════════════════════════════════════════
function Dossier() {
  const [markOk, setMarkOk] = useState(true)
  return (
    <StaggerItem className={`relative border ${HAIR_STRONG} bg-void`}>
      <span className="absolute -top-px inset-x-0 h-px bg-lava" />
      <Corners accent="rgba(245,110,15,0.85)" />
      <div className="flex flex-col p-5 md:p-6">
        {/* cabeça — a marca (PFP do Vincent), depois a designação */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {markOk ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="/cryptolution.jpg"
                alt="Cryptolution"
                width={52}
                height={52}
                onError={() => setMarkOk(false)}
                className="shrink-0 rounded-full border border-white/15 object-cover"
                style={{ height: 52, width: 52 }}
              />
            ) : (
              <span className="grid shrink-0 place-items-center rounded-full border border-white/15 font-display text-lg font-bold text-lava" style={{ height: 52, width: 52 }}>
                C
              </span>
            )}
            <div>
              <h3 className="font-display font-bold text-xl text-snow leading-none">{CRYPTOLUTION.name}</h3>
              <span className="font-mono text-[10px] tracking-[0.18em] text-dusty">{CRYPTOLUTION.person} · {CRYPTOLUTION.handle}</span>
            </div>
          </div>
          {/* no celular a marca + nome já ocupam a linha; a etiqueta cortava na
              borda, então só aparece de sm pra cima */}
          <span className="hidden sm:block font-mono text-[9px] tracking-[0.22em] text-dusty whitespace-nowrap pt-1">THE CHRONICLER</span>
        </div>

        <div className="mt-5 flex items-baseline gap-3 flex-wrap">
          <h4 className="font-display font-bold text-lg text-snow">{CRYPTOLUTION.building}</h4>
          <span className="font-mono text-[9px] tracking-[0.22em] text-lava">{LOCATION.lot}</span>
        </div>
        <p className="mt-1 font-mono text-[9px] tracking-[0.2em] text-dusty">{LOCATION.view}</p>

        <p className="mt-3 text-sm text-mist leading-relaxed">
          Vincent is the city&apos;s chronicler — author of <span className="text-snow">THE $DOG EFFECT</span>, an on-chain
          investigator who files a new dispatch on $DOG almost every day. Cryptolution House carries the latest one on its
          face, so the city can read the day&apos;s record without ever leaving for YouTube.
        </p>

        {/* folha de especificação — mesmo grid das âncoras */}
        <div className="mt-6">
          <dl className={`grid grid-cols-2 gap-px ${GRIDLINE} border ${HAIR} font-mono`}>
            {SPECS.map(([k, v]) => (
              <div key={k} className="bg-void p-3">
                <dt className="text-[9px] tracking-[0.25em] text-dusty">{k}</dt>
                <dd className="text-[11px] text-snow mt-1 leading-snug">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* controles — os dois canais do cronista */}
        <div className={`mt-5 pt-4 border-t ${HAIR} flex items-center justify-between gap-4`}>
          <a
            href={CRYPTOLUTION.youtube}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[10px] tracking-[0.22em] text-mist hover:text-snow transition-colors"
          >
            YOUTUBE ↗
          </a>
          <a
            href={CRYPTOLUTION.x}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[10px] tracking-[0.22em] text-mist hover:text-snow transition-colors"
          >
            {CRYPTOLUTION.handle} ↗
          </a>
        </div>
      </div>
    </StaggerItem>
  )
}

export default function Broadcast() {
  // Semeado com o retrato embutido (vídeos reais) pra chapa abrir cheia no
  // primeiro paint e NUNCA vazia; troca pelo feed ao vivo assim que responde.
  const [feed, setFeed] = useState<BroadcastFeed>(() => fallbackFeed())
  const [activeId, setActiveId] = useState<string>(() => fallbackFeed().latest?.id ?? "")
  const [playing, setPlaying] = useState(false)
  // o usuário já escolheu um vídeo à mão? então o feed novo não rouba o telão
  const touched = useRef(false)

  useEffect(() => {
    let alive = true
    fetch("/api/cryptolution", { signal: AbortSignal.timeout(10_000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: BroadcastFeed | null) => {
        if (!alive || !j || !Array.isArray(j.videos) || !j.videos.length) return
        setFeed(j)
        if (!touched.current) setActiveId(j.latest?.id ?? j.videos[0].id)
      })
      .catch(() => {
        /* a chapa já está mostrando o retrato embutido — nada a fazer */
      })
    return () => {
      alive = false
    }
  }, [])

  const active = feed.videos.find((v) => v.id === activeId) ?? feed.latest ?? feed.videos[0]
  if (!active) return null

  const select = (v: BroadcastVideo) => {
    touched.current = true
    setActiveId(v.id)
    setPlaying(true) // clicou numa transmissão: claramente quer assistir
  }

  return (
    <section id="broadcast" className={`border-t ${HAIR_SOFT}`}>
      <div className="max-w-6xl mx-auto px-6 md:px-10 py-16 md:py-24">
        <SectionHead
          eyebrow="CRYPTOLUTION HOUSE"
          title="The city keeps a daily record."
          sub="Vincent — @cryptolution101, the channel Cryptolution — files a new dispatch on $DOG almost every day. Cryptolution House is his home in the city, on a reserved lot at the head of the avenue overlooking Satoshi Plaza — and its front is a big screen. Press play and watch the latest one here, without leaving for YouTube."
        />

        <div className="mt-10 md:mt-12 grid lg:grid-cols-[1.35fr_1fr] gap-6 lg:gap-8 items-start">
          {/* a casa (telhado + telão) + a régua de recentes.
              min-w-0: sem isso, os itens w-40 da régua com overflow-x forçam o
              min-content da coluna e o grid estoura pra direita, cortando o
              dossiê (visto no primeiro screenshot). */}
          <Reveal y={20} className="min-w-0">
            <Screen
              video={active}
              playing={playing}
              // Dar play também é escolher: sem marcar touched, o feed ao vivo
              // que chega depois troca o vídeo NO MEIO da reprodução (a key do
              // iframe muda e ele remonta).
              onPlay={() => { touched.current = true; setPlaying(true) }}
            />
            <RecentRail
              videos={feed.videos}
              activeId={active.id}
              onSelect={select}
            />
            <p className="mt-3 font-mono text-[10px] text-dusty leading-relaxed">
              {feed.stale
                ? "Last known dispatch — the live feed will reconnect on its own."
                : "Pulled live from the channel's public feed. A new dispatch appears here on its own, usually within the hour."}
            </p>
          </Reveal>

          {/* o dossiê */}
          <Stagger step={0.1} delay={0.1} className="min-w-0">
            <Dossier />
          </Stagger>
        </div>
      </div>
    </section>
  )
}
