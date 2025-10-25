"use client"

import { useState, useEffect, useRef } from "react"
import { Layout } from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Download, Copy, ExternalLink, ChevronLeft, ChevronRight, Wifi, WifiOff, MoreHorizontal, Users, Filter, Ticket } from "lucide-react"
import { SectionDivider } from "@/components/ui/section-divider"
import { TrendIndicator } from "@/components/ui/trend-indicator"

interface Holder {
  address: string;
  total_dog: number;
  utxo_count: number;
  first_seen: string;
  last_seen: string;
  is_airdrop_recipient?: boolean;
}

interface HoldersResponse {
  holders: Holder[];
  totalHolders: number;
  totalPages: number;
  currentPage: number;
  totalUtxos: number;
  lastUpdated: string;
  source: string;
}

export default function HoldersPage() {
  const [allHolders, setAllHolders] = useState<Holder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [totalHolders, setTotalHolders] = useState(0)
  const [goToPage, setGoToPage] = useState('')
  const [searchTerm, setSearchTerm] = useState("")
  const [searchAddress, setSearchAddress] = useState("")
  const [clickedDetailsIndex, setClickedDetailsIndex] = useState<number | null>(null)
  const [airdropRecipients, setAirdropRecipients] = useState<Set<string>>(new Set())
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)
  const [searchResult, setSearchResult] = useState<Holder | null>(null)
  
  // SSE states
  const [isSSEConnected, setIsSSEConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 5,
      maximumFractionDigits: 5
    }).format(num);
  };

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

  const fetchHolders = async (page: number, limit: number = 50) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/dog-rune/holders?page=${page}&limit=${limit}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data: HoldersResponse = await response.json()
      setAllHolders(data.holders)
      setTotalPages(data.totalPages)
      setTotalHolders(data.totalHolders)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
      console.error('Error fetching holders:', err)
    } finally {
      setLoading(false)
    }
  };

  const loadData = async () => {
    await fetchHolders(currentPage)
  };

  // SSE Connection
  useEffect(() => {
    const eventSource = new EventSource('/api/events')
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      console.log('🔗 Conectado ao SSE')
      setIsSSEConnected(true)
    }

    eventSource.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        console.log('📨 Mensagem SSE recebida:', message)
        
        if (message.type === 'data_updated') {
          console.log('🔄 Dados atualizados via SSE, recarregando...')
          setLastUpdate(new Date().toLocaleString('pt-BR'))
          loadData() // Recarrega os dados automaticamente
        }
      } catch (err) {
        console.error('❌ Erro ao processar mensagem SSE:', err)
      }
    }

    eventSource.onerror = (event) => {
      console.error('❌ Erro na conexão SSE:', event)
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
    if (!searchAddress.trim()) return
    
    try {
      // Buscar nos holders carregados
      const holder = allHolders.find(h => h.address.toLowerCase() === searchAddress.trim().toLowerCase())
      if (holder) {
        setSearchResult(holder)
      } else {
        setSearchResult(null)
        alert('Holder not found')
      }
    } catch (error) {
      console.error('Error searching holder:', error)
    }
  };

  const exportToCSV = () => {
    const csvContent = [
      ['Endereço', 'Saldo DOG', 'UTXOs', 'Primeira Transação', 'Última Transação'],
      ...allHolders.map(holder => [
        holder.address,
        holder.total_dog.toString(),
        holder.utxo_count.toString(),
        holder.first_seen,
        holder.last_seen
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
    <Layout currentPage="holders" setCurrentPage={() => {}}>
      <div className="p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-white font-mono flex items-center justify-center">
          <Users className="w-10 h-10 mr-4 text-dog-orange" />
          DOG Holders
        </h1>
        <p className="text-dog-gray-400 font-mono text-lg">
          Complete holder database with real-time updates
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card variant="glass" className="stagger-item border-orange-500/20 hover:border-orange-500/40 transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-dog-orange text-lg flex items-center">
              <Users className="w-5 h-5 mr-2" />
              Total Holders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-orange-500 bg-clip-text text-transparent font-mono">
                {totalHolders.toLocaleString('pt-BR')}
              </div>
              <TrendIndicator value={1.8} type="percentage" size="sm" />
            </div>
          </CardContent>
        </Card>

        <Card variant="glass" className="stagger-item border-orange-500/20 hover:border-orange-500/40 transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-orange-400 text-lg flex items-center">
              <Ticket className="w-5 h-5 mr-2" />
              Total UTXOs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-orange-500 bg-clip-text text-transparent font-mono">
              270,685
            </div>
            <p className="text-gray-400 text-xs font-mono mt-1">DOG UTXOs on-chain</p>
          </CardContent>
        </Card>

        <Card variant="glass" className="stagger-item border-green-500/20 hover:border-green-500/40 transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-dog-green text-lg flex items-center">
              <ChevronRight className="w-5 h-5 mr-2" />
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
            <CardTitle className="text-dog-blue text-lg flex items-center">
              <Search className="w-5 h-5 mr-2" />
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
              <div className="p-4 border border-orange-500/30 bg-orange-500/5 rounded">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-orange-400 font-mono font-bold">Holder Found</h4>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSearchResult(null)}
                    className="p-1 h-6 w-6"
                  >
                    ✕
                  </Button>
                </div>
                <div className="space-y-1 text-sm font-mono">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">Address:</span>
                    <code className="text-white">{searchResult.address}</code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(searchResult.address)}
                      className="p-1 h-6 w-6"
                    >
                      {copiedAddress === searchResult.address ? (
                        <span className="text-green-400 text-xs">✓</span>
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </Button>
                  </div>
                  <div><span className="text-gray-400">Balance:</span> <span className="text-white">{formatNumber(searchResult.total_dog)} DOG</span></div>
                  <div><span className="text-gray-400">UTXOs:</span> <span className="text-white">{searchResult.utxo_count}</span></div>
                  {searchResult.is_airdrop_recipient && (
                    <div className="text-orange-400">🎁 Airdrop Recipient</div>
                  )}
                </div>
              </div>
            )}
            
            {/* Filter and Export Row */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-dog-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Filter by address..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={exportToCSV}
                  variant="outline"
                  className="btn-sharp"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </div>
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
          <CardTitle className="text-white text-xl flex items-center justify-between">
            <div>
              Holders List
              {loading && <span className="ml-2 text-dog-gray-400">(Loading...)</span>}
            </div>
            {airdropRecipients.size > 0 && (
              <div className="text-sm text-gray-400 font-mono">
                {airdropRecipients.size.toLocaleString()} airdrop recipients loaded
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dog-gray-700">
                  <th className="text-left py-3 px-4 text-dog-orange font-mono text-sm">#</th>
                  <th className="text-left py-3 px-4 text-dog-orange font-mono text-sm">Address</th>
                  <th className="text-right py-3 px-4 text-dog-orange font-mono text-sm">DOG Balance</th>
                  <th className="text-center py-3 px-4 text-dog-orange font-mono text-sm">UTXOs</th>
                  <th className="text-center py-3 px-4 text-dog-orange font-mono text-sm">Airdrop</th>
                  <th className="text-center py-3 px-4 text-dog-orange font-mono text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allHolders.map((holder, index) => (
                  <tr key={holder.address} className="table-row">
                    <td className="py-3 px-4 text-dog-gray-300 font-mono text-sm">
                      {(currentPage - 1) * 50 + index + 1}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <code className="address-text text-sm">
                          {holder.address}
                        </code>
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
                      <span className="amount-text text-sm">
                        {formatNumber(holder.total_dog)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant="outline" className="border-dog-gray-500 text-dog-gray-300">
                        {holder.utxo_count}
                      </Badge>
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
          Showing {allHolders.length} of {totalHolders.toLocaleString('en-US')} holders
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


