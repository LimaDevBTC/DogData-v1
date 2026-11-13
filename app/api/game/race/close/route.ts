import { NextRequest, NextResponse } from 'next/server'
import { comPrazo } from '@/lib/api/prazo'
import { getAdminFromRequest } from '@/lib/admin/gate'
import { cronAutorizado } from '@/lib/seguranca/cron'
import { lerJsonComTeto } from '@/lib/seguranca/freio'
import { fechar } from '@/lib/game/race/service'
import { PRAZO_MS, deps, falhaDaRota, json, resposta } from '@/lib/game/race/rota'
import { PISTA_PADRAO } from '@/lib/game/race/track'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

// POST { track? } -> { track, closedNow, closedAt, winners: [{ model, wallet, lapId, lapMs, prize }] }. O FECHAMENTO do campeonato:
// so' depois do fim da janela (race_championship.ends_at), o vencedor de cada modelo da DOG MOTORS (a melhor volta valida terminada
// dentro da janela; empate: a mais antiga) ganha race_prizes `pending_review`. Idempotente.
//
// PROTEGIDA, sem variavel nova: `Authorization: Bearer $CRON_SECRET` (o mesmo segredo dos crons; falha fechada sem ele) OU a sessao de
// um admin da sala de operacao (ADMIN_ADDRESSES, assinatura de menos de 24 h). Quem nao entra ve 404, nao 403: a rota nao se anuncia.
export async function POST(req: NextRequest) {
  const agora = Date.now()
  return comPrazo(
    async () => {
      if (!cronAutorizado(req) && !(await getAdminFromRequest(req))) return new NextResponse(null, { status: 404 })
      let track: unknown = PISTA_PADRAO
      if ((req.headers.get('content-length') ?? '0') !== '0') {
        const corpo = await lerJsonComTeto(req, 1024)
        if (!corpo.ok) return json({ error: corpo.status === 413 ? 'too_large' : 'invalid_json' }, corpo.status)
        const v = corpo.valor as { track?: unknown } | null
        if (v && typeof v === 'object' && v.track !== undefined) track = v.track
      }
      return resposta(await fechar(deps, track, agora))
    },
    { ms: PRAZO_MS.fechar, falha: falhaDaRota },
  )
}
