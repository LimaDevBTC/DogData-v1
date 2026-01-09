import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// Calcular coeficiente de Gini - versão otimizada O(n log n)
function calculateGini(holdings: number[]): number {
  if (holdings.length === 0) return 0
  
  // Ordenar holdings em ordem crescente
  const sorted = [...holdings].sort((a, b) => a - b)
  const n = sorted.length
  const sum = sorted.reduce((acc, val) => acc + val, 0)
  
  if (sum === 0) return 0
  
  // Fórmula otimizada: Gini = (2 * Σ(i * sorted[i])) / (n * Σ(sorted[i])) - (n + 1) / n
  let weightedSum = 0
  for (let i = 0; i < n; i++) {
    weightedSum += (i + 1) * sorted[i]
  }
  
  return (2 * weightedSum) / (n * sum) - (n + 1) / n
}

// Cache em memória
let cachedData: {
  data: any
  timestamp: number
} | null = null

const CACHE_DURATION = 5 * 60 * 1000 // 5 minutos

export const revalidate = 300 // Revalidar a cada 5 minutos

export async function GET() {
  try {
    // Verificar cache
    const now = Date.now()
    if (cachedData && (now - cachedData.timestamp) < CACHE_DURATION) {
      return NextResponse.json(cachedData.data, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
        }
      })
    }
    // Ler dados de holders do JSON
    const dataPath = path.join(process.cwd(), 'public', 'data', 'dog_holders.json')
    
    if (!fs.existsSync(dataPath)) {
      return NextResponse.json({ error: 'Holders data not found' }, { status: 404 })
    }

    const holdersData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
    const holders = holdersData.holders || []
    
    if (holders.length === 0) {
      return NextResponse.json({ error: 'No holders data' }, { status: 404 })
    }

    // Extrair saldos
    const holdings = holders.map((h: any) => h.total_dog || 0).filter((h: number) => h > 0)
    
    // Calcular Gini
    const giniCoefficient = calculateGini(holdings)
    
    // Calcular % do supply detido pelos top N
    const totalSupply = holdings.reduce((sum: number, h: number) => sum + h, 0)
    
    const sortedHoldings = [...holdings].sort((a, b) => b - a)
    
    const top10Supply = sortedHoldings.slice(0, 10).reduce((sum, h) => sum + h, 0)
    const top100Supply = sortedHoldings.slice(0, 100).reduce((sum, h) => sum + h, 0)
    const top1000Supply = sortedHoldings.slice(0, 1000).reduce((sum, h) => sum + h, 0)
    
    const top10SupplyPct = totalSupply > 0 ? (top10Supply / totalSupply) * 100 : 0
    const top100SupplyPct = totalSupply > 0 ? (top100Supply / totalSupply) * 100 : 0
    const top1000SupplyPct = totalSupply > 0 ? (top1000Supply / totalSupply) * 100 : 0

    const result = {
      gini_coefficient: giniCoefficient,
      top10_supply_pct: top10SupplyPct,
      top100_supply_pct: top100SupplyPct,
      top1000_supply_pct: top1000SupplyPct,
      total_holders: holders.length,
      total_supply: totalSupply,
      last_updated: holdersData.timestamp || new Date().toISOString()
    }

    // Atualizar cache
    cachedData = {
      data: result,
      timestamp: now
    }

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
      }
    })
  } catch (error: any) {
    console.error('Error calculating holder concentration:', error)
    // Retornar cache mesmo em erro se disponível
    if (cachedData) {
      return NextResponse.json(cachedData.data, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
          'X-Cache': 'stale'
        }
      })
    }
    return NextResponse.json(
      { error: 'Failed to calculate holder concentration', details: error.message },
      { status: 500 }
    )
  }
}

