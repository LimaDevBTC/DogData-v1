// Programa de embaixadores (18/11/2026): quem chegou com `?ref=@handle` leva o handle junto para o mint. Helper PURO: monta a URL.
// O handle viaja como veio guardado (lib/referral/client.ts já o validou): [a-z0-9_]{3,15}, então não precisa de escape.
import { parseRef } from "../../../lib/referral/ref"

export const MINT_HOSTNAME = "mint.dogcity.space"
export const PLAY_HOSTNAME = "play.dogcity.space"

/** Para onde um link de saída leva. Só estes dois levam à compra; o resto (docs, atlas, ranking) fica no site. */
export type Destino = "mint" | "play"

/** O destino do link (mint ou jogo), ou null para qualquer outra coisa: relativo, inválido, outro host, http. */
export function destinoDoLink(href: string | null | undefined): Destino | null {
  if (!href) return null
  let u: URL
  try { u = new URL(href) } catch { return null }
  if (u.protocol !== "https:") return null
  if (u.hostname === MINT_HOSTNAME) return "mint"
  if (u.hostname === PLAY_HOSTNAME) return "play"
  return null
}

/**
 * `href` com `ref=@handle` quando aponta para o mint OU para o jogo e o handle é válido. O jogo lê `?ref=` na entrada
 * (src/carteira/ref.ts do dogcity-mundo) e o manda no verify da carteira. Qualquer outra coisa volta intacta: outro host,
 * link já com `ref`, href relativo ou inválido, handle ausente ou inválido.
 */
export function withOutboundRef(href: string, handle: string | null | undefined): string {
  const h = parseRef(handle)
  if (!h) return href
  let u: URL
  try { u = new URL(href) } catch { return href }
  if (destinoDoLink(href) === null) return href
  if (u.searchParams.has("ref")) return href
  u.search = u.search ? `${u.search}&ref=@${h}` : `?ref=@${h}`
  return u.toString()
}

/** Só o mint (compatibilidade com o uso de 18/11). */
export function withMintRef(href: string, handle: string | null | undefined): string {
  return destinoDoLink(href) === "mint" ? withOutboundRef(href, handle) : href
}

// ── medir o clique de saída ──────────────────────────────────────────────────────────────────────────────
/** O pedaço de um elemento que a medição usa (facilita o teste sem DOM). */
export interface ElementoMedido {
  closest(sel: string): { id?: string } | null
  textContent?: string | null
}

/**
 * Em que parte da página está o botão: drawer (gaveta do menu), nav (barra), footer, o id da seção (`lookup`, `calendar`,
 * `deeds`...), hero (herói e contador) ou page. Lê só a posição no DOM, então nenhum botão precisa de marca própria.
 */
export function ondeNaPagina(el: ElementoMedido): string {
  if (el.closest("#dc-drawer")) return "drawer"
  if (el.closest("nav")) return "nav"
  if (el.closest("footer")) return "footer"
  const sec = el.closest("section[id]")
  if (sec?.id) return sec.id.slice(0, 40)
  if (el.closest("#build, #top")) return "hero"
  return "page"
}

/**
 * O `event_meta` do evento `landing_cta_click`. `has_ref` é só um sim/não: o handle NUNCA entra no evento (ele já vai em
 * utm_source da sessão, que o rastreador grava a partir do `?ref=` da URL).
 */
export function metaDoClique(el: ElementoMedido, href: string, hasRef: boolean): { where: string; dest: Destino; label: string; has_ref: boolean } | null {
  const dest = destinoDoLink(href)
  if (!dest) return null
  const label = (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40)
  return { where: ondeNaPagina(el), dest, label, has_ref: hasRef }
}
