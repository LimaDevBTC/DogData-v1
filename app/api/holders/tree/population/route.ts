import { promises as fs } from 'fs'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'

// Populacao do $DOG Galaxy: amostra estratificada de carteiras REAIS que
// substitui a poeira decorativa da cena (diretriz do fundador de 26/08:
// todo ponto deve ser uma carteira do historico, clicavel). O arquivo e
// gerado localmente por scripts/export_galaxy_population.py e embarca no
// deploy; aqui so servimos um prefixo do tamanho pedido: a ordem do
// arquivo e um embaralhamento deterministico, entao qualquer prefixo
// preserva a estratificacao por geracao.
// Sem banco nesta rota de proposito: zero risco pra instancia pequena.
export const dynamic = 'force-dynamic'

const CACHE = { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=3600' }

interface PopulationFile {
  total: number
  sampled: number
  generated_at: string
  gens: Record<string, number>
  w: [string, number, number][]
}

export async function GET(req: NextRequest) {
  try {
    const raw = await fs.readFile(
      path.join(process.cwd(), 'data', 'galaxy_population.json'),
      'utf-8',
    )
    const file = JSON.parse(raw) as PopulationFile
    const nRaw = Number(req.nextUrl.searchParams.get('n'))
    const n = Number.isFinite(nRaw) && nRaw > 0 ? Math.min(file.w.length, Math.floor(nRaw)) : file.w.length
    return NextResponse.json(
      {
        total: file.total,
        sampled: n,
        generated_at: file.generated_at,
        w: n === file.w.length ? file.w : file.w.slice(0, n),
      },
      { headers: CACHE },
    )
  } catch {
    // arquivo ausente (deploy antigo ou export nunca rodou): a cena segue
    // so com o esqueleto, sem populacao; nunca 500
    return NextResponse.json(
      { total: 0, sampled: 0, generated_at: null, w: [] },
      { status: 200, headers: CACHE },
    )
  }
}
