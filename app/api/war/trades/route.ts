import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ⚠️ O PLACAR NASCIA ZERADO (fundador fotografou): os contadores da guerra
// só viam trades chegados DEPOIS da aba abrir, e o DOG fica minutos em
// silêncio. Esta rota entrega os últimos trades públicos da Kraken pra
// SEMENTE do placar e da fita na abertura; o WebSocket segue somando por
// cima. Cache curto no servidor pra não bater na Kraken a cada visitante.
//
// ⚠️ CACHE NA BORDA TAMBEM (LIGAR.md 3.3): o cache em memoria acima vale por
// instancia de funcao, e cada instancia fria batia na Kraken de novo. Com
// `s-maxage=30` a borda da Vercel responde a batalha antiga e a nova sem
// acordar funcao nenhuma. Resposta vazia (Kraken fora ou lenta) fica so 5 s
// na borda e nao entra no cache em memoria: semente vazia nao pode durar.
const CACHE_OK = { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=30' } as const
const CACHE_VAZIO = { 'Cache-Control': 'public, s-maxage=5' } as const
const PRAZO_KRAKEN_MS = 6000

let cache: { at: number; body: unknown } | null = null

export async function GET() {
  if (cache && Date.now() - cache.at < 30_000) {
    return NextResponse.json(cache.body, { headers: CACHE_OK })
  }
  try {
    const r = await fetch('https://api.kraken.com/0/public/Trades?pair=DOGUSD', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      // prazo: Kraken pendurada nao pode segurar a funcao (regra de 26/08)
      signal: AbortSignal.timeout(PRAZO_KRAKEN_MS),
    })
    const j = await r.json()
    const chave = Object.keys(j?.result ?? {}).find((k) => k !== 'last')
    const bruto: Array<[string, string, number, string, string, string, number]> =
      chave ? j.result[chave] : []
    // Kraken: [price, volume, time, side(b/s), ordertype, misc, trade_id]
    const trades = bruto.slice(-200).map((t) => ({
      price: Number(t[0]),
      qty: Number(t[1]),
      at: Math.round(Number(t[2]) * 1000),
      side: t[3] === 'b' ? 'buy' : 'sell',
    }))
    const body = { trades }
    if (trades.length === 0) {
      return NextResponse.json(body, { headers: CACHE_VAZIO })
    }
    cache = { at: Date.now(), body }
    return NextResponse.json(body, { headers: CACHE_OK })
  } catch {
    return NextResponse.json({ trades: [] }, { status: 200, headers: CACHE_VAZIO })
  }
}
