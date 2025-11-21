"use client"

import { useState, useEffect, useRef, useCallback, Fragment } from "react"
import Image from "next/image"
import { Layout } from "@/components/layout"
import { LoadingScreen } from "@/components/loading-screen"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { SectionDivider } from "@/components/ui/section-divider"
import { 
  Activity, 
  AlertCircle,
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  Bell,
  Bolt,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  BarChart3,
  Clock, 
  Coins,
  Database,
  Download,
  ExternalLink,
  Eye,
  Filter,
  HardDriveDownload,
  History,
  Info,
  Layers,
  LineChart,
  ListFilter,
  Loader2,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  TimerReset,
  TrendingUp,
  TriangleAlert,
  Truck,
  Upload,
  Users,
  Zap
} from "lucide-react"
import { AddressBadge } from "@/components/address-badge"

interface Sender {
  address: string;
  input: string;
  amount?: number;
  amount_dog?: number;
  has_dog?: boolean;
}

interface Receiver {
  address: string;
  vout: number;
  amount: number;
  amount_dog: number;
  is_change?: boolean;  // Flag para indicar troco
}

interface Transaction {
  txid: string;
  block_height: number;
  timestamp: string | number;  // Unix timestamp (number) ou ISO string
  type?: string;
  senders: Sender[];
  receivers: Receiver[];
  total_dog_moved: number;
  net_transfer?: number;      // Valor líquido enviado para OUTROS
  change_amount?: number;      // Valor de troco
  has_change?: boolean;        // Tem troco?
  sender_count: number;
  receiver_count: number;
  fee_sats?: number;
}

interface TransactionsData {
  timestamp: string;
  total_transactions: number;
  last_block: number;
  last_update: string;
  transactions: Transaction[];
  metrics?: {
    last24h?: {
      txCount: number;
      totalDogMoved: number;
      blockCount: number;
      avgTxPerBlock: number;
      avgDogPerTx: number;
      activeWalletCount: number;
      volumeWalletCount: number;
      topActiveWallet?: { address: string; txCount: number; holderRank?: number | null } | null;
      topVolumeWallet?: { address: string; dogMoved: number; direction: 'IN' | 'OUT'; holderRank?: number | null } | null;
      topOutWallet?: { address: string; dogMoved: number; holderRank?: number | null } | null;
      topInWallet?: { address: string; dogMoved: number; holderRank?: number | null } | null;
      topOutWallets?: { address: string; dogMoved: number; rank: number; holderRank?: number | null }[];
      topInWallets?: { address: string; dogMoved: number; rank: number; holderRank?: number | null }[];
      feesSats?: number;
      feesBtc?: number;
    };
  };
}

type MetricsLast24h = NonNullable<NonNullable<TransactionsData['metrics']>['last24h']>;

type InflowEntry = { address: string; dogMoved: number; rank?: number; holderRank?: number | null };

const HOLDER_SNAPSHOT_LIMIT = 500;

const formatDOG = (amount: number) => {
  return (
    new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount) + ' DOG'
  )
}

const SATOSHIS_PER_BTC = 100_000_000

const formatBTC = (amount: number) => {
  return (
    new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 8
    }).format(amount) + ' BTC'
  )
}

const formatSats = (sats: number) => {
  return `${new Intl.NumberFormat('en-US').format(Math.round(sats))} sats`
}

const shortAddress = (address?: string) => {
  if (!address) return '—'
  if (address.length <= 12) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

// Função auxiliar para filtrar topInWallets: só incluir carteiras que ainda mantêm os tokens recebidos
// Pega mais candidatos (top 20) antes de filtrar, para garantir que temos top 5 válidas após o filtro
const filterTopInWallets = (
  wallets: Array<{ address: string; dogMoved: number; rank?: number; holderRank?: number | null }>,
  holderBalancesMap: Map<string, number>,
  targetCount: number = 5,
  candidateCount: number = 20
): Array<{ address: string; dogMoved: number; rank: number; holderRank: number | null }> => {
  // Primeiro, pegar mais candidatos (top 20) antes de filtrar
  const candidates = wallets.slice(0, candidateCount)
  
  // Filtrar candidatos: só incluir carteiras que ainda mantêm os tokens recebidos
  const filtered = candidates
    .filter((wallet) => {
      if (!wallet.address) return false
      const addressLower = wallet.address.toLowerCase()
      const currentBalance = holderBalancesMap.get(addressLower) ?? 0
      const inflow24h = wallet.dogMoved || 0
      const shouldInclude = currentBalance >= inflow24h
      
      // Debug específico para a carteira reportada
      if (addressLower === 'bc1ple4xkrptgjdm2gj5njnkgryedehg885gqtsrxvc9kzzekhnqma6qkz3kmv'.toLowerCase()) {
        console.error(`🚨 [TOP INFLOW FILTER] Carteira problemática no backend:`, {
          address: wallet.address.substring(0, 20) + '...',
          addressLower,
          currentBalance,
          inflow24h,
          shouldInclude,
          hasBalanceInMap: holderBalancesMap.has(addressLower),
          holderBalancesMapSize: holderBalancesMap.size
        })
      }
      
      return shouldInclude
    })
  
  // Pegar as top N (geralmente 5) após o filtro
  return filtered
    .slice(0, targetCount)
    .map((wallet, index) => ({
      address: wallet.address,
      dogMoved: wallet.dogMoved,
      rank: index + 1,
      holderRank: wallet.holderRank ?? null,
    }))
}

const computeMetrics24h = (
  txs: Transaction[], 
  holderRankMap: Map<string, number> = new Map(),
  holderBalancesMap: Map<string, number> = new Map() // address -> total_dog (saldo atual)
): MetricsLast24h => {
  const now = Date.now()
  const threshold = now - 24 * 60 * 60 * 1000
  const MAX_DOG_AMOUNT = 100_000_000_000 // 100 bilhões de DOG
  
  const windowTxs = txs.filter((tx) => {
    const ts = new Date(tx.timestamp).getTime()
    if (Number.isNaN(ts) || ts < threshold) return false
    
    // Filtrar transações com valores impossíveis ANTES de processar
    const volume = typeof tx.net_transfer === 'number' ? tx.net_transfer : (tx.total_dog_moved || 0)
    if (volume > MAX_DOG_AMOUNT) {
      console.warn(`⚠️ [computeMetrics24h] Ignorando TX ${tx.txid} com volume inválido: ${volume}`)
      return false
    }
    
    return true
  })

  const txCount = windowTxs.length
  let totalDog = 0
  const senderCounts = new Map<string, number>()
  const senderVolumes = new Map<string, number>()
  const receiverVolumes = new Map<string, number>()
  const activeWalletSet = new Set<string>()
  const volumeWalletSet = new Set<string>()
  const blockMap = new Map<number, { txCount: number; dog: number }>()
  let totalFeesSats = 0

  for (const tx of windowTxs) {
    const volume = typeof tx.net_transfer === 'number' ? tx.net_transfer : (tx.total_dog_moved || 0)
    
    // Validação adicional por segurança
    if (!Number.isFinite(volume) || volume < 0 || volume > MAX_DOG_AMOUNT) {
      console.warn(`⚠️ [computeMetrics24h] Pulando TX ${tx.txid} com volume inválido: ${volume}`)
      continue
    }
    
    totalDog += volume
    if (typeof tx.fee_sats === 'number' && Number.isFinite(tx.fee_sats)) {
      totalFeesSats += tx.fee_sats
    }

    blockMap.set(tx.block_height, {
      txCount: (blockMap.get(tx.block_height)?.txCount || 0) + 1,
      dog: Number(((blockMap.get(tx.block_height)?.dog || 0) + volume).toFixed(5)),
    })

    const txSenderAmounts = new Map<string, number>()
    const txSenderAddresses = new Set<string>()
    let txSenderTotal = 0

    for (const sender of tx.senders) {
      const address = sender.address
      if (!address) continue
      let amountDog = typeof sender.amount_dog === 'number'
        ? sender.amount_dog
        : Number(sender.amount_dog) || 0
      
      // Validar e limitar valores impossíveis
      if (!Number.isFinite(amountDog) || amountDog < 0 || amountDog > MAX_DOG_AMOUNT) {
        console.warn(`⚠️ [computeMetrics24h] Ignorando sender inválido na TX ${tx.txid}: ${address} = ${amountDog}`)
        amountDog = 0
      }

      txSenderAmounts.set(address, (txSenderAmounts.get(address) || 0) + amountDog)
      txSenderTotal += amountDog

      if (!txSenderAddresses.has(address)) {
        txSenderAddresses.add(address)
        activeWalletSet.add(address)
        senderCounts.set(address, (senderCounts.get(address) || 0) + 1)
      }
    }

    for (const receiver of tx.receivers) {
      if (!receiver.address || receiver.is_change) continue
      let amountDog = typeof receiver.amount_dog === 'number'
        ? receiver.amount_dog
        : Number(receiver.amount_dog) || 0
      
      // Validar e limitar valores impossíveis
      if (!Number.isFinite(amountDog) || amountDog < 0 || amountDog > MAX_DOG_AMOUNT) {
        console.warn(`⚠️ [computeMetrics24h] Ignorando receiver inválido na TX ${tx.txid}: ${receiver.address} = ${amountDog}`)
        amountDog = 0
      }
      
      receiverVolumes.set(receiver.address, (receiverVolumes.get(receiver.address) || 0) + amountDog)
      volumeWalletSet.add(receiver.address)
    }

    if (volume > 0 && volume <= MAX_DOG_AMOUNT && txSenderAddresses.size > 0) {
      if (txSenderTotal > 0 && Number.isFinite(txSenderTotal)) {
        for (const [address, amountDog] of Array.from(txSenderAmounts.entries())) {
          if (!Number.isFinite(amountDog) || amountDog < 0 || amountDog > MAX_DOG_AMOUNT) continue
          const share = (amountDog / txSenderTotal) * volume
          if (Number.isFinite(share) && share > 0 && share <= MAX_DOG_AMOUNT) {
            senderVolumes.set(address, (senderVolumes.get(address) || 0) + share)
            volumeWalletSet.add(address)
          }
        }
      } else if (txSenderAddresses.size > 0) {
        const equalShare = volume / txSenderAddresses.size
        if (Number.isFinite(equalShare) && equalShare > 0 && equalShare <= MAX_DOG_AMOUNT) {
          for (const address of Array.from(txSenderAddresses)) {
            senderVolumes.set(address, (senderVolumes.get(address) || 0) + equalShare)
            volumeWalletSet.add(address)
          }
        }
      }
    }
  }

  const blockCount = blockMap.size
  const avgTxPerBlock = blockCount > 0 ? txCount / blockCount : 0
  const avgDogPerTx = txCount > 0 ? totalDog / txCount : 0

  const topActiveEntry = Array.from(senderCounts.entries()).sort((a, b) => b[1] - a[1])[0]
  const sortedOutEntries = Array.from(senderVolumes.entries()).sort((a, b) => b[1] - a[1])
  const sortedInEntries = Array.from(receiverVolumes.entries()).sort((a, b) => b[1] - a[1])

  const topOutEntry = sortedOutEntries[0]
  
  // Filtrar topInEntry: só usar se a carteira ainda mantém os tokens
  const topInEntryFiltered = sortedInEntries
    .find(([address, inflow24h]) => {
      const addressLower = address.toLowerCase()
      const currentBalance = holderBalancesMap.get(addressLower) || 0
      const shouldInclude = currentBalance >= inflow24h
      
      // Debug: log para primeira carteira (maior inflow)
      if (sortedInEntries.indexOf([address, inflow24h]) === 0) {
        console.log(`🔍 [TOP INFLOW] Primeira carteira: ${address.substring(0, 16)}..., saldo=${currentBalance}, inflow24h=${inflow24h}, mantém=${shouldInclude}`)
      }
      
      return shouldInclude
    })
  const topInEntry = topInEntryFiltered || null

  // Função auxiliar para obter rank do Map
  const getHolderRank = (address: string): number | null => {
    return holderRankMap.get(address.toLowerCase()) || null
  }

  const topOutWallets = sortedOutEntries.slice(0, 5).map(([address, amount], index) => ({
    address,
    dogMoved: Number(amount.toFixed(5)),
    rank: index + 1,
    holderRank: getHolderRank(address),
  }))

  // Filtrar topInWallets: só incluir carteiras que ainda mantêm os tokens recebidos
  // Uma carteira deve ter saldo_atual >= inflow_24h para aparecer na lista
  // Pega top 20 candidatos antes de filtrar, para garantir top 5 válidas após o filtro
  const topInWalletsCandidates = sortedInEntries
    .slice(0, 20) // Pegar top 20 candidatos antes de filtrar
    .map(([address, amount]) => ({
      address,
      dogMoved: Number(amount.toFixed(5)),
      holderRank: getHolderRank(address),
    }))
  const topInWalletsFiltered = filterTopInWallets(topInWalletsCandidates, holderBalancesMap, 5, 20)

  const topOutWallet = topOutEntry ? { 
    address: topOutEntry[0], 
    dogMoved: Number(topOutEntry[1].toFixed(5)), 
    holderRank: getHolderRank(topOutEntry[0])
  } : null
  const topInWallet = topInEntry ? { 
    address: topInEntry[0], 
    dogMoved: Number(topInEntry[1].toFixed(5)), 
    holderRank: getHolderRank(topInEntry[0])
  } : null

  let topVolumeEntry: { address: string; dogMoved: number; direction: 'IN' | 'OUT'; holderRank: number | null } | null = null
  if (topOutEntry && (!topInEntry || topOutEntry[1] >= (topInEntry?.[1] || 0))) {
    topVolumeEntry = { 
      address: topOutEntry[0], 
      dogMoved: Number(topOutEntry[1].toFixed(5)), 
      direction: 'OUT',
      holderRank: getHolderRank(topOutEntry[0])
    }
  } else if (topInEntry) {
    topVolumeEntry = { 
      address: topInEntry[0], 
      dogMoved: Number(topInEntry[1].toFixed(5)), 
      direction: 'IN',
      holderRank: getHolderRank(topInEntry[0])
    }
  }

  const feesSats = Math.round(totalFeesSats)
  const feesBtc = Number((feesSats / SATOSHIS_PER_BTC).toFixed(8))

  return {
    txCount,
    totalDogMoved: Number(totalDog.toFixed(5)),
    blockCount,
    avgTxPerBlock: Number(avgTxPerBlock.toFixed(2)),
    avgDogPerTx: Number(avgDogPerTx.toFixed(5)),
    activeWalletCount: activeWalletSet.size,
    volumeWalletCount: volumeWalletSet.size,
    topActiveWallet: topActiveEntry ? { 
      address: topActiveEntry[0], 
      txCount: topActiveEntry[1],
      holderRank: getHolderRank(topActiveEntry[0])
    } : null,
    topVolumeWallet: topVolumeEntry,
    topOutWallet,
    topInWallet,
    topOutWallets,
    topInWallets: topInWalletsFiltered,
    feesSats,
    feesBtc,
  }
}

export default function TransactionsPage() {
  // Estado principal das transações
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false) // DESABILITADO - apenas JSON local
  const [offset, setOffset] = useState(0)
  const [metrics24h, setMetrics24h] = useState<MetricsLast24h | null>(null)
  const metricsCardClass = "stagger-item min-h-[160px] h-full border border-gray-800/60 bg-gradient-to-br from-black/40 via-dog-gray-900/30 to-black/20"
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  // Map completo de holders: address -> rank (carregado uma vez do JSON local)
  const [holderRankMap, setHolderRankMap] = useState<Map<string, number>>(new Map())
  // Map de saldos atuais: address -> total_dog (para validar se mantém tokens recebidos)
  const [holderBalancesMap, setHolderBalancesMap] = useState<Map<string, number>>(new Map())
  const [holdersLoaded, setHoldersLoaded] = useState(false)
  const [newHolders24h, setNewHolders24h] = useState<number | null>(null)
  
  // Estados auxiliares
  const [searchTxid, setSearchTxid] = useState("")
  const [searchResult, setSearchResult] = useState<Transaction | null>(null)
  const [copiedTxid, setCopiedTxid] = useState<string | null>(null)
  const [lastBlock, setLastBlock] = useState<number>(0)
  const [newTxsCount, setNewTxsCount] = useState<number>(0)
  const [showNewTxsBanner, setShowNewTxsBanner] = useState(false)
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null)
  const [autoRefresh, setAutoRefresh] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('dog_auto_refresh')
      if (stored !== null) return stored === 'true'
    }
    return true
  })

  const topInflowWallets: InflowEntry[] = metrics24h?.topInWallets?.length
    ? metrics24h.topInWallets
    : metrics24h?.topInWallet
      ? [{ ...metrics24h.topInWallet, rank: 1 }]
      : []
 
  // Ref para o IntersectionObserver
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isRefreshingRef = useRef(false)
  const lastBlockRef = useRef<number>(0)
 
  const fetchTransactionsFromCache = useCallback(async (silent = false) => {
    if (isRefreshingRef.current) {
      if (silent) {
        return
      }
      // Aguarda ciclo atual concluir antes de um refresh explícito
      while (isRefreshingRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
    }

    isRefreshingRef.current = true
    setIsRefreshing(true)

    try {
      const response = await fetch('/api/dog-rune/transactions-kv', {
        cache: silent ? 'no-store' : 'default'
      })

      let jsonData: any = null
      let source = 'kv'

      if (response.ok) {
        jsonData = await response.json()
      } else {
        console.error('❌ [KV] Response not OK:', response.status)
        source = 'fallback-json'
        try {
          const fallbackResponse = await fetch(`/data/dog_transactions.json?${Date.now()}`, {
            cache: 'no-store'
          })
          if (fallbackResponse.ok) {
            jsonData = await fallbackResponse.json()
          } else {
            console.error('❌ Fallback JSON também falhou:', fallbackResponse.status)
          }
        } catch (fallbackError: any) {
          console.error('❌ Erro ao carregar fallback JSON:', fallbackError?.message || fallbackError)
        }
      }

      if (!jsonData) {
        throw new Error('Não foi possível carregar transações do cache ou fallback')
      }

      const transactionsList: Transaction[] = Array.isArray(jsonData.transactions) ? jsonData.transactions : []

      // Filtrar transações com valores impossíveis ANTES de processar
      // Isso previne travamentos e problemas de performance
      const MAX_DOG_AMOUNT = 100_000_000_000 // 100 bilhões de DOG
      const sanitizedTransactions = transactionsList.filter((tx) => {
        const volume = typeof tx.net_transfer === 'number' ? tx.net_transfer : (tx.total_dog_moved || 0)
        if (!Number.isFinite(volume) || volume < 0 || volume > MAX_DOG_AMOUNT) {
          console.warn(`⚠️ [Frontend] Removendo TX ${tx.txid} com volume inválido: ${volume}`)
          return false
        }
        
        // Validar senders e receivers também
        const hasInvalidSender = tx.senders?.some((s: any) => {
          const amt = s.amount_dog || 0
          return !Number.isFinite(amt) || amt < 0 || amt > MAX_DOG_AMOUNT
        })
        const hasInvalidReceiver = tx.receivers?.some((r: any) => {
          const amt = r.amount_dog || 0
          return !Number.isFinite(amt) || amt < 0 || amt > MAX_DOG_AMOUNT
        })
        
        if (hasInvalidSender || hasInvalidReceiver) {
          console.warn(`⚠️ [Frontend] Removendo TX ${tx.txid} com sender/receiver inválido`)
          return false
        }
        
        return true
      })

      console.log(`✅ [Frontend] ${sanitizedTransactions.length} transações válidas (${transactionsList.length - sanitizedTransactions.length} removidas)`)
      
      setTransactions(sanitizedTransactions)
        setSelectedTransaction((prev) => {
          if (!prev) return prev
          return sanitizedTransactions.find((item) => item.txid === prev.txid) || null
        })
        const metricsSource = jsonData.metrics?.last24h
        if (metricsSource) {
          const feesSats = metricsSource.feesSats ?? 0
          const feesBtc = metricsSource.feesBtc ?? (feesSats ? Number((feesSats / SATOSHIS_PER_BTC).toFixed(8)) : 0)
          const fallbackMetrics = computeMetrics24h(sanitizedTransactions, holderRankMap, holderBalancesMap)
          const {
            txCount: fallbackTxCount,
            totalDogMoved: fallbackTotalDogMoved,
            blockCount: fallbackBlockCount,
            avgTxPerBlock: fallbackAvgTxPerBlock,
            avgDogPerTx: fallbackAvgDogPerTx,
            topActiveWallet: fallbackTopActiveWallet = null,
            topVolumeWallet: fallbackTopVolumeWallet = null,
            topOutWallet: fallbackTopOutWallet = null,
            topInWallet: fallbackTopInWallet = null,
            topOutWallets: fallbackTopOutWallets = [],
            topInWallets: fallbackTopInWallets = [],
            activeWalletCount: fallbackActiveWalletCount = 0,
            volumeWalletCount: fallbackVolumeWalletCount = 0,
          } = fallbackMetrics

          // Função auxiliar para validar e sanitizar valores de wallet
          const sanitizeWallet = (wallet: any): any | null => {
            if (!wallet || !wallet.address) return null
            const dogMoved = wallet.dogMoved || 0
            // Validar se o valor é impossível (maior que 100 bilhões)
            if (!Number.isFinite(dogMoved) || dogMoved < 0 || dogMoved > MAX_DOG_AMOUNT) {
              console.warn(`⚠️ [Frontend] Wallet ${wallet.address} com dogMoved inválido: ${dogMoved}, descartando`)
              return null
            }
            return { ...wallet, dogMoved: Number(dogMoved.toFixed(5)) }
          }

          // Validar e sanitizar arrays de wallets
          const sanitizeWalletArray = (wallets: any[]): any[] => {
            if (!Array.isArray(wallets)) return []
            return wallets.map(sanitizeWallet).filter((w): w is any => w !== null)
          }

          // Validar métricas numéricas
          const sanitizeMetric = (value: any, fallback: number, maxValue: number = MAX_DOG_AMOUNT): number => {
            const num = typeof value === 'number' ? value : Number(value) || 0
            if (!Number.isFinite(num) || num < 0 || num > maxValue) {
              console.warn(`⚠️ [Frontend] Métrica inválida: ${value}, usando fallback: ${fallback}`)
              return fallback
            }
            return num
          }

          // Filtrar topInWallet do backend: só usar se a carteira ainda mantém os tokens
          const rawTopInWallet = sanitizeWallet(metricsSource.topInWallet) ?? fallbackTopInWallet
          let sanitizedTopInWallet = rawTopInWallet
          if (rawTopInWallet && rawTopInWallet.address && holderBalancesMap.size > 0) {
            const addressLower = rawTopInWallet.address.toLowerCase()
            const currentBalance = holderBalancesMap.get(addressLower) ?? 0
            const inflow24h = rawTopInWallet.dogMoved || 0
            if (currentBalance < inflow24h) {
              // Carteira não mantém mais os tokens, usar null
              sanitizedTopInWallet = null
              console.warn(`⚠️ [TOP INFLOW] Carteira ${addressLower.substring(0, 16)}... do backend não mantém mais os tokens: saldo=${currentBalance}, inflow=${inflow24h}`)
            }
          }
          const sanitizedTopOutWallet = sanitizeWallet(metricsSource.topOutWallet) ?? fallbackTopOutWallet
          const sanitizedTopActiveWallet = metricsSource.topActiveWallet ?? fallbackTopActiveWallet
          const sanitizedTopVolumeWallet = sanitizeWallet(metricsSource.topVolumeWallet) ?? null
          
          // Sanitizar arrays
          const sanitizedTopInWallets = sanitizeWalletArray(metricsSource.topInWallets || [])
          const sanitizedTopOutWallets = sanitizeWalletArray(metricsSource.topOutWallets || [])
          
          // Filtrar topInWallets do backend: só incluir carteiras que ainda mantêm os tokens
          // Isso garante consistência mesmo quando os dados vêm do cache/backend
          // Só aplicar o filtro se o holderBalancesMap já foi carregado
          // NOTA: Quando vem do backend, já vem limitado a 5, então se alguns forem filtrados,
          // ficaremos com menos de 5. Isso será corrigido quando recalcularmos localmente.
          let filteredTopInWallets: Array<{ address: string; dogMoved: number; rank: number; holderRank: number | null }> = []
          if (holderBalancesMap.size > 0) {
            filteredTopInWallets = sanitizedTopInWallets.length > 0 
              ? filterTopInWallets(sanitizedTopInWallets, holderBalancesMap, 5, sanitizedTopInWallets.length)
              : filterTopInWallets(fallbackTopInWallets, holderBalancesMap, 5, fallbackTopInWallets.length)
          } else {
            // Se o Map ainda não foi carregado, usar dados sem filtro (será recalculado depois)
            console.warn('⚠️ [TOP INFLOW] holderBalancesMap ainda não carregado, pulando filtro temporariamente')
            filteredTopInWallets = sanitizedTopInWallets.length > 0 ? sanitizedTopInWallets : fallbackTopInWallets
          }
          
          // Usar arrays do backend se válidos, senão usar fallback
          const resolvedTopInWallets = filteredTopInWallets.length > 0 ? filteredTopInWallets : []
          const resolvedTopOutWallets = sanitizedTopOutWallets.length > 0 ? sanitizedTopOutWallets : fallbackTopOutWallets

          // Sanitizar métricas numéricas
          const resolvedTxCount = sanitizeMetric(metricsSource.txCount, fallbackTxCount, 1000000)
          const resolvedTotalDogMoved = sanitizeMetric(metricsSource.totalDogMoved, fallbackTotalDogMoved, MAX_DOG_AMOUNT)
          const resolvedAvgDogPerTx = sanitizeMetric(metricsSource.avgDogPerTx, fallbackAvgDogPerTx, MAX_DOG_AMOUNT)
          const resolvedAvgTxPerBlock = sanitizeMetric(metricsSource.avgTxPerBlock, fallbackAvgTxPerBlock, 10000)
          const resolvedActiveWalletCount = sanitizeMetric(metricsSource.activeWalletCount, fallbackActiveWalletCount, 1000000)
          const resolvedVolumeWalletCount = sanitizeMetric(metricsSource.volumeWalletCount, fallbackVolumeWalletCount, 1000000)

          setMetrics24h({
            txCount: resolvedTxCount || fallbackTxCount || 0,
            totalDogMoved: resolvedTotalDogMoved || fallbackTotalDogMoved || 0,
            blockCount: metricsSource.blockCount || fallbackBlockCount || 0,
            avgTxPerBlock: resolvedAvgTxPerBlock || fallbackAvgTxPerBlock || 0,
            avgDogPerTx: resolvedAvgDogPerTx || fallbackAvgDogPerTx || 0,
            topActiveWallet: sanitizedTopActiveWallet,
            topVolumeWallet: sanitizedTopVolumeWallet,
            topOutWallet: sanitizedTopOutWallet,
            topInWallet: sanitizedTopInWallet,
            topOutWallets: resolvedTopOutWallets,
            topInWallets: resolvedTopInWallets,
            feesSats,
            feesBtc,
            activeWalletCount: resolvedActiveWalletCount || fallbackActiveWalletCount || 0,
            volumeWalletCount: resolvedVolumeWalletCount || fallbackVolumeWalletCount || 0,
          })
        } else if (sanitizedTransactions.length > 0) {
          setMetrics24h(computeMetrics24h(sanitizedTransactions, holderRankMap, holderBalancesMap))
        }

        const nextLastBlock: number = jsonData.last_block || 0
        const prevLastBlock = lastBlockRef.current

        if (prevLastBlock && nextLastBlock > prevLastBlock) {
          const diff = nextLastBlock - prevLastBlock
          setNewTxsCount(diff)
          setShowNewTxsBanner(true)
          setTimeout(() => setShowNewTxsBanner(false), 10000)
        } else {
          setNewTxsCount(0)
          setShowNewTxsBanner(false)
        }

        setLastBlock(nextLastBlock)
        lastBlockRef.current = nextLastBlock

        const updatedAt = jsonData.last_updated ? new Date(jsonData.last_updated) : new Date()
        setLastUpdateTime(updatedAt)

        if (typeof jsonData.total_events === 'number') {
          // totalEvents removido - não é mais usado
          if (typeof window !== 'undefined') {
            localStorage.setItem('dog_total_events', String(jsonData.total_events))
            localStorage.setItem('dog_total_events_timestamp', new Date().toISOString())
          }
        }

        console.log(`✅ ${sanitizedTransactions.length} transações carregadas (${source}). Bloco ${prevLastBlock} → ${nextLastBlock}`)
    } catch (error: any) {
      console.error('❌ Error fetching transactions cache:', error.message || error)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
      isRefreshingRef.current = false
    }
  }, [])

  const loadInitialTransactions = useCallback(async () => {
    await fetchTransactionsFromCache(false)
  }, [fetchTransactionsFromCache])

  const handleManualRefresh = useCallback(() => {
    fetchTransactionsFromCache(true)
  }, [fetchTransactionsFromCache])

  const toggleAutoRefresh = useCallback(() => {
    setAutoRefresh(prev => !prev)
  }, [])
 
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('dog_auto_refresh', String(autoRefresh))
    }
  }, [autoRefresh])

  useEffect(() => {
    lastBlockRef.current = lastBlock
  }, [lastBlock])
 
  useEffect(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current)
      refreshIntervalRef.current = null
    }

    if (!autoRefresh || loading) {
      console.log('⏸️ Auto refresh desativado pelo usuário')
      return
    }

    console.log('⏱️ Auto refresh ativado (3 minutos)')
    fetchTransactionsFromCache(true)
    refreshIntervalRef.current = setInterval(() => {
      fetchTransactionsFromCache(true)
    }, 180000)

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
        refreshIntervalRef.current = null
      }
    }
  }, [autoRefresh, fetchTransactionsFromCache, loading])

  // Carregar mais transações antigas da Unisat API
  const loadMoreTransactions = useCallback(async () => {
    if (loadingMore || !hasMore) return
    
    setLoadingMore(true)
    try {
      console.log(`🔄 Carregando mais TXs, offset: ${offset}`)
      const response = await fetch(`/api/dog-rune/transactions-unisat?offset=${offset}`)
      
      if (response.ok) {
        const data = await response.json()
        
        if (data.transactions && data.transactions.length > 0) {
          setTransactions(prev => {
            // Filtrar duplicatas por TXID
            const existingIds = new Set(prev.map(tx => tx.txid))
            const newTxs = data.transactions.filter((tx: Transaction) => !existingIds.has(tx.txid))
            return [...prev, ...newTxs]
          })
          setOffset(data.nextOffset)
          setHasMore(data.hasMore)
          if (data.metrics?.last24h) {
            setMetrics24h(data.metrics.last24h)
          }
          console.log(`✅ +${data.transactions.length} novas TXs carregadas`)
        } else {
          setHasMore(false)
        }
      }
    } catch (error) {
      console.error('❌ Error loading more transactions:', error)
    } finally {
      setLoadingMore(false)
    }
  }, [offset, loadingMore, hasMore])

  // Calcular novos holders das últimas 24h
  const calculateNewHolders24h = useCallback(async () => {
    try {
      // Usar as transações já carregadas em memória (mais eficiente)
      if (transactions.length === 0) return
      
      // Buscar lista completa de holders para verificar quem já tinha DOG antes
      const holdersResponse = await fetch('/api/dog-rune/holders?page=1&limit=100000', { cache: 'no-store' })
      if (!holdersResponse.ok) {
        throw new Error(`Holders error: ${holdersResponse.status}`)
      }
      
      const holdersData = await holdersResponse.json()
      const allHoldersMap = new Map<string, boolean>()
      
      // Criar mapa de todos os holders atuais (lowercase para comparação)
      if (holdersData.holders && Array.isArray(holdersData.holders)) {
        holdersData.holders.forEach((holder: any) => {
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
  }, [transactions])

  // Carregar dados iniciais
  useEffect(() => {
    console.log('🚀 useEffect inicial executado')
    loadInitialTransactions()
  }, [loadInitialTransactions])

  // Calcular novos holders quando transações forem carregadas
  useEffect(() => {
    if (transactions.length > 0 && holdersLoaded) {
      calculateNewHolders24h()
    }
  }, [transactions.length, holdersLoaded, calculateNewHolders24h])

  // IntersectionObserver DESABILITADO - apenas JSON local (1000 TXs)
  // Se precisar de mais TXs antigas, usar a busca manual
  useEffect(() => {
    console.log('📜 Scroll infinito DESABILITADO - exibindo apenas JSON local')
  }, [])

  const HolderRankBadge = ({
    rank,
    isNewHolder = false
  }: {
    rank: number | null
    isNewHolder?: boolean
  }) => {
    // Se é new holder (não está no ranking mas recebeu DOG), mostrar "NEW"
    if (isNewHolder) {
      return (
        <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/40 font-mono text-[9px] uppercase tracking-wide min-w-[80px] flex items-center justify-center">
          <span>NEW HOLDER</span>
        </Badge>
      )
    }

    // Se tem rank, mostrar o rank
    if (rank && rank > 0) {
      return (
        <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/40 font-mono text-[9px] uppercase tracking-wide min-w-[118px] flex items-center justify-center">
          <span>Holder Rank #{rank.toLocaleString('en-US')}</span>
        </Badge>
      )
    }

    // Se não tem rank e não é new holder, não mostrar badge
    return null
  }

  // Carregar lista completa de holders do JSON local (uma vez)
  useEffect(() => {
    if (holdersLoaded) return

    const loadAllHolders = async () => {
      try {
        console.log('📥 Carregando lista completa de holders do JSON local...')
        const response = await fetch('/api/dog-rune/holders?page=1&limit=100000', {
          cache: 'default'
        })
        
        if (!response.ok) {
          console.warn('⚠️ Failed to load holders:', response.status)
          setHoldersLoaded(true)
          return
        }
        
        const data = await response.json()
        if (!Array.isArray(data?.holders)) {
          console.warn('⚠️ Invalid holders data format')
          setHoldersLoaded(true)
          return
        }

        // Criar Map para lookup rápido: address (lowercase) -> rank
        const rankMap = new Map<string, number>()
        // Criar Map de saldos atuais: address (lowercase) -> total_dog
        const balancesMap = new Map<string, number>()
        data.holders.forEach((holder: { address: string; rank?: number; total_dog?: number }) => {
          if (holder?.address) {
            const addressLower = holder.address.toLowerCase()
            if (holder?.rank) {
              rankMap.set(addressLower, holder.rank)
            }
            // Armazenar saldo atual (total_dog) para validar se mantém tokens recebidos
            if (typeof holder?.total_dog === 'number' && Number.isFinite(holder.total_dog) && holder.total_dog > 0) {
              balancesMap.set(addressLower, holder.total_dog)
            }
          }
        })

        setHolderRankMap(rankMap)
        setHolderBalancesMap(balancesMap)
        setHoldersLoaded(true)
        console.log(`✅ Lista completa de holders carregada: ${rankMap.size} holders com ranking, ${balancesMap.size} holders com saldo`)
        
        // Debug específico para a carteira reportada
        const problematicAddress = 'bc1ple4xkrptgjdm2gj5njnkgryedehg885gqtsrxvc9kzzekhnqma6qkz3kmv'.toLowerCase()
        const problematicBalance = balancesMap.get(problematicAddress)
        console.log(`🔍 [HOLDERS LOADED] Carteira problemática ${problematicAddress.substring(0, 20)}...: saldo=${problematicBalance ?? 'não encontrada'}`)
        
        // Debug: verificar se há ranks duplicados (não deveria acontecer)
        const rankCounts = new Map<number, number>()
        rankMap.forEach((rank) => {
          rankCounts.set(rank, (rankCounts.get(rank) || 0) + 1)
        })
        const duplicates = Array.from(rankCounts.entries()).filter(([_, count]) => count > 1)
        if (duplicates.length > 0) {
          console.warn(`⚠️ [HOLDERS] Encontrados ${duplicates.length} ranks duplicados:`, duplicates.slice(0, 5))
        }
      } catch (error: any) {
        console.warn('⚠️ Failed to load holders:', error)
        setHoldersLoaded(true)
      }
    }

    loadAllHolders()
  }, [holdersLoaded])

  // Recalcular métricas quando holders são carregados (para aplicar filtro de topInWallets)
  useEffect(() => {
    if (!holdersLoaded || holderBalancesMap.size === 0 || transactions.length === 0) return
    
    // Recalcular métricas locais para aplicar o filtro correto de topInWallets
    // Isso garante que mesmo se os dados vieram do backend, o filtro será aplicado corretamente
    const recalculatedMetrics = computeMetrics24h(transactions, holderRankMap, holderBalancesMap)
    
    // Atualizar métricas apenas se já temos métricas existentes (para não sobrescrever dados do backend que ainda não foram filtrados)
    setMetrics24h(prev => {
      if (!prev) return recalculatedMetrics
      
      // Usar as métricas recalculadas localmente, que têm acesso a todos os dados
      // e podem pegar top 20 candidatos antes de filtrar, garantindo top 5 válidas após o filtro
      // Isso resolve o problema de termos menos de 5 carteiras quando filtramos dados do backend
      const filteredTopInWallets = recalculatedMetrics.topInWallets || prev.topInWallets || []
      
      // Debug: verificar se a carteira problemática está sendo filtrada
      const problematicAddress = 'bc1ple4xkrptgjdm2gj5njnkgryedehg885gqtsrxvc9kzzekhnqma6qkz3kmv'.toLowerCase()
      const wasIncluded = prev.topInWallets?.some(w => w.address.toLowerCase() === problematicAddress)
      const isStillIncluded = filteredTopInWallets.some(w => w.address.toLowerCase() === problematicAddress)
      if (wasIncluded && !isStillIncluded) {
        console.log(`✅ [RECALC] Carteira problemática filtrada após holders carregados`)
      } else if (wasIncluded && isStillIncluded) {
        console.warn(`⚠️ [RECALC] Carteira problemática ainda na lista após filtro!`, filteredTopInWallets.find(w => w.address.toLowerCase() === problematicAddress))
      }
      
      console.log(`✅ [RECALC] TopInWallets recalculado: ${filteredTopInWallets.length} carteiras (objetivo: 5)`)
      
      // Usar topInWallet das métricas recalculadas (já filtrado corretamente)
      const filteredTopInWallet = recalculatedMetrics.topInWallet || prev.topInWallet
      
      return {
        ...prev,
        topInWallets: filteredTopInWallets,
        topInWallet: filteredTopInWallet,
        // Usar outros valores recalculados também para garantir consistência
        topOutWallets: recalculatedMetrics.topOutWallets || prev.topOutWallets,
        topOutWallet: recalculatedMetrics.topOutWallet || prev.topOutWallet,
        topActiveWallet: recalculatedMetrics.topActiveWallet || prev.topActiveWallet,
        topVolumeWallet: recalculatedMetrics.topVolumeWallet || prev.topVolumeWallet,
      }
    })
  }, [holdersLoaded, holderBalancesMap.size, transactions, holderRankMap])

  // Função para obter rank e detectar new holder
  // Uma carteira é "new holder" se:
  // 1. Recebeu DOG nesta transação
  // 2. NÃO está no ranking (não tinha DOG antes de nenhuma transação)
  // 3. NÃO estava nos senders desta transação (não tinha DOG antes desta transação específica)
  // IMPORTANTE: Se está no ranking, ela já tinha DOG antes, então NÃO é novo holder
  const getHolderInfo = useCallback((
    address: string | null | undefined, 
    hasReceivedDog: boolean = false,
    senderAddresses: string[] = []
  ): { rank: number | null; isNewHolder: boolean } => {
    if (!address) return { rank: null, isNewHolder: false }
    
    const addressLower = address.toLowerCase()
    const rank = holderRankMap.get(addressLower) || null
    
    // Verificar se a carteira estava nos senders (tinha DOG antes desta transação)
    const wasSender = senderAddresses.some(addr => addr.toLowerCase() === addressLower)
    
    // É "new holder" APENAS se:
    // - Recebeu DOG nesta transação
    // - NÃO está no ranking (não tinha DOG antes de nenhuma transação)
    // - NÃO estava nos senders desta transação (não tinha DOG antes desta transação específica)
    // Se está no ranking, ela já tinha DOG antes, então NÃO é novo holder
    const isNewHolder = hasReceivedDog && rank === null && !wasSender
    
    return { rank, isNewHolder }
  }, [holderRankMap])

  const renderRankBadge = useCallback(
    (address?: string | null, provided?: number | null, hasReceivedDog: boolean = false, senderAddresses: string[] = []) => {
      if (!address) return null
      
      // SEMPRE buscar do Map - esta é a fonte de verdade
      // NUNCA usar 'provided' como fallback, pois pode estar incorreto
      // Se a carteira não está no Map, ela não tem rank, mesmo que 'provided' tenha um valor
      const { rank, isNewHolder } = getHolderInfo(address, hasReceivedDog, senderAddresses)
      
      // Debug: verificar se há discrepância entre provided e rank do Map
      if (typeof provided === 'number' && provided > 0 && rank !== provided) {
        console.warn(`⚠️ [RANK] Discrepância para ${address.substring(0, 12)}...: provided=${provided}, Map=${rank}`)
      }
      
      // Usar apenas o rank do Map (se encontrado)
      // Se não encontrou no Map, a carteira não tem rank (null)
      return <HolderRankBadge rank={rank} isNewHolder={isNewHolder} />
    },
    [getHolderInfo]
  )
 
  const copyTxid = (txid: string) => {
    navigator.clipboard.writeText(txid)
    setCopiedTxid(txid)
    setTimeout(() => setCopiedTxid(null), 2000)
  }

  const clearCache = () => {
    if (confirm('Limpar cache de transações? A página será recarregada.')) {
      localStorage.removeItem('dog_gap_transactions')
      localStorage.removeItem('dog_gap_transactions_timestamp')
      localStorage.removeItem('dog_total_events')
      localStorage.removeItem('dog_total_events_timestamp')
      window.location.reload()
    }
  }

  const searchTransaction = async () => {
    if (!searchTxid.trim()) return
    
    // 1. Buscar localmente primeiro
    const tx = transactions.find(t => 
      t.txid.toLowerCase().includes(searchTxid.trim().toLowerCase())
    )
    
    if (tx) {
      setSearchResult(tx)
      return
    }
    
    // 2. Se não encontrou localmente, buscar na API
    console.log('🔍 Transação não encontrada no cache, buscando na API...')
    
    try {
      const response = await fetch(`/api/dog-rune/search-tx?txid=${searchTxid.trim()}`)
      
      if (response.ok) {
        const txData = await response.json()
        console.log('✅ Transação encontrada na API:', txData)
        setSearchResult(txData)
      } else if (response.status === 404) {
        setSearchResult(null)
        alert('❌ Transação não encontrada nem no cache nem na blockchain')
      } else {
        throw new Error(`API error: ${response.status}`)
      }
    } catch (error) {
      console.error('❌ Erro ao buscar transação:', error)
      setSearchResult(null)
      alert('❌ Erro ao buscar transação. A API pode estar lenta, tente novamente.')
    }
  }

  const handleCopyAddress = async (address?: string) => {
    if (!address) return
    try {
      await navigator.clipboard.writeText(address)
      setCopiedAddress(address)
      setTimeout(() => {
        setCopiedAddress((prev) => (prev === address ? null : prev))
      }, 2000)
    } catch (err) {
      console.warn('⚠️ Clipboard copy failed:', err)
    }
  }

  const formatTime = (timestamp: string | number) => {
    const date = typeof timestamp === 'number' ? new Date(timestamp * 1000) : new Date(timestamp)
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    const year = date.getFullYear().toString().slice(-2)
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `${month}/${day}/${year}, ${hours}:${minutes}`
  }

  const formatLastUpdate = (date: Date | null) => {
    if (!date) return 'Never'
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    const seconds = date.getSeconds().toString().padStart(2, '0')
    return `${hours}:${minutes}:${seconds}`
  }

  const renderTransactionDetails = (tx: Transaction) => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <code className="text-white text-xs break-all">{tx.txid}</code>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => copyTxid(tx.txid)}
            className="p-1 h-6 w-6"
            title="Copy transaction ID"
          >
            {copiedTxid === tx.txid ? (
              <span className="text-green-400 text-xs">✓</span>
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => window.open(`https://mempool.space/tx/${tx.txid}`, '_blank')}
            className="p-1 h-6 w-6"
            title="Open on mempool.space"
          >
            <ExternalLink className="w-3 h-3" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <p className="text-gray-400 text-sm">Block Height</p>
          <p className="text-white font-mono">{tx.block_height.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-gray-400 text-sm">Amount Sent</p>
          <p className="text-orange-400 font-mono font-bold">
            {tx.net_transfer !== undefined ? formatDOG(tx.net_transfer) : formatDOG(tx.total_dog_moved)}
          </p>
        </div>
        <div>
          <p className="text-gray-400 text-sm">Timestamp</p>
          <p className="text-white font-mono text-xs">{formatTime(tx.timestamp)}</p>
        </div>
      </div>

      {tx.has_change && tx.net_transfer !== undefined && (
        <div className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-2.5">
          <div className="flex justify-between items-center text-[11px] font-mono text-gray-500">
            <span>Change returned to sender:</span>
            <span className="text-gray-400">{formatDOG(tx.change_amount || 0)}</span>
          </div>
        </div>
      )}

      <div>
        <p className="text-gray-400 text-sm mb-2">Inputs ({tx.sender_count})</p>
        <div className="space-y-1.5">
          {tx.senders.slice(0, 5).map((sender, idx) => (
            <div key={`${sender.address}-${idx}`} className="flex items-center gap-1.5">
              <code className="text-xs text-cyan-400 break-all">
                {sender.address}
              </code>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copyTxid(sender.address)}
                className="p-0.5 h-5 w-5"
                title="Copy address"
              >
                {copiedTxid === sender.address ? (
                  <span className="text-green-400 text-xs">✓</span>
                ) : (
                  <Copy className="w-2.5 h-2.5" />
                )}
              </Button>
              <AddressBadge 
                address={sender.address} 
                size="sm" 
                showName={false} 
              />
              <span className="text-gray-400 font-mono text-xs ml-auto">
                {sender.amount_dog ? formatDOG(sender.amount_dog) : '~DOG'}
              </span>
            </div>
          ))}
          {tx.sender_count > 5 && (
            <p className="text-gray-500 text-xs pl-2">
              + {tx.sender_count - 5} more inputs
            </p>
          )}
        </div>
      </div>

      <div>
        <p className="text-gray-400 text-sm mb-2">Outputs ({tx.receiver_count})</p>
        <div className="space-y-1.5">
          {tx.receivers.map((receiver, idx) => (
            <div key={`${receiver.address}-${idx}`} className="flex items-center gap-1.5">
              <code className="text-xs text-green-400 break-all">{receiver.address}</code>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copyTxid(receiver.address)}
                className="p-0.5 h-5 w-5"
                title="Copy address"
              >
                {copiedTxid === receiver.address ? (
                  <span className="text-green-400 text-xs">✓</span>
                ) : (
                  <Copy className="w-2.5 h-2.5" />
                )}
              </Button>
              <AddressBadge 
                address={receiver.address} 
                size="sm" 
                showName={false} 
              />
              {receiver.is_change && (
                <Badge className="text-[9px] px-1 py-0 bg-purple-500/20 text-purple-400 border-purple-500/30">
                  SELF
                </Badge>
              )}
              <span className="text-orange-400 font-mono text-xs font-bold ml-auto">
                {formatDOG(receiver.amount_dog)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  if (loading) {
    return <LoadingScreen message="Loading DOG transactions..." />
  }

  return (
    <Layout currentPage="transactions" setCurrentPage={() => {}}>
      <div className="pt-2 pb-3 px-3 md:p-6 space-y-3 md:space-y-6">
        {/* Banner de Novas Transações */}
        {showNewTxsBanner && (
          <div className="mb-4 p-3 bg-gradient-to-r from-green-500/20 to-green-600/20 border border-green-500/50 rounded-lg animate-pulse">
            <div className="flex items-center justify-center gap-3">
              <span className="text-green-400 text-2xl">🆕</span>
              <p className="text-white font-mono text-sm md:text-base font-bold">
                Novas transações disponíveis!
              </p>
              <Button
                size="sm"
                onClick={() => window.location.reload()}
                className="bg-green-500 hover:bg-green-600 text-white font-mono"
              >
                🔄 Recarregar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowNewTxsBanner(false)}
                className="text-white hover:text-green-400"
              >
                ✕
              </Button>
            </div>
          </div>
        )}

      {/* Header */}
        <div className="text-center space-y-2 md:space-y-4 px-4">
          <div className="flex items-center justify-center gap-2 md:gap-4">
            <Activity className="w-10 h-10 md:w-14 md:h-14 text-orange-400" />
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white font-mono whitespace-nowrap">
          DOG Transactions
        </h1>
          </div>
          <p className="text-gray-400 font-mono text-sm md:text-lg">
            Real-time transaction tracking - Rune 840000:3
        </p>
      </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-3 gap-4 md:gap-6">
          <Card variant="glass">
            <CardHeader className="pb-3">
              <CardTitle className="text-yellow-400 flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                New Holders (24h)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white font-mono">
                {newHolders24h != null ? newHolders24h.toLocaleString('en-US') : (loading ? 'Loading...' : '—')}
              </div>
              <p className="text-gray-400 text-sm font-mono mt-2">
                New wallets in last 24 hours
              </p>
            </CardContent>
          </Card>

          <Card variant="glass">
            <CardHeader className="pb-3">
              <CardTitle className="text-cyan-400 flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Last Block Processed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white font-mono">
                {lastBlock > 0 ? lastBlock.toLocaleString() : (loading ? 'Loading...' : 'N/A')}
            </div>
              <p className="text-gray-400 text-sm font-mono mt-2">
                Most recent block scanned by our tracker
              </p>
            </CardContent>
          </Card>

          <Card variant="glass">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-purple-400 flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Last Update
            </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleManualRefresh}
                    className="h-8 w-8 text-gray-400 hover:text-purple-200"
                    title="Refresh now"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-purple-300' : ''}`} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleAutoRefresh}
                    className={`font-mono text-[11px] px-3 py-1 border ${
                      autoRefresh
                        ? 'border-purple-500/40 text-purple-200 hover:text-purple-100'
                        : 'border-gray-600 text-gray-400 hover:text-gray-300'
                    }`}
                  >
                    {autoRefresh ? 'AUTO ON' : 'AUTO OFF'}
                  </Button>
                </div>
              </div>
          </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white font-mono">
                {lastUpdateTime ? formatLastUpdate(lastUpdateTime) : 'Loading...'}
              </div>
              <p className="text-gray-400 text-sm font-mono mt-2">
                {lastUpdateTime 
                  ? `${String(lastUpdateTime.getMonth() + 1).padStart(2, '0')}/${String(lastUpdateTime.getDate()).padStart(2, '0')}/${lastUpdateTime.getFullYear()}`
                  : 'Waiting for data'}
              </p>
              <p className="text-[11px] text-gray-500 font-mono uppercase tracking-wide mt-2">
                {autoRefresh ? 'Auto refresh every 3 minutes' : 'Auto refresh disabled'}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6 mt-4">
          <Card variant="glass" className={metricsCardClass}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle variant="mono" className="text-sm text-gray-300 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-orange-400" />
                  Total Transactions (24h)
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-3xl font-bold text-white font-mono">
                  {metrics24h ? metrics24h.txCount.toLocaleString() : (loading ? 'Loading...' : 'N/A')}
              </div>
                <p className="text-gray-400 text-xs md:text-sm font-mono uppercase tracking-wide">
                  On-chain DOG transfers in the last 24 hours
                </p>
              </div>
            </CardContent>
          </Card>

          <Card variant="glass" className={metricsCardClass}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle variant="mono" className="text-sm text-gray-300 flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-400" />
                  Total Active Wallets (24h)
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-3xl font-bold text-white font-mono">
                  {metrics24h ? metrics24h.activeWalletCount.toLocaleString() : (loading ? 'Loading...' : 'N/A')}
            </div>
                <p className="text-gray-400 text-xs md:text-sm font-mono uppercase tracking-wide">
                  Unique wallets that sent or received DOG in 24 hours
                </p>
              </div>
            </CardContent>
          </Card>

          <Card variant="glass" className={metricsCardClass}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle variant="mono" className="text-sm text-gray-300 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-300" />
                  On-Chain Volume (24h)
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-3xl font-bold text-white font-mono">
                  {metrics24h ? formatDOG(metrics24h.totalDogMoved) : (loading ? 'Loading...' : 'N/A')}
                </div>
                <p className="text-gray-400 text-xs md:text-sm font-mono uppercase tracking-wide">
                  Total DOG moved on-chain in the last 24 hours
                </p>
              </div>
            </CardContent>
          </Card>

          <Card variant="glass" className={metricsCardClass}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle variant="mono" className="text-sm text-gray-300 flex items-center gap-2">
                  <Users className="w-4 h-4 text-cyan-400" />
                  Most Active Wallet (24h)
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {metrics24h?.topActiveWallet ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <AddressBadge address={metrics24h.topActiveWallet.address} size="sm" showName />
                      <code className="text-xs text-gray-300 font-mono">
                        {shortAddress(metrics24h.topActiveWallet.address)}
                      </code>
                      {renderRankBadge(
                        metrics24h.topActiveWallet.address,
                        metrics24h.topActiveWallet.holderRank,
                        false, // Não recebeu DOG (é sender)
                        [] // Não temos contexto de transação
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-gray-400 hover:text-cyan-200"
                      onClick={() => handleCopyAddress(metrics24h.topActiveWallet?.address)}
                    >
                      {copiedAddress === metrics24h.topActiveWallet.address ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <div className="text-sm text-gray-400 font-mono">
                    {metrics24h.topActiveWallet.txCount.toLocaleString()} transactions
                  </div>
                  <p className="text-[11px] text-gray-500 font-mono uppercase tracking-wide">
                    Most active among {metrics24h.activeWalletCount?.toLocaleString() || '—'} wallets
                  </p>
                </div>
              ) : (
                <p className="text-gray-500 text-sm font-mono">Not enough data</p>
              )}
            </CardContent>
          </Card>

          <Card variant="glass" className={metricsCardClass}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle variant="mono" className="text-sm text-gray-300 flex items-center gap-2">
                  <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
                  Largest DOG Inflow (24h)
                </CardTitle>
                {metrics24h?.topInWallet && (
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono tracking-wide border border-emerald-500/50 text-emerald-300 px-2 py-0.5"
                  >
                    Inflow
              </Badge>
                )}
            </div>
            </CardHeader>
            <CardContent>
              {metrics24h?.topInWallet ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <AddressBadge address={metrics24h.topInWallet.address} size="sm" showName />
                      <code className="text-xs text-gray-300 font-mono">
                        {shortAddress(metrics24h.topInWallet.address)}
                      </code>
                      {renderRankBadge(
                        metrics24h.topInWallet.address,
                        metrics24h.topInWallet.holderRank,
                        true, // hasReceivedDog = true (inflow)
                        [] // Não temos contexto de transação aqui, mas se tem rank não é new holder
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-gray-400 hover:text-emerald-200"
                      onClick={() => handleCopyAddress(metrics24h.topInWallet?.address)}
                    >
                      {copiedAddress === metrics24h.topInWallet.address ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <div className="text-sm text-gray-400 font-mono">
                    {formatDOG(metrics24h.topInWallet.dogMoved)} received
                  </div>
                  <p className="text-[11px] text-gray-500 font-mono uppercase tracking-wide">
                    Across {metrics24h.volumeWalletCount?.toLocaleString() || '—'} wallets
                  </p>
                </div>
              ) : (
                <p className="text-gray-500 text-sm font-mono">Not enough data</p>
              )}
          </CardContent>
        </Card>

          <Card variant="glass" className={metricsCardClass}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle variant="mono" className="text-sm text-gray-300 flex items-center gap-2">
                  <ArrowUpRight className="w-4 h-4 text-red-400" />
                  Largest DOG Outflow (24h)
                </CardTitle>
                {metrics24h?.topOutWallet && (
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono tracking-wide border border-red-500/50 text-red-300 px-2 py-0.5"
                  >
                    Outflow
                  </Badge>
                )}
      </div>
            </CardHeader>
            <CardContent>
              {metrics24h?.topOutWallet ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <AddressBadge address={metrics24h.topOutWallet.address} size="sm" showName />
                      <code className="text-xs text-gray-300 font-mono">
                        {shortAddress(metrics24h.topOutWallet.address)}
                      </code>
                      {renderRankBadge(
                        metrics24h.topOutWallet.address,
                        metrics24h.topOutWallet.holderRank,
                        false, // Não recebeu DOG (é sender)
                        [] // Não temos contexto de transação
                      )}
    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-gray-400 hover:text-red-200"
                      onClick={() => handleCopyAddress(metrics24h.topOutWallet?.address)}
                    >
                      {copiedAddress === metrics24h.topOutWallet.address ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <div className="text-sm text-gray-400 font-mono">
                    {formatDOG(metrics24h.topOutWallet.dogMoved)} sent out
                  </div>
                  <p className="text-[11px] text-gray-500 font-mono uppercase tracking-wide">
                    Across {metrics24h.volumeWalletCount?.toLocaleString() || '—'} wallets
                  </p>
                </div>
              ) : (
                <p className="text-gray-500 text-sm font-mono">Not enough data</p>
              )}
            </CardContent>
          </Card>

          <Card variant="glass" className={metricsCardClass}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle variant="mono" className="text-sm text-gray-300 flex items-center gap-2">
                  <Coins className="w-4 h-4 text-amber-300" />
                  Miner Fees (24h)
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-3xl font-bold text-white font-mono">
                  {metrics24h
                    ? metrics24h.feesBtc !== undefined
                      ? formatBTC(metrics24h.feesBtc)
                      : 'N/A'
                    : (loading ? 'Loading...' : 'N/A')}
                </div>
                <p className="text-gray-400 text-xs md:text-sm font-mono uppercase tracking-wide">
                  {metrics24h?.feesSats !== undefined
                    ? `${formatSats(metrics24h.feesSats)} paid to Bitcoin miners`
                    : 'Bitcoin fees generated by DOG transfers in the last 24 hours'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card variant="glass" className={metricsCardClass}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle variant="mono" className="text-sm text-gray-300 flex items-center gap-2">
                  <LineChart className="w-4 h-4 text-orange-300" />
                  Avg DOG per Tx (24h)
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-3xl font-bold text-white font-mono">
                  {metrics24h ? formatDOG(metrics24h.avgDogPerTx) : (loading ? 'Loading...' : 'N/A')}
                </div>
                <p className="text-gray-400 text-xs md:text-sm font-mono uppercase tracking-wide">
                  Average DOG moved per transaction in the last 24 hours
                </p>
              </div>
            </CardContent>
          </Card>

          <Card variant="glass" className={metricsCardClass}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle variant="mono" className="text-sm text-gray-300 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-amber-400" />
                  Avg Transactions per Block (24h)
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white font-mono">
                {metrics24h ? metrics24h.avgTxPerBlock.toFixed(2) : (loading ? 'Loading...' : '—')}
              </div>
              <p className="text-gray-400 text-xs md:text-sm font-mono">
                Across {metrics24h?.blockCount || 0} blocks
              </p>
            </CardContent>
          </Card>
        </div>

        {topInflowWallets.length > 0 && (
          <Card variant="glass" className="border border-emerald-500/20 bg-gradient-to-br from-black/40 via-emerald-900/10 to-black/10">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle variant="mono" className="text-sm text-emerald-200 flex items-center gap-2 uppercase tracking-[0.3em]">
                  <ArrowDownLeft className="w-4 h-4" />
                  Top Inflow Wallets (24h)
                </CardTitle>
                <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-400/40 font-mono text-[10px] uppercase tracking-wide">
                  {topInflowWallets.length} wallets
                </Badge>
              </div>
              <p className="text-gray-500 text-xs font-mono mt-1">
                Ranked by DOG received in the last 24 hours
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-emerald-500/20">
                      <th className="text-left py-2 px-3 text-emerald-300 font-mono text-xs uppercase tracking-[0.25em] w-16">Rank</th>
                      <th className="text-left py-2 px-3 text-emerald-300 font-mono text-xs uppercase tracking-[0.25em]">Wallet</th>
                      <th className="text-right py-2 px-3 text-emerald-300 font-mono text-xs uppercase tracking-[0.25em]">DOG Inflow</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topInflowWallets.slice(0, 5).map((wallet, index) => (
                      <tr key={wallet.address} className="border-b border-emerald-500/10 last:border-b-0">
                        <td className="py-3 px-3 font-mono text-xs text-emerald-200">
                          #{index + 1}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            {renderRankBadge(
                              wallet.address, 
                              wallet.holderRank ?? null, 
                              true, // hasReceivedDog
                              [] // Não temos contexto de transação, mas se tem rank não é new holder
                            )}
                            <code className="text-emerald-200 text-xs">
                              {shortAddress(wallet.address)}
                            </code>
                            <AddressBadge address={wallet.address} size="sm" showName={false} />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleCopyAddress(wallet.address)}
                              className="p-0.5 h-5 w-5"
                              title={copiedAddress === wallet.address ? "Copied!" : "Copy address"}
                            >
                              {copiedAddress === wallet.address ? (
                                <Check className="w-3.5 h-3.5" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </Button>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span className="font-mono text-sm text-emerald-200">
                            {formatDOG(wallet.dogMoved)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        <SectionDivider title="Transaction Search" icon={Search} />

        {/* Search */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="text-white text-xl font-mono">Search Transaction</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Enter transaction ID (txid)..."
                value={searchTxid}
                onChange={(e) => setSearchTxid(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchTransaction()}
                className="flex-1 bg-transparent border-gray-700/50 text-white"
              />
              <Button onClick={searchTransaction} className="btn-sharp">
                Search
              </Button>
            </div>

            {/* Search Result */}
            {searchResult && (
              <div className="mt-4 p-4 bg-transparent border border-orange-500/30 rounded-lg">
                {renderTransactionDetails(searchResult)}
              </div>
            )}
          </CardContent>
        </Card>

        <SectionDivider title="Recent Transactions" icon={Activity} />

        {/* Transactions List */}
        <Card variant="glass">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white text-xl font-mono">
                Transaction History
              </CardTitle>
              <div className="flex items-center gap-2 text-green-400 font-mono text-sm">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                LIVE
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="content-container">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse table-auto">
                  <thead>
                    <tr className="border-b border-gray-700/50">
                      <th className="text-left py-2 px-2 text-orange-400 font-mono text-xs w-[70px]">Block</th>
                      <th className="text-left py-2 px-2 text-orange-400 font-mono text-xs w-[180px]">From</th>
                      <th className="text-left py-2 px-2 text-orange-400 font-mono text-xs w-[180px]">To</th>
                      <th className="text-right py-2 px-2 text-orange-400 font-mono text-xs w-[130px]">DOG Moved</th>
                      <th className="text-center py-2 px-2 text-orange-400 font-mono text-xs w-[70px]">Flow</th>
                      <th className="text-left py-2 px-2 text-orange-400 font-mono text-xs w-[110px]">Time</th>
                      <th className="text-center py-2 px-2 text-orange-400 font-mono text-xs w-[120px]">TXID</th>
                    </tr>
                  </thead>
                  <tbody className="border-spacing-0">
                    {transactions.map((tx, index) => {
                      // Pegar primeiro sender (principal) e primeiro receiver
                      const mainSender = tx.senders[0]
                      const mainReceiver = tx.receivers[0]
                      const isSelected = selectedTransaction?.txid === tx.txid
                      
                      return (
                        <Fragment key={tx.txid}>
                        <tr 
                          onClick={() => setSelectedTransaction(isSelected ? null : tx)}
                          className={`table-row cursor-pointer transition-colors ${
                            isSelected ? 'bg-blue-500/10 border-y border-blue-500/20' : 'hover:bg-blue-500/5'
                          }`}
                        >
                          {/* Block Height */}
                          <td className="py-2 px-1">
                            <span className="text-cyan-400 font-mono text-xs">
                              {tx.block_height.toLocaleString()}
                            </span>
                          </td>

                          {/* FROM (Sender) - Compacto */}
                          <td className="py-2 px-1">
                            <div className="flex items-center gap-1">
                              <code className="text-cyan-400 text-xs">
                                {mainSender?.address.substring(0, 8)}...{mainSender?.address.substring(mainSender?.address.length - 6) || ''}
                              </code>
                              <AddressBadge 
                                address={mainSender?.address || ''} 
                                size="sm" 
                                showName={false} 
                              />
                              {mainSender && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    copyTxid(mainSender.address)
                                  }}
                                  className="p-0.5 h-5 w-5"
                                  title="Copy sender"
                                >
                                  {copiedTxid === mainSender.address ? (
                                    <span className="text-green-400 text-xs">✓</span>
                                  ) : (
                                    <Copy className="w-2.5 h-2.5" />
                                  )}
                                </Button>
                              )}
                              {tx.sender_count > 1 && (
                                <span className="text-gray-500 text-xs">+{tx.sender_count - 1}</span>
                              )}
                            </div>
                          </td>

                          {/* TO (Receiver) - Compacto */}
                          <td className="py-2 px-1">
                            <div className="flex items-center gap-1">
                              <code className="text-green-400 text-xs">
                                {mainReceiver?.address.substring(0, 8)}...{mainReceiver?.address.substring(mainReceiver?.address.length - 6) || ''}
                              </code>
                              <AddressBadge 
                                address={mainReceiver?.address || ''} 
                                size="sm" 
                                showName={false} 
                              />
                              {mainReceiver && renderRankBadge(
                                mainReceiver.address, 
                                null, 
                                true, // hasReceivedDog
                                tx.senders.map(s => s.address) // senderAddresses para verificar se já tinha DOG
                              )}
                              {mainReceiver && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    copyTxid(mainReceiver.address)
                                  }}
                                  className="p-0.5 h-5 w-5"
                                  title="Copy receiver"
                                >
                                  {copiedTxid === mainReceiver.address ? (
                                    <span className="text-green-400 text-xs">✓</span>
                                  ) : (
                                    <Copy className="w-2.5 h-2.5" />
                                  )}
                                </Button>
                              )}
                              {tx.receiver_count > 1 && (
                                <span className="text-gray-500 text-xs whitespace-nowrap">+{tx.receiver_count - 1}</span>
                              )}
                            </div>
                          </td>

                          {/* DOG Moved - Valor líquido enviado */}
                          <td className="py-2 px-1 text-right">
                            <span className="text-orange-400 font-mono font-bold text-xs">
                              {tx.net_transfer !== undefined 
                                ? formatDOG(tx.net_transfer) 
                                : formatDOG(tx.total_dog_moved)}
                            </span>
                          </td>

                          {/* Flow - Compacto */}
                          <td className="py-2 px-1 text-center">
                            <div className="flex items-center justify-center gap-1 text-xs font-mono">
                              <span className="text-cyan-400">{tx.sender_count}</span>
                              <ArrowRightLeft className="w-2.5 h-2.5 text-gray-500" />
                              <span className="text-green-400">{tx.receiver_count}</span>
                            </div>
                          </td>

                          {/* Time - Compacto */}
                          <td className="py-2 px-2">
                            <span className="text-gray-400 font-mono text-xs">
                              {formatTime(tx.timestamp)}
                            </span>
                          </td>

                          {/* TXID + Actions - Compacto */}
                          <td className="py-2 px-2">
                            <div className="flex items-center justify-center gap-0.5">
                              <code className={`text-xs font-mono ${isSelected ? 'text-blue-200' : 'text-white'}`}>
                                {tx.txid.substring(0, 6)}...
                              </code>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  copyTxid(tx.txid)
                                }}
                                className="p-0.5 h-5 w-5"
                                title="Copy txid"
                              >
                                {copiedTxid === tx.txid ? (
                                  <span className="text-green-400 text-xs">✓</span>
                                ) : (
                                  <Copy className="w-2.5 h-2.5" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  window.open(`https://mempool.space/tx/${tx.txid}`, '_blank')
                                }}
                                className="p-0.5 h-5 w-5"
                                title="Mempool"
                              >
                                <ExternalLink className="w-2.5 h-2.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {isSelected && (
                          <tr className="bg-blue-500/5 border-b border-blue-500/20">
                            <td colSpan={7} className="px-4 py-4">
                              {renderTransactionDetails(tx)}
                            </td>
                          </tr>
                        )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>

                {transactions.length === 0 && !loading && (
                  <div className="text-center py-12">
                    <Activity className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400 font-mono">No transactions yet</p>
                    <p className="text-gray-500 text-sm font-mono mt-2">Waiting for new blocks...</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-4 text-left md:text-center text-gray-500 font-mono text-xs md:text-sm">
          <p>Showing the last 500 DOG transactions.</p>
        </div>

        {hasMore && (
          <div ref={loadMoreRef} className="w-full h-12 flex items-center justify-center">
            {loadingMore ? (
              <div className="flex items-center gap-2 text-gray-400 font-mono text-xs">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Loading more transactions...
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="btn-sharp"
                onClick={loadMoreTransactions}
              >
                Load more
              </Button>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
