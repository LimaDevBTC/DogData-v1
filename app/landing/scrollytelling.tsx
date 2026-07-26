"use client"

// ═══════════════════════════════════════════════════════════════════════════
// DogCity scrollytelling — a 180-frame construction time-lapse of the same
// lunar site (locked camera, Blender master scene), scrubbed by scroll on a
// full-viewport canvas. Buildings rise from the regolith, cranes turn, the
// rocket lands and lifts off — continuous video feel, no image swaps.
// Frames load progressively (every 12th → every 4th → all) and the nearest
// loaded frame is drawn, so the scrub sharpens as the sequence streams in.
// Reduced-motion gets discrete phase stills; screen readers get a text
// walkthrough of every phase.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { ArrowDown, ArrowRight } from "lucide-react"
import { PHASES, formatDog } from "./dogcity-data"

const FRAME_COUNT = 180
const FRAME_START = 14      // open on the drawn survey grid, matching the poster
const SEQ_VERSION = "1"
const frameUrl = (i: number) => `/landing/seq/f_${String(i + 1).padStart(4, "0")}.webp?v=${SEQ_VERSION}`

// phase boundaries aligned with the animation timeline, in scrub progress
const frameToProgress = (f: number) => (f - FRAME_START) / (FRAME_COUNT - 1 - FRAME_START)
const PHASE_BREAKS = [0, frameToProgress(30), frameToProgress(60), frameToProgress(95), frameToProgress(140)]

const N = PHASES.length

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x))
}

function phaseAt(progress: number): number {
  let p = 0
  for (let i = 0; i < PHASE_BREAKS.length; i++) if (progress >= PHASE_BREAKS[i]) p = i
  return Math.min(p, N - 1)
}

export default function Scrollytelling({
  raised, founders,
}: { raised: number | null; founders: number | null }) {
  const sectionRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imagesRef = useRef<(HTMLImageElement | null)[]>([])
  const loadedRef = useRef<boolean[]>([])
  const progressRef = useRef(0)
  const drawnRef = useRef(-1)

  const [progress, setProgress] = useState(0)
  const [reduce, setReduce] = useState(false)
  const [staticPhase, setStaticPhase] = useState(0)
  const [canvasReady, setCanvasReady] = useState(false)

  useEffect(() => {
    setReduce(window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  }, [])

  // ── draw the nearest loaded frame for the current progress ───────────────
  const draw = useCallback(() => {
    const cv = canvasRef.current
    if (!cv) return
    const target = FRAME_START + Math.round(progressRef.current * (FRAME_COUNT - 1 - FRAME_START))
    let best = -1
    for (let d = 0; d < FRAME_COUNT; d++) {
      if (target - d >= 0 && loadedRef.current[target - d]) { best = target - d; break }
      if (target + d < FRAME_COUNT && loadedRef.current[target + d]) { best = target + d; break }
    }
    if (best < 0) return
    const img = imagesRef.current[best]
    if (!img) return
    const ctx = cv.getContext("2d")
    if (!ctx) return
    if (drawnRef.current === best && cv.dataset.size === `${cv.width}x${cv.height}`) return
    drawnRef.current = best
    cv.dataset.size = `${cv.width}x${cv.height}`
    // object-cover draw; on wide viewports bias the vertical crop downward —
    // the action (plaza, avenue, spaceport) lives centre-bottom of the frames,
    // the top is empty terrain
    const cw = cv.width, ch = cv.height
    const ir = img.width / img.height, cr = cw / ch
    let sx = 0, sy = 0, sw = img.width, sh = img.height
    if (ir > cr) { sw = img.height * cr; sx = (img.width - sw) / 2 }
    else { sh = img.width / cr; sy = (img.height - sh) * 0.68 }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch)
    setCanvasReady(true)
  }, [])

  // ── progressive frame streaming: coarse pass first, then refine ──────────
  useEffect(() => {
    if (reduce) return
    let cancelled = false
    const tiers: number[] = []
    for (let i = FRAME_START; i < FRAME_COUNT; i += 12) tiers.push(i)
    for (let i = FRAME_START; i < FRAME_COUNT; i += 4) if ((i - FRAME_START) % 12 !== 0) tiers.push(i)
    for (let i = FRAME_START; i < FRAME_COUNT; i++) if ((i - FRAME_START) % 4 !== 0) tiers.push(i)

    let cursor = 0
    const CONCURRENCY = 6
    const next = () => {
      if (cancelled || cursor >= tiers.length) return
      const i = tiers[cursor++]
      const img = new window.Image()
      img.onload = () => {
        loadedRef.current[i] = true
        imagesRef.current[i] = img
        const target = FRAME_START + Math.round(progressRef.current * (FRAME_COUNT - 1 - FRAME_START))
        if (Math.abs(i - target) < 14 || !canvasReady) requestAnimationFrame(draw)
        next()
      }
      img.onerror = () => next()
      img.src = frameUrl(i)
    }
    for (let k = 0; k < CONCURRENCY; k++) next()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce])

  // ── scroll → progress (hand-rolled: rAF + rect) ──────────────────────────
  useEffect(() => {
    if (reduce) return
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const el = sectionRef.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        const total = rect.height - window.innerHeight
        const v = total > 0 ? clamp01(-rect.top / total) : 0
        progressRef.current = v
        setProgress(Math.round(v * 1000) / 1000)
        draw()
      })
    }
    const onResize = () => {
      const cv = canvasRef.current
      if (cv) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        cv.width = Math.round(window.innerWidth * dpr)
        cv.height = Math.round(window.innerHeight * dpr)
        drawnRef.current = -1
      }
      onScroll()
    }
    onResize()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onResize)
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onResize)
      cancelAnimationFrame(raf)
    }
  }, [reduce, draw])

  const phase = reduce ? staticPhase : phaseAt(progress)
  const current = PHASES[phase]
  const heroCopyOpacity = 1 - clamp01((progress - 0.09) / 0.06)
  const hintOpacity = 1 - clamp01((progress - 0.07) / 0.05)

  // ── Reduced-motion: discrete phases, no scroll choreography ──────────────
  if (reduce) {
    return (
      <section aria-label="DogCity construction phases" className="relative bg-void">
        <div className="relative w-full aspect-[16/10] max-h-[80vh]">
          <Image src={current.image} alt={current.alt} fill sizes="100vw" className="object-cover" priority />
        </div>
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="font-mono text-[11px] tracking-[0.25em] text-lava mb-2">
            MASTERPLAN · FOUNDING ERA — PHASE {String(current.number).padStart(2, "0")} / {String(N).padStart(2, "0")}
          </div>
          <h2 className="font-display font-bold text-2xl text-snow">{current.title}</h2>
          <p className="text-sm text-mist mt-2 leading-relaxed">{current.caption}</p>
          {current.metric && <div className="font-mono text-[11px] text-dusty mt-2">{current.metric}</div>}
          <div className="flex flex-wrap gap-2 mt-5" role="group" aria-label="Select construction phase">
            {PHASES.map((p, i) => (
              <button
                key={p.id}
                onClick={() => setStaticPhase(i)}
                aria-pressed={i === staticPhase}
                className={`px-3 py-1.5 font-mono text-[11px] border transition-colors ${
                  i === staticPhase
                    ? "border-lava text-lava bg-lava/10"
                    : "border-white/10 text-dusty hover:text-snow hover:border-white/25"
                }`}
              >
                {String(p.number).padStart(2, "0")} · {p.shortTitle}
              </button>
            ))}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section ref={sectionRef} aria-label="DogCity construction phases" className="relative" style={{ height: "620vh" }}>
      {/* screen-reader walkthrough of every phase */}
      <div className="sr-only">
        {PHASES.map((p) => <p key={p.id}>{p.screenReaderSummary}</p>)}
      </div>

      <div className="sticky top-0 h-screen overflow-hidden bg-void">
        {/* poster until the sequence streams in */}
        <div className="absolute inset-0" style={{ opacity: canvasReady ? 0 : 1, transition: "opacity 0.5s" }}>
          <Image src={PHASES[0].image} alt={PHASES[0].alt} fill priority sizes="100vw" className="object-cover" />
        </div>
        {/* the construction time-lapse, scrubbed by scroll */}
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" aria-hidden />

        {/* readability gradients */}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-void/80 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-void/85 to-transparent pointer-events-none" />

        {/* masterplan badge — this is the vision, not current state */}
        <div className="absolute top-20 left-4 md:left-8 font-mono text-[10px] tracking-[0.3em] text-snow/70 border border-white/15 bg-void/50 backdrop-blur-sm px-3 py-1.5">
          MASTERPLAN · FOUNDING ERA
        </div>

        {/* phase indicator + progress line */}
        <div className="absolute top-20 right-4 md:right-8 text-right">
          <div className="font-mono text-[11px] text-snow/85 tabular-nums">
            {String(current.number).padStart(2, "0")} / {String(N).padStart(2, "0")} · {current.shortTitle}
          </div>
          <div className="mt-2 h-px w-28 md:w-40 bg-white/15 ml-auto overflow-hidden">
            <div className="h-full bg-lava origin-left" style={{ transform: `scaleX(${progress.toFixed(3)})` }} />
          </div>
        </div>

        {/* hero copy — opening only; centred in the area visible on first paint
            (header + sponsor banner sit above the fold at scroll 0) */}
        <div
          className="absolute inset-x-0 top-0 flex items-center h-[calc(100vh-230px)] md:h-[calc(100vh-270px)]"
          style={{ opacity: heroCopyOpacity, pointerEvents: heroCopyOpacity < 0.3 ? "none" : undefined }}
        >
          <div className="max-w-6xl mx-auto w-full px-6 md:px-10">
            <div className="max-w-2xl">
              <div className="font-mono text-[11px] tracking-[0.3em] text-lava mb-4">
                DOGCITY · FOUNDING ERA
              </div>
              <h1 className="font-display font-bold text-4xl md:text-6xl leading-[1.05] text-snow">
                Turn your DOG wallet into part of the Moon.
              </h1>
              <p className="mt-5 text-sm md:text-base text-mist leading-relaxed max-w-xl">
                DogCity is a virtual city for DOG holders, built over real mapped lunar
                terrain. Participating wallets can become properties, placed by DOG
                history and connected to Bitcoin.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a
                  href="#build"
                  className="inline-flex items-center gap-2 px-6 py-3 font-mono text-sm font-bold text-void bg-lava hover:bg-lava-light transition-colors"
                >
                  Build DogCity <ArrowRight className="w-4 h-4" />
                </a>
                <a
                  href="#how"
                  className="inline-flex items-center gap-2 px-6 py-3 font-mono text-sm text-snow border border-white/20 hover:border-white/45 transition-colors"
                >
                  See How It Works
                </a>
              </div>
              <div className="mt-6 font-mono text-[11px] text-dusty flex flex-wrap gap-x-6 gap-y-1">
                <span>Construction is already underway.</span>
                {raised !== null && <span className="text-snow/80">{formatDog(raised)} DOG raised</span>}
                {founders !== null && <span className="text-snow/80">{founders.toLocaleString()} founders</span>}
              </div>
            </div>
          </div>
        </div>

        {/* scroll hints — opening only */}
        <div style={{ opacity: hintOpacity }} className="absolute bottom-6 inset-x-0 pointer-events-none">
          <div className="max-w-6xl mx-auto px-6 md:px-10 flex justify-between font-mono text-[10px] tracking-[0.2em] text-dusty">
            <span>SCROLL TO BUILD DOGCITY</span>
            <span className="inline-flex items-center gap-1.5">
              CONTINUE TO SURVEY <ArrowDown className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* phase caption panel — desktop right, mobile bottom */}
        {phase > 0 && (
          <div
            key={phase}
            className="absolute bottom-14 inset-x-4 md:inset-x-auto md:right-8 md:bottom-24 md:w-[340px] border border-white/10 bg-void/70 backdrop-blur-md p-5 animate-[fadeSlideIn_0.45s_ease-out]"
          >
            <div className="font-mono text-[10px] tracking-[0.25em] text-lava">
              {String(current.number).padStart(2, "0")} — {current.title.toUpperCase()}
            </div>
            <p className="mt-2 text-[13px] text-mist leading-relaxed">{current.caption}</p>
            {current.metric && (
              <div className="mt-3 pt-3 border-t border-white/10 font-mono text-[11px] text-snow/80 tabular-nums">
                {current.metric}
              </div>
            )}
          </div>
        )}
        <style jsx>{`
          @keyframes fadeSlideIn {
            from { opacity: 0; transform: translateY(14px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    </section>
  )
}
