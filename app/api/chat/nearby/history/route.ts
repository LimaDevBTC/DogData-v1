import { NextResponse } from 'next/server'
import { redisClient } from '@/lib/upstash'
import { comPrazo, falhaPublica } from '@/lib/api/prazo'
import { CHAVES } from '@/lib/chat/nearby-sessao'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/chat/nearby/history → as ultimas 50 mensagens PUBLICAS do chat do jogo (12/10/2026),
// em ordem de chegada, assinadas como foram ao ar. Quem acabou de entrar na cidade le daqui o que
// ja' foi dito; o resto chega ao vivo pelo Realtime. Privada nunca entra aqui.
//
// Publica e sem cookie: a borda guarda 2 s (todo mundo que entra no mesmo instante custa uma
// leitura do Redis, a classe do incidente de IO de 26/08).

interface Envelope {
  d: string
  s: string
}

export async function GET() {
  return comPrazo(
    async () => {
      const guardadas = await redisClient.lrange<Envelope>(CHAVES.historico, 0, -1)
      const msgs = (guardadas ?? []).filter((m) => m && typeof m.d === 'string' && typeof m.s === 'string')
      return NextResponse.json({ msgs }, { headers: { 'Cache-Control': 'public, s-maxage=2, stale-while-revalidate=10' } })
    },
    { ms: 4000, falha: () => falhaPublica() },
  )
}
