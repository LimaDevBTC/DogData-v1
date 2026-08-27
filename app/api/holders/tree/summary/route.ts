import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { comPrazo, TREE_CACHE_HEADERS, respostaIndisponivel } from '../_shared'

// O RESUMO VIVO do $DOG Galaxy: os quatro numeros que as vitrines mostram
// (banner de /holders, secao da landing), servidos direto da genealogia.
//
// Por que esta rota existe: as vitrines vinham com numero escrito a mao e um
// selo de "snapshot". Isso mentia sobre o produto, que e vivo: o vigia
// (dog_genealogy_updater) acrescenta carteira e aresta A CADA BLOCO, o sync
// de saldos roda aos 35 de cada hora e o reconciliador completo as 05:15.
// Congelar a copy fazia a pagina envelhecer sozinha.
//
// ⚠️ NAO use /api/holders/tree para isto: aquela rota devolve o esqueleto
// inteiro, uns 628 KB, e leva segundos. Aqui sao duas leituras de indice.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } },
)

async function handler() {
  try {
    // o no raiz ja carrega os agregados de subarvore, entao o universo
    // inteiro sai de UMA linha (chave primaria)
    const raiz = await supabase
      .from('dog_genealogy')
      .select('subtree_wallets,subtree_holders,children_count')
      .eq('depth', 0)
      .limit(1)
      .abortSignal(AbortSignal.timeout(4000))
    if (raiz.error) throw raiz.error
    const r = raiz.data && raiz.data[0]
    if (!r) return respostaIndisponivel()

    // a corrente mais funda: uma linha pelo indice de depth, nunca um
    // agregado (o PostgREST do projeto nao permite e seria varredura)
    const fundo = await supabase
      .from('dog_genealogy')
      .select('depth')
      .order('depth', { ascending: false })
      .limit(1)
      .abortSignal(AbortSignal.timeout(4000))
    const d = fundo.data && fundo.data[0]

    const wallets = Number(r.subtree_wallets) || 0
    const holders = Number(r.subtree_holders) || 0
    return NextResponse.json(
      {
        wallets,
        holders,
        spent: Math.max(0, wallets - holders),
        directChildren: Number(r.children_count) || 0,
        deepest: d ? Number(d.depth) || 0 : 0,
        updated_at: new Date().toISOString(),
      },
      // 10 min na borda: o dado anda a cada bloco, mas a vitrine nao precisa
      // de precisao ao segundo e a instancia e pequena
      { headers: { ...TREE_CACHE_HEADERS, 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800' } },
    )
  } catch {
    return respostaIndisponivel()
  }
}

export async function GET() {
  return comPrazo(() => handler())
}
