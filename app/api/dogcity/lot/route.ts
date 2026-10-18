import { NextRequest, NextResponse } from 'next/server'
import { escrituras, buscarLotePorId } from '@/lib/city/escrituras'
import { lotInfo } from '@/lib/city/lot-info'
import { BAIRRO_DO_SETOR, TIPOLOGIA_DA_FORMA } from '@/app/dogcity/dogcity-data'

// ═══════════════════════════════════════════════════════════════════════════
// UM LOTE POR ID, SEM ENDEREÇO (landing v3, brief §13 dependência 3).
//
// O atalho "Or open an example" da busca e a galeria das escrituras abrem um
// lote pelo lot_id. Esta rota responde o que a escritura daquele lote imprime
// (tier, distrito, área, rua) e, para o pino no mapa, o centro do lote em
// metros. NUNCA devolve endereço de carteira: o índice só tem o hash dele, e o
// dado da escritura não tem endereço nenhum.
//
// Fontes: data/dogcity_lot_info.json (tier, distrito, área, rua) e
// public/city/escrituras.bin (posição, tipologia). Os 698 lotes da reserva do
// projeto não estão no índice: saem sem posição.
// ═══════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')?.trim().toUpperCase() ?? ''
  if (!/^S\d{2}-Q\d{2}-B\d{4}-L\d{3}$/.test(id)) {
    return NextResponse.json({ error: 'invalid lot id' }, { status: 400 })
  }
  const origin = req.nextUrl.origin || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
  const [info, ix] = await Promise.all([lotInfo(id).catch(() => null), escrituras(origin).catch(() => null)])
  const e = ix ? buscarLotePorId(ix, id) : null
  const l = e?.kind === 'lote' ? e : null
  if (!info && !l) return NextResponse.json({ error: 'lot not found' }, { status: 404 })

  const setor = Number(id.slice(1, 3))
  return NextResponse.json(
    {
      lot_id: id,
      sector: setor,
      district: BAIRRO_DO_SETOR[setor] ?? null,
      area_m2: info?.area_m2 ?? l?.area_m2 ?? null,
      typology: l ? TIPOLOGIA_DA_FORMA[l.forma] ?? null : null,
      tier: info?.tier ? { code: info.tier.code, rung: info.tier.rung, name: info.tier.label } : null,
      deed_district: info?.district ?? null,
      district_name: info?.districtName ?? null,
      front_road: info?.frontRoad ?? null,
      access: info?.access ?? null,
      faces: info?.faces ?? null,
      position: l ? 'ok' : 'unavailable',
      ...(l && { x_m: l.x_m, z_m: l.z_m }),
      map: `https://dogcity.space/?lot=${encodeURIComponent(id)}`,
    },
    { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } },
  )
}
