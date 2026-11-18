// Programa de embaixadores (18/11/2026): quem chegou com `?ref=@handle` leva o handle junto para o mint. Helper PURO: monta a URL.
// O handle viaja como veio guardado (lib/referral/client.ts já o validou): [a-z0-9_]{3,15}, então não precisa de escape.
import { parseRef } from "../../../lib/referral/ref"

export const MINT_HOSTNAME = "mint.dogcity.space"

/**
 * `href` com `ref=@handle` quando aponta para o mint e o handle é válido. Qualquer outra coisa volta intacta: outro host,
 * link já com `ref`, href relativo ou inválido, handle ausente ou inválido.
 */
export function withMintRef(href: string, handle: string | null | undefined): string {
  const h = parseRef(handle)
  if (!h) return href
  let u: URL
  try { u = new URL(href) } catch { return href }
  if (u.protocol !== "https:" || u.hostname !== MINT_HOSTNAME) return href
  if (u.searchParams.has("ref")) return href
  u.search = u.search ? `${u.search}&ref=@${h}` : `?ref=@${h}`
  return u.toString()
}
