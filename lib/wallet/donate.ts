"use client"

// Doação disparada de dentro do DogData: a pessoa clica no CTA e a própria
// carteira monta, assina e transmite a transação. Nada de PSBT nosso.
//
// ⚠️ QUEM CONSEGUE FAZER ISSO HOJE: quem fala o protocolo sats-connect (Xverse,
// e a OKX quando anuncia o provider) e a UniSat pelo provider próprio
// (`sendRunes` e `sendBitcoin`). A Kray expõe apenas conectar,
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
//
// ⚠️ UNISAT. O `sendRunes(address, runeid, amount)` também recebe unidades
// ATÔMICAS: conferido no código da extensão (unisat-wallet/extension, master
// 5c58409b, 17/12/2025). O pedido do site vira `runeAmount` em
// `prepareSendRunes` (src/ui/pages/Approval/components/SignPsbt/hooks/
// usePsbtInitializer.ts), a mesma função que a tela de envio da própria UniSat
// chama depois de `runesUtils.fromDecimalAmount(valor, divisibilidade)`
// (src/ui/pages/Runes/SendRunesScreen.tsx). A UniSat não tem método
// documentado de saldo de runa, então para ela não há leitura de saldo antes:
// quem barra o valor acima do saldo é a própria carteira.

import { request } from 'sats-connect'
import { findProviderId } from './connectors/satsconnect'
import { getUnisatProvider, isUnisatRejection } from './connectors/unisat'
import { WALLETS } from './wallets'
import type { WalletId } from './types'

export const DOG_RUNE_NAME = 'DOG•GO•TO•THE•MOON'
export const DOG_DIVISIBILITY_FALLBACK = 5
// O id da runa (bloco 840.000, transação 3), que é o que a UniSat pede.
export const DOG_RUNE_ID = '840000:3'

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
const RPC_WALLETS: WalletId[] = ['xverse', 'okx', 'unisat']

/** A carteira conectada fala sats-connect? É o que separa um clique de um QR. */
export function donationSupport(walletId: WalletId | null): 'rpc' | 'manual' {
  if (!walletId || !RPC_WALLETS.includes(walletId)) return 'manual'
  if (walletId === 'unisat') return getUnisatProvider() ? 'rpc' : 'manual'
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
  if (/not supported|unsupported|not a function/i.test(message)) return 'This wallet cannot send from inside a site yet.'
  if (code === -32601) return 'This wallet cannot send from inside a site yet.'
  if (/insufficient|balance/i.test(message)) return 'Not enough balance for that amount plus fees.'
  return message || fallback
}

/** Saldo de DOG visto pela carteira. null quando ela não responde a pergunta. */
export async function readDogBalance(walletId: WalletId | null): Promise<RuneBalance | null> {
  if (walletId === 'unisat') return null
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
  if (walletId === 'unisat') {
    const amount = toAtomic(amountDog, divisibility)
    return unisatSend((p) => p.sendRunes(address, DOG_RUNE_ID, amount))
  }
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
  if (walletId === 'unisat') {
    return unisatSend((p) => p.sendBitcoin(address, Math.round(sats)))
  }
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

// A UniSat devolve o txid como texto (`sendBitcoin`) ou dentro de um objeto
// (`sendRunes`, conforme a versão), e recusa lançando erro em vez de devolver
// status. Normaliza as duas coisas para o formato das outras carteiras.
async function unisatSend(
  run: (p: NonNullable<ReturnType<typeof getUnisatProvider>>) => Promise<string | { txid: string }>,
): Promise<DonationResult> {
  const p = getUnisatProvider()
  if (!p) throw new Error('UniSat not detected. Install the extension and reload.')
  let out: string | { txid: string }
  try {
    out = await run(p)
  } catch (e: any) {
    if (isUnisatRejection(e)) throw new Error('Cancelled in your wallet.')
    throw new Error(toDonationError({ error: { code: e?.code, message: e?.message } }, 'The wallet did not complete the transfer.'))
  }
  const txid = typeof out === 'string' ? out : out?.txid
  if (!txid || !/^[0-9a-f]{64}$/i.test(txid)) throw new Error('The wallet did not return a transaction id.')
  return { txid }
}
