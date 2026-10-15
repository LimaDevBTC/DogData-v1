import { NextRequest, NextResponse } from 'next/server'
import { redisClient } from '@/lib/upstash'
import { comPrazo } from '@/lib/api/prazo'
import { horaDe, lerCaixa } from '@/lib/chat/nearby'
import { CHAVES, erro, estourouIp, guardarNomeDoId, nomeDaSessao, SEM_CACHE, sessaoDe, vincularId } from '@/lib/chat/nearby-sessao'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/chat/nearby/inbox {id, since?} → as mensagens privadas para o id de rede `id`
// (o chat do jogo, 12/10/2026), as que chegaram depois de `since` (hora do servidor, ms).
//
// So' a sessao dona do id le a caixa dele (cookie dg_near, id preso por 6 h). A mesma chamada e'
// o "estou aqui" do jogo: ao entrar na cidade ele chama uma vez, o id fica preso a' sessao e o
// servidor passa a conhecer o nome dele (@handle ou convidado). Sem isso, ninguem consegue mandar
// privada para quem ainda nao falou. Quando a cutucada 'dm' chega pelo Realtime (sem conteudo), o
// jogo chama de novo.
//
// Respostas: 200 {msgs: [{d, s}], name, now} · 400 · 409 {code: id} · 429 · 503.

const TETO_IP_MINUTO = 120
const PRAZO_MS = 4000

interface Envelope {
  d: string
  s: string
}

export async function POST(req: NextRequest) {
  let corpo: unknown
  try {
    corpo = await req.json()
  } catch {
    return erro(400, 'corpo')
  }
  const pedido = lerCaixa(corpo)
  if (!pedido) return erro(400, 'corpo')
  const sessao = sessaoDe(req)

  return comPrazo(
    async (signal) => {
      if (await estourouIp(req, 'ipc', TETO_IP_MINUTO)) return sessao.comCookie(erro(429, 'ritmo', { retryMs: 30_000 }, { 'Retry-After': '30' }))
      if (!(await vincularId(pedido.id, sessao.id))) return sessao.comCookie(erro(409, 'id'))
      const nome = await nomeDaSessao(req, signal)
      await guardarNomeDoId(pedido.id, nome)
      const guardadas = await redisClient.lrange<Envelope>(CHAVES.caixa(pedido.id), 0, -1)
      const msgs = (guardadas ?? []).filter(
        (m) => m && typeof m.d === 'string' && typeof m.s === 'string' && horaDe(m.d) > pedido.desde,
      )
      return sessao.comCookie(NextResponse.json({ msgs, name: nome, now: Date.now() }, { headers: SEM_CACHE }))
    },
    { ms: PRAZO_MS, falha: () => erro(503, 'indisponivel') },
  )
}
