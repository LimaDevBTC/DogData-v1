import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Cache em memória (mesmo padrão de holder-concentration)
let cachedData: {
  data: any
  timestamp: number
  range: string
} | null = null

const CACHE_DURATION = 5 * 60 * 1000 // 5 minutos

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') || '30d'
    const metrics = searchParams.get('metrics') // comma-separated, optional

    // Verificar cache
    const now = Date.now()
    if (cachedData && cachedData.range === range && (now - cachedData.timestamp) < CACHE_DURATION) {
      return NextResponse.json(cachedData.data, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
          'X-Cache': 'hit'
        }
      })
    }

    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Supabase not configured', history: [], total_points: 0 },
        { status: 503 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Calcular data de corte
    let cutoffDate: Date | null = null
    if (range !== 'all') {
      const days = range === '24h' ? 1 : range === '7d' ? 7 : range === '30d' ? 30 : 90
      cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    }

    // Determinar colunas
    let selectColumns = '*'
    if (metrics) {
      const validColumns = [
        'total_utxos', 'total_holders', 'gini_coefficient',
        'top10_supply_pct', 'top100_supply_pct', 'top1000_supply_pct',
        'avg_age_days', 'median_age_days', 'sth_percentage', 'lth_percentage',
        'realized_cap', 'market_cap', 'mvrv_ratio',
        'supply_in_profit_pct', 'supply_in_loss_pct', 'current_price'
      ]
      const requested = metrics.split(',').map(m => m.trim()).filter(m => validColumns.includes(m))
      if (requested.length > 0) {
        selectColumns = ['recorded_at', ...requested].join(',')
      }
    }

    // Query
    let query = supabase
      .from('dog_metrics_history')
      .select(selectColumns)
      .order('recorded_at', { ascending: true })

    if (cutoffDate) {
      query = query.gte('recorded_at', cutoffDate.toISOString())
    }

    query = query.limit(2200) // max ~90 dias de dados horários

    const { data, error } = await query

    if (error) {
      console.error('❌ Supabase query error:', error)
      if (cachedData) {
        return NextResponse.json(cachedData.data, {
          headers: { 'X-Cache': 'stale' }
        })
      }
      return NextResponse.json(
        { error: 'Failed to fetch metrics history', history: [], total_points: 0 },
        { status: 500 }
      )
    }

    const result = {
      history: data || [],
      total_points: data?.length || 0,
      range,
      last_updated: data && data.length > 0 ? (data[data.length - 1] as any).recorded_at : null
    }

    // Atualizar cache
    cachedData = { data: result, timestamp: now, range }

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
      }
    })
  } catch (error: any) {
    console.error('❌ Error fetching metrics history:', error)
    if (cachedData) {
      return NextResponse.json(cachedData.data, {
        headers: { 'X-Cache': 'stale' }
      })
    }
    return NextResponse.json(
      { error: 'Failed to fetch metrics history', history: [], total_points: 0 },
      { status: 500 }
    )
  }
}
