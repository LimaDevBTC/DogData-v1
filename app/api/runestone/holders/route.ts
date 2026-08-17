import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Ranked by Runestones held TODAY (derived from a local ord enumeration plus a
// bitcoind UTXO pass), then enriched with what that address did in the DOG
// airdrop. The old version ranked by airdrop payments received, which answered
// a question about April 2024, not about who holds the collection now.
interface Row {
  rank: number
  address: string
  stones: number
  share: number
  veteran: boolean
  stones_at_airdrop: number | null
  airdrop_dog: number | null
  current_dog: number | null
  behavior: string | null
  diamond_score: number | null
}

let _cache: { rows: Row[]; total: number; stones: number; enriched: boolean; ts: number } | null = null

async function loadRows(): Promise<{ rows: Row[]; total: number; stones: number; enriched: boolean }> {
  const now = Date.now()
  if (_cache && now - _cache.ts < 5 * 60_000) return _cache

  // paths stay inline and fully literal: @vercel/nft reads them statically, and
  // this repo has already blown the 250MB function limit once by being vague
  const today = JSON.parse(
    await fs.readFile(path.join(process.cwd(), 'data', 'runestone_holders_today.json'), 'utf-8'),
  )
  const stones: Record<string, number> = today.stones ?? {}

  let profiles: Record<string, any> = {}
  try {
    const forensic = JSON.parse(
      await fs.readFile(path.join(process.cwd(), 'data', 'forensic_behavioral_analysis.json'), 'utf-8'),
    )
    for (const p of forensic.all_profiles ?? []) profiles[p.address] = p
  } catch {
    // the cross is an enrichment, not a dependency: without it the page still
    // shows who holds what today
    profiles = {}
  }

  const totalStones = Object.values(stones).reduce((s, n) => s + n, 0)
  const rows: Row[] = Object.entries(stones)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([address, n], i) => {
      const p = profiles[address]
      return {
        rank: i + 1,
        address,
        stones: n,
        share: Number(((n / totalStones) * 100).toFixed(4)),
        veteran: !!p,
        stones_at_airdrop: p?.receive_count ?? null,
        airdrop_dog: p?.airdrop_amount ?? null,
        current_dog: p?.current_balance ?? null,
        behavior: p?.behavior_pattern ?? null,
        diamond_score: p?.diamond_score ?? null,
      }
    })

  _cache = { rows, total: rows.length, stones: totalStones, enriched: Object.keys(profiles).length > 0, ts: now }
  return _cache
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '25')))
  const search = searchParams.get('address')?.trim().toLowerCase() ?? ''
  const minStones = parseInt(searchParams.get('min_stones') ?? '1')
  const cohort = searchParams.get('cohort') ?? ''

  try {
    const { rows, total: allRows, stones, enriched } = await loadRows()

    // os filtros compoem com a busca: antes a busca zerava os outros em
    // silencio enquanto a pilha do coorte continuava acesa na interface
    let filtered = rows
    if (search) filtered = filtered.filter(r => r.address.toLowerCase().includes(search))
    if (minStones > 1) filtered = filtered.filter(r => r.stones >= minStones)
    if (cohort === 'veteran') filtered = filtered.filter(r => r.veteran)
    if (cohort === 'new') filtered = filtered.filter(r => !r.veteran)

    const total = filtered.length
    const offset = (page - 1) * limit
    return NextResponse.json({
      holders: filtered.slice(offset, offset + limit),
      total,
      all_holders: allRows,
      all_stones: stones,
      // false means the airdrop cross failed to load, so every row reads as non veteran
      enriched,
      page,
      limit,
      pages: Math.ceil(total / limit),
    })
  } catch (e) {
    return NextResponse.json({ error: 'Holder data unavailable', detail: String(e) }, { status: 503 })
  }
}
