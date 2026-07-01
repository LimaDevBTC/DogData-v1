'use client'

import { useRef, useEffect, useCallback } from 'react'
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useMotionValue,
  useInView,
} from 'framer-motion'
import { Building2, ShoppingBag, Globe, ExternalLink } from 'lucide-react'

// ─── Star field data (deterministic LCG — no Math.random in render) ───────────

interface Star { x: number; y: number; size: number; opacity: number; delay: number }

function makeStars(n: number): Star[] {
  let s = 98765
  const r = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff }
  return Array.from({ length: n }, () => ({
    x: r() * 96 + 2, y: r() * 60 + 1,
    size: r() * 1.5 + 0.4,
    opacity: r() * 0.5 + 0.15,
    delay: r() * 5,
  }))
}
const STARS = makeStars(72)

// ─── Static data ──────────────────────────────────────────────────────────────

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

// ─── Animation variants ────────────────────────────────────────────────────────

const fadeUp = {
  hidden:  { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const } },
}

const stagger = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.1 } },
}

// ─── Reusable reveal wrapper ───────────────────────────────────────────────────

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

// ─── Cursor glow (global) ─────────────────────────────────────────────────────

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
        background: 'radial-gradient(circle, rgba(247,147,26,0.040) 0%, transparent 70%)',
      }}
    />
  )
}

// ─── Star canvas ──────────────────────────────────────────────────────────────

function StarCanvas({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const raf = useRef(0)

  useEffect(() => {
    const canvas = ref.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    let W = 0, H = 0, dpr = 1, time = 0, last = 0

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio ?? 1, 2)
      const r = canvas.getBoundingClientRect()
      W = r.width; H = r.height
      canvas.width = W * dpr; canvas.height = H * dpr
    }
    resize()
    window.addEventListener('resize', resize)

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05); last = now; time += dt
      ctx.save(); ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, W, H)
      for (const s of STARS) {
        const flk = 0.55 + 0.45 * Math.sin(time * (0.3 + s.delay * 0.07) + s.x * 8.1)
        ctx.globalAlpha = s.opacity * flk
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(s.x / 100 * W, s.y / 100 * H, s.size * 0.6, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
      raf.current = requestAnimationFrame(frame)
    }
    raf.current = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf.current); window.removeEventListener('resize', resize) }
  }, [])

  return <canvas ref={ref} className={className} aria-hidden="true" />
}

// ─── Rain canvas ──────────────────────────────────────────────────────────────

function RainCanvas({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const raf = useRef(0)

  useEffect(() => {
    const canvas = ref.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return

    const rain = Array.from({ length: 160 }, () => ({
      x: Math.random(),
      y: Math.random() * 1.2 - 0.1,
      speed: 0.24 + Math.random() * 0.22,
      len: 0.007 + Math.random() * 0.013,
      a: 0.035 + Math.random() * 0.075,
    }))
    let W = 0, H = 0, dpr = 1, last = 0

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio ?? 1, 2)
      const r = canvas.getBoundingClientRect()
      W = r.width; H = r.height
      canvas.width = W * dpr; canvas.height = H * dpr
    }
    resize()
    window.addEventListener('resize', resize)

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05); last = now
      ctx.save(); ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, W, H)
      ctx.lineWidth = 0.7
      for (const d of rain) {
        ctx.globalAlpha = d.a
        ctx.strokeStyle = '#6888a8'
        ctx.beginPath()
        ctx.moveTo(d.x * W, d.y * H)
        ctx.lineTo(d.x * W - d.len * W * 0.05, d.y * H + d.len * H)
        ctx.stroke()
        d.y += d.speed * dt * 0.9
        d.x -= d.speed * dt * 0.035
        if (d.y > 1.08) { d.y = -0.04; d.x = Math.random() }
        if (d.x < -0.02) d.x = 1.02
      }
      ctx.restore()
      raf.current = requestAnimationFrame(frame)
    }
    raf.current = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf.current); window.removeEventListener('resize', resize) }
  }, [])

  return <canvas ref={ref} className={className} style={style} aria-hidden="true" />
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function HeroSection() {
  const heroRef        = useRef<HTMLDivElement>(null)
  const imgContainerRef = useRef<HTMLDivElement>(null)
  const imgRef         = useRef<HTMLImageElement>(null)
  const spotlightRef   = useRef<HTMLDivElement>(null)
  const glowLineRef    = useRef<HTMLDivElement>(null)

  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const titleY = useTransform(scrollYProgress, [0, 0.75], ['0%', '-28%'])
  const titleO = useTransform(scrollYProgress, [0, 0.55], [1, 0])
  const moonY  = useTransform(scrollYProgress, [0, 1], ['0%', '50%'])

  // Mouse-driven parallax (no React state — pure MotionValue)
  const mouseX = useMotionValue(0.5)
  const mouseY = useMotionValue(0.5)
  const springX = useSpring(mouseX, { stiffness: 45, damping: 28 })
  const springY = useSpring(mouseY, { stiffness: 45, damping: 28 })
  const imgX = useTransform(springX, [0, 1], [-22, 22])
  const imgY = useTransform(springY, [0, 1], [-10, 10])

  // All hover effects via direct DOM — zero React re-renders on mousemove
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = heroRef.current?.getBoundingClientRect()
    if (rect) {
      mouseX.set((e.clientX - rect.left) / rect.width)
      mouseY.set((e.clientY - rect.top) / rect.height)
    }
    const imgRect = imgContainerRef.current?.getBoundingClientRect()
    if (imgRect && spotlightRef.current) {
      const x = e.clientX - imgRect.left
      const y = e.clientY - imgRect.top
      spotlightRef.current.style.background =
        `radial-gradient(circle 400px at ${x}px ${y}px, rgba(247,147,26,0.28) 0%, rgba(247,147,26,0.07) 42%, transparent 70%)`
    }
  }, [mouseX, mouseY])

  const handleMouseEnter = useCallback(() => {
    if (imgRef.current) {
      imgRef.current.style.transition = 'filter 0.55s ease'
      imgRef.current.style.filter =
        'brightness(1.14) drop-shadow(0 0 60px rgba(247,147,26,0.95)) drop-shadow(0 0 130px rgba(247,147,26,0.38))'
    }
    if (spotlightRef.current) spotlightRef.current.style.opacity = '1'
    if (glowLineRef.current) glowLineRef.current.style.opacity = '1'
  }, [])

  const handleMouseLeave = useCallback(() => {
    mouseX.set(0.5); mouseY.set(0.5)
    if (imgRef.current) {
      imgRef.current.style.transition = 'filter 0.7s ease'
      imgRef.current.style.filter = 'brightness(0.92)'
    }
    if (spotlightRef.current) spotlightRef.current.style.opacity = '0'
    if (glowLineRef.current) glowLineRef.current.style.opacity = '0'
  }, [mouseX, mouseY])

  const TITLE = 'DOGCITY'

  return (
    <section
      ref={heroRef}
      className="relative overflow-hidden bg-black"
      style={{ minHeight: 'calc(100vh - 56px)' }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Twinkling stars — upper sky area */}
      <StarCanvas className="absolute inset-0 w-full h-full pointer-events-none z-0" />

      {/* Subtle grid floor */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(247,147,26,0.022) 1px, transparent 1px),
            linear-gradient(90deg, rgba(247,147,26,0.022) 1px, transparent 1px)
          `,
          backgroundSize: '56px 56px',
          maskImage: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 45%)',
        }}
      />

      {/* Moon */}
      <motion.div
        className="absolute top-12 right-[8%] md:right-[12%] pointer-events-none z-[1]"
        style={{ y: moonY }}
      >
        <div className="absolute inset-0 rounded-full" style={{ transform: 'scale(3.2)', background: 'radial-gradient(circle, rgba(255,230,170,0.04) 30%, transparent 70%)' }} />
        <div className="absolute inset-0 rounded-full" style={{ transform: 'scale(2.0)',  background: 'radial-gradient(circle, rgba(255,235,185,0.08) 40%, transparent 70%)' }} />
        <div className="absolute inset-0 rounded-full" style={{ transform: 'scale(1.35)', background: 'radial-gradient(circle, rgba(255,245,215,0.13) 50%, transparent 70%)' }} />
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

      {/* Text content — upper area, paddingBottom pushes it above the city image */}
      <motion.div
        className="relative z-10 flex flex-col items-center justify-center text-center px-6"
        style={{ y: titleY, opacity: titleO, minHeight: 'calc(100vh - 56px)', paddingBottom: '58vh' }}
      >
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="mb-8 flex items-center gap-2 px-4 py-1.5 border rounded-full"
          style={{ borderColor: 'rgba(247,147,26,0.25)', background: 'rgba(247,147,26,0.06)' }}
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

        {/* Title — letter-by-letter entrance */}
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
                textShadow: '0 0 80px rgba(247,147,26,0.22), 0 0 160px rgba(247,147,26,0.09)',
              }}
              initial={{ opacity: 0, y: 60, rotateX: -40 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ delay: 0.45 + i * 0.07, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            >
              {char}
            </motion.span>
          ))}
        </h1>

        {/* Subtitle */}
        <motion.p
          className="mt-5 md:mt-6 font-mono text-sm md:text-base tracking-widest max-w-lg"
          style={{ color: 'rgba(237,237,237,0.44)' }}
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
            boxShadow: '0 0 28px rgba(247,147,26,0.30)',
          }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4, duration: 0.6 }}
          whileHover={{ scale: 1.04, boxShadow: '0 0 52px rgba(247,147,26,0.48)' }}
          whileTap={{ scale: 0.97 }}
        >
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          Follow @dogdatabtc
          <ExternalLink className="w-3.5 h-3.5 opacity-70" />
        </motion.a>
      </motion.div>

      {/* ── CITY SKYLINE IMAGE — bottom 58vh ─────────────────────────────────── */}
      <div
        ref={imgContainerRef}
        className="absolute bottom-0 left-0 right-0 overflow-hidden"
        style={{ height: '58vh', zIndex: 5 }}
      >
        {/* Parallax wrapper — scaled 1.08 so edges stay hidden during movement */}
        <motion.div
          className="absolute inset-0"
          style={{ x: imgX, y: imgY, scale: 1.08 }}
        >
          {/* The skyline */}
          <img
            ref={imgRef}
            src="/skyline.jpg"
            alt="DogCity Skyline"
            className="w-full h-full object-cover object-top select-none"
            style={{ filter: 'brightness(0.92)', transition: 'filter 0.55s ease' }}
            draggable={false}
          />

          {/* Cursor spotlight — mix-blend-mode:screen turns white lines orange */}
          <div
            ref={spotlightRef}
            className="absolute inset-0 pointer-events-none"
            style={{ mixBlendMode: 'screen', opacity: 0, transition: 'opacity 0.3s ease' }}
          />

          {/* Ambient orange glow at horizon */}
          <div
            className="absolute inset-x-0 bottom-0 pointer-events-none"
            style={{
              height: '40%',
              background: 'linear-gradient(to top, rgba(247,147,26,0.055) 0%, transparent 100%)',
            }}
          />
        </motion.div>

        {/* Orange glow line at the top edge of the image — appears on hover */}
        <div
          ref={glowLineRef}
          className="absolute top-0 inset-x-0 pointer-events-none"
          style={{
            height: '1px',
            background: 'linear-gradient(to right, transparent 0%, rgba(247,147,26,0.6) 20%, rgba(247,147,26,0.9) 50%, rgba(247,147,26,0.6) 80%, transparent 100%)',
            boxShadow: '0 0 20px 4px rgba(247,147,26,0.35)',
            opacity: 0,
            transition: 'opacity 0.5s ease',
            zIndex: 6,
          }}
        />

        {/* Rain particles on top of the city */}
        <RainCanvas className="absolute inset-0 w-full h-full pointer-events-none opacity-55" style={{ zIndex: 4 } as React.CSSProperties} />

        {/* Scanlines for cinematic texture */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            zIndex: 5,
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px)',
          }}
        />

        {/* Sky-to-image fade at the top */}
        <div
          className="absolute top-0 left-0 right-0 pointer-events-none"
          style={{
            height: '130px',
            background: 'linear-gradient(to bottom, #000000 0%, rgba(0,0,0,0) 100%)',
            zIndex: 7,
          }}
        />
      </div>

      {/* Section bottom fade */}
      <div
        className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none"
        style={{ background: 'linear-gradient(to top, #030309, transparent)', zIndex: 10 }}
      />
    </section>
  )
}

// ─── Stats ────────────────────────────────────────────────────────────────────

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
              className="relative rounded-2xl p-6 md:p-8 text-center overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
              whileHover={{
                borderColor: 'rgba(247,147,26,0.25)',
                background: 'rgba(247,147,26,0.04)',
                scale: 1.02,
                transition: { duration: 0.2 },
              }}
            >
              <div className="font-display font-black text-4xl md:text-5xl mb-2" style={{ color: '#f7931a' }}>
                {s.value}
              </div>
              <div className="font-mono text-[10px] tracking-[0.2em] text-snow/40 uppercase">{s.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

// ─── Districts ────────────────────────────────────────────────────────────────

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
              style={{ background: d.bg, border: `1px solid ${d.border}` }}
              whileHover={{
                scale: 1.03,
                background: d.bg.replace('0.08', '0.14').replace('0.06', '0.10'),
                borderColor: d.color,
                boxShadow: `0 0 32px ${d.glow ?? 'transparent'}`,
                transition: { duration: 0.22 },
              }}
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl" style={{ background: d.color }} />
              <div className="font-mono text-[9px] tracking-[0.25em] uppercase font-bold mb-2 mt-1" style={{ color: d.color }}>
                {d.tier}
              </div>
              <div className="font-display font-bold text-sm text-snow/90 mb-2 leading-tight">{d.name}</div>
              <div className="font-mono text-[10px] text-snow/40 leading-relaxed">{d.desc}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

// ─── Features ─────────────────────────────────────────────────────────────────

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
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
                whileHover={{
                  borderColor: f.color,
                  boxShadow: `0 0 40px ${f.glow}`,
                  background: 'rgba(255,255,255,0.03)',
                  y: -4,
                  transition: { duration: 0.22 },
                }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                  style={{ background: `${f.color}14`, border: `1px solid ${f.color}30` }}
                >
                  <Icon className="w-5 h-5" style={{ color: f.color }} />
                </div>
                <div className="font-mono text-[9px] tracking-[0.2em] uppercase font-bold mb-2" style={{ color: f.color }}>
                  {f.price}
                </div>
                <h3 className="font-display font-bold text-lg text-snow/90 mb-3 leading-snug">{f.title}</h3>
                <p className="font-mono text-[11px] text-snow/45 leading-relaxed">{f.desc}</p>
                <motion.div
                  className="absolute inset-0 pointer-events-none rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: `linear-gradient(135deg, transparent 40%, ${f.color}08 100%)` }}
                />
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}

// ─── CTA ──────────────────────────────────────────────────────────────────────

function CTASection() {
  return (
    <section className="py-24 md:py-32 px-6 relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(247,147,26,0.06), transparent)' }}
      />
      <Reveal className="relative z-10 max-w-2xl mx-auto text-center">
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 font-mono text-[10px] tracking-[0.25em] font-semibold uppercase"
          style={{ background: 'rgba(247,147,26,0.06)', border: '1px solid rgba(247,147,26,0.22)', color: 'rgba(247,147,26,0.75)' }}
        >
          DOG DATA — The largest $DOG hub
        </div>
        <h2 className="font-display font-black text-3xl md:text-5xl text-snow/90 mb-5 tracking-tight leading-tight">
          Be among the<br />
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
          className="inline-flex items-center gap-3 px-8 py-3.5 font-mono text-sm font-bold tracking-wide rounded-xl"
          style={{
            background: 'linear-gradient(135deg, #f7931a, #e8820e)',
            color: '#000',
            boxShadow: '0 0 32px rgba(247,147,26,0.25)',
          }}
          whileHover={{ scale: 1.04, boxShadow: '0 0 56px rgba(247,147,26,0.42)' }}
          whileTap={{ scale: 0.97 }}
        >
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          Follow @dogdatabtc
        </motion.a>
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

// ─── Root export ──────────────────────────────────────────────────────────────

export default function CityComingSoon() {
  return (
    <motion.div
      className="relative bg-[#030309] overflow-x-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Global scanlines */}
      <div
        className="fixed inset-0 pointer-events-none z-[150]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.010) 3px, rgba(0,0,0,0.010) 4px)',
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
