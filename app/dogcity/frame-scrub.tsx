"use client"

// ═══════════════════════════════════════════════════════════════════════════
// FrameScrub — generic scroll-scrubbed frame sequence, ported from
// ../dogcity/scrollytelling.tsx (the hero's 180-frame scrub). Mechanics are
// duplicated ON PURPOSE: the hero is shipped and load-bearing and must not be
// refactored under a new abstraction (precedent: Corners in sections/park.tsx).
// An in-flow spacer owns the scroll range; the stage portals to document.body
// and paints over it — escaping every Layout container by construction.
// Per-frame work writes to the canvas directly; only a rounded `progress`
// number crosses into React state (motion.tsx rule).
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import Image from "next/image"

export interface DrawBox {
  dX: number; dY: number; dW: number; dH: number
  sX: number; sY: number; sW: number; sH: number
  iw: number; ih: number; k: number; cssW: number; cssH: number
}

export interface FrameScrubProps {
  frameUrl: (i: number) => string
  frameCount: number
  frameStart?: number
  frameEnd?: number
  spacerVh: number
  topBias?: number          // wide viewports: fraction of vertical overflow cropped from the top
  focusU?: number           // phone crop: horizontal frame-space anchor to keep centred
  lazy?: boolean            // gate preloading on approach instead of mount
  concurrency?: number
  poster: { src: string; alt: string }
  ariaLabel: string
  srSummaries: string[]
  zIndex?: number
  overlay?: (s: { progress: number; box: DrawBox | null; canvasReady: boolean }) => React.ReactNode
  reducedMotion: React.ReactNode
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

export default function FrameScrub({
  frameUrl, frameCount, frameStart = 0, frameEnd = frameCount - 1,
  spacerVh, topBias = 0.85, focusU = 0.5, lazy = false, concurrency = 6,
  poster, ariaLabel, srSummaries, zIndex = 5, overlay, reducedMotion,
}: FrameScrubProps) {
  const spacerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imagesRef = useRef<(HTMLImageElement | null)[]>([])
  const loadedRef = useRef<boolean[]>([])
  const progressRef = useRef(0)
  const drawnRef = useRef(-1)
  const boxKeyRef = useRef("")

  const [mounted, setMounted] = useState(false)
  const [reduce, setReduce] = useState(false)
  const [near, setNear] = useState(!lazy)
  const [stagePos, setStagePos] = useState<{ top: number; height: number } | null>(null)
  const [canvasReady, setCanvasReady] = useState(false)
  const [progress, setProgress] = useState(0)
  const [box, setBox] = useState<DrawBox | null>(null)

  useEffect(() => {
    setMounted(true)
    setReduce(window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  }, [])

  // lazy gate: begin streaming when the spacer is within two viewports
  useEffect(() => {
    if (!lazy || near || reduce) return
    const el = spacerRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setNear(true); io.disconnect() } },
      { rootMargin: "200% 0px 200% 0px" },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [lazy, near, reduce])

  // keep the body-level portal glued to the in-flow spacer
  useEffect(() => {
    if (reduce || !mounted) return
    const upd = () => {
      const s = spacerRef.current
      if (!s) return
      const r = s.getBoundingClientRect()
      const top = Math.round(r.top + window.scrollY)
      const height = Math.round(r.height)
      setStagePos((o) => (o && o.top === top && o.height === height ? o : { top, height }))
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

  // draw the nearest loaded frame for the current progress
  const draw = useCallback(() => {
    const cv = canvasRef.current
    if (!cv) return
    const target = frameStart + Math.round(progressRef.current * (frameEnd - frameStart))
    let best = -1
    for (let d = 0; d < frameCount; d++) {
      if (target - d >= frameStart && loadedRef.current[target - d]) { best = target - d; break }
      if (target + d <= frameEnd && loadedRef.current[target + d]) { best = target + d; break }
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
      // wide: fill the full width; vertical overflow crops mostly from the
      // empty sky at the top (topBias)
      const dW = cw
      const dH = cw / ir
      const dY = Math.min(0, -(dH - ch) * topBias + 50 / (k || 1))
      ctx.drawImage(img, 0, 0, img.width, img.height, 0, dY, dW, dH)
      b = { dX: 0, dY, dW, dH, sX: 0, sY: 0, sW: img.width, sH: img.height, iw: img.width, ih: img.height, k, cssW: cw * k, cssH: ch * k }
    } else {
      // narrow: cover by scaling a DESTINATION rect — never crop a SOURCE rect
      // (a source rect taller than the image = the black-letterbox phone bug,
      // see scrollytelling.tsx:130-145)
      const dH = ch
      const dW = img.width * (ch / img.height)
      const dX = Math.max(Math.min(cw / 2 - focusU * dW, 0), cw - dW)
      ctx.drawImage(img, 0, 0, img.width, img.height, dX, 0, dW, dH)
      b = { dX, dY: 0, dW, dH, sX: 0, sY: 0, sW: img.width, sH: img.height, iw: img.width, ih: img.height, k, cssW: cw * k, cssH: ch * k }
    }
    const bk = `${Math.round(b.dX)}|${Math.round(b.dW)}|${Math.round(b.sY)}|${Math.round(b.cssW)}|${Math.round(b.cssH)}`
    if (bk !== boxKeyRef.current) { boxKeyRef.current = bk; setBox(b) }
    setCanvasReady(true)
  }, [frameStart, frameEnd, frameCount, topBias, focusU])

  // progressive frame streaming: coarse pass first, then refine (stride 12/4/1)
  useEffect(() => {
    if (reduce || !near) return
    let cancelled = false
    const tiers: number[] = []
    for (let i = frameStart; i <= frameEnd; i += 12) tiers.push(i)
    for (let i = frameStart; i <= frameEnd; i += 4) if ((i - frameStart) % 12 !== 0) tiers.push(i)
    for (let i = frameStart; i <= frameEnd; i++) if ((i - frameStart) % 4 !== 0) tiers.push(i)

    let cursor = 0
    const next = () => {
      if (cancelled || cursor >= tiers.length) return
      const i = tiers[cursor++]
      const img = new window.Image()
      img.onload = () => {
        loadedRef.current[i] = true
        imagesRef.current[i] = img
        const target = frameStart + Math.round(progressRef.current * (frameEnd - frameStart))
        if (Math.abs(i - target) < 14 || !canvasReady) requestAnimationFrame(draw)
        next()
      }
      img.onerror = () => next()
      img.src = frameUrl(i)
    }
    for (let c = 0; c < concurrency; c++) next()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce, near])

  // scroll → progress (hand-rolled rAF; never framer useScroll against the
  // body portal — it freezes under overflow-x: clip, see motion.tsx)
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
  }, [reduce, mounted, draw, stagePos])

  if (reduce) return <>{reducedMotion}</>

  const stage = stagePos && (
    <section
      aria-hidden
      className="pointer-events-none"
      style={{ position: "absolute", top: stagePos.top, height: stagePos.height, left: 0, width: "100%", zIndex }}
    >
      <div className="sticky top-0 h-screen overflow-hidden bg-void">
        <div className="absolute inset-0" style={{ opacity: canvasReady ? 0 : 1, transition: "opacity 0.5s" }}>
          <Image src={poster.src} alt="" fill sizes="100vw" className="object-cover" />
        </div>
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-void/80 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-void/[0.85] to-transparent" />
        {overlay?.({ progress, box, canvasReady })}
      </div>
    </section>
  )

  return (
    <>
      <div ref={spacerRef} aria-label={ariaLabel} className="relative bg-void" style={{ height: `${spacerVh}vh` }}>
        <div className="sr-only">
          {srSummaries.map((s, i) => <p key={i}>{s}</p>)}
        </div>
      </div>
      {mounted && stage && createPortal(stage, document.body)}
    </>
  )
}
