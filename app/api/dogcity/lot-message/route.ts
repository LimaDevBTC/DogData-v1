/**
 * "MESSAGE THE OWNER" (pedido do fundador, 20/11/2026): a mensagem de texto de um jogador para o dono de um lote.
 *
 *   POST /api/dogcity/lot-message { lot, text }       envia ao dono do lote NA HORA (quem guarda a escritura pelo mint)
 *   POST /api/dogcity/lot-message { replyTo, text }   responde a uma mensagem recebida, na mesma conversa
 *
 * Sem oferta, sem preço, sem negociação: texto puro de até 500 caracteres, sem link. Só carteira verificada (a sessão assinada
 * `dg_wallet`, nunca o corpo); mesma origem; freio por IP e por carteira; 10 por dia por remetente e 1 por dia para o mesmo lote.
 * Mint mudo = falha fechado. Regras em lib/dog/lot-message.ts e lot-message-service.ts; banco na migração 045 (sem ela: 503).
 */
import type { NextRequest } from 'next/server'
import { postLotMessage } from '@/lib/dog/lot-message-http'
import { messageDeps, portaHttp } from '@/lib/dog/lot-message-deps'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 10

export function POST(req: NextRequest) {
  return postLotMessage(req, portaHttp, messageDeps)
}
