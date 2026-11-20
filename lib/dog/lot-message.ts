// ═══════════════════════════════════════════════════════════════════════════
// "MESSAGE THE OWNER": a regra pura da mensagem de um jogador para o dono de um lote (fundador, 20/11/2026). Sem rede, sem banco.
//
// É a coisa mais simples possível: texto puro, sem oferta, sem preço, sem negociação (a revenda só abre semanas depois). Substitui a
// "lista telefônica": quem quer falar com o vizinho vai ao lote dele e deixa a mensagem, sem ver telefone nem email de ninguém.
//
// REGRAS DO TEXTO (validarTexto; o jogo repete a mesma em src/lugares/mensagens_regras.ts):
//   - texto puro de 1 a 500 caracteres (pontos de código, não unidades UTF-16), depois de aparar os espaços;
//   - quebras de linha \r\n viram \n, e três ou mais seguidas viram duas;
//   - recusa caractere de controle (fora \n e \t) e os de direção de texto (que viram o texto ao contrário na tela);
//   - recusa link e URL: `http`, `://`, `www.` ou um domínio solto (`algo.com`), conferidos depois do NFKC (o ponto e as letras de
//     largura cheia viram os comuns). Isso evita golpe. Sem domínio sobra também sem email, que é contato fora do jogo.
//
// FREIOS (aplicados dentro da trava, na migração 045): 10 mensagens novas por dia por remetente, 1 por dia do mesmo remetente para o
// mesmo lote, e RESPOSTAS_POR_DIA respostas por dia. O dono pode silenciar um remetente.
// ═══════════════════════════════════════════════════════════════════════════

import { normalizeAddress } from './licence-btc'

export const MAX_CARACTERES = 500
export const MENSAGENS_POR_DIA = 10
/** respostas por dia por carteira: quem recebe muitas mensagens (um dono de muitos lotes) consegue responder a todas */
export const RESPOSTAS_POR_DIA = 40
/** a caixa devolve as mais recentes até este teto */
export const TETO_CAIXA = 50
/** silenciados que a caixa lista */
export const TETO_SILENCIADOS = 100
/** ids por pedido de "marcar como lida" */
export const TETO_IDS = 50

export type TextoErro = 'empty' | 'too_long' | 'link' | 'invalid_text'
export type TextoLido = { ok: true; texto: string } | { ok: false; why: TextoErro }

// C0 (fora \t \n; o \r já virou \n), DEL, C1 e os controles de direção (LRE..RLO, LRI..PDI)
const CONTROLE = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F‪-‮⁦-⁩]/u
const ESQUEMA = /:\/\/|\bhttps?\b|\bwww\b|\b(?:ftps?|javascript|ipfs|mailto)\s*:/iu
// um domínio solto: rótulo(s) separados por ponto e um fim de 2 a 24 letras, sem letra ou número colado depois
const DOMINIO = /(?:^|[^\p{L}\p{N}_-])(?:[\p{L}\p{N}][\p{L}\p{N}-]*\.)+\p{L}{2,24}(?![\p{L}\p{N}_-])/u

/** o texto tem link, URL ou domínio solto? (depois do NFKC: o ponto de largura cheia vira ponto) */
export function temLink(texto: string): boolean {
  const n = texto.normalize('NFKC')
  return ESQUEMA.test(n) || DOMINIO.test(n)
}

/** O texto do pedido, conferido e aparado. Tudo que não é string vira 'invalid_text'. */
export function validarTexto(bruto: unknown): TextoLido {
  if (typeof bruto !== 'string') return { ok: false, why: 'invalid_text' }
  // corta cedo um pedido absurdo antes de varrer (o corpo já tem teto em bytes; isto é só a defesa da própria função)
  if (bruto.length > MAX_CARACTERES * 8) return { ok: false, why: 'too_long' }
  const s = bruto.replace(/\r\n?/g, '\n')
  if (CONTROLE.test(s)) return { ok: false, why: 'invalid_text' }
  const texto = s.replace(/\n{3,}/g, '\n\n').trim()
  if (!texto) return { ok: false, why: 'empty' }
  if ([...texto].length > MAX_CARACTERES) return { ok: false, why: 'too_long' }
  if (temLink(texto)) return { ok: false, why: 'link' }
  return { ok: true, texto }
}

/** o endereço curto que a caixa mostra no lugar do handle: bc1p…abcd (nunca o endereço inteiro) */
export function enderecoCurto(endereco: string): string {
  return endereco.length <= 10 ? endereco : `${endereco.slice(0, 4)}…${endereco.slice(-4)}`
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** um id de mensagem ou de silêncio do pedido; outra coisa é null */
export function idValido(x: unknown): string | null {
  return typeof x === 'string' && UUID.test(x) ? x.toLowerCase() : null
}

/** a lista de ids de "marcar como lida": 1 a TETO_IDS uuids, sem repetir; outra coisa é null */
export function idsValidos(x: unknown): string[] | null {
  if (!Array.isArray(x) || x.length === 0 || x.length > TETO_IDS) return null
  const out: string[] = []
  for (const v of x) {
    const id = idValido(v)
    if (!id) return null
    if (!out.includes(id)) out.push(id)
  }
  return out
}

/**
 * O dono de UM lote na resposta de GET <mint>/api/mint/lots?ids=<lote> (a mesma que o job de indicação lê, lib/lot-referral/io.ts):
 * o endereço de quem guarda a escritura (lote mintado com `holder`), null quando o lote não foi mintado (ninguém guarda), undefined
 * para qualquer dúvida (forma errada, o lote não veio, mintado sem detentor). undefined = falha fechado: a mensagem não sai.
 */
export function donoNaResposta(corpo: unknown, lot: string): string | null | undefined {
  const o = corpo as { lots?: unknown } | null
  if (!o || typeof o !== 'object' || !Array.isArray(o.lots) || o.lots.length > 200) return undefined
  const l = (o.lots as Array<Record<string, unknown> | null>).find((x) => x && typeof x === 'object' && x.lotId === lot)
  if (!l) return undefined
  if (l.state === 'available' || l.state === 'reserved' || l.state === 'not_for_sale') return null
  if (l.state !== 'minted') return undefined
  return normalizeAddress(l.holder) ?? undefined
}
