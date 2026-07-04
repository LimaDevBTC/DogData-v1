import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const days = Math.min(parseInt(searchParams.get('days') ?? '30'), 90)

  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceIso = since.toISOString()

  const { data, error } = await supabase
    .from('page_events')
    .select('*')
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = data ?? []
  const pageviews = rows.filter(r => r.event_type === 'pageview')
  const vitals = rows.filter(r => r.event_type === 'vital')

  // — Unique sessions —
  const uniqueSessions = new Set(pageviews.map(r => r.session_id).filter(Boolean)).size

  // — Pageviews by day —
  const byDay: Record<string, number> = {}
  for (const r of pageviews) {
    const day = r.created_at.slice(0, 10)
    byDay[day] = (byDay[day] ?? 0) + 1
  }

  // — Top pages —
  const byPage: Record<string, number> = {}
  for (const r of pageviews) {
    byPage[r.page] = (byPage[r.page] ?? 0) + 1
  }

  // — By country —
  const byCountry: Record<string, number> = {}
  for (const r of pageviews) {
    const c = r.country ?? 'Unknown'
    byCountry[c] = (byCountry[c] ?? 0) + 1
  }

  // — By device —
  const byDevice: Record<string, number> = {}
  for (const r of pageviews) {
    const d = r.device_type ?? 'unknown'
    byDevice[d] = (byDevice[d] ?? 0) + 1
  }

  // — By browser —
  const byBrowser: Record<string, number> = {}
  for (const r of pageviews) {
    const b = r.browser ?? 'unknown'
    byBrowser[b] = (byBrowser[b] ?? 0) + 1
  }

  // — By referrer —
  const byReferrer: Record<string, number> = {}
  for (const r of pageviews) {
    const ref = r.referrer || 'Direct'
    byReferrer[ref] = (byReferrer[ref] ?? 0) + 1
  }

  // — Web Vitals averages —
  const vitalMap: Record<string, { values: number[]; ratings: Record<string, number> }> = {}
  for (const r of vitals) {
    if (!r.vital_name || r.vital_value == null) continue
    if (!vitalMap[r.vital_name]) vitalMap[r.vital_name] = { values: [], ratings: { good: 0, 'needs-improvement': 0, poor: 0 } }
    vitalMap[r.vital_name].values.push(r.vital_value)
    if (r.vital_rating) vitalMap[r.vital_name].ratings[r.vital_rating] = (vitalMap[r.vital_name].ratings[r.vital_rating] ?? 0) + 1
  }
  const webVitals: Record<string, { p75: number; avg: number; good_pct: number; rating: string }> = {}
  for (const [name, { values, ratings }] of Object.entries(vitalMap)) {
    const sorted = [...values].sort((a, b) => a - b)
    const p75 = sorted[Math.floor(sorted.length * 0.75)] ?? 0
    const avg = values.reduce((a, b) => a + b, 0) / values.length
    const total = Object.values(ratings).reduce((a, b) => a + b, 0)
    const good_pct = total > 0 ? Math.round((ratings.good / total) * 100) : 0
    const rating = good_pct >= 75 ? 'good' : good_pct >= 50 ? 'needs-improvement' : 'poor'
    webVitals[name] = { p75: Math.round(p75), avg: Math.round(avg), good_pct, rating }
  }

  // — Real-time: last 30 min by 5-min buckets —
  const now = Date.now()
  const realtime: Record<string, number> = {}
  for (let i = 5; i >= 0; i--) {
    const label = `${i * 5}m`
    realtime[label] = 0
  }
  for (const r of pageviews) {
    const age = now - new Date(r.created_at).getTime()
    const bucket = Math.floor(age / (5 * 60 * 1000))
    if (bucket < 6) {
      const label = `${bucket * 5}m`
      realtime[label] = (realtime[label] ?? 0) + 1
    }
  }

  return NextResponse.json({
    period: { days, from: sinceIso, to: new Date().toISOString() },
    summary: {
      pageviews: pageviews.length,
      unique_sessions: uniqueSessions,
      avg_pages_per_session: uniqueSessions > 0 ? +(pageviews.length / uniqueSessions).toFixed(1) : 0,
    },
    by_day: byDay,
    top_pages: Object.entries(byPage).sort(([, a], [, b]) => b - a).slice(0, 10).map(([page, views]) => ({ page, views })),
    by_country: Object.entries(byCountry).sort(([, a], [, b]) => b - a).slice(0, 15).map(([country, views]) => ({ country, views })),
    by_device: byDevice,
    by_browser: Object.entries(byBrowser).sort(([, a], [, b]) => b - a).slice(0, 6).map(([browser, views]) => ({ browser, views })),
    by_referrer: Object.entries(byReferrer).sort(([, a], [, b]) => b - a).slice(0, 10).map(([referrer, views]) => ({ referrer, views })),
    web_vitals: webVitals,
    realtime,
  }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
