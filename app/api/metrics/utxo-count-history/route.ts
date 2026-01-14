import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') || '30d'
    
    // Ler histórico de UTXO count (se existir)
    const historyPath = path.join(process.cwd(), 'data', 'utxo_count_history.json')
    
    let history: { date: string; total_utxos: number }[] = []
    
    if (fs.existsSync(historyPath)) {
      const historyData = JSON.parse(fs.readFileSync(historyPath, 'utf-8'))
      history = historyData.history || []
    }
    
    // Se não há histórico, criar entrada inicial com dados atuais
    if (history.length === 0) {
      const holdersPath = path.join(process.cwd(), 'public', 'data', 'dog_holders.json')
      if (fs.existsSync(holdersPath)) {
        const holdersData = JSON.parse(fs.readFileSync(holdersPath, 'utf-8'))
        history = [{
          date: new Date().toISOString().split('T')[0],
          total_utxos: holdersData.total_utxos || 0
        }]
      }
    }
    
    // Filtrar por range
    const now = new Date()
    let filteredHistory = history
    
    if (range !== 'all') {
      const days = range === '24h' ? 1 : range === '7d' ? 7 : range === '30d' ? 30 : 90
      const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
      
      filteredHistory = history.filter(entry => {
        const entryDate = new Date(entry.date)
        return entryDate >= cutoffDate
      })
    }
    
    // Ordenar por data (mais antigo primeiro)
    filteredHistory.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    
    return NextResponse.json({
      history: filteredHistory,
      total_points: filteredHistory.length,
      range,
      last_updated: history.length > 0 ? history[history.length - 1].date : null
    })
  } catch (error: any) {
    console.error('Error fetching UTXO count history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch UTXO count history', details: error.message },
      { status: 500 }
    )
  }
}




