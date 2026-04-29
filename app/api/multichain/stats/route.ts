import { NextResponse } from 'next/server'
import { getSolanaTokenInfoFromDexScreener } from '@/lib/multichain/dexscreener'
import { getSolanaTokenInfo as getSolanaTokenInfoBirdeye } from '@/lib/multichain/birdeye'
import { getSolanaHolderCount } from '@/lib/multichain/helius'
import { getStacksTokenInfoResilient as getStacksTokenInfo } from '@/lib/multichain/stacks-resilient'
import type { MultiChainStats, ChainTokenInfo } from '@/lib/multichain/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function getSolanaInfo(): Promise<ChainTokenInfo> {
  // DexScreener is primary (free, no limits) — Birdeye as fallback
  try {
    return await getSolanaTokenInfoFromDexScreener()
  } catch (err) {
    console.warn('DexScreener failed, falling back to Birdeye:', (err as Error).message)
    return await getSolanaTokenInfoBirdeye()
  }
}

export async function GET() {
  try {
    const [solanaResult, stacksResult, heliusCountResult] = await Promise.allSettled([
      getSolanaInfo(),
      getStacksTokenInfo(),
      getSolanaHolderCount(),
    ])

    const chains: ChainTokenInfo[] = []

    const heliusCount = heliusCountResult.status === 'fulfilled' ? heliusCountResult.value : 0

    if (solanaResult.status === 'fulfilled') {
      const solanaInfo = solanaResult.value
      if (heliusCount > 0) solanaInfo.holder_count = heliusCount
      chains.push(solanaInfo)
    } else {
      console.warn('Multichain Solana failed:', solanaResult.reason?.message)
      // Still push a minimal entry so Stacks is not lost
      if (heliusCount > 0) {
        chains.push({
          chain: 'solana',
          address: 'dog1viwbb2vWDpER5FrJ4YFG6gq6XuyFohUe9TXN65u',
          symbol: 'DOG',
          name: 'Dog (Bitcoin)',
          decimals: 5,
          price_usd: 0,
          price_change_24h: 0,
          market_cap_usd: 0,
          volume_24h_usd: 0,
          liquidity_usd: null,
          holder_count: heliusCount,
          total_supply: 0,
          circulating_supply: 0,
          last_updated: new Date().toISOString(),
        })
      }
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
