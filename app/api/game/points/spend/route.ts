/**
 * DC POINTS: gastar no mercado do jogo (carne, garrafa de água, galão, vara, rede, covo, machado, picareta).
 *
 * POST /api/game/points/spend { item, qty, ref, maxTotal? }   (cookie de sessão dg_wallet)
 *   -> 200 { ok, item, qty, unitPrice, debited, balance, day, duplicate }
 *   O PREÇO É DO SERVIDOR: o preço do dia do jogo (cópia de precoDoDia do jogo, com teste de igualdade) pelo dia do jogo
 *   de agora (vira às 08:00 UTC). O cliente nunca manda preço; `maxTotal` (opcional, o que o jogador viu) só pode RECUSAR
 *   (409 price_changed), nunca baixar. Débito atômico no banco, saldo nunca negativo, `ref` idempotente.
 *   400 invalid_json | invalid_body | invalid_item | invalid_qty | invalid_ref | invalid_max_total; 401;
 *   402 insufficient_points { balance, needed }; 409 price_changed { unitPrice, total } | ref_conflict; 413; 429 (30 por
 *   minuto por carteira); 503.
 *
 * O item entra na mochila no CLIENTE depois do 200 (o servidor não guarda a mochila).
 */
import type { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { comPrazo } from '@/lib/api/prazo'
import { gameDay } from '@/lib/game/checkin'
import { spendPoints } from '@/lib/game/points/service'
import { pointsStore } from '@/lib/game/points/store'
import { json, rateLimited, readBody, unauthenticated, unavailable, walletOf, walletOverLimit } from '@/lib/game/points/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 10

export async function POST(req: NextRequest) {
  return comPrazo(async (signal) => {
    const wallet = await walletOf(req)
    if (!wallet) return unauthenticated()
    if (await walletOverLimit('spend', wallet)) return rateLimited()
    const body = await readBody(req)
    if (!body.ok) return body.res
    const r = await spendPoints(pointsStore(supabase, signal), wallet, body.value, gameDay())
    return json(r.body, r.status)
  }, { ms: 8_000, falha: unavailable })
}
