import { NextRequest } from 'next/server'
import { comPrazo } from '@/lib/api/prazo'
import { meu } from '@/lib/game/race/service'
import { PRAZO_MS, carteiraDaSessao, deps, falhaDaRota, json, resposta } from '@/lib/game/race/rota'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET -> { wallet, best: { <modelo>: { lapMs, rank } }, open: { raceId, model, expiresAt } | null }. Depende do cookie: nunca em cache.
export async function GET(req: NextRequest) {
  const agora = Date.now()
  return comPrazo(
    async () => {
      const wallet = await carteiraDaSessao(req)
      if (!wallet) return json({ error: 'unauthenticated' }, 401)
      return resposta(await meu(deps, wallet, agora))
    },
    { ms: PRAZO_MS.leitura, falha: falhaDaRota },
  )
}
