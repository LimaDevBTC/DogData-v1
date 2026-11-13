import { NextRequest, NextResponse } from 'next/server'
import { sessionWallet } from '@/lib/game/session'
import { parseSeenBody } from '@/lib/game/news'
import { markNews, readJsonBody } from '@/lib/game/news-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const H = { 'Cache-Control': 'no-store' }
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: H })

// POST {ids: string[]} -> marca os cards como vistos pela carteira da sessao (ate 12 ids). Idempotente.
export async function POST(req: NextRequest) {
  try {
    const wallet = await sessionWallet(req)
    if (!wallet) return json({ error: 'unauthenticated' }, 401)
    const ids = parseSeenBody(await readJsonBody(req))
    if (!ids) return json({ error: 'bad_request' }, 400)
    await markNews(wallet, ids, false)
    return json({ ok: true })
  } catch (e) {
    console.error('[game/news/seen POST]', (e as Error)?.message)
    return json({ error: 'server_error' }, 500)
  }
}
