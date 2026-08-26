import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Resolve a IDENTIDADE de um ponto da populacao do $DOG Galaxy: o binario
// nao carrega enderecos (pesariam 16MB), so o indice de cada ponto na
// ordem canonica (first_block asc, wallet asc), que e APPEND-ONLY:
// carteira nova sempre tem first_block maior que todas, entao indices
// existentes nunca mudam entre o export diario e o clique.
// O OFFSET anda pelo indice dog_genealogy_first_block_wallet_idx
// (migracao galaxy_population_order_index): pior caso medido 277ms.
// O +1 pula a raiz (unica linha depth 0, first_block minimo 840001), que
// o export exclui mas a ordem sem filtro do banco inclui.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } },
)

const CACHE = { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400' } as const

export async function GET(req: NextRequest) {
  const i = Number(req.nextUrl.searchParams.get('i'))
  if (!Number.isInteger(i) || i < 0 || i > 5_000_000) {
    return NextResponse.json({ error: 'bad index' }, { status: 400, headers: CACHE })
  }
  try {
    const { data, error } = await supabase
      .from('dog_genealogy')
      .select('wallet')
      .order('first_block', { ascending: true })
      .order('wallet', { ascending: true })
      .range(i + 1, i + 1)
      .abortSignal(AbortSignal.timeout(5000))
    if (error) throw error
    const w = data && data[0] ? (data[0] as { wallet: string }).wallet : null
    if (!w) return NextResponse.json({ error: 'not found' }, { status: 404, headers: CACHE })
    // um indice resolvido e imutavel: a CDN pode guardar por um dia
    return NextResponse.json({ w }, { headers: CACHE })
  } catch {
    return NextResponse.json(
      { error: 'resolver busy, retry shortly' },
      { status: 503, headers: { 'Cache-Control': 'public, s-maxage=30' } },
    )
  }
}
