"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BitcoinNetworkData } from "@/types/bitcoin"
import { BitcoinApiService } from "@/lib/bitcoin-api"
import { 
  Shield, 
  Zap, 
  Activity, 
  Clock, 
  TrendingUp,
  TrendingDown,
  DollarSign,
  Hash
} from "lucide-react"

interface NetworkStatsCardsProps {
  data: BitcoinNetworkData
}

export function NetworkStatsCards({ data }: NetworkStatsCardsProps) {
  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Bitcoin Price */}
      <Card variant="glass" className="border-yellow-500/20 hover:border-yellow-500/40 transition-all">
        <CardHeader className="pb-2">
          <CardTitle className="text-yellow-400 text-lg flex items-center">
            <DollarSign className="w-5 h-5 mr-2" />
            Bitcoin Price
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold bg-gradient-to-r from-yellow-400 to-yellow-500 bg-clip-text text-transparent font-mono transition-all duration-500 ease-in-out">
            {BitcoinApiService.formatPrice(data.price.usd)}
          </div>
          <div className="flex items-center mt-1">
            {data.price.change24h >= 0 ? (
              <TrendingUp className="w-4 h-4 text-green-400 mr-1" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-400 mr-1" />
            )}
            <span className={`text-sm font-mono ${
              data.price.change24h >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {BitcoinApiService.formatPercentage(data.price.change24h)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Block Height */}
      <Card variant="glass" className="border-orange-500/20 hover:border-orange-500/40 transition-all">
        <CardHeader className="pb-2">
          <CardTitle className="text-orange-400 text-lg flex items-center">
            <Shield className="w-5 h-5 mr-2" />
            Block Height
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-orange-500 bg-clip-text text-transparent font-mono transition-all duration-500 ease-in-out">
            {BitcoinApiService.formatNumber(data.blockHeight)}
          </div>
          <p className="text-gray-400 text-sm font-mono mt-1">
            Current block
          </p>
        </CardContent>
      </Card>

      {/* Hash Rate */}
      <Card variant="glass" className="border-green-500/20 hover:border-green-500/40 transition-all">
        <CardHeader className="pb-2">
          <CardTitle className="text-green-400 text-lg flex items-center">
            <Zap className="w-5 h-5 mr-2" />
            Hash Rate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold bg-gradient-to-r from-green-400 to-green-500 bg-clip-text text-transparent font-mono transition-all duration-500 ease-in-out">
            {BitcoinApiService.formatHashRate(data.hashrate)}
          </div>
          <p className="text-gray-400 text-sm font-mono mt-1">
            Network power
          </p>
        </CardContent>
      </Card>

      {/* Mempool */}
      <Card variant="glass" className="border-blue-500/20 hover:border-blue-500/40 transition-all">
        <CardHeader className="pb-2">
          <CardTitle className="text-blue-400 text-lg flex items-center">
            <Activity className="w-5 h-5 mr-2" />
            Mempool
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-blue-500 bg-clip-text text-transparent font-mono transition-all duration-500 ease-in-out">
            {BitcoinApiService.formatNumber(data.mempoolSize)}
          </div>
          <p className="text-gray-400 text-sm font-mono mt-1">
            Pending transactions
          </p>
        </CardContent>
      </Card>

      {/* Difficulty */}
      <Card variant="glass" className="border-purple-500/20 hover:border-purple-500/40 transition-all">
        <CardHeader className="pb-2">
          <CardTitle className="text-purple-400 text-lg flex items-center">
            <Hash className="w-5 h-5 mr-2" />
            Difficulty
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-purple-500 bg-clip-text text-transparent font-mono">
            {BitcoinApiService.formatDifficulty(data.difficulty)}
          </div>
          <p className="text-gray-400 text-sm font-mono mt-1">
            Mining difficulty
          </p>
        </CardContent>
      </Card>

      {/* Avg Block Time */}
      <Card variant="glass" className="border-cyan-500/20 hover:border-cyan-500/40 transition-all">
        <CardHeader className="pb-2">
          <CardTitle className="text-cyan-400 text-lg flex items-center">
            <Clock className="w-5 h-5 mr-2" />
            Avg Block Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-cyan-500 bg-clip-text text-transparent font-mono">
            ~10m
          </div>
          <p className="text-gray-400 text-sm font-mono mt-1">
            Time between blocks
          </p>
        </CardContent>
      </Card>

      {/* Network Fee */}
      <Card variant="glass" className="border-red-500/20 hover:border-red-500/40 transition-all">
        <CardHeader className="pb-2">
          <CardTitle className="text-red-400 text-lg flex items-center">
            <Activity className="w-5 h-5 mr-2" />
            Network Fee
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold bg-gradient-to-r from-red-400 to-red-500 bg-clip-text text-transparent font-mono">
            {data.fees.fastest} sat/vB
          </div>
          <p className="text-gray-400 text-sm font-mono mt-1">
            Fastest fee
          </p>
        </CardContent>
      </Card>

      {/* Network Health */}
      <Card variant="glass" className="border-emerald-500/20 hover:border-emerald-500/40 transition-all">
        <CardHeader className="pb-2">
          <CardTitle className="text-emerald-400 text-lg flex items-center">
            <Shield className="w-5 h-5 mr-2" />
            Network Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold text-white font-mono">
              {data.networkHealth.status.toUpperCase()}
            </div>
            <Badge variant="success" className="status-live">
              {data.networkHealth.uptime}% Uptime
            </Badge>
          </div>
          <p className="text-gray-400 text-sm font-mono mt-1">
            {data.networkHealth.nodeCount.toLocaleString()} nodes
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
