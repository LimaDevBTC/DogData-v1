import { NextRequest, NextResponse } from 'next/server'
import { readLedger } from '@/lib/radiola/ledger'
import { RADIOLA } from '@/lib/radiola/catalog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/radiola/ledger   (admin — costura de handoff pro Radiola)
 *
 * Devolve, por endereço bc1p, os segundos de escuta verificada acumulados. O
 * Radiola lê isto e distribui o Rune L1 RADIOLA na proporção que quiser — o
 * DogCity nunca toca no supply. Ver RADIOLA-INTEGRATION.md.
 *
 * Auth: header `x-admin-key` ou ?key=, comparado a RADIOLA_ADMIN_KEY (env).
 */
export async function GET(req: NextRequest) {
  const expected = process.env.RADIOLA_ADMIN_KEY
  const provided = req.headers.get('x-admin-key') || new URL(req.url).searchParams.get('key')
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const ledger = await readLedger()
    return NextResponse.json({
      runeSymbol: RADIOLA.runeSymbol,
      count: ledger.length,
      totalSeconds: ledger.reduce((s, r) => s + r.seconds, 0),
      generatedAt: new Date().toISOString(),
      ledger,
    })
  } catch {
    return NextResponse.json({ error: 'store-unavailable' }, { status: 503 })
  }
}
