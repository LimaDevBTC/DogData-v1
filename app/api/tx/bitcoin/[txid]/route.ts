import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
)

// ─── Types ───────────────────────────────────────────────────────────────────

interface HolderEntry {
  rank: number
  address: string
  total_dog: number
}

interface ForensicProfile {
  address: string
  behavior_pattern: string
}

interface AddressLabel {
  id: string
  text: string
  description: string
}

let holdersMap: Map<string, HolderEntry> | null = null
let forensicMap: Map<string, ForensicProfile> | null = null

async function getHoldersMap(): Promise<Map<string, HolderEntry>> {
  if (holdersMap) return holdersMap
  const raw = await fs.readFile(path.join(process.cwd(), 'data', 'dog_holders_by_address.json'), 'utf-8')
  const data = JSON.parse(raw)
  holdersMap = new Map()
  for (const h of data.holders || []) holdersMap.set(h.address.toLowerCase(), h)
  return holdersMap
}

async function getForensicMap(): Promise<Map<string, ForensicProfile>> {
  if (forensicMap) return forensicMap
  const raw = await fs.readFile(path.join(process.cwd(), 'data', 'forensic_behavioral_analysis.json'), 'utf-8')
  const data = JSON.parse(raw)
  forensicMap = new Map()
  for (const p of data.all_profiles || []) forensicMap.set(p.address.toLowerCase(), p)
  return forensicMap
}

// ─── Labels ───────────────────────────────────────────────────────────────────

function getTierLabel(total_dog: number): AddressLabel {
  if (total_dog >= 500_000_000) return { id: 'whale',   text: 'Whale',   description: 'Top 10 holder' }
  if (total_dog >= 100_000_000) return { id: 'shark',   text: 'Shark',   description: 'Top 50 holder' }
  if (total_dog >=  50_000_000) return { id: 'dolphin', text: 'Dolphin', description: 'Top 100 holder' }
  if (total_dog >=  10_000_000) return { id: 'fish',    text: 'Fish',    description: 'Top 1,000 holder' }
  if (total_dog >=   1_000_000) return { id: 'shrimp',  text: 'Shrimp',  description: 'Top 10,000 holder' }
  return { id: 'plankton', text: 'Holder', description: 'DOG holder' }
}

const behaviorLabels: Record<string, { text: string }> = {
  diamond_paws: { text: 'Diamond Paws' },
  dog_legend:   { text: 'DOG Legend' },
  hodl_hero:    { text: 'HODL Hero' },
  paper_hands:  { text: 'Paper Hands' },
  panic_seller: { text: 'Panic Seller' },
  rune_master:  { text: 'Rune Master' },
}

function enrichAddress(
  address: string,
  holders: Map<string, HolderEntry>,
  forensic: Map<string, ForensicProfile>
): { holder_rank: number | null; label: AddressLabel | null; is_known: boolean } {
  const addrLower = address.toLowerCase()
  const holder = holders.get(addrLower)
  const profile = forensic.get(addrLower)

  let label: AddressLabel | null = null
  if (holder) {
    label = getTierLabel(holder.total_dog)
  } else if (profile) {
    const bl = behaviorLabels[profile.behavior_pattern]
    if (bl) label = { id: profile.behavior_pattern, text: bl.text, description: '' }
  }

  return {
    holder_rank: holder?.rank ?? null,
    label,
    is_known: !!(holder || profile),
  }
}

function classifyTx(
  senders: Array<{ address: string; amount_dog: number; holder_rank: number | null }>,
  receivers: Array<{ address: string; amount_dog: number; holder_rank: number | null; is_change: boolean }>
): 'whale_movement' | 'airdrop_og_activity' | 'consolidation' | 'normal' {
  const senderSet = new Set(senders.map(s => s.address.toLowerCase()))
  const allReceiversAreSenders = receivers.filter(r => !r.is_change).every(r => senderSet.has(r.address.toLowerCase()))
  if (allReceiversAreSenders && receivers.filter(r => !r.is_change).length > 0) return 'consolidation'

  const totalMoved = senders.reduce((s, x) => s + x.amount_dog, 0)
  if (totalMoved >= 1_000_000) return 'whale_movement'

  const hasHighRank = [...senders, ...receivers].some(p => p.holder_rank !== null && p.holder_rank <= 100)
  if (hasHighRank) return 'airdrop_og_activity'

  return 'normal'
}

function parseJsonArr(val: string | any[] | null | undefined): any[] {
  if (!val) return []
  if (Array.isArray(val)) return val
  try { return JSON.parse(val) } catch { return [] }
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ txid: string }> }
) {
  const { txid: rawTxid } = await params
  const txid = rawTxid.trim().toLowerCase()

  if (!/^[0-9a-f]{64}$/.test(txid)) {
    return NextResponse.json({ error: 'Invalid txid format' }, { status: 400 })
  }

  try {
    const [holders, forensic, txQuery] = await Promise.all([
      getHoldersMap(),
      getForensicMap(),
      supabase
        .from('dog_transactions')
        .select('txid, block_height, timestamp, type, fee_sats, total_dog_moved, senders, receivers')
        .eq('txid', txid)
        .maybeSingle(),
    ])

    if (txQuery.error) throw new Error(`Supabase tx query failed: ${txQuery.error.message}`)

    const rawTx = txQuery.data
    if (!rawTx) {
      return NextResponse.json({ error: 'Transaction not found', txid }, { status: 404 })
    }

    const senders = parseJsonArr(rawTx.senders)
      .filter((s: any) => s.has_dog !== false && s.amount_dog > 0)
      .map((s: any) => ({
        address: s.address,
        amount_dog: s.amount_dog,
        ...enrichAddress(s.address, holders, forensic),
      }))

    const receivers = parseJsonArr(rawTx.receivers)
      .filter((r: any) => r.has_dog !== false && r.amount_dog > 0)
      .map((r: any) => ({
        address: r.address,
        amount_dog: r.amount_dog,
        is_change: r.is_change || false,
        ...enrichAddress(r.address, holders, forensic),
      }))

    const classification = classifyTx(senders, receivers)

    return NextResponse.json({
      txid: rawTx.txid,
      block_height: rawTx.block_height,
      timestamp: rawTx.timestamp,
      type: rawTx.type || 'transfer',
      fee_sats: rawTx.fee_sats || 0,
      total_dog_moved: rawTx.total_dog_moved || 0,
      senders,
      receivers,
      classification,
      mempool_link: `https://mempool.space/tx/${rawTx.txid}`,
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=300' },
    })
  } catch (err: any) {
    console.error('[tx route] error:', err)
    return NextResponse.json({ error: 'Internal server error', message: err.message }, { status: 500 })
  }
}
