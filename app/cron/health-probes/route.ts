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

  return NextResponse.json({ ok: true, probes })
}
