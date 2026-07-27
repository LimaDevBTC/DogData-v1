"use client"

// ═══════════════════════════════════════════════════════════════════════════
// DogCity scrollytelling — a 180-frame construction time-lapse of the same
// lunar site (locked camera, Blender master scene), scrubbed by scroll on a
// full-viewport canvas rendered through a PORTAL to document.body. The portal
// escapes every Layout container/padding/overflow, so the stage spans the true
// viewport edge-to-edge by construction — no width math, no side bars, ever.
// An in-flow spacer owns the scroll range; the portal paints over it.
// Annotations are anchored to real city elements via camera-projected (u,v).
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import Image from "next/image"
import { ArrowDown } from "lucide-react"
import { PHASES, PHASE_ANNOTATIONS, formatDog } from "./dogcity-data"
import { RUNESTONE_SPRITE } from "./runestone-sprite-b64"

const FRAME_COUNT = 180
const FRAME_START = 22      // open on the fully-drawn survey grid, matching the poster
const FRAME_END = 150       // the city is complete here; the late rocket landing happens off-frame
const SEQ_VERSION = "1"
const TOP_BIAS = 0.85       // wide viewports fill the width; vertical overflow crops 85% from the empty top
const frameUrl = (i: number) => `/landing/seq/f_${String(i + 1).padStart(4, "0")}.webp?v=${SEQ_VERSION}`

const frameToProgress = (f: number) => (f - FRAME_START) / (FRAME_END - FRAME_START)
const PHASE_BREAKS = [0, frameToProgress(30), frameToProgress(60), frameToProgress(95), frameToProgress(140)]

const N = PHASES.length

interface DrawBox {
  dX: number; dY: number; dW: number; dH: number
  sX: number; sY: number; sW: number; sH: number
  iw: number; ih: number; k: number; cssW: number; cssH: number
}

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
  const spacerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imagesRef = useRef<(HTMLImageElement | null)[]>([])
  const loadedRef = useRef<boolean[]>([])
  const progressRef = useRef(0)
  const drawnRef = useRef(-1)
  const boxKeyRef = useRef("")

  const [mounted, setMounted] = useState(false)
  const [overlay, setOverlay] = useState<{ top: number; height: number } | null>(null)
  const [progress, setProgress] = useState(0)
  const [reduce, setReduce] = useState(false)
  const [staticPhase, setStaticPhase] = useState(0)
  const [canvasReady, setCanvasReady] = useState(false)
  const [box, setBox] = useState<DrawBox | null>(null)

  useEffect(() => {
    setMounted(true)
    setReduce(window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  }, [])

  // keep the body-level portal glued to the in-flow spacer
  useEffect(() => {
    if (reduce || !mounted) return
    const upd = () => {
      const s = spacerRef.current
      if (!s) return
      const r = s.getBoundingClientRect()
      const top = Math.round(r.top + window.scrollY)
      const height = Math.round(r.height)
      setOverlay((o) => (o && o.top === top && o.height === height ? o : { top, height }))
    }
    upd()
    window.addEventListener("resize", upd)
    const ro = new ResizeObserver(upd)
    ro.observe(document.body)
    if (spacerRef.current) ro.observe(spacerRef.current)
    return () => {
      window.removeEventListener("resize", upd)
      ro.disconnect()
    }
  }, [reduce, mounted])

  // ── draw the nearest loaded frame for the current progress ───────────────
  const draw = useCallback(() => {
    const cv = canvasRef.current
    if (!cv) return
    const target = FRAME_START + Math.round(progressRef.current * (FRAME_END - FRAME_START))
    let best = -1
    for (let d = 0; d < FRAME_COUNT; d++) {
      if (target - d >= FRAME_START && loadedRef.current[target - d]) { best = target - d; break }
      if (target + d <= FRAME_END && loadedRef.current[target + d]) { best = target + d; break }
    }
    if (best < 0) return
    const img = imagesRef.current[best]
    if (!img) return
    const ctx = cv.getContext("2d")
    if (!ctx) return
    if (drawnRef.current === best && cv.dataset.size === `${cv.width}x${cv.height}`) return
    drawnRef.current = best
    cv.dataset.size = `${cv.width}x${cv.height}`

    const cw = cv.width, ch = cv.height
    const ir = img.width / img.height, cr = cw / ch
    const k = (cv.getBoundingClientRect().width || cw) / cw
    ctx.clearRect(0, 0, cw, ch)
    let b: DrawBox
    if (cr > ir) {
      // wide: fill the full width (zero side bars); vertical overflow crops
      // mostly from the empty terrain at the top
      const dW = cw
      const dH = cw / ir
      const dY = Math.min(0, -(dH - ch) * TOP_BIAS + 50 / (k || 1))
      ctx.drawImage(img, 0, 0, img.width, img.height, 0, dY, dW, dH)
      b = { dX: 0, dY, dW, dH, sX: 0, sY: 0, sW: img.width, sH: img.height, iw: img.width, ih: img.height, k, cssW: cw * k, cssH: ch * k }
    } else {
      // narrow: cover centred on the plaza
      const sh = img.width / cr
      const sy = (img.height - sh) * 0.5
      ctx.drawImage(img, 0, sy, img.width, sh, 0, 0, cw, ch)
      b = { dX: 0, dY: 0, dW: cw, dH: ch, sX: 0, sY: sy, sW: img.width, sH: sh, iw: img.width, ih: img.height, k, cssW: cw * k, cssH: ch * k }
    }
    const bk = `${Math.round(b.dX)}|${Math.round(b.dW)}|${Math.round(b.sY)}|${Math.round(b.cssW)}|${Math.round(b.cssH)}`
    if (bk !== boxKeyRef.current) { boxKeyRef.current = bk; setBox(b) }
    setCanvasReady(true)
  }, [])

  // ── progressive frame streaming: coarse pass first, then refine ──────────
  useEffect(() => {
    if (reduce) return
    let cancelled = false
    const tiers: number[] = []
    for (let i = FRAME_START; i <= FRAME_END; i += 12) tiers.push(i)
    for (let i = FRAME_START; i <= FRAME_END; i += 4) if ((i - FRAME_START) % 12 !== 0) tiers.push(i)
    for (let i = FRAME_START; i <= FRAME_END; i++) if ((i - FRAME_START) % 4 !== 0) tiers.push(i)

    let cursor = 0
    const CONCURRENCY = 6
    const next = () => {
      if (cancelled || cursor >= tiers.length) return
      const i = tiers[cursor++]
      const img = new window.Image()
      img.onload = () => {
        loadedRef.current[i] = true
        imagesRef.current[i] = img
        const target = FRAME_START + Math.round(progressRef.current * (FRAME_END - FRAME_START))
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

  // ── scroll → progress (hand-rolled: rAF + rect of the in-flow spacer) ────
  useEffect(() => {
    if (reduce || !mounted) return
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const el = spacerRef.current
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
        const rect = cv.getBoundingClientRect()
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        cv.width = Math.max(2, Math.round(rect.width * dpr))
        cv.height = Math.max(2, Math.round(rect.height * dpr))
        drawnRef.current = -1
      }
      onScroll()
    }
    onResize()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onResize)
    const ro = new ResizeObserver(onResize)
    if (canvasRef.current) ro.observe(canvasRef.current)
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onResize)
      ro.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [reduce, mounted, draw, overlay])

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

  const stage = overlay && (
    <section
      aria-hidden
      className="pointer-events-none"
      style={{ position: "absolute", top: overlay.top, height: overlay.height, left: 0, width: "100%", zIndex: 5 }}
    >
      <div className="sticky top-0 h-screen overflow-hidden bg-void">
        {/* poster until the sequence streams in */}
        <div className="absolute inset-0" style={{ opacity: canvasReady ? 0 : 1, transition: "opacity 0.5s" }}>
          <Image src={PHASES[0].image} alt="" fill priority sizes="100vw" className="object-cover md:object-contain" />
        </div>
        {/* the construction time-lapse, scrubbed by scroll */}
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

        {/* readability gradients */}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-void/80 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-void/85 to-transparent" />

        {/* top chrome: badge + phase indicator stacked top-left — the top-right
            corner belongs to the Runestone */}
        <div className="absolute top-20 inset-x-0">
          <div className="max-w-[1800px] mx-auto px-4 md:px-10">
            <div className="inline-block">
              <div className="font-mono text-[10px] tracking-[0.3em] text-snow/70 border border-white/15 bg-void/50 backdrop-blur-sm px-3 py-1.5">
                MASTERPLAN · FOUNDING ERA
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div className="h-px w-24 md:w-32 bg-white/15 overflow-hidden">
                  <div className="h-full bg-lava origin-left" style={{ transform: `scaleX(${progress.toFixed(3)})` }} />
                </div>
                <div className="font-mono text-[10px] text-snow/80 tabular-nums">
                  {String(current.number).padStart(2, "0")} / {String(N).padStart(2, "0")} · {current.shortTitle}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* the Runestone — natural landmark marker (official artifact); enters
            from phase 3 on, clear of the header zone and the survey cards */}
        {box && progress > 0.30 && (() => {
          const rx = (box.dX + 0.8647 * box.dW) * box.k
          const ryRaw = (box.dY + 0.0798 * box.dH) * box.k
          const ry = Math.max(190, Math.min(box.cssH - 60, ryRaw))
          return (
            <div className="absolute animate-[annIn_0.5s_ease-out]" style={{ left: rx, top: ry }}>
              <span
                className="absolute -translate-x-1/2 block w-32 h-32 rounded-full pointer-events-none"
                style={{ bottom: -14, background: "radial-gradient(circle, rgba(245,110,15,0.22), transparent 65%)" }}
                aria-hidden
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={RUNESTONE_SPRITE}
                alt="The Runestone monolith"
                className="absolute bottom-0 -translate-x-1/2 h-28 md:h-40 w-auto"
                style={{ filter: "brightness(1.15) drop-shadow(0 0 14px rgba(245,110,15,0.5))" }}
              />
              <span
                className="absolute -translate-x-1/2 top-0 block w-12 h-1.5 rounded-[100%] bg-black/70 blur-[2px]"
                aria-hidden
              />
              <div className="absolute top-3 -translate-x-1/2 border border-white/12 bg-void/75 backdrop-blur-sm px-2.5 py-1.5">
                <div className="font-mono text-[10px] tracking-[0.18em] text-snow whitespace-nowrap">RUNESTONE NATURAL PARK</div>
              </div>
            </div>
          )
        })()}

        {/* hero copy — opening only; no CTAs, the scroll IS the journey */}
        <div
          className="absolute inset-x-0 top-0 flex items-center h-[calc(100vh-230px)] md:h-[calc(100vh-270px)]"
          style={{ opacity: heroCopyOpacity }}
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
              <div className="mt-6 font-mono text-[11px] text-dusty flex flex-wrap gap-x-6 gap-y-1">
                <span>Construction is already underway.</span>
                {raised !== null && <span className="text-snow/80">{formatDog(raised)} DOG raised</span>}
                {founders !== null && <span className="text-snow/80">{founders.toLocaleString()} founders</span>}
              </div>
              <div
                style={{ opacity: hintOpacity }}
                className="mt-8 flex items-center gap-8 font-mono text-[10px] tracking-[0.2em] text-dusty"
              >
                <span>SCROLL TO BUILD DOGCITY</span>
                <span className="inline-flex items-center gap-1.5">
                  CONTINUE TO SURVEY <ArrowDown className="w-3 h-3" />
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* anchored annotations — cards live ON the elements they explain */}
        {box && progress > 0.13 && PHASE_ANNOTATIONS[phase]?.map((a) => {
          const x = (a.u * box.iw - box.sX) / box.sW
          const y = (a.v * box.ih - box.sY) / box.sH
          if (x < 0.02 || x > 0.98 || y < -0.02 || y > 0.98) return null
          const cx = (box.dX + x * box.dW) * box.k
          const cy = (box.dY + y * box.dH) * box.k
          if (cy < 8 || cy > box.cssH - 8) return null
          let side = a.side ?? "top"
          if (side === "top" && cy < 150) side = "bottom"
          if (side === "bottom" && cy > box.cssH - 150) side = "top"
          const stem =
            side === "top"    ? { className: "absolute left-0 w-px h-8 -translate-x-1/2 bg-gradient-to-t from-lava/70 to-lava/10", style: { bottom: 5 } }
            : side === "bottom" ? { className: "absolute left-0 w-px h-8 -translate-x-1/2 bg-gradient-to-b from-lava/70 to-lava/10", style: { top: 5 } }
            : side === "left"  ? { className: "absolute top-0 h-px w-8 -translate-y-1/2 bg-gradient-to-l from-lava/70 to-lava/10", style: { right: 5 } }
            :                    { className: "absolute top-0 h-px w-8 -translate-y-1/2 bg-gradient-to-r from-lava/70 to-lava/10", style: { left: 5 } }
          const shiftX = cx < box.cssW * 0.16 ? "0%" : cx > box.cssW * 0.84 ? "-100%" : "-50%"
          const card: React.CSSProperties =
            side === "top"    ? { bottom: 40, transform: `translateX(${shiftX})` }
            : side === "bottom" ? { top: 40, transform: `translateX(${shiftX})` }
            : side === "left"  ? { right: 40, top: 0, transform: "translateY(-50%)" }
            :                    { left: 40, top: 0, transform: "translateY(-50%)" }
          return (
            <div
              key={`${phase}-${a.id}`}
              className={`absolute animate-[annIn_0.5s_ease-out] ${a.primary ? "" : "hidden md:block"}`}
              style={{ left: cx, top: cy }}
            >
              <span
                className="absolute block w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-lava"
                style={{ boxShadow: "0 0 10px rgba(245,110,15,0.9)" }}
              />
              <span className={stem.className} style={stem.style as React.CSSProperties} />
              <div className="absolute border border-white/12 bg-void/75 backdrop-blur-sm px-2.5 py-1.5" style={card}>
                <div className="font-mono text-[10px] tracking-[0.18em] text-snow whitespace-nowrap">{a.title}</div>
                {a.text && (
                  <p className="mt-1 text-[11px] text-mist leading-snug w-[220px]">{a.text}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )

  return (
    <>
      {/* in-flow spacer owns the scroll range; the portal paints over it */}
      <div ref={spacerRef} aria-label="DogCity construction phases" className="relative bg-void" style={{ height: "500vh" }}>
        <div className="sr-only">
          {PHASES.map((p) => <p key={p.id}>{p.screenReaderSummary}</p>)}
        </div>
      </div>
      {mounted && stage && createPortal(stage, document.body)}
      <style jsx global>{`
        @keyframes annIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  )
}
