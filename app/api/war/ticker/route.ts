import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// O quadro de 24h da batalha vem do Ticker público da Kraken. O browser fala
// com o WebSocket dela direto (book e trades), mas o REST fica atrás deste
// proxy porque CORS de terceiro não é promessa; o cache de 60s segura a cota.
export async function GET() {
  try {
    const r = await fetch('https://api.kraken.com/0/public/Ticker?pair=DOGUSD', {
      next: { revalidate: 60 },
    })
    const j = await r.json()
    const t = j?.result?.DOGUSD
    if (!t) throw new Error('sem DOGUSD no ticker')
    return NextResponse.json(
      {
        last: Number(t.c?.[0]),
        low24: Number(t.l?.[1]),
        high24: Number(t.h?.[1]),
        vwap24: Number(t.p?.[1]),
        volume24: Number(t.v?.[1]),
        open: Number(t.o),
      },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } },
    )
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'ticker falhou' }, { status: 200 })
  }
}
