import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { redisClient } from '@/lib/upstash'
import { supabase } from '@/lib/supabase'

// A sessao do chat do jogo (app/api/chat/nearby/*): quem e' quem, no servidor.
//
//   cookie dg_near        a sessao (32 hex, HttpOnly), nasce na primeira chamada
//   id:<id>               o id de rede (o da pose) preso a' sessao por 6 h: so' ela fala e le
//                         a caixa por ele
//   nm:<id>               o nome que o servidor conhece daquele id ('h:<handle>' ou 'h:' para o
//                         convidado): a privada so' sai se o nome que quem escreveu viu bater
//   inbox:<id>            as privadas de quem tem aquele id (15 min, ate' 30)
//   hist                  as ultimas 50 publicas (24 h)
//
// O nome nunca vem do corpo: '@handle' sai da carteira provada (cookie dg_wallet + perfil).

export const COOKIE = 'dg_near'
const RE_COOKIE = /^[a-f0-9]{32}$/
const RE_HANDLE = /^[a-z0-9_]{3,15}$/
export const VINCULO_ID_S = 6 * 3600
const NOME_S = 300

export const CHAVES = {
  id: (id: string) => `dogcity:nearby:id:${id}`,
  nomeDoId: (id: string) => `dogcity:nearby:nm:${id}`,
  caixa: (id: string) => `dogcity:nearby:inbox:${id}`,
  historico: 'dogcity:nearby:hist:v1',
} as const

export const SEM_CACHE = { 'Cache-Control': 'private, no-store' } as const

export function erro(status: number, code: string, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}): NextResponse {
  return NextResponse.json({ error: code, code, ...extra }, { status, headers: { ...SEM_CACHE, ...headers } })
}

export function ipDe(req: NextRequest): string {
  const ip = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0] || ''
  return ip.trim().slice(0, 64) || 'sem-ip'
}

export interface Sessao {
  id: string
  nova: boolean
  /** poe o cookie na resposta quando a sessao nasceu agora */
  comCookie(r: NextResponse): NextResponse
}

export function sessaoDe(req: NextRequest): Sessao {
  const atual = req.cookies.get(COOKIE)?.value
  const nova = !atual || !RE_COOKIE.test(atual)
  const id = nova ? randomUUID().replace(/-/g, '') : atual
  return {
    id,
    nova,
    comCookie(r) {
      if (nova) {
        r.cookies.set(COOKIE, id, {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          path: '/api/chat/nearby',
          maxAge: 30 * 24 * 3600,
        })
      }
      return r
    },
  }
}

/** Prende o id de rede a' sessao (o primeiro cookie que usa o id fica dono por 6 h) e renova. */
export async function vincularId(id: string, sessao: string): Promise<boolean> {
  const chave = CHAVES.id(id)
  const dono = `s:${sessao}`
  const tomou = await redisClient.set(chave, dono, { nx: true, ex: VINCULO_ID_S })
  if (tomou === 'OK') return true
  if ((await redisClient.get<string>(chave)) !== dono) return false
  await redisClient.expire(chave, VINCULO_ID_S)
  return true
}

/** O @handle da carteira provada desta sessao, ou null (convidado). Nunca vem do corpo. */
export async function nomeDaSessao(req: NextRequest, signal: AbortSignal): Promise<string | null> {
  const sid = req.cookies.get('dg_wallet')?.value
  if (!sid) return null
  const sessao = await redisClient.get<{ address?: string }>(`wsess:${sid}`)
  const address = typeof sessao?.address === 'string' ? sessao.address.toLowerCase() : null
  if (!address) return null
  const chave = `dogcity:nearby:name:${address}`
  // 'h:' na frente: o Upstash faz JSON.parse do valor, e um handle so' de digitos voltaria numero
  const guardado = await redisClient.get<string>(chave)
  if (typeof guardado === 'string' && guardado.startsWith('h:')) {
    const h = guardado.slice(2)
    return RE_HANDLE.test(h) ? `@${h}` : null
  }
  // o nome e' enfeite: se a consulta falhar, a fala sai como convidado (nunca deixa de sair)
  const { data, error } = await supabase
    .from('dogcity_profiles')
    .select('handle')
    .eq('address', address)
    .abortSignal(signal)
    .maybeSingle()
  if (error) {
    console.error('[api/chat/nearby nome]', error.message)
    return null
  }
  const handle = typeof data?.handle === 'string' && RE_HANDLE.test(data.handle) ? data.handle : ''
  await redisClient.set(chave, `h:${handle}`, { ex: handle ? NOME_S : 60 })
  return handle ? `@${handle}` : null
}

/** Guarda o nome que este id usa agora (a privada confere contra ele). */
export async function guardarNomeDoId(id: string, nome: string | null): Promise<void> {
  await redisClient.set(CHAVES.nomeDoId(id), `h:${nome ? nome.slice(1) : ''}`, { ex: VINCULO_ID_S })
}

/** O nome do id que o servidor conhece: '@handle', null (convidado) ou undefined (id desconhecido). */
export async function nomeDoId(id: string): Promise<string | null | undefined> {
  const v = await redisClient.get<string>(CHAVES.nomeDoId(id))
  if (typeof v !== 'string' || !v.startsWith('h:')) return undefined
  const h = v.slice(2)
  return h && RE_HANDLE.test(h) ? `@${h}` : null
}

/** Teto por IP numa janela de 60 s (convidado troca de cookie, nao de IP). true = passou do teto. */
export async function estourouIp(req: NextRequest, balde: string, teto: number): Promise<boolean> {
  const chave = `dogcity:nearby:${balde}:${ipDe(req)}`
  const n = await redisClient.incr(chave)
  if (n === 1) await redisClient.expire(chave, 60)
  return n > teto
}
