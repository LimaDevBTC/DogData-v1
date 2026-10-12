// O chat do jogo (a aba "Default" da DOG CITY, 12/10/2026): um chat so', a cidade inteira le, quem
// esta' perto ve o balao, e a mensagem privada (@nome) vai so' para quem foi chamado. Modulo puro,
// sem I/O.
//
// O jogo (repo dogcity-mundo) fala pelo Supabase Realtime, cujo broadcast NAO autentica quem
// manda. Por isso a fala passa antes por aqui (POST /api/chat/nearby): a rota confere a sessao,
// o ritmo e o texto, carimba quem falou, onde e quando, e ASSINA (ECDSA P-256). O cliente que
// le so' mostra fala com assinatura valida (dogcity-mundo src/social/assinatura_fala.ts). A
// privada nunca vai ao broadcast: fica na caixa do destinatario (app/api/chat/nearby/inbox).
//
// A normalizacao do texto e' a MESMA de dogcity-mundo src/social/regras_fala.ts (normalizarFala):
// mudou la', muda aqui. Os dois lados conferem os mesmos casos.

export const MAX_GRAFEMAS = 140
export const MAX_UNIDADES = 560
export const INTERVALO_MS = 2000

const RE_ID = /^[a-z0-9]{6,32}$/
/** o handle do DogData (lib/identity/handle.ts) com a arroba: o nome que a privada chama */
const RE_HANDLE_ARROBA = /^@[a-z0-9_]{3,15}$/
const LIMITE_MUNDO = 20_000
const LIMITE_ALTURA = 5_000

type Segmentador = { segment(t: string): Iterable<unknown> }
let segmentador: Segmentador | null | undefined

export function contarGrafemas(texto: string): number {
  if (segmentador === undefined) {
    const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => Segmentador }).Segmenter
    segmentador = Seg ? new Seg(undefined, { granularity: 'grapheme' }) : null
  }
  if (!segmentador) return Array.from(texto).length
  let n = 0
  for (const _ of segmentador.segment(texto)) n++
  return n
}

/** O texto como vai ao mundo, ou null (vazio, invisivel, ou mais de 140 grafemas). */
export function normalizarFala(bruto: unknown): string | null {
  if (typeof bruto !== 'string' || bruto.length > 4000) return null
  let t = bruto
  t = t.replace(/[\u0000-\u001F\u007F-\u009F\u2028\u2029]/g, ' ')
  t = t.replace(/[\u00AD\u061C\u180E\u200B\u200E\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g, '')
  t = t.normalize('NFC')
  t = t.replace(/(\p{M}{3})\p{M}+/gu, '$1')
  t = t.replace(/\s+/gu, ' ').trim()
  if (!t || !/[\p{L}\p{N}\p{P}\p{S}]/u.test(t)) return null
  if (t.length > MAX_UNIDADES || contarGrafemas(t) > MAX_GRAFEMAS) return null
  return t
}

export interface PedidoFala {
  /** id de rede do jogador no jogo (o mesmo da pose) */
  id: string
  /** id do cliente para esta mensagem: o reenvio com o mesmo cid devolve a mesma fala */
  cid: string
  texto: string
  x: number
  y: number
  z: number
  /** mensagem privada: o id de rede de quem recebe; null = publica (a cidade inteira le) */
  para: string | null
  /**
   * o nome que quem escreveu VIU no destino: '@handle', ou null para o convidado. A rota confere
   * com o nome que o servidor conhece daquele id: a privada nunca cai num impostor.
   */
  paraNome: string | null
}

export type ErroPedido = 'corpo' | 'id' | 'texto' | 'posicao' | 'para'

const num = (v: unknown, lim: number): v is number => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= lim

/** Confere o corpo do POST campo a campo. Nada do cliente e' confiado sem passar por aqui. */
export function lerPedido(corpo: unknown): PedidoFala | ErroPedido {
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) return 'corpo'
  const o = corpo as Record<string, unknown>
  if (typeof o.id !== 'string' || !RE_ID.test(o.id)) return 'id'
  if (typeof o.cid !== 'string' || !RE_ID.test(o.cid)) return 'corpo'
  const texto = normalizarFala(o.text)
  if (!texto) return 'texto'
  if (!num(o.x, LIMITE_MUNDO) || !num(o.z, LIMITE_MUNDO) || !num(o.y, LIMITE_ALTURA)) return 'posicao'
  let para: string | null = null
  let paraNome: string | null = null
  if (o.to !== undefined && o.to !== null) {
    if (typeof o.to !== 'string' || !RE_ID.test(o.to) || o.to === o.id) return 'para'
    para = o.to
    if (o.toName !== undefined && o.toName !== null) {
      if (typeof o.toName !== 'string' || !RE_HANDLE_ARROBA.test(o.toName)) return 'para'
      paraNome = o.toName
    }
  }
  return { id: o.id, cid: o.cid, texto, x: o.x, y: o.y, z: o.z, para, paraNome }
}

/** O corpo da caixa de privadas: {id, since}. `since` (ms do servidor) so' traz o que chegou depois. */
export function lerCaixa(corpo: unknown): { id: string; desde: number } | null {
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) return null
  const o = corpo as Record<string, unknown>
  if (typeof o.id !== 'string' || !RE_ID.test(o.id)) return null
  const desde = o.since === undefined || o.since === null ? 0 : o.since
  if (!num(desde, 1e15) || desde < 0) return null
  return { id: o.id, desde }
}

/** O `at` (hora do servidor) de um envelope guardado; 0 se o JSON nao serve. */
export function horaDe(d: unknown): number {
  if (typeof d !== 'string' || d.length > 4096) return 0
  try {
    const at = (JSON.parse(d) as { at?: unknown }).at
    return typeof at === 'number' && Number.isFinite(at) ? at : 0
  } catch {
    return 0
  }
}

const r2 = (v: number): number => Math.round(v * 100) / 100

/**
 * O JSON que e' assinado, com a ordem fixa dos campos. `n`: '@handle' da carteira provada, ou
 * null para o convidado (o jogo monta "guest-xxxx" a partir do id). `p`: o id de quem recebe a
 * privada (null na publica) e `pn` o nome dele que o SERVIDOR conhece (null: convidado).
 */
export function corpoFala(p: PedidoFala, mid: string, nome: string | null, agora: number, paraNome: string | null = null): string {
  return JSON.stringify({
    v: 1, mid, id: p.id, n: nome, t: p.texto, x: r2(p.x), y: r2(p.y), z: r2(p.z), at: agora,
    p: p.para, pn: p.para ? paraNome : null,
  })
}

export function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
