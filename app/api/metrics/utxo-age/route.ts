import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getLiveSnapshot } from '@/lib/snapshot-redis'

// rota de API nao pertence ao build (licao do incidente de IO de 26/08:
// rotas com revalidate eram PRE-EXECUTADAS no next build lendo banco/rede e
// com o banco anemico o build inteiro morria, bloqueando qualquer deploy);
// o cache fica por conta dos headers de CDN da resposta
export const dynamic = 'force-dynamic'

function shapeResponse(utxoAgeStats: any, lastUpdated: string, source: 'redis' | 'file') {
  const totalUtxos = utxoAgeStats.total_utxos || utxoAgeStats.total_sample_utxos || 0
  const totalSupply = utxoAgeStats.total_supply || utxoAgeStats.total_sample_supply || 0

  const hodlWaves = utxoAgeStats.age_distribution
    ? Object.entries(utxoAgeStats.age_distribution).map(([range, supply]: [string, any]) => ({
        range,
        supply,
        percentage: totalSupply > 0 ? (supply / totalSupply) * 100 : 0,
      }))
    : []

  return {
    ...utxoAgeStats,
    total_utxos: totalUtxos,
    total_supply: totalSupply,
    hodl_waves: hodlWaves,
    last_updated: lastUpdated,
    source,
  }
}

export async function GET() {
  // 1) Source of truth: Upstash live snapshot
  try {
    const snap = await getLiveSnapshot()
    if (snap?.utxo_age_stats) {
      return NextResponse.json(
        shapeResponse(snap.utxo_age_stats, snap.timestamp, 'redis'),
        { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
      )
    }
  } catch (e) {
    console.error('[metrics/utxo-age] Redis fetch failed, falling back to file:', e)
  }

  // 2) Fallback: bundled file
  try {
    const dataPath = path.join(process.cwd(), 'public', 'data', 'dog_holders.json')
    if (!fs.existsSync(dataPath)) {
      return NextResponse.json({ error: 'Holders data not found' }, { status: 404 })
    }
    const holdersData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
    const utxoAgeStats = holdersData.utxo_age_stats
    if (!utxoAgeStats) {
      return NextResponse.json({
        error: 'UTXO age stats not available',
        message: 'Run the update script to collect UTXO age data',
      }, { status: 404 })
    }
    return NextResponse.json(
      shapeResponse(utxoAgeStats, holdersData.timestamp || new Date().toISOString(), 'file'),
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300', 'X-Source': 'file' } }
    )
  } catch (error: any) {
    console.error('Error fetching UTXO age metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch UTXO age metrics', details: error.message },
      { status: 500 }
    )
  }
}
