/**
 * DC POINTS: ganhar (pesca, venda ao mercado, madeira, minério, caça, cavalo, turno, missão, tutorial, Verified).
 *
 * POST /api/game/points/earn { source, amount, ref, allOrNothing? }   (cookie de sessão dg_wallet)
 *   -> 200 { ok, source, requested, credited, capped, duplicate, balance, earnedToday, remainingToday, dailyCap }
 *   Lista FECHADA de fontes com teto por operação (lib/game/points/rules.ts, EARN_SOURCES); `checkin` não entra (só o
 *   check-in credita). Teto diário de 480 no BANCO: entra min(pedido, o que falta no dia); com allOrNothing, tudo ou nada.
 *   `ref` idempotente (tutorial e verified: uma vez por carteira, o ref do cliente é ignorado). Só carteira com handle.
 *   400 invalid_json | invalid_body | invalid_source | invalid_amount | invalid_ref; 401; 403 no_handle; 409 ref_conflict;
 *   413 too_large; 429 (60 por minuto por carteira); 503 (repetir com o mesmo ref é seguro).
 *
 * Tudo que vem do cliente é hostil: só inteiro JSON, dentro da faixa; NaN, Infinity, fração, negativo e string não passam.
 */
import type { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { comPrazo } from '@/lib/api/prazo'
import { earnPoints } from '@/lib/game/points/service'
import { pointsStore } from '@/lib/game/points/store'
import { json, rateLimited, readBody, unauthenticated, unavailable, walletOf, walletOverLimit } from '@/lib/game/points/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 10

export async function POST(req: NextRequest) {
  return comPrazo(async (signal) => {
    const wallet = await walletOf(req)
    if (!wallet) return unauthenticated()
    if (await walletOverLimit('earn', wallet)) return rateLimited()
    const body = await readBody(req)
    if (!body.ok) return body.res
    const r = await earnPoints(pointsStore(supabase, signal), wallet, body.value)
    return json(r.body, r.status)
  }, { ms: 8_000, falha: unavailable })
}
