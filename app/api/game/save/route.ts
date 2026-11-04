import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { redisClient } from '@/lib/upstash'
import { sessionWallet } from '@/lib/game/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BYTES = 64 * 1024
const MIN_INTERVAL_S = 10
const H = { 'Cache-Control': 'no-store' }

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: H })

// GET -> o save da carteira da sessao (ou null).
export async function GET(req: NextRequest) {
  try {
    const wallet = await sessionWallet(req)
    if (!wallet) return json({ error: 'unauthenticated' }, 401)
    const { data, error } = await supabase
      .from('dogcity_game_saves')
      .select('save, updated_at')
      .eq('wallet', wallet)
      .maybeSingle()
    if (error) throw error
    return json({ save: data?.save ?? null, updatedAt: data?.updated_at ?? null })
  } catch (e) {
    console.error('[game/save GET]', (e as Error)?.message)
    return json({ error: 'server_error' }, 500)
  }
}

// PUT { save } -> grava o envelope inteiro dogcity.jogo.v1. Ultimo a gravar ganha.
export async function PUT(req: NextRequest) {
  try {
    const wallet = await sessionWallet(req)
    if (!wallet) return json({ error: 'unauthenticated' }, 401)

    // recusa cedo pelo Content-Length declarado (o corpo nem e' lido); o teto exato vem depois, sobre o texto
    const declared = Number(req.headers.get('content-length') ?? 0)
    if (Number.isFinite(declared) && declared > MAX_BYTES * 2) return json({ error: 'too_large' }, 413)

    const raw = await req.text()
    if (raw.length > MAX_BYTES * 2) return json({ error: 'too_large' }, 400)
    let body: { save?: unknown }
    try {
      body = JSON.parse(raw)
    } catch {
      return json({ error: 'invalid_json' }, 400)
    }
    const save = body?.save as { v?: unknown } | undefined
    if (!save || typeof save !== 'object' || Array.isArray(save) || save.v !== 1) {
      return json({ error: 'invalid_save' }, 400)
    }
    const serialized = JSON.stringify(save)
    if (Buffer.byteLength(serialized, 'utf8') > MAX_BYTES) return json({ error: 'too_large' }, 400)

    // 1 gravacao a cada 10 s por carteira: SET NX com expiracao (atomico).
    const ok = await redisClient.set(`gsave:rl:${wallet}`, 1, { nx: true, ex: MIN_INTERVAL_S })
    if (!ok) return json({ error: 'rate_limited' }, 429)

    const updatedAt = new Date().toISOString()
    const { error } = await supabase
      .from('dogcity_game_saves')
      .upsert({ wallet, save, updated_at: updatedAt }, { onConflict: 'wallet' })
    if (error) throw error
    return json({ updatedAt })
  } catch (e) {
    console.error('[game/save PUT]', (e as Error)?.message)
    return json({ error: 'server_error' }, 500)
  }
}
