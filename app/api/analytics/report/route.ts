import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Lighthouse-style scoring per vital (p75 thresholds)
function vitalScore(name: string, p75: number): number {
  const t: Record<string, [number, number]> = {
    LCP:  [2500, 4000],
    FCP:  [1800, 3000],
    TTFB: [800,  1800],
    INP:  [200,  500],
    CLS:  [100,  250],   // stored × 1000
  }
  const [good, poor] = t[name] ?? [1000, 3000]
  if (p75 <= good) return 100
  if (p75 >= poor) return 0
  return Math.round(((poor - p75) / (poor - good)) * 100)
}

const VITAL_WEIGHTS: Record<string, number> = {
  LCP: 0.25, INP: 0.25, CLS: 0.25, FCP: 0.15, TTFB: 0.10,
}

function p75(values: number[]): number {
  if (!values.length) return 0
  const s = [...values].sort((a, b) => a - b)
  return s[Math.floor(s.length * 0.75)] ?? 0
}

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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows       = data ?? []
  const pageviews  = rows.filter(r => r.event_type === 'pageview')
  const vitals     = rows.filter(r => r.event_type === 'vital' && r.vital_name && r.vital_value != null)

  // ── Traffic aggregations ─────────────────────────────────────────────────

  const uniqueSessions = new Set(pageviews.map(r => r.session_id).filter(Boolean)).size

  const count = <K extends string>(arr: typeof pageviews, key: (r: typeof pageviews[0]) => K) => {
    const m: Record<string, number> = {}
    for (const r of arr) { const k = key(r); m[k] = (m[k] ?? 0) + 1 }
    return m
  }

  const byDay      = count(pageviews, r => r.created_at.slice(0, 10))
  const byPage     = count(pageviews, r => r.page)
  const byCountry  = count(pageviews, r => r.country ?? 'Unknown')
  const byDevice   = count(pageviews, r => r.device_type ?? 'unknown')
  const byBrowser  = count(pageviews, r => r.browser ?? 'unknown')
  const byReferrer = count(pageviews, r => r.referrer || 'Direct')

  // ── Real-time: last 30 min ───────────────────────────────────────────────

  const now = Date.now()
  const realtime: Record<string, number> = {}
  for (let i = 5; i >= 0; i--) realtime[`${i * 5}m`] = 0
  for (const r of pageviews) {
    const bucket = Math.floor((now - new Date(r.created_at).getTime()) / (5 * 60 * 1000))
    if (bucket < 6) realtime[`${bucket * 5}m`] = (realtime[`${bucket * 5}m`] ?? 0) + 1
  }

  // ── Web Vitals — overall ─────────────────────────────────────────────────

  // Group values by name
  const vMap: Record<string, { values: number[]; ratings: Record<string, number> }> = {}
  for (const r of vitals) {
    if (!vMap[r.vital_name]) vMap[r.vital_name] = { values: [], ratings: { good: 0, 'needs-improvement': 0, poor: 0 } }
    vMap[r.vital_name].values.push(r.vital_value)
    if (r.vital_rating) vMap[r.vital_name].ratings[r.vital_rating] = (vMap[r.vital_name].ratings[r.vital_rating] ?? 0) + 1
  }

  const webVitals: Record<string, {
    p75: number; avg: number; good_pct: number; needs_pct: number; poor_pct: number;
    rating: string; score: number; samples: number
  }> = {}

  for (const [name, { values, ratings }] of Object.entries(vMap)) {
    const p = Math.round(p75(values))
    const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length)
    const total = Object.values(ratings).reduce((a, b) => a + b, 0)
    const good_pct  = total > 0 ? Math.round((ratings.good / total) * 100) : 0
    const needs_pct = total > 0 ? Math.round(((ratings['needs-improvement'] ?? 0) / total) * 100) : 0
    const poor_pct  = Math.max(0, 100 - good_pct - needs_pct)
    const score     = vitalScore(name, p)
    const rating    = good_pct >= 75 ? 'good' : good_pct >= 50 ? 'needs-improvement' : 'poor'
    webVitals[name] = { p75: p, avg, good_pct, needs_pct, poor_pct, rating, score, samples: values.length }
  }

  // ── Performance score (Lighthouse-style) ─────────────────────────────────

  let scoreNum = 0, scoreWeight = 0
  for (const [name, w] of Object.entries(VITAL_WEIGHTS)) {
    if (webVitals[name]) { scoreNum += webVitals[name].score * w; scoreWeight += w }
  }
  const performanceScore = scoreWeight > 0 ? Math.round(scoreNum / scoreWeight) : null

  // ── Vitals trend by day ───────────────────────────────────────────────────

  // group vital values by (day, name)
  const vByDay: Record<string, Record<string, number[]>> = {}
  for (const r of vitals) {
    const day = r.created_at.slice(0, 10)
    if (!vByDay[day]) vByDay[day] = {}
    if (!vByDay[day][r.vital_name]) vByDay[day][r.vital_name] = []
    vByDay[day][r.vital_name].push(r.vital_value)
  }
  const vitalsByDay = Object.entries(vByDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, names]) => {
      const row: Record<string, number | string> = { date: date.slice(5) }
      for (const [name, vals] of Object.entries(names)) row[name] = Math.round(p75(vals))
      return row
    })

  // ── Vitals by device ─────────────────────────────────────────────────────

  const vByDevice: Record<string, Record<string, number[]>> = {}
  for (const r of vitals) {
    const d = r.device_type ?? 'desktop'
    if (!vByDevice[d]) vByDevice[d] = {}
    if (!vByDevice[d][r.vital_name]) vByDevice[d][r.vital_name] = []
    vByDevice[d][r.vital_name].push(r.vital_value)
  }
  const vitalsByDevice = Object.entries(vByDevice).map(([device, names]) => {
    const row: Record<string, number | string> = { device }
    for (const [name, vals] of Object.entries(names)) row[name] = Math.round(p75(vals))
    return row
  })

  // ── Slowest pages per vital ───────────────────────────────────────────────

  const vByPage: Record<string, Record<string, number[]>> = {}
  for (const r of vitals) {
    if (!vByPage[r.page]) vByPage[r.page] = {}
    if (!vByPage[r.page][r.vital_name]) vByPage[r.page][r.vital_name] = []
    vByPage[r.page][r.vital_name].push(r.vital_value)
  }

  // For each vital, top 8 slowest pages
  const slowestPages: Record<string, { page: string; p75: number }[]> = {}
  for (const vitalName of Object.keys(webVitals)) {
    const entries = Object.entries(vByPage)
      .filter(([, names]) => names[vitalName]?.length)
      .map(([page, names]) => ({ page, p75: Math.round(p75(names[vitalName])) }))
      .sort((a, b) => b.p75 - a.p75)
      .slice(0, 8)
    if (entries.length) slowestPages[vitalName] = entries
  }

  return NextResponse.json({
    period:            { days, from: sinceIso, to: new Date().toISOString() },
    summary:           { pageviews: pageviews.length, unique_sessions: uniqueSessions, avg_pages_per_session: uniqueSessions > 0 ? +(pageviews.length / uniqueSessions).toFixed(1) : 0 },
    by_day:            byDay,
    top_pages:         Object.entries(byPage).sort(([,a],[,b])=>b-a).slice(0,10).map(([page,views])=>({page,views})),
    by_country:        Object.entries(byCountry).sort(([,a],[,b])=>b-a).slice(0,15).map(([country,views])=>({country,views})),
    by_device:         byDevice,
    by_browser:        Object.entries(byBrowser).sort(([,a],[,b])=>b-a).slice(0,6).map(([browser,views])=>({browser,views})),
    by_referrer:       Object.entries(byReferrer).sort(([,a],[,b])=>b-a).slice(0,10).map(([referrer,views])=>({referrer,views})),
    realtime,
    web_vitals:        webVitals,
    performance_score: performanceScore,
    vitals_by_day:     vitalsByDay,
    vitals_by_device:  vitalsByDevice,
    slowest_pages:     slowestPages,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
