// DOG Phone (Mensagens): as regras puras de entrada. Sem I/O, sem Next. Tudo que chega do corpo ou da query passa por aqui
// antes de virar argumento das funções da migração 046 (as regras de vínculo, bloqueio e teto moram no SQL, atômicas).
import { createHmac } from 'node:crypto'

export const LIMITES = {
  /** caracteres por mensagem (o mesmo CHECK da tabela) */
  texto: 500,
  /** mensagens por página do histórico */
  pagina: 30,
  paginaMax: 50,
  /** pedidos enviados ainda sem resposta */
  pedidosPendentes: 20,
  /** pedidos enviados por dia */
  pedidosDia: 30,
  /** dias até poder pedir de novo a quem recusou */
  recusaDias: 7,
  /** mensagens por minuto, por remetente */
  mensagensMinuto: 30,
  /** denúncias por dia */
  denunciasDia: 5,
  motivo: 300,
} as const

const HANDLE = /^[a-z0-9_]{3,15}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const CID = /^[A-Za-z0-9_-]{8,40}$/

/** "@Fulano " -> "fulano"; null se não tem o formato de handle (a busca é pelo handle EXATO, nunca por pedaço) */
export function lerHandle(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const h = v.trim().replace(/^@/, '').toLowerCase()
  return HANDLE.test(h) ? h : null
}

export function lerId(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const id = v.trim().toLowerCase()
  return UUID.test(id) ? id : null
}

export function lerCid(v: unknown): string | null {
  return typeof v === 'string' && CID.test(v) ? v : null
}

/** id de mensagem (bigint do banco, que cabe em número seguro por muitos anos) */
export function lerIdMensagem(v: unknown): number | null {
  const n = typeof v === 'string' && /^\d{1,15}$/.test(v) ? Number(v) : v
  return typeof n === 'number' && Number.isSafeInteger(n) && n > 0 ? n : null
}

// controle (menos a quebra de linha), invisíveis e os comandos de direção que embaralham o texto de quem lê
const PROIBIDOS = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F​-‏‪-‮⁠-⁩﻿]/g

export type TextoLido = { ok: true; texto: string } | { ok: false; why: 'empty' | 'too_long' | 'invalid_text' }

/** O texto de uma mensagem: NFC, sem controle nem invisível, no máximo duas quebras seguidas, 1 a 500 caracteres. */
export function lerTexto(v: unknown): TextoLido {
  if (typeof v !== 'string') return { ok: false, why: 'invalid_text' }
  if (v.length > LIMITES.texto * 8) return { ok: false, why: 'too_long' }
  let s: string
  try {
    s = v.normalize('NFC')
  } catch {
    return { ok: false, why: 'invalid_text' }
  }
  s = s.replace(/\r\n?/g, '\n').replace(PROIBIDOS, '').replace(/\n{3,}/g, '\n\n').trim()
  // par substituto solto: o banco recusaria e o cliente desenharia lixo
  if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(s)) return { ok: false, why: 'invalid_text' }
  const n = [...s].length
  if (n === 0) return { ok: false, why: 'empty' }
  if (n > LIMITES.texto) return { ok: false, why: 'too_long' }
  return { ok: true, texto: s }
}

export function lerMotivo(v: unknown): string {
  if (typeof v !== 'string') return ''
  return [...v.normalize('NFC').replace(PROIBIDOS, '').replace(/\s+/g, ' ').trim()].slice(0, LIMITES.motivo).join('')
}

/**
 * A chave da cutucada de uma conta: o que o jogo publica no canal aberto para avisar "tem novidade no seu celular", sem
 * conteúdo. É um HMAC do id com um segredo do servidor: quem escuta o canal não descobre de quem é, e quem recebe só busca
 * o que é seu com o próprio cookie. Não dá acesso a nada.
 */
export function chaveCutucada(segredo: string, id: string): string {
  return createHmac('sha256', segredo).update(`dogphone:nudge:${id}`).digest('hex').slice(0, 20)
}
