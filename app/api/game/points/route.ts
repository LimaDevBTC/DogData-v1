/**
 * DC POINTS: o saldo do jogador no SERVIDOR (migração 042; decisão do fundador de 15/11/2026).
 *
 * GET /api/game/points   (cookie de sessão dg_wallet)
 *   -> 200 { balance, earnedToday, dailyCap: 480, remainingToday, canEarn, migrated, migratedAmount, day, sources }
 *   Na primeira leitura de uma carteira COM handle, a migração única do save (o valor da foto tirada quando a 042 foi
 *   aplicada, limitado a 480 x dias de jogo desde 29/10, fora do teto diário). `canEarn` = tem handle (quem acumula).
 *   401 sem sessão, 429 (60 por minuto por carteira), 503 banco fora.
 *
 * DC Points são pontos do jogo: não se compram, não se transferem, nunca viram $DOG. Contrato:
 * assets_carros/projeto/CARROS_DC_POINTS_CONTRATO.md. Regras: lib/game/points/rules.ts.
 */
import type { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { comPrazo } from '@/lib/api/prazo'
import { readPoints } from '@/lib/game/points/service'
import { pointsStore } from '@/lib/game/points/store'
import { json, rateLimited, unauthenticated, unavailable, walletOf, walletOverLimit } from '@/lib/game/points/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 10

export async function GET(req: NextRequest) {
  return comPrazo(async (signal) => {
    const wallet = await walletOf(req)
    if (!wallet) return unauthenticated()
    if (await walletOverLimit('read', wallet)) return rateLimited()
    const r = await readPoints(pointsStore(supabase, signal), wallet)
    return json(r.body, r.status)
  }, { ms: 8_000, falha: unavailable })
}
