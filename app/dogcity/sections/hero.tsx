"use client"

// ═══════════════════════════════════════════════════════════════════════════
// 0 · HERÓI, "LAUNCH NIGHT" (brief landing v3 §4.1, §5, §6, §10): AS CAMADAS.
//
// Desde a rodada de correção de 18/10 o herói não é mais uma seção sozinha: ele
// é o começo de UM palco preso (./opening.tsx) que segue pela passagem "Into the
// plaza" até a busca, sem costura. Este arquivo entrega as camadas que o palco
// monta: o pôster (o LCP), o filme (vídeo na camada de mídia, legenda e pausa no
// visor), o visor do contador (#build), o trilho e o cartão de título.
//
// ⚠️ NADA DAQUI USA OS PRIMITIVOS DE REVELAÇÃO DE ../motion.tsx (faixa morta acima
// da dobra). A entrada da primeira visita é CSS sob html[data-dc-intro], ancorada
// na primeira pintura (landing.css); o JS só acrescenta odômetro e scramble se a
// página hidratou a tempo.
//
// ⚠️ SEM FILME AINDA: o pôster é a carta da cidade centrada na Satoshi Plaza,
// escurecida; legenda de take e pausa só existem quando o filme existe.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { Btn, Odometer, TextLink, WORDMARK_DOT, WORDMARK_RATIO, WORDMARK_SRC } from "../landing/ui"
import { HERO_FILM, POSTER } from "../landing/media"
import { FUND_GOAL, RULER, type CountdownState } from "../landing/mint-state"

// ── a escolha do filme: retrato pega o encode 9:16, nunca recorte do 16:9 ──
type Src = { webm?: string; mp4?: string }
type Cut = { t: number; place: string }
function pickFilm(): { intro: Src | null; loop: Src; cuts: Cut[] } {
  const portrait = window.matchMedia("(max-aspect-ratio: 1/1)").matches
  return portrait
    ? { intro: HERO_FILM.intro.mobile, loop: HERO_FILM.mobile, cuts: HERO_FILM.cuts.mobile }
    : { intro: HERO_FILM.intro.desktop, loop: HERO_FILM.desktop, cuts: HERO_FILM.cuts.desktop }
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

// ═══ o pôster (o elemento LCP) ═════════════════════════════════════════════
export function HeroPoster() {
  return (
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
  )
}

// ═══ o filme ═══════════════════════════════════════════════════════════════
// Devolve DUAS peças: o filme (vai na camada de mídia do palco) e os controles
// (legenda do take e pausa, vão no visor e somem com ele). `active` falso pausa o
// filme (o palco já passou para a carta) sem contar como pausa da pessoa.
//
// Brief §6: T1 (a Terra sobre o domo) abre SÓ a primeira reprodução; quando ele
// acaba, o laço T2 a T6 entra por cima e fica. São dois <video>: o laço aquece
// enquanto T1 roda e só aparece no primeiro quadro tocado, então a troca não
// pisca (o último quadro de T1 fica embaixo até lá).
export function useFilm({ reduced, active }: { reduced: boolean; active: boolean }): { video: ReactNode; controls: ReactNode } {
  const introRef = useRef<HTMLVideoElement>(null)
  const loopRef = useRef<HTMLVideoElement>(null)
  const [src, setSrc] = useState<{ intro: Src | null; loop: Src; cuts: Cut[] } | null>(null)
  const [phase, setPhase] = useState<"intro" | "loop">("intro")
  const [warm, setWarm] = useState(false)
  const [shown, setShown] = useState<"none" | "intro" | "loop">("none")
  const [paused, setPaused] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const userPaused = useRef(false)
  const [take, setTake] = useState<number | null>(null)
  const [blink, setBlink] = useState(0)
  const onTake = useCallback((i: number) => { setTake(i); setBlink((b) => b + 1) }, [])

  const start = useCallback(() => {
    const f = pickFilm()
    setPhase(f.intro ? "intro" : "loop")
    setWarm(!f.intro)
    setSrc(f)
  }, [])

  // entra depois da primeira pintura, e só se pode. O `reduced` chega depois da
  // hidratação (começa falso): a espera do idle é cancelada se ele virar verdadeiro,
  // senão o filme montava e baixava 2 MB com o movimento reduzido ligado
  useEffect(() => {
    if (!HERO_FILM.exists) return
    if (reduced || !filmAllowed()) { setBlocked(true); setSrc(null); return }
    let alive = true
    idle(() => { if (alive) start() })
    return () => { alive = false }
  }, [reduced, start])

  const play = useCallback(() => {
    const v = phase === "intro" ? introRef.current : loopRef.current
    if (!v) return
    const p = v.play()
    if (p && typeof p.then === "function") {
      p.then(() => { setPaused(false); setBlocked(false) })
        .catch(() => { setBlocked(true); setPaused(true) })   // modo de economia do iPhone: fica o pôster
    }
  }, [phase])

  // toca enquanto o palco é o herói e a aba está visível; a pausa da pessoa manda
  useEffect(() => {
    const v = phase === "intro" ? introRef.current : loopRef.current
    if (!v || !src) return
    const sync = () => {
      if (!active || document.hidden) v.pause()
      else if (!userPaused.current) play()
    }
    sync()
    document.addEventListener("visibilitychange", sync)
    return () => document.removeEventListener("visibilitychange", sync)
  }, [src, active, play, phase])

  // T1: aquece o laço na metade, e passa a vez quando acaba
  useEffect(() => {
    const v = introRef.current
    if (!v || !src?.intro || phase !== "intro") return
    const on = () => { if (v.duration && v.currentTime > v.duration * 0.4) setWarm(true) }
    const end = () => { setWarm(true); setPhase("loop") }
    v.addEventListener("timeupdate", on)
    v.addEventListener("ended", end)
    return () => { v.removeEventListener("timeupdate", on); v.removeEventListener("ended", end) }
  }, [src, phase])

  // a legenda do take segue os cortes do laço
  useEffect(() => {
    const v = loopRef.current
    const cuts = src?.cuts ?? []
    if (!v || !cuts.length || phase !== "loop") return
    let last = -1
    const on = () => {
      const t = v.currentTime
      let i = 0
      for (let k = 0; k < cuts.length; k++) if (t >= cuts[k].t) i = k
      if (i !== last) { last = i; onTake(i) }
    }
    v.addEventListener("timeupdate", on)
    return () => v.removeEventListener("timeupdate", on)
  }, [src, phase, onTake])

  if (!HERO_FILM.exists) return { video: null, controls: null }
  const toggle = () => {
    if (!src) { userPaused.current = false; start(); return }
    const v = phase === "intro" ? introRef.current : loopRef.current
    if (!v) return
    if (v.paused) { userPaused.current = false; play() }
    else { userPaused.current = true; v.pause(); setPaused(true) }
  }
  const showPlay = blocked || paused || !src
  const cuts = src?.cuts ?? []
  const cut = phase === "loop" && take != null ? cuts[take] ?? null : null
  const playing = (which: "intro" | "loop") => () => {
    setShown((s) => (s === "loop" ? s : which))
    window.dispatchEvent(new Event("dc:film-playing"))
  }
  const cls = (on: boolean) => `absolute inset-0 h-full w-full object-cover transition-opacity duration-[600ms] ${on ? "opacity-100" : "opacity-0"}`

  const video = src ? (
    <>
      {src.intro && shown !== "loop" && (
        <video ref={introRef} muted playsInline preload="auto" aria-hidden onPlaying={playing("intro")} className={cls(shown === "intro")}>
          {src.intro.webm && <source src={src.intro.webm} type='video/webm; codecs="av01.0.08M.08"' />}
          {src.intro.mp4 && <source src={src.intro.mp4} type="video/mp4" />}
        </video>
      )}
      {warm && (
        <video ref={loopRef} muted playsInline loop preload="auto" aria-hidden onPlaying={playing("loop")} className={cls(shown === "loop")}>
          {src.loop.webm && <source src={src.loop.webm} type='video/webm; codecs="av01.0.08M.08"' />}
          {src.loop.mp4 && <source src={src.loop.mp4} type="video/mp4" />}
        </video>
      )}
    </>
  ) : null

  // a legenda do take e a pausa: canto inferior direito (topo direito no celular).
  // WCAG 2.2.2: o laço passa de 5 s, então o controle de pausa é visível.
  const caption = phase === "intro" && src?.intro
    ? HERO_FILM.introPlace
    : cut ? `${String((take ?? 0) + 1).padStart(2, "0")} / ${String(cuts.length).padStart(2, "0")} · ${cut.place}` : null
  const controls = (
    // largura fixa e filhos esticados: o rótulo muda ("Play film", "Pause", a legenda de
    // cada take) sem mover caixa nenhuma (CLS)
    <div className="dc-visor dc-in-film absolute right-[var(--dc-gutter)] top-[64px] dk:top-auto dk:bottom-[112px] pointer-events-none z-[3] flex w-[min(72vw,360px)] flex-col items-stretch gap-1 text-right">
      {/* a linha da legenda existe sempre (vazia até o filme tocar): sem ela, a pausa
          descia uma linha quando a legenda entrava (CLS) */}
      <p
        key={`${phase}-${blink}`}
        aria-hidden={!caption || shown === "none"}
        className={`dc-label min-h-[1.5em] whitespace-nowrap text-dc-snow dc-halo ${caption && shown !== "none" ? (reduced ? "" : "dc-blink") : "invisible"}`}
      >
        {caption && shown !== "none" ? caption : "\u00a0"}
      </p>
      <button
        type="button"
        onClick={toggle}
        className="dc-label !text-[11px] text-dc-snow dc-halo pointer-events-auto inline-flex items-center justify-end gap-2 h-9 self-end w-[9.5rem]"
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
  )
  return { video, controls }
}

// ═══ o trilho (fundo ou régua das fases) ═══════════════════════════════════
// UM valor move cabeça, mortalha e leitura (a mecânica de construction-fund.tsx),
// só transform. O valor é a variável CSS --dc-f (0 a 1), então o trilho sai CERTO
// já no HTML do servidor, sem medir pixel: a mortalha escala por calc(1 - f), a
// cabeça anda f * 100% da largura e a leitura recua f * 100% da própria largura.
// Na primeira visita o desenho e o enchimento são keyframes de CSS (landing.css).
// Na saída do herói o trilho inteiro voa até a pílula da navegação: quem move é o
// palco (./opening.tsx), pelas variáveis --dc-rail-* no invólucro `.dc-rail-fly`.
//
// SEM DADO (connecting): só o trilho, sem cabeça e sem mortalha, e a leitura
// "CONNECTING"; passados 12 s sem dado, a leitura some (nada de prometer conexão).
export function Rail({ cd, reduced }: { cd: CountdownState; reduced: boolean }) {
  const connecting = cd.rail.mode === "connecting"
  const f = connecting ? 0 : (cd.rail as { fraction: number }).fraction
  const last = useRef<number | null>(null)
  const [pulse, setPulse] = useState(0)
  const [stale, setStale] = useState(false)
  useEffect(() => {
    // o número mudou ao vivo: a cabeça dá um pulso (o sv-ping de construction-fund.tsx)
    if (last.current != null && Math.abs(last.current - f) > 1e-6) setPulse((p) => p + 1)
    last.current = f
  }, [f])
  useEffect(() => {
    if (!connecting) { setStale(false); return }
    const t = setTimeout(() => setStale(true), 12_000)
    return () => clearTimeout(t)
  }, [connecting])

  const phases = cd.rail.mode === "phases"
  const full = cd.rail.mode === "fund" && cd.rail.full
  return (
    <div className="dc-rail-fly absolute inset-x-0 bottom-0 z-[3] pb-[max(14px,env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-[calc(1360px+2*var(--dc-gutter))] px-[var(--dc-gutter)]">
        <div data-dc-rail className="relative" style={{ "--dc-f": String(f) } as CSSProperties}>
          {/* leitura presa à cabeça */}
          <div className="dc-rail-read relative h-5 mb-1.5">
            <div className="dc-rail-move absolute inset-x-0 top-0">
              <div className="dc-rail-readout inline-block whitespace-nowrap font-mono text-[11px] dk:text-[12px] tracking-[0.08em] text-dc-snow dc-halo tabular-nums">
                {connecting && !stale && <span className="text-dc-mist tracking-[0.2em]">CONNECTING</span>}
                {cd.rail.mode === "fund" && cd.rail.readout}
                {/* P8 (resíduo): no celular o "BLOCK n" colava no FIND YOUR LOT; lá a régua das fases basta */}
                {cd.rail.mode === "phases" && <span className="hidden dk:inline text-dc-hot">{cd.rail.readout}</span>}
              </div>
            </div>
          </div>
          {/* graduação + trilho de 3 px (.dc-rail-draw: o recorte do desenho) */}
          <div className="dc-rail-draw relative h-[13px]">
            <div className="dc-ruler absolute inset-x-0 top-0 h-[9px] opacity-80" />
            {phases && (
              <div aria-hidden className="absolute inset-0 flex">
                {RULER.map((r, i) => (
                  <span key={r.phase} className={`flex-1 ${i ? "border-l border-dc-snow/[0.5]" : ""}`} />
                ))}
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 h-[3px] bg-dc-snow/[0.16]" />
            {!connecting && (
              <>
                <div className="absolute inset-x-0 bottom-0 h-[3px] bg-gradient-to-r from-[#B4501C] via-dc-lava to-dc-hot" />
                {/* mortalha: cobre o que ainda não encheu (escala a partir da direita) */}
                <div className="dc-rail-shroud absolute inset-x-0 bottom-0 h-[3px] origin-right bg-[#2a2620]" />
                {/* a cabeça */}
                <div className="dc-rail-move absolute inset-0">
                  <span className="absolute bottom-0 left-0 h-[13px] w-px bg-dc-hot" />
                  <span className="absolute -left-[3px] bottom-[-2px] h-[7px] w-[7px] bg-dc-hot" />
                  {!reduced && (full || pulse > 0) && (
                    <span key={pulse} className={`absolute -left-[3px] bottom-[-2px] h-[7px] w-[7px] border border-dc-hot ${full ? "dc-ping" : "dc-ping-3"}`} />
                  )}
                </div>
              </>
            )}
          </div>
          {phases && (
            <div aria-hidden className="dc-rail-read mt-1.5 flex">
              {RULER.map((r, i) => (
                <span key={r.phase} className={`flex-1 dc-label !text-[9px] dk:!text-[10px] !tracking-[0.12em] ${cd.rail.mode === "phases" && cd.rail.current === i ? "text-dc-hot" : "text-dc-mist"} dc-halo`}>
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
// 0 a 500 ms o ponto laranja acende como pino (a Satoshi Plaza); 500 a 1.400 o
// wordmark se revela do ponto para fora; segura até 1.900; 1.900 a 2.600 voa para o
// lugar dele na navegação (só transform). TUDO em keyframes de CSS sob
// html[data-dc-intro] (landing.css): o relógio é a primeira pintura.
export function TitleCard() {
  const at = { left: `${WORDMARK_DOT.x * 100}%`, top: `${WORDMARK_DOT.y * 100}%`, width: `${WORDMARK_DOT.r * 200}%` }
  return (
    <div aria-hidden className="dc-tc pointer-events-none absolute inset-x-0 top-[26%] dk:top-[21%] z-[4] -translate-y-1/2 justify-center">
      {/* P-f: a sombra mora no invólucro, sobre o resultado JÁ recortado pela máscara do
          wordmark; na própria imagem o clip-path cortava a sombra num retângulo escuro */}
      <div className="relative w-[min(78vw,640px)]" style={{ aspectRatio: `${WORDMARK_RATIO}`, filter: "drop-shadow(0 2px 18px rgba(13,12,9,0.7))" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={WORDMARK_SRC}
          alt=""
          fetchPriority="high"
          className="dc-tc-mark absolute inset-0 h-full w-full"
        />
        <span className="dc-tc-dot absolute rounded-full bg-dc-lava" style={{ ...at, aspectRatio: "1", translate: "-50% -50%" }} />
        <span className="dc-tc-ring absolute rounded-full border border-dc-lava" style={{ ...at, aspectRatio: "1", translate: "-50% -50%" }} />
      </div>
    </div>
  )
}

// ═══ o visor do contador (#build): canto inferior esquerdo ═════════════════
// Texto direto sobre a imagem, sem caixa, legível por halo. Na primeira visita
// cada peça se monta por máscara depois do cartão (landing.css, B7): rótulo e
// número 1.200 ms, unidade 1.500, H1 1.650, botões 1.800, linha do Founder 1.950.
// O tamanho do número segue a QUANTIDADE de caracteres (--dc-n): "10,000,250" no
// celular de 360 px cabe, e o odômetro que rola de 10,000,000 nunca corta.
export function HeroVisor({
  cd, intro, onIntroDone, reduced,
}: { cd: CountdownState; intro: boolean; onIntroDone: () => void; reduced: boolean }) {
  const [roll, setRoll] = useState(false)
  const [early, setEarly] = useState<number | null>(null)
  useEffect(() => {
    if (!intro) return
    const html = document.documentElement
    const end = () => { html.removeAttribute("data-dc-intro"); onIntroDone() }
    if (reduced) { end(); return }
    const now = performance.now()
    let tRoll: ReturnType<typeof setTimeout> | undefined
    if (now < 1100) {
      setEarly(Math.max(0, 1200 - now))
      tRoll = setTimeout(() => setRoll(true), Math.max(0, 1200 - now))
    }
    const tEnd = setTimeout(end, Math.max(0, 3000 - now))
    const skip = () => { clearTimeout(tEnd); end() }
    const opts = { passive: true, once: true } as AddEventListenerOptions
    window.addEventListener("wheel", skip, opts)
    window.addEventListener("touchstart", skip, opts)
    window.addEventListener("keydown", skip, { once: true })
    window.addEventListener("pointerdown", skip, opts)
    return () => {
      clearTimeout(tRoll); clearTimeout(tEnd)
      window.removeEventListener("wheel", skip)
      window.removeEventListener("touchstart", skip)
      window.removeEventListener("keydown", skip)
      window.removeEventListener("pointerdown", skip)
    }
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
  const rolling = roll && cd.kind === "A"
  // a caixa tem o tamanho do número FINAL; durante a rolagem (que parte do objetivo,
  // 10 caracteres) só o texto encolhe por dentro, ancorado embaixo: nada pula (CLS)
  const nFinal = cd.number?.length ?? 7
  const n = Math.max(nFinal, rolling ? FUND_GOAL.toLocaleString("en-US").length : 0)
  const sizeCls = HERO_FILM.exists ? "dc-num-size-film" : "dc-num-size"

  return (
    <div className="dc-visor pointer-events-none absolute inset-x-0 bottom-[calc(70px+env(safe-area-inset-bottom))] dk:bottom-[112px] z-[2]">
      <div className="mx-auto max-w-[calc(1360px+2*var(--dc-gutter))] px-[var(--dc-gutter)]">
        <div id="build" className="pointer-events-auto max-w-[min(100%,780px)] dc-halo scroll-mt-24">
          <p className="dc-in-label dc-label text-dc-hot">
            {early != null ? <ScrambleLater text={cd.label} delay={early} /> : cd.label}
          </p>

          {/* a linha do número e a da unidade existem sempre (invisíveis sem dado):
              o bloco é ancorado embaixo, então nada pula quando o fundo responde (CLS) */}
          <p
            className={`dc-hero-number mt-2 dk:mt-3 font-cond font-semibold leading-[0.84] text-dc-snow ${cd.number != null ? "opacity-100" : "opacity-0"} ${cd.kind === "connecting" ? "hidden" : ""}`}
            aria-hidden
          >
            <span
              className={`flex h-[0.84em] items-end tracking-[-0.01em] ${sizeCls}`}
              style={{ "--dc-n": String(nFinal) } as CSSProperties}
            >
              <span className={`block whitespace-nowrap ${sizeCls}`} style={{ "--dc-n": String(n) } as CSSProperties}>
                {cd.number == null
                  ? <span className="invisible">0</span>
                  : isNum
                    ? <Odometer key={rolling ? "roll" : "still"} text={cd.number} from={rolling ? FUND_GOAL : undefined} duration={1400} />
                    : cd.number}
              </span>
            </span>
          </p>
          <p aria-hidden className={`dc-in-unit mt-2 dk:mt-3 font-mono text-[12px] dk:text-[14px] font-medium tracking-[0.22em] text-dc-snow ${cd.unit ? "" : "invisible"}`}>{cd.unit ?? "0"}</p>
          {/* para leitor de tela: a frase inteira, não o odômetro (brief §11) */}
          {cd.number != null && <p className="sr-only">{cd.aria}</p>}
          {cd.sub && <p className="dc-in-unit mt-1.5 font-mono text-[11px] dk:text-[12px] tracking-[0.08em] text-dc-snow/[0.78]">{cd.sub}</p>}

          <h1 id="dc-hero-h1" className="dc-in-h1 dc-balance mt-4 dk:mt-6 max-w-[36ch] dk:max-w-[46ch] font-body font-medium text-[18px] leading-[26px] dk:text-[26px] dk:leading-[34px] text-dc-snow">
            {cd.h1}
          </h1>

          <div className="dc-in-btns mt-5 dk:mt-7 flex max-w-[440px] dk:max-w-none flex-col dk:flex-row dk:items-center gap-3 dk:gap-4">
            <Btn href={cd.primary.href} className="w-full dk:w-auto">{cd.primary.label}</Btn>
            <Btn href={cd.secondary.href} variant="line" className="hidden dk:inline-flex">{cd.secondary.label}</Btn>
            <TextLink href={cd.secondary.href} className="dk:hidden self-center font-mono text-[12px] tracking-[0.16em] uppercase text-dc-snow">
              {cd.secondary.label}
            </TextLink>
          </div>

          {cd.founderLine && (
            <p className="dc-in-founder mt-4 dk:mt-5 max-w-[60ch] font-mono text-[10px] dk:text-[11px] leading-[1.6] tracking-[0.04em] text-dc-snow/[0.72]">
              <a href="/dogcity/founders" className="dc-link dc-link-quiet hover:text-dc-snow">
                Contribute before the fund is full and you are a Founder: you mint your own lot free, paying only the network fee and postage.
              </a>
            </p>
          )}
        </div>
      </div>
      <p className="sr-only" aria-live="polite">{announce}</p>
    </div>
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
