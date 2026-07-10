"use client"

// ═══════════════════════════════════════════════════════════════════════════
// CityMapHero — the /donate hero background, drawn in the same visual language
// as the Plot Deed mini-map: dark void, ten faint district rings with organic
// jitter, radial roads, Satoshi Plaza glowing at the centre, and a scatter of
// wallet pins breathing in and out like a city at night.
// Replaces the old bright video (it fought the dark design system and killed
// text legibility). Pure canvas 2D: a pre-rendered static layer (rings+roads)
// rotated very slowly each frame, plus cheap per-frame pins. Pauses offscreen,
// respects prefers-reduced-motion (renders a single still frame).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef } from "react"

const DISTRICT_COLORS = [
  "#FDE047", "#FBBF24", "#F7931A", "#FB7185", "#E879F9",
  "#C4B5FD", "#A5B4FC", "#93C5FD", "#67E8F9", "#6EE7B7",
]

// same deterministic wobble as PlotMap — the two must read as one city
function jitter(a: number) {
  return 0.9 + 0.1 * Math.sin(a * 3 + 1.3) + 0.05 * Math.sin(a * 7)
}

// deterministic pseudo-random (stable pins across mounts — no hydration flicker)
function rand(seed: number) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

type Pin = { ring: number; angle: number; phase: number; speed: number; bright: boolean }

export default function CityMapHero() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const ctx = cv.getContext("2d")
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    let W = 0, H = 0, R = 0, cx = 0, cy = 0
    let staticLayer: HTMLCanvasElement | null = null

    // ── Static layer: rings + roads, rendered once per resize ────────────────
    const buildStatic = () => {
      const size = Math.ceil(R * 2.3)
      const layer = document.createElement("canvas")
      layer.width = size; layer.height = size
      const c = layer.getContext("2d")
      if (!c) return
      const mid = size / 2

      // district rings — faint, organic
      for (let d = 9; d >= 0; d--) {
        const rr = R * (0.12 + 0.88 * ((d + 1) / 10))
        c.beginPath()
        for (let a = 0; a <= 128; a++) {
          const ang = (a / 128) * Math.PI * 2
          const jr = rr * jitter(ang + d)
          const px = mid + Math.cos(ang) * jr
          const py = mid + Math.sin(ang) * jr
          a ? c.lineTo(px, py) : c.moveTo(px, py)
        }
        c.closePath()
        c.strokeStyle = DISTRICT_COLORS[d]
        c.globalAlpha = 0.13
        c.lineWidth = 1 * dpr
        c.stroke()
      }
      c.globalAlpha = 1

      // radial roads
      c.strokeStyle = "rgba(245,110,15,0.07)"
      c.lineWidth = 1 * dpr
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2
        c.beginPath()
        c.moveTo(mid + Math.cos(a) * R * 0.13, mid + Math.sin(a) * R * 0.13)
        c.lineTo(mid + Math.cos(a) * R * 1.04, mid + Math.sin(a) * R * 1.04)
        c.stroke()
      }

      staticLayer = layer
    }

    // ── Wallet pins — stable scatter across the rings ─────────────────────────
    const PINS: Pin[] = Array.from({ length: 70 }, (_, i) => ({
      ring: Math.floor(rand(i * 3 + 1) * 10),
      angle: rand(i * 3 + 2) * Math.PI * 2,
      phase: rand(i * 3 + 3) * Math.PI * 2,
      speed: 0.5 + rand(i * 7 + 4) * 1.1,
      bright: rand(i * 11 + 5) > 0.86, // a few pins pulse hot orange
    }))

    const resize = () => {
      const parent = cv.parentElement
      if (!parent) return
      W = Math.round(parent.clientWidth * dpr)
      H = Math.round(parent.clientHeight * dpr)
      cv.width = W; cv.height = H
      // centre sits slightly below mid-hero so rings radiate behind the copy
      cx = W / 2
      cy = H * 0.58
      R = Math.max(W, H) * 0.56
      buildStatic()
    }
    resize()

    let raf = 0
    let visible = true
    let rot = 0
    let t = 0

    const draw = () => {
      ctx.clearRect(0, 0, W, H)

      // deep ground wash
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.2)
      bg.addColorStop(0, "#0b0b0f")
      bg.addColorStop(1, "#030304")
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)

      // rings + roads, rotating imperceptibly
      if (staticLayer) {
        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate(rot)
        ctx.drawImage(staticLayer, -staticLayer.width / 2, -staticLayer.height / 2)
        ctx.restore()
      }

      // wallet pins breathe on the rings (drawn in rotated map space)
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(rot)
      for (const p of PINS) {
        const rr = R * (0.12 + 0.88 * ((p.ring + 1) / 10)) * jitter(p.angle + p.ring)
        const px = Math.cos(p.angle) * rr
        const py = Math.sin(p.angle) * rr
        const pulse = 0.5 + 0.5 * Math.sin(t * p.speed + p.phase)
        const col = p.bright ? "#F56E0F" : DISTRICT_COLORS[p.ring]
        const alpha = p.bright ? 0.25 + 0.5 * pulse : 0.08 + 0.22 * pulse
        const rad = (p.bright ? 2.2 : 1.5) * dpr

        if (p.bright) {
          const g = ctx.createRadialGradient(px, py, 0, px, py, 14 * dpr)
          g.addColorStop(0, col)
          g.addColorStop(1, "rgba(0,0,0,0)")
          ctx.globalAlpha = alpha * 0.5
          ctx.fillStyle = g
          ctx.beginPath(); ctx.arc(px, py, 14 * dpr, 0, 7); ctx.fill()
        }
        ctx.globalAlpha = alpha
        ctx.fillStyle = col
        ctx.beginPath(); ctx.arc(px, py, rad, 0, 7); ctx.fill()
      }
      ctx.globalAlpha = 1
      ctx.restore()

      // Satoshi Plaza — the warm heart of the map
      const plazaPulse = reduce ? 0.7 : 0.55 + 0.25 * Math.sin(t * 1.2)
      const pg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.13)
      pg.addColorStop(0, "rgba(245,110,15,0.5)")
      pg.addColorStop(0.4, "rgba(245,110,15,0.12)")
      pg.addColorStop(1, "rgba(0,0,0,0)")
      ctx.globalAlpha = plazaPulse
      ctx.fillStyle = pg
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.13, 0, 7); ctx.fill()
      ctx.globalAlpha = 1
      ctx.save()
      ctx.translate(cx, cy)
      ctx.shadowColor = "#F56E0F"; ctx.shadowBlur = 16 * dpr
      ctx.fillStyle = "#F56E0F"; ctx.globalAlpha = 0.9
      ctx.beginPath(); ctx.roundRect(-5 * dpr, -5 * dpr, 10 * dpr, 10 * dpr, 2 * dpr); ctx.fill()
      ctx.restore()
      ctx.globalAlpha = 1; ctx.shadowBlur = 0
    }

    const frame = () => {
      raf = requestAnimationFrame(frame)
      if (!visible) return
      t += 0.016
      rot += 0.00028
      draw()
    }

    if (reduce) {
      draw() // one still frame — the map, no motion
    } else {
      frame()
    }

    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting }, { threshold: 0.01 })
    io.observe(cv)

    const ro = new ResizeObserver(() => { resize(); if (reduce) draw() })
    ro.observe(cv.parentElement as Element)

    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
    }
  }, [])

  return <canvas ref={ref} className="absolute inset-0 w-full h-full" aria-hidden />
}
