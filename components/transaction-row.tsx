"use client"

import React from 'react'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Copy, ExternalLink, ArrowRightLeft } from "lucide-react"
import { AddressBadge } from "@/components/address-badge-optimized"

interface Sender {
  address: string
  input: string
  amount?: number
  amount_dog?: number
  has_dog?: boolean
}

interface Receiver {
  address: string
  vout: number
  amount: number
  amount_dog: number
  is_change?: boolean
}

interface Transaction {
  txid: string
  block_height: number
  timestamp: string | number
  type: string
  senders: Sender[]
  receivers: Receiver[]
  total_dog_moved: number
  net_transfer?: number
  change_amount?: number
  has_change?: boolean
  sender_count: number
  receiver_count: number
}

interface TransactionRowProps {
  transaction: Transaction
  style?: React.CSSProperties
  onCopy: (text: string) => void
  copiedTxid: string | null
  formatDOG: (amount: number) => string
  formatTime: (timestamp: string | number) => string
  getTypeColor: (type: string) => string
  getTypeLabel: (type: string) => string
}

// Componente de linha TOTALMENTE memoizado
export const TransactionRow = React.memo(function TransactionRow({
  transaction: tx,
  style,
  onCopy,
  copiedTxid,
  formatDOG,
  formatTime,
  getTypeColor,
  getTypeLabel
}: TransactionRowProps) {
  const mainSender = tx.senders[0]
  const mainReceiver = tx.receivers[0]

  return (
    <tr style={style} className="table-row border-b border-gray-800/30 hover:bg-gray-800/20">
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
              onClick={() => onCopy(mainSender.address)}
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
          {mainReceiver && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onCopy(mainReceiver.address)}
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
            <span className="text-gray-500 text-xs">+{tx.receiver_count - 1}</span>
          )}
        </div>
      </td>

      {/* Type - Compacto */}
      <td className="py-2 px-1 text-center">
        <Badge className={`${getTypeColor(tx.type)} font-mono text-xs px-1.5 py-0.5`}>
          {getTypeLabel(tx.type)}
        </Badge>
      </td>

      {/* Amount - Valor líquido enviado */}
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
          <code className="text-white text-xs">
            {tx.txid.substring(0, 6)}...
          </code>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onCopy(tx.txid)}
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
            onClick={() => window.open(`https://mempool.space/tx/${tx.txid}`, '_blank')}
            className="p-0.5 h-5 w-5"
            title="Mempool"
          >
            <ExternalLink className="w-2.5 h-2.5" />
          </Button>
        </div>
      </td>
    </tr>
  )
}, (prevProps, nextProps) => {
  // Custom comparison - só re-renderiza se TXID mudar ou copiedTxid afetar esta linha
  return prevProps.transaction.txid === nextProps.transaction.txid &&
         prevProps.copiedTxid === nextProps.copiedTxid
})

TransactionRow.displayName = 'TransactionRow'

