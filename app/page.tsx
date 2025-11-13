"use client"

import { useState, useEffect, useMemo } from "react"
import Image from "next/image"
import { Layout } from "@/components/layout"
import { LoadingScreen } from "@/components/loading-screen"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  TrendingUp, 
  TrendingDown,
  Users, 
  Coins, 
  Activity,
  Clock,
  Zap,
  Shield,
  ArrowUpRight,
  RefreshCw,
  BarChart3,
  Network,
  Heart,
  Flame
} from "lucide-react"
import { SectionDivider } from "@/components/ui/section-divider"
import { TrendIndicator } from "@/components/ui/trend-indicator"
import { PriceCards } from "@/components/ui/price-cards"
import dogStatsFallback from '@/data/dog_stats_fallback.json'
import dynamic from 'next/dynamic'

const TradingViewWidget = dynamic(() => import('@/components/ui/trading-view-widget'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="text-gray-400 font-mono">Loading chart...</div>
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
  const [loading, setLoading] = useState(true)

  const FALLBACK_TOTAL_HOLDERS = (dogStatsFallback as any)?.totalHolders ?? 0
  const FALLBACK_ACTIVE_ADDRESSES = (dogStatsFallback as any)?.activeAddresses ?? FALLBACK_TOTAL_HOLDERS

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Buscar stats básicos
        const statsResponse = await fetch('/api/dog-rune/stats')
        const statsData = await statsResponse.json()
        
        // Buscar dados precisos da rune
        const runeResponse = await fetch('/api/dog-rune/data')
        const runeData = await runeResponse.json()
        
        // Buscar preço com fallback em cascata: Kraken -> Gate.io -> MEXC -> CoinGecko
        let currentPrice = 0
        let changePercent = 0
        let priceSource = 'unknown'
        
        // 1ª tentativa: Kraken
        try {
          const krakenResponse = await fetch('/api/price/kraken', { signal: AbortSignal.timeout(5000) })
          
          if (krakenResponse.ok) {
            const krakenData = await krakenResponse.json()
            
            if (krakenData.result && krakenData.result.DOGUSD) {
              currentPrice = parseFloat(krakenData.result.DOGUSD.c[0])
              const openPrice = parseFloat(krakenData.result.DOGUSD.o)
              changePercent = ((currentPrice - openPrice) / openPrice) * 100
              priceSource = 'Kraken'
              console.log('✅ Price from Kraken:', currentPrice)
            }
          }
        } catch (error) {
          console.warn('⚠️ Kraken API failed, trying Gate.io...', error)
        }
        
        // 2ª tentativa: Gate.io (se Kraken falhou)
        if (currentPrice === 0) {
          try {
            const gateResponse = await fetch('/api/price/gateio', { signal: AbortSignal.timeout(5000) })
            
            if (gateResponse.ok) {
              const gateData = await gateResponse.json()
              
              if (gateData.price && gateData.price > 0) {
                currentPrice = gateData.price
                changePercent = gateData.change24h || 0
                priceSource = 'Gate.io'
                console.log('✅ Price from Gate.io (fallback):', currentPrice)
              }
            }
          } catch (error) {
            console.warn('⚠️ Gate.io API failed, trying MEXC...', error)
          }
        }
        
        // 3ª tentativa: MEXC (se Gate.io também falhou)
        if (currentPrice === 0) {
          try {
            const mexcResponse = await fetch('/api/price/mexc', { signal: AbortSignal.timeout(5000) })
            
            if (mexcResponse.ok) {
              const mexcData = await mexcResponse.json()
              
              if (mexcData.price && mexcData.price > 0) {
                currentPrice = mexcData.price
                changePercent = mexcData.change24h || 0
                priceSource = 'MEXC'
                console.log('✅ Price from MEXC (fallback):', currentPrice)
              }
            }
          } catch (error) {
            console.warn('⚠️ MEXC API failed, trying CoinGecko...', error)
          }
        }
        
        // 4ª tentativa: CoinGecko (último recurso)
        if (currentPrice === 0) {
          try {
            const cgResponse = await fetch('/api/markets', { signal: AbortSignal.timeout(5000) })
            
            if (cgResponse.ok) {
              const contentType = cgResponse.headers.get('content-type')
              if (contentType?.includes('application/json')) {
                const cgData = await cgResponse.json()
                
                if (cgData.marketData?.price && cgData.marketData.price > 0) {
                  currentPrice = cgData.marketData.price
                  changePercent = cgData.marketData.priceChange24h || 0
                  priceSource = 'CoinGecko'
                  console.log('✅ Price from CoinGecko (fallback):', currentPrice)
                }
              }
            }
          } catch (error) {
            console.warn('⚠️ CoinGecko API failed', error)
          }
        }
        
        // Fallback final: usar preço default se tudo falhar
        if (currentPrice === 0) {
          currentPrice = 0.00163 // Preço default razoável
          priceSource = 'cached'
          console.warn('⚠️ All APIs failed, using default price')
        }
        
        console.log(`📊 Final price: $${currentPrice} from ${priceSource}`)
        
        // Buscar volume 24h dos markets
        try {
          const marketsResponse = await fetch('/api/markets')
          if (marketsResponse.ok) {
            const contentType = marketsResponse.headers.get('content-type')
            if (contentType?.includes('application/json')) {
              const marketsData = await marketsResponse.json()
              setVolume24h(marketsData.marketData?.totalVolume || 0)
            }
          }
        } catch (error) {
          console.warn('⚠️ Failed to fetch volume 24h:', error)
          setVolume24h(0)
        }
        
        // Calcular Market Cap (preço × circulating supply)
        const calculatedMarketCap = currentPrice * runeData.circulatingSupply
        
        setStats({
          totalHolders: statsData.totalHolders || FALLBACK_TOTAL_HOLDERS,
          totalSupply: runeData.totalSupply,
          marketCap: calculatedMarketCap,
          price: currentPrice,
          lastUpdated: statsData.lastUpdated || new Date().toISOString(),
          totalTransactions: statsData.totalUtxos || 0,
          activeAddresses: statsData.totalHolders || FALLBACK_ACTIVE_ADDRESSES,
          networkHashRate: 450000000000000000
        })
        
        setRuneData(runeData)
        setKrakenChange(changePercent)

        try {
          const txSummaryResponse = await fetch('/api/dog-rune/transactions-kv?summary=1', { cache: 'no-store' })
          if (txSummaryResponse.ok) {
            const summaryData = await txSummaryResponse.json()
            const metrics = summaryData?.metrics?.last24h
            if (metrics) {
              setMetrics24h({
                txCount: metrics.txCount || 0,
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
              })
            }
          } else {
            console.warn('⚠️ Falha ao carregar resumo de transações 24h')
          }
        } catch (err) {
          console.warn('⚠️ Erro ao buscar resumo de transações 24h:', err)
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
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
    // Formatar em milhões com 2 casas decimais (ex: 162.00M)
    const millions = num / 1000000
    return `$${millions.toFixed(2)}M`
  }

  const formatBurnedTokens = (num: number) => {
    // Formatar tokens queimados em milhões (ex: 23.350M)
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

  const C2_TREASURY_DOG = 549_784_364
  const C2_TREASURY_TARGET = 1_000_000_000
  const c2TreasuryUSD = dogPrice * C2_TREASURY_DOG
  const c2TreasuryUSDFormatted = dogPrice > 0 ? formatCurrency(c2TreasuryUSD) : '$0.00'
  const c2TreasuryProgress = Math.min(C2_TREASURY_DOG / C2_TREASURY_TARGET, 1)
  const cardBaseClass = "stagger-item min-h-[190px] h-full"

  if (loading) {
    return <LoadingScreen message="Loading DOG data..." />
  }

  return (
    <Layout currentPage="overview" setCurrentPage={() => {}}>
      <div className="min-h-screen pt-1 pb-2 md:py-2 space-y-3 md:space-y-3">
      {/* Hero Section */}
      <div className="text-center space-y-1 md:space-y-2 animate-fade-in px-4 mt-8 md:mt-10">
        <div className="space-y-3 md:space-y-4 max-w-full overflow-hidden">
          <h1 className="text-2xl sm:text-3xl md:text-6xl lg:text-7xl font-display font-bold tracking-tight break-words">
            <span className="text-gray-400 font-mono tracking-wider block">
              <span className="inline-block">DOG•GO•TO</span>
              <span className="inline-block ml-2">•THE•MOON</span>
            </span>
          </h1>
          <div className="flex items-center justify-center">
            <Badge variant="outline" className="border-orange-500/30 text-orange-400 font-mono text-xs md:text-sm">
              840000:3
            </Badge>
          </div>
        </div>
      </div>

      <SectionDivider title="Key Metrics" icon={BarChart3} />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {/* Total Holders */}
        <Card variant="glass" className={cardBaseClass}>
          <CardHeader className="pb-3">
            <CardTitle variant="mono" className="text-sm text-gray-400">
              Total Holders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-white font-mono">
                {(
                  stats?.totalHolders && stats.totalHolders > 0
                    ? stats.totalHolders
                    : FALLBACK_TOTAL_HOLDERS
                ).toLocaleString('en-US')}
              </div>
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-orange-500" />
                <span className="text-sm text-gray-400 font-mono">Active Addresses</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Volume 24h */}
        <Card variant="glass" className={cardBaseClass}>
          <CardHeader className="pb-3">
            <CardTitle variant="mono" className="text-sm text-gray-400">
              Volume 24h
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-white font-mono">
                {formatCurrency(volume24h)}
              </div>
              <div className="flex items-center space-x-2">
                <Activity className="w-4 h-4 text-green-500" />
                <span className="text-sm text-gray-400 font-mono">Trading Volume</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Market Cap */}
        <Card variant="glass" className={cardBaseClass}>
          <CardHeader className="pb-3">
            <CardTitle variant="mono" className="text-sm text-gray-400">
              Market Cap
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-white font-mono">
                {runeData && stats?.price ? formatMarketCap(stats.price * runeData.circulatingSupply) : '$0.0M'}
              </div>
              <div className="flex items-center space-x-2">
                {krakenChange >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-green-400" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-400" />
                )}
                <span className={`text-sm font-mono ${krakenChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
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
          className="block h-full focus:outline-none focus-visible:ring-2 focus-visible-ring-blue-400/60 rounded-xl mb-6 xl:mb-0"
        >
          <Card
            variant="glass"
            className={`${cardBaseClass} border border-blue-500/20 bg-gradient-to-br from-blue-950/60 via-blue-900/30 to-transparent hover:border-blue-400/40 transition-all duration-300`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-nowrap">
                  <div className="relative w-6 h-6">
                    <Image
                      src="/C2.png"
                      alt="C2 Blockchain logo"
                      fill
                      className="object-contain"
                      sizes="24px"
                    />
                  </div>
                  <CardTitle variant="mono" className="text-sm text-blue-200/80 uppercase tracking-wide whitespace-nowrap">
                    C2 Blockchain $DOG Treasury
                  </CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="text-2xl font-bold font-mono text-transparent bg-clip-text bg-gradient-to-r from-blue-300 via-blue-200 to-blue-400">
                  {C2_TREASURY_DOG.toLocaleString('en-US')} DOG
                </div>
                <div className="text-sm text-gray-300 font-mono">
                  ≈ {c2TreasuryUSDFormatted} USD
                </div>
                <div className="space-y-1">
                  <div className="h-1.5 w-full rounded-full bg-blue-900/60 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-400 via-blue-300 to-blue-500"
                      style={{ width: `${(c2TreasuryProgress * 100).toFixed(0)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-blue-200/70 font-mono">
                    <span>Treasury Progress</span>
                    <span>{(c2TreasuryProgress * 100).toFixed(1)}% of 1B Target</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </a>

        {/* Total On-Chain Transactions 24h */}
         <Card variant="glass" className={cardBaseClass}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle variant="mono" className="text-sm text-gray-300 flex items-center gap-2">
                <Activity className="w-4 h-4 text-green-400" />
                Total On-Chain Transactions 24h
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-white font-mono">
                {metrics24h
                  ? metrics24h.txCount.toLocaleString()
                  : (loading ? 'Loading...' : 'N/A')}
              </div>
              <p className="text-xs md:text-sm text-gray-400 font-mono uppercase tracking-wide">
                Past 24 hours
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Total Supply */}
        <Card variant="glass" className={cardBaseClass}>
          <CardHeader className="pb-3">
            <CardTitle variant="mono" className="text-sm text-gray-400">
              Total Supply
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-white font-mono">
                {runeData ? (runeData.totalSupply / 1000000000).toFixed(0) + 'B' : '100B'}
              </div>
              <div className="flex items-center space-x-2">
                <Coins className="w-4 h-4 text-orange-500" />
                <span className="text-sm text-gray-400 font-mono">DOG Tokens</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Burned */}
        <Card variant="glass" className={cardBaseClass}>
          <CardHeader className="pb-3">
            <CardTitle variant="mono" className="text-sm text-gray-400">
              Burned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-white font-mono">
                {runeData ? formatBurnedTokens(runeData.burned) : '23.487M'}
              </div>
              <div className="flex items-center space-x-2">
                <Flame className="w-4 h-4 text-orange-500" />
                <span className="text-sm text-gray-400 font-mono">DOG Tokens</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Circulating Supply */}
        <Card variant="glass" className={cardBaseClass}>
          <CardHeader className="pb-3">
            <CardTitle variant="mono" className="text-sm text-gray-400">
              Circulating Supply
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-white font-mono">
                {runeData ? (runeData.circulatingSupply / 1000000000).toFixed(5) + 'B' : '99.97650B'}
              </div>
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span className="text-sm text-gray-400 font-mono">DOG Tokens</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <SectionDivider title="Multi-Exchange Prices" icon={TrendingUp} />
      <PriceCards />
      
      <SectionDivider title="Price Chart" icon={BarChart3} />

      {/* TradingView Chart */}
      <Card variant="glass">
        <CardContent className="p-0">
          <div style={{ height: "600px" }}>
            <TradingViewWidget />
          </div>
        </CardContent>
      </Card>
    </div>
    </Layout>
  )
}