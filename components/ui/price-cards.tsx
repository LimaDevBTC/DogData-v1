"use client"

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface PriceData {
  exchange: string;
  price: number;
  change24h?: number;
  volume24h?: number;
  lastUpdate: Date;
  status: 'loading' | 'success' | 'error';
  error?: string;
  priceSats?: string;
}

const exchanges = [
  {
    name: 'MEXC',
    apiUrl: '/api/price/mexc',
    color: 'from-blue-400 to-blue-600',
    borderColor: 'border-blue-500/20',
    hoverBorderColor: 'hover:border-blue-500/40',
    icon: 'M',
    working: true
  },
  {
    name: 'Kraken',
    apiUrl: '/api/price/kraken',
    color: 'from-purple-400 to-purple-600',
    borderColor: 'border-purple-500/20',
    hoverBorderColor: 'hover:border-purple-500/40',
    icon: 'K',
    working: true
  },
  {
    name: 'Gate.io',
    apiUrl: '/api/price/gateio',
    color: 'from-green-400 to-green-600',
    borderColor: 'border-green-500/20',
    hoverBorderColor: 'hover:border-green-500/40',
    icon: 'G',
    working: true
  },
  {
    name: 'Bitget',
    apiUrl: '/api/price/bitget',
    color: 'from-cyan-400 to-blue-500',
    borderColor: 'border-cyan-500/20',
    hoverBorderColor: 'hover:border-cyan-500/40',
    icon: 'B',
    working: true
  },
  {
    name: 'Pionex',
    apiUrl: '/api/price/pionex',
    color: 'from-red-400 to-red-600',
    borderColor: 'border-red-500/20',
    hoverBorderColor: 'hover:border-red-500/40',
    icon: 'P',
    working: true
  },
  {
    name: 'Magic Eden',
    apiUrl: '/api/price/magiceden',
    color: 'from-purple-400 to-pink-500',
    borderColor: 'border-purple-500/20',
    hoverBorderColor: 'hover:border-purple-500/40',
    icon: 'ME',
    working: true
  }
];

const bitflowExchange = {
  name: 'Bitflow',
  apiUrl: '/api/price/bitflow',
  color: 'from-orange-400 to-orange-600',
  borderColor: 'border-orange-500/20',
  hoverBorderColor: 'hover:border-orange-500/40',
  icon: 'BF',
  working: true,
  sponsored: true,
  url: 'https://btflw.link/brl'
};

export function PriceCards() {
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPrice = async (exchange: typeof exchanges[0]): Promise<PriceData> => {
    try {
      const response = await fetch(exchange.apiUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      let price = 0;
      let change24h = 0;
      let volume24h = 0;
      let priceSats = undefined;
      
      // Parse response based on exchange
      if (exchange.name === 'MEXC') {
        // MEXC 24hr ticker - tem preço e mudança 24h
        price = parseFloat(data.lastPrice);
        // MEXC retorna priceChangePercent já em formato de porcentagem (ex: 5.23 para 5.23%)
        // Mas se vier em decimal (ex: 0.0523), multiplicamos por 100
        const rawChange = parseFloat(data.priceChangePercent);
        // Se o valor absoluto é menor que 1, provavelmente está em formato decimal
        change24h = Math.abs(rawChange) < 1 ? rawChange * 100 : rawChange;
        volume24h = parseFloat(data.volume);
      } else if (exchange.name === 'Kraken') {
        // Kraken ticker - tem preço e mudança 24h
        if (data.result && data.result.DOGUSD) {
          const pairData = data.result.DOGUSD;
          price = parseFloat(pairData.c[0]); // last price (close)
          const openPrice = parseFloat(pairData.o); // open price
          // Calcular mudança percentual: ((current - open) / open) * 100
          change24h = ((price - openPrice) / openPrice) * 100;
          volume24h = parseFloat(pairData.v[1]); // 24h volume
        }
      } else if (exchange.name === 'Bitget') {
        // Bitget - dados já filtrados pelo proxy
        if (data) {
          price = parseFloat(data.lastPr);
          change24h = parseFloat(data.change24h) * 100;
          volume24h = parseFloat(data.baseVolume);
        } else {
          throw new Error('DOGUSDT data not found on Bitget');
        }
      } else if (exchange.name === 'Pionex') {
        // Pionex - dados já filtrados pelo proxy
        if (data) {
          price = parseFloat(data.close);
          const openPrice = parseFloat(data.open);
          change24h = ((price - openPrice) / openPrice) * 100;
          volume24h = parseFloat(data.volume);
        } else {
          throw new Error('DOGUSDT data not found on Pionex');
        }
      } else if (exchange.name === 'Gate.io') {
        // Gate.io - dados extraídos do gráfico TradingView
        if (data) {
          price = parseFloat(data.lastPrice);
          change24h = parseFloat(data.priceChangePercent);
          volume24h = parseFloat(data.volume);
        } else {
          throw new Error('DOGUSDT data not found on Gate.io');
        }
      } else if (exchange.name === 'Bitflow') {
        // Bitflow - DEX na rede Stacks
        if (data) {
          price = parseFloat(data.lastPrice);
          change24h = parseFloat(data.change24h);
          volume24h = parseFloat(data.volume);
          priceSats = data.priceSats; // Preço em satoshis
        } else {
          throw new Error('DOG data not found on Bitflow');
        }
      } else if (exchange.name === 'Magic Eden') {
        // Magic Eden - NFT Marketplace com Runes
        if (data) {
          price = parseFloat(data.lastPrice);
          change24h = parseFloat(data.change24h);
          volume24h = parseFloat(data.volume24h);
          priceSats = data.priceSats; // Floor price em sats
        } else {
          throw new Error('DOG data not found on Magic Eden');
        }
      }
      
      return {
        exchange: exchange.name,
        price,
        change24h,
        volume24h,
        lastUpdate: new Date(),
        status: 'success',
        priceSats
      };
    } catch (error) {
      return {
        exchange: exchange.name,
        price: 0,
        lastUpdate: new Date(),
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  };

  const fetchAllPrices = async () => {
    setIsLoading(true);
    // Fetch from all working exchanges including Bitflow
    const allExchanges = [...exchanges, bitflowExchange];
    const workingExchanges = allExchanges.filter(exchange => exchange.working);
    const pricePromises = workingExchanges.map(exchange => fetchPrice(exchange));
    const results = await Promise.all(pricePromises);
    
    // Add placeholder data for non-working exchanges
    const allResults = allExchanges.map(exchange => {
      if (exchange.working) {
        return results.find(r => r.exchange === exchange.name) || {
          exchange: exchange.name,
          price: 0,
          lastUpdate: new Date(),
          status: 'error' as const,
          error: 'Not available'
        };
      } else {
        return {
          exchange: exchange.name,
          price: 0,
          lastUpdate: new Date(),
          status: 'error' as const,
          error: 'Coming Soon'
        };
      }
    });
    
    setPrices(allResults);
    setIsLoading(false);
    console.log('📊 Prices updated:', allResults.map(p => `${p.exchange}: $${p.price} (${p.change24h}%)`));
  };

  useEffect(() => {
    fetchAllPrices();
    
    // Update every 10 seconds for more frequent updates
    const interval = setInterval(() => {
      console.log('🔄 Updating prices...');
      fetchAllPrices();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const formatPrice = (price: number) => {
    if (price === 0) return 'N/A';
    if (price < 0.01) return `$${price.toFixed(6)}`;
    if (price < 1) return `$${price.toFixed(4)}`;
    return `$${price.toFixed(2)}`;
  };

  const formatChange = (change: number) => {
    if (change === 0) return '0.00%';
    const sign = change > 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Grid 2x3: 6 exchanges em duas linhas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {exchanges.map((exchange, index) => {
          const priceData = prices.find(p => p.exchange === exchange.name);
          const isSuccess = priceData?.status === 'success';
          const isError = priceData?.status === 'error';
          const isWorking = exchange.working;
          
          return (
            <Card
              key={exchange.name}
              variant="glass"
              className={`stagger-item ${exchange.borderColor} ${exchange.hoverBorderColor} transition-all ${
                !isWorking ? 'opacity-60' : ''
              }`}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <CardHeader className={`${exchange.name === 'Gate.io' || exchange.name === 'Bitget' || exchange.name === 'Bitflow' || exchange.name === 'Magic Eden' ? 'pb-2.5' : 'pb-2'}`}>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`${exchange.name === 'Gate.io' || exchange.name === 'Bitget' || exchange.name === 'Bitflow' || exchange.name === 'Magic Eden' ? 'h-14 flex items-center -mt-0.5' : 'h-14 flex items-center'}`}>
                      <img 
                        src={`/${
                          exchange.name === 'MEXC' ? 'MEXC ' : 
                          exchange.name === 'Gate.io' ? 'Gate' : 
                          exchange.name === 'Magic Eden' ? 'MagicEden' :
                          exchange.name
                        }.png`}
                        alt={exchange.name}
                        className={`${exchange.name === 'Gate.io' || exchange.name === 'Bitget' || exchange.name === 'Bitflow' || exchange.name === 'Magic Eden' ? 'h-10' : 'h-14'} w-auto object-contain`}
                        onError={(e) => {
                          // Fallback to icon if image fails
                          e.currentTarget.style.display = 'none';
                          const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                      <div 
                        className={`hidden ${exchange.name === 'Gate.io' || exchange.name === 'Bitget' || exchange.name === 'Bitflow' || exchange.name === 'Magic Eden' ? 'w-10 h-10' : 'w-14 h-14'} bg-gradient-to-r ${exchange.color} flex items-center justify-center text-white font-bold ${exchange.name === 'Gate.io' || exchange.name === 'Bitget' || exchange.name === 'Bitflow' || exchange.name === 'Magic Eden' ? 'text-sm' : 'text-lg'}`}
                      >
                        {exchange.icon}
                      </div>
                    </div>
                    {!isWorking && (
                      <span className="text-xs text-gray-500">Coming Soon</span>
                    )}
                  </div>
                  {isSuccess && (
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-green-400"></div>
                    </div>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!isWorking ? (
                  <div className="space-y-2">
                    <div className="text-gray-400 font-mono text-lg">Coming Soon</div>
                    <div className="text-gray-500 text-xs">API integration pending</div>
                  </div>
                ) : isLoading && !priceData ? (
                  <div className="space-y-2">
                    <div className="h-6 bg-gray-700/50 animate-pulse"></div>
                    <div className="h-4 bg-gray-700/30 animate-pulse"></div>
                  </div>
                ) : isError ? (
                  <div className="space-y-2">
                    <div className="text-red-400 font-mono text-sm">Error</div>
                    <div className="text-gray-500 text-xs">{priceData?.error}</div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className={`text-2xl font-bold font-mono bg-gradient-to-r ${exchange.color} bg-clip-text text-transparent`}>
                      {exchange.name === 'Magic Eden' && priceData?.priceSats
                        ? `${priceData.priceSats} sats`
                        : formatPrice(priceData?.price || 0)
                      }
                    </div>
                    {priceData?.change24h !== undefined && priceData.change24h !== 0 && (
                      <div className="flex items-center space-x-1">
                        {priceData.change24h > 0 ? (
                          <TrendingUp className="w-4 h-4 text-green-400" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-red-400" />
                        )}
                        <span className={`text-sm font-mono ${
                          priceData.change24h > 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {formatChange(priceData.change24h)}
                        </span>
                      </div>
                    )}
                    <div className="text-xs text-gray-500 font-mono">
                      {priceData?.lastUpdate?.toLocaleTimeString()}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Linha de baixo: Card da Bitflow (Sponsored) */}
      {(() => {
        const exchange = bitflowExchange;
        const priceData = prices.find(p => p.exchange === exchange.name);
        const isSuccess = priceData?.status === 'success';
        const isError = priceData?.status === 'error';
        const isWorking = exchange.working;

        return (
          <a
            href={exchange.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block cursor-pointer"
          >
            <Card
              variant="glass"
              className={`${exchange.borderColor} ${exchange.hoverBorderColor} transition-all hover:scale-[1.01] hover:shadow-xl`}
            >
v              <CardContent className="p-4 md:p-6 relative">
                {/* Layout Mobile: Vertical / Desktop: Horizontal */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-8">
                  {/* Logo */}
                  <div className="flex items-center justify-center md:justify-start flex-shrink-0">
                    <img 
                      src="/Bitflow.png"
                      alt="Bitflow"
                      className="h-14 md:h-20 w-auto object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                    <div 
                      className="hidden w-16 md:w-24 h-16 md:h-24 bg-gradient-to-r from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-2xl md:text-3xl rounded-lg"
                    >
                      BF
                    </div>
                  </div>

                  {/* Espaçador flexível (apenas desktop) */}
                  <div className="hidden md:block md:flex-1"></div>

                  {/* Preço e Variação */}
                  {!isWorking ? (
                    <div className="text-center md:text-right">
                      <div className="text-gray-400 font-mono text-base md:text-lg">Coming Soon</div>
                    </div>
                  ) : isLoading && !priceData ? (
                    <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
                      <div className="h-10 md:h-12 w-32 md:w-40 bg-gray-700/50 animate-pulse rounded"></div>
                      <div className="h-6 md:h-8 w-24 md:w-32 bg-gray-700/30 animate-pulse rounded"></div>
                    </div>
                  ) : isError ? (
                    <div className="text-center md:text-right">
                      <div className="text-red-400 font-mono text-sm md:text-base">Error</div>
                      <div className="text-xs text-gray-500">{priceData?.error}</div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col md:flex-row items-center gap-2 md:gap-6">
                        {/* Preço em USD e Sats */}
                        <div className="flex flex-col items-center md:items-end gap-1">
                          <div className="text-2xl md:text-4xl font-bold font-mono bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
                            {formatPrice(priceData?.price || 0)}
                          </div>
                          <div className="text-xs md:text-sm text-gray-400 font-mono">
                            {priceData?.priceSats 
                              ? `${priceData.priceSats} sats` 
                              : priceData?.price ? `${(priceData.price * 100000000).toFixed(2)} sats` : ''
                            }
                          </div>
                        </div>
                        
                        {/* Variação e Status na mesma linha */}
                        <div className="flex items-center gap-2 md:gap-3">
                          {/* Variação */}
                          {priceData?.change24h !== undefined && priceData.change24h !== 0 && (
                            <div className="flex items-center gap-2">
                              {priceData.change24h > 0 ? (
                                <TrendingUp className="w-5 md:w-7 h-5 md:h-7 text-green-400" />
                              ) : (
                                <TrendingDown className="w-5 md:w-7 h-5 md:h-7 text-red-400" />
                              )}
                            <span className={`text-lg md:text-2xl font-mono font-bold ${
                              priceData.change24h > 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {formatChange(priceData.change24h)}
                            </span>
                            </div>
                          )}
                          
                          {/* Status Indicator */}
                          {isSuccess && (
                            <div>
                              <div className="w-2 md:w-3 h-2 md:h-3 bg-green-400 rounded-full animate-pulse"></div>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Timestamp - Discreto no canto inferior direito (mobile: centro) */}
                      <div className="text-center md:text-right md:absolute md:bottom-2 md:right-3 mt-1 md:mt-0">
                        <div className="text-xs text-gray-500 font-mono">
                          {priceData?.lastUpdate?.toLocaleTimeString()}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </a>
        );
      })()}
    </div>
  );
}
