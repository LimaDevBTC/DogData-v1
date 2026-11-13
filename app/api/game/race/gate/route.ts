import { NextRequest } from 'next/server'
import { comPrazo } from '@/lib/api/prazo'
import { lerJsonComTeto } from '@/lib/seguranca/freio'
import { portao } from '@/lib/game/race/service'
import { PRAZO_MS, carteiraDaSessao, deps, falhaDaRota, json, resposta } from '@/lib/game/race/rota'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST { raceId, i, pos: [x, y, z], v } -> { ok, t }. O RELOGIO DO SERVIDOR carimba a chegada do portao: o instante vem da primeira
// linha da rota, antes da sessao e do banco. Fora de ordem, repetido ou trecho mais rapido que distancia / (1,05 x Vmax): a volta e'
// anulada (409/422). Sem freio por IP aqui: o cliente pode repetir o POST e um 429 derrubaria a volta no disjuntor dele.
export async function POST(req: NextRequest) {
  const agora = Date.now()
  return comPrazo(
    async () => {
      const wallet = await carteiraDaSessao(req)
      if (!wallet) return json({ error: 'unauthenticated' }, 401)
      const corpo = await lerJsonComTeto(req, 2048)
      if (!corpo.ok) return json({ error: corpo.status === 413 ? 'too_large' : 'invalid_json' }, corpo.status)
      return resposta(await portao(deps, wallet, corpo.valor, agora))
    },
    { ms: PRAZO_MS.gate, falha: falhaDaRota },
  )
}
