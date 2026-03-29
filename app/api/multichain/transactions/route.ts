import { NextRequest, NextResponse } from 'next/server'
import { getStacksTransactions } from '@/lib/multichain/tenero'
import type { Chain } from '@/lib/multichain/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const chain = request.nextUrl.searchParams.get('chain') as Chain | null
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50', 10)

    const response: Record<string, any> = {}

    if (!chain || chain === 'stacks') {
      response.stacks = await getStacksTransactions(limit)
    }

    if (!chain || chain === 'solana') {
      // Birdeye free tier doesn't expose individual transactions
      response.solana = {
        transactions: [],
        total_count: 0,
        note: 'Individual transactions not available on Birdeye free tier. Trade count available via /api/multichain/stats',
      }
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=30',
      },
    })
  } catch (error: any) {
    console.error('Multichain transactions error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch multichain transactions', message: error.message },
      { status: 500 }
    )
  }
}
