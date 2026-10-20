"use client"

// O placar COMPLETO do fundo (/api/donate/leaderboard, sem ?slim): alimenta a seção
// "Fund the city" (./sections/construction-fund.tsx), que lê contribuintes, fundadores
// e as últimas entradas. O contador do herói segue no JSON enxuto de ./use-countdown.ts.
//
// Fica FORA do caminho crítico: espera a página carregar e o navegador ficar ocioso
// (a seção está bem abaixo da dobra), e atualiza a cada 60 s só com a aba visível.
// ⚠️ r.ok E a forma são obrigatórios (incidente de 26/08: 503 com { error } derrubou a árvore).

import { useEffect, useState } from "react"
import type { LeaderboardData } from "../types"

const POLL_MS = 60_000

export function useLeaderboard(): LeaderboardData | null {
  const [lb, setLb] = useState<LeaderboardData | null>(null)
  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout> | null = null
    const tick = async () => {
      if (document.visibilityState === "visible") {
        try {
          const r = await fetch("/api/donate/leaderboard", { signal: AbortSignal.timeout(10_000) })
          const j = r.ok ? await r.json() : null
          if (alive && j && typeof j.total_received === "number") setLb(j as LeaderboardData)
        } catch { /* mantém a última leitura */ }
      }
      if (alive) timer = setTimeout(tick, POLL_MS)
    }
    const start = () => { void tick() }
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback
    const t0 = setTimeout(() => (ric ? ric(start, { timeout: 3000 }) : start()), 1500)
    return () => { alive = false; clearTimeout(t0); if (timer) clearTimeout(timer) }
  }, [])
  return lb
}
