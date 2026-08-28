import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ═══════════════════════════════════════════════════════════════════════════
// Leitura do painel.
//
// ANTES: esta rota puxava TODAS as linhas da janela pra memória do Node, de
// mil em mil com .range(), e somava em JavaScript. Em 30 dias já eram ~25 mil
// linhas por request e o painel refazia isso a cada 60 segundos — um custo que
// cresce junto com o tráfego, ou seja, que fica pior exatamente quando o
// painel começa a importar. O incidente de IO de 26/08 é o precedente.
//
// AGORA: quatro funções agregam onde os dados moram (migrações 021–023) e o
// Node só repassa jsonb pronto. As quatro rodam em paralelo porque são
// independentes; uma que falhe devolve `null` no seu campo e o painel perde
// UMA aba em vez da página inteira.
//
// O disjuntor com prazo é o mesmo padrão de /api/donate/leaderboard, pela
// mesma razão: um painel interno não pode ser o que segura o banco quando ele
// já está sofrendo.
// ═══════════════════════════════════════════════════════════════════════════

const PRAZO_MS = 12_000

async function chamar(fn: string, dias: number): Promise<unknown | null> {
  const { data, error } = await supabase.rpc(fn, { p_days: dias })
  if (error) {
    console.error(`[analytics/report] ${fn}:`, error.message)
    return null
  }
  return data
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const dias = Math.min(Math.max(parseInt(searchParams.get('days') ?? '30', 10) || 30, 1), 365)

  const trabalho = Promise.all([
    chamar('analytics_traffic', dias),
    chamar('analytics_behavior', dias),
    chamar('analytics_vitals', dias),
    chamar('analytics_funnel', dias),
    chamar('analytics_direto', dias),
  ]).then(([trafego, comportamento, vitais, funil, direto]) =>
    NextResponse.json(
      { trafego, comportamento, vitais, funil, direto },
      { headers: { 'Cache-Control': 'no-store' } },
    ),
  )

  let timer: ReturnType<typeof setTimeout> | null = null
  const prazo = new Promise<NextResponse>((res) => {
    timer = setTimeout(
      () =>
        res(
          NextResponse.json(
            { error: 'banco ocupado', trafego: null, comportamento: null, vitais: null, funil: null, direto: null },
            { status: 503, headers: { 'Cache-Control': 'no-store' } },
          ),
        ),
      PRAZO_MS,
    )
  })

  try {
    return await Promise.race([trabalho, prazo])
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[analytics/report]', msg)
    return NextResponse.json({ error: 'interno' }, { status: 500 })
  } finally {
    if (timer) clearTimeout(timer)
  }
}
