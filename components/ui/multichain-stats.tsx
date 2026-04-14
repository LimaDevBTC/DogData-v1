"use client"

import React, { useState, useEffect } from 'react'
import { Users, BarChart3 } from 'lucide-react'

interface ChainInfo {
  chain: string
  symbol: string
  price_usd: number
  price_change_24h: number
  market_cap_usd: number
  volume_24h_usd: number
  liquidity_usd: number | null
  holder_count: number
  circulating_supply: number
}

interface MultiChainData {
  total_holders: number
  total_market_cap_usd: number
  total_volume_24h_usd: number
  chains: ChainInfo[]
}

function formatCompact(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  if (n > 0) return `$${n.toFixed(2)}`
  return '$0'
}

export function MultiChainStats() {
  const [data, setData] = useState<MultiChainData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/multichain/stats')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d) })
      .catch(err => console.warn('MultiChain stats error:', err))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return null

  if (!data || data.chains.length === 0) return null

  return (
    <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8 py-2 px-4 rounded-lg bg-snow/[0.02] border border-snow/[0.04]">
      <div className="text-center">
        <div className="text-[9px] md:text-[10px] text-dusty/40 font-mono uppercase tracking-wider">Cross-Chain Holders</div>
        <div className="text-sm md:text-base font-mono font-bold text-snow/90">
          {data.total_holders.toLocaleString()}
        </div>
      </div>
      <div className="w-px h-6 bg-snow/[0.06] hidden md:block" />
      <div className="text-center">
        <div className="text-[9px] md:text-[10px] text-dusty/40 font-mono uppercase tracking-wider">Combined Volume 24h</div>
        <div className="text-sm md:text-base font-mono font-bold text-snow/90">
          {formatCompact(data.total_volume_24h_usd)}
        </div>
      </div>
    </div>
  )
}
