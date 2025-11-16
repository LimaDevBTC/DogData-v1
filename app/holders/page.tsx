"use client"

import { useState, useEffect, useRef } from "react"
import { Layout } from "@/components/layout"
import { LoadingScreen } from "@/components/loading-screen"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Download, Copy, ExternalLink, ChevronLeft, ChevronRight, Wifi, WifiOff, MoreHorizontal, Users, Filter, Ticket } from "lucide-react"
import { SectionDivider } from "@/components/ui/section-divider"
import { TrendIndicator } from "@/components/ui/trend-indicator"
import { AddressBadge } from "@/components/address-badge"

interface Holder {
  rank: number;
  address: string;
  total_amount: number;
  total_dog: number;
  utxo_count?: number;
  is_airdrop_recipient?: boolean;
  airdrop_amount?: number;
}

interface HolderSearchResult extends Holder {
  available_amount?: number;
  available_dog?: number;
  projected_amount?: number;
  projected_dog?: number;
  pending_incoming?: number;
  pending_outgoing?: number;
  pending_net?: number;
}

interface HoldersResponse {
  holders: Holder[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  metadata: {
    runeId: string;
    divisibility: number;
    source: string;
    updatedAt: string;
  };
}

interface HolderSearchResponse {
  holder: HolderSearchResult;
  metadata: {
    runeId: string;
    divisibility: number;
    source: string;
    updatedAt: string;
  };
}

export default function HoldersPage() {
  const [allHolders, setAllHolders] = useState<Holder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [totalHolders, setTotalHolders] = useState(0)
  const [pageLimit, setPageLimit] = useState(25)
  const [goToPage, setGoToPage] = useState('')
  const [searchTerm, setSearchTerm] = useState("")
  const [searchAddress, setSearchAddress] = useState("")
  const [clickedDetailsIndex, setClickedDetailsIndex] = useState<number | null>(null)
  const [airdropRecipients, setAirdropRecipients] = useState<Set<string>>(new Set())
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)
  const [searchResult, setSearchResult] = useState<HolderSearchResult | null>(null)
  
  // SSE states
  const [isSSEConnected, setIsSSEConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)
  const [holdersMetadata, setHoldersMetadata] = useState<{ divisibility: number; updatedAt: string; source: string } | null>(null)
  const [totalSupply, setTotalSupply] = useState<number | null>(null)
  const [circulatingSupply, setCirculatingSupply] = useState<number | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 5,
      maximumFractionDigits: 5
    }).format(num);
  };

  const resolvedLastUpdate = lastUpdate ?? holdersMetadata?.updatedAt ?? null

  // Carregar lista de recipients do airdrop
  const loadAirdropRecipients = async () => {
    try {
      const response = await fetch('/api/airdrop/recipients')
      if (response.ok) {
        const data = await response.json()
        if (data.recipients && Array.isArray(data.recipients)) {
          const addresses = data.recipients.map((r: any) => r.address)
          setAirdropRecipients(new Set(addresses))
          console.log(`✅ Loaded ${addresses.length} airdrop recipients`)
        }
      }
    } catch (error) {
      console.error('Error loading airdrop recipients:', error)
    }
  };

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
  };

  const fetchHolders = async (page: number, limit: number = pageLimit) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/dog-rune/holders?page=${page}&limit=${limit}`)
      
      if (!response.ok) {
        // Mesmo com erro HTTP, tentar parsear a resposta caso seja uma página vazia válida
        try {
          const data: HoldersResponse = await response.json()
          if (data.holders && Array.isArray(data.holders)) {
            setAllHolders(data.holders)
            setTotalPages(data.pagination?.totalPages || 1)
            setTotalHolders(data.pagination?.total || 0)
            setPageLimit(data.pagination?.limit || limit)
            setHoldersMetadata({
              divisibility: data.metadata?.divisibility || 5,
              updatedAt: data.metadata?.updatedAt || new Date().toISOString(),
              source: data.metadata?.source || 'fallback',
            })
            setError(null)
            return
          }
        } catch {
          // Se não conseguir parsear, continuar com o erro
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data: HoldersResponse = await response.json()
      
      // Verificar se é uma página vazia (mas válida)
      if (data.holders && Array.isArray(data.holders) && data.holders.length === 0 && data.pagination?.total === 0) {
        console.warn('⚠️ Empty page received, may indicate temporary API issue')
        // Só mostrar erro se não tivermos dados anteriores válidos
        if (allHolders.length === 0) {
          setError('Data temporarily unavailable. Please try again in a few moments.')
        } else {
          // Manter dados anteriores e apenas logar o problema
          console.warn('⚠️ Keeping previous valid data due to empty response')
          setError(null)
          return // Não atualizar com dados vazios
        }
      } else {
        setError(null)
      }
      
      setAllHolders(data.holders || [])
      setTotalPages(data.pagination?.totalPages || 1)
      setTotalHolders(data.pagination?.total || 0)
      setPageLimit(data.pagination?.limit || limit)
      setHoldersMetadata({
        divisibility: data.metadata?.divisibility || 5,
        updatedAt: data.metadata?.updatedAt || new Date().toISOString(),
        source: data.metadata?.source || 'xverse',
      })
      setLastUpdate(new Date(data.metadata?.updatedAt || new Date().toISOString()).toISOString())
      
      console.log('✅ Holders loaded:', {
        holders: data.holders?.length || 0,
        total: data.pagination?.total || 0,
        pages: data.pagination?.totalPages || 1,
        source: data.metadata?.source || 'unknown'
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      console.error('Error fetching holders:', err)
      // Não limpar holders anteriores em caso de erro, mantém os últimos dados válidos
    } finally {
      setLoading(false)
    }
  };

  const loadData = async () => {
    await fetchHolders(currentPage)
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/dog-rune/stats')
      if (!response.ok) {
        throw new Error(`Stats error: ${response.status}`)
      }
      const stats = await response.json()
      setTotalSupply(typeof stats.totalSupply === 'number' ? stats.totalSupply : null)
      setCirculatingSupply(typeof stats.circulatingSupply === 'number' ? stats.circulatingSupply : null)
      if (stats.metadata?.lastUpdated) {
        setHoldersMetadata(prev => ({
          divisibility: stats.metadata.divisibility ?? prev?.divisibility ?? 0,
          updatedAt: stats.metadata.lastUpdated,
          source: stats.metadata.source ?? prev?.source ?? 'xverse'
        }))
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  // SSE Connection
  useEffect(() => {
    const eventSource = new EventSource('/api/events')
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      console.log('🔗 Connected to SSE')
      setIsSSEConnected(true)
    }

    eventSource.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        console.log('📨 SSE message received:', message)
        
        if (message.type === 'data_updated') {
          console.log('🔄 Data updated via SSE, reloading...')
          setLastUpdate(new Date().toISOString())
          loadData() // Recarrega os dados automaticamente
        }
      } catch (err) {
        console.error('❌ Error processing SSE message:', err)
      }
    }

    eventSource.onerror = (event) => {
      console.error('❌ SSE connection error:', event)
      setIsSSEConnected(false)
    }

    return () => {
      eventSource.close()
      eventSourceRef.current = null
    }
  }, [])

  useEffect(() => {
    loadData()
    loadAirdropRecipients()
  }, [currentPage])

  useEffect(() => {
    loadStats()
  }, [])

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage)
    }
  };



  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedAddress(text)
    setTimeout(() => setCopiedAddress(null), 2000)
  };

  const searchHolderByAddress = async () => {
    const address = searchAddress.trim()
    if (!address) return
    
    try {
      setLoading(true)
      const response = await fetch(`/api/dog-rune/holders?address=${encodeURIComponent(address)}`)
      
      if (response.status === 404) {
        setSearchResult(null)
        alert('Holder not found')
        return
      }
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data: HolderSearchResponse = await response.json()
      let holder = data.holder
      
      if (holder) {
        holder = {
          ...holder,
          is_airdrop_recipient: airdropRecipients.has(holder.address),
        }
        
        if (holder.is_airdrop_recipient) {
          try {
            const airdropResponse = await fetch(`/data/airdrop_recipients.json`)
            if (airdropResponse.ok) {
              const airdropData = await airdropResponse.json()
              const airdropRecipient = airdropData.recipients?.find((r: any) => 
                r.address.toLowerCase() === holder.address.toLowerCase()
              )
              if (airdropRecipient) {
                holder.airdrop_amount = airdropRecipient.airdrop_amount
              }
            }
          } catch (err) {
            console.error('Error fetching airdrop data:', err)
          }
        }
        
        setSearchResult(holder)
        setHoldersMetadata(prev => ({
          divisibility: data.metadata.divisibility ?? prev?.divisibility ?? 0,
          updatedAt: data.metadata.updatedAt,
          source: data.metadata.source ?? prev?.source ?? 'xverse',
        }))
      } else {
        setSearchResult(null)
        alert('Holder not found')
      }
    } catch (error) {
      console.error('Error searching holder:', error)
      alert('Error searching holder')
    } finally {
      setLoading(false)
    }
  };

  const exportToCSV = () => {
    const csvContent = [
      ['Address', 'DOG Balance', 'Rank'],
      ...allHolders.map(holder => [
        holder.address,
        holder.total_dog.toString(),
        holder.rank.toString()
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dog_holders_page_${currentPage}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  };


  if (loading && allHolders.length === 0) {
    return <LoadingScreen message="Loading DOG holders..." />
  }

  return (
    <Layout currentPage="holders" setCurrentPage={() => {}}>
      <div className="pt-2 pb-3 px-3 md:p-6 space-y-3 md:space-y-6">
      {/* Header */}
      <div className="text-center space-y-2 md:space-y-4">
        <h1 className="text-4xl font-bold text-white font-mono flex items-center justify-center">
          <Users className="w-10 h-10 mr-4 text-dog-orange" />
          DOG Holders
        </h1>
        <p className="text-dog-gray-400 font-mono text-lg">
          Complete holder database with real-time updates
        </p>
        {(resolvedLastUpdate) && (
          <p className="text-dog-gray-500 font-mono text-sm">
            Last update: {new Date(resolvedLastUpdate).toLocaleString('en-US', {
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card variant="glass" className="stagger-item border-orange-500/20 hover:border-orange-500/40 transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-orange-400 text-xs font-mono uppercase tracking-[0.3em]">
              <Users className="w-4 h-4" />
              Total Holders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-orange-500 bg-clip-text text-transparent font-mono">
                {totalHolders ? totalHolders.toLocaleString('en-US') : '0'}
              </div>
              <TrendIndicator value={1.8} type="percentage" size="sm" />
            </div>
          </CardContent>
        </Card>

        <Card variant="glass" className="stagger-item border-orange-500/20 hover:border-orange-500/40 transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-orange-300 text-xs font-mono uppercase tracking-[0.3em]">
              <Ticket className="w-4 h-4" />
              Circulating Supply
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-orange-500 bg-clip-text text-transparent font-mono">
              {circulatingSupply != null ? circulatingSupply.toLocaleString('en-US', { maximumFractionDigits: 3 }) : '—'}
            </div>
          </CardContent>
        </Card>

        <Card variant="glass" className="stagger-item border-green-500/20 hover:border-green-500/40 transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-green-300 text-xs font-mono uppercase tracking-[0.3em]">
              <ChevronRight className="w-4 h-4" />
              Current Page
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold bg-gradient-to-r from-green-400 to-green-500 bg-clip-text text-transparent font-mono">
              {currentPage} / {totalPages}
            </div>
          </CardContent>
        </Card>

        <Card variant="glass" className="stagger-item border-blue-500/20 hover:border-blue-500/40 transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-blue-300 text-xs font-mono uppercase tracking-[0.3em]">
              <Search className="w-4 h-4" />
              Holders on Page
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-blue-500 bg-clip-text text-transparent font-mono">
              {allHolders.length}
            </div>
          </CardContent>
        </Card>
      </div>

      <SectionDivider title="Search & Filters" icon={Filter} />

      {/* Search and Controls */}
      <Card variant="glass">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4">
            {/* Search by Address with Button */}
            <div className="flex gap-2">
              <Input
                placeholder="Enter Bitcoin address..."
                value={searchAddress}
                onChange={(e) => setSearchAddress(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchHolderByAddress()}
                className="flex-1 bg-transparent border-gray-700/50 text-white"
              />
              <Button onClick={searchHolderByAddress} className="btn-sharp">
                <Search className="w-4 h-4 mr-2" />
                Search
              </Button>
            </div>
            
            {/* Search Result */}
            {searchResult && (
              <div className="mt-4 p-4 bg-transparent border border-gray-700/50 rounded">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-400 text-sm">Address</p>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/40 font-mono text-[10px] uppercase tracking-wide">
                        Rank #{searchResult.rank.toLocaleString('en-US')}
                      </Badge>
                      <code className="text-white text-xs break-all">{searchResult.address}</code>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(searchResult.address)}
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
                    <p className="text-gray-400 text-sm">DOG Balance</p>
                    <p className="text-white font-mono">{formatNumber(searchResult.total_dog)} DOG</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">UTXOs</p>
                    <p className="text-white font-mono">{searchResult.utxo_count != null ? searchResult.utxo_count : '—'}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Available DOG</p>
                    <p className="text-white font-mono">{searchResult.available_dog != null ? formatNumber(searchResult.available_dog) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Projected DOG</p>
                    <p className="text-white font-mono">{searchResult.projected_dog != null ? formatNumber(searchResult.projected_dog) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Pending (net)</p>
                    <p className="text-white font-mono">{searchResult.pending_net != null ? formatNumber(searchResult.pending_net) : '—'}</p>
                  </div>
                  {searchResult.is_airdrop_recipient ? (
                    <>
                      <div>
                        <p className="text-gray-400 text-sm">Airdrop Recipient</p>
                        <span className="text-orange-400 text-sm font-mono">
                          Yes
                        </span>
                      </div>
                      {searchResult.airdrop_amount && (
                        <div>
                          <p className="text-gray-400 text-sm">Airdrop Amount</p>
                          <p className="text-white font-mono">{formatNumber(searchResult.airdrop_amount)} DOG</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div>
                      <p className="text-gray-400 text-sm">Airdrop Recipient</p>
                      <span className="text-gray-500 text-sm font-mono">
                        No
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error State */}
      {error && (
        <Card variant="glass" className="bg-dog-red/10 border-dog-red">
          <CardContent className="p-4">
            <p className="text-dog-red font-mono">❌ Error: {error}</p>
          </CardContent>
        </Card>
      )}

      {/* Holders Table */}
      <Card variant="glass">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white text-xl font-mono">Holders List</CardTitle>
            <div className="flex items-center gap-2 text-green-400 font-mono text-xs">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              LIVE
            </div>
          </div>
          {loading && (
            <p className="text-gray-500 font-mono text-xs mt-1">Loading latest holder data…</p>
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700/50">
                  <th className="text-left py-3 px-4 text-orange-400 font-mono text-xs uppercase tracking-[0.25em]">Address</th>
                  <th className="text-right py-3 px-4 text-orange-400 font-mono text-xs uppercase tracking-[0.25em]">DOG Balance</th>
                  <th className="text-center py-3 px-4 text-orange-400 font-mono text-xs uppercase tracking-[0.25em]">UTXOs</th>
                  <th className="text-center py-3 px-4 text-orange-400 font-mono text-xs uppercase tracking-[0.25em]">Airdrop</th>
                  <th className="text-center py-3 px-4 text-orange-400 font-mono text-xs uppercase tracking-[0.25em]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allHolders.map((holder, index) => (
                  <tr key={holder.address} className="table-row">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/40 font-mono text-[10px] uppercase tracking-wide">
                          Rank #{holder.rank.toLocaleString('en-US')}
                        </Badge>
                        <code className="text-cyan-400 text-xs">
                          {holder.address}
                        </code>
                        <AddressBadge address={holder.address} size="sm" showName={false} />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(holder.address)}
                          className="p-1 h-6 w-6"
                          title={copiedAddress === holder.address ? "Copied!" : "Copy address"}
                        >
                          {copiedAddress === holder.address ? (
                            <span className="text-green-400 text-xs font-bold">✓</span>
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.open(`https://mempool.space/address/${holder.address}`, '_blank')}
                          className="p-1 h-6 w-6"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="font-mono text-sm text-orange-300">
                        {formatNumber(holder.total_dog)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                          <span className="text-xs font-mono text-gray-300">
                            {holder.utxo_count != null ? holder.utxo_count : '—'}
                          </span>
                        </td>
                    <td className="py-3 px-4 text-center">
                      {airdropRecipients.size === 0 ? (
                        <Badge variant="outline" className="border-gray-500/30 text-gray-500">
                          ...
                        </Badge>
                      ) : airdropRecipients.has(holder.address) ? (
                        <Badge variant="success" className="bg-green-500/20 text-green-400 border-green-500/30">
                          YES
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-gray-500/50 text-gray-400">
                          NO
                        </Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        className={`btn-sharp w-[130px] transition-colors duration-300 ${
                          clickedDetailsIndex === index 
                            ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' 
                            : ''
                        }`}
                        onClick={() => {
                          setClickedDetailsIndex(index)
                          setTimeout(() => setClickedDetailsIndex(null), 2000)
                        }}
                      >
                        <span className="whitespace-nowrap block">
                          {clickedDetailsIndex === index ? 'COMING SOON' : 'View Details'}
                        </span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex flex-col items-center gap-4">
        <div className="text-dog-gray-300 font-mono text-sm">
          Showing {allHolders.length} of {totalHolders ? totalHolders.toLocaleString('en-US') : '0'} holders
        </div>
        
        <div className="flex items-center justify-center space-x-2">
              {/* Previous Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
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
                      onClick={() => handlePageChange(page as number)}
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
                onClick={() => handlePageChange(currentPage + 1)}
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
          </div>
      </div>
    </Layout>
  )
}

