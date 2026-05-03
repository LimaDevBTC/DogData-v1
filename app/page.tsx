"use client"

import { useState, useEffect, useMemo } from "react"
import Image from "next/image"
import { Layout } from "@/components/layout"
import { LoadingScreen } from "@/components/loading-screen"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  TrendingUp,
  TrendingDown,
  Users,
  Coins,
  Activity,
  BarChart3,
  Flame,
  Percent,
  Globe
} from "lucide-react"
import { SectionDivider } from "@/components/ui/section-divider"
import { PriceCards } from "@/components/ui/price-cards"
import { TransactionHeatmap } from "@/components/ui/transaction-heatmap"
import { MultiChainStats } from "@/components/ui/multichain-stats"
import dogStatsFallback from '@/data/dog_stats_fallback.json'
import dynamic from 'next/dynamic'

const TradingViewWidget = dynamic(() => import('@/components/ui/trading-view-widget'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="text-dusty font-mono text-sm">Loading chart...</div>
    </div>
  )
})

const TradingViewMobileWidget = dynamic(() => import('@/components/ui/trading-view-mobile-widget'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="text-dusty font-mono text-sm">Loading chart...</div>
    </div>
  )
})

interface DogStats {
  totalHolders: number
  totalSupply: number
  marketCap: number
  price: number
  lastUpdated: string
  totalTransactions: number
  activeAddresses: number
  networkHashRate: number
}

interface Transactions24hMetrics {
  txCount: number
  totalDogMoved: number
  blockCount: number
  avgTxPerBlock: number
  avgDogPerTx: number
  topActiveWallet?: {
    address: string
    txCount: number
  } | null
  topVolumeWallet?: {
    address: string
    dogMoved: number
    direction: 'IN' | 'OUT'
  } | null
  topOutWallet?: {
    address: string
    dogMoved: number
  } | null
  topInWallet?: {
    address: string
    dogMoved: number
  } | null
  feesSats?: number
  feesBtc?: number
  activeWalletCount?: number
  volumeWalletCount?: number
  btcTxCount24h?: number | null
  dogDominance24h?: number | null
}

interface DogRuneData {
  name: string
  runeId: string
  totalSupply: number
  burned: number
  circulatingSupply: number
  burnedPercentage: number
  lastUpdated: string
  source: string
}

export default function OverviewPage() {
  const [stats, setStats] = useState<DogStats | null>(null)
  const [runeData, setRuneData] = useState<DogRuneData | null>(null)
  const [krakenChange, setKrakenChange] = useState<number>(0)
  const [volume24h, setVolume24h] = useState<number>(0)
  const [metrics24h, setMetrics24h] = useState<Transactions24hMetrics | null>(null)
  const [chainHolders, setChainHolders] = useState<{ solana: number; stacks: number }>({ solana: 0, stacks: 0 })
  const [loading, setLoading] = useState(true)

  const FALLBACK_TOTAL_HOLDERS = (dogStatsFallback as any)?.totalHolders ?? 0
  const FALLBACK_ACTIVE_ADDRESSES = (dogStatsFallback as any)?.activeAddresses ?? FALLBACK_TOTAL_HOLDERS

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsResponse, holdersResponse, runeResponse, marketsResponse] = await Promise.allSettled([
          fetch('/api/dog-rune/stats', { next: { revalidate: 300 } }),
          fetch('/api/dog-rune/holders?page=1&limit=1', { next: { revalidate: 300 } }),
          fetch('/api/dog-rune/data', { next: { revalidate: 300 } }),
          fetch('/api/markets', { next: { revalidate: 300 } })
        ])

        let statsData: any = {}
        if (statsResponse.status === 'fulfilled' && statsResponse.value.ok) {
          try { statsData = await statsResponse.value.json() } catch (e) { console.warn('Failed to parse stats:', e) }
        }

        let totalHoldersFromLocal: number | null = null
        if (holdersResponse.status === 'fulfilled' && holdersResponse.value.ok) {
          try {
            const holdersData = await holdersResponse.value.json()
            totalHoldersFromLocal = holdersData.pagination?.total || null
          } catch (e) { console.warn('Failed to parse holders:', e) }
        }

        let runeData: any = { totalSupply: 0, circulatingSupply: 0 }
        if (runeResponse.status === 'fulfilled' && runeResponse.value.ok) {
          try { runeData = await runeResponse.value.json() } catch (e) { console.warn('Failed to parse rune data:', e) }
        }

        if (marketsResponse.status === 'fulfilled' && marketsResponse.value.ok) {
          try {
            const contentType = marketsResponse.value.headers.get('content-type')
            if (contentType?.includes('application/json')) {
              const marketsData = await marketsResponse.value.json()
              setVolume24h(marketsData.marketData?.totalVolume || 0)
            }
          } catch (e) { console.warn('Failed to parse markets:', e) }
        }

        let currentPrice = 0
        let changePercent = 0
        let priceSource = 'unknown'

        const priceFetches = Promise.allSettled([
          fetch('/api/price/kraken', { signal: AbortSignal.timeout(3000) }).then(r => r.ok ? r.json() : null),
          fetch('/api/price/gateio', { signal: AbortSignal.timeout(3000) }).then(r => r.ok ? r.json() : null),
          fetch('/api/price/mexc', { signal: AbortSignal.timeout(3000) }).then(r => r.ok ? r.json() : null)
        ])

        try {
          const [krakenResult, gateResult, mexcResult] = await priceFetches

          if (krakenResult.status === 'fulfilled' && krakenResult.value?.result?.DOGUSD) {
            currentPrice = parseFloat(krakenResult.value.result.DOGUSD.c[0])
            const openPrice = parseFloat(krakenResult.value.result.DOGUSD.o)
            changePercent = ((currentPrice - openPrice) / openPrice) * 100
            priceSource = 'Kraken'
          } else if (gateResult.status === 'fulfilled' && gateResult.value?.price > 0) {
            currentPrice = gateResult.value.price
            changePercent = gateResult.value.change24h || 0
            priceSource = 'Gate.io'
          } else if (mexcResult.status === 'fulfilled' && mexcResult.value?.price > 0) {
            currentPrice = mexcResult.value.price
            changePercent = mexcResult.value.change24h || 0
            priceSource = 'MEXC'
          }
        } catch (error) {
          console.warn('Price APIs failed, trying CoinGecko...', error)
        }

        if (currentPrice === 0) {
          try {
            const cgResponse = await fetch('/api/markets', { signal: AbortSignal.timeout(3000) })
            if (cgResponse.ok) {
              const contentType = cgResponse.headers.get('content-type')
              if (contentType?.includes('application/json')) {
                const cgData = await cgResponse.json()
                if (cgData.marketData?.price && cgData.marketData.price > 0) {
                  currentPrice = cgData.marketData.price
                  changePercent = cgData.marketData.priceChange24h || 0
                  priceSource = 'CoinGecko'
                }
              }
            }
          } catch (error) {
            console.warn('CoinGecko API also failed', error)
          }
        }

        if (currentPrice === 0) {
          currentPrice = 0.00163
          priceSource = 'cached'
        }

        console.log(`Final price: $${currentPrice} from ${priceSource}`)

        const calculatedMarketCap = currentPrice * runeData.circulatingSupply

        let finalTotalHolders = FALLBACK_TOTAL_HOLDERS
        if (totalHoldersFromLocal !== null) {
          finalTotalHolders = totalHoldersFromLocal
        } else if (statsData.total_holders && statsData.total_holders > 0) {
          finalTotalHolders = statsData.total_holders
        }

        setStats({
          totalHolders: finalTotalHolders,
          totalSupply: runeData.totalSupply,
          marketCap: calculatedMarketCap,
          price: currentPrice,
          lastUpdated: statsData.last_updated || new Date().toISOString(),
          totalTransactions: statsData.total_utxos || 0,
          activeAddresses: finalTotalHolders,
          networkHashRate: 450000000000000000
        })

        setRuneData(runeData)
        setKrakenChange(changePercent)
        setLoading(false)

        fetch('/api/dog-rune/transactions-kv?summary=1', { next: { revalidate: 60 } })
          .then(txSummaryResponse => {
            if (txSummaryResponse.ok) return txSummaryResponse.json()
            return null
          })
          .then(async (summaryData) => {
            const metrics = summaryData?.metrics?.last24h || {}
            const dogTxCount = metrics.txCount || summaryData?.total_transactions || 0

            // Use backend btcTxCount if available, otherwise fetch from mempool.space
            let btcTxCount: number | null = metrics.btcTxCount24h ?? null
            let dominance: number | null = metrics.dogDominance24h ?? null

            if (btcTxCount == null) {
              try {
                const cutoff = Math.floor(Date.now() / 1000) - 86400
                let total = 0
                let startHeight: number | null = null
                for (let i = 0; i < 20; i++) {
                  const blocksUrl: string = startHeight != null
                    ? `https://mempool.space/api/v1/blocks/${startHeight}`
                    : 'https://mempool.space/api/v1/blocks'
                  const blocksResp: Response = await fetch(blocksUrl)
                  const blocksData: Array<{ timestamp: number; tx_count: number; height: number }> = await blocksResp.json()
                  if (!blocksData?.length) break
                  let done = false
                  for (const b of blocksData) {
                    if (b.timestamp < cutoff) { done = true; break }
                    total += b.tx_count
                  }
                  if (done) break
                  startHeight = blocksData[blocksData.length - 1].height - 1
                }
                if (total > 0) {
                  btcTxCount = total
                  dominance = dogTxCount > 0
                    ? Math.round((dogTxCount / total) * 1000000) / 10000
                    : 0
                }
              } catch (e) {
                console.warn('Failed to fetch BTC tx count from mempool.space:', e)
              }
            }

            setMetrics24h({
              txCount: dogTxCount,
              totalDogMoved: metrics.totalDogMoved || 0,
              blockCount: metrics.blockCount || 0,
              avgTxPerBlock: metrics.avgTxPerBlock || 0,
              avgDogPerTx: metrics.avgDogPerTx || 0,
              topActiveWallet: metrics.topActiveWallet || null,
              topVolumeWallet: metrics.topVolumeWallet || null,
              topOutWallet: metrics.topOutWallet || null,
              topInWallet: metrics.topInWallet || null,
              feesSats: metrics.feesSats ?? 0,
              feesBtc: metrics.feesBtc ?? 0,
              activeWalletCount: metrics.activeWalletCount || 0,
              volumeWalletCount: metrics.volumeWalletCount || 0,
              btcTxCount24h: btcTxCount,
              dogDominance24h: dominance,
            })
          })
          .catch(err => console.warn('Error fetching 24h transaction summary:', err))
      } catch (error) {
        console.error('Error fetching data:', error)
        setLoading(false)
      }
    }

    fetchData()

    // Fetch cross-chain holder counts
    fetch('/api/multichain/stats')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.chains) {
          const solana = data.chains.find((c: any) => c.chain === 'solana')
          const stacks = data.chains.find((c: any) => c.chain === 'stacks')
          setChainHolders({
            solana: solana?.holder_count ?? 0,
            stacks: stacks?.holder_count ?? 0,
          })
        }
      })
      .catch(err => console.warn('Error fetching multichain stats:', err))
  }, [])

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 2
    }).format(num)
  }

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 2
    }).format(num)
  }

  const formatMarketCap = (num: number) => {
    const millions = num / 1000000
    return `$${millions.toFixed(2)}M`
  }

  const formatBurnedTokens = (num: number) => {
    const millions = num / 1000000
    return `${millions.toFixed(3)}M`
  }

  const formatDOG = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 2
    }).format(num) + ' DOG'
  }

  const dogPrice = useMemo(() => {
    if (stats?.price && stats.price > 0) return stats.price
    const runePrice = runeData && typeof (runeData as any).price === 'number' ? (runeData as any).price : 0
    if (runePrice > 0) return runePrice
    return 0.00163
  }, [stats?.price, runeData])

  const C2_TREASURY_DOG = 988_703_937
  const C2_TREASURY_TARGET = 1_000_000_000
  const c2TreasuryUSD = dogPrice * C2_TREASURY_DOG
  const c2TreasuryUSDFormatted = dogPrice > 0 ? formatCurrency(c2TreasuryUSD) : '$0.00'
  const c2TreasuryProgress = Math.min(C2_TREASURY_DOG / C2_TREASURY_TARGET, 1)
  const cardBaseClass = "stagger-item md:min-h-[190px] min-h-0 h-full"

  if (loading) {
    return <LoadingScreen message="Loading DOG data..." />
  }

  return (
    <Layout currentPage="overview" setCurrentPage={() => {}}>
      {/* Aurora Background */}
      <div className="aurora-bg" />

      <div className="min-h-screen pt-1 pb-2 md:py-2 space-y-3 md:space-y-4 relative z-10">

        {/* === HERO SECTION === */}
        <div className="animate-fade-in px-4 mt-4 md:mt-10 mb-2 md:mb-4">
          <div className="relative flex flex-col items-center text-center hero-glow">
            {/* Rune ID Badge */}
            <Badge variant="outline" className="border-lava/20 text-lava/80 font-mono text-[10px] md:text-xs mb-3 md:mb-4 px-3 py-1 tracking-widest">
              RUNE 840000:3
            </Badge>

            {/* Title */}
            <h1 className="text-[clamp(1.1rem,5vw,1.5rem)] sm:text-3xl md:text-5xl lg:text-6xl font-display font-bold tracking-tight leading-none">
              <span className="gradient-text-hero">
                DOG&#x2022;GO&#x2022;TO&#x2022;THE&#x2022;MOON
              </span>
            </h1>

            {/* Price Ticker */}
            {stats?.price && stats.price > 0 && (
              <div className="mt-4 md:mt-6 flex items-center gap-3 md:gap-4">
                <span className="text-xl md:text-3xl font-mono font-bold text-snow/95 tracking-tight metric-value">
                  ${stats.price < 0.01 ? stats.price.toFixed(6) : stats.price < 1 ? stats.price.toFixed(4) : stats.price.toFixed(2)}
                </span>
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md font-mono text-xs md:text-sm font-semibold ${
                  krakenChange >= 0
                    ? 'bg-green-500/[0.08] text-green-400 border border-green-500/[0.12]'
                    : 'bg-red-500/[0.08] text-red-400 border border-red-500/[0.12]'
                }`}>
                  {krakenChange >= 0 ? (
                    <TrendingUp className="w-3 h-3 md:w-3.5 md:h-3.5" />
                  ) : (
                    <TrendingDown className="w-3 h-3 md:w-3.5 md:h-3.5" />
                  )}
                  {krakenChange >= 0 ? '+' : ''}{krakenChange.toFixed(2)}%
                </div>
              </div>
            )}
          </div>
        </div>

        <SectionDivider title="Key Metrics" icon={BarChart3} />

        {/* === STATS GRID === */}
        <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-4 gap-2 md:gap-3">

          {/* Total Holders */}
          <Card variant="glass" className={cardBaseClass}>
            <CardHeader className="pb-2">
              <CardTitle variant="mono" className="text-[11px] md:text-sm text-dusty flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-lava/60" />
                Total Holders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-lg md:text-3xl font-bold text-snow font-mono metric-value tracking-tight">
                  {stats ? (stats.totalHolders + chainHolders.solana + chainHolders.stacks).toLocaleString('en-US') : '—'}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] md:text-xs">
                    <div className="flex items-center gap-1">
                      <Image src="https://assets.coingecko.com/coins/images/1/small/bitcoin.png" alt="Bitcoin" width={14} height={14} className="opacity-70" />
                      <span className="text-dusty font-mono">BTC</span>
                    </div>
                    <span className="text-snow/60 font-mono tabular-nums">{stats ? stats.totalHolders.toLocaleString('en-US') : '—'}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] md:text-xs">
                    <div className="flex items-center gap-1">
                      <Image src="https://assets.coingecko.com/coins/images/4128/small/solana.png" alt="Solana" width={14} height={14} className="opacity-70" />
                      <span className="text-dusty font-mono">SOL</span>
                    </div>
                    <span className="text-snow/60 font-mono tabular-nums">{chainHolders.solana ? chainHolders.solana.toLocaleString('en-US') : '...'}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] md:text-xs">
                    <div className="flex items-center gap-1">
                      <Image src="/STX .png" alt="Stacks" width={14} height={14} className="opacity-70" />
                      <span className="text-dusty font-mono">STX</span>
                    </div>
                    <span className="text-snow/60 font-mono tabular-nums">{chainHolders.stacks ? chainHolders.stacks.toLocaleString('en-US') : '...'}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Volume 24h */}
          <Card variant="glass" className={cardBaseClass}>
            <CardHeader className="pb-2">
              <CardTitle variant="mono" className="text-[11px] md:text-sm text-dusty flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-green-400/60" />
                Volume 24h
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                <div className="text-lg md:text-3xl font-bold text-snow font-mono metric-value tracking-tight">
                  {formatCurrency(volume24h)}
                </div>
                <span className="text-[10px] md:text-xs text-dusty/50 font-mono">Trading Volume</span>
              </div>
            </CardContent>
          </Card>

          {/* Market Cap */}
          <Card variant="glass" className={cardBaseClass}>
            <CardHeader className="pb-2">
              <CardTitle variant="mono" className="text-[11px] md:text-sm text-dusty flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-lava/60" />
                Market Cap
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                <div className="text-lg md:text-3xl font-bold text-snow font-mono metric-value tracking-tight">
                  {runeData && stats?.price ? formatMarketCap(stats.price * runeData.circulatingSupply) : '$0.0M'}
                </div>
                <div className="flex items-center gap-1.5">
                  {krakenChange >= 0 ? (
                    <TrendingUp className="w-3 h-3 text-green-400" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-red-400" />
                  )}
                  <span className={`text-[11px] md:text-sm font-mono font-medium tabular-nums ${krakenChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {krakenChange >= 0 ? '+' : ''}{krakenChange.toFixed(2)}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* C2 Blockchain Treasury */}
          <a
            href="https://www.c2dog.com"
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 rounded-xl"
          >
            <Card
              variant="glass"
              className={`${cardBaseClass} border border-blue-500/[0.12] bg-gradient-to-br from-blue-950/30 via-blue-900/10 to-transparent hover:border-blue-400/20 transition-all duration-300`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 flex-nowrap">
                  <div className="relative w-5 h-5 md:w-6 md:h-6 flex-shrink-0">
                    <Image
                      src="/C2.png"
                      alt="C2 Blockchain logo"
                      fill
                      className="object-contain"
                      sizes="24px"
                    />
                  </div>
                  <CardTitle variant="mono" className="text-[10px] md:text-sm text-blue-200/60 uppercase tracking-wider whitespace-nowrap">
                    C2 $DOG Treasury
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-sm md:text-2xl font-bold font-mono text-transparent bg-clip-text bg-gradient-to-r from-blue-300 via-blue-200 to-blue-400 tracking-tight">
                    {C2_TREASURY_DOG.toLocaleString('en-US')} DOG
                  </div>
                  <div className="text-[10px] md:text-sm text-snow/50 font-mono tabular-nums">
                    ≈ {c2TreasuryUSDFormatted} USD
                  </div>
                  <div className="space-y-1">
                    <div className="h-1 md:h-1.5 w-full rounded-full bg-blue-900/30 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-400 via-blue-300 to-blue-500 transition-all duration-1000 ease-out"
                        style={{ width: `${(c2TreasuryProgress * 100).toFixed(0)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[9px] md:text-[10px] uppercase tracking-wider text-blue-200/40 font-mono">
                      <span>Progress</span>
                      <span className="tabular-nums">{(c2TreasuryProgress * 100).toFixed(1)}% of 1B</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </a>

          {/* BTC Dominance 24h */}
          <Card variant="glass" className={cardBaseClass}>
            <CardHeader className="pb-2">
              <CardTitle variant="mono" className="text-[11px] md:text-sm text-dusty flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-yellow-400/60" />
                <span className="hidden md:inline">BTC Chain Share</span>
                <span className="md:hidden">BTC Share</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                <div className="text-lg md:text-3xl font-bold text-snow font-mono metric-value tracking-tight">
                  {metrics24h?.dogDominance24h != null
                    ? `${metrics24h.dogDominance24h < 0.01 ? metrics24h.dogDominance24h.toFixed(4) : metrics24h.dogDominance24h.toFixed(2)}%`
                    : (loading ? '...' : 'N/A')}
                </div>
                <span className="text-[10px] md:text-xs text-dusty/50 font-mono">
                  {metrics24h?.txCount && metrics24h?.btcTxCount24h
                    ? `${metrics24h.txCount.toLocaleString()} of ${metrics24h.btcTxCount24h.toLocaleString()} BTC txns`
                    : 'of all Bitcoin txns 24h'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Total Supply */}
          <Card variant="glass" className={cardBaseClass}>
            <CardHeader className="pb-2">
              <CardTitle variant="mono" className="text-[11px] md:text-sm text-dusty flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-lava/60" />
                Total Supply
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                <div className="text-lg md:text-3xl font-bold text-snow font-mono metric-value tracking-tight">
                  {runeData ? (runeData.totalSupply / 1000000000).toFixed(0) + 'B' : '100B'}
                </div>
                <span className="text-[10px] md:text-xs text-dusty/50 font-mono">DOG Tokens</span>
              </div>
            </CardContent>
          </Card>

          {/* Burned */}
          <Card variant="glass" className={cardBaseClass}>
            <CardHeader className="pb-2">
              <CardTitle variant="mono" className="text-[11px] md:text-sm text-dusty flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-red-400/60" />
                Burned
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                <div className="text-lg md:text-3xl font-bold text-snow font-mono metric-value tracking-tight">
                  {runeData ? formatBurnedTokens(runeData.burned) : '23.487M'}
                </div>
                <span className="text-[10px] md:text-xs text-dusty/50 font-mono">
                  {runeData ? `${runeData.burnedPercentage?.toFixed(3) || '0.023'}%` : '0.023%'} of supply
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Circulating Supply */}
          <Card variant="glass" className={cardBaseClass}>
            <CardHeader className="pb-2">
              <CardTitle variant="mono" className="text-[11px] md:text-sm text-dusty flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-green-400/60" />
                Circulating
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                <div className="text-lg md:text-3xl font-bold text-snow font-mono metric-value tracking-tight">
                  {runeData ? (runeData.circulatingSupply / 1000000000).toFixed(5) + 'B' : '99.97650B'}
                </div>
                <span className="text-[10px] md:text-xs text-dusty/50 font-mono">DOG Tokens</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <SectionDivider title="Multi-Exchange Prices" icon={TrendingUp} />
        <PriceCards />

        <SectionDivider title="On-Chain Activity" icon={Activity} />
        <TransactionHeatmap />

        <SectionDivider title="Price Chart" icon={BarChart3} />

        {/* TradingView Chart — mobile vs desktop */}
        <Card variant="glass" className="overflow-hidden">
          <CardContent className="p-0">
            {/* Mobile: Symbol Overview (área limpa, sem toolbars) */}
            <div className="block md:hidden h-[300px]">
              <TradingViewMobileWidget />
            </div>
            {/* Desktop: gráfico avançado com candles e ferramentas */}
            <div className="hidden md:block h-[600px]">
              <TradingViewWidget />
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}
