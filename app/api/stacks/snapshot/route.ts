import { NextRequest, NextResponse } from 'next/server'
import { captureStacksSnapshot } from '@/lib/multichain/stacks-history'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * POST /api/stacks/snapshot
 *
 * Captures a point-in-time snapshot of Stacks DOG metrics and
 * persists it to Supabase. Designed to be called by a Vercel cron
 * (every hour) or manually for testing.
 *
 * Protected by CRON_SECRET to prevent abuse.
 *
 * Vercel cron config (vercel.json):
 *   { "path": "/api/stacks/snapshot", "schedule": "0 * * * *" }
 */
export async function POST(request: NextRequest) {
  // Verify cron secret (skip in dev)
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const snapshot = await captureStacksSnapshot()
    return NextResponse.json({
      ok: true,
      snapshot,
      message: 'Stacks metrics snapshot captured successfully',
    })
  } catch (error: any) {
    console.error('Stacks snapshot error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}

// Also allow GET for easy testing in browser
export async function GET(request: NextRequest) {
  return POST(request)
}
