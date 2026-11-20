"use client"

// "MESSAGE THE OWNER" (fundador, 20/11/2026): a caixa de entrada do perfil. Só com a sessão assinada: /api/dogcity/inbox lê a
// carteira do cookie e devolve só o que foi mandado PARA ela. O remetente aparece pelo @handle ou pelo endereço curto, nunca pelo
// inteiro. Marcar como lida, apagar, silenciar o remetente e responder (a resposta vai para a carteira dele, na mesma conversa).
// O texto da mensagem entra sempre como texto (React escapa; nada de innerHTML). Copy 100% em inglês, sem travessão.
import { useCallback, useEffect, useState } from "react"
import { Check, Loader2, Mail } from "lucide-react"
import { PlateHead } from "@/components/plot/kit"
import { MAX_CARACTERES, validarTexto } from "@/lib/dog/lot-message"

interface Sender { handle: string | null; short: string }
interface Message { id: string; lot: string; from: Sender; text: string; at: string; read: boolean; reply: boolean; quote: string | null }
interface Inbox { unread: number; messages: Message[]; muted: { id: string; who: Sender }[] }

const day = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })
}
const who = (s: Sender) => (s.handle ? `@${s.handle}` : s.short)
const TEXT_ERROR: Record<string, string> = {
  empty: "Write a message first.",
  too_long: `Messages can be up to ${MAX_CARACTERES} characters.`,
  link: "Links and web addresses are not allowed in messages.",
  invalid_text: "This message has characters that cannot be sent.",
}
const FAIL = "Could not save right now. Try again in a moment."

export function MessagesCard({ verified }: { verified: boolean }) {
  const [data, setData] = useState<Inbox | null>(null)
  const [replying, setReplying] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [muting, setMuting] = useState<string | null>(null)
  const [showMuted, setShowMuted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(() => {
    if (!verified) return
    fetch("/api/dogcity/inbox", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Inbox | null) => setData(d && Array.isArray(d.messages) ? d : null))
      .catch(() => setData(null))
  }, [verified])
  useEffect(() => { load() }, [load])

  if (!verified || !data) return null

  async function post(url: string, body: unknown, ok: string | null): Promise<boolean> {
    setBusy(true)
    setMsg(null)
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
      const d = await r.json().catch(() => ({}))
      if (r.ok && d?.ok) {
        if (ok) setMsg({ ok: true, text: ok })
        load()
        return true
      }
      setMsg({ ok: false, text: typeof d?.error === "string" ? d.error : FAIL })
      return false
    } catch {
      setMsg({ ok: false, text: FAIL })
      return false
    } finally {
      setBusy(false)
    }
  }

  const act = (body: unknown, ok: string | null = null) => post("/api/dogcity/inbox", body, ok)

  async function sendReply(id: string) {
    const v = validarTexto(draft)
    if (!v.ok) { setMsg({ ok: false, text: TEXT_ERROR[v.why] ?? FAIL }); return }
    if (await post("/api/dogcity/lot-message", { replyTo: id, text: v.texto }, "Reply sent.")) {
      setReplying(null)
      setDraft("")
    }
  }

  const unreadIds = data.messages.filter((m) => !m.read).map((m) => m.id)
  const count = [...draft].length
  const btn = "inline-flex items-center gap-1.5 border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors disabled:opacity-40"
  const quiet = "font-mono text-[10px] uppercase tracking-[0.18em] text-dusty hover:text-snow disabled:opacity-40"

  return (
    <div className="space-y-4 border border-white/10 bg-void p-5 md:p-6">
      <PlateHead
        icon={Mail}
        right={data.unread > 0 ? <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-lava">{data.unread} unread</span> : undefined}
      >
        messages
      </PlateHead>

      {data.messages.length === 0 ? (
        <p className="text-[12px] text-mist leading-relaxed">
          No messages yet. Other players can leave you a message from your lot in the game, without seeing your contacts.
        </p>
      ) : (
        <>
          {unreadIds.length > 1 && (
            <button disabled={busy} onClick={() => act({ action: "read", ids: unreadIds.slice(0, 50) })} className={quiet}>
              Mark all as read
            </button>
          )}
          <ul className="space-y-3">
            {data.messages.map((m) => (
              <li key={m.id} className={`space-y-2 border p-4 ${m.read ? "border-white/10" : "border-lava/40"}`}>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-dusty break-all">
                  {!m.read && <span aria-hidden className="mr-2 inline-block w-1.5 h-1.5 rounded-full bg-lava align-middle" />}
                  {who(m.from)} · lot {m.lot} · {day(m.at)}
                </p>
                {m.reply && m.quote && (
                  <p className="border-l border-white/20 pl-3 text-[11px] text-dusty whitespace-pre-wrap break-words">Replying to: {m.quote}</p>
                )}
                <p className="text-[13px] text-snow whitespace-pre-wrap break-words">{m.text}</p>

                {replying === m.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value.slice(0, MAX_CARACTERES * 2))}
                      rows={3}
                      maxLength={MAX_CARACTERES * 2}
                      placeholder={`Reply to ${who(m.from)}`}
                      className="w-full border border-white/15 bg-transparent p-2 text-[13px] text-snow outline-none focus:border-lava/60"
                    />
                    <div className="flex items-center gap-3">
                      <button disabled={busy || count === 0 || count > MAX_CARACTERES} onClick={() => sendReply(m.id)}
                        className={`${btn} border-lava bg-lava/[0.2] text-lava hover:bg-lava/[0.3]`}>
                        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Send reply
                      </button>
                      <button disabled={busy} onClick={() => { setReplying(null); setDraft("") }} className={quiet}>Cancel</button>
                      <span className={`ml-auto font-mono text-[10px] ${count > MAX_CARACTERES ? "text-[#F59E0B]" : "text-dusty"}`}>{count}/{MAX_CARACTERES}</span>
                    </div>
                  </div>
                ) : muting === m.id ? (
                  <div className="space-y-2">
                    <p className="text-[12px] text-mist">
                      Mute {who(m.from)}? Their messages disappear from your inbox and new ones will not reach you.
                    </p>
                    <div className="flex gap-3">
                      <button disabled={busy} onClick={async () => { if (await act({ action: "mute", id: m.id }, "Sender muted.")) setMuting(null) }}
                        className={`${btn} border-lava bg-lava/[0.2] text-lava hover:bg-lava/[0.3]`}>
                        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Mute
                      </button>
                      <button disabled={busy} onClick={() => setMuting(null)} className={quiet}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-4">
                    <button disabled={busy} onClick={() => { setReplying(m.id); setDraft(""); setMuting(null); setMsg(null) }} className={quiet}>Reply</button>
                    {!m.read && <button disabled={busy} onClick={() => act({ action: "read", ids: [m.id] })} className={quiet}>Mark as read</button>}
                    <button disabled={busy} onClick={() => act({ action: "delete", id: m.id })} className={quiet}>Delete</button>
                    <button disabled={busy} onClick={() => { setMuting(m.id); setReplying(null) }} className={quiet}>Mute sender</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {data.muted.length > 0 && (
        <div className="space-y-2">
          <button onClick={() => setShowMuted((s) => !s)} className={quiet}>Muted ({data.muted.length})</button>
          {showMuted && (
            <ul className="border border-white/10">
              {data.muted.map((x) => (
                <li key={x.id} className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/5 last:border-0">
                  <span className="font-mono text-[11px] text-snow break-all">{who(x.who)}</span>
                  <button disabled={busy} onClick={() => act({ action: "unmute", id: x.id }, "Sender unmuted.")} className={quiet}>Unmute</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {msg && <p className={`text-[12px] ${msg.ok ? "text-[#10B981]" : "text-[#F59E0B]"}`}>{msg.text}</p>}
    </div>
  )
}
