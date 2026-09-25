import { NextResponse } from 'next/server'

// ⚠️ DISJUNTOR DE ROTA (incidente de IO de 26/08). Com o Supabase anemico de
// IO, rota sem prazo pendurava por minutos, a funcao pendurada comia a
// concorrencia da Vercel e derrubava rotas sem relacao nenhuma. Regra da casa
// para rota nova ou mexida: tem PRAZO. Estourou, devolve a resposta de falha
// na hora e aborta o que estava em voo (o `signal` vai para o
// `.abortSignal()` das consultas do supabase-js e para o `fetch`).
//
// A resposta de falha e de quem chama: leitura publica devolve 503 com cache
// curto na CDN (os proximos visitantes recebem a falha da borda sem tocar no
// banco); leitura com cookie devolve 503 sem cache.
//
// Mesma ideia de `comPrazo` em app/api/holders/tree/_shared.ts, que tem prazo
// e resposta fixos para a arvore; esta aqui recebe os dois.
export async function comPrazo(
  fn: (signal: AbortSignal) => Promise<NextResponse>,
  { ms, falha }: { ms: number; falha: () => NextResponse },
): Promise<NextResponse> {
  const ctrl = new AbortController()
  let timer: ReturnType<typeof setTimeout> | null = null
  const prazo = new Promise<NextResponse>((res) => {
    timer = setTimeout(() => {
      ctrl.abort()
      res(falha())
    }, ms)
  })
  try {
    return await Promise.race([
      fn(ctrl.signal).catch((e) => {
        console.error('[comPrazo]', e instanceof Error ? e.message : e)
        return falha()
      }),
      prazo,
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/** Falha de leitura publica: 503 com cache curto na borda. */
export function falhaPublica(sMaxAge = 10): NextResponse {
  return NextResponse.json(
    { error: 'data backend busy, retry shortly' },
    { status: 503, headers: { 'Cache-Control': `public, s-maxage=${sMaxAge}` } },
  )
}

/** Falha de leitura que depende de cookie: 503 sem cache nenhum. */
export function falhaPrivada(): NextResponse {
  return NextResponse.json(
    { error: 'data backend busy, retry shortly' },
    { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
  )
}
