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

type BehaviorList = 'all' | 'accumulators' | 'holders' | 'sellers';

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
  const [isUpdating, setIsUpdating] = useState(false)
  const [initialLoad, setInitialLoad] = useState(true)

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
      // Preservar posição de scroll
      const currentScrollPosition = window.scrollY
      setCurrentPage(page)
      setGoToPage('')
      // Restaurar posição após atualização
      setTimeout(() => {
        window.scrollTo(0, currentScrollPosition)
      }, 100)
    }
  }

  // Função para validar input (apenas números)
  const handleGoToPageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    // Permitir apenas números e campo vazio
    if (value === '' || /^\d+$/.test(value)) {
      setGoToPage(value)
    }
  }

  const getTotalCount = () => {
    if (currentList === 'all') {
      return Object.values(forensicStats?.by_pattern || {}).reduce((sum, val) => sum + val, 0)
    } else if (currentList === 'accumulators') {
      // Accumulators: Qualquer pessoa que comprou mais DOG (adicionou ao airdrop)
      return (forensicStats?.by_pattern.satoshi_visionary || 0) + 
             (forensicStats?.by_pattern.btc_maximalist || 0) + 
             (forensicStats?.by_pattern.rune_master || 0) + 
             (forensicStats?.by_pattern.ordinal_believer || 0) + 
             (forensicStats?.by_pattern.dog_legend || 0)
    } else if (currentList === 'holders') {
      // Holders: Mantiveram EXATAMENTE o airdrop (apenas 100%)
      return (forensicStats?.by_pattern.diamond_paws || 0)
    } else if (currentList === 'sellers') {
      // Sellers: Venderam qualquer quantidade (mesmo que parcial)
      return (forensicStats?.by_pattern.hodl_hero || 0) +
             (forensicStats?.by_pattern.steady_holder || 0) +
             (forensicStats?.by_pattern.profit_taker || 0) + 
             (forensicStats?.by_pattern.early_exit || 0) + 
             (forensicStats?.by_pattern.panic_seller || 0) + 
             (forensicStats?.by_pattern.paper_hands || 0)
    } else {
      return forensicStats?.by_pattern[currentList] || 0
    }
  }

  const behaviorLists = [
    { key: 'all', name: 'All Recipients', icon: Users, color: 'text-blue-400' },
    { key: 'accumulators', name: 'Accumulators', icon: TrendingUp, color: 'text-green-400' },
    { key: 'holders', name: 'Holders', icon: Trophy, color: 'text-purple-400' },
    { key: 'sellers', name: 'Sellers', icon: TrendingDown, color: 'text-red-400' }
  ]

  useEffect(() => {
    fetchData()
  }, [currentList, currentPage])

  const fetchData = async () => {
    try {
      // Só mostrar loading na primeira carga
      if (initialLoad) {
        setLoading(true)
      } else {
        // Para atualizações subsequentes, apenas indicar que está atualizando
        setIsUpdating(true)
      }
      
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
          // Accumulators: Qualquer pessoa que comprou mais DOG (adicionou ao airdrop)
          patterns = ['satoshi_visionary', 'btc_maximalist', 'rune_master', 'ordinal_believer', 'dog_legend']
        } else if (currentList === 'holders') {
          // Holders: Mantiveram EXATAMENTE o airdrop (apenas 100%)
          patterns = ['diamond_paws']
        } else if (currentList === 'sellers') {
          // Sellers: Venderam qualquer quantidade (mesmo que parcial)
          patterns = ['hodl_hero', 'steady_holder', 'profit_taker', 'early_exit', 'panic_seller', 'paper_hands']
        } else {
          patterns = [currentList]
        }
        
        // Para múltiplos padrões, vamos fazer múltiplas chamadas e combinar
        if (patterns.length > 1) {
          // Fazer múltiplas chamadas e combinar resultados
          const allProfiles = []
          for (const pattern of patterns) {
            const patternParams = new URLSearchParams({
              page: '1',
              limit: '1000', // Buscar todos para combinar
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
      if (initialLoad) {
        setLoading(false)
        setInitialLoad(false)
      }
      setIsUpdating(false)
    }
  }

  // Função para mudar de lista de forma suave
  const handleListChange = (newList: BehaviorList) => {
    setCurrentList(newList)
    setCurrentPage(1) // Reset para primeira página
  }

  // Função para mudar de página de forma suave
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
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
        <span className="text-green-400 font-mono">
          +{change.toFixed(0)}%
        </span>
      )
    } else if (change < 0) {
      return (
        <span className="text-red-400 font-mono">
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
        <h1 className="text-4xl font-bold text-white font-mono text-center">
          Airdrop Analysis
        </h1>
        <p className="text-gray-400 font-mono text-lg">
          Complete forensic analysis of DOG airdrop recipients
        </p>
      </div>

      {/* Main Stats - Row 1: Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card variant="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-orange-400">
              Total Recipients
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-mono">
              {formatNumber(forensicStats?.total_analyzed || 0)}
            </div>
            <p className="text-gray-400 text-sm font-mono mt-2">
              Airdrop recipients analyzed
            </p>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-cyan-400">
              Current Holders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-mono">
              {formatNumber(forensicStats?.still_holding || 0)}
            </div>
            <p className="text-gray-400 text-sm font-mono mt-2">
              Still holding original airdrop tokens
            </p>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-red-200">
              Full Exits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-mono">
              {formatNumber(forensicStats?.sold_everything || 0)}
            </div>
            <p className="text-gray-400 text-sm font-mono mt-2">
              Sold all airdrop tokens
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Stats - Row 2: Behavioral Categories */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card variant="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-green-400">
              Accumulators
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-mono">
              {formatNumber(
                (forensicStats?.by_pattern.satoshi_visionary || 0) + 
                (forensicStats?.by_pattern.btc_maximalist || 0) + 
                (forensicStats?.by_pattern.rune_master || 0) + 
                (forensicStats?.by_pattern.ordinal_believer || 0) + 
                (forensicStats?.by_pattern.dog_legend || 0)
              )}
            </div>
            <p className="text-gray-400 text-sm font-mono mt-2">
              Added any amount to airdrop
            </p>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-purple-400">
              Holders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-mono">
              {formatNumber(forensicStats?.by_pattern.diamond_paws || 0)}
            </div>
            <p className="text-gray-400 text-sm font-mono mt-2">
              Kept exact airdrop amount
            </p>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-red-400">
              Sellers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-mono">
              {formatNumber(
                (forensicStats?.by_pattern.hodl_hero || 0) +
                (forensicStats?.by_pattern.steady_holder || 0) +
                (forensicStats?.by_pattern.profit_taker || 0) + 
                (forensicStats?.by_pattern.early_exit || 0) + 
                (forensicStats?.by_pattern.panic_seller || 0) + 
                (forensicStats?.by_pattern.paper_hands || 0)
              )}
            </div>
            <p className="text-gray-400 text-sm font-mono mt-2">
              Sold any amount of airdrop
            </p>
          </CardContent>
        </Card>
      </div>

      <SectionDivider title="Recipient Search" icon={Search} />

      {/* Address Search */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="text-white text-xl">
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
              className="flex-1 bg-transparent border-gray-700/50 text-white"
            />
            <Button onClick={searchRecipient} className="btn-sharp">
              Search
            </Button>
          </div>
          
          {searchResult && (
            <div className="mt-4 p-4 bg-transparent border border-gray-700/50">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-400 text-sm">Address</p>
                  <code className="text-white text-xs">{searchResult.address}</code>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Airdrop Amount</p>
                  <p className="text-white font-mono">{formatDOG(searchResult.airdrop_amount)}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Current Balance</p>
                  <p className="text-white font-mono">{formatDOG(searchResult.current_balance)}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Change</p>
                  {getChangeIndicator(searchResult.percentage_change)}
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Behavior</p>
                  <span className="text-orange-400 text-sm font-mono">
                    {searchResult.behavior_category}
                  </span>
                </div>
              </div>
              {searchResult.insights.length > 0 && (
                <div className="mt-4">
                  <p className="text-gray-400 text-sm mb-2">Insights:</p>
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

      <SectionDivider title="Behavioral Profiles" icon={BarChart3} />

      {/* Behavior Lists */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="text-white text-xl">
            Behavioral Lists
          </CardTitle>
          <p className="text-gray-400 text-sm mt-2">
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
                // Accumulators: Qualquer pessoa que comprou mais DOG (adicionou ao airdrop)
                count = (forensicStats?.by_pattern.satoshi_visionary || 0) + 
                       (forensicStats?.by_pattern.btc_maximalist || 0) + 
                       (forensicStats?.by_pattern.rune_master || 0) + 
                       (forensicStats?.by_pattern.ordinal_believer || 0) + 
                       (forensicStats?.by_pattern.dog_legend || 0)
              } else if (list.key === 'holders') {
                // Holders: Mantiveram EXATAMENTE o airdrop (apenas 100%)
                count = (forensicStats?.by_pattern.diamond_paws || 0)
              } else if (list.key === 'sellers') {
                // Sellers: Venderam qualquer quantidade (mesmo que parcial)
                count = (forensicStats?.by_pattern.hodl_hero || 0) +
                       (forensicStats?.by_pattern.steady_holder || 0) +
                       (forensicStats?.by_pattern.profit_taker || 0) + 
                       (forensicStats?.by_pattern.early_exit || 0) + 
                       (forensicStats?.by_pattern.panic_seller || 0) + 
                       (forensicStats?.by_pattern.paper_hands || 0)
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
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' 
                      : 'text-gray-300 hover:text-white hover:bg-gray-800/30 border border-transparent hover:border-gray-700/30'
                  }`}
                  onClick={() => handleListChange(list.key as BehaviorList)}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-sm font-mono">{list.name}</span>
                    <span className="text-xs font-mono text-gray-400">
                      {formatNumber(count)}
                    </span>
                  </div>
                </Button>
              )
            })}
          </div>

          {/* Current List Info */}
          <div className="mb-4 p-4 bg-transparent border border-gray-700/50">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white font-mono text-lg">
                  {behaviorLists.find(l => l.key === currentList)?.name}
                </h3>
                <p className="text-gray-400 text-sm">
                  Showing {formatNumber(profiles.length)} of {formatNumber(getTotalCount())} recipients
                </p>
              </div>
              <div className="text-right">
                <p className="text-gray-400 text-sm">Page {currentPage} of {totalPages}</p>
                <p className="text-orange-400 text-sm font-mono">
                  {formatNumber((currentPage - 1) * ITEMS_PER_PAGE + 1)} - {formatNumber(Math.min(
                    currentPage * ITEMS_PER_PAGE, 
                    getTotalCount()
                  ))}
                </p>
              </div>
            </div>
          </div>

          {/* Profiles Table */}
          <div className="content-container">
            <div className={`overflow-x-auto transition-opacity duration-300 ${isUpdating ? 'opacity-90' : 'opacity-100'}`}>
              <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700/50">
                  <th className="text-left py-3 px-4 text-orange-400 font-mono text-sm">#</th>
                  <th className="text-left py-3 px-4 text-orange-400 font-mono text-sm">Address</th>
                  <th className="text-right py-3 px-4 text-orange-400 font-mono text-sm">Airdrop</th>
                  <th className="text-right py-3 px-4 text-orange-400 font-mono text-sm">Current</th>
                  <th className="text-center py-3 px-4 text-orange-400 font-mono text-sm">Change</th>
                  <th className="text-left py-3 px-4 text-orange-400 font-mono text-sm">Behavior</th>
                  <th className="text-center py-3 px-4 text-orange-400 font-mono text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile, index) => (
                  <tr 
                    key={profile.address} 
                    className="table-row"
                  >
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
                      <span className="text-gray-400 font-mono text-sm">
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
                      <span className="text-gray-300 text-xs font-mono">
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
          </div>

        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex flex-col items-center gap-4">
        <div className="text-dog-gray-300 font-mono text-sm">
          Showing {profiles.length} of {getTotalCount().toLocaleString('en-US')} {currentList}
        </div>
        
        <div className="flex items-center justify-center space-x-2">
          {/* Previous Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="btn-sharp"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          {/* Page Numbers */}
          {getPageNumbers().map((page, index) => (
            <div key={index}>
              {page === '...' ? (
                <span className="px-2 py-1 text-gray-400">
                  <MoreHorizontal className="w-4 h-4" />
                </span>
              ) : (
                <Button
                  variant={currentPage === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePageChange(page as number)}
                  className={`btn-sharp ${
                    currentPage === page 
                      ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' 
                      : 'hover:bg-gray-800/30'
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
            onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
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
              onChange={handleGoToPageChange}
              onKeyPress={(e) => e.key === 'Enter' && handleGoToPage()}
              className="w-16 h-8 text-center text-sm"
              placeholder="Page"
            />
            <span className="text-dog-gray-400 text-sm font-mono">Page</span>
          </div>
        </div>
      </div>
    </div>
  )
}