import { NextRequest, NextResponse } from 'next/server'
import { redisClient } from '@/lib/upstash'
import { verifyOwnership } from '@/lib/wallet/verify'
import type { SignatureProtocol, WalletId } from '@/lib/wallet/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SESSION_TTL = 60 * 60 * 24 * 30 // 30 dias

interface StoredNonce {
  nonce: string
  message: string
  issuedAt: string
}

// POST /api/wallet/verify { address, signature, protocol, publicKey?, walletId }
// Verifica a assinatura contra o nonce (uso único), queima o nonce e cria sessão httpOnly.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { address, signature, protocol, publicKey, walletId } = body as {
      address: string
      signature: string
      protocol: SignatureProtocol
      publicKey?: string
      walletId?: WalletId
    }
    if (!address || !signature || !protocol) {
      return NextResponse.json({ error: 'campos obrigatórios faltando' }, { status: 400 })
    }

    const stored = (await redisClient.get(`wnonce:${address}`)) as StoredNonce | null
    if (!stored?.message) {
      return NextResponse.json({ error: 'nonce expirado ou inexistente' }, { status: 400 })
    }

    const result = verifyOwnership({
      address,
      message: stored.message,
      signature,
      protocol,
      publicKey,
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.reason || 'assinatura inválida' }, { status: 401 })
    }

    // Nonce é de uso único → queima.
    await redisClient.del(`wnonce:${address}`)

    const sid = crypto.randomUUID()
    const verifiedAt = new Date().toISOString()
    await redisClient.set(
      `wsess:${sid}`,
      { address, walletId: walletId ?? null, verifiedAt },
      { ex: SESSION_TTL },
    )

    const resp = NextResponse.json({ ok: true, address, verifiedAt })
    resp.cookies.set('dg_wallet', sid, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL,
    })
    return resp
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'erro' }, { status: 500 })
  }
}
