/**
 * A CAIXA DE ENTRADA de "Message the owner" (20/11/2026). Só as mensagens da carteira da SESSÃO assinada (`dg_wallet`).
 *
 *   GET  /api/dogcity/inbox                         { unread, messages, muted }
 *   GET  /api/dogcity/inbox?count=1                 { unread } (o selo do jogo)
 *   POST /api/dogcity/inbox { action: 'read', ids }    marca como lidas
 *   POST /api/dogcity/inbox { action: 'delete', id }   apaga da caixa
 *   POST /api/dogcity/inbox { action: 'mute', id }     silencia o remetente da mensagem: as dele somem e não chegam mais
 *   POST /api/dogcity/inbox { action: 'unmute', id }   desfaz um silêncio (o id do silêncio)
 *
 * O remetente aparece pelo handle ou pelo endereço curto (bc1p…abcd), nunca pelo endereço inteiro.
 */
import type { NextRequest } from 'next/server'
import { getInbox, postInbox } from '@/lib/dog/lot-message-http'
import { messageDeps, portaHttp } from '@/lib/dog/lot-message-deps'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 10

export function GET(req: NextRequest) {
  return getInbox(req, portaHttp, messageDeps)
}

export function POST(req: NextRequest) {
  return postInbox(req, portaHttp, messageDeps)
}
