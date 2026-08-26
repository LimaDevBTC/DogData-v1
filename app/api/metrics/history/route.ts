import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Cache em memória (mesmo padrão de holder-concentration)
let cachedData: {
  data: any
  timestamp: number
  range: string
} | null = null

const CACHE_DURATION = 5 * 60 * 1000 // 5 minutos

// Métricas que usam MAX (contadores), o resto usa AVG
const MAX_METRICS = new Set(['total_holders', 'total_utxos'])

// Intervalo de bucket em ms por range
function getBucketMs(range: string): number {
  switch (range) {
    case '24h': return 1 * 3600 * 1000       // 1 hora
    case '7d':  return 4 * 3600 * 1000       // 4 horas
    case '30d': return 24 * 3600 * 1000      // 1 dia
    case '90d': return 3 * 24 * 3600 * 1000  // 3 dias
    case 'all': return 24 * 3600 * 1000      // 1 dia (máx resolução útil)
    default:    return 24 * 3600 * 1000
  }
}

// Agrupa dados brutos em buckets temporais com AVG/MAX por tipo de métrica
function downsample(rows: any[], range: string): any[] {
  if (rows.length === 0) return []

  const bucketMs = getBucketMs(range)
  const buckets = new Map<number, any[]>()

  for (const row of rows) {
    const ts = new Date(row.recorded_at).getTime()
    const bucketKey = Math.floor(ts / bucketMs) * bucketMs
    if (!buckets.has(bucketKey)) buckets.set(bucketKey, [])
    buckets.get(bucketKey)!.push(row)
  }

  // Identificar colunas numéricas (excluir recorded_at e id)
  const sampleRow = rows[0]
  const numericKeys = Object.keys(sampleRow).filter(
    k => k !== 'recorded_at' && k !== 'id' && typeof sampleRow[k] === 'number'
  )

  const result: any[] = []
  const sortedKeys = Array.from(buckets.keys()).sort((a, b) => a - b)

  for (const bucketKey of sortedKeys) {
    const group = buckets.get(bucketKey)!
    const aggregated: any = {
      recorded_at: new Date(bucketKey).toISOString(),
    }

    for (const col of numericKeys) {
      const values = group.map(r => r[col]).filter((v: any) => v != null && v !== 0)
      if (values.length === 0) {
        aggregated[col] = 0
        continue
      }

      if (MAX_METRICS.has(col)) {
        aggregated[col] = Math.max(...values)
      } else {
        aggregated[col] = values.reduce((sum: number, v: number) => sum + v, 0) / values.length
      }
    }

    result.push(aggregated)
  }

  return result
}

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
    // Service role first: this route only reads, but migration 004 turns RLS on
    // and leaves the anon role with no policy at all. See lib/supabase.ts.
    const supabaseAnonKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

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

    // Query — buscar dados brutos
    // Ordenar DESC: o PostgREST tem um cap implícito de ~1000 linhas; com ASC,
    // 90d/all retornavam apenas as 1000 linhas mais antigas, fazendo o gráfico
    // "parar" semanas atrás. Com DESC pegamos as últimas 1000 (presente) e
    // revertemos antes do downsample, que assume ordenação ascendente.
    let query = supabase
      .from('dog_metrics_history')
      .select(selectColumns)
      .order('recorded_at', { ascending: false })

    if (cutoffDate) {
      query = query.gte('recorded_at', cutoffDate.toISOString())
    }

    query = query.limit(range === 'all' ? 9000 : 2200)

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

    // Reverter para ordem ascendente — downsample agrupa por bucket e ordena
    // depois, mas usamos os dados brutos para extrair last_updated.
    const ascending = (data || []).slice().reverse()

    // Downsample: agrupar em buckets temporais
    const downsampled = downsample(ascending, range)

    const result = {
      history: downsampled,
      total_points: downsampled.length,
      raw_points: ascending.length,
      range,
      last_updated: ascending.length > 0 ? (ascending[ascending.length - 1] as any).recorded_at : null
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
