import type { WalletConnector, ConnectedAccount, SignedMessage } from '../types'

// A Kray tem provider próprio (window.krayWallet), sem passar por sats-connect.
// Só expõe endereço taproot (bc1p), que é onde os DOG Runes de L1 ficam.
//
// Contrato de requestAccounts() confirmado pelo conector do OrdCards que
// conecta essa mesma extensão em produção (bitcoin-fullstack/OrdCards,
// apps/web/lib/wallet/kray.ts): devolve UM OBJETO, { success, address,
// publicKey? }, nunca uma lista de contas.
interface KrayConnectionResult {
  success: boolean
  address?: string
  publicKey?: string
}

interface KrayProvider {
  requestAccounts(): Promise<KrayConnectionResult>
  getPublicKey?(): Promise<string | { publicKey: string }>
  signMessageWithConfirmation?(message: string): Promise<string | { signature: string }>
}

const TAPROOT = /^bc1p[023456789acdefghjklmnpqrstuvwxyz]{58}$/i

function kray(): KrayProvider {
  if (typeof window === 'undefined' || !(window as any).krayWallet) {
    throw new Error('Install Kray Wallet.')
  }
  return (window as any).krayWallet as KrayProvider
}

function normalizePubkey(pk: unknown): string | undefined {
  if (!pk) return undefined
  return typeof pk === 'string' ? pk : (pk as { publicKey?: string }).publicKey
}

export function createKrayConnector(): WalletConnector {
  return {
    id: 'kray',

    isInstalled() {
      return typeof window !== 'undefined' && !!(window as any).krayWallet
    },

    async connect(): Promise<ConnectedAccount> {
      const w = kray()
      const result = await w.requestAccounts()

      // A extensão respondeu mas recusou (popup fechado, ou sem conta
      // Bitcoin ativa). Falha honesta, sem inventar uma conta a partir de
      // um objeto vazio como o conector antigo fazia.
      if (!result?.success || !result.address) {
        throw new Error('Kray refused the connection. Open the Kray extension and approve this site.')
      }
      if (!TAPROOT.test(result.address.trim())) {
        throw new Error('Kray Wallet must return its Taproot (bc1p) address.')
      }

      let publicKey = normalizePubkey(result.publicKey)
      if (!publicKey) {
        try {
          publicKey = normalizePubkey(await w.getPublicKey?.())
        } catch {
          /* opcional */
        }
      }

      return {
        walletId: 'kray',
        ordinalsAddress: result.address,
        ordinalsPublicKey: publicKey,
        paymentAddress: result.address, // Kray = taproot only
        paymentPublicKey: publicKey,
        network: 'mainnet',
      }
    },

    async signMessage(address, message): Promise<SignedMessage> {
      const w = kray()
      if (!w.signMessageWithConfirmation) {
        throw new Error('This build of Kray Wallet cannot sign messages yet.')
      }
      // signMessageWithConfirmation → sempre abre popup (ação sensível).
      // Retorna assinatura Schnorr BIP-340 (verificada server-side com @noble/curves).
      const res = await w.signMessageWithConfirmation(message)
      const signature = typeof res === 'string' ? res : res?.signature
      if (!signature) throw new Error('Signature request was declined.')
      let publicKey: string | undefined
      try {
        publicKey = normalizePubkey(await w.getPublicKey?.())
      } catch {
        /* opcional */
      }
      return { address, message, signature, publicKey, protocol: 'bip340-schnorr' }
    },
  }
}
