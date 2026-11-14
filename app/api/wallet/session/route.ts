import { NextRequest, NextResponse } from 'next/server'
import { redisClient } from '@/lib/upstash'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// A resposta muda por cookie: nenhum cache no caminho pode guardar uma sessão.
const SEM_CACHE = { 'Cache-Control': 'private, no-store' }

// GET → sessão verificada atual (ou null).
export async function GET(req: NextRequest) {
  const sid = req.cookies.get('dg_wallet')?.value
  if (!sid || sid.length > 100) return NextResponse.json({ session: null }, { headers: SEM_CACHE })
  const session = await redisClient.get(`wsess:${sid}`)
  return NextResponse.json({ session: session ?? null }, { headers: SEM_CACHE })
}

// DELETE → logout (revoga a sessão + limpa o cookie).
export async function DELETE(req: NextRequest) {
  const sid = req.cookies.get('dg_wallet')?.value
  if (sid && sid.length <= 100) {
    try {
      await redisClient.del(`wsess:${sid}`)
    } catch {
      /* noop */
    }
  }
  const resp = NextResponse.json({ ok: true }, { headers: SEM_CACHE })
  resp.cookies.set('dg_wallet', '', { httpOnly: true, path: '/', maxAge: 0 })
  return resp
}
