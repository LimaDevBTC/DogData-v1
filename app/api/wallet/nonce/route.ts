import { NextRequest, NextResponse } from 'next/server'
import { redisClient } from '@/lib/upstash'
import { buildChallengeMessage, CHALLENGE_TTL_SECONDS } from '@/lib/wallet/message'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/wallet/nonce { address } → gera nonce de uso único (Upstash, TTL 5min)
// e devolve a mensagem-desafio canônica p/ a carteira assinar.
export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json()
    if (!address || typeof address !== 'string' || address.length < 8) {
      return NextResponse.json({ error: 'address inválido' }, { status: 400 })
    }
    const nonce = crypto.randomUUID()
    const issuedAt = new Date().toISOString()
    const message = buildChallengeMessage(address, nonce, issuedAt)
    await redisClient.set(
      `wnonce:${address}`,
      { nonce, message, issuedAt },
      { ex: CHALLENGE_TTL_SECONDS },
    )
    return NextResponse.json({ message, expiresIn: CHALLENGE_TTL_SECONDS })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'erro' }, { status: 500 })
  }
}
