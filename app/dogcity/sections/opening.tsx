"use client"

// ═══════════════════════════════════════════════════════════════════════════
// A ABERTURA: HERÓI + "INTO THE PLAZA" + FIND YOUR LOT NUM PALCO SÓ (P1 da
// rodada de correção de 18/10; brief §4.1, §4.3, §8).
//
// UM palco preso (sticky, 100svh) e UM laço de rAF. O conteúdo rola por cima:
// primeiro 240 svh de passagem (o herói + a subida), depois a busca. Não há
// costura entre o herói e a carta porque são a MESMA tela.
//
//   p (0 a 1, ao longo da passagem):
//     0    a 0,25   o visor (contador, legenda, pausa) some subindo 24 px
//     0,10 a 0,35   o trilho faz FLIP até a pílula viva da navegação
//     0,20 a 0,85   os quadros da T8 em canvas; sem T8, o pôster se funde na carta
//                   e a câmera sobe da Satoshi Plaza até a cidade inteira
//     0,85 a 1      a fusão termina na carta
//     0,35+         a pílula viva aparece na navegação
//     0,90+         a navegação vira faixa sólida
//   q (0 a 1): o texto da busca entra e a cidade abre espaço para ele
//
// Com movimento reduzido nada interpola: o herói fica parado até a metade da
// passagem e então a carta entra numa fusão simples de 400 ms (brief §8).
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react"
import { useReduced } from "../landing/ui"
import { HERO_FILM, T8 } from "../landing/media"
import type { CountdownState } from "../landing/mint-state"
import { HeroPoster, HeroVisor, Rail, TitleCard, useFilm } from "./hero"
import {
  LookupContent, MapBoard, easeInOut, easeOut, easePin, lerpCam, lotCam, overviewCam, posterCam, t8EndCam,
  type Cam, type MapApi,
} from "./find-your-lot"

export interface ChromeState { live: boolean; solid: boolean; quiet: boolean }

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const HAS_T8 = !!(T8.desktop || T8.mobile)

export default function Opening({
  cd, intro, onIntroDone, onChrome,
}: {
  cd: CountdownState
  intro: boolean
  onIntroDone: () => void
  onChrome: (c: ChromeState) => void
}) {
  const reduced = useReduced()
  const wrap = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const passage = useRef<HTMLDivElement>(null)
  const t8 = useRef<HTMLCanvasElement>(null)
  const map = useRef<MapApi | null>(null)
  const [pin, setPin] = useState<[number, number] | null>(null)
  const [searching, setSearching] = useState(false)
  const [filmActive, setFilmActive] = useState(true)
  const film = useFilm({ reduced, active: filmActive })

  const pinRef = useRef(pin)
  const tween = useRef<{ from: Cam; to: Cam; t0: number; dur: number } | null>(null)
  const chrome = useRef<ChromeState>({ live: false, solid: false, quiet: false })
  const onChromeRef = useRef(onChrome)
  onChromeRef.current = onChrome

  // o pino chegou: a câmera vai até o lote (tween de 1,3 s, ou direto sem movimento)
  useEffect(() => {
    pinRef.current = pin
    const st = stage.current, m = map.current
    if (!pin || !st || !m) return
    const to = lotCam(st.clientWidth, st.clientHeight, pin[0], pin[1])
    const from = m.cam()
    if (reduced || !from) { m.apply(to); return }
    tween.current = { from, to, t0: performance.now(), dur: 1300 }
  }, [pin, reduced])

  // ── o laço ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const st = stage.current, ps = passage.current, wr = wrap.current
    if (!st || !ps || !wr) return
    let raf = 0
    let lastKey = ""
    let railBox: DOMRect | null = null
    const railEl = st.querySelector<HTMLElement>(".dc-rail-fly")
    const visors = () => Array.from(st.querySelectorAll<HTMLElement>(".dc-visor"))
    let visorInert = false
    let filmOn = true

    const setVar = (k: string, v: string) => st.style.setProperty(k, v)
    const report = (next: ChromeState) => {
      const c = chrome.current
      if (c.live !== next.live || c.solid !== next.solid || c.quiet !== next.quiet) {
        chrome.current = next
        onChromeRef.current(next)
      }
    }

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame)
      const vw = st.clientWidth, vh = st.clientHeight
      const r = ps.getBoundingClientRect()
      const span = Math.max(1, r.height - vh)
      const p = clamp01(-r.top / span)
      const look = document.getElementById("lookup")?.getBoundingClientRect()
      const q = look ? clamp01((vh - look.top) / (vh * 0.6)) : 0
      const quiet = !!look && look.top < vh * 0.6 && look.bottom > vh * 0.35

      // a navegação: pílula viva depois do voo do trilho, faixa sólida no fim
      report({ live: p >= 0.35, solid: p >= 0.9, quiet })

      // o filme só toca enquanto o palco é o herói (e durante a fusão para a T8)
      const on = p < 0.3
      if (on !== filmOn) { filmOn = on; setFilmActive(on) }

      const m = map.current
      // a câmera: tween até o lote > pose do lote > passagem
      const tw = tween.current
      if (m && tw) {
        const k = Math.min(1, (t - tw.t0) / tw.dur)
        m.apply(lerpCam(tw.from, tw.to, easeOut(k)))
        if (k >= 1) tween.current = null
      }

      const key = `${p.toFixed(4)}|${q.toFixed(4)}|${vw}x${vh}|${pinRef.current ? "pin" : ""}|${m ? 1 : 0}`
      if (key === lastKey && !tw) return
      lastKey = key

      if (reduced) {
        // sem movimento: dois estados, fusão de 400 ms pela transição de CSS
        const hero = p < 0.5
        setVar("--dc-vis", hero ? "1" : "0")
        setVar("--dc-vis-y", "0px")
        setVar("--dc-media", hero ? "1" : "0")
        setVar("--dc-rail-o", hero ? "1" : "0")
        setVar("--dc-read-o", hero ? "1" : "0")
        setVar("--dc-veil", String(q))
        if (m && !tw && !pinRef.current) m.apply(overviewCam(vw, vh, 1))
        else if (m && !tw && pinRef.current) m.apply(lotCam(vw, vh, pinRef.current[0], pinRef.current[1]))
      } else {
        // o visor some subindo (0 a 0,25)
        const v = clamp01(p / 0.25)
        setVar("--dc-vis", String(1 - v))
        setVar("--dc-vis-y", `${(-24 * easeOut(v)).toFixed(2)}px`)

        // o trilho voa até a pílula da navegação (0,10 a 0,35). P-a: a leitura e os nomes das
        // fases somem ANTES do voo (0,04 a 0,10); a barra encolhe com escala UNIFORME até a
        // largura da pílula, centrada nela, e some até f 0,3 (o resto do voo é invisível)
        setVar("--dc-read-o", String(1 - clamp01((p - 0.04) / 0.06)))
        if (railEl) {
          if (!railBox) {
            // a caixa natural do trilho, medida sem transformação (uma vez por tamanho de tela)
            railEl.style.transform = ""
            railBox = railEl.getBoundingClientRect()
          }
          const f = easePin(clamp01((p - 0.1) / 0.25))
          const pill = document.querySelector<HTMLElement>("[data-dc-pill]")?.getBoundingClientRect()
          if (pill && pill.width > 0 && railBox && f > 0) {
            const sEnd = pill.width / railBox.width
            const sc = 1 + (sEnd - 1) * f
            const dx = (pill.left - railBox.left) * f
            const dy = (pill.top + pill.height / 2 - railBox.height * sEnd / 2 - railBox.top) * f
            railEl.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) scale(${sc.toFixed(4)})`
          } else {
            railEl.style.transform = ""
          }
          setVar("--dc-rail-o", String(Math.max(0, 1 - f / 0.3)))
        }

        // o pôster/filme se funde na carta (sem T8) ou cede para a T8
        // P-a: com T8, fusão longa do filme para o 1º quadro da T8 (0,12 a 0,30). A T8 fica
        // POR CIMA do filme e é ela que sobe; o filme só sai depois que ela cobriu tudo (assim a
        // carta, embaixo de todos, não vaza no meio da fusão)
        const mediaO = HAS_T8 ? 1 - clamp01((p - 0.3) / 0.02) : 1 - clamp01((p - 0.2) / 0.15)
        setVar("--dc-media", mediaO.toFixed(3))
        setVar("--dc-veil", String(q))

        // a T8: o 1º quadro já opaco por baixo do filme (0,10), os quadros de 0,20 a
        // 0,85, e a fusão na carta de 0,85 a 0,95, na MESMA pose (t8EndCam)
        const c = t8.current
        let t8on = false
        if (HAS_T8 && c && m) {
          const k = clamp01((p - 0.2) / 0.65)
          t8on = m.drawT8(c, k) && p >= 0.1
          const o = !t8on ? 0 : p < 0.85 ? clamp01((p - 0.12) / 0.18) : Math.max(0, 1 - (p - 0.85) / 0.1)
          c.style.opacity = o.toFixed(3)
        }

        // a câmera da carta
        if (m && !tw) {
          if (pinRef.current) m.apply(lotCam(vw, vh, pinRef.current[0], pinRef.current[1]))
          else if (HAS_T8 && t8on) {
            // parada na pose do último quadro até a fusão, depois abre para a cidade inteira
            const z = easeInOut(clamp01((p - 0.88) / 0.12))
            m.apply(lerpCam(t8EndCam(vw, vh), overviewCam(vw, vh, easeInOut(q)), z))
          }
          else if (HAS_T8) m.apply(overviewCam(vw, vh, easeInOut(q)))
          else {
            const z = easePin(clamp01((p - 0.22) / 0.63))
            m.apply(lerpCam(posterCam(vw, vh), overviewCam(vw, vh, easeInOut(q)), z))
          }
        }
      }

      // o visor some de verdade quando some de vista (foco e leitor de tela)
      const gone = reduced ? p >= 0.5 : p >= 0.25
      if (gone !== visorInert) {
        visorInert = gone
        for (const el of visors()) {
          if (gone) el.setAttribute("inert", "")
          else el.removeAttribute("inert")
        }
      }
    }

    // o laço só roda enquanto a abertura está na tela
    let running = false
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !running) { running = true; lastKey = ""; raf = requestAnimationFrame(frame) }
      else if (!e.isIntersecting && running) {
        running = false
        cancelAnimationFrame(raf)
        report({ live: true, solid: true, quiet: false })   // passou da abertura: navegação sólida
      }
    }, { threshold: 0 })
    io.observe(wr)
    const onResize = () => { railBox = null; lastKey = "" }
    window.addEventListener("resize", onResize)
    return () => { io.disconnect(); cancelAnimationFrame(raf); window.removeEventListener("resize", onResize) }
  }, [reduced])

  const onPin = useCallback((v: [number, number] | null) => setPin(v), [])

  return (
    <div id="top" ref={wrap} className="relative">
      {/* a âncora do anúncio de 04/09 (/dogcity#snapshot) cai no topo */}
      <span id="snapshot" className="absolute top-0" aria-hidden />

      {/* ═══ o palco ═══ */}
      <div
        ref={stage}
        className={`dc-stage sticky top-0 h-[100svh] min-h-[560px] w-full overflow-hidden bg-dc-deep ${reduced ? "dc-stage-still" : ""}`}
      >
        {/* a carta (por baixo de tudo) */}
        <div aria-hidden className="absolute inset-0">
          <MapBoard pin={pin} searching={searching} reduced={reduced} api={map} stage={stage} />
          {/* a vinheta da busca: escurece o lado do texto, não é placa */}
          <div className="dc-veil pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-dc-deep/[0.35] to-dc-deep/[0.9] dk:bg-gradient-to-r dk:from-dc-deep/[0.88] dk:via-dc-deep/[0.45] dk:to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-dc-void to-transparent" />
          </div>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-dc-deep/[0.6] to-transparent" />
        </div>

        {/* o pôster e o filme, com a vinheta do herói */}
        <div className="dc-media absolute inset-0">
          <HeroPoster />
          {film.video}
          {/* vinheta, não placa: no máximo 55% de void-deep, de baixo até 45% da altura
              (62% e 70% no celular quando houver filme), e um véu curto no topo */}
          <div aria-hidden className={`pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t via-dc-deep/[0.3] to-transparent ${HERO_FILM.exists ? "h-[62%] from-dc-deep/[0.7] dk:h-[45%] dk:from-dc-deep/[0.55]" : "h-[45%] from-dc-deep/[0.55]"}`} />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-dc-deep/[0.5] to-transparent" />
        </div>

        {/* a T8 por cima, quando existir */}
        {HAS_T8 && <canvas ref={t8} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full opacity-0" />}

        <TitleCard />
        <HeroVisor cd={cd} intro={intro} onIntroDone={onIntroDone} reduced={reduced} />
        {film.controls}
        <Rail cd={cd} reduced={reduced} />
      </div>

      {/* ═══ o que rola por cima do palco ═══ */}
      <div className="pointer-events-none relative -mt-[100svh]">
        <div ref={passage} aria-hidden className={reduced ? "h-[160svh]" : "h-[240svh]"} />
        <LookupContent cd={cd} onPin={onPin} onSearching={setSearching} />
      </div>
    </div>
  )
}
