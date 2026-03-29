"use client"

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle } from './card'
import { TrendingUp, TrendingDown, Users, BarChart3, Droplets } from 'lucide-react'

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

const CHAIN_CONFIG: Record<string, {
  label: string
  color: string
  borderColor: string
  gradientFrom: string
  gradientTo: string
  logo: string
  logoSize: number
}> = {
  solana: {
    label: 'Solana',
    color: 'text-purple-400',
    borderColor: 'border-purple-500/[0.12]',
    gradientFrom: 'from-purple-950/30',
    gradientTo: 'to-purple-900/5',
    logo: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
    logoSize: 20,
  },
  stacks: {
    label: 'Stacks',
    color: 'text-orange-400',
    borderColor: 'border-orange-500/[0.12]',
    gradientFrom: 'from-orange-950/30',
    gradientTo: 'to-orange-900/5',
    logo: '/STX .png',
    logoSize: 20,
  },
}

function formatPrice(price: number): string {
  if (price === 0) return '$0'
  if (price < 0.0001) return `$${price.toFixed(8)}`
  if (price < 0.01) return `$${price.toFixed(6)}`
  if (price < 1) return `$${price.toFixed(4)}`
  return `$${price.toFixed(2)}`
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

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
        {[0, 1].map(i => (
          <Card key={i} variant="glass" className="animate-pulse min-h-[160px]">
            <CardContent className="p-4">
              <div className="h-4 bg-snow/5 rounded w-1/3 mb-3" />
              <div className="h-8 bg-snow/5 rounded w-1/2 mb-2" />
              <div className="h-3 bg-snow/5 rounded w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!data || data.chains.length === 0) return null

  return (
    <div className="space-y-3">
      {/* Per-chain cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
        {data.chains.map(chain => {
          const config = CHAIN_CONFIG[chain.chain]
          if (!config) return null

          return (
            <Card
              key={chain.chain}
              variant="glass"
              className={`border ${config.borderColor} bg-gradient-to-br ${config.gradientFrom} via-transparent ${config.gradientTo} hover:border-opacity-30 transition-all duration-300`}
            >
              <CardHeader className="pb-2">
                <CardTitle variant="mono" className="text-[11px] md:text-sm text-dusty flex items-center gap-2">
                  <Image src={config.logo} alt={config.label} width={config.logoSize} height={config.logoSize} className="opacity-80" />
                  <span>DOG on {config.label}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Price row */}
                  <div className="flex items-baseline gap-3">
                    <span className="text-lg md:text-2xl font-bold text-snow font-mono metric-value tracking-tight">
                      {formatPrice(chain.price_usd)}
                    </span>
                    {chain.price_change_24h !== 0 && (
                      <span className={`flex items-center gap-0.5 text-xs font-mono font-semibold ${
                        chain.price_change_24h >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {chain.price_change_24h >= 0 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        {chain.price_change_24h >= 0 ? '+' : ''}{chain.price_change_24h.toFixed(2)}%
                      </span>
                    )}
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <div className="flex items-center gap-1 text-[9px] md:text-[10px] text-dusty/50 font-mono uppercase tracking-wider mb-0.5">
                        <Users className="w-2.5 h-2.5" /> Holders
                      </div>
                      <div className="text-xs md:text-sm font-mono font-semibold text-snow/80">
                        {chain.holder_count.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 text-[9px] md:text-[10px] text-dusty/50 font-mono uppercase tracking-wider mb-0.5">
                        <BarChart3 className="w-2.5 h-2.5" /> Vol 24h
                      </div>
                      <div className="text-xs md:text-sm font-mono font-semibold text-snow/80">
                        {formatCompact(chain.volume_24h_usd)}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 text-[9px] md:text-[10px] text-dusty/50 font-mono uppercase tracking-wider mb-0.5">
                        <Droplets className="w-2.5 h-2.5" /> Liquidity
                      </div>
                      <div className="text-xs md:text-sm font-mono font-semibold text-snow/80">
                        {chain.liquidity_usd ? formatCompact(chain.liquidity_usd) : 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Aggregated totals bar */}
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
        <div className="w-px h-6 bg-snow/[0.06] hidden md:block" />
        <div className="text-center">
          <div className="text-[9px] md:text-[10px] text-dusty/40 font-mono uppercase tracking-wider">Combined MCap</div>
          <div className="text-sm md:text-base font-mono font-bold text-snow/90">
            {formatCompact(data.total_market_cap_usd)}
          </div>
        </div>
      </div>
    </div>
  )
}
