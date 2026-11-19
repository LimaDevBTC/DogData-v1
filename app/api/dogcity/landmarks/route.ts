/**
 * GET /api/dogcity/landmarks?address=<endereço ordinals>
 *   -> { landmarks: [{ id, name, url }] }  as casas sob medida da carteira (lib/dog/landmarks.ts)
 *
 * 19/11/2026: o perfil mostra, além da escritura do lote, a peça própria que a carteira tem na cidade (PIPS HOUSE,
 * J.DOG ESTATE, SATOSHI'S GOAL ARENA). A fonte é o catálogo público do jogo, o mesmo da trava dos veículos e da porta.
 * Só leitura, nada de segredo: a `carteiraDona` já é pública no catálogo do jogo.
 */
import { NextRequest, NextResponse } from 'next/server'
import { normalizeAddress } from '@/lib/dog/licence-btc'
import { catalogoDoJogo, landmarksOf } from '@/lib/dog/landmarks'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 10

export async function GET(req: NextRequest) {
  const address = normalizeAddress(req.nextUrl.searchParams.get('address'))
  if (!address) return NextResponse.json({ error: 'invalid Bitcoin address' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
  const catalogo = await catalogoDoJogo()
  if (!catalogo) return NextResponse.json({ error: 'game catalogue unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  return NextResponse.json(
    { landmarks: landmarksOf(catalogo, address) },
    { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=600' } },
  )
}
