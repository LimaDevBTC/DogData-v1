import { NextRequest, NextResponse } from 'next/server'
import { redisClient } from '@/lib/upstash'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET → sessão verificada atual (ou null).
export async function GET(req: NextRequest) {
  const sid = req.cookies.get('dg_wallet')?.value
  if (!sid) return NextResponse.json({ session: null })
  const session = await redisClient.get(`wsess:${sid}`)
  return NextResponse.json({ session: session ?? null })
}

// DELETE → logout (revoga a sessão + limpa o cookie).
export async function DELETE(req: NextRequest) {
  const sid = req.cookies.get('dg_wallet')?.value
  if (sid) {
    try {
      await redisClient.del(`wsess:${sid}`)
    } catch {
      /* noop */
    }
  }
  const resp = NextResponse.json({ ok: true })
  resp.cookies.set('dg_wallet', '', { httpOnly: true, path: '/', maxAge: 0 })
  return resp
}
