"use client"

import { useEffect, useState, useCallback } from 'react'
import { X, Loader2, ShieldCheck, ShieldAlert, Check, AtSign, Copy } from 'lucide-react'
import { useWallet } from '@/contexts/WalletContext'
import { handleProblem, normalizeHandle } from '@/lib/identity/handle'

interface ProfileState {
  loading: boolean
  handle: string | null // handle já salvo no servidor (null = ainda não escolheu)
}

interface ProfileModalProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * Modal de perfil: endereço, estado de verificação e editor de @handle.
 * Mesma casca visual do wallet-connect-modal (bg-void, border-white/[0.08]).
 */
export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { account, verified, prove, status } = useWallet()
  const proving = status === 'proving'

  const [profile, setProfile] = useState<ProfileState>({ loading: true, handle: null })
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  const copyAddress = useCallback(() => {
    if (!account) return
    navigator.clipboard?.writeText(account.ordinalsAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [account])

  // Carrega o estado do servidor toda vez que o modal abre (GET /api/profile, retorna {address, verified, handle}).
  useEffect(() => {
    if (!isOpen) return
    setSaveError(null)
    setSaved(false)
    setProfile({ loading: true, handle: null })
    fetch('/api/profile')
      .then((r) => r.json())
      .then((d) => {
        setProfile({ loading: false, handle: d?.handle ?? null })
        setInput(d?.handle ?? '')
      })
      .catch(() => setProfile({ loading: false, handle: null }))
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  // Validação local (mesma regra da API): feedback antes de bater no servidor.
  const localProblem = input.length > 0 ? handleProblem(input) : null

  const handleSave = useCallback(async () => {
    if (localProblem) return
    setSaving(true)
    setSaveError(null)
    setSaved(false)
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: input }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        // A API devolve `error` como código curto (reason do validateHandle,
        // ou frase em pt-br nos casos de sessão/servidor): nunca repassar
        // isso pra tela, sempre traduzir pra copy fixa em inglês.
        if (res.status === 409) setSaveError('This handle is already taken.')
        else if (res.status === 422) {
          setSaveError(
            data?.error === 'reserved'
              ? 'This handle is reserved.'
              : 'Invalid handle: 3 to 15 lowercase letters, numbers or underscore.',
          )
        } else if (res.status === 401) setSaveError('Verify ownership first.')
        else setSaveError('Could not save. Try again.')
        return
      }
      setProfile({ loading: false, handle: data?.handle ?? input.trim().toLowerCase() })
      setSaved(true)
    } catch {
      setSaveError('Could not save. Try again.')
    } finally {
      setSaving(false)
    }
  }, [input, localProblem])

  const handleProve = useCallback(() => {
    prove().catch(() => {})
  }, [prove])

  if (!isOpen || !account) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Profile"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose} />

      <div className="relative w-full max-w-sm bg-void border border-white/[0.08] rounded-2xl shadow-[0_24px_64px_-12px_rgba(0,0,0,0.7)] overflow-hidden animate-fade-in">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <h2 className="font-display text-base font-bold text-snow tracking-wide">Profile</h2>
            <p className="text-[11px] font-mono text-[#6B6B78] mt-0.5">Your DOG DATA identity</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#6B6B78] hover:text-snow hover:bg-white/[0.05] rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-4">
          {/* Endereço completo (com copia embutida, já que o dropdown perdeu esse item) */}
          <div className="px-3 py-2.5 bg-white/[0.02] border border-white/[0.05] rounded-xl">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-[10px] font-mono text-[#6B6B78]">Address</p>
              <button
                onClick={copyAddress}
                className="flex items-center gap-1 text-[10px] font-mono text-[#6B6B78] hover:text-snow transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-green-400" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" /> Copy
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] font-mono text-snow break-all">{account.ordinalsAddress}</p>
          </div>

          {/* Estado de verificação */}
          {verified ? (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-green-500/[0.06] border border-green-500/[0.15] rounded-xl">
              <ShieldCheck className="w-4 h-4 text-green-400 flex-shrink-0" />
              <p className="text-[11px] font-mono text-green-400">Ownership verified</p>
            </div>
          ) : (
            <div className="px-3 py-2.5 bg-amber-500/[0.06] border border-amber-500/[0.15] rounded-xl space-y-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400/80 flex-shrink-0" />
                <p className="text-[11px] font-mono text-amber-400/80">
                  Ownership not verified yet. Sign a message to unlock @handle and chat.
                </p>
              </div>
              <button
                onClick={handleProve}
                disabled={proving}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-lava/[0.1] border border-lava/[0.2] text-lava text-[11px] font-mono font-semibold rounded-lg hover:bg-lava/[0.16] transition-colors disabled:opacity-50"
              >
                {proving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {proving ? 'Signing…' : 'Verify ownership'}
              </button>
            </div>
          )}

          {/* Editor de @handle */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-mono text-[#6B6B78]">Handle</p>
            {!verified ? (
              <p className="text-[11px] font-mono text-[#4A4A52] px-3 py-2.5 bg-white/[0.02] border border-white/[0.05] rounded-xl">
                Verify ownership to set a handle.
              </p>
            ) : profile.loading ? (
              <div className="flex items-center gap-2 px-3 py-2.5">
                <Loader2 className="w-3.5 h-3.5 text-[#6B6B78] animate-spin" />
                <span className="text-[11px] font-mono text-[#6B6B78]">Loading…</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.02] border border-white/[0.06] focus-within:border-lava/[0.3] rounded-xl transition-colors">
                  <AtSign className="w-3.5 h-3.5 text-[#6B6B78] flex-shrink-0" />
                  <input
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value.trim().toLowerCase())
                      setSaveError(null)
                      setSaved(false)
                    }}
                    placeholder="yourhandle"
                    maxLength={15}
                    spellCheck={false}
                    autoCapitalize="off"
                    autoCorrect="off"
                    className="flex-1 min-w-0 bg-transparent text-[13px] font-mono text-snow placeholder:text-[#4A4A52] outline-none"
                  />
                  <button
                    onClick={handleSave}
                    // ⚠️ o input nasce preenchido com o handle atual, então sem
                    // estas duas travas o Save ficava permanentemente ativo
                    // (fundador notou): sem posse provada o servidor recusa com
                    // 401, e input igual ao salvo não tem o que salvar
                    disabled={saving || !verified || !!localProblem || input.length === 0 || normalizeHandle(input) === profile.handle}
                    className="px-3 py-1 bg-lava/[0.1] border border-lava/[0.2] text-lava text-[10px] font-mono font-semibold rounded-lg hover:bg-lava/[0.16] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 flex-shrink-0"
                  >
                    {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                    Save
                  </button>
                </div>
                {localProblem && input.length > 0 && (
                  <p className="text-[10px] font-mono text-amber-400/80">{localProblem}</p>
                )}
                {saveError && !localProblem && (
                  <p className="text-[10px] font-mono text-red-400">{saveError}</p>
                )}
                {saved && !saveError && (
                  <p className="flex items-center gap-1 text-[10px] font-mono text-green-400">
                    <Check className="w-3 h-3" /> Saved as @{profile.handle}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
