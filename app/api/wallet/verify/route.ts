import { NextRequest, NextResponse } from 'next/server'
import { redisClient } from '@/lib/upstash'
import { supabase } from '@/lib/supabase'
import { verifyOwnership } from '@/lib/wallet/verify'
import type { SignatureProtocol, WalletId } from '@/lib/wallet/types'
import { linkOnVerify } from '@/lib/referral/link'
import { supabaseReferralStore } from '@/lib/referral/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SESSION_TTL = 60 * 60 * 24 * 30 // 30 dias
// teto do passo do referral dentro do verify: banco lento não pode segurar o login (incidente de IO de 26/08)
const REFERRAL_BUDGET_MS = 3000

interface StoredNonce {
  nonce: string
  message: string
  issuedAt: string
}

// POST /api/wallet/verify { address, signature, protocol, publicKey?, walletId, ref? }
// Verifica a assinatura contra o nonce (uso único), queima o nonce e cria sessão httpOnly.
//
// CAMPO `ref` (programa de referral, 25/10/2026, fase 1: só contar). Opcional. É o `@handle` (ou o
// handle puro) de quem indicou, o que veio em `?ref=@handle` do link e o navegador guardou por 30 dias.
// Vai no CORPO, NUNCA por cookie: o jogo (play.dogcity.space) e o mint (mint.dogcity.space) chamam
// esta mesma rota pelo rewrite de /api e não dividem cookie com o DogData. Quem quiser repassar o ref
// guarda o `?ref=` do link na própria origem e manda `ref` aqui. Contrato completo: referral.md.
// O servidor SÓ vincula a carteira que verifica pela PRIMEIRA vez; ref inválido, desconhecido ou
// de si mesmo é ignorado em silêncio. A resposta ganha `referral: { linked }` só quando `ref` veio.
// Falha do referral NUNCA derruba o verify (lib/referral/link.ts nunca lança; há prazo aqui também).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { address, signature, protocol, publicKey, walletId, visitor_id, session_id, ref } = body as {
      address: string
      signature: string
      protocol: SignatureProtocol
      publicKey?: string
      walletId?: WalletId
      visitor_id?: string
      session_id?: string
      ref?: unknown
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

    // ── referral: vínculo carteira → indicador ─────────────────────────────
    // ANTES da ponte de analytics de propósito: a ponte também conta como sinal de "esta carteira já
    // verificou antes" (lib/referral/store.ts), e a gravação dela, logo abaixo, apagaria esse sinal.
    // O sessionAddress vem do cookie que o navegador JÁ trazia (a sessão nova só nasce na resposta).
    let referral: { linked: boolean } | undefined
    try {
      const hasRef = ref !== undefined && ref !== null && ref !== ''
      // a sessão anterior só interessa quando veio ref (sem ref nada é vinculado): poupa uma leitura no Redis
      const prior = async () => {
        const sidOld = hasRef ? req.cookies.get('dg_wallet')?.value : undefined
        if (!sidOld) return null
        const old = (await redisClient.get(`wsess:${sidOld}`)) as { address?: string } | null
        return old?.address ?? null
      }
      let timer: ReturnType<typeof setTimeout> | undefined
      const outcome = await Promise.race([
        prior().catch(() => null).then((priorSessionAddress) =>
          linkOnVerify({ address, ref, priorSessionAddress }, supabaseReferralStore)),
        new Promise<{ linked: false }>((resolve) => { timer = setTimeout(() => resolve({ linked: false }), REFERRAL_BUDGET_MS) }),
      ])
      if (timer) clearTimeout(timer)
      if (hasRef) referral = { linked: outcome.linked }
    } catch (e) {
      console.error('[wallet/verify] referral falhou:', (e as Error)?.message)
    }

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

    const resp = NextResponse.json({ ok: true, address, verifiedAt, ...(referral ? { referral } : {}) })
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
