// Esta pessoa abre a sala de operação?
//
// Existe para o botão da carteira poder mostrar a entrada só para quem tem
// entrada. O cliente não pode decidir isso sozinho: a allowlist é ENV do
// servidor, e mandá-la para o navegador publicaria exatamente quais carteiras
// abrem a sala.
//
// ⚠️ RESPONDE 404 A QUEM NÃO É, e não `{ admin: false }`. Um "false" explícito
// confirmaria que existe uma sala e que este é o caminho de perguntar por ela.

import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '@/lib/admin/gate'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return new NextResponse(null, { status: 404 })
  return NextResponse.json(
    { admin: true, address: admin.address },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
