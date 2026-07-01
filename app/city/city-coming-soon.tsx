'use client'

import { useRef, useEffect } from 'react'
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useMotionValue,
  useInView,
} from 'framer-motion'
import { Building2, ShoppingBag, Globe, ExternalLink } from 'lucide-react'

// ─── Building data (deterministic — no Math.random in render) ──────────────

interface Building {
  x: number
  w: number
  h: number
  glow?: boolean
}

// Front layer — organic city profile, Manhattan philosophy:
// thin spires next to squat blocks, NO gradual arcs, glow cluster breaks its own pattern
const FRONT: Building[] = [
  // Far left — low blocks punctuated by thin spires
  { x: 0,    w: 42, h: 52  },
  { x: 48,   w: 14, h: 188 }, // thin spike!
  { x: 68,   w: 55, h: 70  }, // wide block drops
  { x: 130,  w: 16, h: 222 }, // thin tower shoots up
  { x: 152,  w: 46, h: 88  }, // drops
  { x: 205,  w: 18, h: 152 }, // mid spike
  { x: 230,  w: 52, h: 60  }, // wide, very low
  { x: 290,  w: 14, h: 245 }, // very thin, very tall
  { x: 310,  w: 56, h: 105 }, // wide block drops hard
  // Mid-left — irregular, building energy toward center
  { x: 374,  w: 18, h: 272 }, // spike
  { x: 400,  w: 54, h: 128 }, // wide medium
  { x: 462,  w: 14, h: 295 }, // dramatic thin spike
  { x: 482,  w: 46, h: 155 }, // drops
  { x: 536,  w: 22, h: 278 }, // spike
  { x: 566,  w: 16, h: 195 }, // dips
  { x: 590,  w: 50, h: 248 }, // builds up
  { x: 648,  w: 16, h: 172 }, // thin connector, drops before Moon District
  // MOON DISTRICT — the key: NO arc, dramatic height breaks
  { x: 670,  w: 44, h: 362, glow: true }, // left Moon tower — tall
  { x: 722,  w: 76, h: 425, glow: true }, // THE TOWER — dominant, alone at top
  { x: 806,  w: 26, h: 218, glow: true }, // thin + MUCH shorter — shatters the arc
  { x: 840,  w: 50, h: 172 },             // regular block drops (non-glow)
  { x: 898,  w: 38, h: 322, glow: true }, // "Chrysler" — rises back, far from main
  // Right side — mirrored energy, NOT mirrored heights
  { x: 944,  w: 52, h: 140 }, // drops after Chrysler
  { x: 1004, w: 14, h: 282 }, // thin spike
  { x: 1024, w: 48, h: 115 }, // wide drops
  { x: 1080, w: 18, h: 252 }, // spike
  { x: 1106, w: 54, h: 88  }, // wide, very low
  { x: 1168, w: 14, h: 218 }, // thin spike
  { x: 1188, w: 46, h: 132 }, // medium
  { x: 1242, w: 16, h: 192 }, // spike
  { x: 1266, w: 52, h: 72  }, // wide, low
  { x: 1326, w: 18, h: 155 }, // spike
  { x: 1352, w: 50, h: 65  }, // wide, very low
  { x: 1410, w: 14, h: 128 }, // thin spike
  { x: 1430, w: 14, h: 58  }, // edge
]

// Back layer — also organic, thin spires dominate
const BACK: Building[] = [
  { x: 22,   w: 28, h: 38  },
  { x: 58,   w: 12, h: 122 }, // spike
  { x: 80,   w: 44, h: 55  },
  { x: 144,  w: 12, h: 158 }, // spike
  { x: 168,  w: 36, h: 70  },
  { x: 220,  w: 14, h: 115 }, // spike
  { x: 248,  w: 46, h: 46  }, // very low block
  { x: 312,  w: 12, h: 182 }, // spike
  { x: 334,  w: 52, h: 88  },
  { x: 404,  w: 12, h: 218 }, // spike
  { x: 428,  w: 40, h: 115 },
  { x: 484,  w: 12, h: 268 }, // tall spike
  { x: 508,  w: 48, h: 145 },
  { x: 568,  w: 18, h: 212 },
  { x: 600,  w: 12, h: 162 },
  { x: 626,  w: 44, h: 312 },
  { x: 686,  w: 60, h: 378 }, // behind main cluster
  { x: 760,  w: 20, h: 258 },
  { x: 796,  w: 56, h: 348 },
  { x: 868,  w: 12, h: 278 }, // spike
  { x: 894,  w: 40, h: 140 },
  { x: 950,  w: 12, h: 232 }, // spike
  { x: 974,  w: 44, h: 108 },
  { x: 1028, w: 12, h: 192 }, // spike
  { x: 1054, w: 38, h: 78  },
  { x: 1106, w: 12, h: 162 }, // spike
  { x: 1132, w: 42, h: 98  },
  { x: 1188, w: 14, h: 142 }, // spike
  { x: 1218, w: 36, h: 62  },
  { x: 1272, w: 12, h: 118 }, // spike
  { x: 1300, w: 44, h: 52  },
  { x: 1360, w: 12, h: 95  }, // spike
  { x: 1390, w: 36, h: 42  },
  { x: 1432, w: 12, h: 68  },
]

// Deterministic lit windows — Moon District buildings only (no Math.random)
interface WinDot { x: number; y: number; w: number; h: number; bright: boolean }
const MOON_WINDOWS: WinDot[] = (() => {
  const wins: WinDot[] = []
  let seed = 54321
  const r = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
  for (const b of FRONT.filter(bld => bld.glow)) {
    const colW = 10, rowH = 12, ww = 5, wh = 6
    const cols = Math.max(1, Math.floor((b.w - 4) / colW))
    const rows = Math.max(1, Math.floor((b.h - 10) / rowH))
    const padX = (b.w - cols * colW) / 2
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (r() > 0.58) continue
        wins.push({
          x: b.x + padX + col * colW + (colW - ww) / 2,
          y: (480 - b.h) + 5 + row * rowH + (rowH - wh) / 2,
          w: ww, h: wh,
          bright: r() > 0.50,
        })
      }
    }
  }
  return wins
})()

// Dim cool-toned windows for non-glow buildings
const REGULAR_WINDOWS: WinDot[] = (() => {
  const wins: WinDot[] = []
  let seed = 77331
  const r = () => { seed = (seed * 1664525 + 1013904223) & 0x7fffffff; return seed / 0x7fffffff }
  for (const b of FRONT.filter(bld => !bld.glow && bld.h > 80)) {
    const colW = 13, rowH = 15, ww = 4, wh = 5
    const cols = Math.max(1, Math.floor((b.w - 4) / colW))
    const rows = Math.max(1, Math.floor((b.h - 8) / rowH))
    const padX = (b.w - cols * colW) / 2
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (r() > 0.22) continue
        wins.push({
          x: b.x + padX + col * colW + (colW - ww) / 2,
          y: (480 - b.h) + 4 + row * rowH + (rowH - wh) / 2,
          w: ww, h: wh,
          bright: r() > 0.82,
        })
      }
    }
  }
  return wins
})()

// Stars — LCG seeded (identical on server + client, no hydration mismatch)
interface Star { x: number; y: number; size: number; opacity: number; delay: number }
function makeStars(n: number): Star[] {
  let s = 98765
  const r = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff }
  return Array.from({ length: n }, () => ({
    x: r() * 97 + 1,
    y: r() * 62,
    size: r() * 1.6 + 0.4,
    opacity: r() * 0.5 + 0.15,
    delay: r() * 5,
  }))
}
const STARS = makeStars(65)

const DISTRICTS = [
  { name: 'Moon District',   tier: 'Top 100',    color: '#f7931a', bg: 'rgba(247,147,26,0.08)',  border: 'rgba(247,147,26,0.25)', glow: 'rgba(247,147,26,0.18)',  desc: 'The elite. The whales. The heart of the city.' },
  { name: 'Bitcoin Quarter', tier: 'Top 1,000',  color: '#6b8fff', bg: 'rgba(107,143,255,0.08)', border: 'rgba(107,143,255,0.22)', glow: 'rgba(107,143,255,0.14)', desc: 'Conviction builders. Established presence.' },
  { name: 'Runes Avenue',    tier: 'Top 10,000', color: '#ff8c00', bg: 'rgba(255,140,0,0.08)',   border: 'rgba(255,140,0,0.22)',   glow: 'rgba(255,140,0,0.14)',   desc: 'Commercial heartbeat of DogCity.' },
  { name: 'Suburbs',         tier: 'Top 86k',    color: '#2d9e5f', bg: 'rgba(45,158,95,0.08)',   border: 'rgba(45,158,95,0.22)',   glow: 'rgba(45,158,95,0.12)',   desc: 'Community. Growth. Daily life.' },
  { name: 'Outer Ring',      tier: 'All holders', color: '#6b6b8a', bg: 'rgba(107,107,138,0.06)', border: 'rgba(107,107,138,0.18)', glow: 'rgba(107,107,138,0.10)', desc: 'Every citizen counts. Every wallet matters.' },
]

const FEATURES = [
  {
    icon: Building2,
    title: 'Claim Your Building',
    price: '10,000 DOG',
    desc: 'Recognize your address. Link your X handle. Put your name on the map — permanently.',
    color: '#f7931a',
    glow: 'rgba(247,147,26,0.15)',
  },
  {
    icon: ShoppingBag,
    title: 'Commercial License',
    price: '50,000 DOG',
    desc: 'Open your storefront in DogCity. Serve the global $DOG community — on-chain and in real life.',
    color: '#6b8fff',
    glow: 'rgba(107,143,255,0.12)',
  },
  {
    icon: Globe,
    title: 'Global Rewards Club',
    price: 'Commercial holders',
    desc: 'DOG holders in every city. Coffee shops, services, experiences — exclusively for the community.',
    color: '#ff8c00',
    glow: 'rgba(255,140,0,0.12)',
  },
]

const STATS = [
  { value: '86,317', label: 'CITIZENS'      },
  { value: '5',      label: 'DISTRICTS'     },
  { value: '1',      label: 'ON-CHAIN CITY' },
  { value: '∞',      label: 'POSSIBILITIES' },
]

// ─── Animation variants ─────────────────────────────────────────────────────

const fadeUp = {
  hidden:  { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const } },
}

const stagger = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.1 } },
}

// ─── Reusable scroll-reveal wrapper ─────────────────────────────────────────

function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-8% 0px' })
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 36 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}

// ─── Cursor glow ─────────────────────────────────────────────────────────────

function CursorGlow() {
  const mx = useMotionValue(-400)
  const my = useMotionValue(-400)
  const sx = useSpring(mx, { stiffness: 80, damping: 28 })
  const sy = useSpring(my, { stiffness: 80, damping: 28 })

  useEffect(() => {
    const fn = (e: MouseEvent) => { mx.set(e.clientX - 220); my.set(e.clientY - 220) }
    window.addEventListener('mousemove', fn)
    return () => window.removeEventListener('mousemove', fn)
  }, [mx, my])

  return (
    <motion.div
      className="fixed pointer-events-none z-[200] w-[440px] h-[440px] rounded-full"
      style={{
        x: sx, y: sy,
        background: 'radial-gradient(circle, rgba(247,147,26,0.045) 0%, transparent 70%)',
      }}
    />
  )
}

// ─── Architectural setback profiles (indexed by building x) ──────────────────
const GY_CITY = 480

const SETBACKS: Record<number, Array<{ fromH: number; inset: number }>> = {
  670: [{ fromH: 168, inset: 8 }],
  722: [{ fromH: 178, inset: 12 }, { fromH: 352, inset: 16 }],
  806: [],
  898: [{ fromH: 145, inset: 6 }],
}

function mkSetbackPath2D(
  b: Building,
  scX: (x: number) => number,
  scY: (y: number) => number,
): Path2D {
  const steps = (SETBACKS[b.x] ?? []).slice().sort((a, v) => a.fromH - v.fromH)
  const p = new Path2D()
  let lx = b.x, rx = b.x + b.w
  const ys: number[] = []
  const lxArr: number[] = [lx]
  const rxArr: number[] = [rx]
  p.moveTo(scX(lx), scY(GY_CITY))
  for (const s of steps) {
    const sy = GY_CITY - s.fromH
    ys.push(sy)
    p.lineTo(scX(lx), scY(sy))
    p.lineTo(scX(lx + s.inset), scY(sy))
    lx += s.inset; rx -= s.inset
    lxArr.push(lx); rxArr.push(rx)
  }
  p.lineTo(scX(lx), scY(GY_CITY - b.h))
  p.lineTo(scX(rx), scY(GY_CITY - b.h))
  for (let i = steps.length - 1; i >= 0; i--) {
    p.lineTo(scX(rxArr[i + 1]), scY(ys[i]))
    p.lineTo(scX(rxArr[i]), scY(ys[i]))
  }
  p.lineTo(scX(rxArr[0]), scY(GY_CITY))
  p.closePath()
  return p
}

// ─── Canvas city — animated, WebGL-quality rendering ─────────────────────────

function CityCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    // ── mutable animation state (no React re-renders) ──
    const glowB = FRONT.filter(b => b.glow)
    let W = 0, H = 0, dpr = 1, cachedW = -1

    const rain = Array.from({ length: 220 }, () => ({
      x: Math.random(), y: Math.random(),
      speed: 0.30 + Math.random() * 0.22,
      len:   0.009 + Math.random() * 0.015,
      a:     0.05  + Math.random() * 0.10,
    }))

    const allWin = [...REGULAR_WINDOWS, ...MOON_WINDOWS]
    const winLit    = allWin.map(() => Math.random() > 0.25)
    const winBright = allWin.map(() => 0.4 + Math.random() * 0.6)
    const winNext   = allWin.map(() => Math.random() * 6)

    let glowPaths: Path2D[] = []
    let time = 0

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio ?? 1, 2)
      const r = canvas.getBoundingClientRect()
      W = r.width; H = r.height
      canvas.width  = W * dpr
      canvas.height = H * dpr
      cachedW = -1
    }
    resize()
    window.addEventListener('resize', resize)

    let last = 0
    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now; time += dt

      ctx.save()
      ctx.scale(dpr, dpr)

      // coordinate helpers: city space (1440×480) → canvas
      const cs = W / 1440
      const yo = H - GY_CITY * cs   // city top in canvas y
      const GYc = H                  // ground in canvas y
      const scX = (x: number) => x * cs
      const scY = (y: number) => yo + y * cs

      // rebuild Path2D cache on resize
      if (cachedW !== W) {
        glowPaths = glowB.map(b => mkSetbackPath2D(b, scX, scY))
        cachedW = W
      }

      // ── SKY ──
      const skyG = ctx.createLinearGradient(0, 0, 0, H)
      skyG.addColorStop(0,    '#010309')
      skyG.addColorStop(0.55, '#020508')
      skyG.addColorStop(1,    '#060d18')
      ctx.fillStyle = skyG
      ctx.fillRect(0, 0, W, H)

      // ── STARS ──
      for (const s of STARS) {
        const flk = 0.55 + 0.45 * Math.sin(time * (0.3 + s.delay * 0.07) + s.x * 8.1)
        ctx.globalAlpha = s.opacity * flk
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(s.x / 100 * W, (s.y / 100) * H * 0.72, s.size * 0.65, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      // ── CITY BLOOM ──
      const bloomG = ctx.createRadialGradient(W * 0.54, GYc, 0, W * 0.54, GYc, W * 0.52)
      bloomG.addColorStop(0,    'rgba(247,147,26,0.30)')
      bloomG.addColorStop(0.38, 'rgba(180,95,12,0.10)')
      bloomG.addColorStop(1,    'rgba(0,0,0,0)')
      ctx.fillStyle = bloomG
      ctx.fillRect(0, H * 0.25, W, H * 0.75)

      // ── BACK BUILDINGS (depth layer) ──
      ctx.fillStyle = '#0d1422'
      for (const b of BACK)
        ctx.fillRect(scX(b.x), scY(GY_CITY - b.h), scX(b.w), scX(b.h))

      // ── DEPTH HAZE ──
      const hazeG = ctx.createLinearGradient(0, scY(250), 0, GYc)
      hazeG.addColorStop(0, 'rgba(5,9,18,0)')
      hazeG.addColorStop(1, 'rgba(5,9,18,0.50)')
      ctx.fillStyle = hazeG
      ctx.fillRect(0, scY(250), W, GYc - scY(250))

      // ── REGULAR BUILDINGS ──
      ctx.fillStyle = '#07090e'
      for (const b of FRONT)
        if (!b.glow) ctx.fillRect(scX(b.x), scY(GY_CITY - b.h), scX(b.w), scX(b.h))

      // ── ROOFTOP CAPS (subtle sky-reflection edge) ──
      ctx.fillStyle = 'rgba(130,158,235,0.09)'
      for (const b of FRONT)
        if (!b.glow && b.h > 100)
          ctx.fillRect(scX(b.x), scY(GY_CITY - b.h), scX(b.w), Math.max(1, cs))

      // ── REGULAR WINDOWS — cool blue, individual flicker ──
      for (let i = 0; i < REGULAR_WINDOWS.length; i++) {
        winNext[i] -= dt
        if (winNext[i] <= 0) {
          winLit[i]    = Math.random() > 0.15
          winBright[i] = 0.35 + Math.random() * 0.65
          winNext[i]   = 1.5  + Math.random() * 10
        }
        if (!winLit[i]) continue
        const w = REGULAR_WINDOWS[i]
        ctx.globalAlpha = winBright[i] * (w.bright ? 0.30 : 0.15)
        ctx.fillStyle = '#8faaee'
        ctx.fillRect(scX(w.x), scY(w.y), scX(w.w), scX(w.h))
      }
      ctx.globalAlpha = 1

      // ── MOON DISTRICT — wide ambient glow pass ──
      ctx.save()
      ctx.shadowColor = 'rgba(247,147,26,0.70)'
      ctx.shadowBlur  = 55 * cs
      ctx.fillStyle   = 'rgba(14,18,32,0.01)'
      for (const p of glowPaths) ctx.fill(p)
      ctx.restore()

      // ── MOON DISTRICT — buildings with tight crisp glow ──
      ctx.save()
      ctx.shadowColor = 'rgba(247,147,26,1)'
      ctx.shadowBlur  = 14 * cs
      ctx.fillStyle   = '#0d1220'
      for (const p of glowPaths) ctx.fill(p)
      ctx.restore()

      // ── MOON DISTRICT WINDOWS — orange, individual flicker ──
      const rn = REGULAR_WINDOWS.length
      for (let i = 0; i < MOON_WINDOWS.length; i++) {
        const wi = rn + i
        winNext[wi] -= dt
        if (winNext[wi] <= 0) {
          winLit[wi]    = Math.random() > 0.05
          winBright[wi] = 0.55 + Math.random() * 0.45
          winNext[wi]   = 0.3  + Math.random() * 7
        }
        if (!winLit[wi]) continue
        const w = MOON_WINDOWS[i]
        ctx.globalAlpha = winBright[wi] * (w.bright ? 0.94 : 0.55)
        ctx.fillStyle = w.bright ? '#f7931a' : '#c97a18'
        ctx.fillRect(scX(w.x), scY(w.y), scX(w.w), scX(w.h))
      }
      ctx.globalAlpha = 1

      // ── TOP STRIPES + RIM LIGHTS ──
      for (const b of glowB) {
        const steps = (SETBACKS[b.x] ?? []).slice().sort((a, v) => a.fromH - v.fromH)
        let lx = b.x, rw = b.w
        for (const s of steps) { lx += s.inset; rw -= s.inset * 2 }
        // top stripe at narrowest section
        ctx.fillStyle = 'rgba(247,147,26,0.90)'
        ctx.fillRect(scX(lx), scY(GY_CITY - b.h) - Math.max(1, cs), scX(rw), Math.max(2, 2 * cs))
        // outer vertical rim lights
        ctx.fillStyle = 'rgba(247,147,26,0.24)'
        ctx.fillRect(scX(b.x), scY(GY_CITY - b.h), Math.max(2, 2 * cs), scX(b.h))
        ctx.fillRect(scX(b.x + b.w) - Math.max(2, 2 * cs), scY(GY_CITY - b.h), Math.max(2, 2 * cs), scX(b.h))
      }

      // ── SETBACK CORNICE LINES ──
      ctx.fillStyle = 'rgba(247,147,26,0.44)'
      for (const b of glowB)
        for (const s of (SETBACKS[b.x] ?? []))
          ctx.fillRect(scX(b.x), scY(GY_CITY - s.fromH) - Math.max(1, cs * 0.8), scX(b.w), Math.max(1.5, 1.5 * cs))

      // ── RAIN ──
      ctx.save()
      ctx.lineWidth = Math.max(0.5, 0.65 * cs)
      for (const d of rain) {
        ctx.globalAlpha = d.a
        ctx.strokeStyle = '#6888a8'
        ctx.beginPath()
        ctx.moveTo(d.x * W,                    d.y * H)
        ctx.lineTo(d.x * W - d.len * W * 0.055, d.y * H + d.len * H)
        ctx.stroke()
        d.y += d.speed * dt * 0.85
        d.x -= d.speed * dt * 0.04
        if (d.y > 1.06) { d.y = -0.04; d.x = Math.random() }
        if (d.x < -0.04) d.x = 1.04
      }
      ctx.globalAlpha = 1
      ctx.restore()

      // ── SPIRE + BLINKING BEACON ──
      {
        const sx = scX(760), sy = scY(GY_CITY - 425) - 50 * cs
        ctx.save()
        ctx.shadowColor = '#f7931a'; ctx.shadowBlur = 10 * cs
        ctx.strokeStyle = 'rgba(247,147,26,0.90)'; ctx.lineWidth = Math.max(1.5, 2 * cs)
        ctx.beginPath(); ctx.moveTo(scX(760), scY(GY_CITY - 425)); ctx.lineTo(sx, sy); ctx.stroke()
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time * 3.8)
        ctx.fillStyle = '#f7931a'
        ctx.beginPath(); ctx.arc(sx, sy, 3.5 * cs, 0, Math.PI * 2); ctx.fill()
        ctx.restore()
      }

      // ── HORIZON HEAT ──
      const horizG = ctx.createLinearGradient(0, scY(430), 0, GYc)
      horizG.addColorStop(0, 'rgba(247,147,26,0.30)')
      horizG.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = horizG
      ctx.fillRect(scX(120), scY(430), scX(1200), scX(50))

      // Ground line
      ctx.strokeStyle = 'rgba(247,147,26,0.25)'; ctx.lineWidth = Math.max(1, cs)
      ctx.beginPath(); ctx.moveTo(0, GYc - Math.max(1, cs)); ctx.lineTo(W, GYc - Math.max(1, cs)); ctx.stroke()

      // ── SKY TOP FADE ──
      const fadeG = ctx.createLinearGradient(0, 0, 0, H * 0.30)
      fadeG.addColorStop(0, 'rgba(1,2,6,0.96)')
      fadeG.addColorStop(1, 'rgba(1,2,6,0)')
      ctx.fillStyle = fadeG
      ctx.fillRect(0, 0, W, H * 0.30)

      ctx.restore()
      rafRef.current = requestAnimationFrame(frame)
    }

    rafRef.current = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ display: 'block' }}
      aria-hidden="true"
    />
  )
}

// ─── Hero section ────────────────────────────────────────────────────────────

function HeroSection() {
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })

  const moonY     = useTransform(scrollYProgress, [0, 1], ['0%', '50%'])
  const titleY    = useTransform(scrollYProgress, [0, 0.75], ['0%', '-28%'])
  const titleO    = useTransform(scrollYProgress, [0, 0.55], [1, 0])

  const TITLE = 'DOGCITY'

  return (
    <section
      ref={heroRef}
      className="relative overflow-hidden"
      style={{ minHeight: 'calc(100vh - 56px)' }}
    >
      {/* Perspective grid floor */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(247,147,26,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(247,147,26,0.025) 1px, transparent 1px)
          `,
          backgroundSize: '56px 56px',
          maskImage: 'linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 55%)',
        }}
      />

      {/* Moon */}
      <motion.div
        className="absolute top-12 right-[8%] md:right-[12%] pointer-events-none"
        style={{ y: moonY }}
      >
        {/* Atmospheric halo rings */}
        <div className="absolute inset-0 rounded-full" style={{
          transform: 'scale(3.2)',
          background: 'radial-gradient(circle, rgba(255,230,170,0.04) 30%, transparent 70%)',
        }}/>
        <div className="absolute inset-0 rounded-full" style={{
          transform: 'scale(2.0)',
          background: 'radial-gradient(circle, rgba(255,235,185,0.08) 40%, transparent 70%)',
        }}/>
        <div className="absolute inset-0 rounded-full" style={{
          transform: 'scale(1.35)',
          background: 'radial-gradient(circle, rgba(255,245,215,0.13) 50%, transparent 70%)',
        }}/>
        {/* Moon sphere — 3-stop gradient with shadowed edge */}
        <div
          className="relative w-28 h-28 md:w-40 md:h-40 rounded-full"
          style={{
            background: 'radial-gradient(circle at 38% 36%, #f2f0e0 0%, #ddd8c0 48%, #b8b09a 100%)',
            boxShadow: `
              inset -6px -5px 18px rgba(0,0,0,0.32),
              inset  3px  3px  8px rgba(255,255,255,0.08),
              0 0 30px rgba(255,238,195,0.35),
              0 0 70px rgba(255,215,140,0.20),
              0 0 150px rgba(247,147,26,0.12),
              0 0 280px rgba(247,147,26,0.07)
            `,
          }}
        />
      </motion.div>

      {/* Hero content */}
      <motion.div
        className="relative z-10 flex flex-col items-center justify-center text-center px-6"
        style={{ y: titleY, opacity: titleO, minHeight: 'calc(100vh - 56px)', paddingBottom: '40vh' }}
      >
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="mb-8 flex items-center gap-2 px-4 py-1.5 border rounded-full"
          style={{
            borderColor: 'rgba(247,147,26,0.25)',
            background: 'rgba(247,147,26,0.06)',
          }}
        >
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-lava"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
          />
          <span className="font-mono text-[10px] tracking-[0.25em] font-semibold text-lava/80 uppercase">
            Coming Soon
          </span>
        </motion.div>

        {/* Title — letter by letter */}
        <h1
          className="font-display font-black leading-none select-none"
          style={{ fontSize: 'clamp(4rem, 14vw, 11rem)' }}
          aria-label="DogCity"
        >
          {TITLE.split('').map((char, i) => (
            <motion.span
              key={i}
              className="inline-block"
              style={{
                color: '#EDEDED',
                textShadow: '0 0 80px rgba(247,147,26,0.20), 0 0 160px rgba(247,147,26,0.08)',
              }}
              initial={{ opacity: 0, y: 60, rotateX: -40 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{
                delay: 0.45 + i * 0.07,
                duration: 0.55,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              {char}
            </motion.span>
          ))}
        </h1>

        {/* Subtitle */}
        <motion.p
          className="mt-5 md:mt-6 font-mono text-sm md:text-base tracking-widest max-w-lg"
          style={{ color: 'rgba(237,237,237,0.45)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1, duration: 0.8 }}
        >
          The first on-chain city of Bitcoin Runes.
          <br className="hidden md:block" />
          {' '}86,317 holders. 5 districts. One living city.
        </motion.p>

        {/* CTA */}
        <motion.a
          href="https://x.com/dogdatabtc"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-10 flex items-center gap-2.5 px-7 py-3 font-mono text-sm font-semibold tracking-wide rounded-xl transition-all duration-300"
          style={{
            background: 'linear-gradient(135deg, #f7931a, #e8820e)',
            color: '#000',
            boxShadow: '0 0 28px rgba(247,147,26,0.3)',
          }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4, duration: 0.6 }}
          whileHover={{
            scale: 1.04,
            boxShadow: '0 0 48px rgba(247,147,26,0.45)',
          }}
          whileTap={{ scale: 0.97 }}
        >
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          Follow @dogdatabtc
          <ExternalLink className="w-3.5 h-3.5 opacity-70" />
        </motion.a>
      </motion.div>

      {/* Canvas — full hero background: sky, stars, buildings, rain, glow */}
      <CityCanvas />

      {/* Bottom fade into next section */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
        style={{ background: 'linear-gradient(to top, #030309, transparent)' }}
      />
    </section>
  )
}

// ─── Stats section ───────────────────────────────────────────────────────────

function StatsSection() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-10% 0px' })

  return (
    <section className="py-20 md:py-28 px-6">
      <div className="max-w-5xl mx-auto">
        <Reveal className="text-center mb-14">
          <p className="font-mono text-[10px] tracking-[0.3em] text-lava/60 uppercase mb-3">The Numbers</p>
          <h2 className="font-display font-bold text-3xl md:text-5xl text-snow/90 tracking-tight">
            86,317 Citizens.{' '}
            <span style={{ color: '#f7931a' }}>One City.</span>
          </h2>
        </Reveal>

        <motion.div
          ref={ref}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6"
          variants={stagger}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
        >
          {STATS.map((s, i) => (
            <motion.div
              key={i}
              variants={fadeUp}
              className="relative rounded-2xl p-6 md:p-8 text-center overflow-hidden group"
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
              }}
              whileHover={{
                borderColor: 'rgba(247,147,26,0.25)',
                background: 'rgba(247,147,26,0.04)',
                scale: 1.02,
                transition: { duration: 0.2 },
              }}
            >
              <div
                className="font-display font-black text-4xl md:text-5xl mb-2"
                style={{ color: '#f7931a' }}
              >
                {s.value}
              </div>
              <div className="font-mono text-[10px] tracking-[0.2em] text-snow/40 uppercase">
                {s.label}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

// ─── Districts section ───────────────────────────────────────────────────────

function DistrictsSection() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-8% 0px' })

  return (
    <section className="py-20 md:py-28 px-6">
      <div className="max-w-6xl mx-auto">
        <Reveal className="text-center mb-14">
          <p className="font-mono text-[10px] tracking-[0.3em] text-lava/60 uppercase mb-3">Urban Planning</p>
          <h2 className="font-display font-bold text-3xl md:text-5xl text-snow/90 tracking-tight">
            5 Districts.{' '}
            <span style={{ color: '#f7931a' }}>Every holder has a home.</span>
          </h2>
        </Reveal>

        <motion.div
          ref={ref}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4"
          variants={stagger}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
        >
          {DISTRICTS.map((d, i) => (
            <motion.div
              key={i}
              variants={fadeUp}
              className="relative rounded-2xl p-5 overflow-hidden cursor-default"
              style={{
                background: d.bg,
                border: `1px solid ${d.border}`,
              }}
              whileHover={{
                scale: 1.03,
                background: d.bg.replace('0.08', '0.14').replace('0.06', '0.10'),
                borderColor: d.color,
                boxShadow: `0 0 32px ${d.glow ?? 'transparent'}`,
                transition: { duration: 0.22 },
              }}
            >
              {/* Color top bar */}
              <div
                className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl"
                style={{ background: d.color }}
              />

              <div
                className="font-mono text-[9px] tracking-[0.25em] uppercase font-bold mb-2 mt-1"
                style={{ color: d.color }}
              >
                {d.tier}
              </div>
              <div className="font-display font-bold text-sm text-snow/90 mb-2 leading-tight">
                {d.name}
              </div>
              <div className="font-mono text-[10px] text-snow/40 leading-relaxed">
                {d.desc}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

// ─── Features section ────────────────────────────────────────────────────────

function FeaturesSection() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-8% 0px' })

  return (
    <section className="py-20 md:py-28 px-6">
      <div className="max-w-5xl mx-auto">
        <Reveal className="text-center mb-14">
          <p className="font-mono text-[10px] tracking-[0.3em] text-lava/60 uppercase mb-3">What&apos;s Coming</p>
          <h2 className="font-display font-bold text-3xl md:text-5xl text-snow/90 tracking-tight">
            Own your place{' '}
            <span style={{ color: '#f7931a' }}>in the city.</span>
          </h2>
        </Reveal>

        <motion.div
          ref={ref}
          className="grid grid-cols-1 md:grid-cols-3 gap-5"
          variants={stagger}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
        >
          {FEATURES.map((f, i) => {
            const Icon = f.icon
            return (
              <motion.div
                key={i}
                variants={fadeUp}
                className="relative rounded-2xl p-6 md:p-8 overflow-hidden group cursor-default"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
                whileHover={{
                  borderColor: f.color,
                  boxShadow: `0 0 40px ${f.glow}`,
                  background: 'rgba(255,255,255,0.03)',
                  y: -4,
                  transition: { duration: 0.22 },
                }}
              >
                {/* Icon */}
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                  style={{ background: `${f.color}14`, border: `1px solid ${f.color}30` }}
                >
                  <Icon className="w-5 h-5" style={{ color: f.color }} />
                </div>

                {/* Price tag */}
                <div
                  className="font-mono text-[9px] tracking-[0.2em] uppercase font-bold mb-2"
                  style={{ color: f.color }}
                >
                  {f.price}
                </div>

                <h3 className="font-display font-bold text-lg text-snow/90 mb-3 leading-snug">
                  {f.title}
                </h3>
                <p className="font-mono text-[11px] text-snow/45 leading-relaxed">
                  {f.desc}
                </p>

                {/* Hover shine sweep */}
                <motion.div
                  className="absolute inset-0 pointer-events-none rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{
                    background: `linear-gradient(135deg, transparent 40%, ${f.color}08 100%)`,
                  }}
                />
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}

// ─── CTA section ─────────────────────────────────────────────────────────────

function CTASection() {
  return (
    <section className="py-24 md:py-32 px-6 relative overflow-hidden">
      {/* Background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(247,147,26,0.06), transparent)',
        }}
      />

      <Reveal className="relative z-10 max-w-2xl mx-auto text-center">
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 font-mono text-[10px] tracking-[0.25em] font-semibold uppercase"
          style={{
            background: 'rgba(247,147,26,0.06)',
            border: '1px solid rgba(247,147,26,0.22)',
            color: 'rgba(247,147,26,0.75)',
          }}
        >
          DOG DATA — The largest $DOG hub
        </div>

        <h2 className="font-display font-black text-3xl md:text-5xl text-snow/90 mb-5 tracking-tight leading-tight">
          Be among the
          <br />
          <span style={{ color: '#f7931a' }}>first citizens.</span>
        </h2>

        <p className="font-mono text-sm text-snow/40 mb-10 leading-relaxed">
          Follow us on X for launch updates, early access, and the first look
          at your building in DogCity.
        </p>

        <motion.a
          href="https://x.com/dogdatabtc"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-3 px-8 py-3.5 font-mono text-sm font-bold tracking-wide rounded-xl transition-all duration-300"
          style={{
            background: 'linear-gradient(135deg, #f7931a, #e8820e)',
            color: '#000',
            boxShadow: '0 0 32px rgba(247,147,26,0.25)',
          }}
          whileHover={{
            scale: 1.04,
            boxShadow: '0 0 56px rgba(247,147,26,0.42)',
          }}
          whileTap={{ scale: 0.97 }}
        >
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          Follow @dogdatabtc
        </motion.a>

        {/* DOG Data link */}
        <p className="mt-6 font-mono text-[10px] tracking-widest text-snow/25">
          POWERED BY{' '}
          <a href="/" className="text-lava/60 hover:text-lava transition-colors duration-200">
            DOGDATA.XYZ
          </a>
        </p>
      </Reveal>
    </section>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function CityComingSoon() {
  return (
    <motion.div
      className="relative bg-[#030309] overflow-x-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Scanlines overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-[150]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.012) 3px, rgba(0,0,0,0.012) 4px)',
        }}
      />

      <CursorGlow />
      <HeroSection />
      <StatsSection />
      <DistrictsSection />
      <FeaturesSection />
      <CTASection />
    </motion.div>
  )
}
