import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getLatestMetricsSnapshot } from '@/lib/metrics-snapshot'

// rota de API nao pertence ao build (licao do incidente de IO de 26/08:
// rotas com revalidate eram PRE-EXECUTADAS no next build lendo banco/rede e
// com o banco anemico o build inteiro morria, bloqueando qualquer deploy);
// o cache fica por conta dos headers de CDN da resposta
export const dynamic = 'force-dynamic'

const TOTAL_SUPPLY = 100_000_000_000

export async function GET() {
  // 1) Source of truth: Supabase (atualiza :35 de cada hora, sem deploy lag)
  try {
    const snap = await getLatestMetricsSnapshot()
    if (snap) {
      // Supabase só guarda os percentuais; reconstroi os absolutos a partir do
      // total supply para preservar o contrato anterior do endpoint.
      const supplyInProfit = (snap.supply_in_profit_pct / 100) * TOTAL_SUPPLY
      const supplyInLoss = (snap.supply_in_loss_pct / 100) * TOTAL_SUPPLY

      return NextResponse.json({
        supply_in_profit: supplyInProfit,
        supply_in_loss: supplyInLoss,
        supply_in_profit_pct: snap.supply_in_profit_pct,
        supply_in_loss_pct: snap.supply_in_loss_pct,
        current_price: snap.current_price,
        last_updated: snap.recorded_at,
        source: 'supabase',
      }, {
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' }
      })
    }
  } catch (e) {
    console.error('[supply-profit-loss] Supabase fetch failed, falling back to file:', e)
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

    const { supply_in_profit, supply_in_loss, supply_in_profit_pct, supply_in_loss_pct, current_price } = utxoAgeStats
    if (supply_in_profit === undefined || supply_in_loss === undefined) {
      return NextResponse.json(
        { error: 'Supply in Profit/Loss metrics not calculated yet. Please run update_holders_and_fees.py script.' },
        { status: 503 }
      )
    }

    return NextResponse.json({
      supply_in_profit,
      supply_in_loss,
      supply_in_profit_pct,
      supply_in_loss_pct,
      current_price,
      last_updated: holdersData.timestamp || new Date().toISOString(),
      source: 'file',
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300', 'X-Source': 'file' }
    })
  } catch (error: any) {
    console.error('Error fetching Supply in Profit/Loss metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Supply in Profit/Loss metrics', details: error.message },
      { status: 500 }
    )
  }
}
