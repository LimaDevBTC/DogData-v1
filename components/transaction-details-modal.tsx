"use client"

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, ExternalLink, User, Wallet, Hash } from 'lucide-react';

interface Transaction {
  txid: string;
  block_height: number;
  timestamp: string | null;
  all_inputs: Array<{
    txid: string;
    vout: number;
    address: string;
    has_dog: boolean;
    had_dog_before: boolean | null;
    amount: number;
    holder_rank?: number | null;
    is_new_holder?: boolean;
  }>;
  dog_inputs: Array<{
    txid: string;
    vout: number;
    address: string;
    amount: number;
    holder_rank?: number | null;
    is_new_holder?: boolean;
  }>;
  dog_outputs: Array<{
    vout: number;
    address: string;
    amount: number;
    holder_rank?: number | null;
    is_new_holder?: boolean;
  }>;
  total_dog_moved: number;
  total_dog_moved_formatted: number;
  is_transfer: boolean;
  is_mint: boolean;
  is_burn: boolean;
}

interface TransactionDetailsModalProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
}

export function TransactionDetailsModal({ transaction, isOpen, onClose }: TransactionDetailsModalProps) {
  if (!isOpen || !transaction) return null;

  // Calcular total de DOG movido baseado nos dog_outputs
  const totalDogMoved = transaction.dog_outputs.reduce((sum, output) => sum + output.amount, 0);

  // Função para exibir o ranking do holder
  const getRankingDisplay = (holderRank: number | null | undefined, hasDog: boolean = true, isNewHolder: boolean = false) => {
    // Se é uma carteira verdadeiramente nova (primeira transação)
    if (isNewHolder) {
      return <span className="text-dog-orange text-xs font-mono font-medium">NEW</span>;
    }
    // Se tem DOG mas não está na lista de holders (gastou tudo), não mostrar "NEW"
    if (hasDog && (holderRank === null || holderRank === undefined)) {
      return <span className="text-dog-gray-400 text-xs font-mono font-medium">-</span>;
    }
    // Se não tem DOG, mostrar "NEW"
    if (!hasDog) {
      return <span className="text-dog-orange text-xs font-mono font-medium">NEW</span>;
    }
    // Se tem ranking, mostrar o ranking
    return <span className="text-dog-green text-xs font-mono font-medium">#{holderRank}</span>;
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  };

  const formatDogAmount = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 5
    }).format(amount);
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('pt-BR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-dog-gray-900 border border-dog-gray-600 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dog-gray-600">
          <div className="flex items-center gap-3">
            <Hash className="w-6 h-6 text-dog-orange" />
            <h2 className="text-2xl font-bold text-white">
              Detalhes da Transação DOG
            </h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="btn-sharp"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Resumo da Transação */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-dog-gray-800 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="w-5 h-5 text-dog-green" />
                <span className="text-dog-gray-300 font-medium">DOG Movidos</span>
              </div>
              <div className="text-2xl font-bold text-dog-green">
                {formatDogAmount(totalDogMoved)}
              </div>
              <div className="text-sm text-dog-gray-400">
                {transaction.dog_outputs.length} destinatário(s)
              </div>
            </div>

            <div className="bg-dog-gray-800 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <User className="w-5 h-5 text-dog-blue" />
                <span className="text-dog-gray-300 font-medium">Bloco</span>
              </div>
              <div className="text-2xl font-bold text-white">
                {formatNumber(transaction.block_height)}
              </div>
              <div className="text-sm text-dog-gray-400">
                {transaction.timestamp ? formatDate(transaction.timestamp) : 'N/A'}
              </div>
            </div>

            <div className="bg-dog-gray-800 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Hash className="w-5 h-5 text-dog-orange" />
                <span className="text-dog-gray-300 font-medium">UTXOs</span>
              </div>
              <div className="text-lg font-bold text-dog-red">
                -{transaction.all_inputs?.length || 0}
              </div>
              <div className="text-lg font-bold text-dog-green">
                +{transaction.dog_outputs.length}
              </div>
            </div>
          </div>

          {/* Senders */}
          <div className="bg-dog-gray-800 p-4 rounded-lg">
            <h3 className="text-lg font-bold text-dog-red mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Remetentes ({transaction.all_inputs.length})
            </h3>
            <div className="space-y-3">
              {transaction.all_inputs.map((sender, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-dog-gray-700 rounded">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-dog-red bg-opacity-20 rounded-full flex items-center justify-center">
                      <span className="text-dog-red font-bold text-sm">
                        {typeof sender.holder_rank === 'number' ? `#${sender.holder_rank}` : 'NEW'}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          {getRankingDisplay(sender.holder_rank, sender.has_dog, sender.is_new_holder)}
                          <code className="text-dog-gray-300 font-mono text-sm">
                            {sender.address}
                          </code>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(sender.address)}
                          className="btn-sharp text-xs px-2 py-1"
                        >
                          Copiar
                        </Button>
                      </div>
                      <div className="text-xs text-dog-gray-400">
                        {sender.has_dog ? `${formatDogAmount(sender.amount)} DOG` : 'BTC Input'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Receivers */}
          <div className="bg-dog-gray-800 p-4 rounded-lg">
            <h3 className="text-lg font-bold text-dog-green mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Receptores ({transaction.dog_outputs.length})
            </h3>
            <div className="space-y-3">
              {transaction.dog_outputs.map((receiver, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-dog-gray-700 rounded">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-dog-green bg-opacity-20 rounded-full flex items-center justify-center">
                      <span className="text-dog-green font-bold text-sm">
                        {typeof receiver.holder_rank === 'number' ? `#${receiver.holder_rank}` : 'NEW'}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          {getRankingDisplay(receiver.holder_rank, true, receiver.is_new_holder)}
                          <code className="text-dog-gray-300 font-mono text-sm">
                            {receiver.address}
                          </code>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(receiver.address)}
                          className="btn-sharp text-xs px-2 py-1"
                        >
                          Copiar
                        </Button>
                      </div>
                      <div className="text-xs text-dog-gray-400">
                        {formatDogAmount(receiver.amount)} DOG
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Resumo UTXOs */}
          <div className="bg-dog-gray-800 p-4 rounded-lg">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Hash className="w-5 h-5" />
              Resumo de UTXOs
            </h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-dog-red">-{transaction.all_inputs?.length || 0}</div>
                <div className="text-sm text-dog-gray-400">UTXOs Gastos</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-dog-green">+{transaction.dog_outputs.length}</div>
                <div className="text-sm text-dog-gray-400">UTXOs Criados</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-dog-orange">{transaction.dog_inputs.length}</div>
                <div className="text-sm text-dog-gray-400">DOG Inputs</div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end pt-4 border-t border-dog-gray-600">
            <Button
              variant="outline"
              onClick={() => window.open(`https://mempool.space/block/${transaction.block_height}`, '_blank')}
              className="btn-sharp"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Ver Bloco na Mempool
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

