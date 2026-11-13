import { NextRequest } from 'next/server'
import { redisClient } from '@/lib/upstash'
import { comPrazo } from '@/lib/api/prazo'
import { lerJsonComTeto } from '@/lib/seguranca/freio'
import { iniciar } from '@/lib/game/race/service'
import { PRAZO_MS, carteiraDaSessao, deps, falhaDaRota, json, resposta } from '@/lib/game/race/rota'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FREIO_S = 2

// POST { model, track } -> { raceId, serverTime, gates, expiresAt }. Abre a volta (uma por carteira, expira em 30 min; a nova
// substitui a velha). Contrato v1: PLANO_CORRIDA_PERIMETRAL.md. Exige a sessao de carteira (dg_wallet), falha fechada.
export async function POST(req: NextRequest) {
  const agora = Date.now()
  return comPrazo(
    async () => {
      const wallet = await carteiraDaSessao(req)
      if (!wallet) return json({ error: 'unauthenticated' }, 401)
      const corpo = await lerJsonComTeto(req, 2048)
      if (!corpo.ok) return json({ error: corpo.status === 413 ? 'too_large' : 'invalid_json' }, corpo.status)
      // freio: 1 largada a cada 2 s por carteira (SET NX com expiracao, atomico)
      const livre = await redisClient.set(`race:rl:start:${wallet}`, 1, { nx: true, ex: FREIO_S })
      if (!livre) return json({ error: 'rate_limited' }, 429, { 'Cache-Control': 'no-store', 'Retry-After': String(FREIO_S) })
      return resposta(await iniciar(deps, wallet, corpo.valor, agora))
    },
    { ms: PRAZO_MS.start, falha: falhaDaRota },
  )
}
