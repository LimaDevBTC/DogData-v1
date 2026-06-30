import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DONATION_WALLET = 'bc1pxk7aw9ug55jkkz02z7ayhlkxxq92ya0ctegcwm5j8jumgaavjlkqdylk2p'
const DOG_GOAL = 10_000_000

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
)

function parseJsonArr(val: string | any[] | null | undefined): any[] {
  if (!val) return []
  if (Array.isArray(val)) return val
  try { return JSON.parse(val) } catch { return [] }
}

export async function GET(_req: NextRequest) {
  try {
    // Fetch all txs involving the donation wallet
    const { data, error } = await supabase
      .from('dog_transactions')
      .select('txid, block_height, timestamp, total_dog_moved, senders, receivers')
      .contains('addresses', [DONATION_WALLET])
      .order('block_height', { ascending: false })
      .limit(5000)

    if (error) throw new Error(error.message)

    const rows = data ?? []
    const wallet = DONATION_WALLET.toLowerCase()

    // Aggregate donations by sender address
    const donorMap = new Map<string, { total: number; txCount: number; lastTx: string }>()
    let totalReceived = 0

    for (const row of rows) {
      const receivers = parseJsonArr(row.receivers).filter(
        (r: any) => r.has_dog !== false && r.amount_dog > 0 && !r.is_change
      )
      const isReceiver = receivers.some(
        (r: any) => r.address?.toLowerCase() === wallet
      )
      if (!isReceiver) continue

      const walletReceiver = receivers.find((r: any) => r.address?.toLowerCase() === wallet)
      const amount: number = walletReceiver?.amount_dog ?? 0
      if (amount <= 0) continue

      totalReceived += amount

      const senders = parseJsonArr(row.senders).filter(
        (s: any) => s.has_dog !== false && s.amount_dog > 0
      )
      // Credit each sender proportionally; if only one sender, full amount
      const donorAddresses = senders
        .map((s: any) => s.address as string)
        .filter((a) => a && a.toLowerCase() !== wallet)

      const perDonor = donorAddresses.length > 0 ? amount / donorAddresses.length : amount

      for (const addr of donorAddresses) {
        const key = addr.toLowerCase()
        const existing = donorMap.get(key) ?? { total: 0, txCount: 0, lastTx: '' }
        existing.total += perDonor
        existing.txCount += 1
        if (!existing.lastTx || row.timestamp > existing.lastTx) existing.lastTx = row.timestamp
        donorMap.set(key, existing)
      }
    }

    const leaderboard = Array.from(donorMap.entries())
      .map(([address, data]) => ({ address, ...data }))
      .sort((a, b) => b.total - a.total)
      .map((entry, i) => ({ rank: i + 1, ...entry }))

    return NextResponse.json(
      {
        wallet: DONATION_WALLET,
        goal: DOG_GOAL,
        total_received: totalReceived,
        progress_pct: Math.min((totalReceived / DOG_GOAL) * 100, 100),
        donor_count: leaderboard.length,
        leaderboard,
        last_updated: new Date().toISOString(),
      },
      {
        headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=60' },
      }
    )
  } catch (err: any) {
    console.error('[donate/leaderboard] error:', err)
    return NextResponse.json(
      { error: 'Internal server error', message: err.message },
      { status: 500 }
    )
  }
}
