import { NextRequest, NextResponse } from 'next/server'
import { redisClient } from '@/lib/upstash'
import { supabase } from '@/lib/supabase'
import { validateHandle } from '@/lib/identity/handle'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface WalletSession {
  address: string
  walletId: string | null
  verifiedAt: string
}

// Mesmo padrao de leitura de app/api/wallet/session/route.ts: cookie dg_wallet
// aponta pra wsess:<sid> no Redis. A sessao so existe depois que a assinatura
// bateu em /api/wallet/verify, entao presenca com address e a propria prova
// de verified, nao ha um campo "verified" separado gravado no Redis.
async function getSession(req: NextRequest): Promise<WalletSession | null> {
  const sid = req.cookies.get('dg_wallet')?.value
  if (!sid) return null
  const session = await redisClient.get<WalletSession>(`wsess:${sid}`)
  return session?.address ? session : null
}

// GET /api/profile → {address, verified, handle}. Sem sessao, verified false
// e handle null (nao ha endereco pra consultar).
export async function GET(req: NextRequest) {
  const session = await getSession(req)
  if (!session) {
    return NextResponse.json({ address: null, verified: false, handle: null })
  }

  const address = session.address.toLowerCase()
  const { data, error } = await supabase
    .from('dogcity_profiles')
    .select('handle')
    .eq('address', address)
    .maybeSingle()

  if (error) {
    console.error('[api/profile GET]', error.message)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }

  return NextResponse.json({ address, verified: true, handle: data?.handle ?? null })
}

// POST /api/profile {handle} → cria o handle da carteira logada (upsert por
// address, entao reenviar o mesmo endereco troca o handle em vez de duplicar).
export async function POST(req: NextRequest) {
  const session = await getSession(req)
  if (!session) {
    return NextResponse.json({ error: 'sessão não verificada' }, { status: 401 })
  }

  let body: { handle?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'corpo inválido' }, { status: 422 })
  }

  const validation = validateHandle(body.handle ?? '')
  if (!validation.ok || !validation.handle) {
    return NextResponse.json({ error: validation.reason ?? 'handle inválido' }, { status: 422 })
  }

  const address = session.address.toLowerCase()
  const handle = validation.handle

  // Confere duplicata antes do upsert pra devolver 409 legivel. O unique
  // constraint da tabela e o guarda de verdade (corrida entre duas
  // requisicoes concorrentes), essa checagem so evita o caso comum.
  const { data: taken, error: lookupError } = await supabase
    .from('dogcity_profiles')
    .select('address')
    .eq('handle', handle)
    .neq('address', address)
    .maybeSingle()

  if (lookupError) {
    console.error('[api/profile POST lookup]', lookupError.message)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
  if (taken) {
    return NextResponse.json({ error: 'handle já em uso' }, { status: 409 })
  }

  const { error: upsertError } = await supabase
    .from('dogcity_profiles')
    .upsert({ address, handle, updated_at: new Date().toISOString() }, { onConflict: 'address' })

  if (upsertError) {
    // 23505 = unique_violation: outra requisicao ganhou a corrida pelo mesmo handle.
    if (upsertError.code === '23505') {
      return NextResponse.json({ error: 'handle já em uso' }, { status: 409 })
    }
    console.error('[api/profile POST upsert]', upsertError.message)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }

  return NextResponse.json({ address, verified: true, handle })
}
