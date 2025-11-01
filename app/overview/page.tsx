"use client"

import { useState, useEffect } from "react"
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
  const [loading, setLoading] = useState(true)

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
          totalHolders: statsData.totalHolders || 0,
          totalSupply: runeData.totalSupply,
          marketCap: calculatedMarketCap,
          price: currentPrice,
          lastUpdated: statsData.lastUpdated || new Date().toISOString(),
          totalTransactions: statsData.totalUtxos || 0,
          activeAddresses: statsData.totalHolders || 0,
          networkHashRate: 450000000000000000
        })
        
        setRuneData(runeData)
        setKrakenChange(changePercent)
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

  if (loading) {
    return <LoadingScreen message="Loading DOG data..." />
  }

  return (
    <Layout currentPage="overview" setCurrentPage={() => {}}>
      <div className="min-h-screen pt-1 pb-2 md:py-2 space-y-3 md:space-y-3">
      {/* Hero Section */}
      <div className="text-center space-y-1 md:space-y-2 animate-fade-in px-4">
        <div className="space-y-2 md:space-y-1 max-w-full overflow-hidden">
          <h1 className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-display font-bold tracking-tight break-words">
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Total Holders */}
        <Card variant="glass" className="stagger-item">
          <CardHeader className="pb-3">
            <CardTitle variant="mono" className="text-sm text-gray-400">
              Total Holders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-white font-mono">
                {stats?.totalHolders?.toLocaleString() || '0'}
              </div>
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-orange-500" />
                <span className="text-sm text-gray-400 font-mono">Active Addresses</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Volume 24h */}
        <Card variant="glass" className="stagger-item">
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
        <Card variant="glass" className="stagger-item">
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

        {/* Total Supply */}
        <Card variant="glass" className="stagger-item">
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
        <Card variant="glass" className="stagger-item">
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
        <Card variant="glass" className="stagger-item">
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