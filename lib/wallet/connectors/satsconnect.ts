import {
  request,
  getProviders,
  isProviderInstalled,
  setDefaultProvider,
  removeDefaultProvider,
  AddressPurpose,
  BitcoinNetworkType,
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

// Caminhos legados (pré wallet-standard) pra carteiras que ainda expõem o
// provider só no objeto global clássico. Só a Xverse está confirmada aqui,
// pelo path documentado no próprio conector do OrdCards (apps/web/lib/wallet/xverse.ts),
// que conecta a mesma extensão em produção.
const LEGACY_PROVIDER_PATHS: Partial<Record<WalletId, string[]>> = {
  xverse: ['XverseProviders.BitcoinProvider', 'xverseProviders.BitcoinProvider'],
}

// Descobre o providerId (caminho no window, ex. "XverseProviders.BitcoinProvider")
// casando por nome/id nos providers realmente anunciados em window.btc_providers.
//
// getProviders() só LÊ esse array. Uma entrada pode ficar "anunciada" mas
// apontar pra um caminho que a extensão ainda não terminou de montar (corrida
// entre o anúncio wallet-standard e a extensão popular o objeto de verdade).
// Chamar wallet_connect contra um id que não resolve de fato no window é
// exatamente o tipo de coisa que a Xverse responde com "Failed to get
// selected account...". Por isso valida com isProviderInstalled antes de
// confiar, e cai pro caminho legado clássico quando o anúncio ainda não existe.
function findProviderId(id: WalletId, keywords: string[]): string | null {
  if (typeof window === 'undefined') return null
  try {
    const providers = getProviders() as Array<{ id: string; name: string }>
    const advertised = providers.find((p) =>
      keywords.some(
        (k) =>
          p.name?.toLowerCase().includes(k) || p.id?.toLowerCase().includes(k),
      ),
    )
    if (advertised && isProviderInstalled(advertised.id)) return advertised.id
  } catch {
    /* segue pro fallback legado */
  }
  const legacy = LEGACY_PROVIDER_PATHS[id] ?? []
  return legacy.find((path) => isProviderInstalled(path)) ?? null
}

// Traduz o erro cru da extensão pra uma instrução acionável. A Xverse devolve
// "Failed to get selected account to handle wallet_connect request" quando a
// carteira está travada ou sem conta Bitcoin ativa pra rede/purpose pedidos.
// Esse texto não diz isso ao usuário, então normaliza pro caso mais provável.
function toActionableConnectError(rawMessage: string | undefined, walletName: string): string {
  const raw = (rawMessage || '').toLowerCase()
  const looksLikeNoAccount =
    !raw ||
    raw.includes('selected account') ||
    raw.includes('no account') ||
    raw.includes('not found')
  if (looksLikeNoAccount) {
    return `Unlock ${walletName} and select a Bitcoin account, then try again.`
  }
  return rawMessage || `${walletName} refused the connection.`
}

export function createSatsConnectConnector(id: WalletId): WalletConnector {
  const meta = WALLETS[id]

  return {
    id,

    isInstalled() {
      if (typeof window === 'undefined') return false
      return findProviderId(id, meta.providerKeywords) !== null
    },

    async connect(): Promise<ConnectedAccount> {
      const providerId = findProviderId(id, meta.providerKeywords)
      if (!providerId) throw new Error(`${meta.name} not detected. Install the extension and reload.`)

      const res: any = await request(
        'wallet_connect',
        {
          addresses: [AddressPurpose.Ordinals, AddressPurpose.Payment],
          message: 'Connect to DOG DATA to verify wallet ownership.',
          // SEM ISSO a Xverse não sabe pra qual rede resolver "a conta
          // selecionada" e responde "Failed to get selected account to
          // handle wallet_connect request". Era o payload que faltava aqui;
          // o conector provado do OrdCards (apps/web/lib/wallet/xverse.ts)
          // sempre manda esse campo.
          network: BitcoinNetworkType.Mainnet,
        },
        providerId,
      )

      if (res?.status !== 'success') {
        throw new Error(toActionableConnectError(res?.error?.message, meta.name))
      }

      const addresses: ScAddress[] = res.result.addresses ?? []
      const ord =
        addresses.find((a) => a.purpose === AddressPurpose.Ordinals) ?? addresses[0]
      const pay =
        addresses.find((a) => a.purpose === AddressPurpose.Payment) ?? ord
      if (!ord) throw new Error(`${meta.name} did not return an address.`)

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
      const providerId = findProviderId(id, meta.providerKeywords) ?? undefined
      // Endereço taproot → BIP-322 (verificado server-side com bip322-js).
      // O protocolo é NOMEADO, não deixado pra extensão adivinhar. Omitir
      // esse campo deixa a carteira livre pra assinar com ECDSA legado, que
      // não verifica contra um endereço P2TR.
      const res: any = await request(
        'signMessage',
        {
          address,
          message,
          protocol: MessageSigningProtocols.BIP322,
        },
        providerId,
      )
      if (res?.status !== 'success') {
        throw new Error(res?.error?.message || 'Signature request was declined.')
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
