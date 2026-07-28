"use client"

// ═══════════════════════════════════════════════════════════════════════════
// DogCity landing — cinematic scrollytelling of the lunar masterplan.
// Built to take over /donate once approved: same shell, same live fund API,
// same Plot Deed lookup, plus the five-phase construction narrative.
//
// This file is now a conductor, not a canvas. Each movement below the hero
// lives in ./sections/* so the page can be reasoned about one beat at a time;
// the shared motion vocabulary they all draw from is ./motion.tsx.
// All dynamic numbers come from /api/donate/leaderboard and /api/plot.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Layout } from "@/components/layout"
import Scrollytelling from "./scrollytelling"
import ConstructionFund from "./sections/construction-fund"
import PlotDeed from "./sections/plot-deed"
import HowItWorks from "./sections/how-it-works"
import Tiers from "./sections/tiers"
import Ordinals from "./sections/ordinals"
import LunarTerrain from "./sections/lunar-terrain"
import Masterplan from "./sections/masterplan"
import Park from "./sections/park"
import FinalCta from "./sections/final-cta"
import type { LeaderboardData } from "./types"

export default function LandingPage() {
  const [lb, setLb] = useState<LeaderboardData | null>(null)

  useEffect(() => {
    fetch("/api/donate/leaderboard")
      .then((r) => r.json())
      .then(setLb)
      .catch(() => {})
  }, [])

  // ── the persistent Build CTA ─────────────────────────────────────────────
  // Two bugs in the previous version, both from the audit: it was gated on a
  // magic `scrollY > 700` that fires *inside* the 500vh hero (which deliberately
  // wants no CTAs, and does not exist at all under reduced motion), and it lived
  // inside the app's z-index:1 stacking context while the hero stage is portaled
  // to <body> at z:5 — so it was painted underneath the hero and invisible.
  // Now: an IntersectionObserver on a sentinel placed after the hero decides
  // when it is allowed, and it portals to <body> above every layer but the grain.
  const afterHero = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  const [showCta, setShowCta] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    const el = afterHero.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => setShowCta(!e.isIntersecting && e.boundingClientRect.top < 0),
      { threshold: 0 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Phones get a full-width bottom bar, not a floating pill. As a pill it sat
  // on top of section content — on a real phone it covered the Stacks donation
  // address outright, which is a usability bug, not a cosmetic one. A bar owns
  // its own strip of screen instead of hovering over someone else's, is a much
  // bigger tap target, and the page reserves matching bottom padding below so
  // nothing is ever permanently hidden behind it. From md up the original
  // floating pill is unchanged.
  const cta = (
    <a
      href="#build"
      aria-hidden={!showCta}
      tabIndex={showCta ? 0 : -1}
      className={`fixed z-[100] font-mono font-bold text-void bg-lava hover:bg-lava-light transition-all duration-500
        inset-x-0 bottom-0 flex items-center justify-center min-h-[56px] px-5 text-[13px]
        border-t border-lava-light/40 shadow-[0_-6px_24px_rgba(0,0,0,0.55)]
        md:inset-x-auto md:bottom-5 md:right-5 md:min-h-0 md:inline-flex md:gap-2 md:py-3
        md:text-[12px] md:border-0 md:shadow-[0_0_30px_rgba(245,110,15,0.35)] ${
        showCta ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"
      }`}
    >
      Build DogCity
    </a>
  )

  return (
    <Layout currentPage="donate" setCurrentPage={() => {}}>
      {/* pb-14 reserves the 56px the mobile CTA bar occupies, so the end of the
          page can never sit underneath it */}
      <div data-dogcity-landing className="bg-void text-snow pb-14 md:pb-0">
        <Scrollytelling raised={lb?.total_received ?? null} founders={lb?.founders_count ?? null} />

        {/* sentinel: everything past this point is allowed to show page chrome */}
        <div ref={afterHero} aria-hidden className="h-px w-full" />

        <ConstructionFund lb={lb} />
        <PlotDeed />
        <HowItWorks />
        <Tiers />
        <Ordinals />
        <LunarTerrain />
        <Masterplan />
        <Park />
        <FinalCta />
      </div>
      {mounted && createPortal(cta, document.body)}
    </Layout>
  )
}
