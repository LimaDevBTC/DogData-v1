"use client"

import { useState, useEffect } from "react"

interface MarketsResponse {
  marketData?: {
    price?: number
    priceChange24h?: number
  }
}

/**
 * Fetches DOG/USD spot price from /api/markets.
 * Single-shot fetch on mount; refresh by re-mounting or calling fetch manually.
 */
export function useDogPrice(): { price: number | null; loading: boolean } {
  const [price, setPrice] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch("/api/markets")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: MarketsResponse | null) => {
        if (cancelled) return
        const p = d?.marketData?.price
        if (typeof p === "number" && p > 0) setPrice(p)
      })
      .catch(() => {
        /* silent — caller renders without price */
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { price, loading }
}

/** Compact USD format: $4.54M, $720K, $1.2B */
export function fmtUsdCompact(usd: number): string {
  if (usd >= 1_000_000_000) return "$" + (usd / 1_000_000_000).toFixed(2) + "B"
  if (usd >= 1_000_000) return "$" + (usd / 1_000_000).toFixed(2) + "M"
  if (usd >= 1_000) return "$" + (usd / 1_000).toFixed(1) + "K"
  return "$" + usd.toFixed(0)
}

/** Full USD format: $4,548,123 */
export function fmtUsdFull(usd: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(usd)
}
