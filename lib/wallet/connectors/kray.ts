import type { WalletConnector, ConnectedAccount, SignedMessage } from '../types'

// A Kray tem provider próprio (window.krayWallet), nível aberto — connect + assinar.
// Só expõe endereço taproot (bc1p), que é onde os DOG Runes de L1 ficam.
function kray(): any {
  if (typeof window === 'undefined' || !(window as any).krayWallet) {
    throw new Error('Instale a Kray Wallet.')
  }
  return (window as any).krayWallet
}

function normalizePubkey(pk: any): string | undefined {
  if (!pk) return undefined
  return typeof pk === 'string' ? pk : pk.publicKey
}

export function createKrayConnector(): WalletConnector {
  return {
    id: 'kray',

    isInstalled() {
      return typeof window !== 'undefined' && !!(window as any).krayWallet
    },

    async connect(): Promise<ConnectedAccount> {
      const w = kray()
      const acc = await w.requestAccounts()
      const address = Array.isArray(acc) ? acc[0] : acc?.address ?? acc
      if (!address || typeof address !== 'string') {
        throw new Error('Conexão recusada pela Kray Wallet.')
      }

      let publicKey: string | undefined
      try {
        publicKey = normalizePubkey(await w.getPublicKey())
      } catch {
        /* opcional */
      }

      return {
        walletId: 'kray',
        ordinalsAddress: address,
        ordinalsPublicKey: publicKey,
        paymentAddress: address, // Kray = taproot only
        paymentPublicKey: publicKey,
        network: 'mainnet',
      }
    },

    async signMessage(address, message): Promise<SignedMessage> {
      const w = kray()
      // signMessageWithConfirmation → sempre abre popup (ação sensível).
      // Retorna assinatura Schnorr BIP-340 (verificada server-side com @noble/curves).
      const res = await w.signMessageWithConfirmation(message)
      const signature = typeof res === 'string' ? res : res?.signature
      if (!signature) throw new Error('Assinatura recusada.')
      let publicKey: string | undefined
      try {
        publicKey = normalizePubkey(await w.getPublicKey())
      } catch {
        /* opcional */
      }
      return { address, message, signature, publicKey, protocol: 'bip340-schnorr' }
    },
  }
}
