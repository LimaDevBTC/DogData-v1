import { NextRequest, NextResponse } from 'next/server'
import { resolveIdentities } from '@/lib/dog/identity'
import {
  NODE_SELECT,
  TREE_CACHE_HEADERS,
  errorJson,
  isValidAddress,
  rowToNode,
  supabase,
  type No,
  comPrazo,
} from '../_shared'
import { retryOnce, toFlowLabel, type FlowLabel } from '../flow/_agg'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const TOTAL_SUPPLY = 100_000_000_000

// O caminho ate a raiz para de subir depois de 8 saltos: o dossie e um
// painel lateral, nao o /path completo (que ja existe para quem quiser tudo).
const PATH_MAX_HOPS = 8

// Teto de pares de dog_flows somados por direcao. Uma carteira normal tem
// dezenas; a tesouraria tem 75k e paginar tudo nao cabe numa rota de painel.
// Acima do teto a soma e do topo por total_dog, o que para um dossie e a
// parte que importa (e dog_flows esta em backfill de toda forma).
const FLOW_SUM_CAP = 2000
const TOP_COUNTERPARTIES = 5

interface FlowRow {
  src: string
  dst: string
  total_dog: number | string | null
  tx_count: number | null
}

interface Counterparty {
  w: string
  label: FlowLabel | null
  dog: number
  txs: number
}

// GET /api/holders/tree/node?w=bc1...
// O dossie de uma carteira: identidade, saldo, lugar na genealogia e o fluxo
// total de entrada e saida com as 5 maiores contrapartes de cada lado.
export async function GET(req: NextRequest) {
  return comPrazo(() => handler(req))
}

async function handler(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const w = searchParams.get('w') ?? ''

  if (!isValidAddress(w)) {
    return errorJson('invalid w')
  }

  try {
    const node = await fetchGenealogyOne(w)
    if (!node) {
      return errorJson('wallet not found', 404)
    }

    const [{ path, truncated }, flowsIn, flowsOut] = await Promise.all([
      fetchAncestors(node),
      fetchFlowSide('dst', w),
      fetchFlowSide('src', w),
    ])

    // Identidades de tudo que aparece no painel, numa resolucao so: a
    // carteira, o pai, o caminho e as contrapartes dos dois lados.
    const idTargets = [
      w,
      ...(node.p ? [node.p] : []),
      ...path.map((n) => n.w),
      ...flowsIn.top.map((r) => (r.src === w ? r.dst : r.src)),
      ...flowsOut.top.map((r) => (r.src === w ? r.dst : r.src)),
    ]
    const ids = await resolveIdentities(idTargets)
    const labelOf = (addr: string) => toFlowLabel(ids.get(addr))

    const topOf = (rows: FlowRow[], counterpartOf: (r: FlowRow) => string): Counterparty[] =>
      rows.slice(0, TOP_COUNTERPARTIES).map((r) => ({
        w: counterpartOf(r),
        label: labelOf(counterpartOf(r)),
        dog: Math.round(Number(r.total_dog ?? 0)),
        txs: r.tx_count ?? 0,
      }))

    return NextResponse.json(
      {
        w,
        label: labelOf(w),
        balance_dog: Math.round(node.b),
        pct_supply: Math.round((node.b / TOTAL_SUPPLY) * 100 * 10000) / 10000,
        rank: null,
        is_holder: node.h,
        lth_sth: null,
        depth: node.d,
        parent: node.p ? { w: node.p, label: labelOf(node.p) } : null,
        // Da raiz para a carteira, sem incluir a propria (o pai ja e campo).
        path: path.map((n) => ({ w: n.w, label: labelOf(n.w) })),
        path_truncated: truncated,
        first_block: node.fb,
        cohort_tier: null,
        flows: {
          in_dog: Math.round(flowsIn.sum),
          out_dog: Math.round(flowsOut.sum),
          top_in: topOf(flowsIn.top, (r) => r.src),
          top_out: topOf(flowsOut.top, (r) => r.dst),
        },
      },
      { headers: TREE_CACHE_HEADERS },
    )
  } catch (err: any) {
    console.error('[api/holders/tree/node GET]', err?.message ?? err)
    return errorJson('internal', 500)
  }
}

// retryOnce: o gateway do Supabase derruba chamadas avulsas nos picos de
// escrita do backfill; uma repeticao curta segura o transitorio.
async function fetchGenealogyOne(wallet: string): Promise<No | null> {
  return retryOnce(async () => {
    const { data, error } = await supabase
      .from('dog_genealogy')
      .select(NODE_SELECT)
      .eq('wallet', wallet)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data ? rowToNode(data as any) : null
  })
}

/**
 * Sobe de pai em pai a partir do no, ate 8 saltos, e devolve os ancestrais
 * na ordem raiz -> carteira (sem a propria carteira). truncated marca quando
 * os 8 saltos acabaram antes de chegar na raiz (parent NULL).
 */
async function fetchAncestors(node: No): Promise<{ path: No[]; truncated: boolean }> {
  const chain: No[] = []
  let current = node.p
  let truncated = false
  while (current) {
    if (chain.length >= PATH_MAX_HOPS) {
      truncated = true
      break
    }
    const parent = await fetchGenealogyOne(current)
    if (!parent) break // pai referenciado sumiu da tabela: devolve o que subiu
    chain.push(parent)
    current = parent.p
  }
  return { path: chain.reverse(), truncated }
}

/**
 * Um lado do fluxo: soma e topo dos pares de dog_flows em que a carteira e
 * `dst` (entrada) ou `src` (saida), do maior para o menor, paginado em 1000
 * ate o teto. Desempate pela contraparte para a paginacao ser estavel.
 */
async function fetchFlowSide(
  matchCol: 'src' | 'dst',
  wallet: string,
): Promise<{ sum: number; top: FlowRow[] }> {
  // matchCol e a coluna que casa com a CARTEIRA (dst para entrada, src para
  // saida); a contraparte esta na outra coluna e desempata a paginacao.
  const counterCol = matchCol === 'src' ? 'dst' : 'src'
  const PAGE = 1000
  const rows: FlowRow[] = []
  let offset = 0
  while (rows.length < FLOW_SUM_CAP) {
    const to = Math.min(offset + PAGE, FLOW_SUM_CAP) - 1
    const page = await retryOnce(async () => {
      const { data, error } = await supabase
        .from('dog_flows')
        .select('src, dst, total_dog, tx_count')
        .eq(matchCol, wallet)
        .order('total_dog', { ascending: false })
        .order(counterCol, { ascending: true })
        .range(offset, to)
      if (error) throw new Error(error.message)
      return (data ?? []) as FlowRow[]
    })
    rows.push(...page)
    if (page.length < to - offset + 1) break
    offset += PAGE
  }
  const sum = rows.reduce((acc, r) => acc + Number(r.total_dog ?? 0), 0)
  return { sum, top: rows }
}
