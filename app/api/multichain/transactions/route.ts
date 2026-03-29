import { NextRequest, NextResponse } from 'next/server'
import { getStacksTransactions } from '@/lib/multichain/tenero'
import { getSolanaTransactions } from '@/lib/multichain/helius'
import type { Chain } from '@/lib/multichain/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const chain = request.nextUrl.searchParams.get('chain') as Chain | null
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '30', 10)

    const response: Record<string, any> = {}

    const fetches: Promise<void>[] = []

    if (!chain || chain === 'stacks') {
      fetches.push(
        getStacksTransactions(limit)
          .then(data => { response.stacks = data })
          .catch(err => {
            console.warn('Stacks transactions error:', err.message)
            response.stacks = { transactions: [], total_count: 0 }
          })
      )
    }

    if (!chain || chain === 'solana') {
      fetches.push(
        getSolanaTransactions(limit)
          .then(data => { response.solana = data })
          .catch(err => {
            console.warn('Solana transactions error:', err.message)
            response.solana = { transactions: [], total_count: 0 }
          })
      )
    }

    await Promise.all(fetches)

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
