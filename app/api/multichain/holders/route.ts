import { NextRequest, NextResponse } from 'next/server'
import { getStacksHolders, getStacksHolderStats, getStacksHolderPercentages } from '@/lib/multichain/tenero'
import { getSolanaTokenInfo } from '@/lib/multichain/birdeye'
import type { Chain } from '@/lib/multichain/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const chain = request.nextUrl.searchParams.get('chain') as Chain | null
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50', 10)

    const response: Record<string, any> = {}

    if (!chain || chain === 'stacks') {
      const [holders, stats, percentages] = await Promise.all([
        getStacksHolders(limit),
        getStacksHolderStats(),
        getStacksHolderPercentages(),
      ])
      response.stacks = {
        ...holders,
        stats,
        concentration: percentages,
      }
    }

    if (!chain || chain === 'solana') {
      // Birdeye free tier doesn't have individual holders, but we have the count
      const tokenInfo = await getSolanaTokenInfo()
      response.solana = {
        holders: [],
        total_count: tokenInfo.holder_count,
        stats: {
          holder_count: tokenInfo.holder_count,
          volume_24h_usd: tokenInfo.volume_24h_usd,
        },
        concentration: null, // not available on free tier
      }
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
      },
    })
  } catch (error: any) {
    console.error('Multichain holders error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch multichain holders', message: error.message },
      { status: 500 }
    )
  }
}
