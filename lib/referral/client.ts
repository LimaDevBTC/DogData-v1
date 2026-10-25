// Referral, lado do navegador: guardar o ref que trouxe a pessoa e entrega-lo ao verify.
//
// O ref vive em localStorage (nao em cookie) por 30 dias. Ele viaja no CORPO do POST
// /api/wallet/verify (campo `ref`), nunca por cookie: o jogo (play.dogcity.space) e o mint
// usam a mesma API pelo rewrite de /api e nao dividem cookie com este dominio.
//
// Regras do navegador (as do servidor ficam em lib/referral/link.ts):
//  * o PRIMEIRO link valido ganha enquanto estiver no prazo: um segundo link nao o troca;
//  * o ref e' CONSUMIDO na primeira verificacao bem sucedida deste navegador, tenha vinculado
//    ou nao: ele so serve a carteira que verifica pela primeira vez;
//  * storage indisponivel (aba privada, bloqueio) nunca lanca: sem ref, o fluxo segue igual.

import { parseRef, REF_TTL_MS } from './ref'

export const REF_STORAGE_KEY = 'dogdata-ref'

/** o pedaco de Storage que isto usa (facilita o teste sem navegador) */
export interface RefStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function defaultStorage(): RefStorage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

/** O handle guardado e ainda no prazo, ou null (e limpa o que venceu ou estragou). */
export function readStoredRef(now: number = Date.now(), storage: RefStorage | null = defaultStorage()): string | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(REF_STORAGE_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as { h?: unknown; t?: unknown }
    const handle = parseRef(v?.h)
    const at = typeof v?.t === 'number' && Number.isFinite(v.t) ? v.t : NaN
    if (!handle || !(at <= now) || now - at > REF_TTL_MS) {
      storage.removeItem(REF_STORAGE_KEY)
      return null
    }
    return handle
  } catch {
    try { storage.removeItem(REF_STORAGE_KEY) } catch { /* sem storage, sem ref */ }
    return null
  }
}

/**
 * Le `?ref=` da consulta da pagina e guarda, se for valido e nao houver outro ainda no prazo.
 * Devolve o handle guardado agora, ou null.
 */
export function captureRef(
  search: string,
  now: number = Date.now(),
  storage: RefStorage | null = defaultStorage(),
): string | null {
  if (!storage) return null
  try {
    const handle = parseRef(new URLSearchParams(search).get('ref'))
    if (!handle) return null
    if (readStoredRef(now, storage)) return null // o primeiro vale
    storage.setItem(REF_STORAGE_KEY, JSON.stringify({ h: handle, t: now }))
    return handle
  } catch {
    return null
  }
}

/** Apos a primeira verificacao bem sucedida o ref cumpriu o papel. */
export function clearStoredRef(storage: RefStorage | null = defaultStorage()): void {
  try { storage?.removeItem(REF_STORAGE_KEY) } catch { /* ignore */ }
}
