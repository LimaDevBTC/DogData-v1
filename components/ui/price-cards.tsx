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
    color: 'from-[#EB136C] to-[#C41159]',
    borderColor: 'border-[#EB136C]/20',
    hoverBorderColor: 'hover:border-[#EB136C]/40',
    icon: 'ME',
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
      const response = await fetch(exchange.apiUrl);
      if (!response.ok) {
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
      
      if (exchange.name === 'Bitflow' || exchange.name === 'Magic Eden') {
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
      console.error(`❌ Error fetching ${exchange.name}:`, error);
      let errorMessage = `${exchange.name} API temporarily unavailable`;
      if (error instanceof Error) {
        if (error.message.includes('503')) {
          errorMessage = `${exchange.name} under maintenance`;
        } else if (error.message.includes('timeout') || error.message.includes('aborted')) {
          errorMessage = `${exchange.name} not responding`;
        } else if (error.message.includes('404')) {
          errorMessage = `${exchange.name} endpoint not found`;
        } else if (error.message.includes('500') || error.message.includes('502')) {
          errorMessage = `${exchange.name} server error`;
        }
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
        <CardHeader className="pb-2.5">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
              <div className="h-12 flex items-center">
                      <img 
                        src={`/${
                    exchange.name === 'MEXC'
                      ? 'MEXC '
                      : exchange.name === 'Gate.io'
                      ? 'Gate'
                      : exchange.name === 'Magic Eden'
                      ? 'MagicEden'
                      : exchange.name
                        }.png`}
                        alt={exchange.name}
                  className="h-10 w-auto object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                <div className="hidden w-12 h-12 bg-gradient-to-r from-gray-600 to-gray-700 flex items-center justify-center text-white font-bold text-base uppercase rounded">
                        {exchange.icon}
                      </div>
                    </div>
              {!isWorking && <span className="text-xs text-gray-500">Coming Soon</span>}
                  </div>
                  {isSuccess && (
                    <div className="flex items-center">
                <div className={`w-2 h-2 ${isStale ? 'bg-gray-500' : 'bg-green-400'}`}></div>
                    </div>
                  )}
                </CardTitle>
              </CardHeader>
        <CardContent className="p-4 space-y-3">
                {!isWorking ? (
                  <div className="space-y-2">
              <div className="text-gray-400 font-mono text-sm">Coming Soon</div>
                    <div className="text-gray-500 text-xs">API integration pending</div>
                  </div>
                ) : isLoading && !priceData ? (
                  <div className="space-y-2">
              <div className="h-5 bg-gray-700/50 animate-pulse rounded"></div>
              <div className="h-4 bg-gray-700/30 animate-pulse rounded"></div>
                  </div>
                ) : (
                  <div className="space-y-2">
              <div
                className={`text-xl font-bold font-mono bg-gradient-to-r ${exchange.color} bg-clip-text text-transparent`}
              >
                      {exchange.name === 'Magic Eden' && priceData?.priceSats
                        ? `${priceData.priceSats} sats`
                  : formatPrice(priceData?.price || 0)}
                    </div>
                    {priceData?.change24h !== undefined && priceData.change24h !== 0 && (
                      <div className="flex items-center space-x-1">
                        {priceData.change24h > 0 ? (
                          <TrendingUp className="w-4 h-4 text-green-400" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-red-400" />
                        )}
                  <span
                    className={`text-xs font-mono ${
                          priceData.change24h > 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                          {formatChange(priceData.change24h)}
                        </span>
                      </div>
                    )}
              <div className="text-[11px] text-gray-500 font-mono">
                      {priceData?.lastUpdate?.toLocaleTimeString()}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
  };

  const dogswapData = prices.find((p) => p.exchange === dogswapExchange.name);
  const magicEdenData = prices.find((p) => p.exchange === "Magic Eden");
  const dogswapChange =
    dogswapData && dogswapData.change24h && dogswapData.change24h !== 0
      ? dogswapData.change24h
      : magicEdenData?.change24h;
  const bitflowData = prices.find((p) => p.exchange === bitflowExchange.name);
  const firstRowExchanges = exchanges.slice(0, 3);
  const secondRowExchanges = exchanges.slice(3);

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
    wrapperClassName = '',
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
    wrapperClassName?: string;
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

        return (
          <a
        key={exchange.name}
            href={exchange.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`block h-full ${desktopPlacementClass} ${rowSpanClass} ${wrapperClassName}`}
      >
        <Card
          variant="glass"
          className={`${exchange.borderColor} ${exchange.hoverBorderColor} transition-all hover:scale-[1.01] hover:shadow-xl h-full`}
        >
          <CardContent className="p-5 md:p-6 h-full flex flex-col justify-between">
            <div className="flex flex-col gap-3">
              <div className="flex justify-end items-center gap-1 text-gray-400 text-[10px] font-mono font-medium uppercase tracking-wide whitespace-nowrap">
                <span>Official Partner</span>
                <ExternalLink className="text-gray-400 w-3.5 h-3.5" />
              </div>
              <img
                src={logoSrc}
                alt={exchange.name}
                className={logoClassName}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>

            <div className="mt-6 flex-1 flex flex-col gap-4 justify-center">
              {isLoading && !data ? (
                <div className="space-y-3">
                  <div className="h-8 bg-gray-700/50 animate-pulse rounded"></div>
                  <div className="h-4 bg-gray-700/30 animate-pulse rounded w-2/3"></div>
                </div>
              ) : (
                <>
                  <div className={`text-3xl md:text-4xl font-bold font-mono ${priceClassName}`}>
                    {formatPrice(data?.price || 0)}
                  </div>
                  <div className={`${satsClassName} font-mono`}>
                    {formatSatsDisplay()}
                  </div>
                  {changeValue !== null && changeValue !== undefined && (
                    <div className="flex items-center gap-2">
                      {changeValue > 0 ? (
                        <TrendingUp className="w-4 h-4 text-sky-300" />
                      ) : changeValue < 0 ? (
                        <TrendingDown className="w-4 h-4 text-red-400" />
                      ) : null}
                      <span
                        className={`text-xs font-mono ${
                          changeValue > 0
                            ? positiveChangeClass
                            : changeValue < 0
                            ? negativeChangeClass
                            : 'text-gray-400'
                        }`}
                      >
                        {formatChange(changeValue)}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500 font-mono mt-4">
              <span>{data?.lastUpdate?.toLocaleTimeString()}</span>
              {data?.status === "success" && (
                <div className={`w-2 h-2 ${data?.stale ? 'bg-gray-500' : 'bg-green-400'}`}></div>
              )}
            </div>
          </CardContent>
        </Card>
      </a>
    );
  };

  return (
    <div className="space-y-6">
      {/* Bitflow em destaque no topo (desktop) */}
      <div className="hidden lg:block">
        <a
          href={bitflowExchange.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block cursor-pointer"
          >
            <Card
              variant="glass"
            className={`${bitflowExchange.borderColor} ${bitflowExchange.hoverBorderColor} transition-all hover:scale-[1.01] hover:shadow-xl`}
            >
              <CardContent className="p-4 md:p-6 relative">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-8">
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

                  <div className="hidden md:block md:flex-1"></div>

                <div className="flex flex-col items-center md:items-end gap-2 md:gap-1.5">
                  <div className="flex items-center gap-1.5 -mb-1">
                    <span className="text-gray-400 text-[10px] font-mono font-medium uppercase tracking-wide">
                      Official Partner
                    </span>
                    <ExternalLink className="w-3 h-3 text-gray-400" />
                    </div>

                      <div className="flex flex-col md:flex-row items-center md:items-center gap-2 md:gap-6">
                    <div className="flex flex-col items-center md:items-end gap-1">
                          <div className="text-2xl md:text-4xl font-bold font-mono bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent leading-none">
                        {formatPrice(bitflowData?.price || 0)}
                          </div>
                          <div className="text-xs md:text-sm text-gray-400 font-mono">
                        {bitflowData?.priceSats
                          ? `${parseFloat(bitflowData.priceSats).toFixed(2)} sats`
                          : bitflowData?.price
                          ? `${(bitflowData.price * 100000000).toFixed(2)} sats`
                          : ''}
                          </div>
                        </div>
                        
                    <div className="flex items-center gap-2 md:gap-3">
                      {bitflowData?.change24h !== undefined && bitflowData.change24h !== 0 && (
                            <div className="flex items-center gap-2">
                          {bitflowData.change24h > 0 ? (
                                <TrendingUp className="w-5 md:w-7 h-5 md:h-7 text-green-400" />
                              ) : (
                                <TrendingDown className="w-5 md:w-7 h-5 md:h-7 text-red-400" />
                              )}
                          <span
                            className={`text-lg md:text-2xl font-mono font-bold ${
                              bitflowData.change24h > 0 ? 'text-green-400' : 'text-red-400'
                            }`}
                          >
                            {formatChange(bitflowData.change24h || 0)}
                            </span>
                            </div>
                          )}
                          
                      {bitflowData?.status === "success" && (
                            <div>
                          <div className={`w-2 md:w-3 h-2 md:h-3 ${bitflowData?.stale ? 'bg-gray-500' : 'bg-green-400'}`}></div>
                            </div>
                          )}
                        </div>
                      </div>
                </div>
              </div>

              <div className="mt-4 text-xs text-gray-500 font-mono text-right">
                {bitflowData?.lastUpdate?.toLocaleTimeString()}
                </div>
              </CardContent>
            </Card>
          </a>
      </div>

      {/* Mobile: Bitflow e Dogswap primeiro */}
      <div className="lg:hidden space-y-4">
        {renderPartnerCard({
          exchange: bitflowExchange,
          data: bitflowData,
          logoSrc: '/Bitflow.png',
          logoClassName: 'self-start h-17 md:h-21 w-auto object-contain',
          priceClassName: 'bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent',
          satsClassName: 'text-sm md:text-base text-gray-400',
          positiveChangeClass: 'text-orange-200',
          negativeChangeClass: 'text-red-400',
        })}

        {renderPartnerCard({
          exchange: dogswapExchange,
          data: dogswapData,
          logoSrc: '/dogswap_logo.png',
          logoClassName: 'self-start h-12 md:h-16 w-auto object-contain',
          priceClassName: 'text-white',
          satsClassName: 'text-sm md:text-base text-gray-400',
          positiveChangeClass: 'text-sky-300',
          negativeChangeClass: 'text-red-400',
          changeOverride: dogswapChange,
        })}
      </div>

      {/* Grade de corretoras + Dogswap grande (desktop) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1fr)] gap-4 lg:auto-rows-[minmax(0,1fr)]">
        {firstRowExchanges.map((exchange, index) => renderExchangeCard(exchange, index))}

        {renderPartnerCard({
          exchange: dogswapExchange,
          data: dogswapData,
          desktopPlacementClass: 'lg:col-start-4 lg:row-start-1',
          rowSpanClass: 'lg:row-span-2',
          logoSrc: '/dogswap_logo.png',
          logoClassName: 'self-start h-12 md:h-16 w-auto object-contain',
          priceClassName: 'text-white',
          satsClassName: 'text-sm md:text-base text-gray-400',
          positiveChangeClass: 'text-sky-300',
          negativeChangeClass: 'text-red-400',
          changeOverride: dogswapChange,
          wrapperClassName: 'hidden lg:block',
        })}

        {secondRowExchanges.map((exchange, index) =>
          renderExchangeCard(exchange, index + firstRowExchanges.length)
        )}
      </div>
    </div>
  );
}
