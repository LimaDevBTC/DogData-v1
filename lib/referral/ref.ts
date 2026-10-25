// Referral: o valor de `?ref=` e o link de quem indica. Modulo puro, sem I/O.
//
// O link leva o @handle de quem indica: https://dogcity.space/?ref=@handle (a landing) ou
// https://www.dogdata.xyz/?ref=@handle (o DogData). O handle e o nome publico da conta; o
// endereco da carteira nunca aparece no link.
//
// O handle pode ser renomeado (POST /api/profile faz upsert por endereco). Por isso o vinculo
// NAO guarda o handle como chave: o servidor resolve o handle para o endereco no instante da
// primeira verificacao e grava o endereco. Link antigo de um handle que mudou deixa de resolver
// e e ignorado em silencio, sem derrubar nada.

import { validateHandle } from '../identity/handle'

/** a landing e' a casa do link; o mesmo ?ref= tambem vale em www.dogdata.xyz */
export const REF_ORIGIN = 'https://dogcity.space'
/** por quanto tempo o navegador lembra do link que trouxe a pessoa */
export const REF_TTL_DAYS = 30
export const REF_TTL_MS = REF_TTL_DAYS * 24 * 60 * 60 * 1000

/**
 * O valor bruto de `?ref=` (ou do campo `ref` do corpo do verify) vira um handle valido, ou null.
 * Aceita `@nome` e `nome`; tira espaco e caixa; aplica a MESMA regra de handle do perfil
 * (3 a 15 de a-z 0-9 _, fora os reservados). Nunca lanca: lixo vira null.
 */
export function parseRef(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const t = raw.trim()
  if (t.length === 0 || t.length > 40) return null
  const v = validateHandle(t.startsWith('@') ? t.slice(1) : t)
  return v.ok && v.handle ? v.handle : null
}

/** O link que a pessoa copia no perfil. */
export function refLink(handle: string, origin: string = REF_ORIGIN): string {
  return `${origin}/?ref=@${handle}`
}

/** Endereco abreviado para tela publica: nunca o endereco inteiro de quem nao pediu. */
export function shortAddress(address: string): string {
  return address.length > 20 ? `${address.slice(0, 10)}…${address.slice(-6)}` : address
}
