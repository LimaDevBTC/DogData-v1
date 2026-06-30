import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'data', 'forensic_behavioral_analysis.json')
    const raw = await fs.readFile(filePath, 'utf-8')
    const data = JSON.parse(raw)

    const profiles: any[] = data.all_profiles ?? []
    const stats = data.statistics ?? {}

    const totalHolders = profiles.length
    const totalStones = profiles.reduce((s: number, p: any) => s + (p.receive_count ?? 0), 0)
    const multiStoneHolders = profiles.filter((p: any) => (p.receive_count ?? 0) > 1).length
    const maxStones = Math.max(...profiles.map((p: any) => p.receive_count ?? 0))
    const stillHolding = stats.still_holding ?? 0
    const retentionRate = stats.retention_rate ?? 0

    return NextResponse.json({
      snapshot_block: 840000,
      snapshot_date: '2024-04-20',
      total_holders: totalHolders,
      total_stones: totalStones,
      multi_stone_holders: multiStoneHolders,
      single_stone_holders: totalHolders - multiStoneHolders,
      max_stones_one_wallet: maxStones,
      still_holding_dog: stillHolding,
      retention_rate: retentionRate,
      last_updated: data.timestamp ?? null,
      source: 'local_ord_index',
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    })
  } catch (e) {
    return NextResponse.json({ error: 'Runestone stats unavailable', detail: String(e) }, { status: 503 })
  }
}
