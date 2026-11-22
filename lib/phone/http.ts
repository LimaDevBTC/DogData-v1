// DOG Phone (Mensagens): o HTTP das rotas /api/dogcity/phone/*, com a sessão, os freios e a leitura do corpo injetados
// (PortaHttp). Usa só Request/Response da Web: as rotas do Next ligam os fios de verdade (deps.ts) e o servidor de prova do
// jogo (dogcity-mundo scripts/dogphone/servidor_prova.ts) liga os de teste, rodando ESTE código.
//
// O padrão de segurança é o de /api/dogcity/inbox:
//   - a conta é a da SESSÃO assinada (cookie dg_wallet), nunca a do corpo;
//   - mesma origem: `sec-fetch-site: cross-site` é recusado;
//   - só JSON, com teto em bytes; freio por IP e por conta; nada de cache (dado de uma pessoa).
import { agirChamada, agirMural, feed, historicoChamadas, sondar } from './extra'
import { agir, buscar, contar, enviar, historico, inicio, ler, SemTabela, type PhoneDeps } from './service'

export type CorpoLido = { ok: true; valor: unknown } | { ok: false; status: 400 | 413 }

export interface PortaHttp {
  /** o endereço da sessão assinada, normalizado, ou null */
  sessao(req: Request): Promise<string | null>
  /** true = passou do teto de pedidos deste IP neste balde (janela de 60 s) */
  freioIp(req: Request, balde: string, teto: number): Promise<boolean>
  /** true = esta chave pediu há menos de `segundos` */
  freioConta(chave: string, segundos: number): Promise<boolean>
  lerCorpo(req: Request, tetoBytes: number): Promise<CorpoLido>
}

const NO_STORE = { 'Cache-Control': 'no-store' }
export const TETO_CORPO = 4096
export const TETO_CORPO_CHAMADA = 24_000
export const TETOS_IP = { inicio: 60, busca: 20, acao: 30, historico: 60, envio: 60, chamada: 120, mural: 60 } as const

const json = (corpo: unknown, status = 200, extra: Record<string, string> = {}): Response =>
  Response.json(corpo, { status, headers: { ...NO_STORE, ...extra } })

export const MSG: Record<string, [number, string]> = {
  not_open: [503, 'Messages are not open yet.'],
  invalid_handle: [422, 'Type a full @handle: 3 to 15 letters, numbers or underscores.'],
  invalid_id: [422, 'Invalid request.'],
  invalid_cid: [422, 'Invalid request.'],
  unknown_action: [422, 'Unknown action.'],
  not_found: [404, 'Not found.'],
  self: [422, 'That is you.'],
  blocked: [409, 'You blocked this player. Unblock first.'],
  cooldown: [429, 'This player declined your request. You can ask again in a few days.'],
  cap_pending: [429, 'You have too many requests waiting for an answer.'],
  cap_day: [429, 'You reached the limit of requests for today.'],
  report_cap: [429, 'You reached the limit of reports for today.'],
  not_friends: [403, 'You can only talk after the request is accepted.'],
  rate: [429, 'You are sending too fast. Wait a moment.'],
  empty: [422, 'Write a message first.'],
  too_long: [422, 'Messages can be up to 500 characters.'],
  invalid_text: [422, 'This message has characters that cannot be sent.'],
  invalid: [422, 'Invalid request.'],
  invalid_sdp: [422, 'Invalid request.'],
  busy: [409, 'This player is on another call.'],
  busy_self: [409, 'You are already on a call.'],
  no_handle: [422, 'Choose your @handle before posting.'],
}

function recusa(why: string): Response {
  const [s, m] = MSG[why] ?? [503, 'Something went wrong. Try again in a moment.']
  return json({ error: m, why }, s)
}
const erro = (status: number, error: string, why: string): Response => json({ error, why }, status)
const freio = (): Response => json({ error: 'Too many requests, try again in a moment.', why: 'ip_rate' }, 429, { 'Retry-After': '60' })

const ehCrossSite = (req: Request): boolean => req.headers.get('sec-fetch-site') === 'cross-site'
const ehJson = (req: Request): boolean => (req.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')
const objeto = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null)

/** o que toda rota faz antes: mesma origem, freio por IP, sessão. Devolve o endereço ou a resposta de recusa */
async function entrada(req: Request, porta: PortaHttp, balde: keyof typeof TETOS_IP): Promise<string | Response> {
  if (ehCrossSite(req)) return erro(403, 'Cross-site request refused.', 'cross_site')
  if (await porta.freioIp(req, `phone-${balde}`, TETOS_IP[balde])) return freio()
  const conta = await porta.sessao(req)
  if (!conta) return erro(401, 'Sign in first.', 'no_session')
  return conta
}

async function protegido(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn()
  } catch (e) {
    if (e instanceof SemTabela) return recusa('not_open')
    console.error('[api/dogcity/phone]', e instanceof Error ? e.message : e)
    return json({ error: 'Something went wrong. Try again in a moment.', why: 'failed' }, 503)
  }
}

/** GET /api/dogcity/phone[?count=1] */
export function getPhone(req: Request, porta: PortaHttp, deps: PhoneDeps): Promise<Response> {
  return protegido(async () => {
    const conta = await entrada(req, porta, 'inicio')
    if (typeof conta !== 'string') return conta
    const soContar = new URL(req.url).searchParams.get('count') === '1'
    return json(soContar ? await contar(deps, conta) : await inicio(deps, conta))
  })
}

/** GET /api/dogcity/phone/search?handle= */
export function getSearch(req: Request, porta: PortaHttp, deps: PhoneDeps): Promise<Response> {
  return protegido(async () => {
    const conta = await entrada(req, porta, 'busca')
    if (typeof conta !== 'string') return conta
    // a busca é a porta da enumeração de handles: uma por conta a cada 2 s
    if (await porta.freioConta(`phone-search:${conta}`, 2)) return erro(429, 'Slow down, try again in a moment.', 'slow')
    const r = await buscar(deps, conta, new URL(req.url).searchParams.get('handle'))
    if (!r.ok) return recusa(r.why)
    return json(r.found ? { found: true, profile: r.profile, relation: r.relation } : { found: false })
  })
}

/** POST /api/dogcity/phone/friends { action, handle | id, reason? } */
export function postFriends(req: Request, porta: PortaHttp, deps: PhoneDeps): Promise<Response> {
  return protegido(async () => {
    if (!ehJson(req)) return erro(415, 'Send JSON.', 'not_json')
    const conta = await entrada(req, porta, 'acao')
    if (typeof conta !== 'string') return conta
    if (await porta.freioConta(`phone-action:${conta}`, 1)) return erro(429, 'Slow down, try again in a moment.', 'slow')
    const corpo = await porta.lerCorpo(req, TETO_CORPO)
    const b = corpo.ok ? objeto(corpo.valor) : null
    if (!b) return erro(corpo.ok ? 400 : corpo.status, 'Invalid request.', 'invalid')
    const r = await agir(deps, conta, b)
    if (!r.ok) return recusa(r.why)
    return json(r)
  })
}

/** GET /api/dogcity/phone/messages?with=&before=&limit= */
export function getMessages(req: Request, porta: PortaHttp, deps: PhoneDeps): Promise<Response> {
  return protegido(async () => {
    const conta = await entrada(req, porta, 'historico')
    if (typeof conta !== 'string') return conta
    const q = new URL(req.url).searchParams
    const r = await historico(deps, conta, { with: q.get('with'), before: q.get('before'), limit: q.get('limit') })
    if (!r.ok) return recusa(r.why)
    return json(r)
  })
}

/** POST /api/dogcity/phone/messages { to, text, cid } | { read: { with, upTo } } */
export function postMessages(req: Request, porta: PortaHttp, deps: PhoneDeps): Promise<Response> {
  return protegido(async () => {
    if (!ehJson(req)) return erro(415, 'Send JSON.', 'not_json')
    const conta = await entrada(req, porta, 'envio')
    if (typeof conta !== 'string') return conta
    const corpo = await porta.lerCorpo(req, TETO_CORPO)
    const b = corpo.ok ? objeto(corpo.valor) : null
    if (!b) return erro(corpo.ok ? 400 : corpo.status, 'Invalid request.', 'invalid')
    const lida = objeto(b.read)
    if (lida) {
      const r = await ler(deps, conta, lida)
      return r.ok ? json({ ok: true }) : recusa(r.why)
    }
    // uma mensagem por segundo por conta, antes do teto por minuto que mora no banco
    if (await porta.freioConta(`phone-send:${conta}`, 1)) return erro(429, 'You are sending too fast. Wait a moment.', 'rate')
    const r = await enviar(deps, conta, b)
    if (!r.ok) return recusa(r.why)
    return json(r)
  })
}

/** GET /api/dogcity/phone/calls[?log=1] */
export function getCalls(req: Request, porta: PortaHttp, deps: PhoneDeps): Promise<Response> {
  return protegido(async () => {
    const conta = await entrada(req, porta, 'chamada')
    if (typeof conta !== 'string') return conta
    return json(new URL(req.url).searchParams.get('log') === '1' ? await historicoChamadas(deps, conta) : await sondar(deps, conta))
  })
}

/** POST /api/dogcity/phone/calls { action: start, to, offer } | { action: answer, id, answer } | { action: end, id, failed? } | { action: dnd, on } */
export function postCalls(req: Request, porta: PortaHttp, deps: PhoneDeps): Promise<Response> {
  return protegido(async () => {
    if (!ehJson(req)) return erro(415, 'Send JSON.', 'not_json')
    const conta = await entrada(req, porta, 'chamada')
    if (typeof conta !== 'string') return conta
    const corpo = await porta.lerCorpo(req, TETO_CORPO_CHAMADA)
    const b = corpo.ok ? objeto(corpo.valor) : null
    if (!b) return erro(corpo.ok ? 400 : corpo.status, 'Invalid request.', 'invalid')
    // ligar e' o gesto caro (toca no outro lado): um a cada 3 s por conta
    if (b.action === 'start' && (await porta.freioConta(`phone-call:${conta}`, 3))) return erro(429, 'Slow down, try again in a moment.', 'slow')
    const r = await agirChamada(deps, conta, b)
    return r.ok ? json(r) : recusa(r.why)
  })
}

/** GET /api/dogcity/phone/wall?before=&author= */
export function getWall(req: Request, porta: PortaHttp, deps: PhoneDeps): Promise<Response> {
  return protegido(async () => {
    const conta = await entrada(req, porta, 'mural')
    if (typeof conta !== 'string') return conta
    const q = new URL(req.url).searchParams
    const r = await feed(deps, conta, { before: q.get('before'), author: q.get('author') })
    return r.ok ? json(r) : recusa(r.why)
  })
}

/** POST /api/dogcity/phone/wall { action: post, text } | { action: like, id, on } | { action: delete, id } | { action: report, id, reason? } */
export function postWall(req: Request, porta: PortaHttp, deps: PhoneDeps): Promise<Response> {
  return protegido(async () => {
    if (!ehJson(req)) return erro(415, 'Send JSON.', 'not_json')
    const conta = await entrada(req, porta, 'mural')
    if (typeof conta !== 'string') return conta
    if (await porta.freioConta(`phone-wall:${conta}`, 1)) return erro(429, 'Slow down, try again in a moment.', 'slow')
    const corpo = await porta.lerCorpo(req, TETO_CORPO)
    const b = corpo.ok ? objeto(corpo.valor) : null
    if (!b) return erro(corpo.ok ? 400 : corpo.status, 'Invalid request.', 'invalid')
    const r = await agirMural(deps, conta, b)
    return r.ok ? json(r) : recusa(r.why)
  })
}
