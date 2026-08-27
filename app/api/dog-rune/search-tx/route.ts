/**
 * Despite the name (legacy), this endpoint no longer hits the Unisat API.
 *
 * Now serves a single tx lookup from our own Supabase `dog_transactions`
 * table. Same response shape, no external dependency, no timeouts.
 *
 * Frontend caller: app/transactions/page.tsx searchTransaction()
 */

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function parseJson(v: any): any[] {
  if (Array.isArray(v)) return v
  if (!v) return []
  try { return JSON.parse(v) } catch { return [] }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const txid = (searchParams.get('txid') || '').trim().toLowerCase()

  if (!txid || !/^[0-9a-f]{64}$/.test(txid)) {
    return NextResponse.json(
      { error: 'Valid TXID required (64-char hex)' },
      { status: 400 }
    )
  }

  try {
    const { data, error } = await supabase
      .from('dog_transactions')
      .select('txid, block_height, timestamp, type, total_dog_moved, net_transfer, change_amount, has_change, fee_sats, sender_count, receiver_count, senders, receivers')
      .eq('txid', txid)
      .maybeSingle()

    if (error) {
      console.error('[search-tx] Supabase error:', error)
      return NextResponse.json({ error: 'Lookup failed', details: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Transaction not found', txid }, { status: 404 })
    }

    const row: any = data
    return NextResponse.json({
      txid: row.txid,
      block_height: row.block_height,
      timestamp: row.timestamp,
      type: row.type || 'transfer',
      senders: parseJson(row.senders),
      receivers: parseJson(row.receivers),
      // ⚠️ `total_dog_moved` é o BRUTO da linha (todas as saídas, troco
      // incluído). O que a tela chama de "movido" tem de ser o líquido, senão
      // uma doação de 50 mil aparece como 2 milhões. `total_dog_in` continua
      // bruto de propósito: é o que ENTROU na transação, e é assim que ele é
      // lido no explorador.
      total_dog_moved: row.net_transfer ?? row.total_dog_moved ?? 0,
      total_dog_in: row.total_dog_moved ?? 0,
      total_dog_out: row.net_transfer ?? row.total_dog_moved ?? 0,
      net_transfer: row.net_transfer ?? row.total_dog_moved ?? 0,
      change_amount: row.change_amount ?? 0,
      has_change: row.has_change ?? false,
      sender_count: row.sender_count ?? 0,
      receiver_count: row.receiver_count ?? 0,
      fee_sats: row.fee_sats ?? null,
      source: 'supabase',
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' }
    })
  } catch (err: any) {
    console.error('[search-tx] unexpected error:', err)
    return NextResponse.json(
      { error: 'Lookup failed', details: err.message || String(err) },
      { status: 500 }
    )
  }
}
