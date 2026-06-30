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

// Front layer — main skyline (SVG viewBox 1440 × 480, ground at y=480)
// Heights are deliberately jagged — no staircase, real city variation
const FRONT: Building[] = [
  // Far left — low rise interspersed with thin spikes
  { x: 0,    w: 45, h: 62  },
  { x: 50,   w: 22, h: 122 }, // thin spike
  { x: 78,   w: 55, h: 76  }, // wide, drops
  // street gap
  { x: 146,  w: 18, h: 168 }, // tall thin
  { x: 170,  w: 42, h: 92  }, // drops back
  { x: 218,  w: 28, h: 138 }, // mid spike
  // street gap
  { x: 254,  w: 16, h: 228 }, // very thin, very tall
  { x: 276,  w: 50, h: 105 }, // wide, low
  // Mid-left — big height swings
  { x: 332,  w: 24, h: 268 }, // tower
  { x: 362,  w: 58, h: 148 }, // wide block, drops
  // street gap
  { x: 426,  w: 20, h: 298 }, // spike up
  { x: 452,  w: 44, h: 172 }, // drops
  { x: 502,  w: 34, h: 322 }, // spike up
  { x: 542,  w: 52, h: 198 }, // drops
  // Pre-Moon District transition
  { x: 600,  w: 26, h: 348 },
  { x: 632,  w: 18, h: 272 }, // dips slightly
  // Moon District — 4 glow towers at center
  { x: 656,  w: 70, h: 388, glow: true },
  { x: 732,  w: 82, h: 425, glow: true }, // tallest — Moon District center
  { x: 820,  w: 66, h: 402, glow: true },
  { x: 892,  w: 24, h: 325, glow: true }, // thin glow spire
  // Right side — mirror chaos, not mirror staircase
  { x: 922,  w: 46, h: 192 }, // drops hard
  { x: 974,  w: 20, h: 286 }, // spike
  { x: 1000, w: 54, h: 158 }, // wide, drops
  { x: 1060, w: 22, h: 245 }, // spike
  { x: 1088, w: 44, h: 132 }, // drops
  // street gap
  { x: 1138, w: 18, h: 195 }, // thin spike
  { x: 1162, w: 48, h: 112 }, // drops
  { x: 1216, w: 20, h: 178 }, // spike
  { x: 1242, w: 52, h: 88  }, // wide, low
  // Far right
  { x: 1300, w: 22, h: 145 }, // thin tower
  { x: 1328, w: 54, h: 68  }, // squat wide
  // street gap
  { x: 1388, w: 20, h: 108 },
  { x: 1414, w: 26, h: 62  },
]

// Back layer — distant buildings, also jagged for depth
const BACK: Building[] = [
  { x: 20,   w: 24, h: 42  },
  { x: 60,   w: 34, h: 92  },
  { x: 140,  w: 22, h: 132 },
  { x: 196,  w: 32, h: 68  },
  { x: 232,  w: 38, h: 108 },
  { x: 278,  w: 18, h: 178 },
  { x: 344,  w: 48, h: 112 },
  { x: 436,  w: 26, h: 228 },
  { x: 510,  w: 40, h: 252 },
  { x: 608,  w: 22, h: 272 },
  { x: 644,  w: 14, h: 208 },
  { x: 670,  w: 62, h: 348 },
  { x: 746,  w: 68, h: 392 },
  { x: 830,  w: 56, h: 365 },
  { x: 906,  w: 20, h: 282 },
  { x: 944,  w: 38, h: 152 },
  { x: 1014, w: 46, h: 225 },
  { x: 1078, w: 34, h: 108 },
  { x: 1104, w: 22, h: 165 },
  { x: 1152, w: 42, h: 85  },
  { x: 1222, w: 24, h: 148 },
  { x: 1252, w: 40, h: 68  },
  { x: 1314, w: 18, h: 115 },
  { x: 1358, w: 36, h: 52  },
  { x: 1404, w: 20, h: 78  },
]

// Deterministic lit windows — Moon District buildings only (no Math.random)
interface WinDot { x: number; y: number; w: number; h: number; bright: boolean }
const MOON_WINDOWS: WinDot[] = (() => {
  const wins: WinDot[] = []
  let seed = 54321
  const r = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
  for (const b of FRONT.filter(bld => bld.glow)) {
    const colW = 12, rowH = 15, ww = 7, wh = 8
    const cols = Math.max(1, Math.floor((b.w - 6) / colW))
    const rows = Math.max(1, Math.floor((b.h - 10) / rowH))
    const padX = (b.w - cols * colW) / 2
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (r() > 0.52) continue
        wins.push({
          x: b.x + padX + col * colW + (colW - ww) / 2,
          y: (480 - b.h) + 5 + row * rowH + (rowH - wh) / 2,
          w: ww, h: wh,
          bright: r() > 0.62,
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

// ─── City skyline SVG ────────────────────────────────────────────────────────

function CitySkyline() {
  const GY = 480
  const glowBuildings = FRONT.filter(b => b.glow)

  // Single silhouette path — one element traces the whole city outline
  const silhouettePath = FRONT.reduce(
    (acc, b) => {
      const rx = Math.min(b.x + b.w, 1440)
      return acc + ` L ${b.x} ${GY} L ${b.x} ${GY - b.h} L ${rx} ${GY - b.h} L ${rx} ${GY}`
    },
    `M 0 ${GY}`
  ) + ` L 1440 ${GY} Z`

  return (
    <svg
      viewBox="0 0 1440 490"
      preserveAspectRatio="xMidYMax slice"
      className="w-full"
      style={{ display: 'block' }}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="cityBloom" cx="54%" cy="100%" rx="52%" ry="68%">
          <stop offset="0%"   stopColor="#f7931a" stopOpacity="0.34"/>
          <stop offset="38%"  stopColor="#d07010" stopOpacity="0.13"/>
          <stop offset="100%" stopColor="#000000" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="moonAmbient" cx="87%" cy="4%" rx="56%" ry="56%">
          <stop offset="0%"   stopColor="#b8ccff" stopOpacity="0.06"/>
          <stop offset="100%" stopColor="transparent" stopOpacity="0"/>
        </radialGradient>
        <linearGradient id="skyFade2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#030309" stopOpacity="1"/>
          <stop offset="60%" stopColor="#030309" stopOpacity="0"/>
        </linearGradient>
        <linearGradient id="horizGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#f7931a" stopOpacity="0.22"/>
          <stop offset="100%" stopColor="transparent" stopOpacity="0"/>
        </linearGradient>
      </defs>

      {/* Moonlight wash */}
      <rect x="0" y="0" width="1440" height="480" fill="url(#moonAmbient)"/>

      {/* City bloom — behind everything */}
      <rect x="0" y="0" width="1440" height="480" fill="url(#cityBloom)"/>

      {/* Back layer — faint distant buildings */}
      <g opacity="0.10" fill="#1c2238">
        {BACK.map((b, i) => (
          <rect key={i} x={b.x} y={GY - b.h} width={b.w} height={b.h}/>
        ))}
      </g>

      {/* ── MAIN SILHOUETTE ── single path, entire city outline */}
      <path d={silhouettePath} fill="#07090f"/>

      {/* Moon District — triple-layer bloom */}
      <g style={{ filter: 'drop-shadow(0 0 10px rgba(247,147,26,1)) drop-shadow(0 0 28px rgba(247,147,26,0.65)) drop-shadow(0 0 65px rgba(247,147,26,0.28))' }}>
        {glowBuildings.map((b, i) => (
          <rect key={i} x={b.x} y={GY - b.h} width={b.w} height={b.h} fill="#0e1320"/>
        ))}
      </g>

      {/* Lit windows — individual rects, deterministic positions */}
      {MOON_WINDOWS.map((w, i) => (
        <rect
          key={i}
          x={w.x} y={w.y} width={w.w} height={w.h} rx="0.5"
          fill={w.bright ? 'rgba(247,147,26,0.92)' : 'rgba(200,125,35,0.50)'}
        />
      ))}

      {/* Moon District: top stripe + rim lighting */}
      {glowBuildings.map((b, i) => (
        <g key={i}>
          <rect x={b.x}             y={GY - b.h} width={b.w}   height={2.5} fill="rgba(247,147,26,0.88)"/>
          <rect x={b.x}             y={GY - b.h} width={2.5}   height={b.h} fill="rgba(247,147,26,0.28)"/>
          <rect x={b.x + b.w - 2.5} y={GY - b.h} width={2.5}   height={b.h} fill="rgba(247,147,26,0.20)"/>
        </g>
      ))}

      {/* Spire on tallest building (x=732, w=82, center≈773) */}
      <line x1={773} y1={55} x2={773} y2={7} stroke="#f7931a" strokeWidth="2.5" opacity="0.90"/>
      <circle cx={773} cy={5} r={4} fill="#f7931a" opacity="0.92"/>

      {/* Blinking rooftop lights */}
      {glowBuildings.map((b, i) => (
        <motion.circle
          key={i}
          cx={b.x + b.w / 2}
          cy={GY - b.h - 7}
          r={3.5}
          fill="#f7931a"
          animate={{ opacity: [0.95, 0.08, 0.95], scale: [1, 1.5, 1] }}
          transition={{ repeat: Infinity, duration: 1.4 + i * 0.35, delay: i * 0.5, ease: 'easeInOut' }}
        />
      ))}

      {/* Ground line */}
      <line x1="0" y1={GY - 1} x2="1440" y2={GY - 1} stroke="rgba(247,147,26,0.20)" strokeWidth="1"/>

      {/* Horizon heat strip */}
      <rect x="180" y={GY - 38} width="1080" height="38" fill="url(#horizGrad)"/>

      {/* Sky fade from top */}
      <rect x="0" y="0" width="1440" height="180" fill="url(#skyFade2)"/>
    </svg>
  )
}

// ─── Hero section ────────────────────────────────────────────────────────────

function HeroSection() {
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })

  const backY     = useTransform(scrollYProgress, [0, 1], ['0%', '30%'])
  const frontY    = useTransform(scrollYProgress, [0, 1], ['0%', '15%'])
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

      {/* Stars */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {STARS.map((star, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              left: `${star.x}%`,
              top:  `${star.y}%`,
              width:  star.size,
              height: star.size,
              opacity: star.opacity,
            }}
            animate={{ opacity: [star.opacity, star.opacity * 0.3, star.opacity] }}
            transition={{
              repeat: Infinity,
              duration: 2.5 + star.delay,
              delay: star.delay,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      {/* Moon */}
      <motion.div
        className="absolute top-12 right-[8%] md:right-[12%] pointer-events-none"
        style={{ y: moonY }}
      >
        <div
          className="w-28 h-28 md:w-40 md:h-40 rounded-full"
          style={{
            background: 'radial-gradient(circle at 35% 35%, rgba(255,255,240,0.95), rgba(220,220,200,0.7))',
            boxShadow: `
              0 0 40px rgba(255,240,200,0.25),
              0 0 80px rgba(255,200,100,0.12),
              0 0 160px rgba(247,147,26,0.08)
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

      {/* Skyline — parallax layers */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none">
        {/* Back layer */}
        <motion.div className="absolute bottom-0 left-0 right-0" style={{ y: backY }}>
          <svg
            viewBox="0 0 1440 240"
            preserveAspectRatio="xMidYMax slice"
            className="w-full"
            aria-hidden="true"
          >
            <g opacity="0.12" fill="#1a1e2e">
              {BACK.filter(b => b.h < 240).map((b, i) => (
                <rect key={i} x={b.x} y={240 - b.h * 0.55} width={b.w} height={b.h * 0.55} />
              ))}
            </g>
          </svg>
        </motion.div>

        {/* Front layer */}
        <motion.div className="absolute bottom-0 left-0 right-0" style={{ y: frontY }}>
          <CitySkyline />
        </motion.div>
      </div>

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
