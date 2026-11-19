"use client"

// A ESCOLHA DO LOTE DA LICENÇA (fundador, 19/11/2026). Só com a sessão de carteira assinada: a rota
// /api/dogcity/licence-choice lê a carteira do cookie, nunca da tela. Mostra o crédito livre, as propriedades
// (lotes vizinhos juntos, lib/dog/lot-property.ts) e os lotes soltos, e aplica onde o dono escolher, com um
// passo de confirmação (aplicar não volta: a licença fica com o lote).
// Copy 100% em inglês, sem travessão.
import { useCallback, useEffect, useState } from "react"
import { Check, Loader2, MapPin } from "lucide-react"
import { PlateHead } from "@/components/plot/kit"
import { licenceFor, type LicenceTier } from "@/lib/dog/licence-btc"

interface LotRow { lot: string; tier: LicenceTier | null; totalDog: number }
interface PropertyRow { id: string; lots: LotRow[]; tier: LicenceTier | null; licenceLot: string | null }
interface Choice {
  unassignedDog: number
  canChoose: boolean
  lotsFrom: "mint" | "snapshot" | null
  lots: LotRow[]
  properties: PropertyRow[]
}

const TIER_LABEL: Record<string, string> = { personal: "Personal", commercial: "Commercial", patron: "Patron" }
const n0 = (n: number) => Math.round(n).toLocaleString("en-US")
const tierAfter = (current: number, add: number): LicenceTier | null => {
  const k = licenceFor(current + add)
  return k === "personal" || k === "commercial" || k === "patron" ? k : null
}

/** o lote em que o crédito cai quando o dono escolhe a propriedade: o que já tem a licença dela, senão a âncora */
const targetOf = (p: PropertyRow) => p.licenceLot ?? p.id

export function LicenceChoiceCard({ verified, onApplied }: { verified: boolean; onApplied?: () => void }) {
  const [data, setData] = useState<Choice | null>(null)
  const [failed, setFailed] = useState(false)
  const [pick, setPick] = useState<string | null>(null)
  const [amount, setAmount] = useState("")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(() => {
    if (!verified) return
    fetch("/api/dogcity/licence-choice", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: Choice) => { setData(d); setFailed(false) })
      .catch(() => setFailed(true))
  }, [verified])

  useEffect(() => { load() }, [load])

  if (!verified || failed || !data) return null
  // nada a escolher e nenhum lote unido: o cartão não aparece (a casa e a licença já estão na chapa ao lado)
  const unidas = data.properties.filter((p) => p.lots.length > 1)
  if (!data.canChoose && unidas.length === 0) return null

  const free = data.unassignedDog
  const parsed = amount.trim() === "" ? free : Number(amount.replace(/,/g, ""))
  const amountOk = Number.isFinite(parsed) && parsed > 0 && parsed <= free
  const lotTotal = (lot: string) => data.lots.find((l) => l.lot === lot)?.totalDog ?? 0

  async function apply(lotId: string) {
    if (!amountOk) return
    setBusy(true)
    setMsg(null)
    try {
      const r = await fetch("/api/dogcity/licence-choice", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lotId, amountDog: amount.trim() === "" ? null : parsed }),
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok && d?.ok) {
        const t = tierAfter(0, d.lotTotalDog ?? 0)
        setMsg({ ok: true, text: `Applied. ${lotId} now holds ${n0(d.lotTotalDog)} DOG${t ? `, a ${TIER_LABEL[t]} licence` : ""}. Your house follows on the next build round.` })
        setPick(null)
        setAmount("")
        load()
        onApplied?.()
      } else {
        setMsg({ ok: false, text: d?.error ?? "Could not apply right now. Try again in a moment." })
        if (r.status === 409) load()
      }
    } catch {
      setMsg({ ok: false, text: "Could not apply right now. Try again in a moment." })
    } finally {
      setBusy(false)
    }
  }

  const ApplyBlock = ({ target }: { target: string }) => {
    const after = tierAfter(lotTotal(target), amountOk ? parsed : 0)
    if (pick !== target) {
      return (
        <button
          disabled={!data.canChoose}
          onClick={() => { setPick(target); setMsg(null) }}
          className="inline-flex items-center gap-1.5 border border-lava/50 bg-lava/[0.08] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-lava hover:bg-lava/[0.16] transition-colors disabled:opacity-40"
        >
          Apply credit here
        </button>
      )
    }
    return (
      <div className="space-y-2 border border-lava/30 p-3">
        <p className="text-[12px] text-mist leading-relaxed">
          Apply {amountOk ? n0(parsed) : "?"} DOG to <span className="font-mono text-snow">{target}</span>
          {after ? <>: it becomes a <span className="text-snow">{TIER_LABEL[after]}</span> licence.</> : "."}{" "}
          This cannot be undone. The licence stays with the lot, also if the deed is sold.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            disabled={busy || !amountOk}
            onClick={() => apply(target)}
            className="inline-flex items-center gap-1.5 border border-lava bg-lava/[0.2] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-lava hover:bg-lava/[0.3] transition-colors disabled:opacity-40"
          >
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Confirm
          </button>
          <button
            disabled={busy}
            onClick={() => setPick(null)}
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-dusty hover:text-snow transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  const LotLine = ({ l }: { l: LotRow }) => (
    <li className="flex flex-wrap items-center justify-between gap-2 py-1.5 border-b border-white/5 last:border-0">
      <span className="font-mono text-[11px] text-snow">{l.lot}</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-dusty">
        {l.tier ? TIER_LABEL[l.tier] : "no licence"}{l.totalDog > 0 ? ` · ${n0(l.totalDog)} DOG` : ""}
      </span>
    </li>
  )

  return (
    <div className="space-y-4 border border-white/10 bg-void p-5 md:p-6">
      <PlateHead icon={MapPin}>licence credit</PlateHead>
      {data.canChoose ? (
        <>
          <p className="font-display font-bold text-xl text-snow tabular-nums">
            {n0(free)} <span className="text-mist text-sm font-mono">DOG not tied to a lot yet</span>
          </p>
          <p className="text-[12px] text-mist leading-relaxed">
            A building licence belongs to a lot, and this wallet holds more than one, so you choose where the credit
            goes. Lots side by side are one property in the game: a licence on any of them builds across the whole
            ground, with room for a pool, courts and gardens.
          </p>
          <label className="flex flex-wrap items-center gap-2 text-[12px] text-dusty">
            Amount
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`all (${n0(free)})`}
              className="w-40 bg-transparent border border-white/15 px-2 py-1 font-mono text-[12px] text-snow focus:border-lava outline-none"
            />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em]">DOG</span>
          </label>
          {!amountOk && amount.trim() !== "" && (
            <p className="text-[12px] text-[#F59E0B]">Pick an amount above 0 and up to {n0(free)}.</p>
          )}
        </>
      ) : (
        <p className="text-[12px] text-mist leading-relaxed">
          Lots side by side are one property in the game: the licence of the property builds across the whole ground.
        </p>
      )}

      <div className="grid md:grid-cols-2 gap-px bg-white/10 border border-white/10">
        {data.properties.map((p) => (
          <div key={p.id} className="bg-void p-4 space-y-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-dusty">
              {p.lots.length > 1 ? `Property · ${p.lots.length} lots side by side` : "Single lot"}
              {p.tier ? ` · ${TIER_LABEL[p.tier]}` : ""}
            </p>
            <ul>{p.lots.map((l) => <LotLine key={l.lot} l={l} />)}</ul>
            {data.canChoose && <ApplyBlock target={targetOf(p)} />}
            {data.canChoose && p.lots.length > 1 && (
              <p className="text-[11px] text-dusty leading-relaxed">
                The credit goes to {targetOf(p)}{p.licenceLot ? ", the lot that already holds this property's licence" : ""}. On chain each lot stays its own deed.
              </p>
            )}
          </div>
        ))}
      </div>

      {msg && <p className={`text-[12px] ${msg.ok ? "text-[#10B981]" : "text-[#F59E0B]"}`}>{msg.text}</p>}
    </div>
  )
}
