/**
 * DOG PHONE, o app Mensagens do celular do jogo (22/11/2026). Conversa privada 1:1 entre contas que se aceitaram.
 * Tudo aqui é da conta da SESSÃO assinada (`dg_wallet`); o corpo nunca diz quem é.
 *
 *   GET  /api/dogcity/phone                 { me, friends, incoming, outgoing, blocked, unread, requests, limits }
 *   GET  /api/dogcity/phone?count=1         { unread, requests, nudge } (o selo do jogo)
 *   GET  /api/dogcity/phone/search?handle=  o perfil pelo @handle exato, para confirmar antes do pedido
 *   POST /api/dogcity/phone/friends         { action: request | accept | decline | cancel | remove | block | unblock | mute | unmute | report }
 *   GET  /api/dogcity/phone/messages?with=  o histórico paginado de UMA conversa (só para quem é do par e é amigo)
 *   POST /api/dogcity/phone/messages        { to, text, cid } envia; { read: { with, upTo } } marca como lida
 *
 * As regras (aceite antes da conversa, bloqueio, tetos) moram nas funções da migração 046. Sem ela: 503 "not open yet".
 */
import type { NextRequest } from 'next/server'
import { getPhone } from '@/lib/phone/http'
import { phoneDeps, portaHttp } from '@/lib/phone/deps'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 10

export function GET(req: NextRequest) {
  return getPhone(req, portaHttp, phoneDeps)
}
