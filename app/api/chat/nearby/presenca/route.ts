import { NextRequest, NextResponse } from 'next/server'
import { comPrazo } from '@/lib/api/prazo'
import { getWalletSession } from '@/lib/identity/session'
import { lerCaixa } from '@/lib/chat/nearby'
import { assinarFala } from '@/lib/chat/nearby-key'
import { erro, estourouIp, nomeDaSessao, SEM_CACHE, sessaoDe, VINCULO_ID_S, vincularId } from '@/lib/chat/nearby-sessao'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/chat/nearby/presenca {id} → o carimbo de identidade que o jogo poe na presence do Realtime (auditoria de 05/11/2026).
//
// O broadcast e a presence do Supabase nao autenticam ninguem: quem abre o console escreve `nome: '@lima'` e anda pela cidade com
// o nome dos outros. Quem le so' mostra o @handle e so' aceita o endereco se vierem neste envelope, assinado com a MESMA chave das
// falas (lib/chat/nearby-key.ts). O nome e o endereco saem da sessao da carteira provada, nunca do corpo; o id de rede fica preso ao
// cookie dg_near como no chat, e vai dentro do que e' assinado: o envelope nao serve em outro id.
//
// Nao vira fala por engano nem o contrario: `k: 'presenca'` nao passa em lerFala (sem mid, at, t...) e uma fala nao tem `k`.
// O que isto NAO resolve: a pose continua sem assinatura, e quem copia o id e o envelope de um jogador online pode publicar pose
// nesse id. Fechar isso pede canal privado (Supabase Realtime Authorization) ou servidor de posicao.
//
// Respostas: 200 {ass: {d, s}} · 400 {code: corpo} · 401 {code: sessao} · 409 {code: id} · 429 · 503.

const TETO_IP_MINUTO = 60
const PRAZO_MS = 4000

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
      if (await estourouIp(req, 'ipp', TETO_IP_MINUTO)) return sessao.comCookie(erro(429, 'ritmo', { retryMs: 30_000 }, { 'Retry-After': '30' }))
      const carteira = await getWalletSession(req)
      if (!carteira) return sessao.comCookie(erro(401, 'sessao'))
      if (!(await vincularId(pedido.id, sessao.id))) return sessao.comCookie(erro(409, 'id'))
      const nome = await nomeDaSessao(req, signal)
      const d = JSON.stringify({
        k: 'presenca',
        v: 1,
        id: pedido.id,
        n: nome,
        // minusculo, como /api/profile devolve e a presence sempre levou
        e: carteira.address.toLowerCase(),
        x: Date.now() + VINCULO_ID_S * 1000,
      })
      const ass = { d, s: await assinarFala(d) }
      return sessao.comCookie(NextResponse.json({ ass }, { headers: SEM_CACHE }))
    },
    { ms: PRAZO_MS, falha: () => erro(503, 'indisponivel') },
  )
}
