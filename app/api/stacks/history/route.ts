import { NextRequest, NextResponse } from 'next/server'
import { getStacksMetricsHistory, getStacksLatestSnapshot } from '@/lib/multichain/stacks-history'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/stacks/history
 *
 * Returns historical Stacks DOG metrics from Supabase.
 *
 * Query params:
 *   days   - Lookback window in days (default 30, max 365)
 *   limit  - Max rows to return (default 720)
 *   latest - If "true", returns only the most recent snapshot
 */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const latest = params.get('latest') === 'true'

    if (latest) {
      const snapshot = await getStacksLatestSnapshot()
      return NextResponse.json(
        snapshot
          ? { ok: true, snapshot }
          : { ok: false, error: 'No snapshots found — cron may not have run yet' },
        {
          status: snapshot ? 200 : 404,
          headers: {
            'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
          },
        }
      )
    }

    const days = Math.min(parseInt(params.get('days') || '30', 10), 365)
    const limit = Math.min(parseInt(params.get('limit') || '720', 10), 5000)

    const history = await getStacksMetricsHistory({ days, limit })

    return NextResponse.json(
      {
        ok: true,
        ...history,
        meta: {
          description: 'Stacks DOG metrics history (hourly snapshots)',
          fields: [
            'holder_count', 'price_usd', 'market_cap_usd', 'volume_24h_usd',
            'liquidity_usd', 'circulating_supply', 'top_10_pct', 'top_25_pct',
            'top_50_pct', 'whale_wallets', 'active_1w', 'fresh_1w',
          ],
        },
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  } catch (error: any) {
    console.error('Stacks history error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
