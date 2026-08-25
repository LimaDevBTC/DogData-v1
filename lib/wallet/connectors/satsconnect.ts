import {
  request,
  getProviders,
  setDefaultProvider,
  removeDefaultProvider,
  AddressPurpose,
  MessageSigningProtocols,
} from 'sats-connect'
import type { WalletConnector, ConnectedAccount, SignedMessage, WalletId } from '../types'
import { WALLETS } from '../wallets'

interface ScAddress {
  address: string
  publicKey?: string
  purpose: string
  addressType?: string
}

// Descobre o providerId (caminho no window, ex. "XverseProviders.BitcoinProvider")
// casando por nome/id nos providers realmente instalados. Evita hardcode frágil.
function findProviderId(keywords: string[]): string | null {
  try {
    const providers = getProviders() as Array<{ id: string; name: string }>
    const hit = providers.find((p) =>
      keywords.some(
        (k) =>
          p.name?.toLowerCase().includes(k) || p.id?.toLowerCase().includes(k),
      ),
    )
    return hit?.id ?? null
  } catch {
    return null
  }
}

export function createSatsConnectConnector(id: WalletId): WalletConnector {
  const meta = WALLETS[id]

  return {
    id,

    isInstalled() {
      if (typeof window === 'undefined') return false
      return findProviderId(meta.providerKeywords) !== null
    },

    async connect(): Promise<ConnectedAccount> {
      const providerId = findProviderId(meta.providerKeywords)
      if (!providerId) throw new Error(`${meta.name} não detectada. Instale a extensão.`)

      const res: any = await request(
        'wallet_connect',
        {
          addresses: [AddressPurpose.Payment, AddressPurpose.Ordinals],
          message: 'Conectar à DOG DATA',
        } as any,
        providerId,
      )

      if (res?.status !== 'success') {
        throw new Error(res?.error?.message || 'Conexão recusada pelo usuário.')
      }

      const addresses: ScAddress[] = res.result.addresses ?? []
      const ord =
        addresses.find((a) => a.purpose === AddressPurpose.Ordinals) ?? addresses[0]
      const pay =
        addresses.find((a) => a.purpose === AddressPurpose.Payment) ?? ord
      if (!ord) throw new Error('Nenhum endereço retornado pela carteira.')

      // Fixa o provider como default p/ as próximas chamadas (signMessage).
      setDefaultProvider(providerId)

      return {
        walletId: id,
        ordinalsAddress: ord.address,
        ordinalsPublicKey: ord.publicKey,
        paymentAddress: pay.address,
        paymentPublicKey: pay.publicKey,
        network: 'mainnet',
      }
    },

    async signMessage(address, message): Promise<SignedMessage> {
      const providerId = findProviderId(meta.providerKeywords) ?? undefined
      // Endereço taproot → BIP-322 (verificado server-side com bip322-js).
      const res: any = await request(
        'signMessage',
        {
          address,
          message,
          protocol: MessageSigningProtocols.BIP322,
        } as any,
        providerId,
      )
      if (res?.status !== 'success') {
        throw new Error(res?.error?.message || 'Assinatura recusada.')
      }
      return {
        address,
        message,
        signature: res.result.signature,
        protocol: 'bip322',
      }
    },

    async disconnect() {
      try {
        removeDefaultProvider()
      } catch {
        /* noop */
      }
    },
  }
}
