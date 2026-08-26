import { promises as fs } from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'

// Populacao COMPLETA do $DOG Galaxy: binario com TODAS as carteiras do
// historico (menos as ~3000 do esqueleto, que a cena ja desenha como
// estrelas). Formato (little-endian), escrito por
// scripts/export_galaxy_population.py:
//   4B magia 'DGX1' | uint32 count |
//   int16 x,y,z * count (posicao * 8) |
//   uint16 geracao * count | uint8 classe * count |
//   uint32 indiceNaOrdemCompleta * count (para o clique resolver via /at)
// Sem enderecos no payload de proposito: 264k enderecos passam de 16MB; a
// identidade resolve no clique. Sem banco nesta rota: zero risco pra
// instancia pequena.
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const buf = await fs.readFile(path.join(process.cwd(), 'data', 'galaxy_population.bin'))
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=3600',
      },
    })
  } catch {
    // arquivo ausente (export nunca rodou neste deploy): a cena segue so
    // com o esqueleto; 204 e o sinal de "sem populacao", nunca 500
    return new NextResponse(null, {
      status: 204,
      headers: { 'Cache-Control': 'public, s-maxage=300' },
    })
  }
}
