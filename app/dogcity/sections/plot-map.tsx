"use client"

// ═══════════════════════════════════════════════════════════════════════════
// PlotMap — the mini top-down DogCity map for the Plot Deed card on /donate.
// Pure canvas (no WebGL): 10 age/tier rings, Satoshi Plaza at the centre, and a
// glowing pin at the wallet's normalized position (nx,nz ∈ [-1,1]) tinted to the
// district colour. Cheap, self-contained, pauses its pulse for reduced-motion.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef } from "react"

const DISTRICT_COLORS = [
  "#FDE047", "#FBBF24", "#F7931A", "#FB7185", "#E879F9",
  "#C4B5FD", "#A5B4FC", "#93C5FD", "#67E8F9", "#6EE7B7",
]

// tiny deterministic wobble so the boundary reads organic, not like a dartboard
function jitter(a: number) {
  return 0.9 + 0.1 * Math.sin(a * 3 + 1.3) + 0.05 * Math.sin(a * 7)
}

export default function PlotMap({
  districtId, color, nx, nz, size = 160,
}: { districtId: number; color: string; nx: number; nz: number; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const ctx = cv.getContext("2d")
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const S = Math.round(size * dpr)
    cv.width = S; cv.height = S
    const c = S / 2, R = S * 0.46
    const pinX = c + nx * R, pinY = c - nz * R
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    let raf = 0, t = 0
    const draw = () => {
      ctx.clearRect(0, 0, S, S)

      // ground
      const bg = ctx.createRadialGradient(c, c, 0, c, c, R * 1.15)
      bg.addColorStop(0, "#0d0d12"); bg.addColorStop(1, "#050506")
      ctx.fillStyle = bg
      ctx.beginPath(); ctx.arc(c, c, R * 1.12, 0, 7); ctx.fill()

      // 10 rings, the wallet's district emphasized
      for (let d = 9; d >= 0; d--) {
        const rr = R * (0.1 + 0.9 * ((d + 1) / 10))
        ctx.beginPath()
        for (let a = 0; a <= 64; a++) {
          const ang = (a / 64) * Math.PI * 2, jr = rr * jitter(ang + d)
          const px = c + Math.cos(ang) * jr, py = c + Math.sin(ang) * jr
          a ? ctx.lineTo(px, py) : ctx.moveTo(px, py)
        }
        ctx.closePath()
        const on = d === districtId
        ctx.strokeStyle = DISTRICT_COLORS[d]
        ctx.globalAlpha = on ? 0.85 : 0.15
        ctx.lineWidth = on ? 2 * dpr : 1 * dpr
        ctx.shadowBlur = on ? 10 * dpr : 0
        ctx.shadowColor = DISTRICT_COLORS[d]
        ctx.stroke()
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0

      // radial roads
      ctx.strokeStyle = "rgba(245,110,15,.10)"; ctx.lineWidth = 1 * dpr
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(c + Math.cos(a) * R * 0.12, c + Math.sin(a) * R * 0.12)
        ctx.lineTo(c + Math.cos(a) * R * 1.02, c + Math.sin(a) * R * 1.02)
        ctx.stroke()
      }

      // Satoshi Plaza — central landmark
      ctx.save(); ctx.translate(c, c)
      ctx.shadowColor = "#F56E0F"; ctx.shadowBlur = 14 * dpr
      ctx.fillStyle = "#F56E0F"; ctx.globalAlpha = 0.9
      ctx.beginPath(); ctx.roundRect(-6 * dpr, -6 * dpr, 12 * dpr, 12 * dpr, 2 * dpr); ctx.fill()
      ctx.restore(); ctx.globalAlpha = 1; ctx.shadowBlur = 0

      // the pin
      const pulse = reduce ? 0.6 : 0.45 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2.4))
      const g = ctx.createRadialGradient(pinX, pinY, 0, pinX, pinY, 20 * dpr)
      g.addColorStop(0, color); g.addColorStop(1, "rgba(0,0,0,0)")
      ctx.globalAlpha = pulse; ctx.fillStyle = g
      ctx.beginPath(); ctx.arc(pinX, pinY, 20 * dpr, 0, 7); ctx.fill()
      ctx.globalAlpha = 1
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(pinX, pinY, 3.4 * dpr, 0, 7); ctx.fill()
      ctx.strokeStyle = color; ctx.lineWidth = 2 * dpr
      ctx.beginPath(); ctx.arc(pinX, pinY, 5.4 * dpr, 0, 7); ctx.stroke()

      if (!reduce) { t += 0.016; raf = requestAnimationFrame(draw) }
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [districtId, color, nx, nz, size])

  return <canvas ref={ref} style={{ width: size, height: size, display: "block", borderRadius: 12 }} aria-hidden />
}
