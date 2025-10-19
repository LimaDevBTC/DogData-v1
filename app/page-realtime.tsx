"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Download, Copy, ExternalLink, ChevronLeft, ChevronRight, Wifi, WifiOff, RefreshCw } from "lucide-react"

interface Holder {
  address: string;
  total_dog: number;
  utxo_count: number;
  first_seen: string;
  last_seen: string;
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

export default function DogHoldersPage() {
  const [allHolders, setAllHolders] = useState<Holder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [totalHolders, setTotalHolders] = useState(0)
  const [searchTerm, setSearchTerm] = useState("")
  const [goToPageInput, setGoToPageInput] = useState("")
  
  // SSE states
  const [isSSEConnected, setIsSSEConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 5,
      maximumFractionDigits: 5
    }).format(num);
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
  }, [currentPage])

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage)
    }
  };

  const handleGoToPage = () => {
    const page = parseInt(goToPageInput)
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
      setGoToPageInput("")
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleGoToPage()
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
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

  const getVisiblePages = () => {
    const delta = 2
    const range = []
    const rangeWithDots = []

    for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
      range.push(i)
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, '...')
    } else {
      rangeWithDots.push(1)
    }

    rangeWithDots.push(...range)

    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages)
    } else {
      rangeWithDots.push(totalPages)
    }

    return rangeWithDots
  };

  if (loading && allHolders.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dog-gray-900 via-black to-dog-gray-900 p-4">
        <div className="max-w-7xl mx-auto">
          <Card className="bg-dog-gray-800 border-dog-gray-700">
            <CardContent className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-dog-orange mx-auto mb-4"></div>
              <p className="text-dog-gray-300">Carregando dados dos holders...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dog-gray-900 via-black to-dog-gray-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">🐕 DOG Holders Explorer</h1>
          <p className="text-dog-gray-300 mb-4">
            Explorador completo de holders da runa DOG - Dados em tempo real
          </p>
          
          {/* Status de Conexão */}
          <div className="flex items-center gap-4 mb-4">
            {isSSEConnected ? (
              <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                <Wifi className="w-3 h-3 mr-1" />
                Tempo Real Ativo
              </Badge>
            ) : (
              <Badge variant="destructive">
                <WifiOff className="w-3 h-3 mr-1" />
                Desconectado
              </Badge>
            )}
            
            {lastUpdate && (
              <Badge variant="outline" className="text-green-600 border-green-600">
                <RefreshCw className="w-3 h-3 mr-1" />
                Atualizado: {lastUpdate}
              </Badge>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-dog-gray-800 border-dog-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-dog-orange text-lg">Total de Holders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">
                {totalHolders.toLocaleString('pt-BR')}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-dog-gray-800 border-dog-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-dog-orange text-lg">Página Atual</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">
                {currentPage} / {totalPages}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-dog-gray-800 border-dog-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-dog-orange text-lg">Holders nesta Página</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">
                {allHolders.length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Controls */}
        <Card className="bg-dog-gray-800 border-dog-gray-700 mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-dog-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Buscar por endereço..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-dog-gray-700 border-dog-gray-600 text-white placeholder-dog-gray-400"
                  />
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={exportToCSV}
                  variant="outline"
                  className="border-dog-orange text-dog-orange hover:bg-dog-orange hover:text-white"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Exportar CSV
                </Button>
                
                <Button
                  onClick={loadData}
                  variant="outline"
                  className="border-dog-blue text-dog-blue hover:bg-dog-blue hover:text-white"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Atualizar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error State */}
        {error && (
          <Card className="bg-red-900/20 border-red-500 mb-6">
            <CardContent className="p-4">
              <p className="text-red-300">❌ Erro: {error}</p>
            </CardContent>
          </Card>
        )}

        {/* Holders Table */}
        <Card className="bg-dog-gray-800 border-dog-gray-700">
          <CardHeader>
            <CardTitle className="text-white">
              Lista de Holders
              {loading && <span className="ml-2 text-dog-gray-400">(Carregando...)</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-dog-gray-700">
                    <th className="text-left py-3 px-4 text-dog-orange font-semibold">#</th>
                    <th className="text-left py-3 px-4 text-dog-orange font-semibold">Endereço</th>
                    <th className="text-right py-3 px-4 text-dog-orange font-semibold">Saldo DOG</th>
                    <th className="text-center py-3 px-4 text-dog-orange font-semibold">UTXOs</th>
                    <th className="text-center py-3 px-4 text-dog-orange font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {allHolders.map((holder, index) => (
                    <tr key={holder.address} className="border-b border-dog-gray-700 hover:bg-dog-gray-700/50">
                      <td className="py-3 px-4 text-dog-gray-300">
                        {(currentPage - 1) * 50 + index + 1}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <code className="text-dog-blue font-mono text-sm bg-dog-gray-700 px-2 py-1 rounded">
                            {holder.address}
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(holder.address)}
                            className="text-dog-gray-400 hover:text-white p-1"
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => window.open(`https://mempool.space/address/${holder.address}`, '_blank')}
                            className="text-dog-gray-400 hover:text-white p-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-white font-mono">
                          {formatNumber(holder.total_dog)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant="outline" className="border-dog-gray-500 text-dog-gray-300">
                          {holder.utxo_count}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-dog-orange text-dog-orange hover:bg-dog-orange hover:text-white"
                        >
                          Ver Detalhes
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
        <Card className="bg-dog-gray-800 border-dog-gray-700 mt-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-dog-gray-300">
                Mostrando {allHolders.length} de {totalHolders.toLocaleString('pt-BR')} holders
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  variant="outline"
                  size="sm"
                  className="border-dog-gray-600 text-dog-gray-300 hover:bg-dog-gray-700"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                
                {getVisiblePages().map((page, index) => (
                  <div key={index}>
                    {page === '...' ? (
                      <span className="px-3 py-2 text-dog-gray-400">...</span>
                    ) : (
                      <Button
                        onClick={() => handlePageChange(page as number)}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        className={
                          currentPage === page
                            ? "bg-dog-orange hover:bg-dog-orange/80 text-white"
                            : "border-dog-gray-600 text-dog-gray-300 hover:bg-dog-gray-700"
                        }
                      >
                        {page}
                      </Button>
                    )}
                  </div>
                ))}
                
                <Button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  variant="outline"
                  size="sm"
                  className="border-dog-gray-600 text-dog-gray-300 hover:bg-dog-gray-700"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-dog-gray-300 text-sm">Ir para:</span>
                <Input
                  type="number"
                  min="1"
                  max={totalPages}
                  value={goToPageInput}
                  onChange={(e) => setGoToPageInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="w-20 bg-dog-gray-700 border-dog-gray-600 text-white text-center"
                  placeholder="Página"
                />
                <Button
                  onClick={handleGoToPage}
                  variant="outline"
                  size="sm"
                  className="border-dog-orange text-dog-orange hover:bg-dog-orange hover:text-white"
                >
                  Ir
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
