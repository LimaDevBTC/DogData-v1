// ═══════════════════════════════════════════════════════════════════════════
// "MESSAGE THE OWNER" ligado ao banco e ao mint por interfaces (20/11/2026). A regra do texto mora em lot-message.ts; o banco de
// verdade em lot-message-supabase.ts; os testes passam um falso.
//
//   enviar    POST /api/dogcity/lot-message { lot, text }: o destinatário é o dono do lote NA HORA, quem guarda a escritura pelo
//             mint. Mint mudo = 'unknown' (falha fechado: nunca envia sem saber para quem). Lote sem dono = 'no_owner'. O próprio
//             lote = 'own_lot'.
//   responder POST /api/dogcity/lot-message { replyTo, text }: a resposta vai para a carteira do remetente da mensagem recebida,
//             presa à mesma conversa. O destinatário e o lote saem do banco, nunca do pedido.
//   caixa     GET /api/dogcity/inbox: as mensagens RECEBIDAS pela carteira da sessão (nunca as de outra), o remetente pelo handle
//             ou pelo endereço curto, a contagem de não lidas e os silenciados.
//   agir      POST /api/dogcity/inbox: read | delete | mute | unmute, sempre presos à carteira da sessão.
//
// O remetente silenciado recebe 'ok' como se tivesse ido: o silêncio não vira sinal para quem incomoda.
// FALHAS: sem as tabelas da 045 (SemTabela) = 'not_open'; banco fora = 'unknown'.
// ═══════════════════════════════════════════════════════════════════════════
import { normalizeAddress } from './licence-btc'
import { normalizeLotId } from './licence-lot'
import { SemTabela } from './licence-lot-service'
import {
  MENSAGENS_POR_DIA, RESPOSTAS_POR_DIA, TETO_CAIXA, TETO_SILENCIADOS, enderecoCurto, idValido, idsValidos, validarTexto,
  type TextoErro,
} from './lot-message'

export type EnvioStatus = 'ok' | 'muted' | 'day_cap' | 'lot_cap' | 'reply_cap' | 'not_found'

export interface MensagemRow {
  id: string
  threadId: string
  replyTo: string | null
  lot: string
  from: string
  to: string
  body: string
  createdAt: string
  readAt: string | null
}

export interface Silencio {
  id: string
  wallet: string
  createdAt: string
}

export interface MessageStore {
  /** dogcity_lot_message_send: nova (to e lot) ou resposta (replyTo) */
  send(a: { from: string; to: string | null; lot: string | null; body: string; replyTo: string | null; dayCap: number; replyCap: number }): Promise<EnvioStatus>
  /** as recebidas e não apagadas, da mais nova para a mais velha */
  inbox(wallet: string, limit: number): Promise<MensagemRow[]>
  unread(wallet: string): Promise<number>
  /** o texto das mensagens que ESTA carteira mandou, por id (a citação de uma resposta) */
  ownBodies(wallet: string, ids: string[]): Promise<Map<string, string>>
  markRead(wallet: string, ids: string[]): Promise<void>
  remove(wallet: string, id: string): Promise<boolean>
  mute(wallet: string, messageId: string): Promise<boolean>
  unmute(wallet: string, muteId: string): Promise<boolean>
  mutes(wallet: string, limit: number): Promise<Silencio[]>
}

export interface MessageDeps {
  store: MessageStore
  /** quem guarda a escritura do lote agora pelo mint: o endereço, null = ninguém (não mintado), undefined = o mint não disse */
  donoDoLote: (lot: string) => Promise<string | null | undefined>
  /** os handles dos endereços que têm um (dogcity_profiles); falhar devolve vazio, e a caixa cai no endereço curto */
  handles: (enderecos: string[]) => Promise<Map<string, string>>
}

export type MotivoEnvio = TextoErro | 'invalid_lot' | 'no_owner' | 'own_lot' | 'day_cap' | 'lot_cap' | 'reply_cap' | 'not_found' | 'not_open' | 'unknown'
export type ResultadoEnvio = { ok: true } | { ok: false; why: MotivoEnvio }
export type Falha = { ok: false; why: 'not_open' | 'unknown' }

const erroDe = (e: unknown) => (e as Error)?.message ?? String(e)

async function comFalha<T>(fn: () => Promise<T>): Promise<T | Falha> {
  try {
    return await fn()
  } catch (e) {
    if (e instanceof SemTabela) return { ok: false, why: 'not_open' }
    console.error('[lot-message] unavailable:', erroDe(e))
    return { ok: false, why: 'unknown' }
  }
}

function deStatus(s: EnvioStatus): ResultadoEnvio {
  // silenciado: responde como se tivesse ido
  if (s === 'ok' || s === 'muted') return { ok: true }
  return { ok: false, why: s }
}

/** Uma mensagem nova para o dono do lote. `from` é o endereço da sessão, já normalizado. */
export async function enviar(deps: MessageDeps, from: string, loteBruto: unknown, textoBruto: unknown): Promise<ResultadoEnvio> {
  const lot = normalizeLotId(loteBruto)
  if (!lot) return { ok: false, why: 'invalid_lot' }
  const tx = validarTexto(textoBruto)
  if (!tx.ok) return { ok: false, why: tx.why }
  let dono: string | null | undefined
  try {
    dono = await deps.donoDoLote(lot)
  } catch {
    dono = undefined
  }
  if (dono === undefined) return { ok: false, why: 'unknown' }
  if (dono === null) return { ok: false, why: 'no_owner' }
  const to = normalizeAddress(dono)
  if (!to) return { ok: false, why: 'unknown' }
  if (to === from) return { ok: false, why: 'own_lot' }
  const r = await comFalha(() =>
    deps.store.send({ from, to, lot, body: tx.texto, replyTo: null, dayCap: MENSAGENS_POR_DIA, replyCap: RESPOSTAS_POR_DIA }),
  )
  return typeof r === 'string' ? deStatus(r) : r
}

/** A resposta a uma mensagem RECEBIDA por `from`: vai para quem a mandou, na mesma conversa. */
export async function responder(deps: MessageDeps, from: string, replyToBruto: unknown, textoBruto: unknown): Promise<ResultadoEnvio> {
  const replyTo = idValido(replyToBruto)
  if (!replyTo) return { ok: false, why: 'not_found' }
  const tx = validarTexto(textoBruto)
  if (!tx.ok) return { ok: false, why: tx.why }
  const r = await comFalha(() =>
    deps.store.send({ from, to: null, lot: null, body: tx.texto, replyTo, dayCap: MENSAGENS_POR_DIA, replyCap: RESPOSTAS_POR_DIA }),
  )
  return typeof r === 'string' ? deStatus(r) : r
}

export interface Remetente {
  /** o handle sem @, quando a carteira tem um */
  handle: string | null
  /** bc1p…abcd */
  short: string
}

export interface MensagemDaCaixa {
  id: string
  lot: string
  from: Remetente
  text: string
  at: string
  read: boolean
  /** é uma resposta a uma mensagem desta carteira */
  reply: boolean
  /** o começo da mensagem desta carteira que foi respondida (só numa resposta) */
  quote: string | null
}

export interface VistaCaixa {
  unread: number
  messages: MensagemDaCaixa[]
  muted: { id: string; who: Remetente }[]
}

const CITACAO = 140

function citar(s: string): string {
  const c = [...s]
  return c.length <= CITACAO ? s : `${c.slice(0, CITACAO - 1).join('')}…`
}

async function handlesSeguros(deps: MessageDeps, enderecos: string[]): Promise<Map<string, string>> {
  if (!enderecos.length) return new Map()
  try {
    return await deps.handles(enderecos)
  } catch {
    return new Map()
  }
}

/** A caixa de entrada da carteira da sessão. Só o que foi mandado PARA ela; o endereço inteiro de ninguém sai daqui. */
export async function caixa(deps: MessageDeps, wallet: string): Promise<VistaCaixa | Falha> {
  return comFalha(async () => {
    const [linhas, unread, silencios] = await Promise.all([
      deps.store.inbox(wallet, TETO_CAIXA),
      deps.store.unread(wallet),
      deps.store.mutes(wallet, TETO_SILENCIADOS),
    ])
    const doDono = linhas.filter((m) => m.to === wallet)
    const respondidas = [...new Set(doDono.flatMap((m) => (m.replyTo ? [m.replyTo] : [])))]
    const citacoes = respondidas.length ? await deps.store.ownBodies(wallet, respondidas) : new Map<string, string>()
    const enderecos = [...new Set([...doDono.map((m) => m.from), ...silencios.map((s) => s.wallet)])]
    const hs = await handlesSeguros(deps, enderecos)
    const quem = (a: string): Remetente => ({ handle: hs.get(a) ?? null, short: enderecoCurto(a) })
    return {
      unread,
      messages: doDono.map((m) => {
        const q = m.replyTo ? citacoes.get(m.replyTo) : undefined
        return {
          id: m.id, lot: m.lot, from: quem(m.from), text: m.body, at: m.createdAt, read: m.readAt !== null,
          reply: m.replyTo !== null, quote: q ? citar(q) : null,
        }
      }),
      muted: silencios.map((s) => ({ id: s.id, who: quem(s.wallet) })),
    }
  })
}

/** só o contador de não lidas (o selo do jogo) */
export async function naoLidas(deps: MessageDeps, wallet: string): Promise<{ unread: number } | Falha> {
  return comFalha(async () => ({ unread: await deps.store.unread(wallet) }))
}

export type MotivoAcao = 'unknown_action' | 'invalid_id' | 'not_found' | 'not_open' | 'unknown'
export type ResultadoAcao = { ok: true; unread: number } | { ok: false; why: MotivoAcao }

/** read { ids } | delete { id } | mute { id: mensagem } | unmute { id: silêncio }, sempre na caixa da sessão */
export async function agir(deps: MessageDeps, wallet: string, corpo: Record<string, unknown>): Promise<ResultadoAcao> {
  const acao = corpo.action
  if (acao !== 'read' && acao !== 'delete' && acao !== 'mute' && acao !== 'unmute') return { ok: false, why: 'unknown_action' }
  const r = await comFalha(async (): Promise<ResultadoAcao> => {
    if (acao === 'read') {
      const ids = idsValidos(corpo.ids)
      if (!ids) return { ok: false, why: 'invalid_id' }
      await deps.store.markRead(wallet, ids)
    } else {
      const id = idValido(corpo.id)
      if (!id) return { ok: false, why: 'invalid_id' }
      const feito =
        acao === 'delete' ? await deps.store.remove(wallet, id)
        : acao === 'mute' ? await deps.store.mute(wallet, id)
        : await deps.store.unmute(wallet, id)
      if (!feito) return { ok: false, why: 'not_found' }
    }
    return { ok: true, unread: await deps.store.unread(wallet) }
  })
  return r
}
