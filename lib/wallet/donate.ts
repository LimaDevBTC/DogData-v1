"use client"

// Doação disparada de dentro do DogData: a pessoa clica no CTA e a própria
// carteira monta, assina e transmite a transação. Nada de PSBT nosso.
//
// ⚠️ QUEM CONSEGUE FAZER ISSO HOJE: só quem fala o protocolo sats-connect
// (Xverse, e a OKX quando anuncia o provider). A Kray expõe apenas conectar,
// chave pública e assinar mensagem, então para ela o caminho honesto continua
// sendo o endereço e o QR. `donationSupport()` responde isso ANTES de a tela
// prometer um botão que não existe.
//
// ⚠️ UNIDADE DA TRANSFERÊNCIA DE RUNE. A documentação do sats-connect não diz
// se `amount` é em unidades de exibição ou nas unidades atômicas (DOG tem
// divisibilidade 5, ou seja, 1 DOG = 100.000 unidades). O esquema da versão
// instalada tipa como string, o exemplo da doc passa número, e as duas leituras
// diferem por 100.000x. Então aqui:
//   1. o saldo é lido antes (`runes_getBalance`), que devolve `amount` cru e a
//      `divisibility` do rune;
//   2. a conversão de exibição para atômico usa ESSA divisibilidade;
//   3. a tela mostra o número humano e o número atômico antes de disparar, e a
//      confirmação final é a da própria carteira.
// Se algum dia uma carteira interpretar diferente, o popup dela mostra o valor
// errado e a pessoa recusa: nenhum caminho aqui gasta moeda sem confirmação.

import { request } from 'sats-connect'
import { findProviderId } from './connectors/satsconnect'
import { WALLETS } from './wallets'
import type { WalletId } from './types'

export const DOG_RUNE_NAME = 'DOG•GO•TO•THE•MOON'
export const DOG_DIVISIBILITY_FALLBACK = 5

export type DonationAsset = 'dog' | 'btc'

export interface DonationResult {
  txid: string
}

export interface RuneBalance {
  /** Saldo em DOG, já dividido pela divisibilidade. */
  human: number
  /** O que a carteira diz poder gastar agora (exclui utxo em trânsito). */
  spendable: number
  divisibility: number
}

// Carteiras que falam o protocolo. A Kray fica de fora por fato, não por
// política: o provider dela (window.krayWallet) só tem conectar, chave pública
// e assinar mensagem. No dia em que ganhar transferência, entra nesta lista.
const RPC_WALLETS: WalletId[] = ['xverse', 'okx']

/** A carteira conectada fala sats-connect? É o que separa um clique de um QR. */
export function donationSupport(walletId: WalletId | null): 'rpc' | 'manual' {
  if (!walletId || !RPC_WALLETS.includes(walletId)) return 'manual'
  const meta = WALLETS[walletId]
  if (!meta?.providerKeywords?.length) return 'manual'
  return findProviderId(walletId, meta.providerKeywords) ? 'rpc' : 'manual'
}

function providerFor(walletId: WalletId | null): string | undefined {
  if (!walletId) return undefined
  const meta = WALLETS[walletId]
  return findProviderId(walletId, meta?.providerKeywords ?? []) ?? undefined
}

/** Erro da extensão → frase de tela. Recusar não é falha, é resposta. */
export function toDonationError(res: any, fallback: string): string {
  const code = res?.error?.code
  const message: string = res?.error?.message ?? ''
  if (code === 4001 || /reject|denied|cancel/i.test(message)) return 'Cancelled in your wallet.'
  if (code === -32601) return 'This wallet cannot send from inside a site yet.'
  if (/insufficient|balance/i.test(message)) return 'Not enough balance for that amount plus fees.'
  return message || fallback
}

/** Saldo de DOG visto pela carteira. null quando ela não responde a pergunta. */
export async function readDogBalance(walletId: WalletId | null): Promise<RuneBalance | null> {
  try {
    const res: any = await request('runes_getBalance', null as never, providerFor(walletId))
    if (res?.status !== 'success') return null
    const entry = (res.result?.balances ?? []).find(
      (b: any) => (b.runeName ?? '').toUpperCase() === DOG_RUNE_NAME,
    )
    if (!entry) return { human: 0, spendable: 0, divisibility: DOG_DIVISIBILITY_FALLBACK }
    const div = Number(entry.divisibility ?? DOG_DIVISIBILITY_FALLBACK)
    const scale = 10 ** div
    return {
      human: Number(entry.amount ?? 0) / scale,
      spendable: Number(entry.spendableBalance ?? entry.amount ?? 0) / scale,
      divisibility: div,
    }
  } catch {
    return null
  }
}

/** Quantas unidades atômicas valem `amountDog` DOG. String, sem notação científica. */
export function toAtomic(amountDog: number, divisibility: number): string {
  return BigInt(Math.round(amountDog * 10 ** divisibility)).toString()
}

export async function sendDogDonation(
  walletId: WalletId | null,
  address: string,
  amountDog: number,
  divisibility = DOG_DIVISIBILITY_FALLBACK,
): Promise<DonationResult> {
  const res: any = await request(
    'runes_transfer',
    {
      recipients: [
        {
          runeName: DOG_RUNE_NAME,
          amount: toAtomic(amountDog, divisibility),
          address,
        },
      ],
    } as never,
    providerFor(walletId),
  )
  if (res?.status !== 'success') {
    throw new Error(toDonationError(res, 'The wallet did not complete the transfer.'))
  }
  return { txid: res.result.txid }
}

export async function sendBtcDonation(
  walletId: WalletId | null,
  address: string,
  sats: number,
): Promise<DonationResult> {
  const res: any = await request(
    'sendTransfer',
    { recipients: [{ address, amount: Math.round(sats) }] } as never,
    providerFor(walletId),
  )
  if (res?.status !== 'success') {
    throw new Error(toDonationError(res, 'The wallet did not complete the transfer.'))
  }
  return { txid: res.result.txid }
}
