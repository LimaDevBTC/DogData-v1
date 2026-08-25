import type { WalletId } from './types'

export interface WalletMeta {
  id: WalletId
  name: string
  // Palavras-chave p/ casar com os nomes retornados por sats-connect getProviders().
  providerKeywords: string[]
  installUrl: string
  // Logo real da carteira (public/wallets/*) + cor de marca p/ acentos do badge.
  logo: string
  accent: string
  // Via sats-connect (Xverse/OKX) ou provider próprio (Kray)?
  viaSatsConnect: boolean
  note?: string
}

export const WALLETS: Record<WalletId, WalletMeta> = {
  kray: {
    id: 'kray',
    name: 'Kray Wallet',
    providerKeywords: ['kray'],
    installUrl: 'https://www.kray.space',
    logo: '/wallets/kray.jpg',
    accent: '#7C3AED',
    viaSatsConnect: false,
    note: 'L1 + L2',
  },
  xverse: {
    id: 'xverse',
    name: 'Xverse',
    providerKeywords: ['xverse'],
    installUrl: 'https://www.xverse.app/download',
    logo: '/wallets/xverse.png',
    accent: '#EE7A30',
    viaSatsConnect: true,
  },
  okx: {
    id: 'okx',
    name: 'OKX Wallet',
    providerKeywords: ['okx'],
    installUrl: 'https://www.okx.com/web3',
    logo: '/wallets/okx.png',
    accent: '#8A8A8A',
    viaSatsConnect: true,
  },
}

export const WALLET_ORDER: WalletId[] = ['kray', 'xverse', 'okx']
