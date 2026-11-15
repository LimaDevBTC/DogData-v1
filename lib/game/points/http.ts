// ═══════════════════════════════════════════════════════════════════════════
// DC POINTS: o que as rotas repetem (a carteira da sessão, o freio por carteira, o corpo com teto, a resposta sem cache).
// O freio por carteira é janela fixa no Upstash (INCR + EXPIRE, o desenho de lib/seguranca/freio.ts), mas FALHA FECHADO:
// escrita de saldo não passa sem o freio. (Com o Redis fora a sessão também não se lê: a rota já seria 401/503.)
// ═══════════════════════════════════════════════════════════════════════════
import { NextResponse, type NextRequest } from 'next/server'
import { redisClient } from '@/lib/upstash'
import { normalizeAddress } from '@/lib/dog/licence-btc'
import { sessionWallet } from '@/lib/game/session'
import { lerJsonComTeto } from '@/lib/seguranca/freio'
import { BODY_MAX_BYTES } from './rules'

export const NO_STORE = { 'Cache-Control': 'no-store' }

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  NextResponse.json(body, { status, headers: { ...NO_STORE, ...headers } })

/** os tetos por carteira, por minuto */
export const RATE = { read: 60, earn: 60, spend: 30, carBuy: 10 } as const
export const RATE_WINDOW_S = 60

/** a carteira da sessão verificada, normalizada como car_ownership e o livro guardam; null = sem sessão */
export async function walletOf(req: NextRequest): Promise<string | null> {
  return normalizeAddress(await sessionWallet(req))
}

/** true = passou do teto nesta janela. Lança se o Redis não responde (a rota responde 503). */
export async function walletOverLimit(bucket: keyof typeof RATE, wallet: string): Promise<boolean> {
  const key = `dcp:rl:${bucket}:${wallet}`
  const n = await redisClient.incr(key)
  if (n === 1) await redisClient.expire(key, RATE_WINDOW_S)
  return n > RATE[bucket]
}

export const rateLimited = () => json({ error: 'rate_limited' }, 429, { 'Retry-After': String(RATE_WINDOW_S) })
export const unauthenticated = () => json({ error: 'unauthenticated' }, 401)
export const unavailable = () => json({ error: 'unavailable' }, 503)

/** o corpo JSON com o teto das rotas de escrita (1 KB) */
export async function readBody(req: NextRequest): Promise<{ ok: true; value: unknown } | { ok: false; res: NextResponse }> {
  const c = await lerJsonComTeto(req, BODY_MAX_BYTES)
  if (c.ok) return { ok: true, value: c.valor }
  return { ok: false, res: c.status === 413 ? json({ error: 'too_large' }, 413) : json({ error: 'invalid_json' }, 400) }
}
