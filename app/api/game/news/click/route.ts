import { NextRequest, NextResponse } from 'next/server'
import { sessionWallet } from '@/lib/game/session'
import { parseClickBody } from '@/lib/game/news'
import { markNews, readJsonBody } from '@/lib/game/news-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const H = { 'Cache-Control': 'no-store' }
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: H })

// POST {id: string} -> a carteira da sessao clicou no botao do card (tambem conta como visto). O primeiro clique grava
// clicked_at; os seguintes nao mudam nada.
export async function POST(req: NextRequest) {
  try {
    const wallet = await sessionWallet(req)
    if (!wallet) return json({ error: 'unauthenticated' }, 401)
    const id = parseClickBody(await readJsonBody(req))
    if (!id) return json({ error: 'bad_request' }, 400)
    await markNews(wallet, [id], true)
    return json({ ok: true })
  } catch (e) {
    console.error('[game/news/click POST]', (e as Error)?.message)
    return json({ error: 'server_error' }, 500)
  }
}
