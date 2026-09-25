import { NextRequest, NextResponse } from 'next/server'
import { redisClient } from '@/lib/upstash'
import { supabase } from '@/lib/supabase'
import { comPrazo, falhaPublica } from '@/lib/api/prazo'

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

// GET /api/chat → ultimas 50 mensagens da praca, em ordem cronologica, cada
// uma com o `avatar_inscription_id` atual do autor (null sem foto).
//
// ⚠️ CACHE DE 2 s NA BORDA (LIGAR.md 3.3). Todo cliente com o painel aberto
// pede a cada 5 s; sem cache isso era N consultas por 5 s no Supabase (a
// classe do incidente de IO de 26/08). Com `s-maxage=2` sao no maximo ~30
// consultas por minuto por regiao, seja qual for o publico. Custo: a lista
// pode vir ate 2 s atras. Por isso quem POSTA usa a mensagem devolvida pelo
// POST em vez de esperar o proximo GET (city-chat.tsx faz assim).
//
// A leitura e publica e NAO le cookie: e isso que deixa a borda cachear.
const CHAT_CACHE = { 'Cache-Control': 'public, s-maxage=2' } as const
const CHAT_PRAZO_MS = 5000

export async function GET() {
  return comPrazo(async (signal) => {
    const { data, error } = await supabase
      .from('dogcity_chat')
      .select('id, handle, address, text, created_at')
      .order('created_at', { ascending: false })
      .limit(HISTORY_SIZE)
      .abortSignal(signal)

    if (error) {
      console.error('[api/chat GET]', error.message)
      return falhaPublica()
    }

    // Foto de perfil: UMA consulta pela chave primaria (`in` nos ate 50
    // enderecos distintos), nunca uma por mensagem. A foto e enfeite: se esta
    // consulta falhar o chat sai sem foto, nunca sem mensagem.
    const enderecos = Array.from(new Set((data ?? []).map((row) => row.address)))
    const foto = new Map<string, string>()
    if (enderecos.length > 0) {
      const perfis = await supabase
        .from('dogcity_profiles')
        .select('address, avatar_inscription_id')
        .in('address', enderecos)
        .abortSignal(signal)
      if (perfis.error) {
        console.error('[api/chat GET avatar]', perfis.error.message)
      } else {
        for (const p of perfis.data ?? []) {
          if (p.avatar_inscription_id) foto.set(p.address, p.avatar_inscription_id)
        }
      }
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
        avatar_inscription_id: foto.get(row.address) ?? null,
      }))

    return NextResponse.json({ messages }, { headers: CHAT_CACHE })
  }, { ms: CHAT_PRAZO_MS, falha: () => falhaPublica() })
}

// POST /api/chat {text} → grava uma mensagem. Exige sessao verificada E
// handle ja criado (sem handle nao fala na praca, cria perfil primeiro).
export async function POST(req: NextRequest) {
  const session = await getSession(req)
  if (!session) {
    return NextResponse.json({ error: 'Ownership not verified.' }, { status: 401 })
  }

  const address = session.address.toLowerCase()

  const { data: profile, error: profileError } = await supabase
    .from('dogcity_profiles')
    .select('handle, avatar_inscription_id')
    .eq('address', address)
    .maybeSingle()

  if (profileError) {
    console.error('[api/chat POST profile lookup]', profileError.message)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
  if (!profile?.handle) {
    return NextResponse.json({ error: 'Claim a handle before speaking in the plaza.' }, { status: 403 })
  }

  let body: { text?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body.' }, { status: 422 })
  }

  const text = (body.text ?? '').trim()
  if (text.length < 1 || text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json({ error: 'Message must be 1 to 280 characters.' }, { status: 422 })
  }

  // Anti-abuso: 1 mensagem a cada 3s por endereco. SET ... NX EX faz a
  // checagem e a reserva do slot num unico comando atomico no Redis, sem
  // race entre ler o ultimo horario e gravar o novo.
  const rateKey = `chatlimit:${address}`
  const reserved = await redisClient.set(rateKey, '1', { ex: RATE_LIMIT_SECONDS, nx: true })
  if (reserved !== 'OK') {
    return NextResponse.json({ error: 'Slow down, try again in a moment.' }, { status: 429 })
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
      avatar_inscription_id: profile.avatar_inscription_id ?? null,
    },
  })
}
