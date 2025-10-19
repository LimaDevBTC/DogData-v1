"use client";

import { useState, useEffect, useMemo } from 'react';
import { Search, RefreshCw, Users, Coins, TrendingUp, Clock, ChevronLeft, ChevronRight, Copy, ExternalLink, Filter, SortAsc, SortDesc, Eye, EyeOff, Download, Share2, Star, AlertCircle } from 'lucide-react';

interface DogStats {
  totalHolders: number;
  totalUtxos: number;
  unresolvedUtxos: number;
  lastUpdated: string;
  source: string;
  topHolder?: {
    address: string;
    amount: number;
  };
  totalSupply: number;
}

interface Holder {
  address: string;
  total_amount: number;
  total_dog: number;
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

type SortField = 'rank' | 'address' | 'amount';
type SortDirection = 'asc' | 'desc';
type AddressType = 'all' | 'taproot' | 'segwit' | 'p2sh' | 'legacy';

export default function DogDataExplorer() {
  const [stats, setStats] = useState<DogStats | null>(null);
  const [allHolders, setAllHolders] = useState<Holder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchAddress, setSearchAddress] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('rank');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [addressFilter, setAddressFilter] = useState<AddressType>('all');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [goToPageInput, setGoToPageInput] = useState('');
  const [totalPages, setTotalPages] = useState(0);
  const [totalHolders, setTotalHolders] = useState(0);

  const ITEMS_PER_PAGE = 50;

  const fetchStats = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/dog-rune/stats');
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Erro ao buscar stats:', err);
    }
  };

  const fetchHolders = async (page: number = 1) => {
    try {
      const response = await fetch(`http://localhost:3001/api/dog-rune/holders?page=${page}&limit=${ITEMS_PER_PAGE}`);
      const data: HoldersResponse = await response.json();
      setAllHolders(data.holders);
      setTotalPages(data.totalPages || 0);
      setTotalHolders(data.totalHolders || 0);
      return data;
    } catch (err) {
      console.error('Erro ao buscar holders:', err);
      throw err;
    }
  };

  const reloadData = async () => {
    try {
      setIsRefreshing(true);
      const response = await fetch('http://localhost:3001/api/reload-data', { method: 'POST' });
      const data = await response.json();
      
      if (data.success) {
        await Promise.all([fetchStats(), fetchHolders(currentPage)]);
        setError(null);
      } else {
        setError('Falha ao recarregar dados');
      }
    } catch (err) {
      setError('Erro ao recarregar dados');
    } finally {
      setIsRefreshing(false);
    }
  };

  const getAddressType = (address: string): AddressType => {
    if (address.startsWith('bc1p')) return 'taproot';
    if (address.startsWith('bc1q')) return 'segwit';
    if (address.startsWith('3')) return 'p2sh';
    if (address.startsWith('1')) return 'legacy';
    return 'all';
  };

  const filteredAndSortedHolders = useMemo(() => {
    let filtered = allHolders.filter(holder => {
      // Filtro por busca de endereço
      if (searchAddress && !holder.address.toLowerCase().includes(searchAddress.toLowerCase())) {
        return false;
      }

      // Filtro por tipo de endereço
      if (addressFilter !== 'all' && getAddressType(holder.address) !== addressFilter) {
        return false;
      }

      // Filtro por valor mínimo
      if (minAmount && holder.total_dog < parseFloat(minAmount)) {
        return false;
      }

      // Filtro por valor máximo
      if (maxAmount && holder.total_dog > parseFloat(maxAmount)) {
        return false;
      }

      return true;
    });

    // Ordenação
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'address':
          comparison = a.address.localeCompare(b.address);
          break;
        case 'amount':
          comparison = a.total_dog - b.total_dog;
          break;
        case 'rank':
        default:
          comparison = 0; // Já está ordenado por rank
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [allHolders, searchAddress, addressFilter, minAmount, maxAmount, sortField, sortDirection]);

  // allHolders agora vem diretamente do backend

  const handleSearch = () => {
    setCurrentPage(1);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handlePageChange = async (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      setLoading(true);
      try {
        await fetchHolders(newPage);
      } catch (err) {
        console.error('Erro ao carregar página:', err);
      } finally {
        setLoading(false);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleGoToPage = async () => {
    const page = parseInt(goToPageInput);
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      setGoToPageInput('');
      setLoading(true);
      try {
        await fetchHolders(page);
      } catch (err) {
        console.error('Erro ao carregar página:', err);
      } finally {
        setLoading(false);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleGoToPageKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleGoToPage();
    }
  };

  const getVisiblePages = () => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];

    for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
      range.push(i);
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages);
    } else if (totalPages > 1) {
      rangeWithDots.push(totalPages);
    }

    return rangeWithDots;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAddress(text);
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (err) {
      console.error('Erro ao copiar:', err);
    }
  };

  const exportData = () => {
    const csvContent = [
      ['Rank', 'Address', 'Type', 'Amount (DOG)'],
      ...allHolders.map((holder, index) => [
        (currentPage - 1) * ITEMS_PER_PAGE + index + 1,
        holder.address,
        getAddressType(holder.address),
        holder.total_dog.toFixed(5)
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dog-holders-page-${currentPage}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

  const getAddressTypeInfo = (address: string) => {
    if (address.startsWith('bc1p')) return { type: 'Taproot', color: 'text-purple-400', bg: 'bg-purple-900/20' };
    if (address.startsWith('bc1q')) return { type: 'SegWit v0', color: 'text-blue-400', bg: 'bg-blue-900/20' };
    if (address.startsWith('3')) return { type: 'P2SH', color: 'text-yellow-400', bg: 'bg-yellow-900/20' };
    if (address.startsWith('1')) return { type: 'Legacy', color: 'text-gray-400', bg: 'bg-gray-900/20' };
    return { type: 'Unknown', color: 'text-gray-500', bg: 'bg-gray-900/20' };
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        await Promise.all([fetchStats(), fetchHolders(currentPage)]);
        setError(null);
      } catch (err) {
        setError('Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
    };

    loadData();
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  // totalPages agora vem do backend via estado

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="glass-card mx-4 mt-4 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold gradient-text mb-2">
              🐕 DOG DATA
            </h1>
            <p className="text-dog-gray-400 text-lg">
              Explorador Profissional da Runa DOG•GO•TO•THE•MOON
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={reloadData}
              disabled={isRefreshing}
              className="btn-primary flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Atualizando...' : 'Atualizar'}
            </button>
            <div className="text-sm text-dog-gray-400">
              <Clock className="w-4 h-4 inline mr-1" />
              {stats ? new Date(stats.lastUpdated).toLocaleString('pt-BR') : 'Carregando...'}
            </div>
          </div>
        </div>
      </header>

      {error && (
        <div className="mx-4 mt-4 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200 text-center flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <p>{error}</p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-4">
        <div className="glass-card p-6 animate-fade-in">
          <div className="flex items-center gap-3 mb-3">
            <Users className="w-6 h-6 text-dog-orange-500" />
            <h3 className="text-lg font-semibold text-dog-orange-400">Total de Holders</h3>
          </div>
          <p className="text-3xl font-bold text-white mb-1">
            {stats ? formatNumber(stats.totalHolders) : '...'}
          </p>
          <p className="text-sm text-dog-gray-400">Endereços únicos</p>
        </div>

        <div className="glass-card p-6 animate-fade-in">
          <div className="flex items-center gap-3 mb-3">
            <Coins className="w-6 h-6 text-dog-orange-500" />
            <h3 className="text-lg font-semibold text-dog-orange-400">Total de UTXOs</h3>
          </div>
          <p className="text-3xl font-bold text-white mb-1">
            {stats ? formatNumber(stats.totalUtxos) : '...'}
          </p>
          <p className="text-sm text-dog-gray-400">UTXOs com DOG</p>
        </div>

        <div className="glass-card p-6 animate-fade-in">
          <div className="flex items-center gap-3 mb-3">
            <TrendingUp className="w-6 h-6 text-dog-orange-500" />
            <h3 className="text-lg font-semibold text-dog-orange-400">Supply Total</h3>
          </div>
          <p className="text-3xl font-bold text-white mb-1">
            {stats ? formatNumber(stats.totalSupply) : '...'}
          </p>
          <p className="text-sm text-dog-gray-400">DOG tokens</p>
        </div>

        <div className="glass-card p-6 animate-fade-in">
          <div className="flex items-center gap-3 mb-3">
            <Clock className="w-6 h-6 text-dog-orange-500" />
            <h3 className="text-lg font-semibold text-dog-orange-400">Última Atualização</h3>
          </div>
          <p className="text-sm text-white mb-1">
            {stats ? new Date(stats.lastUpdated).toLocaleString('pt-BR') : '...'}
          </p>
          <p className="text-sm text-dog-gray-400">Tempo real</p>
        </div>
      </div>

      {/* Top Holder */}
      {stats?.topHolder && (
        <div className="mx-4 mb-6">
          <div className="glass-card p-6 bg-gradient-to-r from-dog-orange-900/20 to-dog-orange-800/20 border-dog-orange-500/30">
            <h3 className="text-xl font-bold text-dog-orange-200 mb-4 flex items-center gap-2">
              🏆 Maior Holder
            </h3>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="address-text text-lg break-all">
                    {stats.topHolder.address}
                  </span>
                  <button
                    onClick={() => copyToClipboard(stats.topHolder!.address)}
                    className="p-1 hover:bg-dog-gray-700 rounded transition-colors"
                  >
                    <Copy className="w-4 h-4 text-dog-gray-400" />
                  </button>
                </div>
                <p className="text-2xl font-bold text-white">
                  {formatNumber(stats.topHolder.amount)} DOG
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="mx-4 mb-6">
        <div className="glass-card p-6">
          <div className="flex flex-col lg:flex-row gap-4 mb-4">
            <div className="flex-1">
              <h3 className="text-xl font-bold text-dog-orange-400 mb-4 flex items-center gap-2">
                <Search className="w-5 h-5" />
                Buscar e Filtrar Holders
              </h3>
              <div className="flex flex-col sm:flex-row gap-4">
                <input
                  type="text"
                  value={searchAddress}
                  onChange={(e) => setSearchAddress(e.target.value)}
                  placeholder="Digite o endereço Bitcoin..."
                  className="input-field flex-1"
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
                <button
                  onClick={handleSearch}
                  className="btn-primary flex items-center gap-2"
                >
                  <Search className="w-4 h-4" />
                  Buscar
                </button>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="btn-secondary flex items-center gap-2"
              >
                <Filter className="w-4 h-4" />
                Filtros
              </button>
              <button
                onClick={() => setViewMode(viewMode === 'table' ? 'cards' : 'table')}
                className="btn-secondary flex items-center gap-2"
              >
                {viewMode === 'table' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {viewMode === 'table' ? 'Cards' : 'Tabela'}
              </button>
              <button
                onClick={exportData}
                className="btn-secondary flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Exportar
              </button>
            </div>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-dog-gray-800/30 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-dog-gray-300 mb-2">Tipo de Endereço</label>
                <select
                  value={addressFilter}
                  onChange={(e) => setAddressFilter(e.target.value as AddressType)}
                  className="input-field w-full"
                >
                  <option value="all">Todos</option>
                  <option value="taproot">Taproot (bc1p)</option>
                  <option value="segwit">SegWit v0 (bc1q)</option>
                  <option value="p2sh">P2SH (3...)</option>
                  <option value="legacy">Legacy (1...)</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-dog-gray-300 mb-2">Valor Mínimo (DOG)</label>
                <input
                  type="number"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  placeholder="0"
                  className="input-field w-full"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-dog-gray-300 mb-2">Valor Máximo (DOG)</label>
                <input
                  type="number"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                  placeholder="∞"
                  className="input-field w-full"
                />
              </div>
              
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setSearchAddress('');
                    setAddressFilter('all');
                    setMinAmount('');
                    setMaxAmount('');
                    setCurrentPage(1);
                  }}
                  className="btn-secondary w-full"
                >
                  Limpar Filtros
                </button>
              </div>
            </div>
          )}

          {/* Results Summary */}
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-sm text-dog-gray-400">
            <div>
              Mostrando {allHolders.length} de {totalHolders} holders
              {totalHolders !== allHolders.length && (
                <span className="text-dog-orange-400"> (filtrados)</span>
              )}
            </div>
            <div>
              Página {currentPage} de {totalPages}
            </div>
          </div>
        </div>
      </div>

      {/* Holders List */}
      <div className="mx-4 mb-6">
        <div className="glass-card p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-dog-orange-400 flex items-center gap-2">
              👥 Lista de Holders
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSort('amount')}
                className="btn-secondary flex items-center gap-2"
              >
                {sortField === 'amount' && sortDirection === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
                Ordenar por Valor
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="loading-dots mx-auto mb-4">
                <div></div>
                <div></div>
                <div></div>
                <div></div>
              </div>
              <p className="text-dog-gray-400">Carregando dados...</p>
            </div>
          ) : (
            <>
              {viewMode === 'table' ? (
                <div className="overflow-x-auto scrollbar-hide">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-dog-gray-700">
                        <th className="text-left py-4 px-4 text-dog-orange-400 font-semibold">Rank</th>
                        <th className="text-left py-4 px-4 text-dog-orange-400 font-semibold">Endereço</th>
                        <th className="text-left py-4 px-4 text-dog-orange-400 font-semibold">Tipo</th>
                        <th className="text-right py-4 px-4 text-dog-orange-400 font-semibold">Saldo (DOG)</th>
                        <th className="text-center py-4 px-4 text-dog-orange-400 font-semibold">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allHolders.map((holder, index) => {
                        const addressType = getAddressTypeInfo(holder.address);
                        const globalRank = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
                        
                        return (
                          <tr key={holder.address} className="table-row">
                            <td className="py-4 px-4">
                              <span className="rank-badge">#{globalRank}</span>
                            </td>
                            <td className="py-4 px-4">
                              <span className="address-text">
                                {formatAddress(holder.address)}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <span className={`text-xs font-medium px-2 py-1 rounded-full ${addressType.color} ${addressType.bg}`}>
                                {addressType.type}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <span className="amount-text">
                                {formatNumber(holder.total_dog)}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => copyToClipboard(holder.address)}
                                  className="p-2 hover:bg-dog-gray-700 rounded-lg transition-colors group"
                                  title="Copiar endereço"
                                >
                                  <Copy className="w-4 h-4 text-dog-gray-400 group-hover:text-white" />
                                </button>
                                <button
                                  onClick={() => window.open(`https://blockstream.info/address/${holder.address}`, '_blank')}
                                  className="p-2 hover:bg-dog-gray-700 rounded-lg transition-colors group"
                                  title="Ver no Blockstream"
                                >
                                  <ExternalLink className="w-4 h-4 text-dog-gray-400 group-hover:text-white" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {allHolders.map((holder, index) => {
                    const addressType = getAddressTypeInfo(holder.address);
                    const globalRank = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
                    
                    return (
                      <div key={holder.address} className="glass-card p-4 hover:bg-dog-gray-800/30 transition-colors">
                        <div className="flex items-center justify-between mb-3">
                          <span className="rank-badge">#{globalRank}</span>
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${addressType.color} ${addressType.bg}`}>
                            {addressType.type}
                          </span>
                        </div>
                        <div className="mb-3">
                          <p className="address-text text-sm mb-1">
                            {formatAddress(holder.address)}
                          </p>
                          <p className="amount-text text-lg">
                            {formatNumber(holder.total_dog)} DOG
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => copyToClipboard(holder.address)}
                            className="btn-secondary flex-1 flex items-center justify-center gap-2"
                          >
                            <Copy className="w-4 h-4" />
                            Copiar
                          </button>
                          <button
                            onClick={() => window.open(`https://blockstream.info/address/${holder.address}`, '_blank')}
                            className="btn-secondary flex items-center justify-center gap-2"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Advanced Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6 flex-wrap">
                  {/* Previous Button */}
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  
                  {/* Page Numbers */}
                  <div className="flex items-center gap-1">
                    {getVisiblePages().map((page, index) => (
                      <div key={index}>
                        {page === '...' ? (
                          <span className="px-3 py-2 text-dog-gray-400">...</span>
                        ) : (
                          <button
                            onClick={() => handlePageChange(page as number)}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                              currentPage === page
                                ? 'bg-dog-orange-500 text-white'
                                : 'bg-dog-gray-700 text-dog-gray-300 hover:bg-dog-gray-600'
                            }`}
                          >
                            {page}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {/* Next Button */}
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  
                  {/* Go to Page */}
                  <div className="flex items-center gap-2 ml-4">
                    <span className="text-dog-gray-400 text-sm">Go to</span>
                    <input
                      type="number"
                      value={goToPageInput}
                      onChange={(e) => setGoToPageInput(e.target.value)}
                      onKeyPress={handleGoToPageKeyPress}
                      placeholder="Page"
                      min="1"
                      max={totalPages}
                      className="w-20 px-2 py-1 bg-dog-gray-700 border border-dog-gray-600 rounded text-white text-sm text-center focus:outline-none focus:border-dog-orange-500"
                    />
                    <span className="text-dog-gray-400 text-sm">Page</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center py-8 text-dog-gray-500">
        <p>🐕 DOG DATA - Explorador Profissional da Runa DOG•GO•TO•THE•MOON</p>
        <p className="text-sm mt-2">Dados atualizados em tempo real • Powered by Bitcoin Node + Ord CLI</p>
      </footer>
    </div>
  );
}