import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

type DailyRow = {
  day: string
  class: string
  count: number
  subclass_counts: Record<string, number>
  tx_count_total: number
  blocks_in_day: number
}

type DaySeries = {
  day: string
  total: number
  blocks: number
  classes: Record<string, number>
  /** subclass counts grouped by parent class, e.g. { runes: { dog: 12 }, op_return_protocol: { thorchain: 13 } } */
  class_subclasses: Record<string, Record<string, number>>
  pct: Record<string, number>
}

type Response = {
  range: string
  total_days: number
  series: DaySeries[]
  totals: {
    total_txs: number
    classes: Record<string, number>
    class_subclasses: Record<string, Record<string, number>>
    pct: Record<string, number>
  }
  last_updated: string | null
}

let cachedData: { data: Response; timestamp: number; range: string } | null = null
const CACHE_DURATION = 5 * 60 * 1000

const KNOWN_CLASSES = [
  'financial', 'runes', 'inscription',
  'op_return_protocol', 'op_return_other', 'coinbase',
] as const

function rangeToDays(range: string): number | null {
  switch (range) {
    case '7d': return 7
    case '30d': return 30
    case '90d': return 90
    case 'all': return null
    default: return 30
  }
}

function groupByDay(rows: DailyRow[]): DaySeries[] {
  const byDay: Record<string, DaySeries> = {}
  for (const r of rows) {
    let s = byDay[r.day]
    if (!s) {
      s = {
        day: r.day,
        total: r.tx_count_total,
        blocks: r.blocks_in_day,
        classes: Object.fromEntries(KNOWN_CLASSES.map(c => [c, 0])),
        class_subclasses: {},
        pct: Object.fromEntries(KNOWN_CLASSES.map(c => [c, 0])),
      }
      byDay[r.day] = s
    }
    s.classes[r.class] = r.count
    if (r.subclass_counts && Object.keys(r.subclass_counts).length > 0) {
      const bucket = s.class_subclasses[r.class] || (s.class_subclasses[r.class] = {})
      for (const [k, v] of Object.entries(r.subclass_counts)) {
        bucket[k] = (bucket[k] || 0) + Number(v)
      }
    }
  }
  const result = Object.values(byDay)
  for (const s of result) {
    if (s.total > 0) {
      for (const c of KNOWN_CLASSES) {
        s.pct[c] = Math.round((s.classes[c] / s.total) * 10000) / 100
      }
    }
  }
  return result.sort((a, b) => a.day.localeCompare(b.day))
}

function computeTotals(series: DaySeries[]): Response['totals'] {
  const classes: Record<string, number> = Object.fromEntries(KNOWN_CLASSES.map(c => [c, 0]))
  const class_subclasses: Record<string, Record<string, number>> = {}
  let total = 0
  for (const s of series) {
    total += s.total
    for (const c of KNOWN_CLASSES) classes[c] += s.classes[c] || 0
    for (const [parent, subs] of Object.entries(s.class_subclasses)) {
      const bucket = class_subclasses[parent] || (class_subclasses[parent] = {})
      for (const [k, v] of Object.entries(subs)) {
        bucket[k] = (bucket[k] || 0) + v
      }
    }
  }
  const pct: Record<string, number> = {}
  if (total > 0) {
    for (const c of KNOWN_CLASSES) {
      pct[c] = Math.round((classes[c] / total) * 10000) / 100
    }
  }
  return { total_txs: total, classes, class_subclasses, pct }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') || '30d'
    const days = rangeToDays(range)

    const now = Date.now()
    if (cachedData && cachedData.range === range && (now - cachedData.timestamp) < CACHE_DURATION) {
      return NextResponse.json(cachedData.data, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
          'X-Cache': 'hit',
        },
      })
    }

    const supabaseUrl = process.env.SUPABASE_URL
    // Service role first: this route only reads, but migration 004 turns RLS on
    // and leaves the anon role with no policy at all. See lib/supabase.ts.
    const supabaseAnonKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Supabase not configured' },
        { status: 503 },
      )
    }
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    let q = supabase
      .from('tx_class_daily')
      .select('day, class, count, subclass_counts, tx_count_total, blocks_in_day')
      .order('day', { ascending: true })
      .limit(10000)

    if (days !== null) {
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0]
      q = q.gte('day', cutoff)
    }

    const { data, error } = await q
    if (error) {
      console.error('tx-breakdown query error:', error)
      if (cachedData) {
        return NextResponse.json(cachedData.data, { headers: { 'X-Cache': 'stale' } })
      }
      return NextResponse.json({ error: 'query failed' }, { status: 500 })
    }

    const series = groupByDay((data || []) as DailyRow[])
    const totals = computeTotals(series)

    const result: Response = {
      range,
      total_days: series.length,
      series,
      totals,
      last_updated: series.length > 0 ? series[series.length - 1].day : null,
    }

    cachedData = { data: result, timestamp: now, range }

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    })
  } catch (err: any) {
    console.error('tx-breakdown handler error:', err)
    if (cachedData) {
      return NextResponse.json(cachedData.data, { headers: { 'X-Cache': 'stale' } })
    }
    return NextResponse.json({ error: 'internal error', details: err?.message }, { status: 500 })
  }
}
