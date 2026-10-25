// Referral: o formato PUBLICO do placar. Modulo puro (sem banco), testado em board.test.ts.
//
// Regra de privacidade: o placar mostra @handle, ou o endereco ABREVIADO se a conta nao tiver handle.
// O endereco inteiro de quem indica nao sai daqui, e as carteiras indicadas nao aparecem em lugar nenhum.

import { shortAddress } from './ref'

export interface BoardRowRaw {
  referrer_address: string
  handle: string | null
  referred: number
  minted: number
  minted_lots: number
  licences_personal: number
  licences_commercial: number
  licences_patron: number
  licence_dog: number
  counted_at: string | null
  referrers_total: number
  referred_total: number
}

/** A linha publica do placar: nome (handle ou endereco abreviado) e contagens. NUNCA o endereco inteiro. */
export interface PublicBoardRow {
  rank: number
  name: string
  referred: number
  minted: number
  licences: { personal: number; commercial: number; patron: number }
  licence_dog: number
}

export interface PublicBoard {
  updated_at: string | null
  referrers: number
  referred: number
  rows: PublicBoardRow[]
}

export function toPublicBoard(raw: BoardRowRaw[]): PublicBoard {
  const rows = raw.map((r, i) => ({
    rank: i + 1,
    name: r.handle ? `@${r.handle}` : shortAddress(r.referrer_address),
    referred: r.referred,
    minted: r.minted,
    licences: { personal: r.licences_personal, commercial: r.licences_commercial, patron: r.licences_patron },
    licence_dog: r.licence_dog,
  }))
  const stamps = raw.map((r) => r.counted_at).filter((s): s is string => !!s).sort()
  return {
    updated_at: stamps.length ? stamps[stamps.length - 1] : null,
    referrers: raw[0]?.referrers_total ?? 0,
    referred: raw[0]?.referred_total ?? 0,
    rows,
  }
}
