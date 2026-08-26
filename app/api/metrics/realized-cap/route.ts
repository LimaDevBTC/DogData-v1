import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getLatestMetricsSnapshot } from '@/lib/metrics-snapshot'

// ⚠️ NUNCA pre-renderizar no build: com revalidate=60 o Next executava esta
// rota DURANTE o next build lendo o banco; no incidente de IO de 26/08 isso
// BLOQUEOU todo deploy (3 tentativas de 60s e o build morria). O cache fica
// por conta dos headers de CDN que a resposta ja manda.
export const dynamic = 'force-dynamic'

export async function GET() {
  // 1) Source of truth: Supabase (atualiza :35 de cada hora, sem deploy lag)
  try {
    const snap = await getLatestMetricsSnapshot()
    if (snap) {
      return NextResponse.json({
        realized_cap: snap.realized_cap,
        market_cap: snap.market_cap,
        mvrv_ratio: snap.mvrv_ratio,
        current_price: snap.current_price,
        last_updated: snap.recorded_at,
        source: 'supabase',
      }, {
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' }
      })
    }
  } catch (e) {
    console.error('[realized-cap] Supabase fetch failed, falling back to file:', e)
  }

  // 2) Fallback: bundled file (deploy-stale).
  try {
    const dataPath = path.join(process.cwd(), 'public', 'data', 'dog_holders.json')
    if (!fs.existsSync(dataPath)) {
      return NextResponse.json({ error: 'Holders data not found' }, { status: 404 })
    }
    const holdersData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
    const utxoAgeStats = holdersData.utxo_age_stats
    if (!utxoAgeStats) {
      return NextResponse.json(
        { error: 'UTXO age stats not available. Please run update_holders_and_fees.py script.' },
        { status: 503 }
      )
    }

    const { realized_cap, market_cap, mvrv_ratio, current_price } = utxoAgeStats
    if (realized_cap === undefined || market_cap === undefined || mvrv_ratio === undefined) {
      return NextResponse.json(
        { error: 'Realized Cap metrics not calculated yet. Please run update_holders_and_fees.py script.' },
        { status: 503 }
      )
    }

    return NextResponse.json({
      realized_cap,
      market_cap,
      mvrv_ratio,
      current_price,
      last_updated: holdersData.timestamp || new Date().toISOString(),
      source: 'file',
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300', 'X-Source': 'file' }
    })
  } catch (error: any) {
    console.error('Error fetching Realized Cap metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Realized Cap metrics', details: error.message },
      { status: 500 }
    )
  }
}
