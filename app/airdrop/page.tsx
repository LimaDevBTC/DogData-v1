"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Layout } from "@/components/layout"
import { LoadingScreen } from "@/components/loading-screen"
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
import { AddressBadge } from "@/components/address-badge"

interface AirdropSummary {
  total_recipients: number;
  still_holding: number;
  sold_everything: number;
  retention_rate: number;
  total_current_balance: number;
  recipients_with_multiple: number;
}

interface BehavioralProfile {
  address: string;
  airdrop_rank: number;
  airdrop_amount: number;
  receive_count: number;
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
  retention_rate: number;
  accumulator_rate: number;
  days_since_airdrop: number;
  current_block: number;
  by_pattern: {
    [key: string]: number;
  };
}

interface ForensicMeta {
  timestamp: string;
  staleness_hours: number;
}

type BehaviorList = 'all' | 'accumulators' | 'holders' | 'sellers';

export default function AirdropPage() {
  const [summary, setSummary] = useState<AirdropSummary | null>(null)
  const [forensicStats, setForensicStats] = useState<ForensicStats | null>(null)
  const [forensicMeta, setForensicMeta] = useState<ForensicMeta | null>(null)
  const [currentList, setCurrentList] = useState<BehaviorList>('all')
  const [profiles, setProfiles] = useState<BehavioralProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [searchAddress, setSearchAddress] = useState("")
  const [goToPage, setGoToPage] = useState('')
  const [searchResult, setSearchResult] = useState<BehavioralProfile | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [initialLoad, setInitialLoad] = useState(true)
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)

  const ITEMS_PER_PAGE = 50

  // Calcular totalPages dinamicamente baseado em forensicStats
  const calculateTotalPages = () => {
    if (!forensicStats) return 0
    
    let totalCount = 0
    if (currentList === 'all') {
      totalCount = Object.values(forensicStats.by_pattern || {}).reduce((sum: number, val: any) => sum + (val || 0), 0)
    } else if (currentList === 'accumulators') {
      totalCount = (forensicStats.by_pattern.satoshi_visionary || 0) +
                  (forensicStats.by_pattern.btc_maximalist || 0) +
                  (forensicStats.by_pattern.rune_master || 0) + 
                  (forensicStats.by_pattern.ordinal_believer || 0) + 
                  (forensicStats.by_pattern.dog_legend || 0)
    } else if (currentList === 'holders') {
      totalCount = (forensicStats.by_pattern.diamond_paws || 0)
    } else if (currentList === 'sellers') {
      totalCount = (forensicStats.by_pattern.hodl_hero || 0) +
                  (forensicStats.by_pattern.steady_holder || 0) +
                  (forensicStats.by_pattern.profit_taker || 0) + 
                  (forensicStats.by_pattern.early_exit || 0) + 
                  (forensicStats.by_pattern.panic_seller || 0) + 
                  (forensicStats.by_pattern.paper_hands || 0)
    }
    return Math.ceil(totalCount / ITEMS_PER_PAGE)
  }
  
  const calculatedTotalPages = calculateTotalPages()

  // Função para gerar números das páginas
  const getPageNumbers = () => {
    const pages = []
    const total = calculatedTotalPages
    console.log('📄 getPageNumbers called - totalPages:', total, 'currentPage:', currentPage)
    
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
    
    console.log('📄 getPageNumbers returning:', pages.length, 'pages:', pages)
    return pages
  }

  // Função para ir para uma página específica
  const handleGoToPage = () => {
    const page = parseInt(goToPage)
    if (page >= 1 && page <= calculatedTotalPages) {
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
      // Sold or Moved: Venderam ou moveram qualquer quantidade (mesmo que parcial)
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
    { key: 'sellers', name: 'Sold or Moved', icon: TrendingDown, color: 'text-red-400' }
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
      const summaryResponse = await fetch('/api/airdrop/summary')
      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json()
        setSummary(summaryData)
      }
      
      // Fetch forensic stats
      const forensicResponse = await fetch('/api/forensic/summary')
      if (forensicResponse.ok) {
        const forensicData = await forensicResponse.json()
        setForensicStats(forensicData.statistics)
        if (forensicData.timestamp) {
          const ts = new Date(forensicData.timestamp)
          const staleness_hours = Math.floor((Date.now() - ts.getTime()) / 3_600_000)
          setForensicMeta({ timestamp: forensicData.timestamp, staleness_hours })
        }
      }
      
      // Fetch profiles based on current list
      let url = '/api/forensic/profiles'
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
          // Sold or Moved: Venderam ou moveram qualquer quantidade (mesmo que parcial)
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
          
          // Ordenar por receive_count (maior primeiro), depois por airdrop_amount
          allProfiles.sort((a, b) => {
            if (b.receive_count !== a.receive_count) {
              return b.receive_count - a.receive_count
            }
            return b.airdrop_amount - a.airdrop_amount
          })
          
          // Paginar manualmente
          const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
          const endIndex = startIndex + ITEMS_PER_PAGE
          const paginatedProfiles = allProfiles.slice(startIndex, endIndex)
          
          setProfiles(paginatedProfiles)
          return
        } else if (patterns.length === 1) {
          params.append('pattern', patterns[0])
        }
      }
      
      const profilesResponse = await fetch(`${url}?${params}`)
      if (profilesResponse.ok) {
        const profilesData = await profilesResponse.json()
        
        // Manter a ordenação do backend (já vem ordenado por receive_count)
        setProfiles(profilesData.profiles)
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
      setLoading(true)
      const response = await fetch(
        `/api/forensic/profile?address=${encodeURIComponent(searchAddress.trim())}`
      )
      if (response.ok) {
        const data = await response.json()
        setSearchResult(data.profile)
      } else if (response.status === 404) {
        setSearchResult(null)
        alert('Address not found in airdrop recipients')
      } else {
        setSearchResult(null)
        alert('Error fetching profile')
      }
    } catch (error) {
      console.error('Error searching recipient:', error)
      alert('Error searching recipient')
    } finally {
      setLoading(false)
    }
  }

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address)
    setCopiedAddress(address)
    setTimeout(() => setCopiedAddress(null), 2000)
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
      return <span className="text-dusty">0%</span>
    }
  };

  if (loading) {
    return <LoadingScreen message="Loading airdrop analysis..." />
  }

  return (
    <Layout currentPage="airdrop" setCurrentPage={() => {}}>
      <div className="pt-2 pb-3 px-3 md:p-6 space-y-3 md:space-y-6">
        {/* Header */}
      <div className="text-center space-y-2 md:space-y-4 px-4">
        <div className="hero-glow">
          <div className="flex items-center justify-center gap-2 md:gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-lava/[0.07] border border-lava/[0.1] flex items-center justify-center">
              <Image
                src="/Runestone.png"
                alt="Runestone"
                width={28}
                height={28}
                className="object-contain md:w-[36px] md:h-[36px]"
              />
            </div>
            <h1 className="text-2xl md:text-4xl font-bold gradient-text-hero whitespace-nowrap">
              Airdrop Analysis
            </h1>
          </div>
        </div>
        <p className="text-dusty font-mono text-sm md:text-lg">
          Independent audit of DOG•GO•TO•THE•MOON Airdrop - Rune 840000:3
        </p>
        {forensicMeta && (
          <p className="text-dusty/70 font-mono text-sm">
            Last update: {new Date(forensicMeta.timestamp).toLocaleString('en-US', {
              year: 'numeric',
              month: 'short',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: true
            })}
          </p>
        )}
      </div>

      {/* Main Stats - Row 1: Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-6">
        <Card variant="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-lava">
              Total Recipients
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-3xl font-bold text-snow font-mono metric-value tracking-tight">
              {formatNumber(forensicStats?.total_analyzed || 0)}
            </div>
            <p className="text-dusty text-sm font-mono mt-2">
              Airdrop OGs analyzed
            </p>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-cyan-400">
              Retention Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-3xl font-bold text-cyan-400 font-mono metric-value tracking-tight">
              {forensicStats?.retention_rate?.toFixed(2) ?? '—'}%
            </div>
            <p className="text-dusty text-sm font-mono mt-2">
              OGs still holding any DOG
            </p>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-green-400">
              Current Holders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-3xl font-bold text-snow font-mono metric-value tracking-tight">
              {formatNumber(forensicStats?.still_holding || 0)}
            </div>
            <p className="text-dusty text-sm font-mono mt-2">
              Still holding original airdrop
            </p>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-snow/60">
              Complete Exits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-3xl font-bold text-snow font-mono metric-value tracking-tight">
              {formatNumber(forensicStats?.sold_everything || 0)}
            </div>
            <p className="text-dusty text-sm font-mono mt-2">
              Sold or moved all tokens
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Stats - Row 2: Behavioral Categories */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-8">
        <Card variant="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-green-400">
              Accumulators
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-3xl font-bold text-green-400 font-mono metric-value tracking-tight">
              {formatNumber(
                (forensicStats?.by_pattern.satoshi_visionary || 0) +
                (forensicStats?.by_pattern.btc_maximalist || 0) +
                (forensicStats?.by_pattern.rune_master || 0) +
                (forensicStats?.by_pattern.ordinal_believer || 0) +
                (forensicStats?.by_pattern.dog_legend || 0)
              )}
            </div>
            <p className="text-dusty text-sm font-mono mt-2">
              {forensicStats?.accumulator_rate?.toFixed(1) ?? '—'}% — bought more since airdrop
            </p>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-purple-400">
              Diamond Paws
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-3xl font-bold text-purple-400 font-mono metric-value tracking-tight">
              {formatNumber(forensicStats?.by_pattern.diamond_paws || 0)}
            </div>
            <p className="text-dusty text-sm font-mono mt-2">
              Kept exact airdrop, never moved
            </p>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-yellow-400">
              Partial Sellers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-3xl font-bold text-snow font-mono metric-value tracking-tight">
              {formatNumber(
                (forensicStats?.by_pattern.hodl_hero || 0) +
                (forensicStats?.by_pattern.steady_holder || 0) +
                (forensicStats?.by_pattern.profit_taker || 0) +
                (forensicStats?.by_pattern.early_exit || 0) +
                (forensicStats?.by_pattern.panic_seller || 0)
              )}
            </div>
            <p className="text-dusty text-sm font-mono mt-2">
              Sold part of their airdrop
            </p>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-red-400">
              Paper Hands
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-3xl font-bold text-red-400 font-mono metric-value tracking-tight">
              {formatNumber(forensicStats?.by_pattern.paper_hands || 0)}
            </div>
            <p className="text-dusty text-sm font-mono mt-2">
              Sold 90%+ of their airdrop
            </p>
          </CardContent>
        </Card>
      </div>

      <SectionDivider title="Recipient Search" icon={Search} />

      {/* Address Search */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="text-snow text-xl font-display">
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
              className="flex-1 bg-transparent border-white/[0.05] text-snow"
            />
            <Button onClick={searchRecipient} className="rounded-lg">
              Search
            </Button>
          </div>
          
          {searchResult && (
            <div className="mt-4 p-4 bg-white/[0.02] border border-white/[0.05] rounded-xl">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-dusty text-sm">Address</p>
                  <div className="flex items-center gap-2">
                    <code className="text-snow text-xs">{searchResult.address}</code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyAddress(searchResult.address)}
                      className="p-1 h-6 w-6"
                      title={copiedAddress === searchResult.address ? "Copied!" : "Copy address"}
                    >
                      {copiedAddress === searchResult.address ? (
                        <span className="text-green-400 text-xs font-bold">✓</span>
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </Button>
                  </div>
                </div>
                <div>
                  <p className="text-dusty text-sm">Airdrop Amount</p>
                  <p className="text-snow font-mono">{formatDOG(searchResult.airdrop_amount)}</p>
                </div>
                <div>
                  <p className="text-dusty text-sm">Current Balance</p>
                  <p className="text-snow font-mono">{formatDOG(searchResult.current_balance)}</p>
                </div>
                <div>
                  <p className="text-dusty text-sm">Change</p>
                  {getChangeIndicator(searchResult.percentage_change)}
                </div>
                <div>
                  <p className="text-dusty text-sm">Behavior</p>
                  <span className="text-lava text-sm font-mono">
                    {(searchResult as any).behavior_detail || searchResult.behavior_category}
                  </span>
                </div>
                <div>
                  <p className="text-dusty text-sm">Diamond Score</p>
                  <span className={`text-sm font-mono font-bold ${
                    searchResult.diamond_score >= 90 ? 'text-yellow-400' :
                    searchResult.diamond_score >= 70 ? 'text-green-400' :
                    searchResult.diamond_score >= 40 ? 'text-snow' :
                    'text-red-400'
                  }`}>
                    {searchResult.diamond_score}/100
                  </span>
                </div>
              </div>
              {searchResult.insights.length > 0 && (
                <div className="mt-4">
                  <p className="text-dusty text-sm mb-2">Insights:</p>
                  <ul className="space-y-1">
                    {searchResult.insights.map((insight, idx) => (
                      <li key={idx} className="text-snow text-sm font-mono">• {insight}</li>
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
          <CardTitle className="text-snow text-xl font-display">
            Behavioral Lists
          </CardTitle>
          <p className="text-dusty text-sm mt-2">
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
                // Sold or Moved: Venderam ou moveram qualquer quantidade (mesmo que parcial)
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
                      ? 'bg-lava/20 text-lava border border-lava/30' 
                      : 'text-snow/80 hover:text-snow hover:bg-white/[0.03] border border-transparent hover:border-white/[0.06]'
                  }`}
                  onClick={() => handleListChange(list.key as BehaviorList)}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-sm font-mono">{list.name}</span>
                    <span className="text-xs font-mono text-dusty">
                      {formatNumber(count)}
                    </span>
                  </div>
                </Button>
              )
            })}
          </div>

          {/* Current List Info */}
          <div className="mb-4 p-4 bg-white/[0.02] border border-white/[0.05] rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-snow font-mono text-lg">
                  {behaviorLists.find(l => l.key === currentList)?.name}
                </h3>
                <p className="text-dusty text-sm">
                  Showing {formatNumber(profiles.length)} of {formatNumber(getTotalCount())} recipients
                </p>
              </div>
              <div className="text-right">
                <p className="text-dusty text-sm">Page {currentPage} of {calculatedTotalPages}</p>
                <p className="text-lava text-sm font-mono">
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
                <tr className="border-b border-white/[0.05]">
                  <th className="text-left py-3 px-4 text-lava font-mono text-sm">#</th>
                  <th className="text-left py-3 px-4 text-lava font-mono text-sm">Address</th>
                  <th className="text-center py-3 px-4 text-lava font-mono text-sm">Rcv</th>
                  <th className="text-right py-3 px-4 text-lava font-mono text-sm">Airdrop</th>
                  <th className="text-right py-3 px-4 text-lava font-mono text-sm">Current</th>
                  <th className="text-center py-3 px-4 text-lava font-mono text-sm">Change</th>
                  <th className="text-left py-3 px-4 text-lava font-mono text-sm">Behavior</th>
                  <th className="text-center py-3 px-4 text-lava font-mono text-sm hidden md:table-cell">Score</th>
                  <th className="text-center py-3 px-4 text-lava font-mono text-sm">Link</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile, index) => (
                  <tr 
                    key={profile.address} 
                    className="table-row"
                  >
                    <td className="py-3 px-4">
                      <span className="text-snow font-mono font-bold">
                        #{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <code className="address-text text-xs">
                          {profile.address}
                        </code>
                        <AddressBadge address={profile.address} size="sm" showName={false} />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyAddress(profile.address)}
                          className="p-1 h-6 w-6"
                          title={copiedAddress === profile.address ? "Copied!" : "Copy address"}
                        >
                          {copiedAddress === profile.address ? (
                            <span className="text-green-400 text-xs font-bold">✓</span>
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </Button>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {profile.receive_count > 1 ? (
                        <Badge variant="default" className="bg-lava/20 text-lava border border-lava/30 font-mono font-bold">
                          {profile.receive_count}x
                        </Badge>
                      ) : (
                        <span className="text-dusty/70 font-mono text-xs">1x</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-dusty font-mono text-sm">
                        {formatDOG(profile.airdrop_amount)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-snow font-mono font-bold text-sm">
                        {formatDOG(profile.current_balance)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {getChangeIndicator(profile.percentage_change)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs font-mono ${
                        profile.behavior_category === 'Accumulator' ? 'text-green-400' :
                        profile.behavior_category === 'Holder' ? 'text-purple-400' :
                        'text-snow/60'
                      }`}>
                        {(profile as any).behavior_detail || profile.behavior_category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center hidden md:table-cell">
                      <span className={`text-xs font-mono font-bold ${
                        profile.diamond_score >= 90 ? 'text-yellow-400' :
                        profile.diamond_score >= 70 ? 'text-green-400' :
                        profile.diamond_score >= 40 ? 'text-snow/70' :
                        'text-red-400/70'
                      }`}>
                        {profile.diamond_score}
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
        <div className="text-dusty font-mono text-sm">
          Showing {profiles.length} of {getTotalCount().toLocaleString('en-US')} {currentList}
        </div>
        
        <div className="flex items-center justify-center space-x-2">
          {/* Previous Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="rounded-lg"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          {/* Page Numbers */}
          {getPageNumbers().map((page, index) => (
            <div key={index}>
              {page === '...' ? (
                <span className="px-2 py-1 text-dusty/70">
                  <MoreHorizontal className="w-4 h-4" />
                </span>
              ) : (
                <Button
                  variant={currentPage === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePageChange(page as number)}
                  className={`rounded-lg ${
                    currentPage === page 
                      ? 'bg-lava text-snow border-lava' 
                      : 'hover:bg-white/[0.04]'
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
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === calculatedTotalPages}
            className="rounded-lg"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>

          {/* Go to Page */}
          <div className="flex items-center space-x-2 ml-4">
            <span className="text-dusty/70 text-sm font-mono">Go to</span>
            <Input
              type="number"
              min="1"
              max={calculatedTotalPages}
              value={goToPage}
              onChange={(e) => setGoToPage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleGoToPage()}
              className="w-16 h-8 text-center text-sm"
              placeholder="Page"
            />
            <span className="text-dusty/70 text-sm font-mono">Page</span>
          </div>
        </div>
      </div>
      </div>
    </Layout>
  )
}