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

// GET /api/profile            perfil da sessao atual
// GET /api/profile?address=x   parte publica de qualquer endereco
//
// A resposta junta o que tres tabelas sabem daquele endereco: o handle
// (dogcity_profiles), o lote na cidade (dogcity_lots) e quantas vezes ele ja
// falou na praca (dogcity_chat). `verified` so e true para o endereco da
// sessao: os outros campos sao publicos, a posse nao.
export async function GET(req: NextRequest) {
  const session = await getSession(req)
  const sessionAddress = session?.address?.toLowerCase() ?? null
  const asked = req.nextUrl.searchParams.get('address')?.trim() ?? ''
  const address = (asked || sessionAddress || '').toLowerCase()

  if (!address) {
    return NextResponse.json({
      address: null, verified: false, handle: null, claimed_at: null,
      avatar_inscription_id: null, avatar_number: null,
      lot: null, chat_count: 0, wallet_id: null,
    })
  }

  const [profileRes, lotRes, chatRes] = await Promise.all([
    supabase
      .from('dogcity_profiles')
      .select('handle, created_at, avatar_inscription_id, avatar_content_type, avatar_number')
      .eq('address', address)
      .maybeSingle(),
    // O registro da cidade grava o endereco como a carteira o escreve; os
    // bech32 ja sao minusculos, mas um base58 nao e, entao pergunta pelas duas
    // formas em vez de assumir.
    supabase.from('dogcity_lots')
      .select('street, number, zone, district, kind, prestige, height_tier, last_balance, utxo_count, age_score, state')
      .in('address', Array.from(new Set([address, asked].filter(Boolean))))
      .limit(1),
    supabase.from('dogcity_chat').select('id', { count: 'exact', head: true }).eq('address', address),
  ])

  if (profileRes.error) {
    console.error('[api/profile GET]', profileRes.error.message)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
  // Lote e chat sao enfeite do perfil: se o registro da cidade estiver fora do
  // ar a pagina ainda tem que abrir com a identidade, entao o erro vira null.
  if (lotRes.error) console.error('[api/profile GET lot]', lotRes.error.message)
  if (chatRes.error) console.error('[api/profile GET chat]', chatRes.error.message)

  return NextResponse.json({
    address,
    verified: !!sessionAddress && sessionAddress === address,
    handle: profileRes.data?.handle ?? null,
    claimed_at: profileRes.data?.created_at ?? null,
    avatar_inscription_id: profileRes.data?.avatar_inscription_id ?? null,
    avatar_number: profileRes.data?.avatar_number ?? null,
    lot: lotRes.error ? null : lotRes.data?.[0] ?? null,
    chat_count: chatRes.count ?? 0,
    wallet_id: sessionAddress === address ? session?.walletId ?? null : null,
  })
}

// POST /api/profile {handle} → cria o handle da carteira logada (upsert por
// address, entao reenviar o mesmo endereco troca o handle em vez de duplicar).
export async function POST(req: NextRequest) {
  const session = await getSession(req)
  if (!session) {
    return NextResponse.json({ error: 'Ownership not verified.' }, { status: 401 })
  }

  let body: { handle?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body.' }, { status: 422 })
  }

  const validation = validateHandle(body.handle ?? '')
  if (!validation.ok || !validation.handle) {
    return NextResponse.json({ error: validation.reason ?? 'invalid_handle' }, { status: 422 })
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
    return NextResponse.json({ error: 'taken' }, { status: 409 })
  }

  const { error: upsertError } = await supabase
    .from('dogcity_profiles')
    .upsert({ address, handle, updated_at: new Date().toISOString() }, { onConflict: 'address' })

  if (upsertError) {
    // 23505 = unique_violation: outra requisicao ganhou a corrida pelo mesmo handle.
    if (upsertError.code === '23505') {
      return NextResponse.json({ error: 'taken' }, { status: 409 })
    }
    console.error('[api/profile POST upsert]', upsertError.message)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }

  return NextResponse.json({ address, verified: true, handle })
}
