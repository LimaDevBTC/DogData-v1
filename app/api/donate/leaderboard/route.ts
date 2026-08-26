import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DONATION_WALLET = 'bc1pxk7aw9ug55jkkz02z7ayhlkxxq92ya0ctegcwm5j8jumgaavjlkqdylk2p'
const DOG_GOAL = 10_000_000

// SalesCity license ladder — a wallet's *accumulated* DOG donated unlocks tiers.
// The donation address is the product: no checkout, no second SKU.
const PERSONAL_LICENSE = 10_000
const COMMERCIAL_LICENSE = 50_000
const PATRON_TIER = 500_000

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

function licenseFor(total: number): 'commercial' | 'personal' | 'citizen' {
  if (total >= COMMERCIAL_LICENSE) return 'commercial'
  if (total >= PERSONAL_LICENSE) return 'personal'
  return 'citizen'
}

// ⚠️ DISJUNTOR (incidente de IO de 26/08): esta rota mora no portão de carga
// da praça e da landing; pendurada no banco anêmico ela travou a cidade nos
// 90%. Prazo de 8s: estourou, 503 rápido com cache curto na CDN pra
// segurar a manada, e o cliente segue sem o leaderboard.
export async function GET(req: NextRequest) {
  let timer: ReturnType<typeof setTimeout> | null = null
  const prazo = new Promise<NextResponse>((res) => {
    timer = setTimeout(() => res(NextResponse.json(
      { error: 'data backend busy' },
      { status: 503, headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=60' } },
    )), 8000)
  })
  try {
    return await Promise.race([handler(req).catch(() => NextResponse.json(
      { error: 'leaderboard unavailable' },
      { status: 503, headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=60' } },
    )), prazo])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function handler(_req: NextRequest) {
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

    // Every individual donation event — used for the live feed and to compute
    // founder_seq (the order in which each wallet's cumulative crossed 10k).
    type DonationEvent = { address: string; amount: number; timestamp: string; txid: string; block_height: number }
    const events: DonationEvent[] = []

    for (const row of rows) {
      // Skip any tx where the donation wallet SPENDS DOG (a withdrawal or
      // self-move). This total is "funds donated", never the live wallet
      // balance — withdrawing DOG must not lower it, must not re-count a
      // change output back to the wallet as a new donation, and must not
      // surface the withdrawal destination as a "donor" via the fallbacks
      // below. Genuine donations are always external → wallet, so the wallet
      // never appears among the senders of a real donation.
      const allSenders = parseJsonArr(row.senders)
      const walletIsSender = allSenders.some(
        (s: any) => (s.address as string | undefined)?.toLowerCase() === wallet
      )
      if (walletIsSender) continue

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
      // (allSenders was parsed above for the withdrawal guard)
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

        events.push({
          address: addr,
          amount: perDonor,
          timestamp: row.timestamp,
          txid: row.txid,
          block_height: row.block_height,
        })
      }
    }

    const leaderboard = Array.from(donorMap.entries())
      .map(([address, d]) => ({ address, ...d, license: licenseFor(d.total) }))
      .sort((a, b) => b.total - a.total)
      .map((entry, i) => ({ rank: i + 1, ...entry }))

    // ── Founders ───────────────────────────────────────────────────────────────
    // Everyone who donates before the 10M goal is a Founder — any amount, ranked
    // by *arrival* (the wallet's first donation). No slot cap: the register only
    // closes when the fund reaches the goal. Replay events oldest → newest.
    const chronological = [...events].sort((a, b) => {
      if (a.timestamp && b.timestamp && a.timestamp !== b.timestamp)
        return a.timestamp < b.timestamp ? -1 : 1
      return a.block_height - b.block_height
    })
    const seenDonors = new Set<string>()
    const crossings: { address: string; crossedAt: string; block_height: number }[] = []
    for (const ev of chronological) {
      if (ev.address === 'anonymous') continue
      if (seenDonors.has(ev.address)) continue
      seenDonors.add(ev.address)
      crossings.push({ address: ev.address, crossedAt: ev.timestamp, block_height: ev.block_height })
    }
    const founders = crossings
      .map((c) => ({
        founder_seq: 0,
        address: c.address,
        crossed_at: c.crossedAt,
        total: donorMap.get(c.address)?.total ?? 0,
        license: licenseFor(donorMap.get(c.address)?.total ?? 0),
      }))
      .map((f, i) => ({ ...f, founder_seq: i + 1 }))

    const foundersCount = founders.length

    // ── Live feed — most recent donations (newest first) ───────────────────────
    const recent = [...events]
      .filter((e) => e.address !== 'anonymous')
      .sort((a, b) => {
        if (a.timestamp && b.timestamp && a.timestamp !== b.timestamp)
          return a.timestamp < b.timestamp ? 1 : -1
        return b.block_height - a.block_height
      })
      .slice(0, 20)
      .map((e) => ({
        address: e.address,
        amount: e.amount,
        timestamp: e.timestamp,
        txid: e.txid,
      }))

    return NextResponse.json(
      {
        wallet: DONATION_WALLET,
        goal: DOG_GOAL,
        total_received: totalReceived,
        progress_pct: Math.min((totalReceived / DOG_GOAL) * 100, 100),
        donor_count: leaderboard.length,
        leaderboard,
        // SalesCity additions
        tiers: {
          personal: PERSONAL_LICENSE,
          commercial: COMMERCIAL_LICENSE,
          patron: PATRON_TIER,
        },
        founders_count: foundersCount,
        founders,
        recent,
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
