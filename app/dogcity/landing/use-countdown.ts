"use client"

// O contador vivo: junta o fundo (/api/donate/leaderboard, a cada 60 s), a
// altura do Bitcoin (o feed único de ../use-mempool.ts) e o bloco B (variável
// pública NEXT_PUBLIC_DOGCITY_MINT_B, vazia até o fundo encher) e entrega o
// estado da máquina pura de ./mint-state.ts. Uma fonte para o herói, o botão
// vivo da navegação e o calendário.
//
// ⚠️ SIMULAÇÃO SÓ NO DEV. `?mintsim=A|B0|B|C|D|E|F|connecting` troca a entrada
// por dado simulado para conferir os seis estados na tela. O ramo inteiro some
// do build de produção (NODE_ENV é substituído em tempo de compilação), então
// nunca há número de exemplo em produção.

import { useEffect, useMemo, useState } from "react"
import { useMempoolFeed } from "../use-mempool"
import { countdownState, parseB, FUND_GOAL, type CountdownInput, type CountdownState } from "./mint-state"

const B_ENV = parseB(process.env.NEXT_PUBLIC_DOGCITY_MINT_B)
const FUND_POLL_MS = 60_000

export interface FundData { raised: number; goal: number }

function useFund(): FundData | null {
  const [fund, setFund] = useState<FundData | null>(null)
  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout> | null = null
    const tick = async () => {
      if (document.visibilityState === "visible") {
        try {
          // ⚠️ r.ok E a forma são obrigatórios (incidente de 26/08: 503 com { error })
          const r = await fetch("/api/donate/leaderboard", { signal: AbortSignal.timeout(10_000) })
          const j = r.ok ? await r.json() : null
          if (alive && j && typeof j.total_received === "number" && Number.isFinite(j.total_received)) {
            setFund({ raised: j.total_received, goal: typeof j.goal === "number" && j.goal > 0 ? j.goal : FUND_GOAL })
          }
        } catch { /* mantém a última leitura */ }
      }
      if (alive) timer = setTimeout(tick, FUND_POLL_MS)
    }
    void tick()
    const onVis = () => { if (document.visibilityState === "visible" && timer) { clearTimeout(timer); void tick() } }
    document.addEventListener("visibilitychange", onVis)
    return () => { alive = false; if (timer) clearTimeout(timer); document.removeEventListener("visibilitychange", onVis) }
  }, [])
  return fund
}

function simulated(): CountdownInput | null {
  if (process.env.NODE_ENV === "production") return null
  if (typeof window === "undefined") return null
  const k = new URLSearchParams(window.location.search).get("mintsim")
  if (!k) return null
  const B = 971_900
  const map: Record<string, CountdownInput> = {
    connecting: { raised: null, B: null, tip: null },
    A: { raised: 9_887_345.6, B: null, tip: 971_954 },
    B0: { raised: 10_000_250, B: null, tip: 971_954 },
    B: { raised: 10_000_250, B, tip: B + 76 },
    C: { raised: null, B, tip: B + 380 },
    D: { raised: null, B, tip: B + 854 },
    E: { raised: null, B, tip: B + 3852 },
    F: { raised: null, B, tip: B + 4100 },
  }
  return map[k] ?? null
}

export function useCountdown(): CountdownState {
  const fund = useFund()
  const { feed } = useMempoolFeed()
  const tip = feed?.snapshot?.tip_height ?? null
  const [sim, setSim] = useState<CountdownInput | null>(null)
  useEffect(() => { setSim(simulated()) }, [])
  return useMemo(() => {
    const input: CountdownInput = sim ?? { raised: fund?.raised ?? null, goal: fund?.goal ?? FUND_GOAL, B: B_ENV, tip }
    return countdownState(input)
  }, [sim, fund, tip])
}
