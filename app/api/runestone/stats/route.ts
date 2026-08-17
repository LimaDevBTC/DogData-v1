import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Headline numbers for the collection AS IT IS NOW.
//
// The previous version of this route derived "total_stones" and "total_holders"
// from DOG airdrop payments at block 840,000, which described April 2024 and
// not the present. Current custody now comes from the dossier, and the airdrop
// figures stay, clearly named as the historical cohort they are.
let _cache: { body: unknown; ts: number } | null = null

export async function GET() {
  try {
    const now = Date.now()
    if (_cache && now - _cache.ts < 5 * 60_000) {
      return NextResponse.json(_cache.body, {
        headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
      })
    }

    const raw = await fs.readFile(path.join(process.cwd(), 'data', 'runestone_dossier.json'), 'utf-8')
    const d = JSON.parse(raw)

    const body = {
      as_of_block: d.tip_height,
      generated_at: d.generated_at,

      // the collection today
      supply: d.collection.supply,
      holders: d.custody.holders,
      median_stones: d.custody.median,
      largest_holder_stones: d.custody.max,
      gini: d.custody.gini,
      share_top10_pct: d.custody.share_top10,
      never_moved: d.dormancy.never_moved,
      never_moved_pct: d.dormancy.never_moved_pct,
      dormant_2y_plus: d.dormancy.age_buckets?.find((b: { label: string }) => b.label === '2y+')?.stones ?? null,
      burned_stones: d.provenance.burned_stones,

      // the April 2024 cohort, named for what it is
      airdrop_cohort: {
        snapshot_block: d.airdrop_cross.snapshot_block,
        addresses: d.airdrop_cross.cohort_addresses,
        payments_received: d.airdrop_cross.cohort_stones,
        still_holding_a_stone: d.airdrop_cross.still_here,
        left: d.airdrop_cross.left,
        arrived_after: d.airdrop_cross.entered,
        stones_in_veteran_hands: d.airdrop_cross.stones_veteran,
        note: 'payments_received is a proxy for stones held at the snapshot and runs slightly long against supply',
      },

      parent: {
        id: d.collection.parent_id,
        number: d.collection.parent_number,
        address: d.collection.parent_address,
        burned: true,
      },
      source: 'local ord enumeration plus bitcoind UTXO set',
    }

    _cache = { body, ts: now }
    return NextResponse.json(body, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    })
  } catch (e) {
    return NextResponse.json({ error: 'Runestone stats unavailable', detail: String(e) }, { status: 503 })
  }
}
