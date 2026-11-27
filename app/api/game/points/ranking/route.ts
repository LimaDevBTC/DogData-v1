/**
 * RANKING DOS DC POINTS (27/11/2026; decisão do fundador): quem mais GANHOU pontos, em três quadros.
 *
 * GET /api/game/points/ranking?board=total|login|ambassador&period=all|week&limit=100[&me=1]
 *   -> 200 { board, period, updatedAt, total, rows: [{ rank, handle|null, wallet (abreviada), walletPath|null, avatar|null, points }],
 *            me: { rank, points } | null }
 *
 * PÚBLICA e só leitura. Soma pontos GANHOS (nunca o saldo: gastar não derruba ninguém). Total = tudo que a carteira já ganhou,
 * inclusive a migração do sistema antigo e os herdados ainda não migrados; Login = check-in; Ambassador = indicações;
 * semana = últimos 7 dias de jogo (a migração não conta). A regra completa e a tabela de origens: supabase/migrations/050 e
 * lib/game/points/ranking.ts. Nunca devolve o endereço inteiro de quem tem handle.
 *
 * `me` só com `me=1` E sessão assinada (cookie dg_wallet); sem sessão é null. Essa resposta é PRIVADA (cache só do navegador,
 * 30 s); sem `me=1` a rota nem lê o cookie e a resposta é pública (CDN 60 s). Este processo guarda a lista 60 s por quadro
 * (rajada de cache vazio não vira rajada no banco). Freio por IP: 60 por minuto. Prazo de 6 s: estourou, 503 com cache curto.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { comPrazo, falhaPublica } from '@/lib/api/prazo'
import { passouDoTeto, respostaFreio } from '@/lib/seguranca/freio'
import { walletOf } from '@/lib/game/points/http'
import { parseRankingQuery, toPublicRanking, type PublicRanking } from '@/lib/game/points/ranking'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 10

const MEMO_MS = 60_000
const memo = new Map<string, { at: number; raw: unknown }>()

export async function GET(req: NextRequest) {
  if (await passouDoTeto(req, 'dc-ranking', 60)) return respostaFreio()
  const q = parseRankingQuery(req.nextUrl.searchParams)
  return comPrazo(
    async (signal) => {
      // a carteira só é lida quando a tela pede `me=1`; qualquer falha da sessão vira "sem sessão" (a lista sai igual)
      const wallet = q.me ? await walletOf(req).catch(() => null) : null
      const key = `${q.board}:${q.period}:${q.limit}`
      let hit = memo.get(key)
      if (!hit || Date.now() - hit.at > MEMO_MS) {
        const { data, error } = await supabase
          .rpc('dc_points_ranking', { p_board: q.board, p_period: q.period, p_limit: q.limit, p_wallet: null })
          .abortSignal(signal)
        if (error) throw new Error(`dc_points_ranking: ${error.message || 'database error'}`)
        hit = { at: Date.now(), raw: data }
        memo.set(key, hit)
        if (memo.size > 12) memo.delete(memo.keys().next().value as string)
      }
      const body: PublicRanking = toPublicRanking(hit.raw, q.board, q.period, false)
      if (wallet) {
        const { data, error } = await supabase
          .rpc('dc_points_ranking', { p_board: q.board, p_period: q.period, p_limit: 0, p_wallet: wallet })
          .abortSignal(signal)
        if (error) throw new Error(`dc_points_ranking: ${error.message || 'database error'}`)
        body.me = toPublicRanking(data, q.board, q.period, true).me
      }
      return NextResponse.json(body, {
        headers: { 'Cache-Control': q.me ? 'private, max-age=30' : 'public, max-age=60, s-maxage=60, stale-while-revalidate=120' },
      })
    },
    { ms: 6000, falha: () => falhaPublica(15) },
  )
}
