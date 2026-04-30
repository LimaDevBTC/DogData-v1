/**
 * GET /api/status/full
 *
 * Aggregates all health observations from `system_health_log` plus a few
 * live infra checks (Redis ping, Supabase reachability) and data-freshness
 * timestamps. Powers the public `/status` page.
 *
 * Caches for 30 seconds at the edge.
 */

import { NextResponse } from 'next/server'
import { redisClient } from '@/lib/upstash'
import { supabase } from '@/lib/supabase'
import { recordHealth } from '@/lib/health-logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ─── Catalog ─────────────────────────────────────────────────────────────────
//
// Components that should appear on the status page even if they have no
// observations yet. Each entry defines the canonical id + display metadata.

type Tier = 'critical' | 'high' | 'medium' | 'low'
type Category = 'cron' | 'infra' | 'external_api' | 'data_source'

interface CatalogEntry {
  id: string
  name: string
  category: Category
  description: string
  tier?: Tier
  expected_interval_minutes?: number  // for crons; used to compute "stale" threshold
}

const CATALOG: CatalogEntry[] = [
  // Cron jobs
  { id: 'cron:update-transactions', name: 'Transaction Cache', category: 'cron', description: 'Refreshes the Redis hot-cache of the 500 latest DOG transactions from Supabase every 3 minutes.', expected_interval_minutes: 3 },
  { id: 'cron:dog-rune-holders', name: 'Holders Snapshot', category: 'cron', description: 'Refreshes holder list and ranks every 15 minutes.', expected_interval_minutes: 15 },
  { id: 'cron:stacks-snapshot', name: 'Stacks Snapshot', category: 'cron', description: 'Hourly snapshot of Stacks DOG metrics persisted to Supabase.', expected_interval_minutes: 60 },
  { id: 'cron:whale-poster', name: 'Whale Alert Poster', category: 'cron', description: 'Posts new whale-tier transfers to @dogdata on X every 5 minutes.', expected_interval_minutes: 5 },

  // Infrastructure
  { id: 'infra:redis', name: 'Redis (Upstash)', category: 'infra', description: 'Cache layer for transactions, holders and dedup state.' },
  { id: 'infra:supabase', name: 'Supabase Postgres', category: 'infra', description: 'Source-of-truth for transaction history, Stacks history, and system health log.' },
  { id: 'infra:dog-scanner', name: 'DOG Block Scanner', category: 'infra', description: 'Local Python scanner watching Bitcoin Core for DOG rune transactions; pushes new blocks to Supabase as they confirm.', tier: 'critical' },

  // External APIs (passively probed via the crons / endpoints that consume them)
  { id: 'external:mempool', name: 'Mempool.space', category: 'external_api', description: 'Bitcoin network state — block heights, hashrate, fees, mempool size.', tier: 'high' },
  { id: 'external:unisat', name: 'Unisat Indexer', category: 'external_api', description: 'Secondary rune-event source for transaction enrichment.', tier: 'medium' },
  { id: 'external:tenero', name: 'Tenero (Stacks)', category: 'external_api', description: 'Primary holder + price source for Stacks DOG.', tier: 'high' },
  { id: 'external:hiro', name: 'Hiro (Stacks)', category: 'external_api', description: 'Stacks fallback when Tenero is unavailable.', tier: 'medium' },
  { id: 'external:twitter', name: 'X / Twitter API', category: 'external_api', description: 'Whale alert posting endpoint for @dogdata.', tier: 'low' },

  // Data sources (freshness observed from underlying caches/tables)
  { id: 'data:transactions', name: 'Transactions Feed', category: 'data_source', description: 'Latest 500 DOG transactions cached in Redis.' },
  { id: 'data:holders', name: 'Holders Dataset', category: 'data_source', description: '90k+ DOG holders with balances, ranks and UTXO counts.' },
  { id: 'data:stacks-history', name: 'Stacks Metrics History', category: 'data_source', description: 'Hourly snapshots of Stacks DOG metrics in Supabase.' },
]

// ─── Types ───────────────────────────────────────────────────────────────────

type Status = 'ok' | 'degraded' | 'down' | 'unknown'

interface DailyBucket {
  day: string
  status: Status
}

interface ComponentStatus {
  id: string
  name: string
  category: Category
  tier?: Tier
  description: string
  current: {
    status: Status
    latency_ms: number | null
    last_checked_at: string | null
    error: string | null
  }
  uptime: {
    days_30: number | null
    days_90: number | null
    daily: DailyBucket[]
  }
  metadata: Record<string, any> | null
}

interface OverallSummary {
  status: 'operational' | 'degraded' | 'major_outage'
  components_total: number
  components_operational: number
  components_degraded: number
  components_down: number
  components_unknown: number
}

interface StatusResponse {
  overall: OverallSummary
  generated_at: string
  components: ComponentStatus[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10) // YYYY-MM-DD
}

function lastNDays(n: number): string[] {
  const days: string[] = []
  const today = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
    days.push(dayKey(d))
  }
  return days
}

function rollupDailyStatus(statuses: Status[]): Status {
  if (!statuses.length) return 'unknown'
  if (statuses.includes('down')) return 'down'
  if (statuses.includes('degraded')) return 'degraded'
  return 'ok'
}

// ─── Main handler ────────────────────────────────────────────────────────────

export async function GET() {
  const generatedAt = new Date().toISOString()

  // 1. Live infra checks (counted as fresh observations).
  const liveChecks: Record<string, { status: 'ok' | 'degraded' | 'down'; latency_ms: number; error?: string }> = {}

  // Redis ping
  {
    const start = Date.now()
    try {
      await redisClient.ping()
      const latency = Date.now() - start
      liveChecks['infra:redis'] = { status: latency > 1000 ? 'degraded' : 'ok', latency_ms: latency }
    } catch (e: any) {
      liveChecks['infra:redis'] = { status: 'down', latency_ms: Date.now() - start, error: e?.message }
    }
  }

  // Supabase reachability (also gates whether we can read history at all).
  let supabaseReachable = true
  {
    const start = Date.now()
    try {
      const { error } = await supabase
        .from('system_health_log')
        .select('id', { count: 'exact', head: true })
        .limit(1)
      const latency = Date.now() - start
      if (error) {
        liveChecks['infra:supabase'] = { status: 'down', latency_ms: latency, error: error.message }
        supabaseReachable = false
      } else {
        liveChecks['infra:supabase'] = { status: latency > 2000 ? 'degraded' : 'ok', latency_ms: latency }
      }
    } catch (e: any) {
      liveChecks['infra:supabase'] = { status: 'down', latency_ms: Date.now() - start, error: e?.message }
      supabaseReachable = false
    }
  }

  // Persist these observations (best-effort, non-blocking).
  for (const [component, obs] of Object.entries(liveChecks)) {
    await recordHealth({
      component,
      component_type: 'infra',
      status: obs.status,
      latency_ms: obs.latency_ms,
      error_message: obs.error,
    })
  }

  // 2. Load 90 days of history in one shot, group by component in memory.
  type HistoryRow = { component: string; status: Status; checked_at: string; latency_ms: number | null; error_message: string | null; metadata: any }
  const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  let history: HistoryRow[] = []
  if (supabaseReachable) {
    const { data, error } = await supabase
      .from('system_health_log')
      .select('component, status, checked_at, latency_ms, error_message, metadata')
      .gte('checked_at', since90)
      .order('checked_at', { ascending: false })
      .limit(50000)
    if (!error && data) {
      history = data as HistoryRow[]
    }
  }

  const byComponent = new Map<string, HistoryRow[]>()
  for (const row of history) {
    if (!byComponent.has(row.component)) byComponent.set(row.component, [])
    byComponent.get(row.component)!.push(row)
  }

  // 3. Data-source freshness probes.
  const freshness: Record<string, { last_update_at: string | null; metadata: Record<string, any> | null; status: Status; error?: string }> = {}

  // data:transactions ← Redis dog:transactions JSON
  try {
    const raw = await redisClient.get('dog:transactions')
    let parsed: any = null
    if (typeof raw === 'string') {
      try { parsed = JSON.parse(raw) } catch { parsed = null }
    } else {
      parsed = raw
    }
    const lastUpdate: string | null = parsed?.last_update ?? parsed?.timestamp ?? null
    if (lastUpdate) {
      const ageMin = (Date.now() - new Date(lastUpdate).getTime()) / 60000
      freshness['data:transactions'] = {
        last_update_at: lastUpdate,
        metadata: { tx_count: parsed?.total_transactions ?? null, last_block: parsed?.last_block ?? null, age_minutes: Number(ageMin.toFixed(1)) },
        status: ageMin <= 6 ? 'ok' : ageMin <= 15 ? 'degraded' : 'down',
      }
    } else {
      freshness['data:transactions'] = { last_update_at: null, metadata: null, status: 'down', error: 'no transactions cache' }
    }
  } catch (e: any) {
    freshness['data:transactions'] = { last_update_at: null, metadata: null, status: 'down', error: e?.message }
  }

  // data:holders ← internal /api/dog-rune/holders?limit=1
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
    const res = await fetch(`${baseUrl}/api/dog-rune/holders?limit=1`, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
    if (res.ok) {
      const data = await res.json()
      const updatedAt: string | null = data?.metadata?.updatedAt ?? null
      const total: number = data?.pagination?.total ?? 0
      const ageMin = updatedAt ? (Date.now() - new Date(updatedAt).getTime()) / 60000 : null
      freshness['data:holders'] = {
        last_update_at: updatedAt,
        metadata: { total_holders: total, age_minutes: ageMin !== null ? Number(ageMin.toFixed(1)) : null },
        status: ageMin === null ? 'unknown' : ageMin <= 30 ? 'ok' : ageMin <= 60 ? 'degraded' : 'down',
      }
    } else {
      freshness['data:holders'] = { last_update_at: null, metadata: null, status: 'down', error: `HTTP ${res.status}` }
    }
  } catch (e: any) {
    freshness['data:holders'] = { last_update_at: null, metadata: null, status: 'down', error: e?.message }
  }

  // infra:dog-scanner ← latest tx in dog_transactions (Supabase). The local
  // dog_block_scanner.py pushes new blocks to Supabase as they confirm; if the
  // most recent tx is fresh (≤ 30 min), the scanner is alive. If > 60 min,
  // something is wrong (Bitcoin Core stalled, scanner crashed, etc.).
  if (supabaseReachable) {
    try {
      const { data, error } = await supabase
        .from('dog_transactions')
        .select('block_height, timestamp')
        .order('block_height', { ascending: false })
        .limit(1)
      if (error || !data?.length) {
        freshness['infra:dog-scanner'] = { last_update_at: null, metadata: null, status: 'unknown', error: error?.message }
      } else {
        const latest = data[0] as any
        const ageMin = (Date.now() - new Date(latest.timestamp).getTime()) / 60000
        freshness['infra:dog-scanner'] = {
          last_update_at: latest.timestamp,
          metadata: { last_block: latest.block_height, age_minutes: Number(ageMin.toFixed(1)) },
          status: ageMin <= 30 ? 'ok' : ageMin <= 60 ? 'degraded' : 'down',
        }
      }
    } catch (e: any) {
      freshness['infra:dog-scanner'] = { last_update_at: null, metadata: null, status: 'unknown', error: e?.message }
    }
  } else {
    freshness['infra:dog-scanner'] = { last_update_at: null, metadata: null, status: 'unknown', error: 'supabase unreachable' }
  }

  // data:stacks-history ← latest row from stacks_metrics_history
  if (supabaseReachable) {
    try {
      const { data, error } = await supabase
        .from('stacks_metrics_history')
        .select('snapshot_at, source, holder_count')
        .order('snapshot_at', { ascending: false })
        .limit(1)
      if (error || !data?.length) {
        freshness['data:stacks-history'] = { last_update_at: null, metadata: null, status: 'unknown', error: error?.message }
      } else {
        const latest = data[0] as any
        const ageMin = (Date.now() - new Date(latest.snapshot_at).getTime()) / 60000
        freshness['data:stacks-history'] = {
          last_update_at: latest.snapshot_at,
          metadata: { source: latest.source, holder_count: latest.holder_count, age_minutes: Number(ageMin.toFixed(1)) },
          status: ageMin <= 90 ? 'ok' : ageMin <= 180 ? 'degraded' : 'down',
        }
      }
    } catch (e: any) {
      freshness['data:stacks-history'] = { last_update_at: null, metadata: null, status: 'unknown', error: e?.message }
    }
  } else {
    freshness['data:stacks-history'] = { last_update_at: null, metadata: null, status: 'unknown', error: 'supabase unreachable' }
  }

  // 4. Build per-component status using catalog + history + live + freshness.
  const days90 = lastNDays(90)
  const components: ComponentStatus[] = CATALOG.map((entry) => {
    const rows = byComponent.get(entry.id) || []

    // Determine current status
    let current: ComponentStatus['current']
    let metadata: Record<string, any> | null = null

    if (entry.category === 'infra' && liveChecks[entry.id]) {
      const live = liveChecks[entry.id]
      current = {
        status: live.status,
        latency_ms: live.latency_ms,
        last_checked_at: generatedAt,
        error: live.error ?? null,
      }
    } else if (freshness[entry.id]) {
      // Used by both `data_source` and passive-`infra` entries (e.g. dog-scanner)
      const f = freshness[entry.id]
      current = {
        status: f.status,
        latency_ms: null,
        last_checked_at: f.last_update_at,
        error: f.error ?? null,
      }
      metadata = f.metadata
    } else if (rows.length > 0) {
      const latest = rows[0]
      let status: Status = latest.status
      // For crons, factor in staleness vs expected interval (e.g., last successful run too long ago).
      if (entry.category === 'cron' && entry.expected_interval_minutes) {
        const ageMin = (Date.now() - new Date(latest.checked_at).getTime()) / 60000
        const threshold = entry.expected_interval_minutes * 3
        if (ageMin > threshold) status = 'down'
        else if (ageMin > entry.expected_interval_minutes * 1.5 && status === 'ok') status = 'degraded'
      }
      current = {
        status,
        latency_ms: latest.latency_ms,
        last_checked_at: latest.checked_at,
        error: latest.error_message,
      }
      metadata = latest.metadata ?? null
    } else {
      current = { status: 'unknown', latency_ms: null, last_checked_at: null, error: null }
    }

    // Uptime aggregations from history
    let uptime30: number | null = null
    let uptime90: number | null = null
    const dailyMap = new Map<string, Status[]>()

    if (rows.length > 0) {
      let ok30 = 0, total30 = 0, ok90 = 0, total90 = 0
      for (const row of rows) {
        const ts = new Date(row.checked_at).getTime()
        if (ts >= new Date(since30).getTime()) {
          total30++
          if (row.status === 'ok') ok30++
        }
        total90++
        if (row.status === 'ok') ok90++

        const dk = dayKey(new Date(row.checked_at))
        if (!dailyMap.has(dk)) dailyMap.set(dk, [])
        dailyMap.get(dk)!.push(row.status)
      }
      uptime30 = total30 > 0 ? Number(((ok30 / total30) * 100).toFixed(2)) : null
      uptime90 = total90 > 0 ? Number(((ok90 / total90) * 100).toFixed(2)) : null
    }

    const daily: DailyBucket[] = days90.map((d) => ({
      day: d,
      status: rollupDailyStatus(dailyMap.get(d) || []),
    }))

    return {
      id: entry.id,
      name: entry.name,
      category: entry.category,
      tier: entry.tier,
      description: entry.description,
      current,
      uptime: { days_30: uptime30, days_90: uptime90, daily },
      metadata,
    }
  })

  // 5. Overall rollup.
  let opCount = 0, degCount = 0, downCount = 0, unkCount = 0
  for (const c of components) {
    if (c.current.status === 'ok') opCount++
    else if (c.current.status === 'degraded') degCount++
    else if (c.current.status === 'down') downCount++
    else unkCount++
  }

  let overallStatus: OverallSummary['status'] = 'operational'
  // Major outage if any critical/cron is down
  const criticalDown = components.some((c) =>
    c.current.status === 'down' && (c.tier === 'critical' || c.category === 'cron' || c.category === 'infra')
  )
  if (criticalDown) overallStatus = 'major_outage'
  else if (degCount > 0 || downCount > 0) overallStatus = 'degraded'

  const response: StatusResponse = {
    overall: {
      status: overallStatus,
      components_total: components.length,
      components_operational: opCount,
      components_degraded: degCount,
      components_down: downCount,
      components_unknown: unkCount,
    },
    generated_at: generatedAt,
    components,
  }

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 's-maxage=30, stale-while-revalidate=60',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
