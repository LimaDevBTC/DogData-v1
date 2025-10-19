"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { SectionDivider } from "@/components/ui/section-divider"
import { 
  Gift, 
  Users, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Activity,
  BarChart3,
  PieChart,
  Search,
  ChevronLeft,
  ChevronRight,
  Trophy,
  Award,
  AlertTriangle,
  Filter,
  Sparkles,
  Copy,
  ExternalLink,
  MoreHorizontal
} from "lucide-react"

interface AirdropSummary {
  total_recipients: number;
  still_holding: number;
  sold_everything: number;
  retention_rate: number;
  total_current_balance: number;
}

interface BehavioralProfile {
  address: string;
  airdrop_rank: number;
  airdrop_amount: number;
  current_balance: number;
  current_rank: number | null;
  absolute_change: number;
  percentage_change: number;
  retention_rate: number;
  rank_change: number | null;
  behavior_pattern: string;
  behavior_category: string;
  diamond_score: number;
  is_dumping: boolean;
  accumulation_rate: number;
  insights: string[];
}

interface ForensicStats {
  total_analyzed: number;
  still_holding: number;
  sold_everything: number;
  accumulated: number;
  dumping: number;
  diamond_hands: number;
  retention_rate: number;
  by_pattern: {
    [key: string]: number;
  };
}

type BehaviorList = 'all' | 'diamond_hands' | 'accumulators' | 'partial_sellers' | 'active_sellers' | 'paper_hands';

export default function AirdropPage() {
  const [summary, setSummary] = useState<AirdropSummary | null>(null)
  const [forensicStats, setForensicStats] = useState<ForensicStats | null>(null)
  const [currentList, setCurrentList] = useState<BehaviorList>('all')
  const [profiles, setProfiles] = useState<BehavioralProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [searchAddress, setSearchAddress] = useState("")
  const [goToPage, setGoToPage] = useState('')
  const [searchResult, setSearchResult] = useState<BehavioralProfile | null>(null)

  const ITEMS_PER_PAGE = 50

  // Função para gerar números das páginas
  const getPageNumbers = () => {
    const pages = []
    const total = totalPages
    
    if (total <= 7) {
      // Se tem 7 páginas ou menos, mostra todas
      for (let i = 1; i <= total; i++) {
        pages.push(i)
      }
    } else {
      // Sempre mostra a primeira página
      pages.push(1)
      
      if (currentPage <= 4) {
        // Páginas 1-5 + ... + última
        for (let i = 2; i <= 5; i++) {
          pages.push(i)
        }
        pages.push('...')
        pages.push(total)
      } else if (currentPage >= total - 3) {
        // Primeira + ... + últimas 5 páginas
        pages.push('...')
        for (let i = total - 4; i <= total; i++) {
          pages.push(i)
        }
      } else {
        // Primeira + ... + página atual + ... + última
        pages.push('...')
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i)
        }
        pages.push('...')
        pages.push(total)
      }
    }
    
    return pages
  }

  // Função para ir para uma página específica
  const handleGoToPage = () => {
    const page = parseInt(goToPage)
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
      setGoToPage('')
    }
  }

  const getTotalCount = () => {
    if (currentList === 'all') {
      return Object.values(forensicStats?.by_pattern || {}).reduce((sum, val) => sum + val, 0)
    } else if (currentList === 'accumulators') {
      return (forensicStats?.by_pattern.mega_whale || 0) + 
             (forensicStats?.by_pattern.whale || 0) + 
             (forensicStats?.by_pattern.mega_accumulator || 0) + 
             (forensicStats?.by_pattern.strong_accumulator || 0) + 
             (forensicStats?.by_pattern.accumulator || 0)
    } else if (currentList === 'partial_sellers') {
      // Venderam parte (50%-90% do airdrop)
      return (forensicStats?.by_pattern.strong_holder || 0) + 
             (forensicStats?.by_pattern.moderate_holder || 0) + 
             (forensicStats?.by_pattern.weak_holder || 0)
    } else if (currentList === 'active_sellers') {
      // Vendendo ativamente (10%-50% do airdrop)
      return (forensicStats?.by_pattern.heavy_seller || 0) + 
             (forensicStats?.by_pattern.dumper || 0) + 
             (forensicStats?.by_pattern.almost_sold || 0)
    } else {
      return forensicStats?.by_pattern[currentList] || 0
    }
  }

  const behaviorLists = [
    { key: 'all', name: 'All Recipients', icon: Users, color: 'text-blue-400' },
    { key: 'diamond_hands', name: 'Diamond Hands', icon: Trophy, color: 'text-purple-400' },
    { key: 'accumulators', name: 'Accumulators', icon: TrendingUp, color: 'text-green-400' },
    { key: 'partial_sellers', name: 'Partial Sellers', icon: TrendingDown, color: 'text-orange-400' },
        { key: 'active_sellers', name: 'Heavy Sellers', icon: AlertTriangle, color: 'text-red-400' },
    { key: 'paper_hands', name: 'Paper Hands', icon: TrendingDown, color: 'text-red-200' }
  ]

  useEffect(() => {
    fetchData()
  }, [currentList, currentPage])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch summary
      const summaryResponse = await fetch('http://localhost:3001/api/airdrop/summary')
      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json()
        setSummary(summaryData)
      }
      
      // Fetch forensic stats
      const forensicResponse = await fetch('http://localhost:3001/api/forensic/summary')
      if (forensicResponse.ok) {
        const forensicData = await forensicResponse.json()
        setForensicStats(forensicData.statistics)
      }
      
      // Fetch profiles based on current list
      let url = 'http://localhost:3001/api/forensic/profiles'
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: ITEMS_PER_PAGE.toString()
      })
      
      if (currentList !== 'all') {
        // Map consolidated categories to backend patterns
        let patterns = []
        if (currentList === 'accumulators') {
          patterns = ['mega_whale', 'whale', 'mega_accumulator', 'strong_accumulator', 'accumulator']
        } else if (currentList === 'partial_sellers') {
          patterns = ['strong_holder', 'moderate_holder', 'weak_holder']
        } else if (currentList === 'active_sellers') {
          patterns = ['heavy_seller', 'dumper', 'almost_sold']
        } else {
          patterns = [currentList]
        }
        
        // Para múltiplos padrões, vamos fazer múltiplas chamadas e combinar
        if (patterns.length > 1) {
          // Fazer múltiplas chamadas e combinar resultados
          const allProfiles = []
          for (const pattern of patterns) {
            const patternParams = new URLSearchParams({
              page: 1,
              limit: 1000, // Buscar todos para combinar
              pattern: pattern
            })
            const patternResponse = await fetch(`${url}?${patternParams}`)
            if (patternResponse.ok) {
              const patternData = await patternResponse.json()
              allProfiles.push(...patternData.profiles)
            }
          }
          
          // Ordenar por current_balance DESC
          allProfiles.sort((a, b) => b.current_balance - a.current_balance)
          
          // Paginar manualmente
          const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
          const endIndex = startIndex + ITEMS_PER_PAGE
          const paginatedProfiles = allProfiles.slice(startIndex, endIndex)
          
          setProfiles(paginatedProfiles)
          setTotalPages(Math.ceil(allProfiles.length / ITEMS_PER_PAGE))
          return
        } else if (patterns.length === 1) {
          params.append('pattern', patterns[0])
        }
      }
      
      const profilesResponse = await fetch(`${url}?${params}`)
      if (profilesResponse.ok) {
        const profilesData = await profilesResponse.json()
        
        // Ordenar por current_balance DESC para todos os casos
        const sortedProfiles = [...profilesData.profiles].sort((a, b) => b.current_balance - a.current_balance)
        
        setProfiles(sortedProfiles)
        const totalCount = getTotalCount()
        setTotalPages(Math.ceil(totalCount / ITEMS_PER_PAGE))
      }
      
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const searchRecipient = async () => {
    if (!searchAddress.trim()) return
    
    try {
      const response = await fetch(`http://localhost:3001/api/forensic/recipient/${searchAddress.trim()}`)
      if (response.ok) {
        const data = await response.json()
        setSearchResult(data.profile)
      } else {
        setSearchResult(null)
        alert('Recipient not found')
      }
    } catch (error) {
      console.error('Error searching recipient:', error)
    }
  }

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address)
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0
    }).format(num);
  };

  const formatDOG = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 2
    }).format(num) + ' DOG';
  };


  const getChangeIndicator = (change: number) => {
    if (change > 0) {
      return (
        <span className="text-green-400 flex items-center">
          <TrendingUp className="w-4 h-4 mr-1" />
          +{change.toFixed(0)}%
        </span>
      )
    } else if (change < 0) {
      return (
        <span className="text-red-400 flex items-center">
          <TrendingDown className="w-4 h-4 mr-1" />
          {change.toFixed(0)}%
        </span>
      )
    } else {
      return <span className="text-gray-400">0%</span>
    }
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
          <Gift className="w-10 h-10 mr-4 text-dog-orange" />
          Airdrop Analysis
        </h1>
        <p className="text-dog-gray-400 font-mono text-lg">
          Complete forensic analysis of DOG airdrop recipients
        </p>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 xl:grid-cols-7 gap-3">
        <Card variant="glass" className="glow-effect">
          <CardHeader className="pb-1">
            <CardTitle className="text-dog-orange text-sm flex items-center">
              <Users className="w-4 h-4 mr-1" />
              Total Recipients
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-1">
            <div className="text-2xl font-bold text-white font-mono">
              {formatNumber(forensicStats?.total_analyzed || 0)}
            </div>
            <p className="text-dog-gray-400 text-xs font-mono mt-1">
              Airdrop recipients
            </p>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader className="pb-1">
            <CardTitle className="text-purple-400 text-sm flex items-center">
              <Trophy className="w-4 h-4 mr-1" />
              Diamond Hands
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-1">
            <div className="text-2xl font-bold text-white font-mono">
              {formatNumber(forensicStats?.diamond_hands || 0)}
            </div>
            <p className="text-dog-gray-400 text-xs font-mono mt-1">
              Never moved (95%+)
            </p>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader className="pb-1">
            <CardTitle className="text-green-400 text-sm flex items-center">
              <TrendingUp className="w-4 h-4 mr-1" />
              Accumulators
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-1">
            <div className="text-2xl font-bold text-white font-mono">
              {formatNumber(
                (forensicStats?.by_pattern.mega_whale || 0) + 
                (forensicStats?.by_pattern.whale || 0) + 
                (forensicStats?.by_pattern.mega_accumulator || 0) + 
                (forensicStats?.by_pattern.strong_accumulator || 0) + 
                (forensicStats?.by_pattern.accumulator || 0)
              )}
            </div>
            <p className="text-dog-gray-400 text-xs font-mono mt-1">
              Bought more
            </p>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader className="pb-1">
            <CardTitle className="text-orange-400 text-sm flex items-center">
              <TrendingDown className="w-4 h-4 mr-1" />
              Partial Sellers
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-1">
            <div className="text-2xl font-bold text-white font-mono">
              {formatNumber(
                (forensicStats?.by_pattern.strong_holder || 0) + 
                (forensicStats?.by_pattern.moderate_holder || 0) + 
                (forensicStats?.by_pattern.weak_holder || 0)
              )}
            </div>
            <p className="text-dog-gray-400 text-xs font-mono mt-1">
              Sold 10%-50% of airdrop
            </p>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader className="pb-1">
            <CardTitle className="text-red-400 text-sm flex items-center">
              <AlertTriangle className="w-4 h-4 mr-1" />
              Heavy Sellers
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-1">
            <div className="text-2xl font-bold text-white font-mono">
              {formatNumber(
                (forensicStats?.by_pattern.heavy_seller || 0) + 
                (forensicStats?.by_pattern.dumper || 0) + 
                (forensicStats?.by_pattern.almost_sold || 0)
              )}
            </div>
            <p className="text-dog-gray-400 text-xs font-mono mt-1">
              Sold 50%-90% of airdrop
            </p>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader className="pb-1">
            <CardTitle className="text-cyan-400 text-sm flex items-center">
              <Users className="w-4 h-4 mr-1" />
              Current Holders
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-1">
            <div className="text-2xl font-bold text-white font-mono">
              {formatNumber(forensicStats?.still_holding || 0)}
            </div>
            <p className="text-dog-gray-400 text-xs font-mono mt-1">
              Still holding DOG
            </p>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader className="pb-1">
            <CardTitle className="text-red-200 text-sm flex items-center">
              <TrendingDown className="w-4 h-4 mr-1" />
              Paper Hands
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-1">
            <div className="text-2xl font-bold text-white font-mono">
              {formatNumber(forensicStats?.by_pattern.paper_hands || 0)}
            </div>
            <p className="text-dog-gray-400 text-xs font-mono mt-1">
              Sold everything
            </p>
          </CardContent>
        </Card>
      </div>

      <SectionDivider title="Recipient Search" icon={Search} />

      {/* Address Search */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="text-white text-xl flex items-center">
            <Search className="w-6 h-6 mr-3" />
            Search Recipient Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Enter Bitcoin address..."
              value={searchAddress}
              onChange={(e) => setSearchAddress(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchRecipient()}
              className="flex-1 bg-dog-gray-800 border-dog-gray-700 text-white"
            />
            <Button onClick={searchRecipient} className="btn-sharp">
              <Search className="w-4 h-4 mr-2" />
              Search
            </Button>
          </div>
          
          {searchResult && (
            <div className="mt-4 p-4 bg-dog-gray-800 border border-dog-gray-700 rounded">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-dog-gray-400 text-sm">Address</p>
                  <code className="text-white text-xs">{searchResult.address}</code>
                </div>
                <div>
                  <p className="text-dog-gray-400 text-sm">Airdrop Amount</p>
                  <p className="text-white font-mono">{formatDOG(searchResult.airdrop_amount)}</p>
                </div>
                <div>
                  <p className="text-dog-gray-400 text-sm">Current Balance</p>
                  <p className="text-white font-mono">{formatDOG(searchResult.current_balance)}</p>
                </div>
                <div>
                  <p className="text-dog-gray-400 text-sm">Change</p>
                  {getChangeIndicator(searchResult.percentage_change)}
                </div>
                <div>
                  <p className="text-dog-gray-400 text-sm">Behavior</p>
                  <Badge variant="outline" className="text-dog-orange border-dog-orange">
                    {searchResult.behavior_category}
                  </Badge>
                </div>
              </div>
              {searchResult.insights.length > 0 && (
                <div className="mt-4">
                  <p className="text-dog-gray-400 text-sm mb-2">Insights:</p>
                  <ul className="space-y-1">
                    {searchResult.insights.map((insight, idx) => (
                      <li key={idx} className="text-white text-sm font-mono">• {insight}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <SectionDivider title="Behavioral Profiles" icon={BarChart3} badge="FORENSIC" />

      {/* Behavior Lists */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="text-white text-xl flex items-center">
            <Filter className="w-6 h-6 mr-3" />
            Behavioral Lists
          </CardTitle>
          <p className="text-dog-gray-400 text-sm mt-2">
            Complete lists of recipients by behavioral pattern
          </p>
        </CardHeader>
        <CardContent>
          {/* List Selector */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 xl:grid-cols-6 gap-2 mb-6">
            {behaviorLists.map((list) => {
              const Icon = list.icon
              let count = 0
              
              if (list.key === 'all') {
                // All Recipients = soma de todos os padrões
                count = Object.values(forensicStats?.by_pattern || {}).reduce((sum, val) => sum + val, 0)
              } else if (list.key === 'accumulators') {
                // All Accumulators = mega_whale + whale + mega_accumulator + strong_accumulator + accumulator
                count = (forensicStats?.by_pattern.mega_whale || 0) + 
                       (forensicStats?.by_pattern.whale || 0) + 
                       (forensicStats?.by_pattern.mega_accumulator || 0) + 
                       (forensicStats?.by_pattern.strong_accumulator || 0) + 
                       (forensicStats?.by_pattern.accumulator || 0)
              } else if (list.key === 'partial_sellers') {
                // Partial Sellers = strong_holder + moderate_holder + weak_holder
                count = (forensicStats?.by_pattern.strong_holder || 0) + 
                       (forensicStats?.by_pattern.moderate_holder || 0) + 
                       (forensicStats?.by_pattern.weak_holder || 0)
              } else if (list.key === 'active_sellers') {
                // Active Sellers = heavy_seller + dumper + almost_sold
                count = (forensicStats?.by_pattern.heavy_seller || 0) + 
                       (forensicStats?.by_pattern.dumper || 0) + 
                       (forensicStats?.by_pattern.almost_sold || 0)
              } else {
                count = forensicStats?.by_pattern[list.key] || 0
              }
              
              const isActive = currentList === list.key
              
              return (
                <Button
                  key={list.key}
                  variant={isActive ? "default" : "outline"}
                  className={`flex items-center justify-between p-3 h-auto ${
                    isActive 
                      ? 'bg-dog-orange text-white' 
                      : 'bg-dog-gray-800 text-dog-gray-300 hover:bg-dog-gray-700'
                  }`}
                  onClick={() => {
                    setCurrentList(list.key as BehaviorList)
                    setCurrentPage(1)
                  }}
                >
                  <div className="flex items-center">
                    <Icon className={`w-4 h-4 mr-2 ${isActive ? 'text-white' : list.color}`} />
                    <span className="text-sm font-mono">{list.name}</span>
                  </div>
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {formatNumber(count)}
                  </Badge>
                </Button>
              )
            })}
          </div>

          {/* Current List Info */}
          <div className="mb-4 p-4 bg-dog-gray-800 rounded border border-dog-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white font-mono text-lg">
                  {behaviorLists.find(l => l.key === currentList)?.name}
                </h3>
                <p className="text-dog-gray-400 text-sm">
                  Showing {formatNumber(profiles.length)} of {formatNumber(getTotalCount())} recipients
                </p>
              </div>
              <div className="text-right">
                <p className="text-dog-gray-400 text-sm">Page {currentPage} of {totalPages}</p>
                <p className="text-dog-orange text-sm font-mono">
                  {formatNumber((currentPage - 1) * ITEMS_PER_PAGE + 1)} - {formatNumber(Math.min(
                    currentPage * ITEMS_PER_PAGE, 
                    getTotalCount()
                  ))}
                </p>
              </div>
            </div>
          </div>

          {/* Profiles Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dog-gray-700">
                  <th className="text-left py-3 px-4 text-dog-orange font-mono text-sm">#</th>
                  <th className="text-left py-3 px-4 text-dog-orange font-mono text-sm">Address</th>
                  <th className="text-right py-3 px-4 text-dog-orange font-mono text-sm">Airdrop</th>
                  <th className="text-right py-3 px-4 text-dog-orange font-mono text-sm">Current</th>
                  <th className="text-center py-3 px-4 text-dog-orange font-mono text-sm">Change</th>
                  <th className="text-left py-3 px-4 text-dog-orange font-mono text-sm">Behavior</th>
                  <th className="text-center py-3 px-4 text-dog-orange font-mono text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile, index) => (
                  <tr key={profile.address} className="table-row">
                    <td className="py-3 px-4">
                      <span className="text-white font-mono font-bold">
                        #{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <code className="address-text text-xs">
                          {profile.address}
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyAddress(profile.address)}
                          className="p-1 h-6 w-6"
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-dog-gray-400 font-mono text-sm">
                        {formatDOG(profile.airdrop_amount)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-white font-mono font-bold text-sm">
                        {formatDOG(profile.current_balance)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {getChangeIndicator(profile.percentage_change)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-dog-gray-300 text-xs font-mono">
                        {profile.behavior_category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => window.open(`https://mempool.space/address/${profile.address}`, '_blank')}
                        className="p-1 h-6 w-6"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-center mt-6 space-x-2">
            {/* Previous Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="btn-sharp"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            {/* Page Numbers */}
            {getPageNumbers().map((page, index) => (
              <div key={index}>
                {page === '...' ? (
                  <span className="px-2 py-1 text-dog-gray-400">
                    <MoreHorizontal className="w-4 h-4" />
                  </span>
                ) : (
                  <Button
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(page as number)}
                    className={`btn-sharp ${
                      currentPage === page 
                        ? 'bg-dog-orange text-white border-dog-orange' 
                        : 'hover:bg-dog-gray-700'
                    }`}
                  >
                    {page}
                  </Button>
                )}
              </div>
            ))}

            {/* Next Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="btn-sharp"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>

            {/* Go to Page */}
            <div className="flex items-center space-x-2 ml-4">
              <span className="text-dog-gray-400 text-sm font-mono">Go to</span>
              <Input
                type="number"
                min="1"
                max={totalPages}
                value={goToPage}
                onChange={(e) => setGoToPage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleGoToPage()}
                className="w-16 h-8 text-center text-sm"
                placeholder="Page"
              />
              <span className="text-dog-gray-400 text-sm font-mono">Page</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}