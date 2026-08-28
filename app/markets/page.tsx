"use client"

import { useState, useEffect } from "react"
import { PageHeader } from '@/components/ui/page-header'
import { Layout } from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown, ExternalLink, RefreshCw, DollarSign, BarChart3, Activity } from "lucide-react"

interface MarketTicker {
  market: string
  pair: string
  price: number
  volumeUsd: number
  volume: number
  spread: number
  trustScore: string
  tradeUrl: string
}

interface MarketData {
  price: number
  totalVolume: number
  marketCap: number
  priceChange24h: number
}

interface MarketsResponse {
  tickers: MarketTicker[]
  marketData: MarketData
  cached?: boolean
  stale?: boolean
  cacheAge?: number
}

export default function MarketsPage() {
  const [data, setData] = useState<MarketsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'alpha' | 'volume' | 'spread' | 'price'>('volume')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const fetchMarkets = async () => {
    try {
      const response = await fetch('/api/markets')
      if (response.ok) {
        const contentType = response.headers.get('content-type')
        if (!contentType?.includes('application/json')) {
          console.error('❌ API returned non-JSON response:', contentType)
          return
        }
        
        const marketsData = await response.json()
        setData(marketsData)
        console.log('📊 Markets loaded:', {
          total: marketsData.tickers?.length || 0,
          hasBitflow: marketsData.tickers?.some((t: any) => t.market === 'Bitflow')
        })
      } else {
        console.error('❌ API response not OK:', response.status)
      }
    } catch (error) {
      console.error('❌ Error fetching markets:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMarkets()
    
    // Atualizar a cada 60 segundos
    const interval = setInterval(fetchMarkets, 60000)
    return () => clearInterval(interval)
  }, [])

  const formatNumber = (num: number | null | undefined) => {
    if (!num && num !== 0) return '$0.00'
    if (num >= 1000000) {
      return `$${(num / 1000000).toFixed(2)}M`
    }
    if (num >= 1000) {
      return `$${(num / 1000).toFixed(0)}K`
    }
    return `$${num.toFixed(2)}`
  }

  const formatPrice = (price: number | null | undefined) => {
    if (!price && price !== 0) return '$0.00000000'
    return `$${price.toFixed(8)}`
  }

  const formatVolume = (volume: number | null | undefined) => {
    if (!volume && volume !== 0) return '0'
    if (volume >= 1000000000) {
      return `${(volume / 1000000000).toFixed(2)}B`
    }
    if (volume >= 1000000) {
      return `${(volume / 1000000).toFixed(0)}M`
    }
    return `${volume.toFixed(0)}`
  }

  const getTrustScoreColor = (score: string) => {
    switch (score) {
      case 'green': return 'bg-green-400'
      case 'yellow': return 'bg-yellow-400'
      case 'red': return 'bg-red-400'
      default: return 'bg-gray-400'
    }
  }

  const sortedTickers = data?.tickers ? (() => {
    const bitflow = data.tickers.find(t => t.market === 'Bitflow')
    const others = data.tickers.filter(t => t.market !== 'Bitflow')

    const sortedOthers = [...others].sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'alpha':
          comparison = a.market.localeCompare(b.market)
          break
        case 'volume':
          comparison = (a.volumeUsd || 0) - (b.volumeUsd || 0)
          break
        case 'spread':
          // entradas sem spread (DEXs) vão para o final
          if (a.spread == null && b.spread == null) comparison = 0
          else if (a.spread == null) comparison = 1
          else if (b.spread == null) comparison = -1
          else comparison = a.spread - b.spread
          break
        case 'price':
          comparison = (a.price || 0) - (b.price || 0)
          break
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })

    // Bitflow SEMPRE no topo
    return bitflow ? [bitflow, ...sortedOthers] : sortedOthers
  })() : []

  return (
    <Layout currentPage="markets" setCurrentPage={() => {}}>
      <div className="min-h-screen pt-1 pb-2 md:py-2 space-y-3 md:space-y-4">
        
        <div className="px-4 md:px-0">
          <PageHeader
            eyebrow="Order books · live"
            title="Markets"
            sub="Where DOG trades right now, across every venue that lists it, with the spread and depth behind each price."
            icon={BarChart3}
          />
        </div>

        {/* Market Overview Cards */}
        {!loading && data && (
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
              {/* Price */}
              <Card variant="glass" className="border-lava/[0.08]">
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <DollarSign className="w-5 h-5 text-lava" />
                      <h3 className="text-sm text-dusty font-mono">Price</h3>
                    </div>
                  </div>
                  <div className="text-xl md:text-2xl font-bold text-snow font-mono metric-value tracking-tight">
                    {formatPrice(data.marketData.price)}
                  </div>
                  {data.marketData.priceChange24h != null && data.marketData.priceChange24h !== 0 && (
                    <div className={`flex items-center space-x-1 mt-2 ${data.marketData.priceChange24h > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {data.marketData.priceChange24h > 0 ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                      <span className="text-sm font-mono">{data.marketData.priceChange24h.toFixed(2)}%</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Market Cap */}
              <Card variant="glass" className="border-blue-500/20">
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Activity className="w-5 h-5 text-blue-400" />
                      <h3 className="text-sm text-dusty font-mono">Market Cap</h3>
                    </div>
                  </div>
                  <div className="text-xl md:text-2xl font-bold text-snow font-mono metric-value tracking-tight">
                    {formatNumber(data.marketData.marketCap)}
                  </div>
                </CardContent>
              </Card>

              {/* Volume 24h */}
              <Card variant="glass" className="border-green-500/20">
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <BarChart3 className="w-5 h-5 text-green-400" />
                      <h3 className="text-sm text-dusty font-mono">Volume 24h</h3>
                    </div>
                  </div>
                  <div className="text-xl md:text-2xl font-bold text-snow font-mono metric-value tracking-tight">
                    {formatNumber(data.marketData.totalVolume)}
                  </div>
                </CardContent>
              </Card>

              {/* Markets Count */}
              <Card variant="glass" className="border-purple-500/20">
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <RefreshCw className="w-5 h-5 text-purple-400" />
                      <h3 className="text-sm text-dusty font-mono">Markets</h3>
                    </div>
                  </div>
                  <div className="text-xl md:text-2xl font-bold text-snow font-mono metric-value tracking-tight">
                    {data.tickers?.length || 0}
                  </div>
                  <div className="text-xs text-dusty/70 mt-2 font-mono">
                    Active exchanges
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="text-center space-y-4">
                <RefreshCw className="w-12 h-12 text-lava animate-spin mx-auto" />
                <p className="text-dusty font-mono">Loading markets data...</p>
              </div>
            </div>
          )}

          {/* Markets Table */}
          {!loading && data && (
            <Card variant="glass">
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
                  <CardTitle className="text-white text-xl flex items-center">
                    Exchange Markets
                  </CardTitle>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-dusty font-mono">Sort by:</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="bg-[#0d0d0d] border border-white/[0.06] rounded-lg focus:border-lava/30 text-snow px-3 py-2 font-mono text-sm focus:outline-none focus:border-lava transition-colors appearance-none"
                    >
                      <option value="alpha">A → Z</option>
                      <option value="volume">Volume</option>
                      <option value="spread">Spread</option>
                      <option value="price">Price</option>
                    </select>
                    <button
                      onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                      className="px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg focus:border-lava/30 hover:border-lava transition-colors text-snow"
                    >
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Desktop Table - hidden on mobile */}
                <div className="hidden md:block">
                  <table className="w-full table-fixed">
                    <thead>
                      <tr className="border-b border-white/[0.05]">
                        <th className="text-left py-3 px-4 text-lava/70 font-mono text-xs tracking-wider uppercase">#</th>
                        <th className="text-left py-3 px-4 text-lava/70 font-mono text-xs tracking-wider uppercase">Exchange</th>
                        <th className="text-left py-3 px-4 text-lava/70 font-mono text-xs tracking-wider uppercase">Pair</th>
                        <th className="text-right py-3 px-4 text-lava/70 font-mono text-xs tracking-wider uppercase">Price</th>
                        <th className="text-right py-3 px-4 text-lava/70 font-mono text-xs tracking-wider uppercase">Volume 24h</th>
                        <th className="text-right py-3 px-4 text-lava/70 font-mono text-xs tracking-wider uppercase">Spread</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedTickers.map((ticker, index) => (
                        <tr key={index} className="table-row">
                          <td className="py-3 px-4 text-snow/70 font-mono text-sm">
                            {index + 1}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getTrustScoreColor(ticker.trustScore)}`}></div>
                              {ticker.market === 'Bitflow' ? (
                                <a
                                  href="https://btflw.link/brl"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-lava hover:text-lava-light font-mono font-medium transition-colors underline decoration-lava/30 hover:decoration-lava"
                                >
                                  {ticker.market}
                                </a>
                              ) : (
                                <span className="text-snow font-mono font-medium">{ticker.market}</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-snow/80 font-mono text-sm truncate" title={ticker.pair}>
                            {ticker.pair}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="amount-text text-sm">
                              {formatPrice(ticker.price)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex flex-col items-end">
                              <span className="amount-text text-sm">
                                {formatNumber(ticker.volumeUsd)}
                              </span>
                              <span className="text-dusty/70 font-mono text-xs">
                                {formatVolume(ticker.volume)} DOG
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className={`font-mono text-sm ${ticker.spread == null ? 'text-dusty/50' : ticker.spread < 0.3 ? 'text-green-400' : ticker.spread < 0.6 ? 'text-yellow-400' : 'text-red-400'}`}>
                              {ticker.spread != null ? ticker.spread.toFixed(2) + '%' : '—'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards - shown on mobile, hidden on desktop */}
                <div className="md:hidden space-y-3">
                  {sortedTickers.map((ticker, index) => (
                    <Card key={index} variant="glass" className="border-white/[0.05]">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className={`w-2 h-2 rounded-full ${getTrustScoreColor(ticker.trustScore)}`}></div>
                            {ticker.market === 'Bitflow' ? (
                              <a
                                href="https://btflw.link/brl"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-lava hover:text-lava-light font-mono font-medium transition-colors underline decoration-lava/30"
                              >
                                {ticker.market}
                              </a>
                            ) : (
                              <span className="text-snow font-mono font-medium">{ticker.market}</span>
                            )}
                          </div>
                          <span className="text-dusty font-mono text-sm">{ticker.pair}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="text-xs text-dusty/70 font-mono mb-1">Price</div>
                            <div className="text-snow font-mono text-sm">{formatPrice(ticker.price)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-dusty/70 font-mono mb-1">Volume 24h</div>
                            <div className="text-snow font-mono text-sm">{formatNumber(ticker.volumeUsd)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-dusty/70 font-mono mb-1">Spread</div>
                            <div className={`font-mono text-sm ${ticker.spread == null ? 'text-dusty/50' : ticker.spread < 0.3 ? 'text-green-400' : ticker.spread < 0.6 ? 'text-yellow-400' : 'text-red-400'}`}>
                              {ticker.spread != null ? ticker.spread.toFixed(2) + '%' : '—'}
                            </div>
                          </div>
                          <div className="flex items-end">
                            <a
                              href={ticker.tradeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center space-x-1 px-3 py-1.5 bg-lava/20 hover:bg-lava/30 text-lava font-mono text-xs transition-colors w-full justify-center"
                            >
                              <span>Trade</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cache Info */}
          {data?.stale && (
            <div className="text-center">
              <p className="text-xs text-dusty/70 font-mono">
                ⚠️ Using cached data ({data.cacheAge}s old) - API temporarily unavailable
              </p>
            </div>
          )}
      </div>
    </Layout>
  )
}

