import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const revalidate = 0 // Sempre revalidar (sem cache)

export async function GET() {
  try {
    
    // Ler dados de holders do JSON
    const dataPath = path.join(process.cwd(), 'public', 'data', 'dog_holders.json')
    
    if (!fs.existsSync(dataPath)) {
      return NextResponse.json({ error: 'Holders data not found' }, { status: 404 })
    }

    const holdersData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
    
    const totalUtxos = holdersData.total_utxos || 0
    const totalSupply = 100_000_000_000 // 100 bilhões
    const avgUtxoSize = totalUtxos > 0 ? totalSupply / totalUtxos : 0

    // SEMPRE usar distribuição calculada por UTXO individual (método correto)
    // O método fallback (agrupar por holder) estava causando contagem incorreta
    let distribution = []
    
    const sizeDist = holdersData.utxo_age_stats?.size_distribution
    if (!sizeDist || typeof sizeDist !== 'object') {
      console.error('[UTXO API] ❌ size_distribution não encontrado ou inválido!')
      return NextResponse.json(
        { error: 'UTXO size distribution data not available. Please run update_holders_and_fees.py script.' },
        { status: 503 }
      )
    }
    
    // Usar distribuição exata calculada por UTXO individual
    console.log('[UTXO API] ✅ Usando método CORRETO: size_distribution por UTXO individual')
    distribution = Object.entries(sizeDist).map(([range, data]: [string, any]) => {
      if (!data || typeof data !== 'object' || typeof data.count !== 'number') {
        console.error(`[UTXO API] ⚠️ Dados inválidos para range ${range}:`, data)
        return null
      }
      return {
        range,
        count: data.count,
        supply: data.supply / 100000, // Converter de amount para DOG
        percentage: data.percentage
      }
    }).filter((item): item is NonNullable<typeof item> => item !== null)

    const result = {
      total_utxos: totalUtxos,
      avg_utxo_size: avgUtxoSize,
      utxo_distribution: distribution,
      last_updated: holdersData.timestamp || new Date().toISOString()
    }

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error: any) {
    console.error('Error fetching UTXO metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch UTXO metrics', details: error.message },
      { status: 500 }
    )
  }
}

