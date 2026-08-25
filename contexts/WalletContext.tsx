"use client"

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import type { ConnectedAccount, WalletId } from '@/lib/wallet/types'
import { getConnector } from '@/lib/wallet'
import { WalletConnectModal } from '@/components/wallet/wallet-connect-modal'

const STORAGE_KEY = 'dogdata-wallet-account'

type Status = 'idle' | 'connecting' | 'proving' | 'connected'

interface WalletContextValue {
  account: ConnectedAccount | null
  status: Status
  error: string | null
  verified: boolean
  isModalOpen: boolean
  openModal: () => void
  closeModal: () => void
  connect: (id: WalletId) => Promise<void>
  prove: () => Promise<void>
  disconnect: () => void
}

const WalletContext = createContext<WalletContextValue | null>(null)

async function requestProof(account: ConnectedAccount): Promise<void> {
  const addr = account.ordinalsAddress
  // 1) nonce + mensagem-desafio do servidor
  const nres = await fetch('/api/wallet/nonce', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: addr }),
  })
  const ndata = await nres.json()
  if (!nres.ok) throw new Error(ndata.error || 'Falha ao obter o desafio.')

  // 2) assina na carteira (BIP-322 nas 3, Schnorr na Kray)
  const signed = await getConnector(account.walletId).signMessage(addr, ndata.message)

  // 3) verifica no servidor → cria sessão httpOnly
  const vres = await fetch('/api/wallet/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      address: addr,
      signature: signed.signature,
      protocol: signed.protocol,
      publicKey: signed.publicKey,
      walletId: account.walletId,
    }),
  })
  const vdata = await vres.json()
  if (!vres.ok) throw new Error(vdata.error || 'Verificação de posse falhou.')
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<ConnectedAccount | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [verified, setVerified] = useState(false)
  const [isModalOpen, setModalOpen] = useState(false)

  // Restaura conta (localStorage, exibição) + sessão verificada (cookie httpOnly via API).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as ConnectedAccount
        if (parsed?.ordinalsAddress) {
          setAccount(parsed)
          setStatus('connected')
        }
      }
    } catch {
      /* ignore */
    }
    fetch('/api/wallet/session')
      .then((r) => r.json())
      .then((d) => {
        if (d?.session?.address) setVerified(true)
      })
      .catch(() => {})
  }, [])

  const openModal = useCallback(() => {
    setError(null)
    setModalOpen(true)
  }, [])
  const closeModal = useCallback(() => setModalOpen(false), [])

  const prove = useCallback(async () => {
    if (!account) throw new Error('Conecte a carteira primeiro.')
    setStatus('proving')
    setError(null)
    try {
      await requestProof(account)
      setVerified(true)
      setStatus('connected')
    } catch (e: any) {
      setStatus('connected')
      setError(e?.message || 'Falha na prova de posse.')
      throw e
    }
  }, [account])

  const connect = useCallback(async (id: WalletId) => {
    setStatus('connecting')
    setError(null)
    setVerified(false)
    try {
      const connector = getConnector(id)
      if (!connector.isInstalled()) {
        throw new Error('Carteira não detectada. Instale a extensão e recarregue.')
      }
      const acc = await connector.connect()
      setAccount(acc)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(acc))
      } catch {
        /* ignore */
      }
      setModalOpen(false)

      // Prova de posse logo após conectar (padrão "sign-in with wallet").
      // Se o usuário recusar a assinatura, segue conectado-mas-não-verificado.
      setStatus('proving')
      try {
        await requestProof(acc)
        setVerified(true)
      } catch (e: any) {
        setError(e?.message || 'Conectado, mas a posse não foi verificada.')
      }
      setStatus('connected')
    } catch (e: any) {
      setStatus(account ? 'connected' : 'idle')
      setError(e?.message || 'Falha ao conectar.')
      throw e
    }
  }, [account])

  const disconnect = useCallback(() => {
    if (account) {
      try {
        getConnector(account.walletId).disconnect?.()
      } catch {
        /* ignore */
      }
    }
    fetch('/api/wallet/session', { method: 'DELETE' }).catch(() => {})
    setAccount(null)
    setVerified(false)
    setStatus('idle')
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }, [account])

  return (
    <WalletContext.Provider
      value={{
        account,
        status,
        error,
        verified,
        isModalOpen,
        openModal,
        closeModal,
        connect,
        prove,
        disconnect,
      }}
    >
      {children}
      <WalletConnectModal />
    </WalletContext.Provider>
  )
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWallet must be used within WalletProvider')
  return ctx
}
