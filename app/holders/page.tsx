"use client"

import React, { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { Layout } from "@/components/layout"
import { LoadingScreen } from "@/components/loading-screen"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Download, Copy, ExternalLink, ChevronLeft, ChevronRight, Wifi, WifiOff, MoreHorizontal, Users, Filter, Ticket, Sparkles, BarChart3 } from "lucide-react"
import { SectionDivider } from "@/components/ui/section-divider"
import { AddressBadge } from "@/components/address-badge"
import { HoldersDistributionChart } from "@/components/holders/holders-distribution-chart"
import { Top100WhalesMovement } from "@/components/holders/top100-whales-movement"
import { useVerifiedAddresses } from "@/contexts/VerifiedAddressesContext"

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
  const [expandedHolder, setExpandedHolder] = useState<HolderSearchResult | null>(null)
  const [expandedAddress, setExpandedAddress] = useState<string | null>(null)
  const { getVerified, data: verifiedData } = useVerifiedAddresses()
  const [searchSuggestions, setSearchSuggestions] = useState<Array<{address: string, name: string, logo?: string}>>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  
  // SSE states
  const [isSSEConnected, setIsSSEConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)
  const [holdersMetadata, setHoldersMetadata] = useState<{ divisibility: number; updatedAt: string; source: string } | null>(null)
  const [totalSupply, setTotalSupply] = useState<number | null>(null)
  const [circulatingSupply, setCirculatingSupply] = useState<number | null>(null)
  const [newHolders24h, setNewHolders24h] = useState<number | null>(null)
  const [allHoldersForChart, setAllHoldersForChart] = useState<Holder[]>([]) // Todos os holders para o gráfico
  const [totalHoldersFromJSON, setTotalHoldersFromJSON] = useState<number | null>(null) // Total de holders do JSON
  const [loadingChart, setLoadingChart] = useState(true) // Estado de loading do gráfico
  // Totais por rede
  // Bitcoin: sempre do JSON (dinâmico)
  // Solana e Stacks: valores hardcoded (únicos valores fixos)
  const [bitcoinHolders, setBitcoinHolders] = useState<number>(0) // Será atualizado do JSON
  const [solanaHolders, setSolanaHolders] = useState<number>(10926) // Hardcoded
  const [stacksHolders, setStacksHolders] = useState<number>(570) // Hardcoded - atualizado a cada hora pelo script (external_holders.json)
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
      // Carregar JSON completo (única fonte de dados)
      const timestamp = Date.now()
      const jsonResponse = await fetch(`/data/dog_holders_by_address.json?_t=${timestamp}`, { 
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        }
      })
      
      if (!jsonResponse.ok) {
        throw new Error(`Failed to load holders JSON: ${jsonResponse.status}`)
      }
      
      const jsonData = await jsonResponse.json()
      
      if (!jsonData.holders || !Array.isArray(jsonData.holders)) {
        throw new Error('Invalid JSON format: holders is not an array')
      }
      
      const allHoldersFromJSON = jsonData.holders
      const totalHoldersFromJSONValue = typeof jsonData.total_holders === 'number' 
        ? jsonData.total_holders 
        : allHoldersFromJSON.length
      
      console.log(`📊 [JSON] Carregados ${allHoldersFromJSON.length} holders, total_holders: ${totalHoldersFromJSONValue}`)
      
      // Atualizar dados do gráfico (todos os holders)
      setAllHoldersForChart(allHoldersFromJSON)
      setTotalHoldersFromJSON(totalHoldersFromJSONValue)
      setBitcoinHolders(totalHoldersFromJSONValue) // Atualizar holders do Bitcoin (sempre do JSON)
      setLoadingChart(false)
      
      // Fazer paginação no cliente
      const startIndex = (page - 1) * limit
      const endIndex = startIndex + limit
      const paginatedHolders = allHoldersFromJSON.slice(startIndex, endIndex)
      const totalPagesCalculated = Math.ceil(allHoldersFromJSON.length / limit)
      
      // Atualizar estados
      setAllHolders(paginatedHolders)
      setTotalPages(totalPagesCalculated)
      setTotalHolders(totalHoldersFromJSONValue)
      setPageLimit(limit)
      setHoldersMetadata({
        divisibility: 5, // DOG tem 5 casas decimais
        updatedAt: jsonData.timestamp || new Date().toISOString(),
        source: 'json',
      })
      setLastUpdate(jsonData.timestamp || new Date().toISOString())
      setError(null)
      
      console.log('✅ Holders loaded from JSON:', {
        holders: paginatedHolders.length,
        total: totalHoldersFromJSONValue,
        pages: totalPagesCalculated,
        page,
        source: 'json'
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

  // Calcular novos holders das últimas 24h
  const calculateNewHolders24h = async () => {
    try {
      // Buscar transações das últimas 24h (sem summary para obter todas as transações)
      const response = await fetch('/api/dog-rune/transactions-kv', { cache: 'no-store' })
      if (!response.ok) {
        throw new Error(`Transactions error: ${response.status}`)
      }
      
      const data = await response.json()
      const transactions = data.transactions || []
      
      // Buscar lista completa de holders do JSON para verificar quem já tinha DOG antes
      const timestamp = Date.now()
      const holdersResponse = await fetch(`/data/dog_holders_by_address.json?_t=${timestamp}`, { 
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        }
      })
      if (!holdersResponse.ok) {
        throw new Error(`Holders JSON error: ${holdersResponse.status}`)
      }
      
      const holdersData = await holdersResponse.json()
      const allHoldersMap = new Map<string, boolean>()
      
      // Criar mapa de todos os holders atuais (lowercase para comparação)
      if (holdersData.holders && Array.isArray(holdersData.holders)) {
        holdersData.holders.forEach((holder: Holder) => {
          if (holder.address) {
            allHoldersMap.set(holder.address.toLowerCase(), true)
          }
        })
      }
      
      // Filtrar transações das últimas 24h
      const now = Date.now()
      const threshold24h = now - 24 * 60 * 60 * 1000
      
      const newHoldersSet = new Set<string>()
      
      for (const tx of transactions) {
        const txTime = new Date(tx.timestamp).getTime()
        if (Number.isNaN(txTime) || txTime < threshold24h) continue
        
        // Verificar receivers que são novos holders
        if (tx.receivers && Array.isArray(tx.receivers)) {
          const senderAddresses = (tx.senders || []).map((s: any) => (s.address || '').toLowerCase())
          
          for (const receiver of tx.receivers) {
            const receiverAddress = receiver.address
            if (!receiverAddress) continue
            
            const receiverLower = receiverAddress.toLowerCase()
            const hasReceivedDog = (receiver.amount_dog || 0) > 0
            const wasSender = senderAddresses.includes(receiverLower)
            const isInRanking = allHoldersMap.has(receiverLower)
            
            // É novo holder se:
            // - Recebeu DOG nesta transação
            // - NÃO estava nos senders (não tinha DOG antes desta transação)
            // - NÃO está no ranking atual (não tinha DOG antes)
            // 
            // Nota: Se está no ranking atual, provavelmente já tinha DOG antes das últimas 24h
            // Mas pode ter entrado no ranking justamente nas últimas 24h. Para ser mais preciso,
            // vamos contar apenas os que não estão no ranking (mais conservador)
            if (hasReceivedDog && !wasSender && !isInRanking) {
              newHoldersSet.add(receiverLower)
            }
          }
        }
      }
      
      setNewHolders24h(newHoldersSet.size)
      console.log(`✅ New holders 24h: ${newHoldersSet.size}`)
    } catch (error) {
      console.error('Error calculating new holders 24h:', error)
      setNewHolders24h(null)
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

  // Carregar todos os holders para o gráfico de distribuição
  // Tentar carregar diretamente do JSON público primeiro (mais rápido)
  const loadAllHoldersForChart = async () => {
    setLoadingChart(true)
    try {
      // Prioridade 1: Tentar carregar diretamente do JSON público (mais rápido, sem processamento da API)
      // Este arquivo está servido estaticamente e é muito mais rápido que a API
      const startTime = performance.now()
      // Usar no-store + timestamp para forçar bypass completo do cache
      const timestamp = Date.now()
      const publicResponse = await fetch(`/data/dog_holders_by_address.json?_t=${timestamp}`, {
        cache: 'no-store', // Sem cache para garantir dados atualizados do JSON
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        }
      })
      
      if (publicResponse.ok) {
        const publicData = await publicResponse.json()
        const loadTime = performance.now() - startTime
        console.log(`⏱️ Gráfico: JSON carregado em ${loadTime.toFixed(0)}ms`)
        
        if (publicData.holders && Array.isArray(publicData.holders)) {
          console.log(`✅ Gráfico: ${publicData.holders.length} holders carregados do JSON público`)
          setAllHoldersForChart(publicData.holders)
          // Usar total_holders do JSON se disponível, senão usar o length do array
          const jsonTotalHolders = typeof publicData.total_holders === 'number' 
            ? publicData.total_holders 
            : publicData.holders.length
          console.log(`📊 [JSON] total_holders do JSON: ${publicData.total_holders}, holders.length: ${publicData.holders.length}, usando: ${jsonTotalHolders}`)
          setBitcoinHolders(jsonTotalHolders) // Atualizar holders do Bitcoin (sempre do JSON)
          setTotalHoldersFromJSON(jsonTotalHolders)
          // Também atualizar totalHolders para manter consistência (se o JSON tem o valor correto)
          if (jsonTotalHolders > 0 && jsonTotalHolders !== totalHolders) {
            console.log(`🔄 Atualizando totalHolders de ${totalHolders} para ${jsonTotalHolders} (do JSON)`)
            setTotalHolders(jsonTotalHolders)
          }
          setLoadingChart(false)
          return // Sucesso, sair da função imediatamente
        }
      }

      // Se chegou aqui, o JSON não foi carregado - não há fallback, apenas erro
      console.error('❌ Falha ao carregar JSON de holders para o gráfico')
    } catch (error) {
      console.error('Error loading all holders for chart:', error)
    } finally {
      setLoadingChart(false)
    }
  }

  // Carregar dados do gráfico apenas se não foram carregados junto com a lista
  useEffect(() => {
    // Se ainda não temos os dados do gráfico após carregar a lista, tentar carregar agora
    // Mas só se realmente não temos dados (após um pequeno delay para dar tempo da lista carregar)
    if (allHoldersForChart.length === 0 && !loading) {
      const timer = setTimeout(() => {
        loadAllHoldersForChart()
      }, 100) // Pequeno delay para ver se a lista já carregou os dados
      return () => clearTimeout(timer)
    }
  }, [loading, allHoldersForChart.length]) // Verificar quando o loading da lista terminar e quando allHoldersForChart mudar

  // Carregar outros dados em paralelo (não bloqueia o gráfico)
  useEffect(() => {
    Promise.all([
      loadStats(),
      calculateNewHolders24h()
    ]).catch(error => {
      console.error('Error loading initial data:', error)
    })
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

  // Busca dinâmica por nome ou endereço
  const searchByNameOrAddress = (query: string): Array<{address: string, name: string, logo?: string}> => {
    if (!query || query.trim().length === 0) return []
    
    const queryLower = query.toLowerCase().trim()
    const suggestions: Array<{address: string, name: string, logo?: string}> = []
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 0)
    
    // Buscar em carteiras verificadas por nome (prioridade)
    if (verifiedData?.verified) {
      Object.entries(verifiedData.verified).forEach(([address, verified]) => {
        if (verified.name) {
          const nameLower = verified.name.toLowerCase()
          let matches = false
          
          // Remove espaços e caracteres especiais para busca contínua (primeiro, mais eficiente)
          const nameClean = nameLower.replace(/[^a-z0-9]/g, '')
          const queryClean = queryLower.replace(/[^a-z0-9]/g, '')
          
          // Busca contínua (ex: "dogdata" encontra "DogData Treasury")
          if (nameClean.includes(queryClean) || queryClean.includes(nameClean)) {
            matches = true
          }
          // Busca exata ou parcial (com espaços)
          else if (nameLower.includes(queryLower) || queryLower.includes(nameLower)) {
            matches = true
          }
          // Busca por palavras (ex: "dog of" encontra "Dog of Bitcoin")
          else if (queryWords.length > 0) {
            const nameWords = nameLower.split(/\s+/)
            matches = queryWords.some(qWord => {
              // Busca direta por palavra
              if (nameLower.includes(qWord)) return true
              // Busca por parte da palavra (ex: "dogdata" encontra "DogData")
              return nameWords.some(nWord => {
                const nWordClean = nWord.replace(/[^a-z0-9]/g, '') // Remove caracteres especiais
                const qWordClean = qWord.replace(/[^a-z0-9]/g, '')
                return nWordClean.includes(qWordClean) || qWordClean.includes(nWordClean)
              })
            })
          }
          
          if (matches) {
            suggestions.push({
              address,
              name: verified.name,
              logo: verified.logo
            })
          }
        }
      })
    }
    
    // Buscar por endereço (parcial) - apenas se tiver pelo menos 4 caracteres
    if (queryLower.length >= 4) {
      // Primeiro, buscar em carteiras verificadas (prioridade)
      if (verifiedData?.verified) {
        Object.entries(verifiedData.verified).forEach(([addr, verified]) => {
          if (addr.toLowerCase().includes(queryLower)) {
            // Só adiciona se não estiver já na lista
            if (!suggestions.find(s => s.address === addr)) {
              suggestions.push({
                address: addr,
                name: verified.name || addr.substring(0, 12) + '...',
                logo: verified.logo
              })
            }
          }
        })
      }
      
      // Depois, buscar nos holders (limitado para performance, mas prioriza verificadas)
      if (allHolders.length > 0) {
        // Se a query parece ser um endereço completo ou quase completo, buscar em todos
        const isFullAddress = queryLower.length >= 20
        const holdersToSearch = isFullAddress ? allHolders : allHolders.slice(0, 100)
        
        holdersToSearch.forEach(holder => {
          if (holder.address.toLowerCase().includes(queryLower)) {
            // Só adiciona se não estiver já na lista
            if (!suggestions.find(s => s.address === holder.address)) {
              const verified = verifiedData?.verified?.[holder.address]
              suggestions.push({
                address: holder.address,
                name: verified?.name || holder.address.substring(0, 12) + '...',
                logo: verified?.logo
              })
            }
          }
        })
      }
    }
    
    // Ordenar: primeiro por nome (carteiras verificadas), depois por endereço
    suggestions.sort((a, b) => {
      const aHasLogo = !!a.logo
      const bHasLogo = !!b.logo
      if (aHasLogo && !bHasLogo) return -1
      if (!aHasLogo && bHasLogo) return 1
      return a.name.localeCompare(b.name)
    })
    
    // Remover duplicatas e limitar a 10 sugestões
    const unique = suggestions.filter((item, index, self) => 
      index === self.findIndex(t => t.address === item.address)
    )
    
    return unique.slice(0, 10)
  };

  // Busca dinâmica enquanto digita (com debounce)
  useEffect(() => {
    if (searchAddress.trim().length === 0) {
      setSearchSuggestions([])
      setShowSuggestions(false)
      return
    }
    
    // Debounce: aguarda 150ms após parar de digitar
    const timeoutId = setTimeout(() => {
      const suggestions = searchByNameOrAddress(searchAddress)
      setSearchSuggestions(suggestions)
      setShowSuggestions(suggestions.length > 0)
    }, 150)
    
    return () => clearTimeout(timeoutId)
  }, [searchAddress, verifiedData, allHolders])

  const fetchHolderDetails = async (address: string): Promise<HolderSearchResult | null> => {
    try {
      const timestamp = Date.now()
      const jsonResponse = await fetch(`/data/dog_holders_by_address.json?_t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        }
      })
      
      if (!jsonResponse.ok) {
        throw new Error(`Failed to load holders JSON: ${jsonResponse.status}`)
      }
      
      const jsonData = await jsonResponse.json()
      
      if (!jsonData.holders || !Array.isArray(jsonData.holders)) {
        throw new Error('Invalid JSON format')
      }
      
      const addressLower = address.toLowerCase()
      const holder = jsonData.holders.find((h: Holder) => 
        h.address && h.address.toLowerCase() === addressLower
      )
      
      if (holder) {
        const holderWithAirdrop = {
          ...holder,
          is_airdrop_recipient: airdropRecipients.has(holder.address),
        }
        
        if (holderWithAirdrop.is_airdrop_recipient) {
          try {
            const airdropResponse = await fetch(`/data/airdrop_recipients.json`)
            if (airdropResponse.ok) {
              const airdropData = await airdropResponse.json()
              const airdropRecipient = airdropData.recipients?.find((r: any) => 
                r.address.toLowerCase() === holder.address.toLowerCase()
              )
              if (airdropRecipient) {
                holderWithAirdrop.airdrop_amount = airdropRecipient.airdrop_amount
              }
            }
          } catch (err) {
            console.error('Error fetching airdrop data:', err)
          }
        }
        
        return holderWithAirdrop
      }
      return null
    } catch (error) {
      console.error('Error fetching holder details:', error)
      return null
    }
  };

  const toggleHolderExpansion = async (holderAddress: string) => {
    if (expandedAddress === holderAddress) {
      // Se já está expandido, fecha
      setExpandedAddress(null)
      setExpandedHolder(null)
    } else {
      // Busca e expande
      setExpandedAddress(holderAddress)
      const details = await fetchHolderDetails(holderAddress)
      setExpandedHolder(details)
    }
  };

  const searchHolderByAddress = async (addressToSearch?: string | any) => {
    // Garantir que sempre seja uma string
    let address: string
    if (addressToSearch !== undefined && addressToSearch !== null) {
      address = String(addressToSearch).trim()
    } else if (searchAddress) {
      address = String(searchAddress).trim()
    } else {
      return
    }
    
    if (!address) return
    
    // Se não parece um endereço Bitcoin, tentar buscar por nome
    const isAddress = address.startsWith('bc1') || address.startsWith('1') || address.startsWith('3') || address.length > 20
    if (!isAddress) {
      // Buscar por nome nas carteiras verificadas
      if (verifiedData?.verified) {
        const searchLower = address.toLowerCase()
        const queryWords = searchLower.split(/\s+/).filter(w => w.length > 0)
        
        const found = Object.entries(verifiedData.verified).find(([addr, verified]) => {
          if (!verified.name) return false
          const nameLower = verified.name.toLowerCase()
          
          // Remove espaços e caracteres especiais para busca contínua (primeiro, mais eficiente)
          const nameClean = nameLower.replace(/[^a-z0-9]/g, '')
          const searchClean = searchLower.replace(/[^a-z0-9]/g, '')
          
          // Busca contínua (ex: "dogdata" encontra "DogData Treasury")
          if (nameClean.includes(searchClean) || searchClean.includes(nameClean)) {
            return true
          }
          // Busca exata ou parcial (com espaços)
          if (nameLower.includes(searchLower) || searchLower.includes(nameLower)) {
            return true
          }
          // Busca por palavras (ex: "dog of" encontra "Dog of Bitcoin")
          if (queryWords.length > 0) {
            const nameWords = nameLower.split(/\s+/)
            return queryWords.some(qWord => {
              // Busca direta por palavra
              if (nameLower.includes(qWord)) return true
              // Busca por parte da palavra (ex: "dogdata" encontra "DogData")
              return nameWords.some(nWord => {
                const nWordClean = nWord.replace(/[^a-z0-9]/g, '') // Remove caracteres especiais
                const qWordClean = qWord.replace(/[^a-z0-9]/g, '')
                return nWordClean.includes(qWordClean) || qWordClean.includes(nWordClean) || nWord.startsWith(qWord)
              })
            })
          }
          return false
        })
        
        if (found) {
          address = found[0] // Usar o endereço encontrado
          setSearchAddress(address) // Atualizar o campo de busca
        } else {
          // Se não encontrou por nome, tentar buscar nas sugestões
          const suggestions = searchByNameOrAddress(address)
          if (suggestions.length > 0) {
            address = suggestions[0].address
            setSearchAddress(address)
          } else {
            alert(`No wallet found for "${address}"`)
            return
          }
        }
      }
    }
    
    try {
      setLoading(true)
      const holderDetails = await fetchHolderDetails(address)
      
      if (holderDetails) {
        setSearchResult(holderDetails)
        setHoldersMetadata({
          divisibility: 5,
          updatedAt: new Date().toISOString(),
          source: 'json',
        })
        setShowSuggestions(false)
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


  // Não bloquear a renderização da página inteira enquanto carrega
  // Mostrar loading apenas se não temos nenhum dado ainda
  if (loading && allHolders.length === 0 && totalHolders === 0) {
    return <LoadingScreen message="Loading DOG holders..." />
  }

  return (
    <Layout currentPage="holders" setCurrentPage={() => {}}>
      <div className="pt-2 pb-3 px-3 md:p-6 space-y-3 md:space-y-6">
      {/* Header */}
      <div className="text-center space-y-2 md:space-y-4">
        <h1 className="text-2xl md:text-4xl font-bold text-lava-dark font-display flex items-center justify-center">
          <Users className="w-8 h-8 md:w-10 md:h-10 mr-3 md:mr-4 text-lava" />
          DOG Holders
        </h1>
        <p className="text-dusty font-mono text-base md:text-lg">
          Complete holder database with real-time updates
        </p>
        {(resolvedLastUpdate) && (
          <p className="text-dusty/70 font-mono text-sm">
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

      {/* Distribution Chart - Sempre mostrar, com loading ou dados */}
      <Card variant="glass" className="border-lava/20 hover:border-lava/40 transition-all">
        <CardHeader>
          <CardTitle className="text-lava text-xl font-display uppercase tracking-[0.3em] flex items-center">
            <BarChart3 className="w-6 h-6 mr-3 text-lava" />
            Address Holdings Distribution
          </CardTitle>
          <p className="text-dusty/70 text-xs font-mono mt-2">
            Total Holders: {(bitcoinHolders + solanaHolders + stacksHolders).toLocaleString('en-US')} 
            {' '}(Bitcoin: {bitcoinHolders.toLocaleString('en-US')}, Solana: {solanaHolders.toLocaleString('en-US')}, Stacks: {stacksHolders.toLocaleString('en-US')})
          </p>
        </CardHeader>
        <CardContent>
          {loadingChart || allHoldersForChart.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lava mx-auto mb-4"></div>
                <p className="text-dusty font-mono text-sm">Loading distribution data...</p>
                <p className="text-dusty/70 font-mono text-xs mt-2">
                  {loadingChart ? 'Loading chart...' : `Waiting for data... (${allHoldersForChart.length} holders)`}
                </p>
              </div>
            </div>
          ) : (
            <HoldersDistributionChart 
              allHolders={allHoldersForChart} 
              totalSupply={circulatingSupply || undefined} 
            />
          )}
        </CardContent>
      </Card>

      {/* Top 100 Whales Movement */}
      {allHoldersForChart.length > 0 && (
        <Top100WhalesMovement allHolders={allHoldersForChart} />
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <Card variant="glass" className="stagger-item border-lava/20 hover:border-lava/40 transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lava text-xs font-mono uppercase tracking-[0.3em]">
              <Users className="w-4 h-4" />
              Total Holders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-orange-500 bg-clip-text text-transparent font-mono">
                {(bitcoinHolders + solanaHolders + stacksHolders).toLocaleString('en-US')}
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <Image src="/BTC.png" alt="Bitcoin" width={12} height={12} className="opacity-70" />
                    <span className="text-dusty font-mono">Bitcoin L1</span>
                  </div>
                  <span className="text-snow/80 font-mono">{bitcoinHolders.toLocaleString('en-US')}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <Image src="/sol.png" alt="Solana" width={12} height={12} className="opacity-70" />
                    <span className="text-dusty font-mono">Solana</span>
                  </div>
                  <span className="text-snow/80 font-mono">{solanaHolders.toLocaleString('en-US')}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <Image src="/STX .png" alt="Stacks" width={12} height={12} className="opacity-70" />
                    <span className="text-dusty font-mono">Stacks</span>
                  </div>
                  <span className="text-snow/80 font-mono">{stacksHolders.toLocaleString('en-US')}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="glass" className="stagger-item border-yellow-500/20 hover:border-yellow-500/40 transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-yellow-300 text-xs font-mono uppercase tracking-[0.3em]">
              <Sparkles className="w-4 h-4" />
              New Holders (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold bg-gradient-to-r from-yellow-400 to-yellow-500 bg-clip-text text-transparent font-mono">
              {newHolders24h != null ? newHolders24h.toLocaleString('en-US') : '—'}
            </div>
            <p className="text-dusty/70 text-xs font-mono mt-1 uppercase tracking-wide">
              New wallets in last 24h
            </p>
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
      <Card variant="glass" className="overflow-visible" style={{ position: 'relative', zIndex: 1000, isolation: 'isolate' }}>
        <CardContent className="p-6 overflow-visible">
          <div className="flex flex-col gap-4">
            {/* Search by Address or Name with Autocomplete */}
            <div className="relative flex gap-2" style={{ position: 'relative', zIndex: 1001 }}>
              <div className="flex-1 relative" style={{ position: 'relative', zIndex: 1002 }}>
                <Input
                  ref={searchInputRef}
                  placeholder="Search by address or name (e.g., Bitget, DotSwap, Dog of Bitcoin, Gate.io...)"
                  value={searchAddress}
                  onChange={(e) => {
                    setSearchAddress(e.target.value)
                    setShowSuggestions(true)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (searchSuggestions.length > 0) {
                        // Se tem sugestões, usa a primeira
                        const firstSuggestion = searchSuggestions[0]
                        const address = firstSuggestion?.address ? String(firstSuggestion.address) : ''
                        if (address) {
                          setSearchAddress(address)
                          searchHolderByAddress(address)
                          setShowSuggestions(false)
                        }
                      } else {
                        searchHolderByAddress()
                        setShowSuggestions(false)
                      }
                    } else if (e.key === 'Escape') {
                      setShowSuggestions(false)
                      searchInputRef.current?.blur()
                    }
                  }}
                  onFocus={() => {
                    if (searchSuggestions.length > 0) {
                      setShowSuggestions(true)
                    }
                  }}
                  onBlur={(e) => {
                    // Delay para permitir clique nas sugestões
                    // Verifica se o foco está indo para um elemento dentro do dropdown
                    const relatedTarget = e.relatedTarget as HTMLElement
                    if (!relatedTarget || !relatedTarget.closest('.suggestions-dropdown')) {
                      setTimeout(() => setShowSuggestions(false), 200)
                    }
                  }}
                  className="flex-1 bg-transparent border-lava-dark/15/50 text-snow"
                />
                
                {/* Dropdown de Sugestões */}
                {showSuggestions && searchSuggestions.length > 0 && (
                  <div className="suggestions-dropdown absolute w-full mt-2 bg-surface border border-lava-dark/20 shadow-xl max-h-80 overflow-y-auto" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10000, isolation: 'isolate' }}>
                    {searchSuggestions.map((suggestion, idx) => (
                      <div
                        key={suggestion.address}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-surface/50 hover:border-l-2 hover:border-l-lava cursor-pointer transition-all duration-200 border-b border-gray-800/50 last:border-b-0"
                        onMouseDown={(e) => {
                          e.preventDefault() // Previne o blur do input
                          const address = suggestion?.address ? String(suggestion.address) : ''
                          if (address) {
                            setSearchAddress(address)
                            searchHolderByAddress(address)
                            setShowSuggestions(false)
                          }
                        }}
                      >
                        {suggestion.logo ? (
                          <div className="relative w-10 h-10 overflow-hidden bg-surface/50 border border-lava-dark/20 flex items-center justify-center shrink-0">
                            <Image
                              src={suggestion.logo}
                              alt={suggestion.name}
                              width={32}
                              height={32}
                              className="object-contain p-1.5"
                            />
                          </div>
                        ) : (
                          <div className="w-10 h-10 bg-surface/50 border border-lava-dark/20 flex items-center justify-center shrink-0">
                            <span className="text-dusty text-xs font-mono font-bold">?</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-snow font-mono text-sm">{suggestion.name}</div>
                          <div className="text-dusty text-xs font-mono truncate mt-0.5">{suggestion.address}</div>
                        </div>
                        <Search className="w-4 h-4 text-dusty/70 shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Button onClick={() => searchHolderByAddress()} className="btn-sharp">
                <Search className="w-4 h-4 mr-2" />
                Search
              </Button>
            </div>
            
            {/* Search Result */}
            {searchResult && (
              <div className="mt-4 p-6 bg-transparent border border-lava-dark/20">
                <div className="space-y-6">
                  {/* Identificação da Carteira */}
                  {(() => {
                    const verified = getVerified(searchResult.address)
                    if (verified && verified.type === 'official' && verified.logo) {
                      return (
                        <div className="flex items-center gap-4 p-4 bg-transparent border border-lava-dark/20">
                          <div className="relative w-16 h-16 overflow-hidden bg-transparent border border-lava-dark/20 flex items-center justify-center shrink-0">
                            <Image
                              src={verified.logo}
                              alt={verified.name || 'Verified'}
                              width={56}
                              height={56}
                              className="object-contain p-2"
                            />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xl font-mono font-bold text-snow">{verified.name}</span>
                              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs font-mono">
                                VERIFIED
                              </Badge>
                            </div>
                            {verified.website && (
                              <a
                                href={verified.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-lava hover:text-lava-light transition-colors font-mono"
                              >
                                {verified.website}
                              </a>
                            )}
                            {verified.description && (
                              <p className="text-xs text-dusty mt-1 font-mono">{verified.description}</p>
                            )}
                          </div>
                        </div>
                      )
                    }
                    return null
                  })()}

                  {/* Detalhes do Holder */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-dusty text-sm mb-1 font-mono">Address</p>
                      <div className="flex items-center gap-2">
                        <code className="text-lava text-xs break-all font-mono">{searchResult.address}</code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(searchResult.address)}
                          className="p-1 h-6 w-6"
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <p className="text-dusty text-sm mb-1 font-mono">Rank</p>
                      <p className="text-snow font-mono font-bold">#{searchResult.rank.toLocaleString('en-US')}</p>
                    </div>
                    <div>
                      <p className="text-dusty text-sm mb-1 font-mono">DOG Balance</p>
                      <p className="text-snow font-mono font-bold">{formatNumber(searchResult.total_dog)} DOG</p>
                    </div>
                    <div>
                      <p className="text-dusty text-sm mb-1 font-mono">UTXOs</p>
                      <p className="text-snow font-mono">{searchResult.utxo_count != null ? searchResult.utxo_count : '—'}</p>
                    </div>
                    {searchResult.available_dog != null && (
                      <div>
                        <p className="text-dusty text-sm mb-1 font-mono">Available DOG</p>
                        <p className="text-snow font-mono">{formatNumber(searchResult.available_dog)} DOG</p>
                      </div>
                    )}
                    {searchResult.projected_dog != null && (
                      <div>
                        <p className="text-dusty text-sm mb-1 font-mono">Projected DOG</p>
                        <p className="text-snow font-mono">{formatNumber(searchResult.projected_dog)} DOG</p>
                      </div>
                    )}
                    {searchResult.is_airdrop_recipient && (
                      <>
                        <div>
                          <p className="text-dusty text-sm mb-1 font-mono">Airdrop Recipient</p>
                          <Badge variant="success" className="bg-green-500/20 text-green-400 border-green-500/30 font-mono">
                            YES
                          </Badge>
                        </div>
                        {searchResult.airdrop_amount && (
                          <div>
                            <p className="text-dusty text-sm mb-1 font-mono">Airdrop Amount</p>
                            <p className="text-snow font-mono">{formatNumber(searchResult.airdrop_amount)} DOG</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
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
      <Card variant="glass" style={{ position: 'relative', zIndex: 1 }}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-snow text-xl font-mono">Holders List</CardTitle>
            <div className="flex items-center gap-2 text-green-400 font-mono text-xs">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              LIVE
            </div>
          </div>
          {loading && (
            <p className="text-dusty/70 font-mono text-xs mt-1">Loading latest holder data…</p>
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-lava-dark/15/50">
                  <th className="text-left py-3 px-4 text-lava font-mono text-xs uppercase tracking-[0.25em]">Address</th>
                  <th className="text-right py-3 px-4 text-lava font-mono text-xs uppercase tracking-[0.25em]">DOG Balance</th>
                  <th className="text-center py-3 px-4 text-lava font-mono text-xs uppercase tracking-[0.25em]">UTXOs</th>
                  <th className="text-center py-3 px-4 text-lava font-mono text-xs uppercase tracking-[0.25em]">Airdrop</th>
                  <th className="text-center py-3 px-4 text-lava font-mono text-xs uppercase tracking-[0.25em]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allHolders.map((holder, index) => (
                  <React.Fragment key={holder.address}>
                  <tr 
                    className={`table-row cursor-pointer hover:bg-orange-500/5 transition-colors ${expandedAddress === holder.address ? 'bg-orange-500/10' : ''}`}
                    onClick={() => toggleHolderExpansion(holder.address)}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-lava/20 text-lava-light border-lava/40 font-mono text-[10px] uppercase tracking-wide">
                          Rank #{holder.rank.toLocaleString('en-US')}
                        </Badge>
                        <code 
                          className="text-cyan-400 text-xs cursor-pointer hover:text-cyan-300 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleHolderExpansion(holder.address)
                          }}
                        >
                          {holder.address}
                        </code>
                        <AddressBadge address={holder.address} size="sm" showName={false} />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation()
                            copyToClipboard(holder.address)
                          }}
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
                          onClick={(e) => {
                            e.stopPropagation()
                            window.open(`https://mempool.space/address/${holder.address}`, '_blank')
                          }}
                          className="p-1 h-6 w-6"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="font-mono text-sm text-lava-light">
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
                        <Badge variant="outline" className="border-dusty/30 text-dusty/70">
                          ...
                        </Badge>
                      ) : airdropRecipients.has(holder.address) ? (
                        <Badge variant="success" className="bg-green-500/20 text-green-400 border-green-500/30">
                          YES
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-gray-500/50 text-dusty">
                          NO
                        </Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-xs text-dusty">
                        {expandedAddress === holder.address ? '▼' : '▶'}
                      </span>
                    </td>
                  </tr>
                  {expandedAddress === holder.address && expandedHolder && (
                    <tr className="bg-transparent border-t border-lava-dark/15/30">
                      <td colSpan={5} className="p-6">
                        <div className="space-y-6">
                          {/* Identificação Melhorada */}
                          {(() => {
                            const verified = getVerified(expandedHolder.address)
                            if (verified && verified.type === 'official' && verified.logo) {
                              return (
                                <div className="flex items-center gap-4 p-4 bg-transparent border border-lava-dark/20">
                                  <div className="relative w-16 h-16 overflow-hidden bg-transparent border border-lava-dark/20 flex items-center justify-center shrink-0">
                                    <Image
                                      src={verified.logo}
                                      alt={verified.name || 'Verified'}
                                      width={56}
                                      height={56}
                                      className="object-contain p-2"
                                    />
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-xl font-mono font-bold text-snow">{verified.name}</span>
                                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs font-mono">
                                        VERIFIED
                                      </Badge>
                                    </div>
                                    {verified.website && (
                                      <a 
                                        href={verified.website} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-sm text-lava hover:text-lava-light transition-colors font-mono"
                                      >
                                        {verified.website}
                                      </a>
                                    )}
                                    {verified.description && (
                                      <p className="text-xs text-dusty mt-1 font-mono">{verified.description}</p>
                                    )}
                                  </div>
                                </div>
                              )
                            }
                            return null
                          })()}
                          
                          {/* Detalhes do Holder */}
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div>
                              <p className="text-dusty text-sm mb-1 font-mono">Address</p>
                              <div className="flex items-center gap-2">
                                <code className="text-lava text-xs break-all font-mono">{expandedHolder.address}</code>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => copyToClipboard(expandedHolder.address)}
                                  className="p-1 h-6 w-6"
                                >
                                  <Copy className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                            <div>
                              <p className="text-dusty text-sm mb-1 font-mono">Rank</p>
                              <p className="text-snow font-mono font-bold">#{expandedHolder.rank.toLocaleString('en-US')}</p>
                            </div>
                            <div>
                              <p className="text-dusty text-sm mb-1 font-mono">DOG Balance</p>
                              <p className="text-snow font-mono font-bold">{formatNumber(expandedHolder.total_dog)} DOG</p>
                            </div>
                            <div>
                              <p className="text-dusty text-sm mb-1 font-mono">UTXOs</p>
                              <p className="text-snow font-mono">{expandedHolder.utxo_count != null ? expandedHolder.utxo_count : '—'}</p>
                            </div>
                            {expandedHolder.available_dog != null && (
                              <div>
                                <p className="text-dusty text-sm mb-1 font-mono">Available DOG</p>
                                <p className="text-snow font-mono">{formatNumber(expandedHolder.available_dog)} DOG</p>
                              </div>
                            )}
                            {expandedHolder.projected_dog != null && (
                              <div>
                                <p className="text-dusty text-sm mb-1 font-mono">Projected DOG</p>
                                <p className="text-snow font-mono">{formatNumber(expandedHolder.projected_dog)} DOG</p>
                              </div>
                            )}
                            {expandedHolder.is_airdrop_recipient && (
                              <>
                                <div>
                                  <p className="text-dusty text-sm mb-1 font-mono">Airdrop Recipient</p>
                                  <Badge variant="success" className="bg-green-500/20 text-green-400 border-green-500/30 font-mono">
                                    YES
                                  </Badge>
                                </div>
                                {expandedHolder.airdrop_amount && (
                                  <div>
                                    <p className="text-dusty text-sm mb-1 font-mono">Airdrop Amount</p>
                                    <p className="text-snow font-mono">{formatNumber(expandedHolder.airdrop_amount)} DOG</p>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
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
                    <span className="px-2 py-1 text-dusty">
                      <MoreHorizontal className="w-4 h-4" />
                    </span>
                  ) : (
                    <Button
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(page as number)}
                      className={`btn-sharp ${
                        currentPage === page 
                          ? 'bg-dog-orange text-snow border-dog-orange' 
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
                <span className="text-dusty text-sm font-mono">Go to</span>
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
                <span className="text-dusty text-sm font-mono">Page</span>
              </div>
            </div>
          </div>
      </div>
    </Layout>
  )
}

