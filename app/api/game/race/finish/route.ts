import { NextRequest } from 'next/server'
import { redisClient } from '@/lib/upstash'
import { comPrazo } from '@/lib/api/prazo'
import { lerJsonComTeto } from '@/lib/seguranca/freio'
import { terminar } from '@/lib/game/race/service'
import { PRAZO_MS, carteiraDaSessao, deps, falhaDaRota, json, resposta } from '@/lib/game/race/rota'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// 13 min a 5 Hz sao ~60 KB de JSON; 30 min, ~200 KB. O teto exato vem do numero de amostras (12.000).
const MAX_BYTES = 512 * 1024

// POST { raceId, trace, flags, clientLapMs } -> { valid, lapMs, rank, record, prize, phase, opening: { drivers, needed }, openingClosed }
// (os tres ultimos campos so' com valid: true). Fecha a volta: bandeiras, portoes (ordem e piso de tempo), trajetoria, tempo oficial =
// carimbo do ultimo portao menos o da largada; depois, numa transacao do banco (race_finish_lap), o recorde, a abertura do modelo, o
// premio e a posicao. `prize` e' sobre a carteira que terminou a volta. Repetir o finish de uma volta ja valida devolve o mesmo resultado.
export async function POST(req: NextRequest) {
  const agora = Date.now()
  return comPrazo(
    async () => {
      const wallet = await carteiraDaSessao(req)
      if (!wallet) return json({ error: 'unauthenticated' }, 401)
      const corpo = await lerJsonComTeto(req, MAX_BYTES)
      if (!corpo.ok) return json({ error: corpo.status === 413 ? 'too_large' : 'invalid_json' }, corpo.status)
      const livre = await redisClient.set(`race:rl:finish:${wallet}`, 1, { nx: true, ex: 1 })
      if (!livre) return json({ error: 'rate_limited' }, 429, { 'Cache-Control': 'no-store', 'Retry-After': '1' })
      return resposta(await terminar(deps, wallet, corpo.valor, agora))
    },
    { ms: PRAZO_MS.finish, falha: falhaDaRota },
  )
}
