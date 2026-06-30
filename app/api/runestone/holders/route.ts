import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

let _cache: { profiles: any[]; ts: number } | null = null

async function loadProfiles() {
  const now = Date.now()
  if (_cache && now - _cache.ts < 5 * 60_000) return _cache.profiles
  const raw = await fs.readFile(path.join(process.cwd(), 'data', 'forensic_behavioral_analysis.json'), 'utf-8')
  const data = JSON.parse(raw)
  const sorted = (data.all_profiles ?? []).sort((a: any, b: any) => {
    const diff = (b.receive_count ?? 0) - (a.receive_count ?? 0)
    return diff !== 0 ? diff : (b.airdrop_amount ?? 0) - (a.airdrop_amount ?? 0)
  })
  _cache = { profiles: sorted, ts: now }
  return sorted
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '25')))
  const search = searchParams.get('address')?.trim().toLowerCase() ?? ''
  const minStones = parseInt(searchParams.get('min_stones') ?? '1')

  try {
    const all = await loadProfiles()

    let filtered = all
    if (search) {
      filtered = all.filter((p: any) => p.address?.toLowerCase().includes(search))
    } else if (minStones > 1) {
      filtered = all.filter((p: any) => (p.receive_count ?? 0) >= minStones)
    }

    const total = filtered.length
    const offset = (page - 1) * limit
    const slice = filtered.slice(offset, offset + limit)

    return NextResponse.json({
      holders: slice.map((p: any, i: number) => ({
        rank: offset + i + 1,
        address: p.address,
        stones: p.receive_count ?? 1,
        airdrop_dog: p.airdrop_amount ?? 0,
        current_dog: p.current_balance ?? 0,
        behavior: p.behavior_pattern ?? '',
        diamond_score: p.diamond_score ?? 0,
      })),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    })
  } catch (e) {
    return NextResponse.json({ error: 'Holder data unavailable', detail: String(e) }, { status: 503 })
  }
}
