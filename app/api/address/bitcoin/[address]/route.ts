import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { redisClient } from '@/lib/upstash'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ─── File-based index (fallback when Redis index not built) ───────────────────
//
// Built lazily on first request, kept in module memory for the lifetime of the
// Node.js process. On Vercel (where block files are excluded from the bundle)
// this stays null and the Redis index is the only source.

let fileAddrIndex: Map<string, TxEntry[]> | null = null
let fileIndexPromise: Promise<Map<string, TxEntry[]>> | null = null

async function buildFileIndex(): Promise<Map<string, TxEntry[]>> {
  if (fileAddrIndex) return fileAddrIndex

  const TX_DIR = path.join(process.cwd(), 'data', 'dog_transactions')
  let files: string[]
  try {
    files = await fs.readdir(TX_DIR)
  } catch {
    // Block files not available (e.g. Vercel serverless)
    return new Map()
  }

  const blockFiles = files
    .filter(f => f.startsWith('block_') && f.endsWith('.json'))
    .sort()

  const index = new Map<string, TxEntry[]>()

  // Process in parallel batches of 80 to avoid too many open file handles
  const BATCH = 80
  for (let i = 0; i < blockFiles.length; i += BATCH) {
    const batch = blockFiles.slice(i, i + BATCH)
    const contents = await Promise.all(
      batch.map(f => fs.readFile(path.join(TX_DIR, f), 'utf-8').catch(() => null))
    )

    for (const raw of contents) {
      if (!raw) continue
      let block: any
      try { block = JSON.parse(raw) } catch { continue }

      for (const tx of block.transactions || []) {
        const senders = (tx.senders || []).filter((s: any) => s.has_dog !== false && s.amount_dog > 0)
        const receivers = (tx.receivers || []).filter((r: any) => r.has_dog !== false && r.amount_dog > 0 && !r.is_change)

        const senderAddrs = new Set(senders.map((s: any) => s.address as string))
        const receiverAddrs = new Set(receivers.map((r: any) => r.address as string))
        const allAddrs = Array.from(new Set([...Array.from(senderAddrs), ...Array.from(receiverAddrs)]))

        for (const addr of allAddrs) {
          const addrLower = (addr as string).toLowerCase()
          const isSender = senderAddrs.has(addr as string)
          const isReceiver = receiverAddrs.has(addr)

          const direction: 'in' | 'out' | 'self' =
            isSender && isReceiver ? 'self' : isSender ? 'out' : 'in'

          const amount_dog: number = isSender
            ? (senders.find((s: any) => s.address === addr)?.amount_dog || 0)
            : (receivers.find((r: any) => r.address === addr)?.amount_dog || 0)

          const otherAddrs = [
            ...senders.filter((s: any) => s.address !== addr).map((s: any) => s.address),
            ...receivers.filter((r: any) => r.address !== addr).map((r: any) => r.address),
          ]
          const counterparties: string[] = Array.from(new Set(otherAddrs))

          const entry: TxEntry = {
            txid: tx.txid,
            block_height: tx.block_height,
            timestamp: tx.timestamp,
            direction,
            amount_dog,
            counterparty: counterparties.length === 1 ? counterparties[0] : null,
            counterparties,
            total_dog_moved: tx.total_dog_moved || 0,
            fee_sats: tx.fee_sats || 0,
          }

          if (!index.has(addrLower)) index.set(addrLower, [])
          index.get(addrLower)!.push(entry)
        }
      }
    }
  }

  // Sort each address list by block desc
  for (const [, txs] of Array.from(index)) {
    txs.sort((a, b) => b.block_height - a.block_height)
  }

  fileAddrIndex = index
  console.log(`[address-index] File index built: ${index.size} addresses from ${blockFiles.length} blocks`)
  return index
}

async function getFileIndexForAddress(addrLower: string): Promise<TxEntry[]> {
  // Start building once, share the same promise across concurrent requests
  if (!fileIndexPromise) {
    fileIndexPromise = buildFileIndex()
  }
  const index = await fileIndexPromise
  return index.get(addrLower) || []
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface HolderEntry {
  rank: number
  address: string
  total_amount: number
  total_dog: number
  utxo_count: number
}

interface ForensicProfile {
  address: string
  airdrop_rank: number
  airdrop_amount: number
  current_balance: number
  current_rank: number
  retention_rate: number
  diamond_score: number
  behavior_pattern: string
  behavior_detail: string
  is_dumping: boolean
  insights: string[]
  accumulation_rate?: number
}

interface TxEntry {
  txid: string
  block_height: number
  timestamp: string
  direction: 'in' | 'out' | 'self'
  amount_dog: number
  counterparty: string | null
  counterparties: string[]
  total_dog_moved: number
  fee_sats: number
  synthetic?: boolean
  synthetic_label?: string
}

interface AddressLabel {
  id: string
  text: string
  description: string
}

// ─── Module-level caches (survive across requests in the same Node.js process) ─

let holdersMap: Map<string, HolderEntry> | null = null
let holdersTimestamp = ''
let holdersTotal = 0

let forensicMap: Map<string, ForensicProfile> | null = null

async function getHoldersMap(): Promise<{ map: Map<string, HolderEntry>; total: number; timestamp: string }> {
  if (holdersMap) return { map: holdersMap, total: holdersTotal, timestamp: holdersTimestamp }

  const filePath = path.join(process.cwd(), 'data', 'dog_holders_by_address.json')
  const raw = await fs.readFile(filePath, 'utf-8')
  const data = JSON.parse(raw)

  holdersTotal = data.total_holders || data.holders?.length || 0
  holdersTimestamp = data.timestamp || new Date().toISOString()
  holdersMap = new Map()
  for (const h of data.holders || []) {
    holdersMap.set(h.address.toLowerCase(), h)
  }
  return { map: holdersMap, total: holdersTotal, timestamp: holdersTimestamp }
}

async function getForensicMap(): Promise<Map<string, ForensicProfile>> {
  if (forensicMap) return forensicMap

  const filePath = path.join(process.cwd(), 'data', 'forensic_behavioral_analysis.json')
  const raw = await fs.readFile(filePath, 'utf-8')
  const data = JSON.parse(raw)

  forensicMap = new Map()
  for (const p of data.all_profiles || []) {
    forensicMap.set(p.address.toLowerCase(), p)
  }
  return forensicMap
}

// ─── Labels ──────────────────────────────────────────────────────────────────

function getTierLabel(total_dog: number): AddressLabel {
  if (total_dog >= 500_000_000) return { id: 'whale',   text: 'Whale',   description: 'Top 10 holder' }
  if (total_dog >= 100_000_000) return { id: 'shark',   text: 'Shark',   description: 'Top 50 holder' }
  if (total_dog >=  50_000_000) return { id: 'dolphin', text: 'Dolphin', description: 'Top 100 holder' }
  if (total_dog >=  10_000_000) return { id: 'fish',    text: 'Fish',    description: 'Top 1,000 holder' }
  if (total_dog >=   1_000_000) return { id: 'shrimp',  text: 'Shrimp',  description: 'Top 10,000 holder' }
  return { id: 'plankton', text: 'Holder', description: 'DOG holder' }
}

const behaviorLabelMap: Record<string, { text: string; description: string }> = {
  diamond_paws:      { text: 'Diamond Paws',      description: 'Held exact airdrop amount' },
  dog_legend:        { text: 'DOG Legend',        description: 'Major accumulator' },
  hodl_hero:         { text: 'HODL Hero',         description: 'Long-term holder' },
  satoshi_visionary: { text: 'Satoshi Visionary', description: 'Early believer' },
  rune_master:       { text: 'Rune Master',       description: 'Rune-native holder' },
  steady_holder:     { text: 'Steady Holder',     description: 'Consistent holding' },
  ordinal_believer:  { text: 'Ordinal Believer',  description: 'Ordinal-focused holder' },
  btc_maximalist:    { text: 'BTC Maximalist',    description: 'BTC-first behavior' },
  paper_hands:       { text: 'Paper Hands',       description: 'Sold airdrop' },
  panic_seller:      { text: 'Panic Seller',      description: 'Sold during dips' },
  profit_taker:      { text: 'Profit Taker',      description: 'Took profits strategically' },
  early_exit:        { text: 'Early Exit',        description: 'Sold early' },
}

function computeLabels(holder: HolderEntry | null, forensic: ForensicProfile | null): AddressLabel[] {
  const labels: AddressLabel[] = []

  if (holder) {
    labels.push(getTierLabel(holder.total_dog))
    if (holder.rank <= 10)       labels.push({ id: 'top10',  text: 'Top 10 Holder',  description: 'Rank #' + holder.rank })
    else if (holder.rank <= 100) labels.push({ id: 'top100', text: 'Top 100 Holder', description: 'Rank #' + holder.rank })
  }

  if (forensic) {
    labels.push({ id: 'airdrop_og', text: 'Airdrop OG', description: `Airdrop rank #${forensic.airdrop_rank}` })

    const bl = behaviorLabelMap[forensic.behavior_pattern]
    if (bl) labels.push({ id: forensic.behavior_pattern, ...bl })

    if (forensic.current_balance > forensic.airdrop_amount) {
      labels.push({ id: 'accumulator', text: 'Accumulator', description: 'Bought more after airdrop' })
    }
  }

  return labels
}

// ─── Stats from tx history ────────────────────────────────────────────────────

function computeStats(txs: TxEntry[]) {
  let total_received = 0
  let total_sent = 0
  let first_ts: string | null = null
  let last_ts: string | null = null
  let first_block: number | null = null
  let last_block: number | null = null
  let largest_receive = 0
  let largest_send = 0

  for (const tx of txs) {
    if (tx.direction === 'in') {
      total_received += tx.amount_dog
      if (tx.amount_dog > largest_receive) largest_receive = tx.amount_dog
    } else if (tx.direction === 'out') {
      total_sent += tx.amount_dog
      if (tx.amount_dog > largest_send) largest_send = tx.amount_dog
    }

    if (!first_block || tx.block_height < first_block) {
      first_block = tx.block_height
      first_ts = tx.timestamp
    }
    if (!last_block || tx.block_height > last_block) {
      last_block = tx.block_height
      last_ts = tx.timestamp
    }
  }

  return {
    total_received_dog: total_received,
    total_sent_dog: total_sent,
    first_tx_timestamp: first_ts,
    last_tx_timestamp: last_ts,
    first_tx_block: first_block,
    last_tx_block: last_block,
    largest_single_receive: largest_receive,
    largest_single_send: largest_send,
  }
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address: rawAddress } = await params
  const address = rawAddress.trim()
  const addressLower = address.toLowerCase()

  // Optional pagination & filter for the transactions array
  const sp = req.nextUrl.searchParams
  const txLimitRaw = Number(sp.get('limit') ?? '0')
  const txOffsetRaw = Number(sp.get('offset') ?? '0')
  const direction = sp.get('direction') // "in" | "out" | null (= all)
  const wantsPagination = sp.has('limit') || sp.has('offset') || sp.has('direction')
  const txLimit = Number.isFinite(txLimitRaw) && txLimitRaw > 0
    ? Math.min(Math.floor(txLimitRaw), 500)
    : 50
  const txOffset = Number.isFinite(txOffsetRaw) && txOffsetRaw >= 0 ? Math.floor(txOffsetRaw) : 0

  try {
    const [holdersData, forensicData, txsRaw, indexMeta] = await Promise.all([
      getHoldersMap(),
      getForensicMap(),
      redisClient.get<string>(`dog:addr:txs:${addressLower}`),
      redisClient.get<string>('dog:addr:index:meta'),
    ])

    const holder = holdersData.map.get(addressLower) || null
    const forensic = forensicData.get(addressLower) || null

    // Parse transactions from Redis
    let transactions: TxEntry[] = []
    if (txsRaw) {
      try {
        transactions = typeof txsRaw === 'string' ? JSON.parse(txsRaw) : (txsRaw as TxEntry[])
      } catch {}
    }

    // Fallback: if Redis index not yet built, scan block files in memory
    const redisIndexBuilt = !!indexMeta
    if (!redisIndexBuilt && transactions.length === 0) {
      transactions = await getFileIndexForAddress(addressLower)
    }

    // Synthetic airdrop entry: forensic profile exists but no txs found in indexed range
    // The DOG airdrop was at block ~840,000; our block files start at 941,111.
    // We synthesise a representative entry so the holder sees their original receipt.
    if (forensic && transactions.length === 0 && forensic.airdrop_amount > 0) {
      transactions = [{
        txid: 'airdrop-synthetic',
        block_height: 840000,
        timestamp: '2024-04-20T00:00:00.000Z',
        direction: 'in',
        amount_dog: forensic.airdrop_amount,
        counterparty: null,
        counterparties: [],
        total_dog_moved: forensic.airdrop_amount,
        fee_sats: 0,
        synthetic: true,
        synthetic_label: 'DOG Airdrop (block ~840,000)',
      }]
    }

    if (!holder && !forensic && transactions.length === 0) {
      return NextResponse.json({
        address,
        status: 'not_a_dog_holder',
        holder: null,
        forensic: null,
        labels: [],
        transactions: [],
        tx_count: 0,
        stats: computeStats([]),
        metadata: {
          indexed_blocks: 0,
          last_updated: new Date().toISOString(),
          total_holders: holdersData.total,
        },
      }, {
        headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
      })
    }

    let meta: { last_block?: number; built_at?: string } = {}
    if (indexMeta) {
      try { meta = typeof indexMeta === 'string' ? JSON.parse(indexMeta) : (indexMeta as object) } catch {}
    }

    const status = holder
      ? 'holder'
      : forensic
        ? 'forensic_only'
        : 'tx_only'

    const holderPayload = holder
      ? {
          rank: holder.rank,
          total_dog: holder.total_dog,
          total_amount: holder.total_amount,
          utxo_count: holder.utxo_count,
          percentile: parseFloat(((holder.rank / holdersData.total) * 100).toFixed(4)),
        }
      : null

    const forensicPayload = forensic
      ? {
          behavior_pattern: forensic.behavior_pattern,
          behavior_detail: forensic.behavior_detail,
          airdrop_rank: forensic.airdrop_rank,
          airdrop_amount: forensic.airdrop_amount,
          current_balance: forensic.current_balance,
          retention_rate: forensic.retention_rate,
          diamond_score: forensic.diamond_score,
          is_dumping: forensic.is_dumping,
          insights: forensic.insights,
        }
      : null

    // Apply optional direction filter + pagination over transactions
    const filteredTxs = direction === 'in' || direction === 'out'
      ? transactions.filter(t => t.direction === direction)
      : transactions

    const totalTxs = filteredTxs.length
    const pagedTxs = wantsPagination
      ? filteredTxs.slice(txOffset, txOffset + txLimit)
      : filteredTxs

    return NextResponse.json({
      address,
      status,
      holder: holderPayload,
      forensic: forensicPayload,
      labels: computeLabels(holder, forensic),
      transactions: pagedTxs,
      tx_count: totalTxs,
      stats: computeStats(transactions),
      pagination: wantsPagination
        ? {
            offset: txOffset,
            limit: txLimit,
            total: totalTxs,
            has_more: txOffset + txLimit < totalTxs,
            direction: direction ?? 'all',
          }
        : null,
      last_updated: meta.built_at || new Date().toISOString(),
      metadata: {
        indexed_blocks: meta.last_block || 0,
        last_updated: meta.built_at || new Date().toISOString(),
        total_holders: holdersData.total,
        block_range: { from: 941111, to: meta.last_block || 946936 },
      },
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
    })
  } catch (err: any) {
    console.error('[address route] error:', err)
    return NextResponse.json({ error: 'Internal server error', message: err.message }, { status: 500 })
  }
}
