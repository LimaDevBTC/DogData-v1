import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Regra da casa: rota de API nunca usa `export const revalidate` (pre-executa no
// build e ja causou incidente). Cache fica na CDN via Cache-Control da resposta.
export const dynamic = 'force-dynamic'
// Orcamento de paginacao (8s) + tip + count precisam caber na funcao.
export const maxDuration = 15

// CDN segura a manada: instancia Supabase e Micro, entao a borda serve por 5 min
// e revalida em background por ate 10 min.
const CDN_CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
}

// ─── In-memory cache ──────────────────────────────────────────────
let cachedData: {
  data: any
  timestamp: number
  key: string
} | null = null

// Alinhado com o s-maxage da CDN.
const CACHE_DURATION = 5 * 60 * 1000

// ─── Fixed grid: 7 rows × 52 cols for ALL timeframes ──────────────
const GRID_ROWS = 7
const GRID_COLS = 52
const TOTAL_CELLS = GRID_ROWS * GRID_COLS // 364

const BLOCKS_PER_CELL: Record<string, number> = {
  '1d':  1,     // 364 blocks  ≈ 2.5 days
  '7d':  3,     // 1,092 blocks ≈ 7.6 days
  '30d': 12,    // 4,368 blocks ≈ 30 days
  '1y':  144,   // 52,416 blocks ≈ 1 year
}

// ─── Caminho de agregacao por timeframe (medido em 2026-08-26) ────
// - 1d: nao passa por esta rota; o componente le o Redis KV e bucketiza no cliente.
// - 7d (~3.5k txs) e 30d (~8k txs): leitura paginada por keyset cabe folgada no teto
//   de paginas, agregacao completa por tx. So o 7d carrega a coluna `senders` (jsonb,
//   ~171 bytes/linha) para contar remetentes unicos por bucket; em 30d/1y o peso
//   multiplicado nao compensa numa instancia Micro.
// - 1y (~127k txs): NAO cabe no teto. Paginamos DESCENDO a partir do tip e paramos no
//   orcamento; meta.truncated=true e meta.coveredFromBlock dizem exatamente o que foi
//   coberto (o lado que fica de fora e o VELHO, nunca a borda recente do grid). O
//   totalTx real vem de UM count head barato via indice. Agregacao completa de 1y
//   exigiria GROUP BY no servidor: a rota ja prefere a RPC heatmap_block_buckets
//   quando ela existir no banco (hoje nao existe, dai o fallback paginado).

// Orcamento duro da leitura paginada (regra da casa: toda varredura tem teto).
// PostgREST tampa cada pagina em 1000 linhas independente do limit pedido, entao o
// loop avanca pelo tamanho DEVOLVIDO, nunca pelo passo pedido.
const PAGE_LIMIT = 1000
const MAX_PAGES = 40
const TIME_BUDGET_MS = 8000

// ─── Supabase client ──────────────────────────────────────────────
function getSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase not configured')
  return createClient(url, key)
}

// ─── Bucket label (block-based) ──────────────────────────────────
function getBucketLabel(startBlock: number, endBlock: number): string {
  if (endBlock - startBlock === 1) {
    return `Block #${startBlock.toLocaleString()}`
  }
  return `Blocks #${startBlock.toLocaleString()} → #${(endBlock - 1).toLocaleString()}`
}

// ─── Row/Col from bucket index (column-first fill) ───────────────
function getBucketRowCol(bucketIdx: number): { row: number; col: number } {
  return { row: bucketIdx % GRID_ROWS, col: Math.floor(bucketIdx / GRID_ROWS) }
}

// ─── Aggregation bucket (server side) ────────────────────────────
interface BucketAgg {
  tx_count: number
  volume: number
  fee_sum: number
  avg_fee: number
  whale_volume: number
  has_whale: boolean
  net_flow: number
  retail_volume: number
  medium_volume: number
  large_volume: number
  peak_tx: number
  sender_set: Set<string> | null
  unique_senders: number | null
}

function newBucketAgg(withSenders: boolean): BucketAgg {
  return {
    tx_count: 0, volume: 0, fee_sum: 0, avg_fee: 0,
    whale_volume: 0, has_whale: false, net_flow: 0,
    retail_volume: 0, medium_volume: 0, large_volume: 0,
    peak_tx: 0,
    sender_set: withSenders ? new Set<string>() : null,
    unique_senders: null,
  }
}

// `senders` chega como jsonb guardando uma STRING de JSON (formato historico do
// scanner); tolera tambem array nativo caso linhas novas mudem o formato.
function parseSenders(raw: unknown): Array<{ address?: string }> {
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

interface PaginatedResult {
  bucketMap: Map<number, BucketAgg>
  aggregatedTx: number
  truncated: boolean
  coveredFromBlock: number
  pages: number
}

// Fallback paginado: keyset (block_height, txid) DESCENDO a partir do tip. Se o
// orcamento estourar, o que fica de fora e o lado VELHO da janela; a borda recente
// do grid nunca fica furada (com a tampa antiga de 1000 linhas ascendentes era
// exatamente a semana recente que sumia).
async function paginatedAggregate(
  supabase: ReturnType<typeof getSupabase>,
  startBlock: number,
  endBlock: number,
  bpc: number,
  includeSenders: boolean,
): Promise<PaginatedResult> {
  // So as colunas que o bucket consome; txid entra apenas como desempate do keyset.
  // `timestamp` nao entra: o bucket e por faixa de bloco, nao por relogio.
  const columns = includeSenders
    ? 'txid, block_height, total_dog_moved, net_transfer, fee_sats, senders'
    : 'txid, block_height, total_dog_moved, net_transfer, fee_sats'

  const bucketMap = new Map<number, BucketAgg>()
  let cursor: { h: number; txid: string } | null = null
  let pages = 0
  let maxPageSeen = 0
  let truncated = false
  let aggregatedTx = 0
  let coveredFromBlock = endBlock
  const t0 = Date.now()

  while (true) {
    if (pages >= MAX_PAGES || Date.now() - t0 > TIME_BUDGET_MS) {
      // Estourou o teto: devolve o que agregou e marca truncado (honestidade
      // custa menos que completude nesta instancia).
      truncated = true
      break
    }

    let query = supabase
      .from('dog_transactions')
      .select(columns)
      .gte('block_height', startBlock)
      .lt('block_height', endBlock)
      .order('block_height', { ascending: false })
      .order('txid', { ascending: false })
      .limit(PAGE_LIMIT)

    if (cursor) {
      // Keyset: estritamente depois do ultimo par (block_height, txid) devolvido.
      query = query.or(
        `block_height.lt.${cursor.h},and(block_height.eq.${cursor.h},txid.lt.${cursor.txid})`
      )
    }

    // prazo por pagina alem do orcamento global: uma pagina pendurada no
    // Micro nao pode comer o maxDuration inteiro da funcao
    const restante = Math.max(1000, TIME_BUDGET_MS - (Date.now() - t0))
    const { data: rows, error } = await query.abortSignal(
      AbortSignal.timeout(Math.min(6000, restante)),
    )
    if (error) {
      // erro transitorio de UMA pagina nao joga fora o que ja foi agregado:
      // degrada pra truncado com selo em vez de 500 no heatmap inteiro
      console.warn('heatmap: pagina falhou, devolvendo agregado parcial:', error.message ?? error)
      truncated = true
      break
    }
    pages++

    if (!rows || rows.length === 0) break // fim exato da janela

    for (const row of rows as any[]) {
      const idx = Math.min(
        TOTAL_CELLS - 1,
        Math.floor((row.block_height - startBlock) / bpc)
      )

      let b = bucketMap.get(idx)
      if (!b) {
        b = newBucketAgg(includeSenders)
        bucketMap.set(idx, b)
      }

      const vol = Number(row.total_dog_moved) || 0
      const fee = row.fee_sats || 0

      b.tx_count++
      b.volume += vol
      b.fee_sum += fee
      b.avg_fee = b.fee_sum / b.tx_count
      b.net_flow += Number(row.net_transfer) || 0
      if (vol > b.peak_tx) b.peak_tx = vol

      if (vol >= 1_000_000) { b.whale_volume += vol; b.has_whale = true }
      else if (vol >= 100_000) b.large_volume += vol
      else if (vol >= 10_000) b.medium_volume += vol
      else b.retail_volume += vol

      if (b.sender_set) {
        for (const s of parseSenders(row.senders)) {
          if (s && typeof s.address === 'string') b.sender_set.add(s.address)
        }
      }

      aggregatedTx++
      if (row.block_height < coveredFromBlock) coveredFromBlock = row.block_height
    }

    const last: any = rows[rows.length - 1]
    cursor = { h: last.block_height, txid: last.txid }

    // Pagina parcial depois de paginas mais cheias = fim dos dados. Comparar com o
    // maior tamanho DEVOLVIDO (nao com o limit pedido) respeita a tampa do PostgREST.
    if (rows.length < maxPageSeen) break
    maxPageSeen = Math.max(maxPageSeen, rows.length)
  }

  // Fecha a contagem de remetentes unicos e libera os Sets do payload.
  bucketMap.forEach((b) => {
    if (b.sender_set) {
      b.unique_senders = b.sender_set.size
      b.sender_set = null
    }
  })

  if (!truncated) {
    coveredFromBlock = startBlock
  } else if (cursor) {
    // o corte por orcamento quase sempre para no MEIO de um bloco (paginas
    // quebram por linha); o bloco do cursor esta parcial, entao a promessa
    // de cobertura completa so vale do bloco seguinte em diante
    coveredFromBlock = cursor.h + 1
  }

  return { bucketMap, aggregatedTx, truncated, coveredFromBlock, pages }
}

// ─── Main handler ─────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const timeframe = searchParams.get('timeframe') || '7d'
  const drillIdx = searchParams.get('drill')

  const bpc = BLOCKS_PER_CELL[timeframe]
  if (!bpc) {
    return NextResponse.json({ error: 'Invalid timeframe' }, { status: 400 })
  }

  const cacheKey = `block:${timeframe}:${drillIdx || ''}`

  // Check cache
  if (cachedData && cachedData.key === cacheKey && Date.now() - cachedData.timestamp < CACHE_DURATION) {
    return NextResponse.json(cachedData.data, { headers: CDN_CACHE_HEADERS })
  }

  try {
    const supabase = getSupabase()

    // Get tip block height
    const { data: tipRow, error: tipError } = await supabase
      .from('dog_transactions')
      .select('block_height')
      .order('block_height', { ascending: false })
      .limit(1)
      .single()

    if (tipError || !tipRow) {
      return NextResponse.json({
        buckets: [],
        meta: {
          timeframe,
          gridConfig: { rows: GRID_ROWS, cols: GRID_COLS, blocksPerBucket: bpc },
          startBlock: 0,
          endBlock: 0,
          totalTx: 0,
          totalTxSource: 'exact',
          aggregatedTx: 0,
          truncated: false,
          coveredFromBlock: 0,
          coveredBlocks: 0,
          totalVolume: 0,
          peakBucket: { index: 0, value: 0, label: '' },
          whaleCount: 0,
          activeSlots: 0,
        }
      })
    }

    const tipBlock = (tipRow as any).block_height as number
    const totalBlocks = TOTAL_CELLS * bpc
    const startBlock = tipBlock - totalBlocks + 1
    const endBlock = tipBlock + 1

    // ─── Drill-down: return transactions for a specific bucket ────
    // O drill continua limitado a 50 linhas de proposito: e uma LISTA (top txs por
    // volume), nao um agregado; a intensidade dos buckets nao depende dele.
    if (drillIdx !== null && drillIdx !== undefined) {
      const idx = parseInt(drillIdx)
      if (isNaN(idx) || idx < 0 || idx >= TOTAL_CELLS) {
        return NextResponse.json({ error: 'Invalid drill index' }, { status: 400 })
      }

      const bucketStartBlock = startBlock + idx * bpc
      const bucketEndBlock = bucketStartBlock + bpc

      const { data: txs, error } = await supabase
        .from('dog_transactions')
        .select('*')
        .gte('block_height', bucketStartBlock)
        .lt('block_height', bucketEndBlock)
        .order('total_dog_moved', { ascending: false })
        .limit(50)

      if (error) throw error

      return NextResponse.json({
        bucketIndex: idx,
        label: getBucketLabel(bucketStartBlock, bucketEndBlock),
        startBlock: bucketStartBlock,
        endBlock: bucketEndBlock,
        transactions: txs || []
      }, { headers: CDN_CACHE_HEADERS })
    }

    // ─── Aggregated bucket query ─────────────────────────────────
    // 1a escolha: RPC com GROUP BY no servidor (barata e completa). Se nao existir
    // no banco, cai no fallback paginado com teto duro (nunca mais a tampa muda de
    // 1000 linhas que fazia meta.totalTx mentir por baixo).
    let bucketMap: Map<number, any> = new Map()
    let truncated = false
    let coveredFromBlock = startBlock
    let realTotalTx: number | null = null
    // 'exact': soma completa ou count exato; 'estimate': planner; 'partial': so o
    // que os buckets truncados somaram (piso, nunca teto).
    let totalTxSource: 'exact' | 'estimate' | 'partial' = 'exact'

    const { data: rawRows, error } = await supabase.rpc('heatmap_block_buckets', {
      p_start_block: startBlock,
      p_end_block: endBlock,
      p_blocks_per_bucket: bpc,
    })

    if (error) {
      console.warn('RPC heatmap_block_buckets not found, using paginated fallback')
      const agg = await paginatedAggregate(
        supabase,
        startBlock,
        endBlock,
        bpc,
        timeframe === '7d', // senders so no 7d, ver nota de caminhos acima
      )
      bucketMap = agg.bucketMap
      truncated = agg.truncated
      coveredFromBlock = agg.coveredFromBlock

      if (truncated) {
        // Total REAL da janela mesmo com buckets parciais: count exato com prazo
        // curto (abort em 3s; medido em 26/08 o exato estourava o statement timeout
        // no 1y). Se nao der, estimativa do planner (count planned, so um EXPLAIN),
        // marcada como aproximada. Se nada der, fica o parcial com o selo.
        totalTxSource = 'partial'
        // ⚠️ o count EXATO morre por statement timeout em janela grande
        // (medido 26/08: 1y = 52k blocos leva ~8s no Postgres e o abort de
        // 3s so desiste do lado do cliente, o banco paga a conta inteira).
        // Janela acima de ~15k blocos vai DIRETO pra estimativa do planner:
        // mais barato > mais completo.
        const janelaCabeExato = endBlock - startBlock <= 15_000
        if (janelaCabeExato) {
          try {
            const { count, error: countError } = await supabase
              .from('dog_transactions')
              .select('id', { count: 'exact', head: true })
              .gte('block_height', startBlock)
              .lt('block_height', endBlock)
              .abortSignal(AbortSignal.timeout(3000))
            if (!countError && typeof count === 'number') {
              realTotalTx = count
              totalTxSource = 'exact'
            }
          } catch { /* cai na estimativa abaixo */ }
        }

        if (realTotalTx === null) {
          try {
            const { count, error: countError } = await supabase
              .from('dog_transactions')
              .select('id', { count: 'planned', head: true })
              .gte('block_height', startBlock)
              .lt('block_height', endBlock)
              .abortSignal(AbortSignal.timeout(2000))
            if (!countError && typeof count === 'number' && count > 0) {
              realTotalTx = count
              totalTxSource = 'estimate'
            }
          } catch { /* mantem o agregado parcial */ }
        }
      }
    } else {
      for (const row of (rawRows as any[]) || []) {
        bucketMap.set(Number(row.bucket_idx), row)
      }
    }

    // ─── Build response buckets ──────────────────────────────────
    const buckets = []
    let aggregatedTx = 0
    let totalVolume = 0
    let peakValue = 0
    let peakIdx = 0
    let whaleCount = 0

    for (let i = 0; i < TOTAL_CELLS; i++) {
      const raw = bucketMap.get(i)
      const { row, col } = getBucketRowCol(i)
      const bucketStartBlock = startBlock + i * bpc
      const bucketEndBlock = bucketStartBlock + bpc

      const txCount = raw?.tx_count || 0
      const volume = Number(raw?.volume || 0)
      const avgFee = raw?.avg_fee ? Number(raw.avg_fee) : null
      const whaleVolume = Number(raw?.whale_volume || 0)
      const hasWhale = raw?.has_whale || false
      const netFlow = Number(raw?.net_flow || 0)
      const retailVolume = Number(raw?.retail_volume || 0)
      const mediumVolume = Number(raw?.medium_volume || 0)
      const largeVolume = Number(raw?.large_volume || 0)
      const peakTx = Number(raw?.peak_tx || 0)
      const uniqueSenders = raw?.unique_senders ?? null

      aggregatedTx += txCount
      totalVolume += volume
      if (hasWhale) whaleCount++
      if (volume > peakValue) { peakValue = volume; peakIdx = i }

      buckets.push({
        index: i,
        row,
        col,
        value: Math.round(volume * 100) / 100,
        txCount,
        volume: Math.round(volume * 100) / 100,
        avgFee: avgFee !== null ? Math.round(avgFee) : null,
        whaleVolume: Math.round(whaleVolume * 100) / 100,
        hasWhale,
        retailVolume: Math.round(retailVolume * 100) / 100,
        mediumVolume: Math.round(mediumVolume * 100) / 100,
        largeVolume: Math.round(largeVolume * 100) / 100,
        netFlow: Math.round(netFlow * 100) / 100,
        peakTx: peakTx > 0 ? Math.round(peakTx * 100) / 100 : null,
        uniqueSenders,
        label: getBucketLabel(bucketStartBlock, bucketEndBlock),
        startBlock: bucketStartBlock,
        endBlock: bucketEndBlock,
      })
    }

    const peakBucket = buckets[peakIdx]
    const response = {
      buckets,
      meta: {
        timeframe,
        gridConfig: {
          rows: GRID_ROWS,
          cols: GRID_COLS,
          blocksPerBucket: bpc,
        },
        startBlock,
        endBlock,
        // totalTx REAL da janela: soma completa quando a agregacao cobriu tudo,
        // count dedicado quando o teto truncou os buckets.
        totalTx: realTotalTx ?? aggregatedTx,
        totalTxSource,
        aggregatedTx,
        truncated,
        coveredFromBlock,
        coveredBlocks: endBlock - coveredFromBlock,
        totalVolume: Math.round(totalVolume * 100) / 100,
        peakBucket: {
          index: peakIdx,
          value: Math.round(peakValue * 100) / 100,
          label: peakBucket?.label || '',
        },
        whaleCount,
        activeSlots: buckets.filter(b => b.txCount > 0).length,
      },
    }

    cachedData = { data: response, timestamp: Date.now(), key: cacheKey }

    return NextResponse.json(response, { headers: CDN_CACHE_HEADERS })

  } catch (error: any) {
    console.error('Heatmap API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch heatmap data', details: error.message },
      { status: 500 }
    )
  }
}
