// "MESSAGE THE OWNER": o HTTP das duas rotas, com a sessão, os freios e a leitura do corpo injetados (PortaHttp), para os testes
// rodarem sem Redis nem banco. As rotas (app/api/dogcity/lot-message e app/api/dogcity/inbox) só ligam os fios de verdade.
//
// O PADRÃO DE SEGURANÇA é o de /api/dogcity/property e /api/dogcity/licence-choice:
//   - a carteira é a da SESSÃO assinada (cookie dg_wallet), nunca a do corpo: o corpo nunca diz quem é o remetente nem o dono;
//   - mesma origem: `sec-fetch-site: cross-site` é recusado (o jogo chama pelo rewrite /api do play.dogcity.space);
//   - só JSON, com teto em bytes;
//   - freio por IP (janela de 60 s) e por carteira (um pedido a cada N segundos);
//   - nada de cache (dado de uma pessoa).
import { NextResponse, type NextRequest } from 'next/server'
import { agir, caixa, enviar, naoLidas, responder, type MessageDeps } from './lot-message-service'

export type CorpoLido = { ok: true; valor: unknown } | { ok: false; status: 400 | 413 }

export interface PortaHttp {
  /** o endereço da sessão assinada, normalizado, ou null */
  sessao(req: NextRequest): Promise<string | null>
  /** true = passou do teto de pedidos deste IP neste balde */
  freioIp(req: NextRequest, balde: string, teto: number): Promise<boolean>
  /** true = esta chave pediu há menos de `segundos` */
  freioCarteira(chave: string, segundos: number): Promise<boolean>
  lerCorpo(req: NextRequest, tetoBytes: number): Promise<CorpoLido>
}

const NO_STORE = { 'Cache-Control': 'no-store' }
/** 500 caracteres de até 4 bytes, mais o escape do JSON e o resto do corpo */
export const TETO_CORPO_ENVIO = 4096
export const TETO_CORPO_CAIXA = 4096
export const TETO_IP_ENVIO = 20
export const TETO_IP_CAIXA = 60
export const TETO_IP_ACAO = 30
export const FREIO_ENVIO_S = 3
export const FREIO_ACAO_S = 1

const erro = (status: number, error: string, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ error, ...extra }, { status, headers: NO_STORE })

const freio = () =>
  NextResponse.json({ error: 'Too many requests, try again in a moment.' }, { status: 429, headers: { 'Retry-After': '60', ...NO_STORE } })

export const MSG: Record<string, [number, string]> = {
  not_open: [503, 'Messages are not open yet.'],
  unknown: [503, 'Could not confirm the owner of this lot right now. Try again in a moment.'],
  invalid_lot: [422, 'Invalid lot.'],
  empty: [422, 'Write a message first.'],
  too_long: [422, 'Messages can be up to 500 characters.'],
  link: [422, 'Links and web addresses are not allowed in messages.'],
  invalid_text: [422, 'This message has characters that cannot be sent.'],
  no_owner: [404, 'This lot has no owner to message yet.'],
  own_lot: [422, 'This is your own lot.'],
  day_cap: [429, 'You can send up to 10 messages a day.'],
  lot_cap: [429, 'You already sent a message to this lot today.'],
  reply_cap: [429, 'You reached the reply limit for today.'],
  not_found: [404, 'Message not found.'],
  unknown_action: [422, 'Unknown action.'],
  invalid_id: [422, 'Invalid message.'],
}

function recusa(why: string): NextResponse {
  const [s, m] = MSG[why] ?? [503, 'Something went wrong. Try again in a moment.']
  return erro(s, m, { why })
}

const ehCrossSite = (req: NextRequest) => req.headers.get('sec-fetch-site') === 'cross-site'
const ehJson = (req: NextRequest) => (req.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')

function objeto(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

/** POST /api/dogcity/lot-message: { lot, text } envia ao dono do lote; { replyTo, text } responde a uma mensagem recebida. */
export async function postLotMessage(req: NextRequest, porta: PortaHttp, deps: MessageDeps): Promise<NextResponse> {
  if (ehCrossSite(req)) return erro(403, 'Cross-site request refused.')
  if (!ehJson(req)) return erro(415, 'Send JSON.')
  if (await porta.freioIp(req, 'lot-message', TETO_IP_ENVIO)) return freio()
  const from = await porta.sessao(req)
  if (!from) return erro(401, 'Sign with your wallet first.')
  if (await porta.freioCarteira(`lot-message:${from}`, FREIO_ENVIO_S)) return erro(429, 'Slow down, try again in a moment.')
  const corpo = await porta.lerCorpo(req, TETO_CORPO_ENVIO)
  if (!corpo.ok) return erro(corpo.status, 'Invalid request.')
  const b = objeto(corpo.valor)
  if (!b) return erro(400, 'Invalid request.')
  // o corpo nunca diz quem manda nem para quem: campos assim nem são lidos
  const r = b.replyTo !== undefined
    ? await responder(deps, from, b.replyTo, b.text)
    : await enviar(deps, from, b.lot, b.text)
  if (!r.ok) return recusa(r.why)
  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}

/** GET /api/dogcity/inbox: a caixa da sessão; ?count=1 só o contador de não lidas. */
export async function getInbox(req: NextRequest, porta: PortaHttp, deps: MessageDeps): Promise<NextResponse> {
  if (ehCrossSite(req)) return erro(403, 'Cross-site request refused.')
  if (await porta.freioIp(req, 'inbox', TETO_IP_CAIXA)) return freio()
  const wallet = await porta.sessao(req)
  if (!wallet) return erro(401, 'Sign with your wallet first.')
  const soContar = new URL(req.url).searchParams.get('count') === '1'
  const v = soContar ? await naoLidas(deps, wallet) : await caixa(deps, wallet)
  if ('ok' in v && v.ok === false) return recusa(v.why)
  return NextResponse.json(v, { headers: NO_STORE })
}

/** POST /api/dogcity/inbox: { action: 'read', ids } | { action: 'delete' | 'mute' | 'unmute', id } */
export async function postInbox(req: NextRequest, porta: PortaHttp, deps: MessageDeps): Promise<NextResponse> {
  if (ehCrossSite(req)) return erro(403, 'Cross-site request refused.')
  if (!ehJson(req)) return erro(415, 'Send JSON.')
  if (await porta.freioIp(req, 'inbox-action', TETO_IP_ACAO)) return freio()
  const wallet = await porta.sessao(req)
  if (!wallet) return erro(401, 'Sign with your wallet first.')
  if (await porta.freioCarteira(`inbox:${wallet}`, FREIO_ACAO_S)) return erro(429, 'Slow down, try again in a moment.')
  const corpo = await porta.lerCorpo(req, TETO_CORPO_CAIXA)
  if (!corpo.ok) return erro(corpo.status, 'Invalid request.')
  const b = objeto(corpo.valor)
  if (!b) return erro(400, 'Invalid request.')
  const r = await agir(deps, wallet, b)
  if (!r.ok) return recusa(r.why)
  return NextResponse.json(r, { headers: NO_STORE })
}
