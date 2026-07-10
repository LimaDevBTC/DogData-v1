'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion'
import {
  Building2, MapPin, Coins, Globe,
  TrendingUp, Users, Zap, Hash,
  Gem, Code2, Layers, Shield, Anchor, Clock,
} from 'lucide-react'

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

// ─── Districts ────────────────────────────────────────────────────────────────
//
// Named after the figures and protocols that gave DOG its origin.
// Classification is based on on-chain behavioral data from DOG DATA.

const DISTRICTS = [
  {
    id: 'satoshi',
    name: 'Satoshi District',
    sub: 'Never moved a single DOG. The purest conviction on Bitcoin.',
    holders: '6,035',
    colorFrom: 'rgba(247,147,26,0.15)',
    dot: '#F7931A',
    icon: Gem,
    tag: 'Diamond Paws',
  },
  {
    id: 'casey',
    name: 'Casey District',
    sub: 'Holders of Ordinals + DOG. Native to every protocol Casey built.',
    holders: '4,100',
    colorFrom: 'rgba(103,232,249,0.12)',
    dot: '#67E8F9',
    icon: Code2,
    tag: 'Ordinals + Runes',
  },
  {
    id: 'leonidas',
    name: 'Leonidas District',
    sub: 'Runestone holders from the original airdrop. You were there.',
    holders: '8,200',
    colorFrom: 'rgba(196,181,253,0.12)',
    dot: '#C4B5FD',
    icon: Zap,
    tag: 'OG Runestone',
  },
  {
    id: 'genesis',
    name: 'Genesis District',
    sub: 'Received DOG on April 25, 2024. Halving day. Rune #3. History.',
    holders: '21,450',
    colorFrom: 'rgba(252,211,77,0.12)',
    dot: '#FCD34D',
    icon: Clock,
    tag: 'Halving Day',
  },
  {
    id: 'ordinal',
    name: 'Ordinal District',
    sub: 'Bitcoin inscribers. Digital artifacts and DOG in the same wallet.',
    holders: '4,280',
    colorFrom: 'rgba(147,197,253,0.12)',
    dot: '#93C5FD',
    icon: Hash,
    tag: 'Inscriptions',
  },
  {
    id: 'runes',
    name: 'Runes District',
    sub: 'Multi-Rune holders. Builders of the Runes ecosystem on Bitcoin.',
    holders: '3,800',
    colorFrom: 'rgba(251,146,60,0.12)',
    dot: '#FB923C',
    icon: Layers,
    tag: 'Multi-Rune',
  },
  {
    id: 'sovereign',
    name: 'Sovereign District',
    sub: 'Self-custody only. Never touched a CEX. True Bitcoin sovereignty.',
    holders: '14,500',
    colorFrom: 'rgba(74,222,128,0.12)',
    dot: '#4ADE80',
    icon: Shield,
    tag: 'Self-Custody',
  },
  {
    id: 'accumulator',
    name: 'Accumulator District',
    sub: 'Received the airdrop and kept buying. Conviction compounds.',
    holders: '7,100',
    colorFrom: 'rgba(52,211,153,0.12)',
    dot: '#34D399',
    icon: TrendingUp,
    tag: 'Stack Growing',
  },
  {
    id: 'hodler',
    name: 'HODLer District',
    sub: 'Long-term holders. Through every cycle. Position never wavered.',
    holders: '18,200',
    colorFrom: 'rgba(203,213,225,0.1)',
    dot: '#CBD5E1',
    icon: Anchor,
    tag: 'Long-Term',
  },
  {
    id: 'newcomer',
    name: 'Newcomer District',
    sub: 'The next wave. New to DOG, new to what Bitcoin can hold.',
    holders: '11,792',
    colorFrom: 'rgba(253,164,175,0.1)',
    dot: '#FDA4AF',
    icon: Users,
    tag: 'New Entrants',
  },
]

const FEATURES = [
  {
    icon: Building2,
    title: 'Claim Your Building',
    desc: 'Every $DOG wallet already has a building in DogCity — your place is your on-chain history, not money. A Personal License (10,000 DOG to the City Construction Fund) lets you personalize it at the Grand Opening.',
    tag: '10,000 DOG',
    color: '#F56E0F',
  },
  {
    icon: MapPin,
    title: 'Register Your Block',
    desc: 'A one-time Commercial License (50,000 DOG donated to the City Construction Fund) registers a commercial address and unlocks ad space on your building\'s facade — visibility, not yield.',
    tag: '50,000 DOG',
    color: '#FB923C',
  },
  {
    icon: Coins,
    title: 'Make It Yours',
    desc: "Personalize your building and wallet profile. Commercial addresses get ad space on the facade and building editing. A license is a one-time purchase of utility and visibility — never an investment.",
    tag: 'License Perks',
    color: '#FCD34D',
  },
  {
    icon: Globe,
    title: '3D Bitcoin City',
    desc: 'A living city where every building is a real wallet. All ownership is verifiable on Bitcoin\'s base layer. All data is sourced directly from our Bitcoin Core + Ord node.',
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

        <div
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 1, background: 'radial-gradient(ellipse 110% 100% at 50% 50%, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.78) 100%)' }}
        />
        <div
          className="absolute inset-x-0 bottom-0 pointer-events-none"
          style={{ zIndex: 2, height: '45%', background: 'linear-gradient(to top, #000 0%, transparent 100%)' }}
        />
        <div
          className="absolute inset-x-0 top-0 pointer-events-none"
          style={{ zIndex: 2, height: '20%', background: 'linear-gradient(to bottom, #000 0%, transparent 100%)' }}
        />

        <RainCanvas />

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

        <div className="relative z-[5] text-center px-6 max-w-5xl mx-auto w-full">

          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center mb-10"
          >
            <div className="liquid-glass rounded-lg px-4 py-1.5 flex items-center gap-2.5 border border-lava/[0.18]">
              <span className="w-1.5 h-1.5 rounded-full bg-lava animate-pulse-dot" />
              <span className="font-mono text-[10px] text-lava/70 tracking-[0.22em] uppercase">Rune #3</span>
              <span className="w-px h-3 bg-white/10" />
              <span className="font-mono text-[10px] text-dusty/60 tracking-[0.22em] uppercase">Coming Soon</span>
              <span className="w-px h-3 bg-white/10" />
              <span className="font-mono text-[10px] text-lava tracking-[0.22em] uppercase font-bold">DogCity</span>
            </div>
          </motion.div>

          {/* Heading */}
          <BlurText
            text="Every Wallet is a Building."
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

          <BlurText
            text="89,317 $DOG wallets. 10 districts. Born on Bitcoin's halving day."
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

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-wrap justify-center gap-2.5 mb-12"
          >
            {[
              { value: '89,317', label: 'Wallets' },
              { value: '10', label: 'Districts' },
              { value: 'Rune #3', label: 'Protocol Rank' },
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

          {/* CTAs */}
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
                { value: '89,317', label: 'Total Wallets', sub: 'Bitcoin Rune' },
                { value: '5.74%', label: 'Supply Locked', sub: 'Diamond Paws' },
                { value: 'Apr 25, 2024', label: 'Genesis Block', sub: 'Bitcoin Halving' },
                { value: '100B', label: 'Total Supply', sub: 'CC0 · No Team Alloc' },
              ].map((stat, i) => (
                <div
                  key={i}
                  className="px-6 md:px-8 py-7 text-center border-r border-b md:border-b-0 border-white/[0.05] last:border-r-0"
                >
                  <div className="font-display font-bold text-snow text-xl md:text-2xl tracking-tight mb-1">
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
        <div className="max-w-6xl mx-auto">

          <div className="mb-14 text-center">
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="font-mono text-[10px] text-lava tracking-[0.28em] uppercase mb-5"
            >
              10 Districts
            </motion.p>
            <BlurText
              text="Your On-Chain History is Your Address."
              className="text-snow"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(1.8rem, 4.5vw, 3.6rem)',
                fontWeight: 800,
                letterSpacing: '-0.015em',
                lineHeight: 1.05,
              }}
              delay={0}
              wordDelay={70}
            />
            <BlurText
              text="Districts are assigned by DOG DATA based on your wallet's on-chain fingerprint — when you received DOG, how long you've held, what protocols you use, and whether you kept sovereignty."
              className="text-dusty mt-5 mx-auto font-mono"
              style={{ fontSize: '0.78rem', lineHeight: 1.8, letterSpacing: '0.01em', maxWidth: '44rem' }}
              delay={280}
              wordDelay={22}
            />
          </div>

          {/* 5-col grid on desktop, 2-col on mobile */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {DISTRICTS.map((d, i) => {
              const Icon = d.icon
              return (
                <motion.div
                  key={d.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                  viewport={{ once: true, margin: '-40px' }}
                  whileHover={{ y: -4, scale: 1.02 }}
                  className="relative overflow-hidden rounded-xl cursor-pointer group"
                  style={{ background: 'rgba(10,10,12,0.75)', border: `1px solid ${d.dot}18` }}
                >
                  {/* Hover glow */}
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                    style={{ background: `radial-gradient(ellipse 100% 60% at 50% 0%, ${d.colorFrom}, transparent)` }}
                  />
                  {/* Top accent line */}
                  <div
                    className="absolute top-0 inset-x-0 h-px opacity-40 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ background: `linear-gradient(90deg, transparent, ${d.dot}80, transparent)` }}
                  />

                  <div className="relative p-5">
                    {/* Icon */}
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center mb-4"
                      style={{ background: `${d.dot}12` }}
                    >
                      <Icon className="w-4 h-4" style={{ color: d.dot }} />
                    </div>

                    {/* Name */}
                    <div className="font-display font-bold text-snow text-sm tracking-tight mb-1 leading-tight">
                      {d.name}
                    </div>

                    {/* Tag */}
                    <div
                      className="inline-block font-mono text-[8px] uppercase tracking-[0.14em] px-1.5 py-0.5 rounded mb-3"
                      style={{ background: `${d.dot}12`, color: d.dot }}
                    >
                      {d.tag}
                    </div>

                    {/* Sub */}
                    <div className="font-mono text-[10px] text-dusty/50 leading-relaxed mb-4 line-clamp-3">
                      {d.sub}
                    </div>

                    {/* Holders */}
                    <div className="flex items-end justify-between">
                      <div>
                        <div
                          className="font-mono font-bold text-base tracking-tight"
                          style={{ color: d.dot }}
                        >
                          {d.holders}
                        </div>
                        <div className="font-mono text-[8px] text-dusty/35 uppercase tracking-[0.14em] mt-0.5">
                          wallets
                        </div>
                      </div>
                      <div
                        className="font-mono text-[8px] uppercase tracking-[0.1em] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                        style={{ color: d.dot }}
                      >
                        view →
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>

          {/* Districts note */}
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            viewport={{ once: true }}
            className="text-center font-mono text-[10px] text-dusty/35 tracking-wide mt-8"
          >
            District assignment is based on verifiable on-chain data. No self-reporting. No submission required.
          </motion.p>
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
            <BlurText
              text="No transfers. No lock-ups. Just your wallet, your DOG, your building."
              className="text-dusty mt-4 mx-auto font-mono"
              style={{ fontSize: '0.78rem', lineHeight: 1.8, letterSpacing: '0.01em', maxWidth: '30rem' }}
              delay={200}
              wordDelay={35}
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

                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-[9px] uppercase tracking-[0.15em] border"
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

      {/* ════════════════════════════════════════════════════ DON'T TRUST */}
      <section
        className="relative z-10 px-6 py-16 md:py-20"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
      >
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="liquid-glass-strong rounded-2xl border border-white/[0.06] px-8 py-10 text-center"
          >
            <p
              className="font-mono text-[10px] text-lava tracking-[0.28em] uppercase mb-4"
            >
              The Principle
            </p>
            <p
              className="font-display font-bold text-snow text-2xl md:text-4xl tracking-tight mb-4"
              style={{ letterSpacing: '-0.015em' }}
            >
              Don't trust. Verify.
            </p>
            <p className="font-mono text-[11px] text-dusty/60 max-w-xl mx-auto leading-relaxed tracking-wide">
              Every building in DogCity maps to a real wallet, verified against our Bitcoin Core + Ord full node.
              Every district is assigned by on-chain data, not self-declaration.
              Every holding is auditable on Bitcoin's immutable ledger.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════ CONSTRUCTION FUND */}
      <section
        className="relative z-10 px-6 py-16 md:py-24"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
      >
        <div className="max-w-4xl mx-auto">
          <motion.a
            href="/donate"
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="group block liquid-glass-strong rounded-2xl border border-lava/[0.18] px-8 py-9 md:px-10 md:py-10 hover:border-lava/[0.32] transition-all duration-300"
          >
            <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-8">
              <div className="flex-1">
                <p className="font-mono text-[10px] text-lava tracking-[0.28em] uppercase mb-3">
                  City Construction Fund
                </p>
                <p className="font-display font-bold text-snow text-2xl md:text-3xl tracking-tight leading-tight mb-3">
                  The city can't be bought. It can be built.
                </p>
                <p className="font-mono text-[11px] text-dusty/65 leading-relaxed max-w-lg">
                  10M DOG opens the city — and the mint: every building inscribed as an Ordinal on Bitcoin L1,
                  for nothing but network fees. Donate any amount and your name is carved into the Founders'
                  Monument; at 10,000 DOG your license to mint unlocks automatically.
                </p>
              </div>
              <div className="shrink-0">
                <span className="inline-flex items-center gap-2.5 px-7 py-3.5 bg-gradient-to-r from-lava to-lava-dark text-snow font-mono font-medium text-xs tracking-wide rounded-xl transition-all duration-300 shadow-[0_0_20px_rgba(245,110,15,0.18)] group-hover:shadow-[0_0_36px_rgba(245,110,15,0.32)] group-hover:scale-[1.02]">
                  Become a Founder
                  <span className="text-snow/70">↗</span>
                </span>
              </div>
            </div>
          </motion.a>
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
            text="Follow @dogdatabtc on X. When DogCity opens, your district is already waiting."
            className="text-dusty mx-auto mb-14 font-mono"
            style={{ fontSize: '0.8rem', lineHeight: 1.8, letterSpacing: '0.01em', maxWidth: '30rem' }}
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
                'Rune #3 · Bitcoin Native',
                'CC0 License · No Team Alloc',
                'Bitcoin Core + Ord Full Node',
                'Don\'t trust. Verify.',
              ].map(item => (
                <div key={item} className="flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-lava/40" />
                  <span className="font-mono text-[9px] text-dusty/35 uppercase tracking-[0.18em]">
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
