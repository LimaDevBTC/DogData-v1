'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion'
import { Building2, MapPin, Coins, Globe, TrendingUp, Users, Zap, Star, Hash } from 'lucide-react'

// ─── FadingVideo ─────────────────────────────────────────────────────────────

function FadingVideo({ src, scale }: { src: string; scale: MotionValue<number> }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.playbackRate = 0.5
    const start = () => {
      v.play().catch(() => {})
      setReady(true)
    }
    if (v.readyState >= 3) {
      start()
    } else {
      v.addEventListener('canplay', start, { once: true })
      return () => v.removeEventListener('canplay', start)
    }
  }, [])

  return (
    <motion.div className="absolute inset-0" style={{ scale }}>
      <video
        ref={videoRef}
        src={src}
        loop
        muted
        playsInline
        className="w-full h-full object-cover"
        style={{ opacity: ready ? 1 : 0, transition: 'opacity 1.8s ease' }}
      />
    </motion.div>
  )
}

// ─── BlurText ─────────────────────────────────────────────────────────────────

interface BlurTextProps {
  text: string
  className?: string
  style?: React.CSSProperties
  delay?: number
  wordDelay?: number
}

function BlurText({ text, className, style, delay = 0, wordDelay = 70 }: BlurTextProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { setVisible(true); obs.disconnect() }
      },
      { threshold: 0.05 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const words = text.split(' ')

  return (
    <div ref={ref} className={className} style={style} aria-label={text}>
      {words.map((word, i) => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            marginRight: i < words.length - 1 ? '0.28em' : 0,
            filter: visible ? 'blur(0px)' : 'blur(14px)',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(10px)',
            transition: `filter 0.75s ease ${delay + i * wordDelay}ms, opacity 0.75s ease ${delay + i * wordDelay}ms, transform 0.7s ease ${delay + i * wordDelay}ms`,
          }}
        >
          {word}
        </span>
      ))}
    </div>
  )
}

// ─── RainCanvas ───────────────────────────────────────────────────────────────

function RainCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf: number
    type Drop = { x: number; y: number; speed: number; opacity: number; length: number }
    let drops: Drop[] = []

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      drops = Array.from({ length: 55 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        speed: 3.5 + Math.random() * 5,
        opacity: 0.03 + Math.random() * 0.055,
        length: 10 + Math.random() * 18,
      }))
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      drops.forEach(d => {
        ctx.beginPath()
        ctx.strokeStyle = `rgba(255,255,255,${d.opacity})`
        ctx.lineWidth = 0.5
        ctx.moveTo(d.x, d.y)
        ctx.lineTo(d.x - 0.8, d.y + d.length)
        ctx.stroke()
        d.y += d.speed
        if (d.y > canvas.height + d.length) {
          d.y = -d.length
          d.x = Math.random() * canvas.width
        }
      })
      raf = requestAnimationFrame(draw)
    }

    resize()
    draw()
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 3, mixBlendMode: 'screen' }}
    />
  )
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const DISTRICTS = [
  {
    id: 'diamond',
    name: 'Diamond District',
    sub: 'Never sold. Never will.',
    holders: '6,035',
    colorFrom: 'rgba(103,232,249,0.12)',
    dot: '#67E8F9',
    icon: Star,
  },
  {
    id: 'silver',
    name: 'Silver District',
    sub: 'Long-term conviction.',
    holders: '18,240',
    colorFrom: 'rgba(203,213,225,0.1)',
    dot: '#CBD5E1',
    icon: TrendingUp,
  },
  {
    id: 'bronze',
    name: 'Bronze District',
    sub: 'Building position.',
    holders: '31,800',
    colorFrom: 'rgba(245,110,15,0.14)',
    dot: '#F56E0F',
    icon: Building2,
  },
  {
    id: 'ordinal',
    name: 'Ordinal District',
    sub: 'Inscribed on Bitcoin. Twice native.',
    holders: '4,280',
    colorFrom: 'rgba(247,147,26,0.14)',
    dot: '#F7931A',
    icon: Hash,
  },
  {
    id: 'airdrop',
    name: 'Airdrop District',
    sub: 'OG recipients. Proven loyalty.',
    holders: '21,450',
    colorFrom: 'rgba(196,181,253,0.12)',
    dot: '#C4B5FD',
    icon: Zap,
  },
  {
    id: 'new',
    name: 'New District',
    sub: 'Growing the ecosystem.',
    holders: '11,792',
    colorFrom: 'rgba(74,222,128,0.1)',
    dot: '#4ADE80',
    icon: Users,
  },
]

const FEATURES = [
  {
    icon: Building2,
    title: 'Claim Your Building',
    desc: 'Every $DOG holder has a building in DogCity. Stake 10,000 DOG to claim ownership and earn passive income from your district.',
    tag: '10,000 DOG',
    color: '#F56E0F',
  },
  {
    icon: MapPin,
    title: 'Register Your Business',
    desc: 'Stake 50,000 DOG to register a commercial business in your building and unlock city-wide revenue sharing.',
    tag: '50,000 DOG',
    color: '#FB923C',
  },
  {
    icon: Coins,
    title: 'Earn from Foot Traffic',
    desc: "Your building's district tier, size, and location determine daily earnings from DogCity's on-chain economic activity.",
    tag: 'Daily Rewards',
    color: '#FBBF24',
  },
  {
    icon: Globe,
    title: '3D On-Chain City',
    desc: 'A living, breathing 3D city where every building represents a real wallet. All data is on-chain, all the time.',
    tag: '89,317 Buildings',
    color: '#67E8F9',
  },
]

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CityComingSoon() {
  const containerRef = useRef<HTMLDivElement>(null)
  const spotlightRef = useRef<HTMLDivElement>(null)

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  })
  const videoScale = useTransform(scrollYProgress, [0, 1], [1, 1.2])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const el = spotlightRef.current
    if (!el) return
    const rect = containerRef.current?.getBoundingClientRect()
    const x = e.clientX - (rect?.left ?? 0)
    const y = e.clientY - (rect?.top ?? 0)
    el.style.transform = `translate(${x - 320}px, ${y - 320}px)`
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative bg-void overflow-x-hidden"
      onMouseMove={handleMouseMove}
    >
      {/* ══════════════════════════════════════════════════════════════ HERO */}
      <section className="relative h-screen min-h-[640px] flex items-center justify-center overflow-hidden">

        <FadingVideo src="/city-hero.mp4" scale={videoScale} />

        {/* Vignette */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 1, background: 'radial-gradient(ellipse 110% 100% at 50% 50%, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.78) 100%)' }}
        />
        {/* Bottom fade */}
        <div
          className="absolute inset-x-0 bottom-0 pointer-events-none"
          style={{ zIndex: 2, height: '45%', background: 'linear-gradient(to top, #000 0%, transparent 100%)' }}
        />
        {/* Top fade */}
        <div
          className="absolute inset-x-0 top-0 pointer-events-none"
          style={{ zIndex: 2, height: '20%', background: 'linear-gradient(to bottom, #000 0%, transparent 100%)' }}
        />

        <RainCanvas />

        {/* Mouse spotlight */}
        <div
          ref={spotlightRef}
          className="absolute pointer-events-none"
          style={{
            zIndex: 4,
            width: 640,
            height: 640,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(245,110,15,0.05) 0%, transparent 65%)',
            willChange: 'transform',
          }}
        />

        {/* Content */}
        <div className="relative z-[5] text-center px-6 max-w-5xl mx-auto w-full">

          {/* Badge — design system style */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center mb-10"
          >
            <div className="liquid-glass rounded-lg px-4 py-1.5 flex items-center gap-2.5 border border-lava/[0.18]">
              <span className="w-1.5 h-1.5 rounded-full bg-lava animate-pulse-dot" />
              <span className="font-mono text-[10px] text-lava/70 tracking-[0.22em] uppercase">
                Coming Soon
              </span>
              <span className="w-px h-3 bg-white/10" />
              <span className="font-mono text-[10px] text-lava tracking-[0.22em] uppercase font-bold">
                DogCity
              </span>
            </div>
          </motion.div>

          {/* Main heading — Syne bold, design system style */}
          <BlurText
            text="Every Holder is a Building."
            className="text-snow mb-6"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2.8rem, 8.5vw, 7.5rem)',
              fontWeight: 800,
              lineHeight: 1.0,
              letterSpacing: '-0.02em',
            }}
            delay={150}
            wordDelay={80}
          />

          {/* Sub — mono small, design system secondary color */}
          <BlurText
            text="89,317 $DOG holders. 6 districts. One living city on Bitcoin."
            className="text-dusty mb-12 mx-auto font-mono"
            style={{
              fontSize: 'clamp(0.78rem, 1.8vw, 0.95rem)',
              lineHeight: 1.7,
              letterSpacing: '0.02em',
              maxWidth: '36rem',
            }}
            delay={550}
            wordDelay={35}
          />

          {/* Stat pills */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-wrap justify-center gap-2.5 mb-12"
          >
            {[
              { value: '89,317', label: 'Holders' },
              { value: '6', label: 'Districts' },
              { value: '5.74%', label: 'Supply Locked' },
            ].map(s => (
              <div
                key={s.label}
                className="liquid-glass rounded-xl px-5 py-3 text-center border border-white/[0.06] min-w-[96px]"
              >
                <div className="font-display font-bold text-snow text-xl tracking-tight">
                  {s.value}
                </div>
                <div className="font-mono text-[9px] text-dusty/60 mt-1 uppercase tracking-[0.18em]">
                  {s.label}
                </div>
              </div>
            ))}
          </motion.div>

          {/* CTA buttons — design system primary + ghost */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-wrap justify-center gap-3"
          >
            <a
              href="https://x.com/dogdatabtc"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2.5 px-7 py-3 bg-gradient-to-r from-lava to-lava-dark text-snow font-mono font-medium text-xs tracking-wide rounded-xl transition-all duration-300 shadow-[0_0_20px_rgba(245,110,15,0.18)] hover:shadow-[0_0_36px_rgba(245,110,15,0.32)] hover:scale-[1.02]"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              Follow for Launch
            </a>

            <a
              href="/"
              className="group flex items-center gap-2 px-7 py-3 bg-white/[0.03] border border-white/[0.07] hover:bg-white/[0.05] hover:border-lava/[0.2] text-dusty hover:text-snow font-mono font-medium text-xs tracking-wide rounded-xl transition-all duration-300"
            >
              Explore DOG Data
              <span className="text-dusty/40 group-hover:text-lava/70 transition-colors duration-200">↗</span>
            </a>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 1 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[5]"
        >
          <motion.div
            animate={{ y: [0, 7, 0] }}
            transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
            className="w-5 h-8 liquid-glass border border-white/[0.06] rounded-full flex items-start justify-center pt-1.5"
          >
            <div className="w-0.5 h-2.5 bg-lava/50 rounded-full" />
          </motion.div>
        </motion.div>
      </section>

      {/* ══════════════════════════════════════════════════════════════ STATS */}
      <section className="relative z-10 px-6 -mt-1 pb-1">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
            viewport={{ once: true, margin: '-80px' }}
            className="liquid-glass-strong rounded-2xl overflow-hidden border border-white/[0.06]"
          >
            <div className="grid grid-cols-2 md:grid-cols-4">
              {[
                { value: '89,317', label: 'Total Holders', sub: 'Bitcoin Rune' },
                { value: '5.74%', label: 'Supply Locked', sub: 'Diamond Paws' },
                { value: '250K+', label: 'UTXOs Tracked', sub: 'Real-time' },
                { value: '10K DOG', label: 'Building Claim', sub: 'To stake' },
              ].map((stat, i) => (
                <div
                  key={i}
                  className="px-6 md:px-8 py-7 text-center border-r border-b md:border-b-0 border-white/[0.05] last:border-r-0"
                >
                  <div className="font-display font-bold text-snow text-2xl md:text-3xl tracking-tight mb-1">
                    {stat.value}
                  </div>
                  <div className="font-mono text-xs text-dusty/70 tracking-wide">
                    {stat.label}
                  </div>
                  <div className="font-mono text-[9px] text-dusty/35 uppercase tracking-[0.15em] mt-0.5">
                    {stat.sub}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════ DISTRICTS */}
      <section className="relative z-10 px-6 py-28 md:py-36">
        <div className="max-w-5xl mx-auto">

          {/* Section header */}
          <div className="mb-14 text-center">
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="font-mono text-[10px] text-lava tracking-[0.28em] uppercase mb-5"
            >
              6 Districts
            </motion.p>
            <BlurText
              text="Find Your Place in the City."
              className="text-snow"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(1.9rem, 5vw, 4rem)',
                fontWeight: 800,
                letterSpacing: '-0.015em',
                lineHeight: 1.05,
              }}
              delay={0}
              wordDelay={85}
            />
            <BlurText
              text="Every holder earns a district based on their $DOG position, age, and on-chain behavioral score."
              className="text-dusty mt-5 mx-auto font-mono"
              style={{ fontSize: '0.8rem', lineHeight: 1.75, letterSpacing: '0.01em', maxWidth: '38rem' }}
              delay={280}
              wordDelay={30}
            />
          </div>

          {/* District grid — 3 col desktop */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {DISTRICTS.map((d, i) => {
              const Icon = d.icon
              return (
                <motion.div
                  key={d.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                  viewport={{ once: true, margin: '-50px' }}
                  whileHover={{ y: -4, scale: 1.012 }}
                  className="relative overflow-hidden rounded-xl cursor-pointer group"
                  style={{ background: 'rgba(10,10,12,0.7)', border: `1px solid ${d.dot}18` }}
                >
                  {/* Hover glow background */}
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                    style={{ background: `radial-gradient(ellipse 100% 60% at 50% 0%, ${d.colorFrom}, transparent)` }}
                  />
                  {/* Top accent line */}
                  <div
                    className="absolute top-0 inset-x-0 h-px opacity-50 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ background: `linear-gradient(90deg, transparent, ${d.dot}60, transparent)` }}
                  />

                  <div className="relative p-6">
                    {/* Icon + status */}
                    <div className="flex items-center justify-between mb-5">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center"
                        style={{ background: `${d.dot}12` }}
                      >
                        <Icon className="w-4 h-4" style={{ color: d.dot }} />
                      </div>
                      <div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: d.dot, boxShadow: `0 0 6px ${d.dot}` }}
                      />
                    </div>

                    {/* Name */}
                    <div
                      className="font-display font-bold text-snow text-lg tracking-tight mb-1"
                    >
                      {d.name}
                    </div>
                    <div className="font-mono text-[11px] text-dusty/60 mb-5 tracking-wide leading-relaxed">
                      {d.sub}
                    </div>

                    {/* Bottom row */}
                    <div className="flex items-end justify-between">
                      <div>
                        <div
                          className="font-mono font-bold text-xl tracking-tight"
                          style={{ color: d.dot }}
                        >
                          {d.holders}
                        </div>
                        <div className="font-mono text-[9px] text-dusty/40 uppercase tracking-[0.15em] mt-0.5">
                          Holders
                        </div>
                      </div>
                      <div
                        className="font-mono text-[9px] uppercase tracking-[0.12em] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                        style={{ color: d.dot }}
                      >
                        Claim →
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════ FEATURES */}
      <section
        className="relative z-10 px-6 py-20 md:py-28"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
      >
        <div className="max-w-5xl mx-auto">

          <div className="mb-14 text-center">
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="font-mono text-[10px] text-lava tracking-[0.28em] uppercase mb-5"
            >
              How It Works
            </motion.p>
            <BlurText
              text="Own Your City."
              className="text-snow"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(1.9rem, 5vw, 4rem)',
                fontWeight: 800,
                letterSpacing: '-0.015em',
                lineHeight: 1.05,
              }}
              delay={0}
              wordDelay={110}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {FEATURES.map((f, i) => {
              const Icon = f.icon
              return (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                  viewport={{ once: true, margin: '-50px' }}
                  className="rounded-xl p-7 group hover:bg-white/[0.02] transition-all duration-300"
                  style={{ background: 'rgba(10,10,12,0.6)', border: '1px solid rgba(255,255,255,0.05)' }}
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center mb-6"
                    style={{ background: `${f.color}12` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: f.color }} />
                  </div>

                  <div className="font-display font-bold text-snow text-lg tracking-tight mb-3">
                    {f.title}
                  </div>

                  <div className="font-mono text-[11px] text-dusty/60 leading-relaxed tracking-wide mb-6">
                    {f.desc}
                  </div>

                  {/* Design-system tag */}
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-[9px] uppercase tracking-[0.15em] border transition-colors duration-300"
                    style={{
                      background: `${f.color}10`,
                      color: f.color,
                      borderColor: `${f.color}28`,
                    }}
                  >
                    <span className="w-1 h-1 rounded-full" style={{ background: f.color }} />
                    {f.tag}
                  </span>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════ CTA */}
      <section className="relative z-10 px-6 py-32 md:py-44">
        <div className="max-w-3xl mx-auto text-center">

          <BlurText
            text="The City Is Being Built."
            className="text-snow mb-6"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2.4rem, 7vw, 5.5rem)',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              lineHeight: 0.97,
            }}
            delay={0}
            wordDelay={100}
          />

          <BlurText
            text="Follow @dogdatabtc on X to be first to claim your building when DogCity launches."
            className="text-dusty mx-auto mb-14 font-mono"
            style={{ fontSize: '0.8rem', lineHeight: 1.8, letterSpacing: '0.01em', maxWidth: '32rem' }}
            delay={320}
            wordDelay={28}
          />

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            viewport={{ once: true }}
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <a
              href="https://x.com/dogdatabtc"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-center gap-2.5 px-8 py-3.5 bg-gradient-to-r from-lava to-lava-dark text-snow font-mono font-medium text-xs tracking-wide rounded-xl transition-all duration-300 shadow-[0_0_24px_rgba(245,110,15,0.18)] hover:shadow-[0_0_40px_rgba(245,110,15,0.32)] hover:scale-[1.02]"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              Follow on X
            </a>
            <a
              href="/"
              className="group flex items-center justify-center gap-2 px-8 py-3.5 bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] hover:border-lava/[0.2] text-dusty hover:text-snow font-mono font-medium text-xs tracking-wide rounded-xl transition-all duration-300"
            >
              Back to DOG DATA
            </a>
          </motion.div>

          {/* Trust strip */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 1.2, delay: 1 }}
            viewport={{ once: true }}
            className="mt-20 pt-8"
            style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
          >
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
              {[
                'Bitcoin L1 Native',
                'Ord Protocol',
                '89K+ Holders Verified',
                'Real-time On-chain Data',
              ].map(item => (
                <div key={item} className="flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-lava/40" />
                  <span className="font-mono text-[9px] text-dusty/40 uppercase tracking-[0.18em]">
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
