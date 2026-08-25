// Camada de conexão de carteira (connectwallet.md — Bloco A).
// O app SÓ conhece esta interface: trocar/adicionar wallet = 1 adapter novo.

export type WalletId = 'xverse' | 'okx' | 'kray'

export interface ConnectedAccount {
  walletId: WalletId
  // Endereço taproot/ordinals (segura os DOG Runes de L1) — usado na prova de posse.
  ordinalsAddress: string
  ordinalsPublicKey?: string
  // Endereço de pagamento (na Kray = mesmo taproot).
  paymentAddress: string
  paymentPublicKey?: string
  network: 'mainnet'
}

// Protocolo da assinatura → o backend escolhe o verificador certo (ver connectwallet.md Bloco A.6).
export type SignatureProtocol = 'bip322' | 'ecdsa' | 'bip340-schnorr'

export interface SignedMessage {
  address: string
  message: string
  signature: string
  publicKey?: string
  protocol: SignatureProtocol
}

export interface WalletConnector {
  id: WalletId
  isInstalled(): boolean
  connect(): Promise<ConnectedAccount>
  // Assina uma mensagem arbitrária com o endereço dado (prova de posse).
  signMessage(address: string, message: string): Promise<SignedMessage>
  disconnect?(): Promise<void>
}
