"use client"

// A PROPRIEDADE UNIDA, OPT-IN (fundador, 19/11/2026): "Expand your house". Só com a sessão assinada: a rota
// /api/dogcity/property lê a carteira do cookie. O dono escolhe QUAIS lotes vizinhos entram (pode deixar um solto para
// vender), vê a prévia do que cabe pelo nível e confirma; a propriedade ativa ganha "Restore separate lots".
// Só no jogo e de graça. Copy 100% em inglês, sem travessão.
import { useCallback, useEffect, useMemo, useState } from "react"
import { Check, Home, Loader2 } from "lucide-react"
import { PlateHead } from "@/components/plot/kit"
import type { LicenceTier } from "@/lib/dog/licence-btc"

interface LotRow { lot: string; tier: LicenceTier | null }
interface Option { lots: string[]; licensed: string[]; merged: string[]; cooldownUntil: Record<string, string> }
interface Prop { id: string; anchor: string; lots: string[]; tier: LicenceTier | null; amenities: string[]; splitAfter: string }
interface View {
  lots: LotRow[]
  properties: Prop[]
  options: Option[]
  canExpand: boolean
  dissolvedNow: string[]
  cooldownDays: number
  amenitiesByTier: Record<LicenceTier, string[]>
}

const TIER_LABEL: Record<string, string> = { personal: "Personal", commercial: "Commercial", patron: "Patron" }
const AMENITY: Record<string, string> = {
  piscina: "Pool with deck", basquete: "Basketball court", tenis: "Tennis court", hospedes: "Guest house",
  futebol: "Football pitch", academia: "Gym pavilion",
}
const HOUSE: Record<string, string> = {
  personal: "A larger house", commercial: "The large house (36 x 24 m)", patron: "Your custom build, across the whole ground",
}
const RANK: Record<string, number> = { personal: 1, commercial: 2, patron: 3 }
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })

export function PropertyCard({ verified }: { verified: boolean }) {
  const [data, setData] = useState<View | null>(null)
  const [open, setOpen] = useState(false)
  const [pick, setPick] = useState<string[]>([])
  const [confirm, setConfirm] = useState<"merge" | string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(() => {
    if (!verified) return
    fetch("/api/dogcity/property", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: View | null) => setData(d))
      .catch(() => setData(null))
  }, [verified])
  useEffect(() => { load() }, [load])

  const tierOf = useMemo(() => new Map((data?.lots ?? []).map((l) => [l.lot, l.tier])), [data])
  const pickTier = useMemo(() => {
    let t: LicenceTier | null = null
    for (const l of pick) { const x = tierOf.get(l) ?? null; if (x && (!t || RANK[x] > RANK[t])) t = x }
    return t
  }, [pick, tierOf])

  if (!verified || !data) return null
  if (!data.canExpand && data.properties.length === 0) return null

  async function send(body: unknown, ok: string) {
    setBusy(true)
    setMsg(null)
    try {
      const r = await fetch("/api/dogcity/property", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
      const d = await r.json().catch(() => ({}))
      if (r.ok && d?.ok) {
        setMsg({ ok: true, text: ok })
        setOpen(false)
        setPick([])
        setConfirm(null)
        load()
      } else {
        const until = d?.until ? ` Next change from ${day(d.until)}.` : ""
        setMsg({ ok: false, text: (d?.error ?? "Could not save right now. Try again in a moment.") + until })
      }
    } catch {
      setMsg({ ok: false, text: "Could not save right now. Try again in a moment." })
    } finally {
      setBusy(false)
    }
  }

  const toggle = (lot: string) => setPick((p) => (p.includes(lot) ? p.filter((x) => x !== lot) : [...p, lot].sort()))
  const btn = "inline-flex items-center gap-1.5 border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors disabled:opacity-40"

  return (
    <div className="space-y-4 border border-white/10 bg-void p-5 md:p-6">
      <PlateHead icon={Home}>property</PlateHead>

      {data.dissolvedNow.length > 0 && (
        <p className="text-[12px] text-[#F59E0B]">
          A lot left this wallet, so the property it belonged to went back to separate lots. Each lot keeps its own house.
        </p>
      )}

      {data.properties.map((p) => {
        const canSplit = Date.parse(p.splitAfter) <= Date.now()
        return (
          <div key={p.id} className="space-y-2 border border-white/10 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-dusty">
              Property · {p.lots.length} lots{p.tier ? ` · ${TIER_LABEL[p.tier]}` : ""}
            </p>
            <p className="font-mono text-[11px] text-snow break-all">{p.lots.join(" + ")}</p>
            <p className="text-[12px] text-mist">
              {p.tier ? HOUSE[p.tier] : "A house"}, {p.amenities.map((a) => AMENITY[a] ?? a).join(", ")}, and gardens on the rest.
            </p>
            {confirm === p.id ? (
              <div className="space-y-2">
                <p className="text-[12px] text-mist">
                  Each lot goes back to its own house. Licences stay with their lots. You can join lots again in {data.cooldownDays} days.
                </p>
                <div className="flex gap-3">
                  <button disabled={busy} onClick={() => send({ action: "split", id: p.id }, "Restored. Each lot is back to its own house on the next build round.")}
                    className={`${btn} border-lava bg-lava/[0.2] text-lava hover:bg-lava/[0.3]`}>
                    {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Confirm
                  </button>
                  <button disabled={busy} onClick={() => setConfirm(null)} className="font-mono text-[10px] uppercase tracking-[0.18em] text-dusty hover:text-snow">Cancel</button>
                </div>
              </div>
            ) : (
              <button disabled={!canSplit} onClick={() => setConfirm(p.id)} className={`${btn} border-white/20 text-dusty hover:text-snow`}>
                Restore separate lots
              </button>
            )}
            {!canSplit && <p className="text-[11px] text-dusty">Available from {day(p.splitAfter)}.</p>}
          </div>
        )
      })}

      {data.canExpand && !open && (
        <div className="space-y-2">
          <p className="text-[12px] text-mist leading-relaxed">
            Some of your lots sit side by side. Join them and your house spreads across the whole ground, with room for a pool,
            courts and gardens. It is free and only changes the game: on chain every lot stays its own deed.
          </p>
          <button onClick={() => { setOpen(true); setMsg(null) }} className={`${btn} border-lava/50 bg-lava/[0.08] text-lava hover:bg-lava/[0.16]`}>
            Expand your house
          </button>
        </div>
      )}

      {open && (
        <div className="space-y-3">
          <p className="text-[12px] text-mist">Pick the lots that join. Leave out any lot you want to keep apart, for example to sell it.</p>
          {data.options.map((o) => (
            <ul key={o.lots[0]} className="border border-white/10">
              {o.lots.map((l) => {
                const locked = o.merged.includes(l) || !!o.cooldownUntil[l]
                return (
                  <li key={l} className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/5 last:border-0">
                    <label className="flex items-center gap-2 font-mono text-[11px] text-snow">
                      <input type="checkbox" disabled={locked} checked={pick.includes(l)} onChange={() => toggle(l)} />
                      {l}
                    </label>
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-dusty">
                      {o.merged.includes(l) ? "in a property" : o.cooldownUntil[l] ? `from ${day(o.cooldownUntil[l])}` : tierOf.get(l) ? TIER_LABEL[tierOf.get(l)!] : "ground only"}
                    </span>
                  </li>
                )
              })}
            </ul>
          ))}
          {pick.length >= 2 && (
            <div className="border border-lava/30 p-3 space-y-2">
              {pickTier ? (
                <>
                  <p className="text-[12px] text-mist">
                    {TIER_LABEL[pickTier]} property: {HOUSE[pickTier]}, {data.amenitiesByTier[pickTier].map((a) => AMENITY[a] ?? a).join(", ")} when
                    they fit (the pool always comes first), and gardens on the rest.
                  </p>
                  {confirm === "merge" ? (
                    <div className="space-y-2">
                      <p className="text-[12px] text-mist">
                        Join {pick.length} lots into one property? You can restore separate lots after {data.cooldownDays} days. Selling any of these
                        lots restores them on its own.
                      </p>
                      <div className="flex gap-3">
                        <button disabled={busy} onClick={() => send({ action: "merge", lots: pick }, "Joined. Your new house goes up on the next build round.")}
                          className={`${btn} border-lava bg-lava/[0.2] text-lava hover:bg-lava/[0.3]`}>
                          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Confirm
                        </button>
                        <button disabled={busy} onClick={() => setConfirm(null)} className="font-mono text-[10px] uppercase tracking-[0.18em] text-dusty hover:text-snow">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setConfirm("merge")} className={`${btn} border-lava/50 bg-lava/[0.08] text-lava hover:bg-lava/[0.16]`}>Join these lots</button>
                  )}
                </>
              ) : (
                <p className="text-[12px] text-[#F59E0B]">At least one of the lots you pick needs a building licence.</p>
              )}
            </div>
          )}
          <button onClick={() => { setOpen(false); setPick([]); setConfirm(null) }} className="font-mono text-[10px] uppercase tracking-[0.18em] text-dusty hover:text-snow">Close</button>
        </div>
      )}

      {msg && <p className={`text-[12px] ${msg.ok ? "text-[#10B981]" : "text-[#F59E0B]"}`}>{msg.text}</p>}
    </div>
  )
}
