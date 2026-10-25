import { NextResponse } from 'next/server'
import { comPrazo, falhaPublica } from '@/lib/api/prazo'
import { readBoardRows } from '@/lib/referral/db'
import { toPublicBoard, type PublicBoard } from '@/lib/referral/board'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/referral/board: o placar PUBLICO do programa de referral (fase 1: so contar).
//
// ⚠️ BARATO DE PROPOSITO (incidente de IO de 26/08). Esta rota NAO conta nada na hora: le UMA funcao
// SQL (referral_board) que agrega tres tabelas pequenas, e quem enche a conta de cada carteira
// indicada e o cron /api/cron/referrals. Alem disso:
//   * a CDN guarda a resposta 5 min (s-maxage) e serve a velha por mais 10 enquanto renova;
//   * este processo guarda 60 s, para uma rajada de cache vazio nao virar rajada no banco;
//   * prazo de 6 s: estourou, 503 rapido com cache curto na borda.
// Mostra @handle (ou endereco abreviado) e contagens. Nunca o endereco inteiro, nunca as carteiras indicadas.
const TOP = 100
const MEMO_MS = 60_000
let memo: { at: number; body: PublicBoard } | null = null

export async function GET() {
  if (memo && Date.now() - memo.at < MEMO_MS) return answer(memo.body)
  return comPrazo(
    async () => {
      const body = toPublicBoard(await readBoardRows(TOP))
      memo = { at: Date.now(), body }
      return answer(body)
    },
    { ms: 6000, falha: () => falhaPublica(30) },
  )
}

function answer(body: PublicBoard) {
  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  })
}
