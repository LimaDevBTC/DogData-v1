/**
 * Despite the name (legacy), this endpoint no longer hits the Unisat API.
 *
 * It now serves the same response shape from our own indexed Supabase
 * `dog_transactions` table — populated continuously by dog_block_scanner.py.
 * Removing the Unisat dependency fixes timeouts and keeps freshness aligned
 * with the rest of the platform.
 *
 * The query string contract is preserved for backwards compatibility:
 *   ?offset=N  → paginate older txs (page = floor(offset / 100))
 *
 * Frontend caller: app/transactions/page.tsx loadMoreTransactions()
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const PAGE_SIZE = 100

interface RawTxRow {
  txid: string
  block_height: number
  timestamp: string
  type: string
  total_dog_moved: number | null
  net_transfer: number | null
  change_amount: number | null
  has_change: boolean | null
  fee_sats: number | null
  sender_count: number | null
  receiver_count: number | null
  senders: any
  receivers: any
}

function parseJson(v: any): any[] {
  if (Array.isArray(v)) return v
  if (!v) return []
  try { return JSON.parse(v) } catch { return [] }
}

function shapeRow(row: RawTxRow) {
  return {
    txid: row.txid,
    block_height: row.block_height,
    timestamp: row.timestamp,
    type: row.type || 'transfer',
    senders: parseJson(row.senders),
    receivers: parseJson(row.receivers),
    total_dog_moved: row.total_dog_moved ?? 0,
    total_dog_in: row.total_dog_moved ?? 0, // legacy alias
    total_dog_out: row.total_dog_moved ?? 0,
    net_transfer: row.net_transfer ?? row.total_dog_moved ?? 0,
    change_amount: row.change_amount ?? 0,
    has_change: row.has_change ?? false,
    sender_count: row.sender_count ?? 0,
    receiver_count: row.receiver_count ?? 0,
    fee_sats: row.fee_sats ?? null,
  }
}

export async function GET(request: NextRequest) {
  const offset = Math.max(0, parseInt(request.nextUrl.searchParams.get('offset') || '0'))
  const limit = PAGE_SIZE

  try {
    const { data, error, count } = await supabase
      .from('dog_transactions')
      .select(
        'txid, block_height, timestamp, type, total_dog_moved, net_transfer, change_amount, has_change, fee_sats, sender_count, receiver_count, senders, receivers',
        { count: 'estimated' }
      )
      .order('block_height', { ascending: false })
      .order('txid', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('[transactions-unisat] Supabase error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch transactions', details: error.message, offset, limit },
        { status: 500 }
      )
    }

    const rows = (data || []) as RawTxRow[]
    const transactions = rows.map(shapeRow)

    return NextResponse.json({
      transactions,
      hasMore: rows.length === limit,
      nextOffset: offset + rows.length,
      totalEvents: count ?? null,
      source: 'supabase',
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' }
    })
  } catch (err: any) {
    console.error('[transactions-unisat] unexpected error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch transactions', details: err.message || String(err), offset, limit },
      { status: 500 }
    )
  }
}
