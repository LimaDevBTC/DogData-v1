"use client"

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { Wallet, LogOut, User, ChevronDown, ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react'
import { useWallet } from '@/contexts/WalletContext'
import { WALLETS } from '@/lib/wallet'
import { ProfileModal } from '@/components/wallet/profile-modal'

function truncate(addr: string) {
  return addr.length > 12 ? `${addr.slice(0, 5)}…${addr.slice(-4)}` : addr
}

/**
 * Botão do header. Desconectado → "Connect Wallet". Conectado → endereço +
 * dropdown com 3 itens (Profile, Verify ownership se ainda não verificado,
 * Disconnect). Copiar endereço mudou pra dentro do ProfileModal.
 * `variant="mobile"` renderiza uma lista full-width p/ o menu hambúrguer
 * (já vive dentro de um drawer que abre/fecha sozinho, por isso não é
 * outro dropdown flutuante, só os mesmos 3 itens em linha).
 */
export function WalletButton({ variant = 'desktop' }: { variant?: 'desktop' | 'mobile' }) {
  const { account, openModal, disconnect, verified, prove, status } = useWallet()
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const proving = status === 'proving'

  const handleProve = useCallback(() => {
    prove().catch(() => {})
  }, [prove])

  // Posiciona o menu a partir do retângulo do botão (o menu é portalado no body).
  const toggleMenu = useCallback(() => {
    setMenuOpen((v) => {
      if (!v && ref.current) {
        const r = ref.current.getBoundingClientRect()
        setCoords({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) })
      }
      return !v
    })
  }, [])

  // Fecha ao clicar fora (considera tanto o botão quanto o menu portalado) ou apertar Escape.
  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node
      if (ref.current?.contains(t) || menuRef.current?.contains(t)) return
      setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    const onScrollOrResize = () => setMenuOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onScrollOrResize)
    window.addEventListener('scroll', onScrollOrResize, true)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onScrollOrResize)
      window.removeEventListener('scroll', onScrollOrResize, true)
    }
  }, [menuOpen])

  const openProfile = useCallback(() => {
    setProfileOpen(true)
    setMenuOpen(false)
  }, [])

  // ---------- Disconnected ----------
  if (!account) {
    if (variant === 'mobile') {
      return (
        <button
          onClick={openModal}
          className="w-full flex items-center gap-3 px-3 py-2.5 font-mono text-sm tracking-wide text-lava bg-lava/[0.08] rounded-lg"
        >
          <Wallet className="w-4 h-4 flex-shrink-0" />
          Connect Wallet
        </button>
      )
    }
    return (
      <button
        onClick={openModal}
        className="hidden lg:flex items-center px-4 py-1.5 bg-gradient-to-r from-lava to-lava-dark text-snow font-mono font-medium text-xs tracking-wide transition-all duration-300 shadow-[0_0_20px_rgba(245,110,15,0.15)] hover:shadow-[0_0_30px_rgba(245,110,15,0.25)] hover:scale-[1.02] group rounded-lg"
        title="Connect your Bitcoin wallet"
      >
        <Wallet className="w-3.5 h-3.5 mr-1.5 group-hover:scale-110 transition-transform duration-300" />
        <span className="font-semibold">Connect</span>
      </button>
    )
  }

  // ---------- Connected ----------
  const meta = WALLETS[account.walletId]

  if (variant === 'mobile') {
    return (
      <>
        <div className="space-y-0.5">
          <div className="w-full flex items-center gap-3 px-3 py-2.5 font-mono text-sm rounded-lg bg-white/[0.03]">
            <span className="relative w-5 h-5 rounded overflow-hidden flex-shrink-0">
              <Image src={meta.logo} alt={meta.name} fill sizes="20px" className="object-cover" />
            </span>
            <span className="text-snow flex-1">{truncate(account.ordinalsAddress)}</span>
            {verified ? (
              <ShieldCheck className="w-4 h-4 text-green-400" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-amber-400/80" />
            )}
          </div>
          <button
            onClick={openProfile}
            className="w-full flex items-center gap-3 px-3 py-2.5 font-mono text-sm text-[#6B6B78] hover:text-snow hover:bg-white/[0.03] rounded-lg transition-colors"
          >
            <User className="w-4 h-4" />
            Profile
          </button>
          {!verified && (
            <button
              onClick={handleProve}
              disabled={proving}
              className="w-full flex items-center gap-3 px-3 py-2.5 font-mono text-sm text-lava hover:bg-lava/[0.08] rounded-lg transition-colors disabled:opacity-50"
            >
              {proving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              {proving ? 'Signing…' : 'Verify ownership'}
            </button>
          )}
          <button
            onClick={disconnect}
            className="w-full flex items-center gap-3 px-3 py-2.5 font-mono text-sm text-red-400/80 hover:text-red-400 hover:bg-red-500/[0.06] rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Disconnect
          </button>
        </div>
        <ProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
      </>
    )
  }

  return (
    <div className="relative hidden lg:block" ref={ref}>
      <button
        onClick={toggleMenu}
        className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.03] border border-white/[0.07] hover:border-lava/[0.25] rounded-lg transition-all duration-200 group"
        title={account.ordinalsAddress}
      >
        <span className="relative w-4 h-4 rounded overflow-hidden flex-shrink-0">
          <Image src={meta.logo} alt={meta.name} fill sizes="16px" className="object-cover" />
        </span>
        <span className="font-mono text-xs text-snow font-medium">
          {truncate(account.ordinalsAddress)}
        </span>
        {proving ? (
          <Loader2 className="w-3 h-3 text-lava animate-spin" />
        ) : verified ? (
          <ShieldCheck className="w-3.5 h-3.5 text-green-400" />
        ) : (
          <ShieldAlert className="w-3.5 h-3.5 text-amber-400/80" />
        )}
        <ChevronDown
          className={`w-3 h-3 text-[#6B6B78] transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {menuOpen && coords && typeof document !== 'undefined' &&
        createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: coords.top, right: coords.right }}
          className="z-[100] w-48 bg-void border border-white/[0.08] rounded-xl shadow-[0_16px_40px_-8px_rgba(0,0,0,0.6)] overflow-hidden animate-fade-in py-1"
        >
          <div className="px-3 py-2 border-b border-white/[0.05]">
            <p className="text-[10px] font-mono text-[#6B6B78]">{meta.name}</p>
            <p className="text-[11px] font-mono text-snow break-all">
              {truncate(account.ordinalsAddress)}
            </p>
            <p
              className={`mt-1 flex items-center gap-1 text-[10px] font-mono ${verified ? 'text-green-400' : 'text-amber-400/80'}`}
            >
              {verified ? (
                <>
                  <ShieldCheck className="w-3 h-3" /> Ownership verified
                </>
              ) : (
                <>
                  <ShieldAlert className="w-3 h-3" /> Ownership not verified
                </>
              )}
            </p>
          </div>
          <button
            onClick={openProfile}
            className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-mono text-snow hover:bg-white/[0.04] transition-colors"
          >
            <User className="w-3.5 h-3.5" />
            Profile
          </button>
          {!verified && (
            <button
              onClick={handleProve}
              disabled={proving}
              className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-mono text-lava hover:bg-lava/[0.08] transition-colors disabled:opacity-50"
            >
              {proving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
              {proving ? 'Signing…' : 'Verify ownership'}
            </button>
          )}
          <button
            onClick={() => {
              disconnect()
              setMenuOpen(false)
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-mono text-red-400/80 hover:text-red-400 hover:bg-red-500/[0.06] transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Disconnect
          </button>
        </div>,
        document.body,
      )}
      <ProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  )
}
