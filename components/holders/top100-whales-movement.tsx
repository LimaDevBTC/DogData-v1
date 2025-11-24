"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AddressBadge } from "@/components/address-badge"
import { TrendingUp, TrendingDown, Wallet } from "lucide-react"

interface Transaction {
  txid: string
  timestamp: string
  senders: Array<{ address: string; amount_dog: number }>
  receivers: Array<{ address: string; amount_dog: number; is_change: boolean }>
  net_transfer?: number
  total_dog_moved?: number
}

interface Holder {
  rank: number
  address: string
  total_dog: number
}

interface Top100Movement {
  address: string
  rank: number
  inflow: number
  outflow: number
  net: number
}

interface Top100WhalesMovementProps {
  allHolders: Holder[]
}

export function Top100WhalesMovement({ allHolders }: Top100WhalesMovementProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  // Criar mapa de endereços top 100
  const top100Addresses = useMemo(() => {
    const top100 = allHolders
      .filter(h => h.rank >= 1 && h.rank <= 100)
      .map(h => h.address.toLowerCase())
    return new Set(top100)
  }, [allHolders])

  // Criar mapa de rank por endereço
  const addressToRank = useMemo(() => {
    const map = new Map<string, number>()
    allHolders.forEach(h => {
      if (h.rank >= 1 && h.rank <= 100) {
        map.set(h.address.toLowerCase(), h.rank)
      }
    })
    return map
  }, [allHolders])

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/dog-rune/transactions-kv', {
          cache: 'no-store'
        })
        
        if (!response.ok) {
          throw new Error('Failed to fetch transactions')
        }

        const data = await response.json()
        const txs = data.transactions || []
        
        // Filtrar transações das últimas 24h
        const now = Date.now()
        const threshold = now - 24 * 60 * 60 * 1000
        
        const recentTxs = txs.filter((tx: Transaction) => {
          const ts = new Date(tx.timestamp).getTime()
          if (Number.isNaN(ts) || ts < threshold) return false
          
          // Validação adicional: garantir que a transação tem dados válidos
          if (!tx.senders || !tx.receivers) return false
          
          return true
        })

        console.log(`📊 [Top100] ${recentTxs.length} transações das últimas 24h carregadas (de ${txs.length} total)`)
        setTransactions(recentTxs)
      } catch (error) {
        console.error('Error fetching transactions:', error)
      } finally {
        setLoading(false)
      }
    }

    if (allHolders.length > 0) {
      fetchTransactions()
    }
  }, [allHolders.length])

  // Calcular movimentos das top 100
  // IMPORTANTE: Usar a mesma lógica do computeMetrics24h para garantir consistência
  const movements = useMemo(() => {
    const movementMap = new Map<string, { inflow: number; outflow: number }>()
    const MAX_DOG_AMOUNT = 100_000_000_000 // 100 bilhões de DOG

    transactions.forEach(tx => {
      // Criar Set de endereços de senders para identificar change outputs
      const txSenderAddresses = new Set(
        tx.senders.map(s => s.address.toLowerCase())
      )
      const txSenderAddressesLower = new Set(
        Array.from(txSenderAddresses).map(addr => addr.toLowerCase())
      )

      // Calcular volume da transação (net_transfer, excluindo change)
      const volume = typeof tx.net_transfer === 'number'
        ? tx.net_transfer
        : (typeof tx.total_dog_moved === 'number' ? tx.total_dog_moved : 0)

      // Validar volume
      if (!Number.isFinite(volume) || volume < 0 || volume > MAX_DOG_AMOUNT) {
        return // Pular transação inválida
      }

      // Processar senders (outflows) - usar mesma lógica do computeMetrics24h
      const txSenderAmounts = new Map<string, number>()
      let txSenderTotal = 0

      tx.senders.forEach(sender => {
        const address = sender.address
        if (!address) return
        
        const amountDog = typeof sender.amount_dog === 'number'
          ? sender.amount_dog
          : Number(sender.amount_dog) || 0

        // Validar valores
        if (!Number.isFinite(amountDog) || amountDog < 0 || amountDog > MAX_DOG_AMOUNT) {
          return
        }

        txSenderAmounts.set(address, (txSenderAmounts.get(address) || 0) + amountDog)
        txSenderTotal += amountDog
      })

      // Distribuir volume proporcionalmente entre senders (mesma lógica do computeMetrics24h)
      if (volume > 0 && txSenderTotal > 0 && Number.isFinite(txSenderTotal)) {
        for (const [address, amountDog] of Array.from(txSenderAmounts.entries())) {
          if (!Number.isFinite(amountDog) || amountDog < 0 || amountDog > MAX_DOG_AMOUNT) continue
          
          const addressLower = address.toLowerCase()
          if (top100Addresses.has(addressLower)) {
            const share = (amountDog / txSenderTotal) * volume
            if (Number.isFinite(share) && share > 0 && share <= MAX_DOG_AMOUNT) {
              const current = movementMap.get(addressLower) || { inflow: 0, outflow: 0 }
              movementMap.set(addressLower, {
                ...current,
                outflow: current.outflow + share
              })
            }
          }
        }
      }

      // Processar receivers (inflows) - excluindo change outputs
      // IMPORTANTE: Usar apenas receivers que NÃO são change, igual ao computeMetrics24h
      tx.receivers.forEach(receiver => {
        if (!receiver.address) return

        const receiverAddressLower = receiver.address.toLowerCase()
        
        // Verificação dupla: usar is_change se disponível, senão verificar se endereço está nos senders
        const isChange = receiver.is_change !== undefined
          ? Boolean(receiver.is_change)
          : txSenderAddresses.has(receiverAddressLower) || txSenderAddressesLower.has(receiverAddressLower)
        
        // CRÍTICO: NUNCA contar change outputs como inflow
        if (isChange) return
        
        if (top100Addresses.has(receiverAddressLower)) {
          const current = movementMap.get(receiverAddressLower) || { inflow: 0, outflow: 0 }
          const amountDog = typeof receiver.amount_dog === 'number'
            ? receiver.amount_dog
            : Number(receiver.amount_dog) || 0
          
          // Validar valores (mesma validação do computeMetrics24h)
          if (!Number.isFinite(amountDog) || amountDog < 0 || amountDog > MAX_DOG_AMOUNT) {
            return
          }
          
          movementMap.set(receiverAddressLower, {
            ...current,
            inflow: current.inflow + amountDog
          })
        }
      })
    })

    // Converter para array e calcular net
    const movementsArray: Top100Movement[] = Array.from(movementMap.entries())
      .map(([address, { inflow, outflow }]) => ({
        address,
        rank: addressToRank.get(address) || 0,
        inflow: Number(inflow.toFixed(5)), // Arredondar para 5 casas decimais (consistência)
        outflow: Number(outflow.toFixed(5)), // Arredondar para 5 casas decimais (consistência)
        net: Number((inflow - outflow).toFixed(5)) // Arredondar para 5 casas decimais (consistência)
      }))
      .filter(m => m.inflow > 0 || m.outflow > 0) // Apenas carteiras com movimento
      .sort((a, b) => {
        // Ordenar por valor absoluto do net (maior movimento primeiro)
        return Math.abs(b.net) - Math.abs(a.net)
      })

    // Debug: verificar se há movimentos suspeitos (valores muito grandes podem indicar problema)
    if (movementsArray.length > 0) {
      const topMovement = movementsArray[0]
      if (Math.abs(topMovement.net) > 50_000_000) { // Valores muito grandes podem indicar problema
        console.warn(`⚠️ [Top100] Movimento suspeito detectado:`, {
          address: topMovement.address.substring(0, 20) + '...',
          rank: topMovement.rank,
          net: topMovement.net,
          inflow: topMovement.inflow,
          outflow: topMovement.outflow,
          transactionsCount: transactions.length
        })
      }
      
      // Log das top 5 movimentos para debug
      console.log(`📊 [Top100] Top 5 movimentos:`, movementsArray.slice(0, 5).map(m => ({
        rank: m.rank,
        net: m.net,
        inflow: m.inflow,
        outflow: m.outflow
      })))
    }

    return movementsArray
  }, [transactions, top100Addresses, addressToRank])

  // Separar em inflows positivos e outflows negativos
  const positiveMovements = movements.filter(m => m.net > 0)
  const negativeMovements = movements.filter(m => m.net < 0)

  // Calcular saldo total
  const totalNet = useMemo(() => {
    return movements.reduce((sum, m) => sum + m.net, 0)
  }, [movements])

  // Usar a mesma formatação do computeMetrics24h para consistência
  const formatDOG = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  const formatDOGCompact = (amount: number) => {
    // Sempre usar valor absoluto para formatação (mesmo formato para inflow e outflow)
    const absAmount = Math.abs(amount)
    
    if (absAmount >= 1_000_000_000) {
      return `${(absAmount / 1_000_000_000).toFixed(1)}B`
    }
    if (absAmount >= 1_000_000) {
      return `${(absAmount / 1_000_000).toFixed(1)}M`
    }
    if (absAmount >= 1_000) {
      return `${(absAmount / 1_000).toFixed(1)}K`
    }
    return absAmount.toFixed(2)
  }

  if (loading) {
    return (
      <Card variant="glass" className="border-orange-500/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
            <span className="ml-3 text-gray-400 font-mono">Loading whale movements...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card variant="glass" className="border-orange-500/20 hover:border-orange-500/40 transition-all">
      <CardHeader>
        <CardTitle className="text-orange-400 text-xl font-mono uppercase tracking-[0.3em] flex items-center">
          <Wallet className="w-6 h-6 mr-3 text-orange-500" />
          Top 100 Whales Movement (24h)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Duas colunas: Compras e Vendas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Coluna de Compras (Net Positive) */}
          <div>
            <h3 className="text-emerald-400 font-mono text-sm uppercase tracking-wide mb-3 flex items-center">
              <TrendingUp className="w-4 h-4 mr-2" />
              Net Inflow ({positiveMovements.length})
            </h3>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {positiveMovements.length === 0 ? (
                <p className="text-gray-500 text-sm font-mono text-center py-4">No positive movements</p>
              ) : (
                positiveMovements.map((movement) => (
                  <div
                    key={movement.address}
                    className="bg-emerald-500/5 border border-emerald-500/20 rounded p-3 hover:bg-emerald-500/10 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-gray-400 text-xs font-mono">#{movement.rank}</span>
                          <AddressBadge 
                            address={movement.address} 
                            size="sm" 
                            showName={false}
                          />
                        </div>
                        <div className="text-xs text-gray-500 font-mono">
                          In: {formatDOGCompact(movement.inflow)} | Out: {formatDOGCompact(movement.outflow)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-emerald-400 font-bold font-mono text-sm">
                          +{formatDOGCompact(movement.net)}
                        </div>
                        <div className="text-gray-500 text-xs font-mono">DOG</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Coluna de Vendas (Net Negative) */}
          <div>
            <h3 className="text-red-400 font-mono text-sm uppercase tracking-wide mb-3 flex items-center">
              <TrendingDown className="w-4 h-4 mr-2" />
              Net Outflow ({negativeMovements.length})
            </h3>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {negativeMovements.length === 0 ? (
                <p className="text-gray-500 text-sm font-mono text-center py-4">No negative movements</p>
              ) : (
                negativeMovements.map((movement) => (
                  <div
                    key={movement.address}
                    className="bg-red-500/5 border border-red-500/20 rounded p-3 hover:bg-red-500/10 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-gray-400 text-xs font-mono">#{movement.rank}</span>
                          <AddressBadge 
                            address={movement.address} 
                            size="sm" 
                            showName={false}
                          />
                        </div>
                        <div className="text-xs text-gray-500 font-mono">
                          In: {formatDOGCompact(movement.inflow)} | Out: {formatDOGCompact(movement.outflow)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-red-400 font-bold font-mono text-sm">
                          -{formatDOGCompact(movement.net)}
                        </div>
                        <div className="text-gray-500 text-xs font-mono">DOG</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Saldo Net - Abaixo das colunas */}
        <div className="bg-gradient-to-r from-orange-500/10 to-orange-600/10 border border-orange-500/20 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm font-mono uppercase tracking-wide">Daily Net Flow</p>
              <p className={`text-2xl font-bold font-mono mt-1 ${
                totalNet > 0 
                  ? 'text-emerald-400' 
                  : totalNet < 0 
                    ? 'text-red-400' 
                    : 'text-gray-400'
              }`}>
                {totalNet > 0 ? '+' : ''}{formatDOG(totalNet)} DOG
              </p>
            </div>
            {totalNet !== 0 && (
              <div className={`text-4xl ${totalNet > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {totalNet > 0 ? <TrendingUp /> : <TrendingDown />}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
