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
    // Fetch all txs that involve the donation wallet
    const { data, error } = await supabase
      .from('dog_transactions')
      .select('txid, block_height, timestamp, total_dog_moved, senders, receivers, addresses')
      .contains('addresses', [DONATION_WALLET])
      .order('block_height', { ascending: false })
      .limit(5000)

    if (error) throw new Error(error.message)

    const rows = data ?? []
    const wallet = DONATION_WALLET.toLowerCase()

    const donorMap = new Map<string, { total: number; txCount: number; lastTx: string }>()
    let totalReceived = 0

    for (const row of rows) {
      // Search ALL receivers with no filtering — the indexer sometimes omits
      // has_dog/is_change flags; we just need to find our wallet in the list.
      const allReceivers = parseJsonArr(row.receivers)
      const walletEntry = allReceivers.find(
        (r: any) => r.address?.toLowerCase() === wallet
      )
      if (!walletEntry) continue

      // Accept whatever amount field is populated
      const amount: number =
        walletEntry.amount_dog ??
        walletEntry.dog_amount ??
        walletEntry.total_dog ??
        0
      if (amount <= 0) continue

      totalReceived += amount

      // Identify donors: any sender that is NOT the donation wallet itself
      const allSenders = parseJsonArr(row.senders)
      let donorAddresses = allSenders
        .map((s: any) => (s.address as string | undefined)?.toLowerCase())
        .filter((a): a is string => !!a && a !== wallet)

      // Fallback 1: indexer occasionally leaves `senders` empty even though
      // a real counterparty exists (e.g. unresolved input). Use any other
      // receiver on the same tx (typically a change output) as the donor.
      if (donorAddresses.length === 0) {
        const otherReceivers = allReceivers
          .map((r: any) => (r.address as string | undefined)?.toLowerCase())
          .filter((a): a is string => !!a && a !== wallet)
        donorAddresses = Array.from(new Set(otherReceivers))
      }

      // Fallback 2: any other address tied to the tx at all.
      if (donorAddresses.length === 0) {
        const allAddrs = parseJsonArr(row.addresses)
          .map((a: any) => (typeof a === 'string' ? a : a?.address)?.toLowerCase())
          .filter((a): a is string => !!a && a !== wallet)
        donorAddresses = Array.from(new Set(allAddrs))
      }

      // Last resort: no resolvable counterparty at all — still surface the
      // donation (per requirement that every tx sent to the wallet appears
      // in the ranking) under a shared "Anonymous" bucket.
      if (donorAddresses.length === 0) {
        donorAddresses = ['anonymous']
      }

      const perDonor = amount / donorAddresses.length

      for (const addr of donorAddresses) {
        const rec = donorMap.get(addr) ?? { total: 0, txCount: 0, lastTx: '' }
        rec.total += perDonor
        rec.txCount += 1
        if (!rec.lastTx || row.timestamp > rec.lastTx) rec.lastTx = row.timestamp
        donorMap.set(addr, rec)
      }
    }

    const leaderboard = Array.from(donorMap.entries())
      .map(([address, d]) => ({ address, ...d }))
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
      { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=60' } }
    )
  } catch (err: any) {
    console.error('[donate/leaderboard] error:', err)
    return NextResponse.json(
      { error: 'Internal server error', message: err.message },
      { status: 500 }
    )
  }
}
