"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SectionDivider } from "@/components/ui/section-divider"
import { 
  Network, 
  Zap, 
  Shield, 
  Clock, 
  Activity,
  TrendingUp,
  Users,
  Coins
} from "lucide-react"

interface BitcoinStats {
  blockHeight: number;
  hashRate: number;
  difficulty: number;
  mempoolSize: number;
  avgBlockTime: number;
  totalTransactions: number;
  totalSupply: number;
  activeAddresses: number;
  networkFee: number;
}

export default function BitcoinNetworkPage() {
  const [stats, setStats] = useState<BitcoinStats | null>(null)
  const [loading, setLoading] = useState(true)

  // Mock data - will be replaced with real API calls
  useEffect(() => {
    const mockStats: BitcoinStats = {
      blockHeight: 916971,
      hashRate: 450000000000000000, // 450 EH/s
      difficulty: 75000000000000,
      mempoolSize: 125000,
      avgBlockTime: 9.8,
      totalTransactions: 1000000000,
      totalSupply: 21000000,
      activeAddresses: 1250000,
      networkFee: 0.000012
    }
    
    setStats(mockStats)
    setLoading(false)
  }, [])

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      notation: 'standard',
      maximumFractionDigits: 0
    }).format(num);
  };

  const formatHashRate = (hashRate: number) => {
    if (hashRate >= 1e18) return `${(hashRate / 1e18).toFixed(1)} EH/s`
    if (hashRate >= 1e15) return `${(hashRate / 1e15).toFixed(1)} PH/s`
    if (hashRate >= 1e12) return `${(hashRate / 1e12).toFixed(1)} TH/s`
    return `${formatNumber(hashRate)} H/s`
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="loading-dots mx-auto">
          <div></div>
          <div></div>
          <div></div>
          <div></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-white font-mono flex items-center justify-center">
          <Network className="w-10 h-10 mr-4 text-dog-orange" />
          Bitcoin Network
        </h1>
        <p className="text-dog-gray-400 font-mono text-lg">
          Real-time Bitcoin blockchain statistics and network health
        </p>
      </div>

      {/* Main Network Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card variant="glass" className="glow-effect border-orange-500/20 hover:border-orange-500/40 transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-dog-orange text-lg flex items-center">
              <Shield className="w-5 h-5 mr-2" />
              Block Height
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-orange-500 bg-clip-text text-transparent font-mono">
              {stats?.blockHeight.toLocaleString()}
            </div>
            <p className="text-dog-gray-400 text-sm font-mono mt-1">
              Current block
            </p>
          </CardContent>
        </Card>

        <Card variant="glass" className="border-green-500/20 hover:border-green-500/40 transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-dog-green text-lg flex items-center">
              <Zap className="w-5 h-5 mr-2" />
              Hash Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold bg-gradient-to-r from-green-400 to-green-500 bg-clip-text text-transparent font-mono">
              {formatHashRate(stats?.hashRate || 0)}
            </div>
            <p className="text-dog-gray-400 text-sm font-mono mt-1">
              Network power
            </p>
          </CardContent>
        </Card>

        <Card variant="glass" className="border-blue-500/20 hover:border-blue-500/40 transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-dog-blue text-lg flex items-center">
              <Activity className="w-5 h-5 mr-2" />
              Mempool
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-blue-500 bg-clip-text text-transparent font-mono">
              {formatNumber(stats?.mempoolSize || 0)}
            </div>
            <p className="text-dog-gray-400 text-sm font-mono mt-1">
              Pending transactions
            </p>
          </CardContent>
        </Card>

        <Card variant="glass" className="border-yellow-500/20 hover:border-yellow-500/40 transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-dog-yellow text-lg flex items-center">
              <Clock className="w-5 h-5 mr-2" />
              Avg Block Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold bg-gradient-to-r from-yellow-400 to-yellow-500 bg-clip-text text-transparent font-mono">
              {stats?.avgBlockTime?.toFixed(1)}m
            </div>
            <p className="text-dog-gray-400 text-sm font-mono mt-1">
              Time between blocks
            </p>
          </CardContent>
        </Card>
      </div>

      <SectionDivider title="Network Health" icon={Shield} />

      {/* Network Health */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card variant="glass" className="border-orange-500/20 hover:border-orange-500/40 transition-all">
          <CardHeader>
            <CardTitle className="text-orange-400 text-xl flex items-center">
              <TrendingUp className="w-6 h-6 mr-3 text-orange-500" />
              Network Difficulty
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-orange-500 bg-clip-text text-transparent font-mono">
                {formatNumber(stats?.difficulty || 0)}
              </div>
              <div className="w-full bg-dog-gray-700 rounded-full h-2">
                <div className="bg-gradient-to-r from-orange-500 to-orange-400 h-2 rounded-full shadow-lg shadow-orange-500/50" style={{ width: '85%' }}></div>
              </div>
              <p className="text-dog-gray-400 text-sm font-mono">
                Mining difficulty adjustment
              </p>
            </div>
          </CardContent>
        </Card>

        <Card variant="glass" className="border-green-500/20 hover:border-green-500/40 transition-all">
          <CardHeader>
            <CardTitle className="text-green-400 text-xl flex items-center">
              <Coins className="w-6 h-6 mr-3 text-green-500" />
              Supply Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-2xl font-bold bg-gradient-to-r from-green-400 to-green-500 bg-clip-text text-transparent font-mono">
                {formatNumber(stats?.totalSupply || 0)} / 21M BTC
              </div>
              <div className="w-full bg-dog-gray-700 rounded-full h-2">
                <div className="bg-gradient-to-r from-green-500 to-green-400 h-2 rounded-full shadow-lg shadow-green-500/50" style={{ width: '95%' }}></div>
              </div>
              <p className="text-dog-gray-400 text-sm font-mono">
                {((stats?.totalSupply || 0) / 21000000 * 100).toFixed(1)}% of total supply mined
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <SectionDivider title="Transaction Statistics" icon={Activity} />

      {/* Transaction Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card variant="glass" className="border-orange-500/20 hover:border-orange-500/40 transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-dog-orange text-lg flex items-center">
              <Activity className="w-5 h-5 mr-2" />
              Total Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-orange-500 bg-clip-text text-transparent font-mono">
              {formatNumber(stats?.totalTransactions || 0)}
            </div>
            <p className="text-dog-gray-400 text-sm font-mono mt-1">
              All time
            </p>
          </CardContent>
        </Card>

        <Card variant="glass" className="border-green-500/20 hover:border-green-500/40 transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-dog-green text-lg flex items-center">
              <Users className="w-5 h-5 mr-2" />
              Active Addresses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold bg-gradient-to-r from-green-400 to-green-500 bg-clip-text text-transparent font-mono">
              {formatNumber(stats?.activeAddresses || 0)}
            </div>
            <p className="text-dog-gray-400 text-sm font-mono mt-1">
              Last 24 hours
            </p>
          </CardContent>
        </Card>

        <Card variant="glass" className="border-blue-500/20 hover:border-blue-500/40 transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-dog-blue text-lg flex items-center">
              <Zap className="w-5 h-5 mr-2" />
              Avg Network Fee
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-blue-500 bg-clip-text text-transparent font-mono">
              {stats?.networkFee?.toFixed(6)} BTC
            </div>
            <p className="text-dog-gray-400 text-sm font-mono mt-1">
              Per transaction
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Network Status */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="text-white text-xl flex items-center">
            <Shield className="w-6 h-6 mr-3" />
            Network Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-dog-gray-300 font-mono">Network Health</span>
                <Badge variant="success" className="status-live">Excellent</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-dog-gray-300 font-mono">Sync Status</span>
                <Badge variant="success" className="status-live">Synced</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-dog-gray-300 font-mono">Mining Pools</span>
                <span className="text-white font-mono">15 Active</span>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-dog-gray-300 font-mono">Node Count</span>
                <span className="text-white font-mono">~15,000</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-dog-gray-300 font-mono">Propagation Time</span>
                <span className="text-white font-mono">~2.5s</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-dog-gray-300 font-mono">Uptime</span>
                <span className="text-white font-mono">99.98%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Blocks */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="text-white text-xl">
            Recent Blocks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-dog-gray-800/50 border border-dog-gray-700">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-dog-green rounded-full"></div>
                  <span className="text-white font-mono">Block #{stats?.blockHeight! - i}</span>
                </div>
                <div className="text-dog-gray-400 font-mono text-sm">
                  {Math.floor(Math.random() * 3000)} transactions
                </div>
                <div className="text-dog-gray-400 font-mono text-sm">
                  {Math.floor(Math.random() * 10)}m ago
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


