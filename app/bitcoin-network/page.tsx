"use client"

import { useState, useEffect } from "react"
import { PageHeader } from '@/components/ui/page-header'
import { Layout } from "@/components/layout"
import { LoadingScreen } from "@/components/loading-screen"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SectionDivider } from "@/components/ui/section-divider"
import { Network, RefreshCw } from "lucide-react"
import { BitcoinNetworkData } from "@/types/bitcoin"
import { BitcoinApiService } from "@/lib/bitcoin-api"
import { NetworkStatsCards } from "@/components/bitcoin/network-stats-cards"
import { BitcoinTradingViewChart } from "@/components/bitcoin/bitcoin-tradingview-chart"
import { HashrateChart } from "@/components/bitcoin/hashrate-chart"
import { MempoolChart } from "@/components/bitcoin/mempool-chart"

export default function BitcoinNetworkPage() {
  const [data, setData] = useState<BitcoinNetworkData | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async (isInitial = false) => {
      try {
        if (isInitial) {
          setLoading(true)
        } else {
          setUpdating(true)
        }
        setError(null)
        const networkData = await BitcoinApiService.getBitcoinNetworkData()
        setData(networkData)
      } catch (err) {
        console.error('Error fetching Bitcoin data:', err)
        setError('Failed to load Bitcoin network data')
      } finally {
        setLoading(false)
        setUpdating(false)
      }
    }

    // Initial load
    fetchData(true)
    
    // Update data every 30 seconds (without showing loading)
    const interval = setInterval(() => fetchData(false), 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return <LoadingScreen message="Loading Bitcoin network data..." />
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-400 font-mono mb-4">
            Error Loading Data
          </h2>
          <p className="text-dusty font-mono">
            {error || 'Unable to load Bitcoin network data'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <Layout currentPage="bitcoin-network" setCurrentPage={() => {}}>
      <div className="pt-2 pb-3 px-3 md:p-6 space-y-3 md:space-y-8">
        {/* ── O CABEÇALHO ────────────────────────────────────────────────
             Era título centralizado em mono laranja (sem font-display) com
             ícone em rounded-xl, e o estado "atualizando" aparecia DUAS vezes:
             uma bolinha ao lado do título e um "* Updating..." colado no fim do
             subtítulo, dentro da frase. Agora o estado é um dado com rótulo na
             régua de metadados, onde ele pode ser lido sem interromper a leitura. */}
        <PageHeader
          eyebrow="Bitcoin network · live"
          title="Bitcoin Network"
          sub="Block height, hashrate, difficulty and mempool pressure, read from our own node rather than a third-party API."
          icon={Network}
          meta={[{ rotulo: 'Node', valor: updating ? 'syncing' : 'in sync', vivo: true }]}
        />

      {/* Main Network Stats */}
      <NetworkStatsCards data={data} />

      <SectionDivider title="Bitcoin Price Chart" icon={Network} />

      {/* TradingView Chart */}
      <Card variant="glass" className="border-lava/[0.08]">
        <CardHeader>
          <CardTitle className="text-lava text-xl font-display flex items-center">
            <Network className="w-6 h-6 mr-3 text-lava" />
            Bitcoin Price Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div style={{ height: "600px" }}>
            <BitcoinTradingViewChart />
          </div>
        </CardContent>
      </Card>

      <SectionDivider title="Network Analytics" icon={Network} />

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-6">
        <HashrateChart data={data} />
        <MempoolChart data={data} />
      </div>

      <SectionDivider title="Recent Blocks" icon={Network} />

      {/* Recent Blocks */}
      <Card variant="glass" className="border-lava/[0.08]">
        <CardHeader>
          <CardTitle className="text-lava text-xl font-display">
            Recent Blocks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.recentBlocks.slice(0, 10).map((block, index) => (
              <div key={block.id} className="flex items-center justify-between p-4 border-b border-white/[0.05]">
                <div className="flex items-center space-x-4">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <div>
                    <div className="text-snow font-mono font-semibold">
                      Block #{block.height}
                    </div>
                    <div className="text-dusty font-mono text-sm">
                      {block.txCount} transactions • {BitcoinApiService.formatNumber(block.size)} bytes
                    </div>
                    {block.miner && (
                      <div className="text-dusty/50 font-mono text-xs">
                        Mined by {block.miner}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-snow font-mono">
                    {new Date(block.timestamp).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: true
                    })}
                  </div>
                  <div className="text-dusty font-mono text-sm">
                    {(block.reward / 100000000).toFixed(8)} BTC reward
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <SectionDivider title="Mining Pools" icon={Network} />

      {/* Mining Pools */}
      <Card variant="glass" className="border-lava/[0.08]">
        <CardHeader>
          <CardTitle className="text-lava text-xl font-display">
            Top Mining Pools (7 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.miningPools.slice(0, 10).map((pool, index) => (
              <div key={pool.poolId} className="flex items-center justify-between p-4 border-b border-white/[0.05]">
                <div className="flex items-center space-x-4">
                  <div className="w-8 h-8 bg-gradient-to-r from-lava to-lava-dark rounded-full flex items-center justify-center text-snow font-bold text-sm">
                    {index + 1}
                  </div>
                  <div>
                    <div className="text-snow font-mono font-semibold">{pool.name}</div>
                    <div className="text-dusty font-mono text-sm">{pool.blockCount} blocks</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-green-400 font-mono font-bold">
                    {pool.avgMatchRate}% Match Rate
                  </div>
                  <div className="text-dusty font-mono text-sm">
                    {pool.avgFeeDelta}% Fee Delta
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      </div>
    </Layout>
  )
}


