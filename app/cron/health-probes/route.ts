/**
 * Health Probes — Vercel Cron Job
 *
 * Runs every 10 minutes. Fires lightweight requests at the external APIs
 * we depend on so the status page always has a fresh observation, even on
 * quiet days when no real traffic hits the routes that probe them.
 *
 * Each probe goes through `probedFetch`, which records latency + outcome
 * to `system_health_log`. The status page reads from there.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { probedFetch } from '@/lib/health-logger'
import { DOG_TOKENS } from '@/lib/multichain/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

const TIMEOUT_MS = 8000

const PROBES: Array<{ component: string; url: string }> = [
  {
    component: 'external:mempool',
    url: 'https://mempool.space/api/v1/difficulty-adjustment',
  },
  {
    component: 'external:tenero',
    url: `https://api.tenero.io/v1/stacks/tokens/${DOG_TOKENS.stacks.address}`,
  },
  {
    // Tracked separately — has been intermittently returning HTTP 500
    // while the rest of Tenero stays healthy. Knowing whether this
    // sub-endpoint is persistently failing is what guides outreach to Tenero.
    component: 'external:tenero:holder_stats',
    url: `https://api.tenero.io/v1/stacks/tokens/${DOG_TOKENS.stacks.address}/holder_stats`,
  },
]

export async function GET() {
  const results = await Promise.allSettled(
    PROBES.map(async (p) => {
      try {
        const res = await probedFetch(p.component, p.url, {
          headers: { accept: 'application/json' },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        })
        return { component: p.component, status: res.status }
      } catch (e: any) {
        return { component: p.component, error: e?.message || 'probe failed' }
      }
    }),
  )

  const probes = results.map((r) =>
    r.status === 'fulfilled' ? r.value : { error: String(r.reason) },
  )

  // Roll yesterday and today into `system_health_daily`, then prune raw rows
  // past the retention window (migration 003). Piggybacking on this cron
  // instead of adding a sixth one: it already runs every 10 minutes, and both
  // operations are idempotent, so a missed tick costs nothing.
  //
  // `system_health_log` had no retention at all and had reached 332.210 rows.
  // The 90-day uptime bar is what forced keeping everything, and it no longer
  // does: the bar reads the rollup, so the raw log only has to survive long
  // enough to investigate a recent incident.
  let maintenance: unknown = null
  try {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (url && key) {
      const { data, error } = await createClient(url, key).rpc('health_maintain')
      // Before migration 003 is applied this is a missing-function error, which
      // is expected and must not fail the probe run.
      maintenance = error ? { skipped: error.message } : data
    }
  } catch (e: any) {
    maintenance = { skipped: e?.message || 'maintenance failed' }
  }

  return NextResponse.json({ ok: true, probes, maintenance })
}
