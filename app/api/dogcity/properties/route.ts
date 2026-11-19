/**
 * GET /api/dogcity/properties  (pública, só leitura; o robô das casas do dogcity-mundo lê daqui)
 *   -> { properties: [{ anchor, lots, tier, state: 'active', amenities }] }   SEM endereço
 *
 * As propriedades unidas ATIVAS (lib/dog/property-merge.ts). Antes de responder, a que tem um lote fora da carteira
 * dona (pelo mint) é desfeita (forçado, sem freio: o registro só passa a dizer o que a cadeia já diz). Mint mudo para
 * uma carteira: a propriedade dela segue ativa (nunca desfaz sem saber). Cache curto na borda: o robô roda de hora em hora.
 */
import { NextResponse } from 'next/server'
import { propriedadesPublicas } from '@/lib/dog/property-merge-service'
import { propertyDeps } from '@/lib/dog/property-merge-deps'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET() {
  const r = await propriedadesPublicas(propertyDeps)
  if (!Array.isArray(r)) {
    if (r.why === 'not_open') return NextResponse.json({ properties: [], open: false }, { headers: { 'Cache-Control': 'public, max-age=60' } })
    return NextResponse.json({ error: 'data backend busy, retry shortly' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
  return NextResponse.json({ properties: r, open: true }, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' } })
}
