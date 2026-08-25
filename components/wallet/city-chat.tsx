'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// Contrato: GET /api/profile → {address, verified, handle}; POST /api/chat
// {text} exige sessão verified + handle já criado (403 sem handle, 401 sem
// prova, 422 texto fora de 1..280, 429 limite de envio).
type ChatMessage = { id: number; handle: string; address: string; text: string; at: string }
type ProfileState = { verified: boolean; handle: string | null }

function timeShort(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function CityChat({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [profile, setProfile] = useState<ProfileState>({ verified: false, handle: null })
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  // não rouba o scroll: só desce sozinho se o usuário já estava perto do fim
  const stickToBottomRef = useRef(true)
  const lastCountRef = useRef(0)

  const handleScroll = useCallback(() => {
    const el = listRef.current
    if (!el) return
    const fromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    stickToBottomRef.current = fromBottom < 48
  }, [])

  const loadProfile = useCallback(async () => {
    try {
      const r = await fetch('/api/profile')
      if (!r.ok) { setProfile({ verified: false, handle: null }); return }
      const j = await r.json()
      setProfile({ verified: !!j.verified, handle: j.handle ?? null })
    } catch {
      setProfile({ verified: false, handle: null })
    }
  }, [])

  const loadMessages = useCallback(async () => {
    try {
      const r = await fetch('/api/chat')
      if (!r.ok) return
      const j = await r.json()
      if (Array.isArray(j.messages)) setMessages(j.messages)
    } catch {
      /* silencioso: o próximo poll de 5s tenta de novo */
    }
  }, [])

  // poll de 5s só enquanto o painel está aberto; some ao fechar
  useEffect(() => {
    if (!open) return
    loadProfile()
    loadMessages()
    const t = setInterval(() => { loadProfile(); loadMessages() }, 5000)
    return () => clearInterval(t)
  }, [open, loadProfile, loadMessages])

  useEffect(() => {
    if (messages.length === lastCountRef.current) return
    lastCountRef.current = messages.length
    if (stickToBottomRef.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages])

  const canChat = profile.verified && !!profile.handle

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || sending) return
    setSending(true)
    setNotice(null)
    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (r.ok) {
        setInput('')
        stickToBottomRef.current = true
        await loadMessages()
      } else if (r.status === 401) {
        setNotice('Connect your wallet to chat.')
      } else if (r.status === 403) {
        setNotice('Claim a handle to chat.')
      } else if (r.status === 429) {
        setNotice('Slow down, try again in a moment.')
      } else if (r.status === 422) {
        setNotice('Message must be 1 to 280 characters.')
      } else {
        setNotice('Could not send. Try again.')
      }
    } catch {
      setNotice('Could not send. Try again.')
    } finally {
      setSending(false)
    }
  }, [input, sending, loadMessages])

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); send() }
  }, [send])

  if (!open) return null

  return (
    <div
      className="fixed inset-3 z-40 flex flex-col border border-white/10 bg-black/95 sm:static sm:inset-auto sm:z-auto sm:max-h-[46vh] sm:bg-black/85"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-3 py-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/70">Plaza chat</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat"
          className="px-1 font-mono text-[12px] leading-none text-white/45 hover:text-white"
        >
          ✕
        </button>
      </div>

      <div ref={listRef} onScroll={handleScroll} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2">
        {messages.length === 0 ? (
          <p className="font-mono text-[10px] text-white/35">No messages yet. Be the first to say something.</p>
        ) : (
          messages.map((m) => (
            <p key={m.id} className="break-words font-mono text-[11px] leading-relaxed text-white/85">
              <span className="text-[#F7931A]">@{m.handle}</span>{' '}
              <span className="text-white/30">{timeShort(m.at)}</span>
              <br />
              {m.text}
            </p>
          ))
        )}
      </div>

      <div className="shrink-0 border-t border-white/10 px-3 py-2">
        {notice && <p className="mb-1.5 font-mono text-[10px] text-[#F7931A]/80">{notice}</p>}
        {canChat ? (
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              maxLength={280}
              placeholder="Say something"
              spellCheck={false}
              disabled={sending}
              className="min-w-0 flex-1 border border-white/10 bg-black px-2 py-1.5 font-mono text-[11px] text-white placeholder:text-white/30 focus:border-[#F7931A]/70 focus:outline-none disabled:opacity-50"
            />
            <button
              type="button"
              onClick={send}
              disabled={sending || !input.trim()}
              className="border border-[#F7931A]/70 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-[#F7931A] disabled:opacity-40"
            >
              Send
            </button>
          </div>
        ) : (
          <p className="font-mono text-[10px] leading-relaxed text-white/40">
            Connect your wallet and claim a handle to chat.
          </p>
        )}
      </div>
    </div>
  )
}
