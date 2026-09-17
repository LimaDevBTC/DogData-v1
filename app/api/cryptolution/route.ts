import { NextResponse } from "next/server"
import { fetchBroadcast } from "@/lib/cryptolution/feed"

// Lê o feed no Node (fetch + regex de XML), nunca no edge.
export const runtime = "nodejs"
// A camada de fetch em feed.ts já revalida a cada 30 min; alinhar a rota evita
// que a resposta seja tratada como sempre-dinâmica e refaça a leitura à toa.
export const revalidate = 1800

/**
 * GET /api/cryptolution
 *
 * O último punhado de transmissões da Cryptolution House, mais novo primeiro,
 * já normalizado pra chapa `sections/broadcast.tsx`. Sem auth (conteúdo
 * público), sem API key. Nunca 5xx: fetchBroadcast() cai no retrato embutido em
 * qualquer falha, então a chapa sempre recebe algo real pra mostrar.
 */
export async function GET() {
  const feed = await fetchBroadcast(6)
  return NextResponse.json(feed, {
    headers: {
      // servido pela CDN por 30 min; durante 1 dia depois disso pode servir o
      // retrato antigo enquanto revalida em segundo plano
      "cache-control": "public, s-maxage=1800, stale-while-revalidate=86400",
    },
  })
}
