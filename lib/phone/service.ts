// DOG Phone (Mensagens): o serviço. Recebe SEMPRE o endereço da sessão assinada (nunca do corpo), resolve a conta interna e
// chama as funções atômicas da migração 046 por `rpc`. O que sai daqui é o contrato das rotas /api/dogcity/phone/*.
//
// Quem pode o quê é decidido no SQL, com `p_me` vindo só da sessão: ler ou escrever uma conversa exige o vínculo `friends`
// entre a conta da sessão e a outra. Uma terceira conta não tem como nomear a conversa de outras duas.
import { chaveCutucada, lerCid, lerHandle, lerId, lerIdMensagem, lerMotivo, lerTexto, LIMITES } from './rules'

export type Rpc = (fn: string, args: Record<string, unknown>) => Promise<unknown>

/** as tabelas ou funções da 046 ainda não existem neste banco */
export class SemTabela extends Error {}

export interface PhoneDeps {
  rpc: Rpc
  /** segredo só do servidor, para a chave da cutucada */
  segredo: string
}

export type Falha = { ok: false; why: string }

export interface Cartao {
  id: string
  handle: string | null
  avatar: string | null
}

export interface Mensagem {
  id: number
  mine: boolean
  text: string
  at: string
}

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null)
const texto = (v: unknown): string | null => (typeof v === 'string' ? v : null)

function cartao(v: unknown): Cartao | null {
  const o = obj(v)
  const id = lerId(o?.id)
  if (!o || !id) return null
  return { id, handle: lerHandle(o.handle), avatar: typeof o.avatar === 'string' && /^[0-9a-f]{64}i\d{1,5}$/i.test(o.avatar) ? o.avatar.toLowerCase() : null }
}

function mensagem(v: unknown, me: string): Mensagem | null {
  const o = obj(v)
  const id = lerIdMensagem(o?.id)
  if (!o || !id || typeof o.text !== 'string') return null
  return { id, mine: o.sender === me, text: o.text, at: String(o.at ?? '') }
}

async function contaDe(deps: PhoneDeps, address: string): Promise<string> {
  const id = lerId(await deps.rpc('dogcity_phone_account_of', { p_address: address, p_create: true }))
  if (!id) throw new Error('dogcity_phone_account_of: no account')
  return id
}

/** GET /api/dogcity/phone?count=1: só os números do selo */
export async function contar(deps: PhoneDeps, address: string): Promise<{ unread: number; requests: number; nudge: string }> {
  const me = await contaDe(deps, address)
  const c = obj(await deps.rpc('dogcity_phone_counts', { p_me: me }))
  return { unread: Number(c?.unread ?? 0) || 0, requests: Number(c?.requests ?? 0) || 0, nudge: chaveCutucada(deps.segredo, me) }
}

/** GET /api/dogcity/phone: quem sou, amigos, pedidos e bloqueados */
export async function inicio(deps: PhoneDeps, address: string) {
  const me = await contaDe(deps, address)
  const [eu, geral, numeros] = await Promise.all([
    deps.rpc('dogcity_phone_card', { p_id: me }),
    deps.rpc('dogcity_phone_overview', { p_me: me }),
    deps.rpc('dogcity_phone_counts', { p_me: me }),
  ])
  const g = obj(geral)
  const friends: Array<Cartao & { muted: boolean; unread: number; last: { id: number; text: string; at: string; mine: boolean } | null; nudge: string }> = []
  const incoming: Array<Cartao & { at: string }> = []
  const outgoing: Array<Cartao & { at: string }> = []
  for (const bruto of g && Array.isArray(g.links) ? g.links : []) {
    const l = obj(bruto)
    const c = cartao(l?.card)
    if (!l || !c) continue
    if (l.state === 'friends') {
      const u = obj(l.last)
      const uid = lerIdMensagem(u?.id)
      friends.push({
        ...c,
        muted: l.muted === true,
        unread: Math.max(0, Number(l.unread) || 0),
        last: u && uid && typeof u.text === 'string' ? { id: uid, text: u.text, at: String(u.at ?? ''), mine: u.mine === true } : null,
        nudge: chaveCutucada(deps.segredo, c.id),
      })
    } else if (l.state === 'pending') {
      ;(l.mine === true ? outgoing : incoming).push({ ...c, at: String(l.at ?? '') })
    }
  }
  const blocked = (g && Array.isArray(g.blocked) ? g.blocked : []).flatMap((b: unknown) => {
    const c = cartao(b)
    return c ? [c] : []
  })
  const n = obj(numeros)
  const meu = cartao(eu)
  return {
    me: { id: me, handle: meu?.handle ?? null, avatar: meu?.avatar ?? null, nudge: chaveCutucada(deps.segredo, me) },
    friends,
    incoming,
    outgoing,
    blocked,
    unread: Number(n?.unread ?? 0) || 0,
    requests: Number(n?.requests ?? 0) || 0,
    limits: { text: LIMITES.texto, page: LIMITES.pagina },
  }
}

/** GET /api/dogcity/phone/search?handle=: o perfil a confirmar antes do pedido. Nunca carteira, e-mail nem dado de login */
export async function buscar(deps: PhoneDeps, address: string, handleBruto: unknown) {
  const handle = lerHandle(handleBruto)
  if (!handle) return { ok: false as const, why: 'invalid_handle' }
  const me = await contaDe(deps, address)
  const r = obj(await deps.rpc('dogcity_phone_search', { p_me: me, p_handle: handle }))
  if (!r || r.found !== true) return { ok: true as const, found: false as const }
  const rel = texto(r.relation)
  const relation = rel === 'self' || rel === 'friends' || rel === 'outgoing' || rel === 'incoming' || rel === 'blocked' ? rel : 'none'
  return {
    ok: true as const,
    found: true as const,
    profile: {
      handle: lerHandle(r.handle) ?? handle,
      avatar: typeof r.avatar === 'string' && /^[0-9a-f]{64}i\d{1,5}$/i.test(r.avatar) ? r.avatar.toLowerCase() : null,
      id: relation === 'none' || relation === 'self' ? null : lerId(r.id),
    },
    relation,
  }
}

export type Acao = 'request' | 'accept' | 'decline' | 'cancel' | 'remove' | 'block' | 'unblock' | 'mute' | 'unmute' | 'report'
export const ACOES: readonly Acao[] = ['request', 'accept', 'decline', 'cancel', 'remove', 'block', 'unblock', 'mute', 'unmute', 'report']

/** POST /api/dogcity/phone/friends: tudo que muda um vínculo. `nudge` (quando vem) é a chave para avisar a outra conta */
export async function agir(
  deps: PhoneDeps,
  address: string,
  corpo: Record<string, unknown>,
): Promise<{ ok: true; status: string; id?: string; nudge?: string } | Falha> {
  const acao = ACOES.find((a) => a === corpo.action)
  if (!acao) return { ok: false, why: 'unknown_action' }
  const me = await contaDe(deps, address)
  if (acao === 'request') {
    const handle = lerHandle(corpo.handle)
    if (!handle) return { ok: false, why: 'invalid_handle' }
    const r = obj(
      await deps.rpc('dogcity_phone_request', {
        p_me: me,
        p_handle: handle,
        p_cap_pending: LIMITES.pedidosPendentes,
        p_cap_day: LIMITES.pedidosDia,
        p_cooldown_days: LIMITES.recusaDias,
      }),
    )
    const st = texto(r?.status)
    const outro = lerId(r?.id)
    if ((st === 'requested' || st === 'accepted' || st === 'already') && outro) {
      return { ok: true, status: st, id: outro, nudge: chaveCutucada(deps.segredo, outro) }
    }
    return { ok: false, why: st && ['not_found', 'self', 'blocked', 'cooldown', 'cap_pending', 'cap_day'].includes(st) ? st : 'failed' }
  }
  const outro = lerId(corpo.id)
  if (!outro || outro === me) return { ok: false, why: 'invalid_id' }
  let st: unknown
  if (acao === 'accept' || acao === 'decline') st = await deps.rpc('dogcity_phone_respond', { p_me: me, p_other: outro, p_accept: acao === 'accept' })
  else if (acao === 'cancel') st = await deps.rpc('dogcity_phone_cancel', { p_me: me, p_other: outro })
  else if (acao === 'remove') st = await deps.rpc('dogcity_phone_remove', { p_me: me, p_other: outro })
  else if (acao === 'block' || acao === 'unblock') st = await deps.rpc('dogcity_phone_block_set', { p_me: me, p_other: outro, p_on: acao === 'block' })
  else if (acao === 'mute' || acao === 'unmute') st = await deps.rpc('dogcity_phone_mute_set', { p_me: me, p_other: outro, p_on: acao === 'mute' })
  else st = await deps.rpc('dogcity_phone_report_add', { p_me: me, p_other: outro, p_reason: lerMotivo(corpo.reason), p_cap_day: LIMITES.denunciasDia })
  if (st === 'ok') {
    // só o aceite, o pedido cancelado e a amizade desfeita interessam ao outro lado na hora; bloqueio e silêncio não avisam ninguém
    const avisa = acao === 'accept' || acao === 'decline' || acao === 'cancel' || acao === 'remove'
    return { ok: true, status: 'ok', id: outro, ...(avisa ? { nudge: chaveCutucada(deps.segredo, outro) } : {}) }
  }
  return { ok: false, why: st === 'cap' ? 'report_cap' : 'not_found' }
}

/** POST /api/dogcity/phone/messages { to, text, cid } */
export async function enviar(
  deps: PhoneDeps,
  address: string,
  corpo: Record<string, unknown>,
): Promise<{ ok: true; message: Mensagem; nudge: string } | Falha> {
  const outro = lerId(corpo.to)
  const cid = lerCid(corpo.cid)
  if (!outro) return { ok: false, why: 'invalid_id' }
  if (!cid) return { ok: false, why: 'invalid_cid' }
  const t = lerTexto(corpo.text)
  if (!t.ok) return { ok: false, why: t.why }
  const me = await contaDe(deps, address)
  if (outro === me) return { ok: false, why: 'invalid_id' }
  const r = obj(await deps.rpc('dogcity_phone_send', { p_me: me, p_other: outro, p_body: t.texto, p_cid: cid, p_cap_min: LIMITES.mensagensMinuto }))
  const st = texto(r?.status)
  if (st !== 'ok') return { ok: false, why: st === 'not_friends' || st === 'rate' || st === 'invalid' ? st : 'failed' }
  const m = mensagem(r?.message, me)
  if (!m) return { ok: false, why: 'failed' }
  return { ok: true, message: m, nudge: chaveCutucada(deps.segredo, outro) }
}

/** POST /api/dogcity/phone/messages { read: { with, upTo } } */
export async function ler(deps: PhoneDeps, address: string, corpo: Record<string, unknown>): Promise<{ ok: true } | Falha> {
  const outro = lerId(corpo.with)
  const ate = lerIdMensagem(corpo.upTo)
  if (!outro || !ate) return { ok: false, why: 'invalid_id' }
  const me = await contaDe(deps, address)
  const st = await deps.rpc('dogcity_phone_read_set', { p_me: me, p_other: outro, p_upto: ate })
  return st === 'ok' ? { ok: true } : { ok: false, why: 'not_friends' }
}

/** GET /api/dogcity/phone/messages?with=&before=&limit= */
export async function historico(
  deps: PhoneDeps,
  address: string,
  q: { with: unknown; before: unknown; limit: unknown },
): Promise<{ ok: true; messages: Mensagem[]; read: number; peerRead: number; more: boolean } | Falha> {
  const outro = lerId(q.with)
  if (!outro) return { ok: false, why: 'invalid_id' }
  const antes = q.before === null || q.before === undefined || q.before === '' ? null : lerIdMensagem(q.before)
  if (q.before !== null && q.before !== undefined && q.before !== '' && !antes) return { ok: false, why: 'invalid_id' }
  const pedido = Number(q.limit)
  const limite = Number.isInteger(pedido) && pedido > 0 ? Math.min(pedido, LIMITES.paginaMax) : LIMITES.pagina
  const me = await contaDe(deps, address)
  const r = obj(await deps.rpc('dogcity_phone_history', { p_me: me, p_other: outro, p_before: antes, p_limit: limite + 1 }))
  if (texto(r?.status) !== 'ok') return { ok: false, why: 'not_friends' }
  const todas = (r && Array.isArray(r.messages) ? r.messages : []).flatMap((x: unknown) => {
    const m = mensagem(x, me)
    return m ? [m] : []
  })
  const more = todas.length > limite
  return { ok: true, messages: todas.slice(0, limite), read: Number(r?.read ?? 0) || 0, peerRead: Number(r?.peer_read ?? 0) || 0, more }
}
