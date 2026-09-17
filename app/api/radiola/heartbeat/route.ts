import { NextRequest, NextResponse } from 'next/server'
import { readSessionAddress, tooFast, creditListening } from '@/lib/radiola/ledger'
import { RADIOLA } from '@/lib/radiola/catalog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/radiola/heartbeat  { seconds }
 *
 * Registra escuta verificada do endereço da sessão. Anti-abuso:
 *  - exige sessão de posse provada (cookie dg_wallet → wsess);
 *  - um heartbeat por intervalo (freio por endereço);
 *  - credita no máximo o intervalo do heartbeat (nunca confia no cliente);
 *  - teto diário por endereço (dentro de creditListening).
 *
 * "Ganho" aqui é ESCUTA CONTADA, não Rune recebido — o Rune L1 é distribuído
 * pelo Radiola lendo o razão (/api/radiola/ledger).
 */
export async function POST(req: NextRequest) {
  const sessionAddress = await readSessionAddress(req)
  if (!sessionAddress) {
    return NextResponse.json({ error: 'Ownership not verified.' }, { status: 401 })
  }
  // ⚠️ NUNCA minusculizar: bech32 (bc1p…) já é minúsculo, mas endereço legado
  // base58 é case-sensitive — minusculizar corromperia o endereço que o Radiola
  // usa pra ENTREGAR o Rune. A chave do razão é o endereço como assinado.
  const address = sessionAddress

  // Folga de 2s pro jitter de rede; abaixo disso é replay/aceleração.
  if (await tooFast(`radiola:${address}`, RADIOLA.heartbeatSeconds - 2)) {
    return NextResponse.json({ error: 'Too soon.' }, { status: 429 })
  }

  let body: { seconds?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body.' }, { status: 422 })
  }

  const claimed = Number(body.seconds)
  if (!Number.isFinite(claimed) || claimed <= 0) {
    return NextResponse.json({ error: 'Nothing to credit.' }, { status: 422 })
  }

  try {
    const r = await creditListening(address, claimed)
    return NextResponse.json({
      ok: true,
      credited: r.credited,
      totalSeconds: r.totalSeconds,
      usedToday: r.usedToday,
      cappedForToday: r.cappedForToday,
    })
  } catch {
    // Redis fora do ar não pode quebrar o player: farm apenas não acumula agora.
    return NextResponse.json({ ok: false, credited: 0, error: 'store-unavailable' })
  }
}
