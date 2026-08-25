import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ⚠️ O PLACAR NASCIA ZERADO (fundador fotografou): os contadores da guerra
// só viam trades chegados DEPOIS da aba abrir, e o DOG fica minutos em
// silêncio. Esta rota entrega os últimos trades públicos da Kraken pra
// SEMENTE do placar e da fita na abertura; o WebSocket segue somando por
// cima. Cache curto no servidor pra não bater na Kraken a cada visitante.
let cache: { at: number; body: unknown } | null = null

export async function GET() {
  if (cache && Date.now() - cache.at < 30_000) {
    return NextResponse.json(cache.body)
  }
  try {
    const r = await fetch('https://api.kraken.com/0/public/Trades?pair=DOGUSD', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
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
    cache = { at: Date.now(), body }
    return NextResponse.json(body)
  } catch {
    return NextResponse.json({ trades: [] }, { status: 200 })
  }
}
