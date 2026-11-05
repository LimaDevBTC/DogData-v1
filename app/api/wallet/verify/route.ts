import { NextRequest, NextResponse } from 'next/server'
import { redisClient } from '@/lib/upstash'
import { supabase } from '@/lib/supabase'
import { verifyOwnership } from '@/lib/wallet/verify'
import { chaveDesafio, COOKIE_DESAFIO, lerPedidoVerify, TETO_CORPO_VERIFY, vinculoValido } from '@/lib/wallet/desafio'
import { linkOnVerify } from '@/lib/referral/link'
import { supabaseReferralStore } from '@/lib/referral/store'
import { lerJsonComTeto, passouDoTeto, respostaFreio } from '@/lib/seguranca/freio'
import { enderecoCurto, eventoSeguranca } from '@/lib/seguranca/evento'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TETO_IP_MINUTO = 30
const SEM_CACHE = { 'Cache-Control': 'no-store' }
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
    if (await passouDoTeto(req, 'wverify', TETO_IP_MINUTO)) return respostaFreio()
    const corpo = await lerJsonComTeto(req, TETO_CORPO_VERIFY)
    if (!corpo.ok) return NextResponse.json({ error: 'Invalid request.' }, { status: corpo.status, headers: SEM_CACHE })
    const pedido = lerPedidoVerify(corpo.valor)
    if (!pedido) {
      eventoSeguranca('pedido_invalido', req)
      return NextResponse.json({ error: 'Missing or invalid fields.' }, { status: 400, headers: SEM_CACHE })
    }
    const { address, signature, protocol, publicKey, walletId, visitorId: visitor_id, sessionId: session_id, ref } = pedido

    // O desafio é deste navegador (cookie dg_wchal, lib/wallet/desafio.ts). Sem o cookie não há o que conferir.
    const vinculo = req.cookies.get(COOKIE_DESAFIO)?.value
    const chave = vinculoValido(vinculo) ? chaveDesafio(address, vinculo) : null
    const stored = chave ? ((await redisClient.get(chave)) as StoredNonce | null) : null
    if (!chave || !stored?.message) {
      eventoSeguranca('auth_desafio_ausente', req, { carteira: enderecoCurto(address) })
      return NextResponse.json({ error: 'This challenge expired. Start the signature again.' }, { status: 400, headers: SEM_CACHE })
    }

    const result = verifyOwnership({
      address,
      message: stored.message,
      signature,
      protocol,
      publicKey,
    })
    if (!result.ok) {
      eventoSeguranca('auth_assinatura_invalida', req, { carteira: enderecoCurto(address), protocolo: protocol })
      return NextResponse.json({ error: result.reason || 'Invalid signature.' }, { status: 401, headers: SEM_CACHE })
    }

    // Nonce é de uso único → queima, e o DEL é quem decide: de duas chamadas iguais ao mesmo tempo, só a
    // que apagou a chave segue. Conferir antes e apagar depois deixava as duas abrirem sessão.
    if ((await redisClient.del(chave)) !== 1) {
      eventoSeguranca('auth_desafio_repetido', req, { carteira: enderecoCurto(address) })
      return NextResponse.json({ error: 'This challenge expired. Start the signature again.' }, { status: 400, headers: SEM_CACHE })
    }

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
            visitor_id,
            address,
            session_id,
            wallet_id: walletId ?? null,
            last_linked_at: new Date().toISOString(),
          },
          { onConflict: 'visitor_id,address', ignoreDuplicates: false },
        )
      } catch (e) {
        console.error('[wallet/verify] vinculo analytics falhou:', (e as Error)?.message)
      }
    }

    // A sessão anterior deste navegador acaba aqui: logar de novo não deixa uma sessão velha viva por 30 dias.
    const sidAnterior = req.cookies.get('dg_wallet')?.value
    if (sidAnterior && sidAnterior.length <= 100) {
      await redisClient.del(`wsess:${sidAnterior}`).catch(() => undefined)
    }

    const resp = NextResponse.json({ ok: true, address, verifiedAt, ...(referral ? { referral } : {}) }, { headers: SEM_CACHE })
    resp.cookies.set('dg_wallet', sid, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL,
    })
    resp.cookies.set(COOKIE_DESAFIO, '', { httpOnly: true, path: '/', maxAge: 0 })
    return resp
  } catch (e) {
    // a mensagem crua pode trazer detalhe de infraestrutura: ela fica no log, não na resposta
    console.error('[wallet/verify]', (e as Error)?.message)
    return NextResponse.json({ error: 'Ownership verification failed.' }, { status: 500, headers: SEM_CACHE })
  }
}
