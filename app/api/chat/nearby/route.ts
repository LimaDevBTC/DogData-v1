import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { redisClient } from '@/lib/upstash'
import { comPrazo } from '@/lib/api/prazo'
import { corpoFala, INTERVALO_MS, lerPedido } from '@/lib/chat/nearby'
import { assinarFala } from '@/lib/chat/nearby-key'
import { CHAVES, erro, estourouIp, guardarNomeDoId, nomeDaSessao, nomeDoId, SEM_CACHE, sessaoDe, vincularId } from '@/lib/chat/nearby-sessao'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/chat/nearby {id, cid, text, x, y, z, to?, toName?} → uma mensagem do chat do jogo
// (a aba "Default" da DOG CITY, 12/10/2026), assinada. Um chat so':
//   - PUBLICA (sem `to`): a cidade inteira le. O proprio jogo publica o envelope no lobby do
//     Supabase Realtime; quem esta' perto (a posicao carimbada) tambem ve o balao. As ultimas 50
//     ficam no Redis por 24 h para quem chega depois (GET /api/chat/nearby/history).
//   - PRIVADA (`to` = id de rede de quem recebe): nunca vai ao broadcast. Fica na caixa do
//     destinatario (15 min), que so' a sessao dona daquele id le (POST /api/chat/nearby/inbox);
//     o jogo so' manda uma cutucada sem conteudo. `toName` e' o nome que quem escreveu viu: se o
//     servidor conhece outro nome para aquele id, a privada nao sai (409 nome).
// O que a rota garante:
//   - QUEM: o nome sai da sessao (@handle da carteira provada, cookie dg_wallet) ou e' o convidado
//     (n: null). O id de rede fica preso ao primeiro cookie dg_near que usa ele (6 h).
//   - O QUE: texto normalizado, 1 a 140 grafemas (lib/chat/nearby.ts).
//   - QUANDO: 1 mensagem a cada 2 s por sessao e 40 por minuto por IP. A hora e' do servidor.
//   - ONDE: a posicao vai carimbada e assinada. O jogo nao tem servidor de posicao (a pose e' do
//     cliente, pelo Realtime): aqui ela so' e' conferida (numero, dentro do mapa) e congelada.
// Reenvio com o mesmo cid em 60 s devolve a mesma mensagem (o jogo nao duplica numa rede ruim).
//
// Respostas: 200 {msg: {d, s}, mid} · 400/422 {code: corpo|id|texto|posicao|para} · 404 {code:
// ausente} · 409 {code: id|nome} · 429 {code: ritmo} · 503.

const TETO_IP_MINUTO = 40
const PRAZO_MS = 4000
const HISTORICO_MAX = 50
const HISTORICO_S = 24 * 3600
const CAIXA_MAX = 30
const CAIXA_S = 15 * 60

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
  const pedido = lerPedido(corpo)
  if (typeof pedido === 'string') return erro(pedido === 'corpo' ? 400 : 422, pedido)
  const sessao = sessaoDe(req)

  return comPrazo(
    async (signal) => {
      // 0. teto por IP ANTES de qualquer outra leitura do Redis (14/10): um flood de corpos validos
      // gastava ate' 5 comandos por pedido antes de chegar ao teto (a classe do incidente de IO de 26/08)
      if (await estourouIp(req, 'ip', TETO_IP_MINUTO)) return sessao.comCookie(erro(429, 'ritmo', { retryMs: 30_000 }, { 'Retry-After': '30' }))

      // 1. reenvio da mesma mensagem (a resposta anterior se perdeu): a mesma, sem gastar a vez
      const chaveCid = `dogcity:nearby:cid:${sessao.id}:${pedido.cid}`
      if (!sessao.nova) {
        const antes = await redisClient.get<Envelope>(chaveCid)
        if (antes && typeof antes.d === 'string' && typeof antes.s === 'string') {
          return sessao.comCookie(NextResponse.json({ msg: antes, repetida: true }, { headers: SEM_CACHE }))
        }
      }

      // 2. o id de rede e' desta sessao
      if (!(await vincularId(pedido.id, sessao.id))) return sessao.comCookie(erro(409, 'id'))

      // 3. privada: quem recebe esta' na cidade e e' quem quem escreveu pensa que e'
      let paraNome: string | null = null
      if (pedido.para) {
        const conhecido = await nomeDoId(pedido.para)
        if (conhecido === undefined) return sessao.comCookie(erro(404, 'ausente'))
        if (conhecido !== pedido.paraNome) return sessao.comCookie(erro(409, 'nome', { nome: conhecido }))
        paraNome = conhecido
      }

      // 4. ritmo: SET NX PX reserva a vez num comando so' (sem corrida entre ler e gravar)
      const vez = await redisClient.set(`dogcity:nearby:rate:${sessao.id}`, '1', { nx: true, px: INTERVALO_MS })
      if (vez !== 'OK') return sessao.comCookie(erro(429, 'ritmo', { retryMs: INTERVALO_MS }, { 'Retry-After': '2' }))

      // 5. carimbo (quem, o que, onde, quando, para quem) e assinatura
      const nome = await nomeDaSessao(req, signal)
      await guardarNomeDoId(pedido.id, nome)
      const mid = randomUUID().replace(/-/g, '').slice(0, 16)
      const d = corpoFala(pedido, mid, nome, Date.now(), paraNome)
      const msg: Envelope = { d, s: await assinarFala(d) }

      // 6. a publica entra no historico; a privada, na caixa de quem recebe (e em mais lugar nenhum)
      const fila = redisClient.pipeline()
      if (pedido.para) {
        const caixa = CHAVES.caixa(pedido.para)
        fila.rpush(caixa, msg).ltrim(caixa, -CAIXA_MAX, -1).expire(caixa, CAIXA_S)
      } else {
        fila.rpush(CHAVES.historico, msg).ltrim(CHAVES.historico, -HISTORICO_MAX, -1).expire(CHAVES.historico, HISTORICO_S)
      }
      fila.set(chaveCid, msg, { ex: 60 })
      await fila.exec()
      return sessao.comCookie(NextResponse.json({ msg, mid }, { headers: SEM_CACHE }))
    },
    { ms: PRAZO_MS, falha: () => erro(503, 'indisponivel') },
  )
}
