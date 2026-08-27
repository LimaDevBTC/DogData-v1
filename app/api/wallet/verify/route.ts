import { NextRequest, NextResponse } from 'next/server'
import { redisClient } from '@/lib/upstash'
import { supabase } from '@/lib/supabase'
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
    const { address, signature, protocol, publicKey, walletId, visitor_id, session_id } = body as {
      address: string
      signature: string
      protocol: SignatureProtocol
      publicKey?: string
      walletId?: WalletId
      visitor_id?: string
      session_id?: string
    }
    if (!address || !signature || !protocol) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    const stored = (await redisClient.get(`wnonce:${address}`)) as StoredNonce | null
    if (!stored?.message) {
      return NextResponse.json({ error: 'This challenge expired. Start the signature again.' }, { status: 400 })
    }

    const result = verifyOwnership({
      address,
      message: stored.message,
      signature,
      protocol,
      publicKey,
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.reason || 'Invalid signature.' }, { status: 401 })
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

    // ── ponte analytics: navegador ↔ cadeia ────────────────────────────────
    // Escrita SÓ aqui, depois da assinatura conferir. É o único lugar do site
    // onde se sabe, com prova, que este navegador controla este endereço — e é
    // isso que permite atribuir uma doação on-chain de 10k DOG à campanha que
    // trouxe a pessoa. Sem prova o vínculo seria autodeclarado e a atribuição
    // valeria nada.
    //
    // Falha aqui NUNCA derruba o login: a pessoa está entrando na cidade, e um
    // registro de telemetria não pode ser o que a impede.
    if (visitor_id) {
      try {
        await supabase.from('analytics_identity').upsert(
          {
            visitor_id: visitor_id.slice(0, 64),
            address,
            session_id: session_id?.slice(0, 64) ?? null,
            wallet_id: walletId ?? null,
            last_linked_at: new Date().toISOString(),
          },
          { onConflict: 'visitor_id,address', ignoreDuplicates: false },
        )
      } catch (e) {
        console.error('[wallet/verify] vinculo analytics falhou:', (e as Error)?.message)
      }
    }

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
    return NextResponse.json({ error: e?.message || 'Ownership verification failed.' }, { status: 500 })
  }
}
