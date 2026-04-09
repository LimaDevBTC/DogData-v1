/**
 * Whale Alert Poster — Vercel Cron Job
 *
 * Runs every 5 minutes. Fetches new whale alerts from /api/whale-alerts,
 * deduplicates against already-posted txids (stored in Redis), and posts
 * new alerts to the @dogdata X account via Twitter API v2.
 *
 * Required env vars:
 *   X_API_KEY            — Twitter API Key (OAuth 1.0a)
 *   X_API_SECRET         — Twitter API Key Secret
 *   X_ACCESS_TOKEN       — Access Token (for @dogdata account)
 *   X_ACCESS_SECRET      — Access Token Secret
 *   CRON_SECRET          — Shared secret to protect this endpoint
 */

import { NextRequest, NextResponse } from 'next/server'
import { TwitterApi } from 'twitter-api-v2'
import { redisClient } from '@/lib/upstash'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// ─── Config ──────────────────────────────────────────────────────────────────

// Minimum severity to post. 'ALERT' = all (1M+), 'MEDIUM' = 5M+, 'HIGH' = 10M+, 'MEGA' = 100M+
const MIN_SEVERITY: Record<string, number> = { ALERT: 0, MEDIUM: 1, HIGH: 2, MEGA: 3 }
const SEVERITY_THRESHOLD = 'ALERT' // posts all alerts above 1M DOG

// Max tweets per cron run (X Free tier = 1,500/month; 5-min cron = ~8,640 runs/month)
const MAX_TWEETS_PER_RUN = 3

// Redis key prefix for posted txids — 48h TTL avoids re-posting if Redis flushes
const POSTED_KEY_PREFIX = 'x:posted:'
const POSTED_TTL_SEC = 48 * 60 * 60

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTwitterClient(): TwitterApi {
  const { X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET } = process.env

  if (!X_API_KEY || !X_API_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_SECRET) {
    throw new Error('Missing X API credentials. Set X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET.')
  }

  return new TwitterApi({
    appKey: X_API_KEY,
    appSecret: X_API_SECRET,
    accessToken: X_ACCESS_TOKEN,
    accessSecret: X_ACCESS_SECRET,
  })
}

function severityRank(severity: string): number {
  return MIN_SEVERITY[severity] ?? 0
}

async function isAlreadyPosted(txid: string): Promise<boolean> {
  try {
    const val = await redisClient.get(`${POSTED_KEY_PREFIX}${txid}`)
    return val !== null
  } catch {
    return false
  }
}

async function markAsPosted(txid: string): Promise<void> {
  try {
    await redisClient.set(`${POSTED_KEY_PREFIX}${txid}`, '1', { ex: POSTED_TTL_SEC })
  } catch {
    // best-effort
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // Auth — Vercel protects cron routes natively in production.
  // For manual testing, accept CRON_SECRET as query param.
  const { searchParams } = new URL(request.url)
  const providedSecret = searchParams.get('secret')
  const cronSecret = process.env.CRON_SECRET

  // Only enforce secret check on manual calls (not Vercel cron — Vercel uses its own internal auth)
  const isVercelCron = request.headers.get('x-vercel-cron') === '1'
    || request.headers.get('user-agent')?.includes('vercel-cron')

  if (!isVercelCron && cronSecret && providedSecret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const log: string[] = []
  const posted: string[] = []
  const skipped: string[] = []
  const errors: string[] = []

  try {
    // 1. Fetch whale alerts from our own API
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

    const alertsRes = await fetch(`${baseUrl}/api/whale-alerts?threshold=1000000&limit=20&format=full`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    })

    if (!alertsRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch whale alerts', status: alertsRes.status }, { status: 502 })
    }

    const alertsData = await alertsRes.json()
    const alerts: any[] = alertsData.alerts ?? []

    log.push(`Fetched ${alerts.length} alerts above 5M DOG threshold`)

    // 2. Filter by severity threshold and deduplicate
    const thresholdRank = severityRank(SEVERITY_THRESHOLD)

    const newAlerts = []
    for (const alert of alerts) {
      if (severityRank(alert.severity) < thresholdRank) {
        skipped.push(`${alert.txid_short} (severity ${alert.severity} below threshold)`)
        continue
      }
      const alreadyPosted = await isAlreadyPosted(alert.txid)
      if (alreadyPosted) {
        skipped.push(`${alert.txid_short} (already posted)`)
        continue
      }
      newAlerts.push(alert)
      if (newAlerts.length >= MAX_TWEETS_PER_RUN) break
    }

    log.push(`${newAlerts.length} new alerts to post, ${skipped.length} skipped`)

    if (newAlerts.length === 0) {
      return NextResponse.json({
        ok: true,
        posted: [],
        skipped,
        log,
        message: 'No new whale alerts to post',
      })
    }

    // 3. Post to X
    const twitter = getTwitterClient()
    const rwClient = twitter.readWrite

    for (const alert of newAlerts) {
      try {
        await rwClient.v2.tweet(alert.tweet)
        await markAsPosted(alert.txid)
        posted.push(`${alert.txid_short} (${alert.severity} — ${alert.total_dog_formatted} DOG on ${alert.chain})`)
        log.push(`Posted: ${alert.txid_short}`)
      } catch (err: any) {
        const msg = err?.data?.detail ?? err?.message ?? String(err)
        errors.push(`${alert.txid_short}: ${msg}`)
        log.push(`Failed to post ${alert.txid_short}: ${msg}`)
      }
    }

    return NextResponse.json({
      ok: errors.length === 0,
      posted,
      skipped,
      errors,
      log,
    })
  } catch (err: any) {
    console.error('[whale-poster]', err)
    return NextResponse.json(
      { ok: false, error: err.message, log },
      { status: 500 }
    )
  }
}
