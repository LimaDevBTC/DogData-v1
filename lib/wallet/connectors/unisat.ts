import type { WalletConnector, ConnectedAccount, SignedMessage } from '../types'

// A UniSat tem provider próprio, fora do sats-connect. Porte do conector do
// OrdCards (apps/web/lib/wallet/unisat.ts), tipado contra a documentação
// oficial (unisat-wallet/unisat-dev-docs, wallet-api/api-docs).
//
// O PROVIDER É `window.unisat_wallet`, NÃO `window.unisat`. A própria UniSat
// criou o nome novo porque muitas carteiras são fork dela e brigam pela chave
// `window.unisat`: o fork que carrega por último fica com ela, e quem clica em
// UniSat abre outra extensão. O nome genérico só entra como reserva para
// versões antigas, de antes da troca.
//
// Diferente da Xverse e da OKX, a UniSat expõe UM endereço por conta (o tipo
// que a pessoa escolheu na carteira). Ele segura tudo, DOG inclusive, então
// faz o papel de ordinals e de pagamento ao mesmo tempo.

interface UnisatChain {
  enum: string
  name: string
  network: 'livenet' | 'testnet'
}

interface UnisatProvider {
  requestAccounts(): Promise<string[]>
  getAccounts(): Promise<string[]>
  getPublicKey(): Promise<string>
  getChain(): Promise<UnisatChain>
  switchChain(chain: string): Promise<UnisatChain>
  signMessage(msg: string, type?: 'ecdsa' | 'bip322-simple'): Promise<string>
  sendBitcoin(to: string, satoshis: number, options?: { feeRate?: number }): Promise<string>
  sendRunes(address: string, runeid: string, amount: string, options?: { feeRate?: number }): Promise<string | { txid: string }>
  disconnect?(): Promise<void>
}

const UNISAT_MAINNET = 'BITCOIN_MAINNET'

// Endereços de mainnet que a prova de posse sabe verificar: taproot, segwit
// nativo e segwit aninhado por BIP-322; o legado (1...) pela assinatura de
// mensagem clássica, que é a única que existe para P2PKH.
const BECH32 = /^bc1[qp][023456789acdefghjklmnpqrstuvwxyz]{38,58}$/i
const P2SH = /^3[1-9A-HJ-NP-Za-km-z]{25,34}$/
const P2PKH = /^1[1-9A-HJ-NP-Za-km-z]{25,34}$/

export function getUnisatProvider(): UnisatProvider | null {
  if (typeof window === 'undefined') return null
  const w = window as any
  return (w.unisat_wallet ?? w.unisat ?? null) as UnisatProvider | null
}

function unisat(): UnisatProvider {
  const p = getUnisatProvider()
  if (!p) throw new Error('UniSat not detected. Install the extension and reload.')
  return p
}

// A recusa chega como 4001 (EIP-1193) em umas versões e como texto em outras.
export function isUnisatRejection(e: unknown): boolean {
  if (typeof e !== 'object' || e == null) return false
  const err = e as { code?: number; message?: string }
  return err.code === 4001 || /reject|denied|cancel/i.test(err.message ?? '')
}

export function createUnisatConnector(): WalletConnector {
  return {
    id: 'unisat',

    isInstalled() {
      return getUnisatProvider() != null
    },

    async connect(): Promise<ConnectedAccount> {
      const w = unisat()
      let accounts: string[]
      try {
        accounts = await w.requestAccounts()
      } catch (e) {
        if (isUnisatRejection(e)) throw new Error('Connection cancelled in UniSat.')
        throw new Error((e as Error)?.message || 'Could not reach UniSat.')
      }
      if (!accounts?.[0]) throw new Error('Unlock UniSat and select an account, then try again.')

      // A UniSat lembra a última rede entre sites (testnet, signet, Fractal).
      // Endereço de outra rede não é DOG de verdade: troca para a mainnet ou
      // recusa a conexão.
      let chain = await w.getChain()
      if (chain?.enum !== UNISAT_MAINNET) {
        try {
          chain = await w.switchChain(UNISAT_MAINNET)
        } catch (e) {
          if (isUnisatRejection(e)) throw new Error(`DOG DATA is Bitcoin mainnet only. UniSat is on ${chain?.name ?? 'another network'}.`)
          throw new Error((e as Error)?.message || 'Could not switch UniSat to Bitcoin mainnet.')
        }
        if (chain?.enum !== UNISAT_MAINNET) {
          throw new Error(`DOG DATA is Bitcoin mainnet only. UniSat is on ${chain?.name ?? 'another network'}.`)
        }
      }

      // A troca de rede pode trocar a conta exposta: lê de novo depois dela.
      const address = ((await w.getAccounts())?.[0] ?? '').trim()
      if (!address) throw new Error('Unlock UniSat and select an account, then try again.')
      if (!BECH32.test(address) && !P2SH.test(address) && !P2PKH.test(address)) {
        throw new Error('UniSat returned an address this site cannot verify.')
      }

      let publicKey: string | undefined
      try {
        publicKey = await w.getPublicKey()
      } catch {
        /* opcional: a prova BIP-322 não precisa dela */
      }

      return {
        walletId: 'unisat',
        ordinalsAddress: address,
        ordinalsPublicKey: publicKey,
        paymentAddress: address,
        paymentPublicKey: publicKey,
        network: 'mainnet',
      }
    },

    async signMessage(address, message): Promise<SignedMessage> {
      const w = unisat()
      // A conta ativa da UniSat pode ter mudado desde a conexão: assinar com
      // outra conta daria uma prova que o servidor recusa sem dizer por quê.
      const active = ((await w.getAccounts())?.[0] ?? '').trim()
      if (active.toLowerCase() !== address.toLowerCase()) {
        throw new Error('UniSat switched to another account. Disconnect and connect again.')
      }
      // Protocolo nomeado, nunca o padrão da carteira (que é o ECDSA legado e
      // não verifica contra P2TR nem P2WPKH). O legado 1... só tem o clássico.
      const legacy = P2PKH.test(address)
      let signature: string
      try {
        signature = await w.signMessage(message, legacy ? 'ecdsa' : 'bip322-simple')
      } catch (e) {
        if (isUnisatRejection(e)) throw new Error('Signature request was declined.')
        throw new Error((e as Error)?.message || 'UniSat could not sign.')
      }
      if (!signature) throw new Error('Signature request was declined.')
      return { address, message, signature, protocol: legacy ? 'ecdsa' : 'bip322' }
    },

    async disconnect() {
      try {
        await getUnisatProvider()?.disconnect?.()
      } catch {
        /* noop: versões antigas não têm disconnect */
      }
    },
  }
}
