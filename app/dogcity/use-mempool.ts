"use client"

// O FEED DA MEMPOOL DO DOG, num lugar só.
//
// Nasceu dentro de sections/plaza-live.tsx e saiu de lá quando a faixa viva do
// topo (praca-ajustes.md item 6) passou a ler o mesmo feed: duas cópias do mesmo
// polling significariam duas verdades na mesma página, e a página inteira tem
// que dizer o mesmo número.
//
// Lê /api/mempool/dog, que serve o que o NOSSO nó vê: quantas transações de DOG
// estão em órbita, quanto DOG elas carregam, e qual foi o último pouso. Se o
// feed calar por dois minutos, quem consome mostra SYNCING, não LIVE.
import { useEffect, useState } from "react"

export interface MempoolSnapshot {
  updated_at: string
  tx_count: number
  fee_fast: number | null
  fee_slow: number | null
  tip_height: number | null
  dog_pending: number
  dog_pending_amount: number
  last_dog_block: number | null
  last_dog_block_time: string | null
  last_dog_block_count: number | null
  last_dog_block_amount: number | null
}

export interface MempoolFeed {
  snapshot: MempoolSnapshot | null
  stale_seconds: number | null
  landed?: unknown[]
}

export const MEMPOOL_POLL_MS = 20_000
export const MEMPOOL_STALE_S = 120

export function useMempoolFeed(): { feed: MempoolFeed | null; now: number } {
  const [feed, setFeed] = useState<MempoolFeed | null>(null)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout> | null = null
    const tick = async () => {
      try {
        const r = await fetch("/api/mempool/dog", { cache: "no-store" })
        if (r.ok) {
          const j = (await r.json()) as MempoolFeed
          if (alive) setFeed(j)
        }
      } catch {
        // quem consome fica com a última leitura; a idade a leva para SYNCING
      }
      if (alive) {
        setNow(Date.now())
        timer = setTimeout(tick, MEMPOOL_POLL_MS)
      }
    }
    void tick()
    return () => {
      alive = false
      if (timer) clearTimeout(timer)
    }
  }, [])
  return { feed, now }
}

export function minutesAgo(iso: string | null | undefined, now: number): string {
  if (!iso) return "—"
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000))
  if (m < 1) return "just now"
  if (m === 1) return "1 min ago"
  if (m < 90) return `${m} min ago`
  const h = Math.round(m / 60)
  return `${h} h ago`
}
