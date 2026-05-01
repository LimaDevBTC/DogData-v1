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
  MoreHorizontal,
  Info
} from "lucide-react"
import { AddressBadge } from "@/components/address-badge"
import {
  TIERS,
  TIER_BY_KEY,
  CATEGORY_META,
  ACCUMULATOR_KEYS,
  HOLDER_KEYS,
  SELLER_KEYS,
  tierLabel,
  type TierKey,
} from "@/lib/airdrop-tiers"

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

type BehaviorList = 'all' | 'accumulators' | 'holders' | 'sellers' | TierKey;

const CATEGORY_KEYS: BehaviorList[] = ['accumulators', 'holders', 'sellers'];

function isTierKey(value: BehaviorList): value is TierKey {
  return value in TIER_BY_KEY;
}

function listDisplayName(value: BehaviorList): string {
  if (value === 'all') return 'All Recipients';
  if (value === 'accumulators') return 'Accumulators';
  if (value === 'holders') return 'Holders (Diamond Paws)';
  if (value === 'sellers') return 'Sold or Moved';
  return tierLabel(value);
}

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
    } else {
      // Single tier key (e.g. 'satoshi_visionary')
      totalCount = forensicStats.by_pattern[currentList] || 0
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
                    {tierLabel(searchResult.behavior_pattern)}
                  </span>
                  <p className="text-dusty/70 text-[10px] font-mono mt-0.5">
                    {TIER_BY_KEY[searchResult.behavior_pattern as TierKey]?.threshold}
                  </p>
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
          {/* Distribution: header + bar + legend */}
          {(() => {
            const tierCount = (key: TierKey) => forensicStats?.by_pattern[key] || 0
            const totalAll = Object.values(forensicStats?.by_pattern || {}).reduce(
              (sum, val) => sum + (val || 0),
              0,
            )
            const sumKeys = (keys: TierKey[]) => keys.reduce((sum, k) => sum + tierCount(k), 0)
            const pct = (n: number) => (totalAll > 0 ? (n / totalAll) * 100 : 0)
            const fmtPct = (p: number) => (p >= 10 ? p.toFixed(1) : p.toFixed(2))

            return (
              <div className="space-y-4 mb-6">
                {/* Top row: title + All Recipients reset */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-snow font-display font-bold text-base">Behavioral Distribution</div>
                    <div className="text-dusty text-xs font-mono mt-0.5">
                      Click a category, segment, or tier to filter the list below
                    </div>
                  </div>
                  <button
                    onClick={() => handleListChange('all')}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-mono transition-all ${
                      currentList === 'all'
                        ? 'bg-lava/15 text-lava border-lava/40'
                        : 'bg-white/[0.02] text-snow/80 border-white/[0.06] hover:border-white/[0.15] hover:text-snow'
                    }`}
                  >
                    All Recipients · {formatNumber(totalAll)}
                  </button>
                </div>

                {/* Category headers (clickable) */}
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORY_META.map((cat) => {
                    const count = sumKeys(cat.tierKeys)
                    const p = pct(count)
                    const isActive = currentList === cat.key
                    return (
                      <button
                        key={cat.key}
                        onClick={() => handleListChange(cat.key)}
                        className={`text-left p-3 rounded-lg border transition-all ${
                          isActive
                            ? `${cat.borderColor} bg-white/[0.04]`
                            : 'border-white/[0.05] bg-white/[0.02] hover:border-white/[0.12]'
                        }`}
                      >
                        <div className={`text-xs font-mono font-bold uppercase tracking-wider ${cat.textColor}`}>
                          {cat.short}
                        </div>
                        <div className="mt-1 flex items-baseline gap-2">
                          <span className="text-snow text-base md:text-lg font-mono font-bold">
                            {formatNumber(count)}
                          </span>
                          <span className="text-dusty text-xs font-mono">{fmtPct(p)}%</span>
                        </div>
                        <div className="text-dusty/70 text-[10px] font-mono mt-0.5 hidden sm:block">
                          {cat.description}
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* Stacked distribution bar — 12 tiers */}
                <div className="flex h-9 w-full overflow-hidden rounded-md bg-white/[0.04] border border-white/[0.05]">
                  {TIERS.map((tier) => {
                    const count = tierCount(tier.key)
                    const p = pct(count)
                    if (p <= 0) return null
                    const isActive = currentList === tier.key
                    return (
                      <button
                        key={tier.key}
                        onClick={() => handleListChange(tier.key)}
                        style={{ width: `${p}%` }}
                        title={`${tier.label} — ${formatNumber(count)} (${fmtPct(p)}%) · ${tier.threshold}`}
                        className={`${tier.barColor} transition-all hover:brightness-125 hover:z-10 ${
                          isActive ? 'ring-2 ring-snow ring-inset' : 'opacity-90 hover:opacity-100'
                        }`}
                        aria-label={`${tier.label}: ${formatNumber(count)} recipients (${fmtPct(p)}%)`}
                      />
                    )
                  })}
                </div>

                {/* Legend grid — 12 tier mini-cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {TIERS.map((tier) => {
                    const count = tierCount(tier.key)
                    const p = pct(count)
                    const isActive = currentList === tier.key
                    return (
                      <button
                        key={tier.key}
                        onClick={() => handleListChange(tier.key)}
                        className={`text-left p-2.5 rounded-lg border transition-all ${
                          isActive
                            ? 'border-lava/50 bg-lava/[0.06]'
                            : 'border-white/[0.05] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 ${tier.barColor}`} />
                          <span className={`text-xs font-mono font-semibold truncate ${tier.textColor}`}>
                            {tier.label}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-snow font-mono text-sm font-bold">
                            {formatNumber(count)}
                          </span>
                          <span className="text-dusty text-[10px] font-mono">{fmtPct(p)}%</span>
                        </div>
                        <div className="text-dusty/60 text-[10px] font-mono mt-0.5 truncate">
                          {tier.threshold}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* Current List Info */}
          <div className="mb-4 p-4 bg-white/[0.02] border border-white/[0.05] rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-snow font-mono text-lg">
                  {listDisplayName(currentList)}
                </h3>
                {isTierKey(currentList) && (
                  <p className="text-dusty/80 text-xs font-mono mt-0.5">
                    {TIER_BY_KEY[currentList].description} · {TIER_BY_KEY[currentList].threshold}
                  </p>
                )}
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
                      <span
                        className={`text-xs font-mono ${
                          profile.behavior_category === 'Accumulator' ? 'text-emerald-400' :
                          profile.behavior_category === 'Holder' ? 'text-purple-400' :
                          'text-snow/60'
                        }`}
                        title={TIER_BY_KEY[profile.behavior_pattern as TierKey]?.threshold || ''}
                      >
                        {tierLabel(profile.behavior_pattern)}
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
          Showing {profiles.length} of {getTotalCount().toLocaleString('en-US')} in {listDisplayName(currentList)}
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

      <SectionDivider title="Methodology" icon={Info} />

      {/* Methodology — public, auditable definitions for the 12 tiers */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="text-snow text-xl font-display">
            How recipients are classified
          </CardTitle>
          <p className="text-dusty text-sm mt-2 font-mono">
            Each airdrop recipient lands in <span className="text-snow">exactly one</span> of 12 mutually-exclusive tiers, based on how their balance changed since the airdrop. Classifier source: <code className="text-lava">scripts/update_forensic_analysis.py</code> · API: <code className="text-lava">/api/forensic/profiles?pattern=&lt;key&gt;</code>
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {CATEGORY_META.map((cat) => (
              <div key={cat.key}>
                <div className="flex items-baseline gap-3 mb-3">
                  <h3 className={`font-display font-bold text-lg ${cat.textColor}`}>{cat.short}</h3>
                  <span className="text-dusty text-xs font-mono">{cat.description}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/[0.05] text-left">
                        <th className="py-2 px-3 text-dusty/70 font-mono text-[11px] uppercase tracking-wider">Tier</th>
                        <th className="py-2 px-3 text-dusty/70 font-mono text-[11px] uppercase tracking-wider">Threshold</th>
                        <th className="py-2 px-3 text-dusty/70 font-mono text-[11px] uppercase tracking-wider">Description</th>
                        <th className="py-2 px-3 text-dusty/70 font-mono text-[11px] uppercase tracking-wider text-right">Diamond Score</th>
                        <th className="py-2 px-3 text-dusty/70 font-mono text-[11px] uppercase tracking-wider hidden md:table-cell">DB key</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cat.tierKeys.map((key) => {
                        const tier = TIER_BY_KEY[key]
                        return (
                          <tr key={key} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <div className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 ${tier.barColor}`} />
                                <span className={`font-mono text-sm font-semibold ${tier.textColor}`}>{tier.label}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-snow/80 font-mono text-xs">{tier.threshold}</td>
                            <td className="py-2.5 px-3 text-dusty font-mono text-xs">{tier.description}</td>
                            <td className="py-2.5 px-3 text-right">
                              <span className={`font-mono text-xs font-bold ${
                                tier.diamondScore >= 90 ? 'text-yellow-400' :
                                tier.diamondScore >= 70 ? 'text-emerald-400' :
                                tier.diamondScore >= 40 ? 'text-snow/80' :
                                'text-red-400/80'
                              }`}>
                                {tier.diamondScore}/100
                              </span>
                            </td>
                            <td className="py-2.5 px-3 hidden md:table-cell">
                              <code className="text-dusty/60 font-mono text-[11px]">{tier.key}</code>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            <div className="pt-4 border-t border-white/[0.05] text-dusty/70 text-xs font-mono leading-relaxed space-y-1">
              <p><span className="text-snow/80">Percentage change</span> = (current_balance − airdrop_amount) / airdrop_amount × 100</p>
              <p><span className="text-snow/80">Retention rate</span> = current_balance / airdrop_amount × 100 (only used when percentage_change ≤ 0)</p>
              <p><span className="text-snow/80">Diamond Score</span> is adjusted ±5 to ±10 based on rank movement (rank_change &gt; 1000 or &lt; −1000)</p>
              <p className="pt-2 text-dusty/60">DB keys are stable for API/data continuity. Display labels may change (e.g. <code className="text-dusty">dog_legend</code> renders as "DOG Supporter").</p>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </Layout>
  )
}