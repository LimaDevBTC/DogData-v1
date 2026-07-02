"use client"

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { ExternalLink } from 'lucide-react'

// ← Troque esta URL quando a Bitflow confirmar o link final
const BITFLOW_URL =
  'https://bitflow.finance/?utm_source=dogdata&utm_medium=banner&utm_campaign=top_banner&utm_content=main'

const ADVERTISER = 'bitflow'

function getDeviceType(): 'mobile' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop'
  return window.innerWidth < 768 ? 'mobile' : 'desktop'
}

async function trackEvent(event_type: 'impression' | 'click', page: string) {
  try {
    await fetch('/api/ads/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type,
        advertiser: ADVERTISER,
        page,
        device_type: getDeviceType(),
      }),
    })
  } catch {
    // silently fail — never break UI because of analytics
  }
}

export function BitflowBanner() {
  const pathname = usePathname()
  const bannerRef = useRef<HTMLDivElement>(null)
  const impressionFiredRef = useRef(false)

  useEffect(() => {
    // Reset per page navigation so each new page counts as a fresh impression
    impressionFiredRef.current = false

    const sessionKey = `bitflow_imp_${pathname}`
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(sessionKey)) {
      impressionFiredRef.current = true // already counted this session on this page
    }

    const el = bannerRef.current
    if (!el || impressionFiredRef.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !impressionFiredRef.current) {
          impressionFiredRef.current = true
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem(sessionKey, '1')
          }
          trackEvent('impression', pathname)
        }
      },
      { threshold: 0.5 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [pathname])

  function handleClick() {
    trackEvent('click', pathname)
  }

  return (
    <div ref={bannerRef} className="w-full mb-6 md:mb-8">
      <a
        href={BITFLOW_URL}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="block w-full group cursor-pointer"
        onClick={handleClick}
      >
        <div className="relative w-full overflow-hidden bg-[#0A0A0C]/50 backdrop-blur-xl border border-white/[0.05] hover:border-orange-500/[0.2] transition-all duration-300 rounded-xl shadow-sm hover:shadow-[0_8px_32px_-8px_rgba(249,115,22,0.15)]">

          {/* Badge */}
          <div className="absolute top-2 right-2 md:top-3 md:right-3 z-10 flex items-center gap-1">
            <span className="text-gray-400 text-[8px] md:text-[10px] font-mono font-medium uppercase tracking-wide">
              Official Partner
            </span>
            <ExternalLink className="w-2 h-2 md:w-3 md:h-3 text-gray-400" />
          </div>

          {/* Banner content */}
          <div className="relative w-full h-[90px] flex items-center justify-center px-4 sm:px-6 md:px-8 lg:px-12">
            <div className="flex items-center gap-3 sm:gap-4 md:gap-6 lg:gap-8 group-hover:scale-[1.02] transition-all duration-500 ease-out">

              {/* Logo — troque pelo logo real da Bitflow quando tiver o arquivo */}
              <div className="relative w-[50px] h-[50px] sm:w-[60px] sm:h-[60px] md:w-[70px] md:h-[70px] flex-shrink-0">
                <Image
                  src="/bitflow.png"
                  alt="Bitflow"
                  fill
                  className="object-contain drop-shadow-lg"
                  priority
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              </div>

              {/* Text with gradient */}
              <div className="flex items-center gap-2 sm:gap-3">
                <h2
                  className="text-sm sm:text-lg md:text-xl lg:text-2xl xl:text-3xl font-bold uppercase tracking-tight sm:tracking-normal md:tracking-wide whitespace-nowrap"
                  style={{
                    fontFamily: 'var(--font-dm-sans)',
                    background: 'linear-gradient(90deg, #c2410c 0%, #f97316 50%, #fb923c 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  BITFLOW
                </h2>
                <span className="hidden sm:block text-gray-400 text-xs sm:text-sm md:text-base font-mono whitespace-nowrap">
                  — Bitcoin DeFi on Stacks
                </span>
              </div>
            </div>

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-orange-500/0 group-hover:bg-orange-500/5 transition-all duration-300 pointer-events-none" />
          </div>
        </div>
      </a>
    </div>
  )
}
