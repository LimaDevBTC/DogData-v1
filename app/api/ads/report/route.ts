import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const advertiser = searchParams.get('advertiser') ?? 'bitflow'
  const days = Math.min(parseInt(searchParams.get('days') ?? '30'), 90)

  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceIso = since.toISOString()

  // PostgREST caps a single request at its configured max-rows (default 1000),
  // so we page through with .range() until a page comes back short.
  const PAGE_SIZE = 1000
  const rows: { event_type: string; page: string; device_type: string | null; created_at: string }[] = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('ad_events')
      .select('event_type, page, device_type, created_at')
      .eq('advertiser', advertiser)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) {
      console.error('[ads/report]', error.message)
      return NextResponse.json({ error: 'db error' }, { status: 500 })
    }

    rows.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) break
  }

  // — Totals —
  const impressions = rows.filter(r => r.event_type === 'impression').length
  const clicks = rows.filter(r => r.event_type === 'click').length
  const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) + '%' : '0%'

  // — By page —
  const byPage: Record<string, { impressions: number; clicks: number }> = {}
  for (const r of rows) {
    if (!byPage[r.page]) byPage[r.page] = { impressions: 0, clicks: 0 }
    byPage[r.page][r.event_type === 'impression' ? 'impressions' : 'clicks']++
  }

  // — By device —
  const byDevice: Record<string, { impressions: number; clicks: number }> = {}
  for (const r of rows) {
    const d = r.device_type ?? 'unknown'
    if (!byDevice[d]) byDevice[d] = { impressions: 0, clicks: 0 }
    byDevice[d][r.event_type === 'impression' ? 'impressions' : 'clicks']++
  }

  // — By day —
  const byDay: Record<string, { impressions: number; clicks: number }> = {}
  for (const r of rows) {
    const day = r.created_at.slice(0, 10) // YYYY-MM-DD
    if (!byDay[day]) byDay[day] = { impressions: 0, clicks: 0 }
    byDay[day][r.event_type === 'impression' ? 'impressions' : 'clicks']++
  }

  return NextResponse.json({
    advertiser,
    period: {
      days,
      from: sinceIso,
      to: new Date().toISOString(),
    },
    summary: {
      impressions,
      clicks,
      ctr,
    },
    by_page: byPage,
    by_device: byDevice,
    by_day: byDay,
  }, {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
