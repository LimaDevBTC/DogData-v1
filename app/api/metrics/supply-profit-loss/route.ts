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
    const utxoAgeStats = holdersData.utxo_age_stats
    
    if (!utxoAgeStats) {
      return NextResponse.json(
        { error: 'UTXO age stats not available. Please run update_holders_and_fees.py script.' },
        { status: 503 }
      )
    }

    const supplyInProfit = utxoAgeStats.supply_in_profit
    const supplyInLoss = utxoAgeStats.supply_in_loss
    const supplyInProfitPct = utxoAgeStats.supply_in_profit_pct
    const supplyInLossPct = utxoAgeStats.supply_in_loss_pct
    const currentPrice = utxoAgeStats.current_price

    if (supplyInProfit === undefined || supplyInLoss === undefined) {
      return NextResponse.json(
        { error: 'Supply in Profit/Loss metrics not calculated yet. Please run update_holders_and_fees.py script.' },
        { status: 503 }
      )
    }

    const result = {
      supply_in_profit: supplyInProfit,
      supply_in_loss: supplyInLoss,
      supply_in_profit_pct: supplyInProfitPct,
      supply_in_loss_pct: supplyInLossPct,
      current_price: currentPrice,
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
    console.error('Error fetching Supply in Profit/Loss metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Supply in Profit/Loss metrics', details: error.message },
      { status: 500 }
    )
  }
}


