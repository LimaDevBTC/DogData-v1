"use client"

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import Image from 'next/image'

const BITFLOW_URL =
  'https://app.bitflow.finance/tokens/DOG?utm_source=dogdata.xyz&utm_medium=display&utm_campaign=dog_paid_banner&utm_content=banner_home'

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

export function BitflowBanner({ noMargin = false }: { noMargin?: boolean }) {
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
    <div ref={bannerRef} className={`w-full ${noMargin ? '' : 'mb-6 md:mb-8'}`}>
      <a
        href={BITFLOW_URL}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="block w-full group cursor-pointer"
        onClick={handleClick}
      >
        <div className="relative w-full overflow-hidden bg-[#0A0A0C]/50 backdrop-blur-xl border border-white/[0.05] hover:border-orange-500/[0.2] transition-all duration-300 rounded-xl shadow-sm hover:shadow-[0_8px_32px_-8px_rgba(249,115,22,0.15)]">

          {/* Banner content */}
          <div className="relative w-full h-[90px] flex items-center justify-center">
            <div className="relative h-[60px] w-[200px] sm:h-[70px] sm:w-[240px] md:h-[80px] md:w-[280px] group-hover:scale-[1.03] transition-all duration-500 ease-out">
              <Image
                src="/Bitflow.png"
                alt="Bitflow"
                fill
                className="object-contain drop-shadow-lg"
                priority
              />
            </div>

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/[0.02] transition-all duration-300 pointer-events-none" />
          </div>
        </div>
      </a>
    </div>
  )
}
