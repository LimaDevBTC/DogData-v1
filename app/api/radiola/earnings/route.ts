import { NextRequest, NextResponse } from 'next/server'
import { readSessionAddress, readListening } from '@/lib/radiola/ledger'
import { RADIOLA } from '@/lib/radiola/catalog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/radiola/earnings
 * Escuta acumulada do endereço da sessão, pro player mostrar "farmando X".
 * Sem sessão → responde zero (não é erro; o player só não mostra o contador).
 */
export async function GET(req: NextRequest) {
  const sessionAddress = await readSessionAddress(req)
  if (!sessionAddress) {
    return NextResponse.json({ connected: false, totalSeconds: 0, runeSymbol: RADIOLA.runeSymbol })
  }
  // Mesma chave do heartbeat: o endereço como assinado, sem minusculizar
  // (base58 legado é case-sensitive).
  const address = sessionAddress
  try {
    const totalSeconds = await readListening(address)
    return NextResponse.json({ connected: true, address, totalSeconds, runeSymbol: RADIOLA.runeSymbol })
  } catch {
    return NextResponse.json({ connected: true, totalSeconds: 0, runeSymbol: RADIOLA.runeSymbol })
  }
}
