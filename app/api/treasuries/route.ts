import { NextResponse } from 'next/server'
import { allTreasuries, type Treasury } from '@/lib/dog/treasuries'

export const dynamic = 'force-dynamic'

const CACHE_TTL_MS = 10 * 60 * 1000

let cache: { data: Treasury[]; fetchedAt: number } | null = null

/**
 * Os tesouros de DOG que a home mostra num card só.
 *
 * ⚠️ ESTA ROTA NUNCA DEVOLVE 503. O raspador da C2 depende do build do site
 * DELES e vai quebrar de novo; quando quebrar, `c2Treasury()` já devolve o
 * último valor lido de verdade com `stale: true`, e a tela escreve a data. A
 * rota anterior (`/api/c2-treasury`) devolvia erro, a home caía num
 * `?? 1_000_000_000` escrito à mão e o site publicava um número inventado sem
 * avisar ninguém. É exatamente esse caminho que não pode existir.
 */
export async function GET() {
  const now = Date.now()

  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json({ treasuries: cache.data, cached: true })
  }

  const data = await allTreasuries()
  cache = { data, fetchedAt: now }

  const c2 = data.find(t => t.id === 'c2')
  if (c2?.stale) {
    console.warn(`⚠️ C2 treasury: leitura ao vivo falhou (${c2.staleReason}); usando ${c2.dog.toLocaleString()} DOG de ${c2.readAt}`)
  } else if (c2) {
    console.log(`✅ C2 treasury: ${c2.dog.toLocaleString()} DOG`)
  }

  return NextResponse.json({ treasuries: data, cached: false })
}
