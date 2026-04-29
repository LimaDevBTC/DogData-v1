"use client"

import React, { useState, useEffect } from "react"
import Image from "next/image"
import { Layout } from "@/components/layout"
import { LoadingScreen } from "@/components/loading-screen"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SectionDivider } from "@/components/ui/section-divider"
import {
  Globe,
  Users,
  BarChart3,
  Droplets,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRightLeft,
  Repeat,
  ExternalLink,
  Copy,
} from "lucide-react"

// === Types ===

interface ChainInfo {
  chain: string
  symbol: string
  name: string
  price_usd: number
  price_change_24h: number
  market_cap_usd: number
  volume_24h_usd: number
  liquidity_usd: number | null
  holder_count: number
  circulating_supply: number
  total_supply: number
}

interface MultiChainData {
  total_holders: number
  total_market_cap_usd: number
  total_volume_24h_usd: number
  total_supply_all_chains: number
  chains: ChainInfo[]
}

interface StacksHolder {
  chain: string
  address: string
  balance: number
  balance_usd: number | null
  percentage_of_supply: number
  rank: number
  last_active: string | null
}

interface StacksTransaction {
  chain: string
  tx_id: string
  type: string
  from_address: string
  to_address: string
  amount: number
  amount_usd: number | null
  timestamp: string
  block_height: number | null
}

// === Helpers ===

const CHAIN_CONFIG: Record<string, {
  label: string
  logo: string
  logoSize: number
  color: string
  textColor: string
  borderColor: string
  bgGradient: string
  explorer: string
  explorerTx: string
}> = {
  bitcoin: {
    label: 'Bitcoin',
    logo: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
    logoSize: 20,
    color: 'bg-amber-500',
    textColor: 'text-amber-400',
    borderColor: 'border-amber-500/[0.15]',
    bgGradient: 'from-amber-950/20 to-transparent',
    explorer: 'https://mempool.space/address/',
    explorerTx: 'https://mempool.space/tx/',
  },
  solana: {
    label: 'Solana',
    logo: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
    logoSize: 20,
    color: 'bg-purple-500',
    textColor: 'text-purple-400',
    borderColor: 'border-purple-500/[0.15]',
    bgGradient: 'from-purple-950/20 to-transparent',
    explorer: 'https://solscan.io/account/',
    explorerTx: 'https://solscan.io/tx/',
  },
  stacks: {
    label: 'Stacks',
    logo: '/STX .png',
    logoSize: 20,
    color: 'bg-orange-500',
    textColor: 'text-orange-400',
    borderColor: 'border-orange-500/[0.15]',
    bgGradient: 'from-orange-950/20 to-transparent',
    explorer: 'https://explorer.hiro.so/address/',
    explorerTx: 'https://explorer.hiro.so/txid/',
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

const DOG_TOTAL_SUPPLY = 100_000_000_000 // 100B total across all chains

function formatDOG(amount: number): string {
  if (amount >= 1e9) return `${(amount / 1e9).toFixed(2)}B`
  if (amount >= 1e6) return `${(amount / 1e6).toFixed(2)}M`
  if (amount >= 1e3) return `${(amount / 1e3).toFixed(1)}K`
  return amount.toFixed(2)
}

function pctOfTotal(balance: number): string {
  return ((balance / DOG_TOTAL_SUPPLY) * 100).toFixed(6)
}

function shortAddr(addr: string | null | undefined): string {
  if (!addr) return '—'
  if (addr.length <= 16) return addr
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`
}

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

// === Component ===

export default function MultiChainPage() {
  const [stats, setStats] = useState<MultiChainData | null>(null)
  const [holdersData, setHoldersData] = useState<any>(null)
  const [txData, setTxData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'holders' | 'transactions'>('overview')
  const [copiedText, setCopiedText] = useState<string | null>(null)

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedText(text)
    setTimeout(() => setCopiedText(null), 2000)
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/multichain/stats').then(r => r.ok ? r.json() : null),
      fetch('/api/multichain/holders?limit=25').then(r => r.ok ? r.json() : null),
      fetch('/api/multichain/transactions?limit=30').then(r => r.ok ? r.json() : null),
    ])
      .then(([s, h, t]) => {
        if (s) setStats(s)
        if (h) setHoldersData(h)
        if (t) setTxData(t)
      })
      .catch(err => console.error('MultiChain page error:', err))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingScreen />

  return (
    <Layout currentPage="multichain" setCurrentPage={() => {}}>
      <div className="aurora-bg" />

      <div className="min-h-screen pt-1 pb-2 md:py-2 space-y-3 md:space-y-4 relative z-10">
        {/* Header */}
        <div className="animate-fade-in px-4 mt-4 md:mt-8 mb-2">
          <div className="flex flex-col items-center text-center">
            <Badge variant="outline" className="border-lava/20 text-lava/80 font-mono text-[10px] md:text-xs mb-3 px-3 py-1 tracking-widest">
              BITCOIN &middot; SOLANA &middot; STACKS
            </Badge>
            <h1 className="text-xl sm:text-2xl md:text-4xl font-display font-bold tracking-tight leading-none">
              <span className="gradient-text-hero">Cross-Chain DOG</span>
            </h1>
            <p className="text-xs md:text-sm text-dusty/60 font-mono mt-2 max-w-md">
              DOG token activity across all chains in real-time
            </p>
          </div>
        </div>

        {/* Aggregated totals */}
        {stats && (
          <>
            <SectionDivider title="Aggregate Stats" icon={Globe} />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
              <Card variant="glass">
                <CardContent className="p-3 md:p-4">
                  <div className="text-[9px] md:text-[10px] text-dusty/50 font-mono uppercase tracking-wider mb-1">Total Holders</div>
                  <div className="text-lg md:text-2xl font-bold text-snow font-mono metric-value">
                    {stats.total_holders.toLocaleString()}
                  </div>
                  <div className="text-[9px] text-dusty/40 font-mono mt-0.5">across {stats.chains.length} chains</div>
                </CardContent>
              </Card>
              <Card variant="glass">
                <CardContent className="p-3 md:p-4">
                  <div className="text-[9px] md:text-[10px] text-dusty/50 font-mono uppercase tracking-wider mb-1">Combined MCap</div>
                  <div className="text-lg md:text-2xl font-bold text-snow font-mono metric-value">
                    {formatCompact(stats.total_market_cap_usd)}
                  </div>
                </CardContent>
              </Card>
              <Card variant="glass">
                <CardContent className="p-3 md:p-4">
                  <div className="text-[9px] md:text-[10px] text-dusty/50 font-mono uppercase tracking-wider mb-1">Volume 24h</div>
                  <div className="text-lg md:text-2xl font-bold text-snow font-mono metric-value">
                    {formatCompact(stats.total_volume_24h_usd)}
                  </div>
                </CardContent>
              </Card>
              <Card variant="glass">
                <CardContent className="p-3 md:p-4">
                  <div className="text-[9px] md:text-[10px] text-dusty/50 font-mono uppercase tracking-wider mb-1">Active Chains</div>
                  <div className="text-lg md:text-2xl font-bold text-snow font-mono metric-value">
                    {stats.chains.length + 1}
                  </div>
                  <div className="text-[9px] text-dusty/40 font-mono mt-0.5">BTC + {stats.chains.map(c => c.chain === 'solana' ? 'SOL' : 'STX').join(' + ')}</div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Tabs */}
        <div className="flex items-center justify-center gap-1 px-4">
          {(['overview', 'holders', 'transactions'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-xs md:text-sm font-mono font-medium rounded-lg transition-all duration-200 ${
                activeTab === tab
                  ? 'bg-lava/10 text-lava border border-lava/20'
                  : 'text-dusty/60 hover:text-snow/80 border border-transparent'
              }`}
            >
              {tab === 'overview' ? 'Per Chain' : tab === 'holders' ? 'Holders' : 'Transactions'}
            </button>
          ))}
        </div>

        {/* === TAB: Overview (per-chain cards) === */}
        {activeTab === 'overview' && stats && (
          <>
            <SectionDivider title="Per-Chain Breakdown" icon={BarChart3} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {stats.chains.map(chain => {
                const config = CHAIN_CONFIG[chain.chain]
                if (!config) return null

                return (
                  <Card
                    key={chain.chain}
                    variant="glass"
                    className={`border ${config.borderColor} bg-gradient-to-br ${config.bgGradient}`}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle variant="mono" className="text-sm text-dusty flex items-center gap-2">
                        <Image src={config.logo} alt={config.label} width={config.logoSize} height={config.logoSize} className="opacity-80" />
                        DOG on {config.label}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Price */}
                        <div className="flex items-baseline gap-3">
                          <span className="text-2xl md:text-3xl font-bold text-snow font-mono metric-value tracking-tight">
                            {formatPrice(chain.price_usd)}
                          </span>
                          {chain.price_change_24h !== 0 && (
                            <span className={`flex items-center gap-0.5 text-sm font-mono font-semibold ${
                              chain.price_change_24h >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {chain.price_change_24h >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                              {chain.price_change_24h >= 0 ? '+' : ''}{chain.price_change_24h.toFixed(2)}%
                            </span>
                          )}
                        </div>

                        {/* Stats grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <div className="flex items-center gap-1 text-[9px] text-dusty/50 font-mono uppercase tracking-wider mb-0.5">
                              <Users className="w-2.5 h-2.5" /> Holders
                            </div>
                            <div className="text-sm font-mono font-semibold text-snow/80">
                              {chain.holder_count.toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center gap-1 text-[9px] text-dusty/50 font-mono uppercase tracking-wider mb-0.5">
                              <BarChart3 className="w-2.5 h-2.5" /> Vol 24h
                            </div>
                            <div className="text-sm font-mono font-semibold text-snow/80">
                              {formatCompact(chain.volume_24h_usd)}
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center gap-1 text-[9px] text-dusty/50 font-mono uppercase tracking-wider mb-0.5">
                              <Droplets className="w-2.5 h-2.5" /> Liquidity
                            </div>
                            <div className="text-sm font-mono font-semibold text-snow/80">
                              {chain.liquidity_usd ? formatCompact(chain.liquidity_usd) : 'N/A'}
                            </div>
                          </div>
                          {chain.circulating_supply > 0 && (
                            <div>
                              <div className="flex items-center gap-1 text-[9px] text-dusty/50 font-mono uppercase tracking-wider mb-0.5">
                                Supply
                              </div>
                              <div className="text-sm font-mono font-semibold text-snow/80">
                                {formatDOG(chain.circulating_supply)}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </>
        )}

        {/* === TAB: Holders === */}
        {activeTab === 'holders' && holdersData && (
          <>
            <SectionDivider title="Top Holders by Chain" icon={Users} />

            {/* Stacks holders */}
            {holdersData.stacks && holdersData.stacks.holders.length > 0 && (
              <Card variant="glass" className={`border ${CHAIN_CONFIG.stacks.borderColor}`}>
                <CardHeader className="pb-2">
                  <CardTitle variant="mono" className="text-sm text-dusty flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Image src={CHAIN_CONFIG.stacks.logo} alt="Stacks" width={CHAIN_CONFIG.stacks.logoSize} height={CHAIN_CONFIG.stacks.logoSize} className="opacity-80" />
                      Stacks Holders
                    </div>
                    <span className="text-xs text-dusty/40">{holdersData.stacks.total_count} total</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {holdersData.stacks.concentration && (
                    <div className="flex gap-3 mb-3 text-[10px] font-mono text-dusty/50">
                      <span>Top 10: <span className="text-snow/70">{holdersData.stacks.concentration.top_10}%</span></span>
                      <span>Top 25: <span className="text-snow/70">{holdersData.stacks.concentration.top_25}%</span></span>
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono">
                      <thead>
                        <tr className="text-dusty/40 uppercase tracking-wider text-[9px]">
                          <th className="text-left py-1.5 pr-2">#</th>
                          <th className="text-left py-1.5">Address</th>
                          <th className="text-right py-1.5">Balance</th>
                          <th className="text-right py-1.5">% Bridged</th>
                          <th className="text-right py-1.5">% Total</th>
                          <th className="text-right py-1.5 hidden md:table-cell">USD Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(holdersData.stacks.holders as StacksHolder[]).map((h: StacksHolder) => (
                          <tr key={h.address} className="border-t border-snow/[0.03] hover:bg-snow/[0.02]">
                            <td className="py-1.5 pr-2 text-dusty/40">{h.rank}</td>
                            <td className="py-1.5">
                              <a
                                href={`${CHAIN_CONFIG.stacks.explorer}${h.address}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-orange-400/80 hover:text-orange-300 transition-colors"
                              >
                                {shortAddr(h.address)}
                              </a>
                            </td>
                            <td className="py-1.5 text-right text-snow/80">{formatDOG(h.balance)}</td>
                            <td className="py-1.5 text-right text-dusty/60">{h.percentage_of_supply.toFixed(2)}%</td>
                            <td className="py-1.5 text-right text-snow/40">{pctOfTotal(h.balance)}%</td>
                            <td className="py-1.5 text-right text-dusty/50 hidden md:table-cell">
                              {h.balance_usd ? formatCompact(h.balance_usd) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Solana holders */}
            {holdersData.solana && (
              <Card variant="glass" className={`border ${CHAIN_CONFIG.solana.borderColor}`}>
                <CardHeader className="pb-2">
                  <CardTitle variant="mono" className="text-sm text-dusty flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Image src={CHAIN_CONFIG.solana.logo} alt="Solana" width={CHAIN_CONFIG.solana.logoSize} height={CHAIN_CONFIG.solana.logoSize} className="opacity-80" />
                      Solana Holders
                    </div>
                    <span className="text-xs text-dusty/40">{holdersData.solana.total_count?.toLocaleString()} total</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {holdersData.solana.holders?.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs font-mono">
                        <thead>
                          <tr className="text-dusty/40 uppercase tracking-wider text-[9px]">
                            <th className="text-left py-1.5 pr-2">#</th>
                            <th className="text-left py-1.5">Address</th>
                            <th className="text-right py-1.5">Balance</th>
                            <th className="text-right py-1.5">% Bridged</th>
                            <th className="text-right py-1.5">% Total</th>
                            <th className="text-right py-1.5 hidden md:table-cell">USD Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {holdersData.solana.holders.map((h: any) => (
                            <tr key={h.address} className="border-t border-snow/[0.03] hover:bg-snow/[0.02]">
                              <td className="py-1.5 pr-2 text-dusty/40">{h.rank}</td>
                              <td className="py-1.5">
                                <a
                                  href={`${CHAIN_CONFIG.solana.explorer}${h.address}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-purple-400/80 hover:text-purple-300 transition-colors"
                                >
                                  {shortAddr(h.address)}
                                </a>
                              </td>
                              <td className="py-1.5 text-right text-snow/80">{formatDOG(h.balance)}</td>
                              <td className="py-1.5 text-right text-dusty/60">{h.percentage_of_supply?.toFixed(2)}%</td>
                              <td className="py-1.5 text-right text-snow/40">{pctOfTotal(h.balance)}%</td>
                              <td className="py-1.5 text-right text-dusty/50 hidden md:table-cell">
                                {h.balance_usd ? formatCompact(h.balance_usd) : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-dusty/50 font-mono">Loading holders...</p>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* === TAB: Transactions === */}
        {activeTab === 'transactions' && txData && (
          <>
            <SectionDivider title="Recent Transactions" icon={Repeat} />

            {/* Stacks transactions */}
            {txData.stacks && (txData.stacks.transactions?.length ?? 0) > 0 && (
              <Card variant="glass" className={`border ${CHAIN_CONFIG.stacks.borderColor}`}>
                <CardHeader className="pb-2">
                  <CardTitle variant="mono" className="text-sm text-dusty flex items-center gap-2">
                    <Image src={CHAIN_CONFIG.stacks.logo} alt="Stacks" width={CHAIN_CONFIG.stacks.logoSize} height={CHAIN_CONFIG.stacks.logoSize} className="opacity-80" />
                    Stacks Transactions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono">
                      <thead>
                        <tr className="text-dusty/40 uppercase tracking-wider text-[9px]">
                          <th className="text-left py-1.5">Type</th>
                          <th className="text-left py-1.5">From</th>
                          <th className="text-left py-1.5">To</th>
                          <th className="text-right py-1.5">Amount</th>
                          <th className="text-right py-1.5">Time</th>
                          <th className="text-center py-1.5">Tx</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(txData.stacks.transactions as StacksTransaction[] ?? []).map((tx: StacksTransaction) => (
                          <tr key={`${tx.tx_id}-${tx.from_address}`} className="border-t border-snow/[0.03] hover:bg-snow/[0.02]">
                            {/* Type */}
                            <td className="py-2 pr-2">
                              <Badge
                                variant="outline"
                                className={`text-[9px] px-1.5 py-0 ${
                                  tx.type === 'swap' ? 'border-purple-500/30 text-purple-400' : 'border-snow/10 text-dusty/60'
                                }`}
                              >
                                {tx.type}
                              </Badge>
                            </td>

                            {/* From */}
                            <td className="py-2 pr-1">
                              <div className="flex items-center gap-1">
                                <code className="text-cyan-400">{shortAddr(tx.from_address)}</code>
                                <button
                                  onClick={() => handleCopy(tx.from_address)}
                                  className="p-0.5 hover:text-snow/80 text-dusty/30 transition-colors"
                                  title="Copy address"
                                >
                                  {copiedText === tx.from_address ? (
                                    <span className="text-green-400 text-[10px]">✓</span>
                                  ) : (
                                    <Copy className="w-2.5 h-2.5" />
                                  )}
                                </button>
                              </div>
                            </td>

                            {/* To */}
                            <td className="py-2 pr-1">
                              <div className="flex items-center gap-1">
                                <code className="text-green-400">{shortAddr(tx.to_address)}</code>
                                <button
                                  onClick={() => handleCopy(tx.to_address)}
                                  className="p-0.5 hover:text-snow/80 text-dusty/30 transition-colors"
                                  title="Copy address"
                                >
                                  {copiedText === tx.to_address ? (
                                    <span className="text-green-400 text-[10px]">✓</span>
                                  ) : (
                                    <Copy className="w-2.5 h-2.5" />
                                  )}
                                </button>
                              </div>
                            </td>

                            {/* Amount */}
                            <td className="py-2 text-right">
                              <span className="text-lava font-bold">{formatDOG(tx.amount)}</span>
                              {tx.amount_usd != null && tx.amount_usd > 0 && (
                                <div className="text-[9px] text-dusty/40">{formatCompact(tx.amount_usd)}</div>
                              )}
                            </td>

                            {/* Time */}
                            <td className="py-2 text-right text-dusty/50">
                              {timeAgo(tx.timestamp)}
                            </td>

                            {/* Tx ID + Actions */}
                            <td className="py-2 pl-2">
                              <div className="flex items-center justify-center gap-0.5">
                                <code className="text-snow/60">{tx.tx_id?.substring(0, 8) ?? '—'}...</code>
                                <button
                                  onClick={() => tx.tx_id && handleCopy(tx.tx_id)}
                                  className="p-0.5 hover:text-snow/80 text-dusty/30 transition-colors"
                                  title="Copy tx ID"
                                >
                                  {copiedText === tx.tx_id ? (
                                    <span className="text-green-400 text-[10px]">✓</span>
                                  ) : (
                                    <Copy className="w-2.5 h-2.5" />
                                  )}
                                </button>
                                <a
                                  href={`${CHAIN_CONFIG.stacks.explorerTx}${tx.tx_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-0.5 hover:text-orange-400 text-dusty/30 transition-colors"
                                  title="View on Explorer"
                                >
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Solana transactions */}
            {txData.solana && (txData.solana.transactions?.length ?? 0) > 0 && (
              <Card variant="glass" className={`border ${CHAIN_CONFIG.solana.borderColor}`}>
                <CardHeader className="pb-2">
                  <CardTitle variant="mono" className="text-sm text-dusty flex items-center gap-2">
                    <Image src={CHAIN_CONFIG.solana.logo} alt="Solana" width={CHAIN_CONFIG.solana.logoSize} height={CHAIN_CONFIG.solana.logoSize} className="opacity-80" />
                    Solana Transactions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono">
                      <thead>
                        <tr className="text-dusty/40 uppercase tracking-wider text-[9px]">
                          <th className="text-left py-1.5">Type</th>
                          <th className="text-left py-1.5">From</th>
                          <th className="text-left py-1.5">To</th>
                          <th className="text-right py-1.5">Amount</th>
                          <th className="text-right py-1.5">Time</th>
                          <th className="text-center py-1.5">Tx</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(txData.solana.transactions as StacksTransaction[] ?? []).map((tx: StacksTransaction) => (
                          <tr key={tx.tx_id} className="border-t border-snow/[0.03] hover:bg-snow/[0.02]">
                            <td className="py-2 pr-2">
                              <Badge
                                variant="outline"
                                className={`text-[9px] px-1.5 py-0 ${
                                  tx.type === 'swap' ? 'border-purple-500/30 text-purple-400' : 'border-snow/10 text-dusty/60'
                                }`}
                              >
                                {tx.type}
                              </Badge>
                            </td>
                            <td className="py-2 pr-1">
                              <div className="flex items-center gap-1">
                                <code className="text-cyan-400">{shortAddr(tx.from_address)}</code>
                                <button onClick={() => handleCopy(tx.from_address)} className="p-0.5 hover:text-snow/80 text-dusty/30 transition-colors" title="Copy address">
                                  {copiedText === tx.from_address ? <span className="text-green-400 text-[10px]">✓</span> : <Copy className="w-2.5 h-2.5" />}
                                </button>
                              </div>
                            </td>
                            <td className="py-2 pr-1">
                              <div className="flex items-center gap-1">
                                <code className="text-green-400">{shortAddr(tx.to_address)}</code>
                                <button onClick={() => handleCopy(tx.to_address)} className="p-0.5 hover:text-snow/80 text-dusty/30 transition-colors" title="Copy address">
                                  {copiedText === tx.to_address ? <span className="text-green-400 text-[10px]">✓</span> : <Copy className="w-2.5 h-2.5" />}
                                </button>
                              </div>
                            </td>
                            <td className="py-2 text-right">
                              <span className="text-lava font-bold">{formatDOG(tx.amount)} DOG</span>
                            </td>
                            <td className="py-2 text-right text-dusty/50">{timeAgo(tx.timestamp)}</td>
                            <td className="py-2 pl-2">
                              <div className="flex items-center justify-center gap-0.5">
                                <code className="text-snow/60">{tx.tx_id?.substring(0, 8) ?? '—'}...</code>
                                <button onClick={() => tx.tx_id && handleCopy(tx.tx_id)} className="p-0.5 hover:text-snow/80 text-dusty/30 transition-colors" title="Copy tx">
                                  {copiedText === tx.tx_id ? <span className="text-green-400 text-[10px]">✓</span> : <Copy className="w-2.5 h-2.5" />}
                                </button>
                                <a href={`${CHAIN_CONFIG.solana.explorerTx}${tx.tx_id}`} target="_blank" rel="noopener noreferrer" className="p-0.5 hover:text-purple-400 text-dusty/30 transition-colors" title="View on Solscan">
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
