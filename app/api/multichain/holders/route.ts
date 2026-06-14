import { NextRequest, NextResponse } from 'next/server'
import {
  getStacksHoldersResilient as getStacksHolders,
  getStacksHolderStatsResilient as getStacksHolderStats,
  getStacksHolderPercentagesResilient as getStacksHolderPercentages,
} from '@/lib/multichain/stacks-resilient'
import { getSolanaHolders } from '@/lib/multichain/helius'
import { getSolanaTokenInfo as getSolanaTokenInfoBirdeye } from '@/lib/multichain/birdeye'
import { getSolanaTokenInfoFromDexScreener } from '@/lib/multichain/dexscreener'
import type { Chain, ChainTokenInfo } from '@/lib/multichain/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Solana token info for price/volume enrichment. DexScreener is primary (free, no
// limits); Birdeye is the fallback (and may itself be over quota).
async function getSolanaInfo(): Promise<ChainTokenInfo> {
  try {
    return await getSolanaTokenInfoFromDexScreener()
  } catch (err) {
    console.warn('DexScreener failed, falling back to Birdeye:', (err as Error).message)
    return await getSolanaTokenInfoBirdeye()
  }
}

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
        getSolanaInfo(),
      ])

      const holders = heliusData.status === 'fulfilled' ? heliusData.value : null
      const info = tokenInfo.status === 'fulfilled' ? tokenInfo.value : null

      // Enrich holders with USD values from Birdeye price
      const price = info?.price_usd ?? 0
      const enrichedHolders = (holders?.holders || []).map(h => ({
        ...h,
        balance_usd: price > 0 ? h.balance * price : null,
      }))

      // Holder count: prefer the Helius/fallback count from getSolanaHolders; Birdeye's
      // count is only used if that is unavailable (and Birdeye itself may be over quota).
      const holderCount = holders?.total_count || info?.holder_count || 0

      response.solana = {
        holders: enrichedHolders,
        total_count: holderCount,
        bridgeSupply: holders?.bridgeSupply ?? 0,
        // Circulating supply on Solana from the live RPC (full supply − bridge),
        // not Birdeye's total_supply which is 0 / over-quota.
        circulatingOnChain: holders?.circulatingOnChain ?? null,
        stats: {
          holder_count: holderCount,
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
