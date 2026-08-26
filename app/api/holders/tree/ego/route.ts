import { NextRequest, NextResponse } from 'next/server'
import { resolveIdentities } from '@/lib/dog/identity'
import {
  TREE_CACHE_HEADERS,
  comPrazo,
  errorJson,
  isValidAddress,
  supabase,
} from '../_shared'
import { retryOnce, toFlowLabel, type FlowLabel } from '../flow/_agg'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Clamps do contrato do ego: o front pede 24 no desktop e 12 no mobile, mas a
// URL e publica, entao qualquer valor fora de 8..48 volta para dentro da banda.
const LIMIT_DEFAULT = 24
const LIMIT_MIN = 8
const LIMIT_MAX = 48

// ⚠️ UMA PAGINA POR LADO, DE PROPOSITO. O PostgREST tampa cada resposta em
// 1000 linhas e nao expoe agregacao nativa (PGRST123, medido em 2026-08-26),
// entao o "resto alem do limit" e calculado em memoria SOBRE ESTA PAGINA:
// top-limit vira as arestas, o excedente da pagina vira restIn/restOut. Se a
// pagina veio cheia (1000 exatos), havia mais pares alem dela e o resto sai
// com truncated: true em vez de fingir que a soma esta completa.
const PAGE_CAP = 1000

type Dir = 'all' | 'in' | 'out'

interface FlowRow {
  src: string
  dst: string
  total_dog: number | string | null
  tx_count: number | null
  first_block: number | null
  last_block: number | null
}

const FLOW_SELECT = 'src, dst, total_dog, tx_count, first_block, last_block'

interface GenRow {
  wallet: string
  depth: number | null
  balance_dog: number | string | null
  is_holder: boolean | null
}

interface EgoEdge {
  w: string
  label: FlowLabel | null
  b: number
  h: boolean
  dog: number
  txs: number
  fb: number
  lb: number
}

interface EgoRest {
  n: number
  dog: number
  truncated?: true
}

// Um lado ja mastigado: pagina inteira separada em topo (vira aresta) e
// resto (vira o agregado), mais as somas da pagina para o centro.
interface Side {
  rows: FlowRow[]
  top: FlowRow[]
  rest: EgoRest | null
  sumDog: number
  pairs: number
}

// GET /api/holders/tree/ego?w=<addr>&limit=24&min=0&dir=all
// O ego-grafo de uma carteira: centro + maiores contrapartes de entrada e
// saida por total_dog, com o excedente agregado em restIn/restOut.
export async function GET(req: NextRequest) {
  return comPrazo(() => handler(req))
}

async function handler(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const w = searchParams.get('w') ?? ''
  if (!isValidAddress(w)) {
    return errorJson('invalid w')
  }

  const limitRaw = Number(searchParams.get('limit') ?? LIMIT_DEFAULT)
  const limit = Number.isFinite(limitRaw)
    ? Math.min(LIMIT_MAX, Math.max(LIMIT_MIN, Math.floor(limitRaw)))
    : LIMIT_DEFAULT

  // min invalido ou negativo volta ao default em vez de derrubar a rota,
  // mesma postura da rota do sankey.
  const minRaw = Number(searchParams.get('min') ?? 0)
  const min = Number.isFinite(minRaw) && minRaw > 0 ? minRaw : 0

  const dirRaw = searchParams.get('dir') ?? 'all'
  const dir: Dir = dirRaw === 'in' || dirRaw === 'out' ? dirRaw : 'all'

  try {
    // dir filtra que lado vai ao banco: pedir so entradas nao paga a
    // consulta das saidas. O lado nao pedido sai vazio e com somas zeradas.
    const emptySide: Side = { rows: [], top: [], rest: null, sumDog: 0, pairs: 0 }
    const [inSide, outSide] = await Promise.all([
      dir === 'out' ? Promise.resolve(emptySide) : fetchSide('dst', w, min, limit),
      dir === 'in' ? Promise.resolve(emptySide) : fetchSide('src', w, min, limit),
    ])

    // Metadados do centro e das contrapartes do topo num lote so: uma ida a
    // dog_genealogy (no maximo 2*48+1 enderecos) e uma resolucao de rotulos.
    const counterOf = (r: FlowRow) => (r.dst === w ? r.src : r.dst)
    const wallets = Array.from(
      new Set([w, ...inSide.top.map(counterOf), ...outSide.top.map(counterOf)]),
    )
    const [gen, ids] = await Promise.all([fetchGenealogy(wallets), resolveIdentities(wallets)])

    const toEdge = (r: FlowRow): EgoEdge => {
      const cw = counterOf(r)
      const g = gen.get(cw)
      return {
        w: cw,
        label: toFlowLabel(ids.get(cw)),
        b: Math.round(Number(g?.balance_dog ?? 0)),
        h: !!g?.is_holder,
        dog: Math.round(Number(r.total_dog ?? 0)),
        txs: r.tx_count ?? 0,
        fb: r.first_block ?? 0,
        lb: r.last_block ?? 0,
      }
    }

    const centerGen = gen.get(w)
    return NextResponse.json(
      {
        center: {
          w,
          label: toFlowLabel(ids.get(w)),
          b: Math.round(Number(centerGen?.balance_dog ?? 0)),
          h: !!centerGen?.is_holder,
          // null quando a carteira nao esta na genealogia (fluxo existe fora dela)
          depth: centerGen?.depth ?? null,
          in_dog: Math.round(inSide.sumDog),
          out_dog: Math.round(outSide.sumDog),
          in_pairs: inSide.pairs,
          out_pairs: outSide.pairs,
        },
        inflows: inSide.top.map(toEdge),
        outflows: outSide.top.map(toEdge),
        restIn: inSide.rest,
        restOut: outSide.rest,
        meta: { w, limit, min, dir, generated_at: new Date().toISOString() },
      },
      { headers: TREE_CACHE_HEADERS },
    )
  } catch (err: any) {
    console.error('[api/holders/tree/ego GET]', err?.message ?? err)
    return errorJson('internal', 500)
  }
}

/**
 * Um lado do ego: a pagina de dog_flows em que a carteira e `dst` (entrada)
 * ou `src` (saida), do maior total_dog para o menor, com desempate pela
 * contraparte para a ordem ser estavel (mesmo criterio do /node e do sankey).
 * retryOnce porque o gateway do Supabase derruba chamadas avulsas nos picos
 * de escrita do backfill.
 */
async function fetchSide(matchCol: 'src' | 'dst', wallet: string, min: number, limit: number): Promise<Side> {
  const counterCol = matchCol === 'src' ? 'dst' : 'src'
  const page = await retryOnce(async () => {
    let q: any = supabase.from('dog_flows').select(FLOW_SELECT).eq(matchCol, wallet)
    if (min > 0) q = q.gte('total_dog', min)
    const { data, error } = await q
      .order('total_dog', { ascending: false })
      .order(counterCol, { ascending: true })
      .limit(PAGE_CAP)
    if (error) throw new Error(error.message)
    return (data ?? []) as FlowRow[]
  })

  // Um par consigo mesma nao e contraparte: fora do grafo, fora das somas.
  const truncated = page.length === PAGE_CAP
  const rows = page.filter((r) => r.src !== r.dst)
  const top = rows.slice(0, limit)
  const restRows = rows.slice(limit)
  const restDog = restRows.reduce((acc, r) => acc + Number(r.total_dog ?? 0), 0)
  const rest: EgoRest | null =
    restRows.length > 0 || truncated
      ? {
          n: restRows.length,
          dog: Math.round(restDog),
          ...(truncated ? { truncated: true as const } : {}),
        }
      : null
  const sumDog = rows.reduce((acc, r) => acc + Number(r.total_dog ?? 0), 0)
  return { rows, top, rest, sumDog, pairs: rows.length }
}

/** Saldo, profundidade e is_holder de todos os enderecos do payload, num lote. */
async function fetchGenealogy(wallets: string[]): Promise<Map<string, GenRow>> {
  if (wallets.length === 0) return new Map()
  const rows = await retryOnce(async () => {
    const { data, error } = await supabase
      .from('dog_genealogy')
      .select('wallet, depth, balance_dog, is_holder')
      .in('wallet', wallets)
    if (error) throw new Error(error.message)
    return (data ?? []) as GenRow[]
  })
  return new Map(rows.map((r) => [r.wallet, r]))
}
