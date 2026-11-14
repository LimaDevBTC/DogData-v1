// As regras do desafio de login: o endereco que pode pedir desafio, a chave dele no Redis e o corpo do verify.
// Puro (sem Redis, sem Next): o teste em lib/wallet/desafio.test.ts roda sozinho.
//
// O DESAFIO E' DO NAVEGADOR QUE PEDIU. Antes a chave era `wnonce:<endereco>`: qualquer um pedia um desafio com o endereco de
// outra pessoa e sobrescrevia o dela (o login dela falhava em silencio), e a assinatura servia em qualquer navegador. Agora a
// chave leva tambem o cookie `dg_wchal`, que so' este navegador tem: um estranho nao toca no desafio de ninguem, e uma assinatura
// que vaze sozinha nao abre sessao. Isso NAO barra o repasse em tempo real por um site falso (o golpista segura o proprio cookie
// e faz a vitima assinar): contra esse, o que vale e' a linha `URI:` que a carteira mostra (lib/wallet/message.ts).
import { randomBytes } from 'node:crypto'
import type { SignatureProtocol, WalletId } from './types'

export const COOKIE_DESAFIO = 'dg_wchal'
const RE_VINCULO = /^[a-f0-9]{32}$/
// bech32/bech32m de mainnet ou base58 (1..., 3...), o que as carteiras do site entregam (lib/wallet/types.ts: network 'mainnet')
const RE_BECH32 = /^bc1[ac-hj-np-z02-9]{11,87}$/i
const RE_BASE58 = /^[13][1-9A-HJ-NP-Za-km-z]{25,34}$/
const RE_HEX = /^(0x)?[0-9a-fA-F]+$/
const PROTOCOLOS: readonly SignatureProtocol[] = ['bip322', 'ecdsa', 'bip340-schnorr']
const CARTEIRAS: readonly WalletId[] = ['xverse', 'okx', 'kray', 'unisat']

export const TETO_ASSINATURA = 4096
export const TETO_CORPO_VERIFY = 16 * 1024
export const TETO_CORPO_NONCE = 1024

export function enderecoValido(a: unknown): a is string {
  return typeof a === 'string' && (RE_BECH32.test(a) || RE_BASE58.test(a))
}

export function vinculoValido(v: unknown): v is string {
  return typeof v === 'string' && RE_VINCULO.test(v)
}

export function novoVinculo(): string {
  return randomBytes(16).toString('hex')
}

export function chaveDesafio(endereco: string, vinculo: string): string {
  return `wnonce:${endereco}:${vinculo}`
}

export interface PedidoVerify {
  address: string
  signature: string
  protocol: SignatureProtocol
  publicKey?: string
  walletId: WalletId | null
  visitorId: string | null
  sessionId: string | null
  ref: unknown
}

const textoCurto = (v: unknown, max: number): string | null => (typeof v === 'string' && v.length > 0 ? v.slice(0, max) : null)

/** O corpo do verify conferido, ou null. Carteira desconhecida vira null (a sessao segue): o campo e' so' informativo. */
export function lerPedidoVerify(corpo: unknown): PedidoVerify | null {
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) return null
  const b = corpo as Record<string, unknown>
  if (!enderecoValido(b.address)) return null
  if (typeof b.signature !== 'string' || b.signature.length === 0 || b.signature.length > TETO_ASSINATURA) return null
  if (!PROTOCOLOS.includes(b.protocol as SignatureProtocol)) return null
  if (b.publicKey !== undefined && b.publicKey !== null) {
    if (typeof b.publicKey !== 'string' || b.publicKey.length > 132 || !RE_HEX.test(b.publicKey)) return null
  }
  return {
    address: b.address,
    signature: b.signature,
    protocol: b.protocol as SignatureProtocol,
    publicKey: typeof b.publicKey === 'string' ? b.publicKey : undefined,
    walletId: CARTEIRAS.includes(b.walletId as WalletId) ? (b.walletId as WalletId) : null,
    visitorId: textoCurto(b.visitor_id, 64),
    sessionId: textoCurto(b.session_id, 64),
    ref: b.ref,
  }
}
