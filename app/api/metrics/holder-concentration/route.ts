import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getLatestMetricsSnapshot } from '@/lib/metrics-snapshot'

// Calcular coeficiente de Gini - versão otimizada O(n log n)
function calculateGini(holdings: number[]): number {
  if (holdings.length === 0) return 0

  const sorted = [...holdings].sort((a, b) => a - b)
  const n = sorted.length
  const sum = sorted.reduce((acc, val) => acc + val, 0)

  if (sum === 0) return 0

  let weightedSum = 0
  for (let i = 0; i < n; i++) {
    weightedSum += (i + 1) * sorted[i]
  }

  return (2 * weightedSum) / (n * sum) - (n + 1) / n
}

// Cache em memória — só usado no fallback de arquivo (Supabase tem cache próprio em lib/metrics-snapshot)
let cachedFileResult: { data: any; timestamp: number } | null = null
const CACHE_DURATION = 5 * 60 * 1000

// ⚠️ NUNCA pre-renderizar no build: com revalidate=60 o Next executava esta
// rota DURANTE o next build lendo o banco; no incidente de IO de 26/08 isso
// BLOQUEOU todo deploy (3 tentativas de 60s e o build morria). O cache fica
// por conta dos headers de CDN que a resposta ja manda.
export const dynamic = 'force-dynamic'

const TOTAL_SUPPLY = 100_000_000_000

export async function GET() {
  // 1) Source of truth: latest Supabase snapshot — atualiza no :35 de cada hora,
  //    sem depender de deploy. Mantém site/API em sincronia.
  try {
    const snap = await getLatestMetricsSnapshot()
    if (snap) {
      return NextResponse.json({
        gini_coefficient: snap.gini_coefficient,
        top10_supply_pct: snap.top10_supply_pct,
        top100_supply_pct: snap.top100_supply_pct,
        top1000_supply_pct: snap.top1000_supply_pct,
        total_holders: snap.total_holders,
        total_supply: TOTAL_SUPPLY,
        last_updated: snap.recorded_at,
        source: 'supabase',
      }, {
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' }
      })
    }
  } catch (e) {
    console.error('[holder-concentration] Supabase fetch failed, falling back to file:', e)
  }

  // 2) Fallback: file (bundled, deploy-stale).
  try {
    const now = Date.now()
    if (cachedFileResult && (now - cachedFileResult.timestamp) < CACHE_DURATION) {
      return NextResponse.json(cachedFileResult.data, {
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300', 'X-Source': 'file-cache' }
      })
    }

    const dataPath = path.join(process.cwd(), 'public', 'data', 'dog_holders.json')
    if (!fs.existsSync(dataPath)) {
      return NextResponse.json({ error: 'Holders data not found' }, { status: 404 })
    }
    const holdersData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
    const holders = holdersData.holders || []
    if (holders.length === 0) {
      return NextResponse.json({ error: 'No holders data' }, { status: 404 })
    }

    const holdings = holders.map((h: any) => h.total_dog || 0).filter((h: number) => h > 0)
    const giniCoefficient = calculateGini(holdings)
    const totalSupply = holdings.reduce((sum: number, h: number) => sum + h, 0)
    const sortedHoldings = [...holdings].sort((a, b) => b - a)
    const top10Supply = sortedHoldings.slice(0, 10).reduce((sum, h) => sum + h, 0)
    const top100Supply = sortedHoldings.slice(0, 100).reduce((sum, h) => sum + h, 0)
    const top1000Supply = sortedHoldings.slice(0, 1000).reduce((sum, h) => sum + h, 0)

    const result = {
      gini_coefficient: giniCoefficient,
      top10_supply_pct: totalSupply > 0 ? (top10Supply / totalSupply) * 100 : 0,
      top100_supply_pct: totalSupply > 0 ? (top100Supply / totalSupply) * 100 : 0,
      top1000_supply_pct: totalSupply > 0 ? (top1000Supply / totalSupply) * 100 : 0,
      total_holders: holders.length,
      total_supply: totalSupply,
      last_updated: holdersData.timestamp || new Date().toISOString(),
      source: 'file',
    }

    cachedFileResult = { data: result, timestamp: now }
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300', 'X-Source': 'file' }
    })
  } catch (error: any) {
    console.error('Error calculating holder concentration:', error)
    if (cachedFileResult) {
      return NextResponse.json(cachedFileResult.data, {
        headers: { 'X-Source': 'file-stale-cache' }
      })
    }
    return NextResponse.json(
      { error: 'Failed to calculate holder concentration', details: error.message },
      { status: 500 }
    )
  }
}
