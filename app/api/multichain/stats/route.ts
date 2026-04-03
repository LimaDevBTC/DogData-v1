import { NextResponse } from 'next/server'
import { getSolanaTokenInfo } from '@/lib/multichain/birdeye'
import { getStacksTokenInfoResilient as getStacksTokenInfo } from '@/lib/multichain/stacks-resilient'
import type { MultiChainStats, ChainTokenInfo } from '@/lib/multichain/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    // Fetch all chains in parallel — gracefully handle failures
    const results = await Promise.allSettled([
      getSolanaTokenInfo(),
      getStacksTokenInfo(),
    ])

    const chains: ChainTokenInfo[] = []

    for (const result of results) {
      if (result.status === 'fulfilled') {
        chains.push(result.value)
      } else {
        console.warn('Multichain fetch error:', result.reason?.message)
      }
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
