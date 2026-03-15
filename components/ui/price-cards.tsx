"use client"

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';

interface PriceData {
  exchange: string;
  price: number;
  change24h?: number;
  volume24h?: number;
  lastUpdate: Date;
  status: 'loading' | 'success' | 'error';
  error?: string;
  priceSats?: string | null;
  cached?: boolean;
  stale?: boolean;
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

const dogswapExchange = {
  name: 'Dogswap',
  apiUrl: '/api/price/dogswap',
  color: 'from-sky-500 to-blue-700',
  borderColor: 'border-sky-500/20',
  hoverBorderColor: 'hover:border-sky-500/40',
  icon: 'DS',
  working: true,
  sponsored: true,
  url: 'https://swap.dogofbitcoin.com/'
};

export function PriceCards() {
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPrice = async (
    exchange: typeof exchanges[0] | typeof bitflowExchange | typeof dogswapExchange
  ): Promise<PriceData> => {
    try {
      // Adicionar timeout de 5 segundos
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(exchange.apiUrl, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        // Para status 503, 502, 500 - não lançar erro, apenas retornar status error
        if (response.status >= 500 && response.status < 600) {
          return {
            exchange: exchange.name,
            price: 0,
            lastUpdate: new Date(),
            status: 'error',
            error: `${exchange.name} temporarily unavailable (${response.status})`
          };
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(
          `${exchange.name} returned non-JSON response (content-type: ${contentType || 'unknown'})`
        );
      }

      const data = await response.json();
      
      let price = 0;
      let change24h = 0;
      let volume24h = 0;
      let priceSats: string | null | undefined = undefined;
      
      if (exchange.name === 'Bitflow') {
        price = parseFloat(data.price) || 0;
        change24h = parseFloat(data.change24h) || 0;
        volume24h = parseFloat(data.volume24h || data.volume) || 0;
        priceSats = data.priceSats;
        if (data.stale && data.cached) {
          console.log(`⚠️ ${exchange.name} usando cache antigo (${data.cacheAge}s)`);
        }
      } else if (exchange.name === 'Dogswap') {
        price = parseFloat(data.price) || 0;
        change24h = parseFloat(data.change24h) || 0;
        priceSats = data.priceSats ?? null;
      } else if (exchange.name === 'Kraken') {
        if (data.result && data.result.DOGUSD) {
          const pairData = data.result.DOGUSD;
          price = parseFloat(pairData.c[0]) || 0;
          const openPrice = parseFloat(pairData.o) || 0;
          change24h = openPrice > 0 ? ((price - openPrice) / openPrice) * 100 : 0;
          volume24h = parseFloat(pairData.v[1]) || 0;
        } else {
          price = parseFloat(data.price) || 0;
          change24h = parseFloat(data.change24h) || 0;
          volume24h = parseFloat(data.volume24h) || 0;
        }
      } else {
        price = parseFloat(data.price) || 0;
        change24h = parseFloat(data.change24h) || 0;
        volume24h = parseFloat(data.volume24h) || 0;
      }
      
      return {
        exchange: exchange.name,
        price,
        change24h,
        volume24h,
        lastUpdate: new Date(),
        status: 'success',
        priceSats,
        cached: data?.cached || false,
        stale: data?.stale || false
      };
    } catch (error) {
      // Silenciar logs para erros esperados (503, timeout, etc.)
      const isExpectedError = error instanceof Error && (
        error.message.includes('503') ||
        error.message.includes('502') ||
        error.message.includes('500') ||
        error.message.includes('timeout') ||
        error.message.includes('aborted') ||
        error.message.includes('network') ||
        error.name === 'AbortError'
      );
      
      if (!isExpectedError) {
        console.error(`❌ Error fetching ${exchange.name}:`, error);
      }
      
      let errorMessage = `${exchange.name} API temporarily unavailable`;
      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.message.includes('aborted')) {
          errorMessage = `${exchange.name} timeout (not responding)`;
        } else if (error.message.includes('503')) {
          errorMessage = `${exchange.name} under maintenance`;
        } else if (error.message.includes('timeout')) {
          errorMessage = `${exchange.name} not responding`;
        } else if (error.message.includes('404')) {
          errorMessage = `${exchange.name} endpoint not found`;
        } else if (error.message.includes('500') || error.message.includes('502')) {
          errorMessage = `${exchange.name} server error`;
        }
      } else if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
        errorMessage = `${exchange.name} timeout (not responding)`;
      }
      return {
        exchange: exchange.name,
        price: 0,
        lastUpdate: new Date(),
        status: 'error',
        error: errorMessage
      };
    }
  };

  const fetchAllPrices = async () => {
    setIsLoading(true);
    const allExchanges = [...exchanges, bitflowExchange, dogswapExchange];
    const workingExchanges = allExchanges.filter(exchange => exchange.working);
    const pricePromises = workingExchanges.map(exchange => fetchPrice(exchange));
    const results = await Promise.all(pricePromises);
    
    const resultByExchange: Record<string, PriceData> = {};
    for (const r of results) {
      resultByExchange[r.exchange] = r;
    }

    let nextPrices: PriceData[] = [];
    setPrices((prev) => {
      const previous = prev || [];
      nextPrices = allExchanges.map((exchange) => {
        const newData = exchange.working ? resultByExchange[exchange.name] : undefined;
        const prevData = previous.find((p) => p.exchange === exchange.name);

        // Se veio dado novo válido, usamos ele
        if (newData && newData.status === 'success' && newData.price > 0) {
          return newData;
        }

        // Se não veio dado novo, mas já tínhamos um valor bom antes, mantemos o anterior (stale=true)
        if (prevData && prevData.status === 'success' && prevData.price > 0) {
          return {
            ...prevData,
            stale: true,
          };
        }

        // Sem dado anterior bom: usamos o novo (mesmo com erro) ou um placeholder neutro
        if (newData) {
          return {
            ...newData,
            price: newData.price || 0,
            change24h: newData.change24h || 0,
            stale: true,
        };
        }

        // Totalmente sem informação (primeira chamada falhou completamente)
        return {
          exchange: exchange.name,
          price: 0,
          change24h: 0,
          volume24h: 0,
          lastUpdate: new Date(0),
          status: 'error',
          error: 'Not available',
          priceSats: null,
          stale: true,
        };
    });
      return nextPrices;
    });

    setIsLoading(false);
    console.log('📊 Prices updated:', nextPrices.map((p: PriceData) => `${p.exchange}: $${p.price} (${p.change24h}%)`));
  };

  useEffect(() => {
    fetchAllPrices();
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

  const formatChange = (change: number | undefined) => {
    if (change === undefined || change === null || isNaN(change)) return '0.00%';
    if (change === 0) return '0.00%';
    const sign = change > 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  };

  const renderExchangeCard = (exchange: typeof exchanges[0], index: number) => {
    const priceData = prices.find((p) => p.exchange === exchange.name);
          const isSuccess = priceData?.status === 'success';
    const isStale = !!priceData?.stale;
          const isWorking = exchange.working;
          
          return (
            <Card
              key={exchange.name}
              variant="glass"
        className={`stagger-item ${exchange.borderColor} ${exchange.hoverBorderColor} transition-all lg:h-full ${
                !isWorking ? 'opacity-60' : ''
              }`}
        style={{ animationDelay: `${index * 0.08}s` }}
            >
        <CardHeader className="pb-1.5 md:pb-2.5">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 md:space-x-3">
              <div className="h-8 md:h-12 flex items-center">
                      <img
                        src={`/${
                    exchange.name === 'MEXC'
                      ? 'MEXC '
                      : exchange.name === 'Gate.io'
                      ? 'Gate'
                      : exchange.name
                        }.png`}
                        alt={exchange.name}
                  className="h-7 md:h-10 w-auto object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                <div className="hidden w-8 h-8 md:w-12 md:h-12 bg-gradient-to-r from-elevated to-elevated flex items-center justify-center text-snow font-bold text-xs md:text-base uppercase rounded">
                        {exchange.icon}
                      </div>
                    </div>
              {!isWorking && <span className="text-[10px] md:text-xs text-dusty/70">Soon</span>}
                  </div>
                  {isSuccess && (
                    <div className="flex items-center">
                <div className={`w-1.5 h-1.5 md:w-2 md:h-2 ${isStale ? 'bg-gray-500' : 'bg-green-400'}`}></div>
                    </div>
                  )}
                </CardTitle>
              </CardHeader>
        <CardContent className="p-3 md:p-4 space-y-1.5 md:space-y-3">
                {!isWorking ? (
                  <div className="space-y-2">
              <div className="text-dusty font-mono text-sm">Coming Soon</div>
                    <div className="text-dusty/70 text-xs">API integration pending</div>
                  </div>
                ) : isLoading && !priceData ? (
                  <div className="space-y-2">
              <div className="h-5 bg-elevated/50 animate-pulse rounded"></div>
              <div className="h-4 bg-elevated/30 animate-pulse rounded"></div>
                  </div>
                ) : (
                  <div className="space-y-1 md:space-y-2">
              <div
                className={`text-base md:text-xl font-bold font-mono bg-gradient-to-r ${exchange.color} bg-clip-text text-transparent`}
              >
                      {formatPrice(priceData?.price || 0)}
                    </div>
                    {priceData?.change24h !== undefined && priceData.change24h !== 0 && (
                      <div className="flex items-center space-x-1">
                        {priceData.change24h > 0 ? (
                          <TrendingUp className="w-3 h-3 md:w-4 md:h-4 text-green-400" />
                        ) : (
                          <TrendingDown className="w-3 h-3 md:w-4 md:h-4 text-red-400" />
                        )}
                  <span
                    className={`text-[10px] md:text-xs font-mono ${
                          priceData.change24h > 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                          {formatChange(priceData.change24h)}
                        </span>
                      </div>
                    )}
              <div className="text-[10px] md:text-[11px] text-dusty/70 font-mono">
                      {priceData?.lastUpdate?.toLocaleTimeString()}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
  };

  const dogswapData = prices.find((p) => p.exchange === dogswapExchange.name);
  const dogswapChange = dogswapData?.change24h ?? null;
  const bitflowData = prices.find((p) => p.exchange === bitflowExchange.name);

  const renderPartnerCard = ({
    exchange,
    data,
    desktopPlacementClass = '',
    logoSrc,
    logoClassName,
    priceClassName,
    satsClassName,
    positiveChangeClass,
    negativeChangeClass,
    changeOverride,
    rowSpanClass = '',
    colSpanClass = '',
    wrapperClassName = '',
    horizontal = false,
  }: {
    exchange: typeof bitflowExchange | typeof dogswapExchange;
    data: PriceData | undefined;
    desktopPlacementClass?: string;
    logoSrc: string;
    logoClassName: string;
    priceClassName: string;
    satsClassName: string;
    positiveChangeClass: string;
    negativeChangeClass: string;
    changeOverride?: number | null;
    rowSpanClass?: string;
    colSpanClass?: string;
    wrapperClassName?: string;
    horizontal?: boolean;
  }) => {
    const changeValue = changeOverride ?? data?.change24h ?? null;

    const formatSatsDisplay = () => {
      if (exchange.name === 'Dogswap') {
        if (data?.priceSats) {
          return `${Number(data.priceSats).toLocaleString('en-US')} sats`;
        }
        if (data?.price) {
          return `${(data.price * 100_000_000).toFixed(2)} sats`;
        }
        return '— sats';
      }

      if (data?.priceSats) {
        return `${parseFloat(data.priceSats).toFixed(2)} sats`;
      }
      if (data?.price) {
        return `${(data.price * 100000000).toFixed(2)} sats`;
      }
      return '— sats';
    };

    if (horizontal) {
      return (
        <a
          key={exchange.name}
          href={exchange.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`block h-full ${desktopPlacementClass} ${rowSpanClass} ${colSpanClass} ${wrapperClassName}`}
        >
          <Card
            variant="glass"
            className={`${exchange.borderColor} ${exchange.hoverBorderColor} transition-all hover:scale-[1.01] hover:shadow-xl h-full`}
          >
            <CardContent className="p-2.5 md:p-4 h-full">
              <div className="flex items-center gap-3 md:gap-5 h-full">
                {/* Logo */}
                <img
                  src={logoSrc}
                  alt={exchange.name}
                  className={logoClassName}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />

                {/* Price + Sats */}
                <div className="flex-1 flex flex-col gap-0.5 md:gap-1 min-w-0">
                  {isLoading && !data ? (
                    <div className="space-y-2">
                      <div className="h-6 bg-elevated/50 animate-pulse rounded"></div>
                      <div className="h-3 bg-elevated/30 animate-pulse rounded w-2/3"></div>
                    </div>
                  ) : (
                    <>
                      <div className={`text-sm md:text-xl font-bold font-mono ${priceClassName} leading-tight`}>
                        {formatPrice(data?.price || 0)}
                      </div>
                      <div className={`${satsClassName} font-mono`}>
                        {formatSatsDisplay()}
                      </div>
                    </>
                  )}
                </div>

                {/* Change + Status */}
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  {changeValue !== null && changeValue !== undefined && (
                    <div className="flex items-center gap-1">
                      {changeValue > 0 ? (
                        <TrendingUp className="w-3 h-3 md:w-4 md:h-4 text-sky-300" />
                      ) : changeValue < 0 ? (
                        <TrendingDown className="w-3 h-3 md:w-4 md:h-4 text-red-400" />
                      ) : null}
                      <span
                        className={`text-[10px] md:text-xs font-mono font-semibold ${
                          changeValue > 0
                            ? positiveChangeClass
                            : changeValue < 0
                            ? negativeChangeClass
                            : 'text-dusty'
                        }`}
                      >
                        {formatChange(changeValue)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] md:text-[11px] text-dusty/70 font-mono">
                      {data?.lastUpdate?.toLocaleTimeString()}
                    </span>
                    {data?.status === "success" && (
                      <div className={`w-1.5 h-1.5 md:w-2 md:h-2 ${data?.stale ? 'bg-gray-500' : 'bg-green-400'}`}></div>
                    )}
                    <ExternalLink className="text-dusty w-2.5 h-2.5 md:w-3 md:h-3" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </a>
      );
    }

    return (
      <a
        key={exchange.name}
        href={exchange.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`block h-full ${desktopPlacementClass} ${rowSpanClass} ${colSpanClass} ${wrapperClassName}`}
      >
        <Card
          variant="glass"
          className={`${exchange.borderColor} ${exchange.hoverBorderColor} transition-all hover:scale-[1.01] hover:shadow-xl h-full`}
        >
          <CardContent className="p-3 md:p-6 h-full flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <img
                src={logoSrc}
                alt={exchange.name}
                className={logoClassName}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div className="flex items-center gap-1">
                <ExternalLink className="text-dusty w-2.5 h-2.5 md:w-3 md:h-3" />
                {data?.status === "success" && (
                  <div className={`w-1.5 h-1.5 md:w-2 md:h-2 ${data?.stale ? 'bg-gray-500' : 'bg-green-400'}`}></div>
                )}
              </div>
            </div>

            <div className="mt-2 md:mt-6 flex-1 flex flex-col gap-1.5 md:gap-4 justify-center">
              {isLoading && !data ? (
                <div className="space-y-2">
                  <div className="h-6 bg-elevated/50 animate-pulse rounded"></div>
                  <div className="h-3 bg-elevated/30 animate-pulse rounded w-2/3"></div>
                </div>
              ) : (
                <>
                  <div className={`text-xl md:text-4xl font-bold font-mono ${priceClassName}`}>
                    {formatPrice(data?.price || 0)}
                  </div>
                  <div className={`${satsClassName} font-mono`}>
                    {formatSatsDisplay()}
                  </div>
                  {changeValue !== null && changeValue !== undefined && (
                    <div className="flex items-center gap-1.5">
                      {changeValue > 0 ? (
                        <TrendingUp className="w-3 h-3 md:w-4 md:h-4 text-sky-300" />
                      ) : changeValue < 0 ? (
                        <TrendingDown className="w-3 h-3 md:w-4 md:h-4 text-red-400" />
                      ) : null}
                      <span
                        className={`text-[10px] md:text-xs font-mono ${
                          changeValue > 0
                            ? positiveChangeClass
                            : changeValue < 0
                            ? negativeChangeClass
                            : 'text-dusty'
                        }`}
                      >
                        {formatChange(changeValue)}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="text-[10px] md:text-xs text-dusty/70 font-mono mt-1.5 md:mt-4">
              {data?.lastUpdate?.toLocaleTimeString()}
            </div>
          </CardContent>
        </Card>
      </a>
    );
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-4">
      {/* Bitflow - Sponsored Partner (spans 2 columns, horizontal layout) */}
      {renderPartnerCard({
        exchange: bitflowExchange,
        data: bitflowData,
        colSpanClass: 'col-span-2',
        horizontal: true,
        logoSrc: '/Bitflow.png',
        logoClassName: 'h-10 md:h-20 w-auto object-contain flex-shrink-0',
        priceClassName: 'bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent',
        satsClassName: 'text-[10px] md:text-sm text-dusty',
        positiveChangeClass: 'text-orange-200',
        negativeChangeClass: 'text-red-400',
      })}

      {/* Dogswap - Sponsored Partner (spans 2 columns, horizontal layout) */}
      {renderPartnerCard({
        exchange: dogswapExchange,
        data: dogswapData,
        colSpanClass: 'col-span-2',
        horizontal: true,
        logoSrc: '/dogswap_logo.png',
        logoClassName: 'h-6 md:h-10 w-auto object-contain flex-shrink-0',
        priceClassName: 'text-snow',
        satsClassName: 'text-[10px] md:text-sm text-dusty',
        positiveChangeClass: 'text-sky-300',
        negativeChangeClass: 'text-red-400',
        changeOverride: dogswapChange,
      })}

      {/* Exchanges: MEXC, Kraken, Gate.io, Bitget */}
      {exchanges.map((exchange, index) => renderExchangeCard(exchange, index))}
    </div>
  );
}
