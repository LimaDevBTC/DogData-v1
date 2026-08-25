import { NextRequest, NextResponse } from 'next/server'
import { redisClient } from '@/lib/upstash'
import { supabase } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// app/api/city/ e gitignored (nao vai pro clone que a Vercel builda), por
// isso o chat da praca mora aqui em app/api/chat/ em vez de app/api/city/chat/.

const RATE_LIMIT_SECONDS = 3
const HISTORY_SIZE = 50
const MAX_TEXT_LENGTH = 280

interface WalletSession {
  address: string
  walletId: string | null
  verifiedAt: string
}

// Mesmo padrao de app/api/wallet/session/route.ts e de app/api/profile/route.ts.
async function getSession(req: NextRequest): Promise<WalletSession | null> {
  const sid = req.cookies.get('dg_wallet')?.value
  if (!sid) return null
  const session = await redisClient.get<WalletSession>(`wsess:${sid}`)
  return session?.address ? session : null
}

// GET /api/chat → ultimas 50 mensagens da praca, em ordem cronologica.
export async function GET() {
  const { data, error } = await supabase
    .from('dogcity_chat')
    .select('id, handle, address, text, created_at')
    .order('created_at', { ascending: false })
    .limit(HISTORY_SIZE)

  if (error) {
    console.error('[api/chat GET]', error.message)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }

  // A consulta veio mais recente primeiro (e o indice que existe); inverte
  // aqui pra devolver cronologico, do jeito que quem renderiza o chat espera.
  const messages = (data ?? [])
    .slice()
    .reverse()
    .map((row) => ({
      id: row.id,
      handle: row.handle,
      address: row.address,
      text: row.text,
      at: row.created_at,
    }))

  return NextResponse.json({ messages })
}

// POST /api/chat {text} → grava uma mensagem. Exige sessao verificada E
// handle ja criado (sem handle nao fala na praca, cria perfil primeiro).
export async function POST(req: NextRequest) {
  const session = await getSession(req)
  if (!session) {
    return NextResponse.json({ error: 'sessão não verificada' }, { status: 401 })
  }

  const address = session.address.toLowerCase()

  const { data: profile, error: profileError } = await supabase
    .from('dogcity_profiles')
    .select('handle')
    .eq('address', address)
    .maybeSingle()

  if (profileError) {
    console.error('[api/chat POST profile lookup]', profileError.message)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
  if (!profile?.handle) {
    return NextResponse.json({ error: 'crie um handle antes de falar na praça' }, { status: 403 })
  }

  let body: { text?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'corpo inválido' }, { status: 422 })
  }

  const text = (body.text ?? '').trim()
  if (text.length < 1 || text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json({ error: 'texto inválido' }, { status: 422 })
  }

  // Anti-abuso: 1 mensagem a cada 3s por endereco. SET ... NX EX faz a
  // checagem e a reserva do slot num unico comando atomico no Redis, sem
  // race entre ler o ultimo horario e gravar o novo.
  const rateKey = `chatlimit:${address}`
  const reserved = await redisClient.set(rateKey, '1', { ex: RATE_LIMIT_SECONDS, nx: true })
  if (reserved !== 'OK') {
    return NextResponse.json({ error: 'devagar, espera alguns segundos' }, { status: 429 })
  }

  const { data: inserted, error: insertError } = await supabase
    .from('dogcity_chat')
    .insert({ address, handle: profile.handle, text })
    .select('id, handle, address, text, created_at')
    .single()

  if (insertError) {
    console.error('[api/chat POST insert]', insertError.message)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }

  return NextResponse.json({
    message: {
      id: inserted.id,
      handle: inserted.handle,
      address: inserted.address,
      text: inserted.text,
      at: inserted.created_at,
    },
  })
}
