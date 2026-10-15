import { NextResponse } from 'next/server'
import { comPrazo, falhaPublica } from '@/lib/api/prazo'
import { INTERVALO_MS, MAX_GRAFEMAS } from '@/lib/chat/nearby'
import { chavePublica } from '@/lib/chat/nearby-key'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/chat/nearby/key → a chave PUBLICA que confere as falas do chat de proximidade do jogo
// (app/api/chat/nearby). Publica e sem cookie: a borda guarda 5 min.

export async function GET() {
  return comPrazo(
    async () => {
      const key = await chavePublica()
      return NextResponse.json(
        { v: 1, key, maxChars: MAX_GRAFEMAS, intervalMs: INTERVALO_MS },
        { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400' } },
      )
    },
    { ms: 4000, falha: () => falhaPublica() },
  )
}
