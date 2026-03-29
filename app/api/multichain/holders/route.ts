import { NextRequest, NextResponse } from 'next/server'
import { getStacksHolders, getStacksHolderStats, getStacksHolderPercentages } from '@/lib/multichain/tenero'
import { getSolanaHolders } from '@/lib/multichain/helius'
import { getSolanaTokenInfo } from '@/lib/multichain/birdeye'
import type { Chain } from '@/lib/multichain/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const chain = request.nextUrl.searchParams.get('chain') as Chain | null
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20', 10)

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
      const [heliusData, tokenInfo] = await Promise.allSettled([
        getSolanaHolders(limit),
        getSolanaTokenInfo(),
      ])

      const holders = heliusData.status === 'fulfilled' ? heliusData.value : null
      const info = tokenInfo.status === 'fulfilled' ? tokenInfo.value : null

      // Enrich holders with USD values from Birdeye price
      const price = info?.price_usd ?? 0
      const enrichedHolders = (holders?.holders || []).map(h => ({
        ...h,
        balance_usd: price > 0 ? h.balance * price : null,
      }))

      response.solana = {
        holders: enrichedHolders,
        total_count: info?.holder_count ?? 0,
        bridgeSupply: holders?.bridgeSupply ?? 0,
        circulatingOnChain: holders?.bridgeSupply
          ? (info?.total_supply || 0) - holders.bridgeSupply
          : null,
        stats: {
          holder_count: info?.holder_count ?? 0,
          volume_24h_usd: info?.volume_24h_usd ?? 0,
        },
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
