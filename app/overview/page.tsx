"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
  Network
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
        
        // Buscar percentual de mudança da Kraken
        const krakenResponse = await fetch('/api/price/kraken')
        const krakenData = await krakenResponse.json()
        
        // Calcular percentual de mudança da Kraken
        let changePercent = 0
        if (krakenData.result && krakenData.result.DOGUSD) {
          const currentPrice = parseFloat(krakenData.result.DOGUSD.c[0])
          const openPrice = parseFloat(krakenData.result.DOGUSD.o)
          changePercent = ((currentPrice - openPrice) / openPrice) * 100
        }
        
        setStats({
          totalHolders: statsData.totalHolders || 0,
          totalSupply: runeData.totalSupply,
          marketCap: (statsData.price || 0) * runeData.circulatingSupply,
          price: statsData.price || 0,
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
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <RefreshCw className="w-8 h-8 animate-spin text-orange-500 mx-auto" />
          <p className="text-gray-400 font-mono">Loading DOG data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-8 space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-6 animate-fade-in">
        <div className="space-y-4">
          <h1 className="text-6xl font-display font-bold tracking-tight">
            <span className="text-gray-400 font-mono tracking-wider">DOG•GO•TO•THE•MOON</span>
          </h1>
          <div className="flex items-center justify-center">
            <Badge variant="outline" className="border-orange-500/30 text-orange-400 font-mono">
              840000:3
            </Badge>
          </div>
        </div>
      </div>

      <SectionDivider title="Key Metrics" icon={BarChart3} />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
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
                <Activity className="w-4 h-4 text-red-500" />
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
  )
}