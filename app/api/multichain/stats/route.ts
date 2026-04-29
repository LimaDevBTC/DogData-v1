import { NextResponse } from 'next/server'
import { getSolanaTokenInfo } from '@/lib/multichain/birdeye'
import { getSolanaHolderCount } from '@/lib/multichain/helius'
import { getStacksTokenInfoResilient as getStacksTokenInfo } from '@/lib/multichain/stacks-resilient'
import type { MultiChainStats, ChainTokenInfo } from '@/lib/multichain/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    // Fetch all chains in parallel — gracefully handle failures
    const [solanaResult, stacksResult, heliusCountResult] = await Promise.allSettled([
      getSolanaTokenInfo(),
      getStacksTokenInfo(),
      getSolanaHolderCount(), // Helius DAS as fallback for Birdeye holder count
    ])

    const chains: ChainTokenInfo[] = []

    if (solanaResult.status === 'fulfilled') {
      const solanaInfo = solanaResult.value
      // Helius DAS is primary for holder count — Birdeye free tier doesn't reliably return it
      if (heliusCountResult.status === 'fulfilled' && heliusCountResult.value > 0) {
        solanaInfo.holder_count = heliusCountResult.value
      }
      // else: keep Birdeye's holder_count as fallback (if Helius failed)
      chains.push(solanaInfo)
    } else {
      console.warn('Multichain Solana fetch error:', solanaResult.reason?.message)
    }

    if (stacksResult.status === 'fulfilled') {
      chains.push(stacksResult.value)
    } else {
      console.warn('Multichain Stacks fetch error:', stacksResult.reason?.message)
    }

    const stats: MultiChainStats = {
      total_holders: chains.reduce((sum, c) => sum + c.holder_count, 0),
      total_market_cap_usd: chains.reduce((sum, c) => sum + c.market_cap_usd, 0),
      total_volume_24h_usd: chains.reduce((sum, c) => sum + c.volume_24h_usd, 0),
      total_supply_all_chains: chains.reduce((sum, c) => sum + c.circulating_supply, 0),
      chains,
      last_updated: new Date().toISOString(),
    }

    return NextResponse.json(stats, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
      },
    })
  } catch (error: any) {
    console.error('Multichain stats error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch multichain stats', message: error.message },
      { status: 500 }
    )
  }
}
