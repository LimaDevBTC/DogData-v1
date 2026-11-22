// DOG Phone: Ligações e Mural (migração 047). O mesmo desenho de service.ts: o endereço vem SEMPRE da sessão, a conta interna
// é resolvida aqui e as regras (amizade, bloqueio, silêncio, não perturbe, ocupado, autoria) moram nas funções SQL.
import { chaveCutucada, lerId, lerIdMensagem, lerMotivo, lerTexto } from './rules'
import { cartao, contaDe, type Cartao, type Falha, type PhoneDeps } from './service'

export const LIMITES_EXTRA = {
  /** segundos tocando até virar perdida */
  toqueS: 40,
  /** chamada ativa sem nenhum dos dois visto por tanto tempo é dada como perdida de conexão */
  sumiuS: 45,
  /** chamadas iniciadas por hora, por conta */
  chamadasHora: 40,
  sdp: 20_000,
  postsDia: 30,
  /** segundos entre dois posts da mesma conta */
  postIntervaloS: 20,
  denunciasDia: 10,
  pagina: 20,
} as const

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null)
const ICE_PADRAO = [{ urls: ['stun:stun.cloudflare.com:3478'] }]

/** uma descrição de sessão do WebRTC: texto SDP de verdade, só áudio, com teto de tamanho */
export function lerSdp(v: unknown): string | null {
  if (typeof v !== 'string' || v.length < 40 || v.length > LIMITES_EXTRA.sdp) return null
  if (!v.startsWith('v=0') || !/\nm=audio /.test(v) || /\nm=(video|application) /.test(v)) return null
  // só o que um SDP tem: ASCII imprimível e quebras de linha
  return /^[\x20-\x7E\r\n]+$/.test(v) ? v : null
}

export interface ChamadaViva {
  id: string
  state: 'ringing' | 'active'
  incoming: boolean
  peer: Cartao
  at: string
  answeredAt: string | null
  offer: string | null
  answer: string | null
}

/** GET /api/dogcity/phone/calls: a chamada viva desta conta, a última que acabou há pouco, as perdidas e o não perturbe */
export async function sondar(deps: PhoneDeps, address: string) {
  const me = await contaDe(deps, address)
  const r = obj(await deps.rpc('dogcity_phone_call_poll', { p_me: me, p_ring_s: LIMITES_EXTRA.toqueS, p_lost_s: LIMITES_EXTRA.sumiuS }))
  const c = obj(r?.call)
  const peer = cartao(c?.peer)
  const id = lerId(c?.id)
  const call: ChamadaViva | null =
    c && peer && id && (c.state === 'ringing' || c.state === 'active')
      ? {
          id,
          state: c.state,
          incoming: c.incoming === true,
          peer,
          at: String(c.at ?? ''),
          answeredAt: typeof c.answered_at === 'string' ? c.answered_at : null,
          offer: typeof c.offer === 'string' ? c.offer : null,
          answer: typeof c.answer === 'string' ? c.answer : null,
        }
      : null
  const l = obj(r?.last)
  const lid = lerId(l?.id)
  return {
    call,
    last: l && lid && typeof l.reason === 'string' ? { id: lid, reason: l.reason, incoming: l.incoming === true } : null,
    missed: Math.max(0, Number(r?.missed) || 0),
    dnd: r?.dnd === true,
    ice: deps.ice?.length ? deps.ice : ICE_PADRAO,
    ringSeconds: LIMITES_EXTRA.toqueS,
    nudge: chaveCutucada(deps.segredo, me),
  }
}

/** GET /api/dogcity/phone/calls?log=1 */
export async function historicoChamadas(deps: PhoneDeps, address: string) {
  const me = await contaDe(deps, address)
  const r = await deps.rpc('dogcity_phone_call_log', { p_me: me, p_limit: 30 })
  const calls = (Array.isArray(r) ? r : []).flatMap((b: unknown) => {
    const o = obj(b)
    const peer = cartao(o?.peer)
    const id = lerId(o?.id)
    const res = o?.result
    if (!o || !peer || !id || (res !== 'talked' && res !== 'missed' && res !== 'cancelled' && res !== 'no_answer')) return []
    return [{ id, incoming: o.incoming === true, peer, at: String(o.at ?? ''), result: res, seconds: Math.max(0, Number(o.seconds) || 0) }]
  })
  return { calls }
}

/** POST /api/dogcity/phone/calls { action: start | answer | end | dnd } */
export async function agirChamada(
  deps: PhoneDeps,
  address: string,
  corpo: Record<string, unknown>,
): Promise<{ ok: true; id?: string; nudge?: string } | Falha> {
  const me = await contaDe(deps, address)
  if (corpo.action === 'start') {
    const outro = lerId(corpo.to)
    const oferta = lerSdp(corpo.offer)
    if (!outro || outro === me) return { ok: false, why: 'invalid_id' }
    if (!oferta) return { ok: false, why: 'invalid_sdp' }
    const r = obj(
      await deps.rpc('dogcity_phone_call_start', {
        p_me: me, p_other: outro, p_offer: oferta, p_ring_s: LIMITES_EXTRA.toqueS, p_lost_s: LIMITES_EXTRA.sumiuS, p_cap_hour: LIMITES_EXTRA.chamadasHora,
      }),
    )
    const st = r?.status
    const id = lerId(r?.id)
    if (st !== 'ok' || !id) return { ok: false, why: st === 'not_friends' || st === 'busy' || st === 'busy_self' || st === 'rate' ? st : 'failed' }
    // quem recebe em não perturbe, ou que silenciou quem liga, não é avisado; quem liga não fica sabendo
    return { ok: true, id, ...(r?.ring === true ? { nudge: chaveCutucada(deps.segredo, outro) } : {}) }
  }
  if (corpo.action === 'answer') {
    const id = lerId(corpo.id)
    const resposta = lerSdp(corpo.answer)
    if (!id) return { ok: false, why: 'invalid_id' }
    if (!resposta) return { ok: false, why: 'invalid_sdp' }
    const st = await deps.rpc('dogcity_phone_call_answer', { p_me: me, p_call: id, p_answer: resposta })
    if (st !== 'ok') return { ok: false, why: 'not_found' }
    const outro = await outroDaChamada(deps, me)
    return { ok: true, id, ...(outro ? { nudge: chaveCutucada(deps.segredo, outro) } : {}) }
  }
  if (corpo.action === 'end') {
    const id = lerId(corpo.id)
    if (!id) return { ok: false, why: 'invalid_id' }
    const r = obj(await deps.rpc('dogcity_phone_call_end', { p_me: me, p_call: id, p_failed: corpo.failed === true }))
    if (r?.status !== 'ok') return { ok: false, why: 'not_found' }
    const outro = lerId(r.other)
    return { ok: true, id, ...(outro && r.ring === true ? { nudge: chaveCutucada(deps.segredo, outro) } : {}) }
  }
  if (corpo.action === 'dnd') {
    await deps.rpc('dogcity_phone_dnd_set', { p_me: me, p_on: corpo.on === true })
    return { ok: true }
  }
  return { ok: false, why: 'unknown_action' }
}

async function outroDaChamada(deps: PhoneDeps, me: string): Promise<string | null> {
  const r = obj(await deps.rpc('dogcity_phone_call_poll', { p_me: me, p_ring_s: LIMITES_EXTRA.toqueS, p_lost_s: LIMITES_EXTRA.sumiuS }))
  return lerId(obj(obj(r?.call)?.peer)?.id)
}

// ---------------------------------------------------------------------------------------------------------------------- mural

export interface Post {
  id: number
  text: string
  at: string
  mine: boolean
  author: Cartao
  likes: number
  liked: boolean
  /** quantas respostas vivas o post tem */
  replies: number
  /** o post a que este responde (null no feed) */
  replyTo: number | null
}

function post(v: unknown): Post | null {
  const o = obj(v)
  const id = lerIdMensagem(o?.id)
  const author = cartao(o?.author)
  if (!o || !id || !author || typeof o.text !== 'string') return null
  return { id, text: o.text, at: String(o.at ?? ''), mine: o.mine === true, author, likes: Math.max(0, Number(o.likes) || 0), liked: o.liked === true, replies: Math.max(0, Number(o.replies) || 0), replyTo: lerIdMensagem(o.reply_to) }
}

/** GET /api/dogcity/phone/wall?before=&author=&thread= (thread = um post e as respostas a ele) */
export async function feed(deps: PhoneDeps, address: string, q: { before: unknown; author: unknown; thread?: unknown }): Promise<{ ok: true; posts: Post[]; more: boolean; me: Cartao | null } | Falha> {
  const me = await contaDe(deps, address)
  const antes = q.before === null || q.before === undefined || q.before === '' ? null : lerIdMensagem(q.before)
  const autor = q.author === null || q.author === undefined || q.author === '' ? null : lerId(q.author)
  const fio = q.thread === null || q.thread === undefined || q.thread === '' ? null : lerIdMensagem(q.thread)
  if ((q.before && !antes) || (q.author && !autor) || (q.thread && !fio)) return { ok: false, why: 'invalid_id' }
  const [r, eu] = await Promise.all([
    deps.rpc('dogcity_phone_feed', { p_me: me, p_author: autor, p_before: antes, p_limit: LIMITES_EXTRA.pagina + 1, p_thread: fio }),
    deps.rpc('dogcity_phone_card', { p_id: me }),
  ])
  const todos = (Array.isArray(r) ? r : []).flatMap((b: unknown) => {
    const p = post(b)
    return p ? [p] : []
  })
  return { ok: true, posts: todos.slice(0, LIMITES_EXTRA.pagina), more: todos.length > LIMITES_EXTRA.pagina, me: cartao(eu) }
}

/** POST /api/dogcity/phone/wall { action: post | like | delete | report } */
export async function agirMural(deps: PhoneDeps, address: string, corpo: Record<string, unknown>): Promise<{ ok: true; id?: number; likes?: number; liked?: boolean } | Falha> {
  const me = await contaDe(deps, address)
  if (corpo.action === 'post') {
    const t = lerTexto(corpo.text)
    if (!t.ok) return { ok: false, why: t.why }
    // `reply` = o post do feed a que este responde (opcional)
    const resposta = corpo.reply === null || corpo.reply === undefined ? null : lerIdMensagem(corpo.reply)
    if (corpo.reply !== null && corpo.reply !== undefined && !resposta) return { ok: false, why: 'invalid_id' }
    const r = obj(await deps.rpc('dogcity_phone_post_add', { p_me: me, p_body: t.texto, p_cap_day: LIMITES_EXTRA.postsDia, p_gap_s: LIMITES_EXTRA.postIntervaloS, p_reply: resposta }))
    const id = lerIdMensagem(r?.id)
    if (r?.status !== 'ok' || !id) return { ok: false, why: r?.status === 'no_handle' || r?.status === 'rate' || r?.status === 'cap_day' || r?.status === 'not_found' ? r.status : 'failed' }
    return { ok: true, id }
  }
  const id = lerIdMensagem(corpo.id)
  if (!id) return { ok: false, why: 'invalid_id' }
  if (corpo.action === 'like') {
    const r = obj(await deps.rpc('dogcity_phone_post_like_set', { p_me: me, p_post: id, p_on: corpo.on !== false }))
    if (r?.status !== 'ok') return { ok: false, why: 'not_found' }
    return { ok: true, id, likes: Math.max(0, Number(r.likes) || 0), liked: r.liked === true }
  }
  if (corpo.action === 'delete') {
    return (await deps.rpc('dogcity_phone_post_delete', { p_me: me, p_post: id })) === 'ok' ? { ok: true, id } : { ok: false, why: 'not_found' }
  }
  if (corpo.action === 'report') {
    const st = await deps.rpc('dogcity_phone_post_report_add', { p_me: me, p_post: id, p_reason: lerMotivo(corpo.reason), p_cap_day: LIMITES_EXTRA.denunciasDia })
    return st === 'ok' ? { ok: true, id } : { ok: false, why: st === 'cap' ? 'report_cap' : 'not_found' }
  }
  return { ok: false, why: 'unknown_action' }
}
