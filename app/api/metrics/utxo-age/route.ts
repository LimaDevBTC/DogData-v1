import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// Cache em memória
let cachedData: {
  data: any
  timestamp: number
} | null = null

const CACHE_DURATION = 0 // Sem cache - sempre ler dados frescos

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
    const utxoAgeStats = holdersData.utxo_age_stats

    if (!utxoAgeStats) {
      return NextResponse.json({ 
        error: 'UTXO age stats not available',
        message: 'Run the update script to collect UTXO age data'
      }, { status: 404 })
    }

    // Compatibilidade: suportar tanto 'total_utxos' quanto 'total_sample_utxos'
    const totalUtxos = utxoAgeStats.total_utxos || utxoAgeStats.total_sample_utxos || 0
    const totalSupply = utxoAgeStats.total_supply || utxoAgeStats.total_sample_supply || 0

    // Preparar dados para gráficos
    const result = {
      ...utxoAgeStats,
      total_utxos: totalUtxos,
      total_supply: totalSupply,
      hodl_waves: utxoAgeStats.age_distribution ? Object.entries(utxoAgeStats.age_distribution).map(([range, supply]: [string, any]) => ({
        range,
        supply,
        percentage: totalSupply > 0 
          ? (supply / totalSupply) * 100 
          : 0
      })) : [],
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
    console.error('Error fetching UTXO age metrics:', error)
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
      { error: 'Failed to fetch UTXO age metrics', details: error.message },
      { status: 500 }
    )
  }
}

