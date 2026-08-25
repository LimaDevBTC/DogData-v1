"use client"

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import { X, Loader2, ExternalLink, Check } from 'lucide-react'
import { useWallet } from '@/contexts/WalletContext'
import { WALLETS, WALLET_ORDER, isWalletInstalled } from '@/lib/wallet'
import type { WalletId } from '@/lib/wallet/types'

export function WalletConnectModal() {
  const { isModalOpen, closeModal, connect, error, status, account } = useWallet()
  const [installed, setInstalled] = useState<Record<string, boolean>>({})
  const [pending, setPending] = useState<WalletId | null>(null)

  // Detecção só no cliente (evita mismatch de hidratação).
  useEffect(() => {
    if (!isModalOpen) return
    const map: Record<string, boolean> = {}
    for (const id of WALLET_ORDER) map[id] = isWalletInstalled(id)
    setInstalled(map)
  }, [isModalOpen])

  useEffect(() => {
    if (!isModalOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeModal()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isModalOpen, closeModal])

  const handleConnect = useCallback(
    async (id: WalletId) => {
      setPending(id)
      try {
        await connect(id)
      } catch {
        /* erro exibido via context */
      } finally {
        setPending(null)
      }
    },
    [connect],
  )

  if (!isModalOpen) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Conectar carteira"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={closeModal}
      />

      {/* Card */}
      <div className="relative w-full max-w-sm bg-void border border-white/[0.08] rounded-2xl shadow-[0_24px_64px_-12px_rgba(0,0,0,0.7)] overflow-hidden animate-fade-in">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <h2 className="font-display text-base font-bold text-snow tracking-wide">
              Conectar carteira
            </h2>
            <p className="text-[11px] font-mono text-[#6B6B78] mt-0.5">
              Prove a posse do seu endereço
            </p>
          </div>
          <button
            onClick={closeModal}
            className="p-1.5 text-[#6B6B78] hover:text-snow hover:bg-white/[0.05] rounded-lg transition-colors"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 pb-4 space-y-1.5">
          {WALLET_ORDER.map((id) => {
            const w = WALLETS[id]
            const isInstalled = installed[id]
            const isConnecting = pending === id && status === 'connecting'
            const isActive = account?.walletId === id

            return (
              <div
                key={id}
                className="flex items-center gap-3 w-full px-3 py-2.5 bg-white/[0.02] border border-white/[0.05] rounded-xl hover:bg-white/[0.04] hover:border-white/[0.09] transition-all duration-200"
              >
                <div
                  className="relative w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-white/[0.03]"
                  style={{ boxShadow: `inset 0 0 0 1px ${w.accent}33` }}
                >
                  <Image src={w.logo} alt={w.name} fill sizes="36px" className="object-cover" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-sm text-snow font-medium">{w.name}</span>
                    {w.note && (
                      <span className="px-1 py-px text-[8px] font-bold bg-lava/[0.12] text-lava/70 border border-lava/[0.18] rounded tracking-widest leading-none">
                        {w.note}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-[#6B6B78]">
                    {isInstalled ? 'Detectada' : 'Não instalada'}
                  </span>
                </div>

                {isActive ? (
                  <span className="flex items-center gap-1 text-[11px] font-mono text-green-400">
                    <Check className="w-3.5 h-3.5" /> Conectada
                  </span>
                ) : isInstalled ? (
                  <button
                    onClick={() => handleConnect(id)}
                    disabled={isConnecting}
                    className="px-3 py-1.5 bg-lava/[0.1] border border-lava/[0.2] text-lava text-[11px] font-mono font-semibold rounded-lg hover:bg-lava/[0.16] transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isConnecting && <Loader2 className="w-3 h-3 animate-spin" />}
                    {isConnecting ? 'Conectando' : 'Conectar'}
                  </button>
                ) : (
                  <a
                    href={w.installUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-white/[0.03] border border-white/[0.06] text-[#6B6B78] hover:text-snow text-[11px] font-mono rounded-lg transition-colors flex items-center gap-1"
                  >
                    Instalar <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )
          })}
        </div>

        {error && (
          <div className="mx-4 mb-4 px-3 py-2 bg-red-500/[0.08] border border-red-500/[0.2] rounded-lg">
            <p className="text-[11px] font-mono text-red-400">{error}</p>
          </div>
        )}

        <div className="px-5 py-3 border-t border-white/[0.05] bg-white/[0.01]">
          <p className="text-[10px] font-mono text-[#4A4A52] leading-relaxed">
            A DOG DATA nunca pede sua seed ou chave privada. A assinatura acontece dentro da
            extensão da carteira.
          </p>
        </div>
      </div>
    </div>
  )
}
