'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

// Detect browser name from UA
function getBrowser(): string {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent
  if (ua.includes('Edg/')) return 'Edge'
  if (ua.includes('OPR/') || ua.includes('Opera')) return 'Opera'
  if (ua.includes('Chrome/')) return 'Chrome'
  if (ua.includes('Firefox/')) return 'Firefox'
  if (ua.includes('Safari/') && !ua.includes('Chrome')) return 'Safari'
  return 'Other'
}

function getDevice(): 'mobile' | 'tablet' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop'
  if (/Mobi|Android|iPhone/i.test(navigator.userAgent)) return 'mobile'
  if (/Tablet|iPad/i.test(navigator.userAgent)) return 'tablet'
  return 'desktop'
}

function getSessionId(): string {
  const key = 'dog_sid'
  let sid = sessionStorage.getItem(key)
  if (!sid) {
    sid = crypto.randomUUID()
    sessionStorage.setItem(key, sid)
  }
  return sid
}

function getReferrer(): string {
  if (typeof document === 'undefined') return ''
  const ref = document.referrer
  if (!ref) return ''
  try {
    const url = new URL(ref)
    // Drop internal referrers
    if (url.hostname === window.location.hostname) return ''
    return url.hostname
  } catch {
    return ref
  }
}

async function send(payload: object) {
  try {
    await fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch { /* silent */ }
}

export function AnalyticsTracker() {
  const pathname = usePathname()
  const vitalsTrackedRef = useRef(false)

  // Track pageview on each route change
  useEffect(() => {
    send({
      event_type: 'pageview',
      page: pathname,
      referrer: getReferrer(),
      device_type: getDevice(),
      browser: getBrowser(),
      session_id: getSessionId(),
    })
  }, [pathname])

  // Track Web Vitals once per session
  useEffect(() => {
    if (vitalsTrackedRef.current) return
    vitalsTrackedRef.current = true

    import('web-vitals').then(({ onLCP, onCLS, onFCP, onTTFB, onINP }) => {
      const report = (name: string) => (metric: any) => {
        send({
          event_type: 'vital',
          page: pathname,
          session_id: getSessionId(),
          device_type: getDevice(),
          vital_name: name,
          vital_value: Math.round(name === 'CLS' ? metric.value * 1000 : metric.value),
          vital_rating: metric.rating,
        })
      }
      onLCP(report('LCP'))
      onCLS(report('CLS'))
      onFCP(report('FCP'))
      onTTFB(report('TTFB'))
      onINP(report('INP'))
    }).catch(() => {})
  }, [])

  return null
}
