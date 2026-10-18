import type { WalletConnector, WalletId } from './types'
import { createSatsConnectConnector } from './connectors/satsconnect'
import { createKrayConnector } from './connectors/kray'
import { createUnisatConnector } from './connectors/unisat'

export function getConnector(id: WalletId): WalletConnector {
  if (id === 'kray') return createKrayConnector()
  if (id === 'unisat') return createUnisatConnector()
  return createSatsConnectConnector(id)
}

export function isWalletInstalled(id: WalletId): boolean {
  try {
    return getConnector(id).isInstalled()
  } catch {
    return false
  }
}

export * from './types'
export { WALLETS, WALLET_ORDER } from './wallets'
