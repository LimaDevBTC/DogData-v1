"use client"

// O calendario e a ponta do mint, lidos de /api/dogcity/minter (rota do servidor, cache de borda de 15 s): o navegador
// nunca fala com o mint nem com banco. Falhou = null e a tela some, nunca um numero antigo inventado.
import { useEffect, useState } from "react"
import { parseCalendar, type Calendar } from "./mint-state"
import { whitelistClock, type WhitelistClock } from "./unclaimed"

const POLL_MS = 60_000

export interface MintClock {
  clock: WhitelistClock | null
  /** lotes com pedido pago ou cunhados (o mesmo "claimed" do contador da landing); null sem leitura */
  claimed: number | null
}

const num = (v: unknown) => (typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : null)

export function parseMinterRead(j: unknown): MintClock | null {
  if (typeof j !== "object" || j === null) return null
  const o = j as Record<string, unknown>
  let cal: Calendar | null = null
  try { cal = parseCalendar(o.calendar) } catch { cal = null }
  const claimed = num(o.claimed) ?? num(o.minted)
  return { clock: whitelistClock(cal, num(o.height)), claimed }
}

export function useMintClock(): MintClock {
  const [read, setRead] = useState<MintClock>({ clock: null, claimed: null })
  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout> | null = null
    const tick = async () => {
      if (document.visibilityState === "visible") {
        try {
          const r = await fetch("/api/dogcity/minter", { signal: AbortSignal.timeout(10_000) })
          const next = r.ok ? parseMinterRead(await r.json()) : null
          if (alive && next) setRead(next)
        } catch { /* mantem a ultima leitura */ }
      }
      if (alive) timer = setTimeout(tick, POLL_MS)
    }
    void tick()
    // aba aberta em segundo plano e depois trazida para a frente: le na hora, sem esperar o proximo ciclo
    const onVis = () => { if (document.visibilityState === "visible") { if (timer) clearTimeout(timer); void tick() } }
    document.addEventListener("visibilitychange", onVis)
    return () => { alive = false; if (timer) clearTimeout(timer); document.removeEventListener("visibilitychange", onVis) }
  }, [])
  return read
}
