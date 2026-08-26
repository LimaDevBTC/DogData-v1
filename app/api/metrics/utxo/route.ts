import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getLiveSnapshot } from '@/lib/snapshot-redis'

// rota de API nao pertence ao build (licao do incidente de IO de 26/08:
// rotas com revalidate eram PRE-EXECUTADAS no next build lendo banco/rede e
// com o banco anemico o build inteiro morria, bloqueando qualquer deploy);
// o cache fica por conta dos headers de CDN da resposta
export const dynamic = 'force-dynamic'

const TOTAL_SUPPLY = 100_000_000_000

interface DistEntry { range: string; count: number; supply: number; percentage: number }

function buildDistribution(sizeDist: Record<string, any>): DistEntry[] {
  return Object.entries(sizeDist)
    .map(([range, data]) => {
      if (!data || typeof data !== 'object' || typeof data.count !== 'number') return null
      return {
        range,
        count: data.count,
        supply: data.supply / 100000, // amount → DOG
        percentage: data.percentage,
      }
    })
    .filter((x): x is DistEntry => x !== null)
}

export async function GET() {
  // 1) Source of truth: Upstash live snapshot (atualiza :35 de cada hora, sem deploy)
  try {
    const snap = await getLiveSnapshot()
    const sizeDist = snap?.utxo_age_stats?.size_distribution
    if (snap && sizeDist) {
      const totalUtxos = snap.total_utxos
      const avgUtxoSize = totalUtxos > 0 ? TOTAL_SUPPLY / totalUtxos : 0
      return NextResponse.json({
        total_utxos: totalUtxos,
        avg_utxo_size: avgUtxoSize,
        utxo_distribution: buildDistribution(sizeDist),
        last_updated: snap.timestamp,
        source: 'redis',
      }, {
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' }
      })
    }
  } catch (e) {
    console.error('[metrics/utxo] Redis fetch failed, falling back to file:', e)
  }

  // 2) Fallback: bundled file
  try {
    const dataPath = path.join(process.cwd(), 'public', 'data', 'dog_holders.json')
    if (!fs.existsSync(dataPath)) {
      return NextResponse.json({ error: 'Holders data not found' }, { status: 404 })
    }
    const holdersData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
    const sizeDist = holdersData.utxo_age_stats?.size_distribution
    if (!sizeDist || typeof sizeDist !== 'object') {
      console.error('[UTXO API] size_distribution missing in file')
      return NextResponse.json(
        { error: 'UTXO size distribution data not available. Please run update_holders_and_fees.py.' },
        { status: 503 }
      )
    }
    const totalUtxos = holdersData.total_utxos || 0
    const avgUtxoSize = totalUtxos > 0 ? TOTAL_SUPPLY / totalUtxos : 0
    return NextResponse.json({
      total_utxos: totalUtxos,
      avg_utxo_size: avgUtxoSize,
      utxo_distribution: buildDistribution(sizeDist),
      last_updated: holdersData.timestamp || new Date().toISOString(),
      source: 'file',
    }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate', 'X-Source': 'file' }
    })
  } catch (error: any) {
    console.error('Error fetching UTXO metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch UTXO metrics', details: error.message },
      { status: 500 }
    )
  }
}
