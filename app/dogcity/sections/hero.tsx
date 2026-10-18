"use client"

// ═══════════════════════════════════════════════════════════════════════════
// 0 · HERÓI, "LAUNCH NIGHT" (brief landing v3 §4.1, §5, §6, §10).
//
// O filme do jogo em takes, com o contador no visor. Pôster primeiro (é o LCP,
// <img fetchpriority="high"> no HTML), filme depois da primeira pintura, em
// requestIdleCallback. O texto mora em canto e borda; o centro é da cidade.
//
// ⚠️ NADA DAQUI USA OS PRIMITIVOS DE REVELAÇÃO DE ../motion.tsx. Eles têm faixa
// morta acima da dobra (o título fica invisível, o contador fica em 0). Tudo
// aqui anima por MONTAGEM, com relógio próprio.
//
// ⚠️ SEM FILME AINDA (18/10): enquanto landing-v3/video/ não chega, o pôster é a
// carta da cidade centrada na Satoshi Plaza, escurecida, e não há legenda de
// take nem botão de pausa (não há o que pausar). O componente já lê o
// manifesto: quando o filme existir, ele entra sozinho.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react"
import { Btn, Odometer, TextLink, WORDMARK_DOT, WORDMARK_RATIO, WORDMARK_SRC, useReduced } from "../landing/ui"
import { HERO_FILM, POSTER } from "../landing/media"
import { FUND_GOAL, RULER, type CountdownState } from "../landing/mint-state"

// ── a escolha do filme: retrato pega o encode 9:16, nunca recorte do 16:9 ──
function pickFilm(): { webm?: string; mp4?: string } {
  const portrait = window.matchMedia("(max-aspect-ratio: 1/1)").matches
  return portrait ? HERO_FILM.mobile : HERO_FILM.desktop
}

function filmAllowed(): boolean {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  if (c?.saveData) return false
  if (c?.effectiveType && /(^|-)(2g|3g)$/.test(c.effectiveType)) return false
  return true
}

const idle = (fn: () => void) => {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
  if (w.requestIdleCallback) w.requestIdleCallback(fn, { timeout: 2500 })
  else setTimeout(fn, 1200)
}

// ═══ o filme ═══════════════════════════════════════════════════════════════
function Film({ reduced }: { reduced: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [src, setSrc] = useState<{ webm?: string; mp4?: string } | null>(null)
  const [visible, setVisible] = useState(false)
  const [paused, setPaused] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const userPaused = useRef(false)
  const [take, setTake] = useState<number | null>(null)
  const [blink, setBlink] = useState(0)
  const onTake = useCallback((i: number) => { setTake(i); setBlink((b) => b + 1) }, [])

  // entra depois da primeira pintura, e só se pode
  useEffect(() => {
    if (!HERO_FILM.exists) return
    if (reduced || !filmAllowed()) { setBlocked(true); return }
    idle(() => setSrc(pickFilm()))
  }, [reduced])

  const play = useCallback(() => {
    const v = ref.current
    if (!v) return
    const p = v.play()
    if (p && typeof p.then === "function") {
      p.then(() => { setPaused(false); setBlocked(false) })
        .catch(() => { setBlocked(true); setPaused(true) })   // modo de economia do iPhone: fica o pôster
    }
  }, [])

  useEffect(() => { if (src) play() }, [src, play])

  // pausa fora da tela e com a aba escondida; volta se a pessoa não pausou
  useEffect(() => {
    const v = ref.current
    if (!v || !src) return
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !userPaused.current) play()
      else if (!e.isIntersecting) v.pause()
    }, { threshold: 0.15 })
    io.observe(v)
    const onVis = () => { if (document.hidden) v.pause(); else if (!userPaused.current) play() }
    document.addEventListener("visibilitychange", onVis)
    return () => { io.disconnect(); document.removeEventListener("visibilitychange", onVis) }
  }, [src, play])

  // a legenda do take segue os cortes do cuts.json
  useEffect(() => {
    const v = ref.current
    if (!v || !HERO_FILM.cuts.length) return
    let last = -1
    const on = () => {
      const t = v.currentTime
      let i = 0
      for (let k = 0; k < HERO_FILM.cuts.length; k++) if (t >= HERO_FILM.cuts[k].t) i = k
      if (i !== last) { last = i; onTake(i) }
    }
    v.addEventListener("timeupdate", on)
    return () => v.removeEventListener("timeupdate", on)
  }, [src, onTake])

  if (!HERO_FILM.exists) return null
  const toggle = () => {
    const v = ref.current
    if (!src) { userPaused.current = false; setSrc(pickFilm()); return }
    if (!v) return
    if (v.paused) { userPaused.current = false; play() }
    else { userPaused.current = true; v.pause(); setPaused(true) }
  }
  const showPlay = blocked || paused || !src
  const cut = take != null ? HERO_FILM.cuts[take] : null

  return (
    <>
      {src && (
        <video
          ref={ref}
          muted
          playsInline
          loop
          preload="none"
          aria-hidden
          onPlaying={() => { setVisible(true); window.dispatchEvent(new Event("dc:film-playing")) }}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[600ms] ${visible ? "opacity-100" : "opacity-0"}`}
        >
          {src.webm && <source src={src.webm} type='video/webm; codecs="av01.0.05M.08"' />}
          {src.mp4 && <source src={src.mp4} type="video/mp4" />}
        </video>
      )}
      {/* a legenda do take e a pausa: canto inferior direito (topo direito no celular).
          WCAG 2.2.2: o laço passa de 5 s, então o controle de pausa é visível. */}
      <div className="absolute right-[var(--dc-gutter)] top-[64px] dk:top-auto dk:bottom-[112px] z-[2] flex flex-col items-end gap-1 text-right">
      {cut && (
        <p key={blink} className={`dc-label text-dc-snow dc-halo ${reduced ? "" : "dc-blink"}`}>
          {String((take ?? 0) + 1).padStart(2, "0")} / {String(HERO_FILM.cuts.length).padStart(2, "0")} · {cut.place}
        </p>
      )}
      <button
        type="button"
        onClick={toggle}
        className="dc-label !text-[11px] text-dc-snow dc-halo inline-flex items-center gap-2 h-9"
        aria-label={showPlay ? "Play film" : "Pause film"}
      >
        <span aria-hidden className="inline-flex h-[10px] w-[10px] items-center justify-center">
          {showPlay
            ? <span className="block h-0 w-0 border-y-[5px] border-y-transparent border-l-[8px] border-l-current" />
            : <span className="flex gap-[2px]"><span className="block h-[10px] w-[3px] bg-current" /><span className="block h-[10px] w-[3px] bg-current" /></span>}
        </span>
        {showPlay ? (blocked || !src ? "Play film" : "Play") : "Pause"}
      </button>
      </div>
    </>
  )
}

// ═══ o trilho (fundo ou régua das fases) ═══════════════════════════════════
// UM valor move cabeça, mortalha e leitura (a mecânica de construction-fund.tsx),
// só transform. A largura é medida por ResizeObserver num ref, nunca estado.
function Rail({ cd, intro, reduced }: { cd: CountdownState; intro: boolean; reduced: boolean }) {
  const wrap = useRef<HTMLDivElement>(null)
  const shroud = useRef<HTMLDivElement>(null)
  const curtain = useRef<HTMLDivElement>(null)
  const head = useRef<HTMLDivElement>(null)
  const readout = useRef<HTMLDivElement>(null)
  const width = useRef(0)
  const shown = useRef(0)
  const [pulse, setPulse] = useState(0)

  const target = cd.rail.mode === "connecting" ? 0 : cd.rail.fraction

  const apply = useCallback((f: number) => {
    shown.current = f
    const w = width.current
    if (shroud.current) shroud.current.style.transform = `scaleX(${1 - f})`
    if (head.current) head.current.style.transform = `translateX(${f * w}px)`
    if (readout.current) {
      const rw = readout.current.offsetWidth
      const x = Math.max(0, Math.min(w - rw, f * w - rw / 2))
      readout.current.style.transform = `translateX(${x}px)`
    }
  }, [])

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(() => { width.current = el.clientWidth; apply(shown.current) })
    ro.observe(el)
    width.current = el.clientWidth
    return () => ro.disconnect()
  }, [apply])

  // o desenho: o trilho se revela da esquerda para a direita (1.000 ms, a partir de
  // 1.200). Na primeira visita ele já nasce recortado pelo CSS (html[data-dc-intro]
  // .dc-rail-draw), então nada pisca entre a primeira pintura e a hidratação.
  const drewRef = useRef(false)
  useEffect(() => {
    const c = curtain.current
    if (!c || drewRef.current || !intro || reduced) return
    drewRef.current = true
    c.animate([{ clipPath: "inset(-8px 100% -8px 0)" }, { clipPath: "inset(-8px 0% -8px 0)" }], {
      duration: 1000, delay: 1200, easing: "cubic-bezier(0.16,1,0.3,1)", fill: "forwards",
    })
  }, [intro, reduced])

  useEffect(() => {
    if (reduced) { apply(target); return }
    const from = shown.current
    if (Math.abs(from - target) < 1e-6) { apply(target); return }
    const first = from === 0 && intro
    const delay = first ? 1750 : 0
    const dur = first ? 1100 : 900
    let raf = 0, t0 = 0
    const tick = (t: number) => {
      if (!t0) t0 = t + delay
      const k = Math.max(0, Math.min(1, (t - t0) / dur))
      const e = 1 - Math.pow(1 - k, 4)
      apply(from + (target - from) * e)
      if (k < 1) raf = requestAnimationFrame(tick)
      else if (from > 0) setPulse((p) => p + 1)   // o número mudou: a cabeça dá um pulso
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, intro, reduced, apply])

  const phases = cd.rail.mode === "phases"
  const full = cd.rail.mode === "fund" && cd.rail.full
  return (
    <div className="absolute inset-x-0 bottom-0 z-[3] pb-[max(14px,env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-[calc(1360px+2*var(--dc-gutter))] px-[var(--dc-gutter)]">
        <div ref={wrap} className="relative">
          {/* leitura presa à cabeça */}
          <div className="relative h-5 mb-1.5">
            <div ref={readout} className="absolute left-0 top-0 whitespace-nowrap font-mono text-[11px] dk:text-[12px] tracking-[0.08em] text-dc-snow dc-halo tabular-nums">
              {cd.rail.mode === "connecting" && <span className="text-dc-mist">connecting</span>}
              {cd.rail.mode === "fund" && cd.rail.readout}
              {cd.rail.mode === "phases" && <span className="text-dc-lava">{RULER[cd.rail.current]?.label}</span>}
            </div>
          </div>
          {/* graduação + trilho de 3 px (o `curtain` é o recorte do desenho) */}
          <div ref={curtain} className="dc-rail-draw relative h-[13px]">
            <div className="dc-ruler absolute inset-x-0 top-0 h-[9px] opacity-80" />
            {phases && (
              <div aria-hidden className="absolute inset-0 flex">
                {RULER.map((r, i) => (
                  <span key={r.phase} className={`flex-1 ${i ? "border-l border-dc-snow/[0.5]" : ""}`} />
                ))}
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 h-[3px] bg-dc-snow/[0.16]" />
            <div className="absolute inset-x-0 bottom-0 h-[3px] bg-gradient-to-r from-[#B4501C] via-dc-lava to-dc-hot" />
            {/* mortalha: cobre o que ainda não encheu (escala da direita) */}
            <div ref={shroud} className="absolute inset-x-0 bottom-0 h-[3px] origin-right bg-[#2a2620]" style={{ transform: "scaleX(1)" }} />
            {/* a cabeça */}
            <div ref={head} className="absolute bottom-0 left-0 h-[13px] w-px">
              <span className="absolute bottom-0 left-0 h-[13px] w-px bg-dc-hot" />
              <span className="absolute -left-[3px] bottom-[-2px] h-[7px] w-[7px] bg-dc-hot" />
              {!reduced && (full || pulse > 0) && (
                <span key={pulse} className={`absolute -left-[3px] bottom-[-2px] h-[7px] w-[7px] border border-dc-hot ${full ? "dc-ping" : "dc-ping-3"}`} />
              )}
            </div>
          </div>
          {phases && (
            <div aria-hidden className="mt-1.5 flex">
              {RULER.map((r, i) => (
                <span key={r.phase} className={`flex-1 dc-label !text-[9px] dk:!text-[10px] !tracking-[0.16em] ${cd.rail.mode === "phases" && cd.rail.current === i ? "text-dc-lava" : "text-dc-mist"} dc-halo`}>
                  {r.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ═══ o cartão de título (só na primeira visita da sessão) ══════════════════
// 0 a 500 ms o ponto laranja acende como pino; 500 a 1.400 o wordmark se revela
// do ponto para fora; segura até 1.900; 1.900 a 2.600 voa para a navegação
// (FLIP, só transform). Qualquer rolagem, toque ou tecla pula para o fim.
function TitleCard({ onDone }: { onDone: () => void }) {
  const box = useRef<HTMLDivElement>(null)
  const mark = useRef<HTMLImageElement>(null)
  const dot = useRef<HTMLSpanElement>(null)
  const ring = useRef<HTMLSpanElement>(null)
  const done = useRef(false)
  // ⚠️ o efeito do cartão roda UMA vez: o herói re-renderiza quando o dado chega,
  // e um `onDone` novo a cada render reiniciava o cartão do zero
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  const finish = useCallback((fast: boolean) => {
    if (done.current) return
    done.current = true
    const onDone = () => onDoneRef.current()
    const b = box.current
    if (!b) { onDone(); return }
    if (fast) {
      b.getAnimations({ subtree: true }).forEach((a) => a.cancel())
      b.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" }).onfinish = onDone
      return
    }
    // FLIP até o lugar do wordmark (desktop) ou do D· (celular) na navegação
    const target = document.getElementById("dc-nav-mark")?.getBoundingClientRect()
    const r = mark.current?.getBoundingClientRect()
    if (!target || !r || !mark.current) { onDone(); return }
    const desk = window.matchMedia("(min-width: 1024px)").matches
    const tw = desk ? target.width : target.height * WORDMARK_RATIO
    const s = tw / r.width
    const dx = target.left + (desk ? tw / 2 : target.width / 2) - (r.left + r.width / 2)
    const dy = target.top + target.height / 2 - (r.top + r.height / 2)
    const a = mark.current.animate(
      [{ transform: "translate(0,0) scale(1)", opacity: 1 }, { transform: `translate(${dx}px,${dy}px) scale(${s})`, opacity: desk ? 1 : 0 }],
      { duration: 700, easing: "cubic-bezier(0.65,0,0.35,1)", fill: "forwards" },
    )
    a.onfinish = () => {
      onDone()
      b.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: "forwards" })
    }
  }, [])

  useEffect(() => {
    const m = mark.current, d = dot.current, g = ring.current
    if (!m || !d || !g) return
    const ease = "cubic-bezier(0.16,1,0.3,1)"
    d.animate([{ transform: "scale(0)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], { duration: 380, easing: ease, fill: "forwards" })
    g.animate([{ transform: "scale(1)", opacity: 0.9 }, { transform: "scale(5)", opacity: 0 }], { duration: 900, delay: 80, easing: ease, fill: "forwards" })
    const l = WORDMARK_DOT.x * 100
    m.animate(
      [{ clipPath: `inset(0 ${100 - l}% 0 ${l}%)`, opacity: 1 }, { clipPath: "inset(0 0% 0 0%)", opacity: 1 }],
      { duration: 900, delay: 500, easing: ease, fill: "forwards" },
    )
    d.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, delay: 900, fill: "forwards" })
    const t = setTimeout(() => finish(false), 1900)
    const skip = () => finish(true)
    const opts = { passive: true, once: true } as AddEventListenerOptions
    window.addEventListener("wheel", skip, opts)
    window.addEventListener("touchstart", skip, opts)
    window.addEventListener("keydown", skip, { once: true })
    window.addEventListener("pointerdown", skip, opts)
    return () => {
      clearTimeout(t)
      window.removeEventListener("wheel", skip)
      window.removeEventListener("touchstart", skip)
      window.removeEventListener("keydown", skip)
      window.removeEventListener("pointerdown", skip)
    }
  }, [finish])

  return (
    <div ref={box} aria-hidden className="pointer-events-none absolute inset-x-0 top-[26%] dk:top-[21%] z-[4] flex -translate-y-1/2 justify-center">
      <div className="relative w-[min(78vw,640px)]" style={{ aspectRatio: `${WORDMARK_RATIO}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={mark}
          src={WORDMARK_SRC}
          alt=""
          className="absolute inset-0 h-full w-full"
          style={{ clipPath: `inset(0 ${100 - WORDMARK_DOT.x * 100}% 0 ${WORDMARK_DOT.x * 100}%)`, filter: "drop-shadow(0 2px 18px rgba(13,12,9,0.7))" }}
        />
        <span
          ref={dot}
          className="absolute rounded-full bg-dc-lava"
          style={{
            left: `${WORDMARK_DOT.x * 100}%`, top: `${WORDMARK_DOT.y * 100}%`,
            width: `${WORDMARK_DOT.r * 200}%`, aspectRatio: "1", translate: "-50% -50%", opacity: 0,
          }}
        />
        <span
          ref={ring}
          className="absolute rounded-full border border-dc-lava"
          style={{
            left: `${WORDMARK_DOT.x * 100}%`, top: `${WORDMARK_DOT.y * 100}%`,
            width: `${WORDMARK_DOT.r * 200}%`, aspectRatio: "1", translate: "-50% -50%", opacity: 0,
          }}
        />
      </div>
    </div>
  )
}

// ═══ o herói ═══════════════════════════════════════════════════════════════
export default function Hero({
  cd, intro, onIntroDone,
}: { cd: CountdownState; intro: boolean; onIntroDone: () => void }) {
  const reduced = useReduced()
  const [numberOn, setNumberOn] = useState(true)
  const [cardOn, setCardOn] = useState(false)

  // o cartão de título liga quando a raiz confirma a primeira visita (a marca
  // <html data-dc-intro> do script pré-hidratação). O número só aparece quando
  // começa a rolar (1.200 ms): "10,000,000 $DOG TO GO" parado seria falso.
  useEffect(() => {
    if (!intro || reduced) {
      setNumberOn(true)
      if (intro) onIntroDone()   // marcado mas parado: solta o wordmark e o trilho na hora
      return
    }
    setCardOn(true)
    setNumberOn(false)
    const t = setTimeout(() => setNumberOn(true), 1200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intro, reduced])

  const live = useRef<string>("")
  const [announce, setAnnounce] = useState("")
  useEffect(() => {
    // aria-live só na MUDANÇA DE ESTADO (A para B, B para C), nunca a cada minuto
    if (live.current && live.current !== cd.kind) setAnnounce(cd.label)
    live.current = cd.kind
  }, [cd.kind, cd.label])

  const isNum = cd.number != null && /^[\d,]+$/.test(cd.number)

  return (
    <section id="top" aria-labelledby="dc-hero-h1" className="relative h-[100svh] min-h-[600px] dk:min-h-[640px] overflow-hidden bg-dc-deep">
      {/* a âncora do anúncio de 04/09 (/dogcity#snapshot) cai no topo */}
      <span id="snapshot" className="absolute top-0" aria-hidden />

      {/* ── o pôster: o elemento LCP. Retrato pega o recorte em pé. ── */}
      <picture>
        <source media="(max-aspect-ratio: 1/1)" srcSet={POSTER.mobile.avif} type="image/avif" />
        <source media="(max-aspect-ratio: 1/1)" srcSet={POSTER.mobile.webp} type="image/webp" />
        <source srcSet={POSTER.desktop.avif} type="image/avif" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={POSTER.desktop.webp}
          alt={POSTER.isPlaceholder ? "The DogCity plan, centered on Satoshi Plaza" : "DogCity at night: the Earth over the honeycomb dome"}
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </picture>

      <Film reduced={reduced} />

      {/* vinheta, não placa: no máximo 55% de void-deep, de baixo até 45% da altura,
          e um véu curto no topo para a navegação */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-dc-deep/[0.55] via-dc-deep/[0.3] to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-dc-deep/[0.5] to-transparent" />

      {cardOn && <TitleCard onDone={() => { setCardOn(false); onIntroDone() }} />}

      {/* ── o bloco do contador (o visor): canto inferior esquerdo ── */}
      <div className="absolute inset-x-0 bottom-[calc(70px+env(safe-area-inset-bottom))] dk:bottom-[112px] z-[2]">
        <div className="mx-auto max-w-[calc(1360px+2*var(--dc-gutter))] px-[var(--dc-gutter)]">
          <div id="build" className="max-w-[min(100%,780px)] dc-halo scroll-mt-24">
            <p className="dc-label text-dc-lava">
              {intro && !reduced
                ? <ScrambleLater text={cd.label} delay={1200} />
                : cd.label}
            </p>

            {/* a linha do número e a da unidade existem sempre (invisíveis sem dado):
                o bloco é ancorado embaixo, então nada pula quando o fundo responde (CLS) */}
            <p
              className={`mt-2 dk:mt-3 font-cond font-semibold leading-[0.84] text-dc-snow transition-opacity duration-300 ${numberOn && cd.number != null ? "opacity-100" : "opacity-0"}`}
              aria-label={cd.number != null ? cd.aria : undefined}
              aria-hidden={cd.number == null}
              role="text"
            >
              <span className="block text-[88px] dk:text-[clamp(96px,15vw,224px)] tracking-[-0.01em]">
                {cd.number == null
                  ? <span className="invisible">0</span>
                  : isNum
                    ? (numberOn ? <Odometer text={cd.number} from={intro && cd.kind === "A" ? FUND_GOAL : undefined} duration={1400} /> : <span className="invisible">{cd.number}</span>)
                    : cd.number}
              </span>
            </p>
            <p className={`mt-2 dk:mt-3 font-mono text-[12px] dk:text-[14px] font-medium tracking-[0.22em] text-dc-snow ${cd.unit ? "" : "invisible"}`}>{cd.unit ?? "0"}</p>
            {cd.sub && <p className="mt-1.5 font-mono text-[11px] dk:text-[12px] tracking-[0.08em] text-dc-mist">{cd.sub}</p>}

            <h1 id="dc-hero-h1" className="mt-4 dk:mt-6 max-w-[36ch] font-body font-medium text-[18px] leading-[26px] dk:text-[26px] dk:leading-[34px] text-dc-snow">
              {cd.h1}
            </h1>

            <div className="mt-5 dk:mt-7 flex max-w-[440px] dk:max-w-none flex-col dk:flex-row dk:items-center gap-3 dk:gap-4">
              <Btn href={cd.primary.href} className="w-full dk:w-auto">{cd.primary.label}</Btn>
              <Btn href={cd.secondary.href} variant="line" className="hidden dk:inline-flex">{cd.secondary.label}</Btn>
              <TextLink href={cd.secondary.href} className="dk:hidden self-center font-mono text-[12px] tracking-[0.16em] uppercase text-dc-snow">
                {cd.secondary.label}
              </TextLink>
            </div>

            {cd.founderLine && (
              <p className="mt-4 dk:mt-5 max-w-[60ch] font-mono text-[10px] dk:text-[11px] leading-[1.6] tracking-[0.04em] text-dc-mist">
                <a href="/dogcity/founders" className="dc-link dc-link-quiet hover:text-dc-snow">
                  Contribute before the fund is full and you are a Founder: you mint your own lot free, paying only the network fee.
                </a>
              </p>
            )}
          </div>
        </div>
      </div>

      <Rail cd={cd} intro={intro} reduced={reduced} />

      <p className="sr-only" aria-live="polite">{announce}</p>
    </section>
  )
}

/** o scramble curto do rótulo, por MONTAGEM (a faixa morta de motion.tsx não deixa
 *  o Scramble de lá rodar acima da dobra), a partir de 1.200 ms do cartão de título */
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#*+="
function ScrambleLater({ text, delay }: { text: string; delay: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0, frame = 0, last = 0, t0 = 0
    const total = text.length + 6
    const tick = (t: number) => {
      if (!t0) t0 = t + delay
      if (t >= t0 && t - last >= 28) {
        last = t
        const settled = frame
        el.textContent = text.split("").map((ch, i) =>
          ch === " " || ch === "·" || i < settled ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0]).join("")
        frame++
      }
      if (frame <= total) raf = requestAnimationFrame(tick)
      else el.textContent = text
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); el.textContent = text }
  }, [text, delay])
  return <span ref={ref} aria-label={text}>{text}</span>
}
