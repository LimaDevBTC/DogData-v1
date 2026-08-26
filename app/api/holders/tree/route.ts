import { NextResponse } from 'next/server'
import {
  ROOT_WALLET,
  NODE_SELECT,
  TREE_CACHE_HEADERS,
  attachLabels,
  errorJson,
  fetchNodesPaged,
  rowToNode,
  supabase,
  type No,
  comPrazo,
} from './_shared'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Teto de nos devolvidos no snapshot inicial. A tela desenha a arvore inteira
// a partir daqui e busca o resto sob demanda em /children.
const NODE_BUDGET = 3000

// Ate qual profundidade a rota soma geracao por geracao. Medido em
// 2026-08-26: a arvore tem depth ate 1663, mas 97,7% das carteiras com
// profundidade resolvida estao ate depth 30 (244.397 de 250.010) — o resto e
// cauda longa de poucas dezenas de carteiras por nivel. Agregacao nativa do
// PostgREST nao esta disponivel neste projeto (select=depth,count() devolve
// PGRST123 "Use of aggregate functions is not allowed"), entao a alternativa
// e uma contagem por profundidade; ate 30 mantem a rota rapida.
const GENS_MAX_DEPTH = 30

// GET /api/holders/tree
// Devolve a raiz, um recorte de ate NODE_BUDGET nos (por subtree_holders
// desc, sempre tentando caber depth <= 1 inteiro) e a distribuicao por
// geracao. E o payload que desenha o primeiro quadro da arvore; o resto vem
// sob demanda de /children, /path e /search.
export async function GET() {
  return comPrazo(() => handler())
}

async function handler() {
  try {
    const [root, nodes, gens] = await Promise.all([fetchRoot(), fetchNodeBudget(), fetchGens()])

    if (!root) {
      return errorJson('root wallet not found in dog_genealogy', 500)
    }

    // A raiz quase sempre entra sozinha (subtree_holders dela e o maior de
    // toda a tabela), mas se por algum motivo nao entrou, ela troca de lugar
    // com o ultimo no do lote para o orcamento nao estourar.
    let finalNodes = nodes
    if (!finalNodes.some((n: No) => n.w === root.w)) {
      finalNodes = [root, ...finalNodes.slice(0, Math.max(0, NODE_BUDGET - 1))]
    }

    const labeled = await attachLabels(finalNodes)
    const rootLabeled = labeled.find((n) => n.w === root.w) ?? root

    return NextResponse.json(
      { root: rootLabeled, nodes: labeled, gens },
      { headers: TREE_CACHE_HEADERS },
    )
  } catch (err: any) {
    console.error('[api/holders/tree GET]', err?.message ?? err)
    return errorJson('internal', 500)
  }
}

async function fetchRoot(): Promise<No | null> {
  const { data, error } = await supabase
    .from('dog_genealogy')
    .select(NODE_SELECT)
    .eq('wallet', ROOT_WALLET)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? rowToNode(data as any) : null
}

// Monta o recorte de ate NODE_BUDGET nos: primeiro tenta caber depth <= 1
// inteiro (a raiz e seus filhos diretos), e usa o que sobrar do orcamento
// para os proximos maiores por subtree_holders. Quando depth <= 1 sozinho ja
// estoura o orcamento (e o caso hoje: 76.399 carteiras), cai direto para o
// top NODE_BUDGET por subtree_holders sem filtro de profundidade.
async function fetchNodeBudget(): Promise<No[]> {
  const { count, error: countError } = await supabase
    .from('dog_genealogy')
    .select('wallet', { count: 'exact', head: true })
    .lte('depth', 1)
  if (countError) throw new Error(countError.message)

  if (count !== null && count > 0 && count <= NODE_BUDGET) {
    const shallow = await fetchNodesPaged(
      (from: number, to: number) =>
        supabase
          .from('dog_genealogy')
          .select(NODE_SELECT)
          .lte('depth', 1)
          .order('subtree_holders', { ascending: false })
          .range(from, to) as any,
      count,
    )
    const remaining = NODE_BUDGET - shallow.length
    if (remaining <= 0) return shallow
    const seen = new Set(shallow.map((n: No) => n.w))
    const rest = await fetchNodesPaged(
      (from: number, to: number) =>
        supabase
          .from('dog_genealogy')
          .select(NODE_SELECT)
          .gt('depth', 1)
          .order('subtree_holders', { ascending: false })
          .range(from, to) as any,
      remaining,
    )
    return [...shallow, ...rest.filter((n: No) => !seen.has(n.w))]
  }

  return fetchNodesPaged(
    (from: number, to: number) =>
      supabase
        .from('dog_genealogy')
        .select(NODE_SELECT)
        .order('subtree_holders', { ascending: false })
        .range(from, to) as any,
    NODE_BUDGET,
  )
}

// Uma linha por profundidade ate GENS_MAX_DEPTH: total de carteiras e quantas
// sao holders hoje. Duas contagens (head:true, sem baixar linha nenhuma) por
// nivel, todas em paralelo.
async function fetchGens(): Promise<{ depth: number; wallets: number; holders: number }[]> {
  const depths = Array.from({ length: GENS_MAX_DEPTH + 1 }, (_, i) => i)
  const rows = await Promise.all(
    depths.map(async (depth) => {
      const [totalRes, holderRes] = await Promise.all([
        supabase.from('dog_genealogy').select('wallet', { count: 'exact', head: true }).eq('depth', depth),
        supabase
          .from('dog_genealogy')
          .select('wallet', { count: 'exact', head: true })
          .eq('depth', depth)
          .eq('is_holder', true),
      ])
      if (totalRes.error) throw new Error(totalRes.error.message)
      if (holderRes.error) throw new Error(holderRes.error.message)
      return { depth, wallets: totalRes.count ?? 0, holders: holderRes.count ?? 0 }
    }),
  )
  return rows.filter((r) => r.wallets > 0)
}
