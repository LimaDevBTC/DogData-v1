import { NextRequest, NextResponse } from 'next/server'
import { redisClient } from '@/lib/upstash'
import { buildChallengeMessage, CHALLENGE_TTL_SECONDS } from '@/lib/wallet/message'
import { chaveDesafio, COOKIE_DESAFIO, enderecoValido, novoVinculo, TETO_CORPO_NONCE, vinculoValido } from '@/lib/wallet/desafio'
import { lerJsonComTeto, passouDoTeto, respostaFreio } from '@/lib/seguranca/freio'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TETO_IP_MINUTO = 30
const SEM_CACHE = { 'Cache-Control': 'no-store' }

// POST /api/wallet/nonce { address } → gera nonce de uso único (Upstash, TTL 5min), preso a este
// navegador pelo cookie `dg_wchal` (lib/wallet/desafio.ts), e devolve a mensagem-desafio canônica
// p/ a carteira assinar. Endereço malformado nem chega ao Redis.
export async function POST(req: NextRequest) {
  try {
    if (await passouDoTeto(req, 'wnonce', TETO_IP_MINUTO)) return respostaFreio()
    const corpo = await lerJsonComTeto(req, TETO_CORPO_NONCE)
    if (!corpo.ok) return NextResponse.json({ error: 'Invalid request.' }, { status: corpo.status, headers: SEM_CACHE })
    const address = (corpo.valor as { address?: unknown } | null)?.address
    if (!enderecoValido(address)) {
      return NextResponse.json({ error: 'Invalid address.' }, { status: 400, headers: SEM_CACHE })
    }
    const atual = req.cookies.get(COOKIE_DESAFIO)?.value
    const vinculo = vinculoValido(atual) ? atual : novoVinculo()
    const nonce = crypto.randomUUID()
    const issuedAt = new Date().toISOString()
    const message = buildChallengeMessage(address, nonce, issuedAt)
    await redisClient.set(
      chaveDesafio(address, vinculo),
      { nonce, message, issuedAt },
      { ex: CHALLENGE_TTL_SECONDS },
    )
    const resp = NextResponse.json({ message, expiresIn: CHALLENGE_TTL_SECONDS }, { headers: SEM_CACHE })
    resp.cookies.set(COOKIE_DESAFIO, vinculo, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: CHALLENGE_TTL_SECONDS,
    })
    return resp
  } catch (e) {
    console.error('[wallet/nonce]', (e as Error)?.message)
    return NextResponse.json({ error: 'Could not issue the sign-in challenge.' }, { status: 500, headers: SEM_CACHE })
  }
}
