"use client"

import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

interface Holder {
  rank: number;
  address: string;
  total_amount: number;
  total_dog: number;
  utxo_count?: number;
}

interface HoldersDistributionChartProps {
  allHolders: Holder[];
  totalSupply?: number; // Circulating supply em DOG (usado apenas como referência, opcional)
}

interface DistributionData {
  name: string;
  value: number;
  percentage: number;
  holders: number;
  color: string;
}

interface DistributionResult {
  displayData: DistributionData[];
  chartData: DistributionData[];
}

export function HoldersDistributionChart({ allHolders, totalSupply }: HoldersDistributionChartProps) {
  const distributionData = useMemo<DistributionResult | null>(() => {
    if (!allHolders || allHolders.length === 0) {
      return null;
    }

    // Calcular valores acumulados
    let top10Accumulated = 0; // Carteiras 1-10
    let top50Accumulated = 0; // Carteiras 1-50 (inclui top 10)
    let top100Accumulated = 0; // Carteiras 1-100 (inclui top 50 e top 10)
    let others = 0; // Carteiras 101+

    let top10Count = 0;
    let top50Count = 0;
    let top100Count = 0;
    let othersCount = 0;

    allHolders.forEach((holder) => {
      const dogAmount = holder.total_dog || 0;
      
      if (holder.rank >= 1 && holder.rank <= 10) {
        top10Accumulated += dogAmount;
        top50Accumulated += dogAmount;
        top100Accumulated += dogAmount;
        top10Count++;
        top50Count++;
        top100Count++;
      } else if (holder.rank >= 11 && holder.rank <= 50) {
        top50Accumulated += dogAmount;
        top100Accumulated += dogAmount;
        top50Count++;
        top100Count++;
      } else if (holder.rank >= 51 && holder.rank <= 100) {
        top100Accumulated += dogAmount;
        top100Count++;
      } else {
        others += dogAmount;
        othersCount++;
      }
    });

    // Calcular valores estratificados (exclusivos por faixa, não acumulados)
    const top10Only = top10Accumulated; // 1-10 (valor exclusivo)
    const top11to50Only = top50Accumulated - top10Accumulated; // 11-50 (valor exclusivo)
    const top51to100Only = top100Accumulated - top50Accumulated; // 51-100 (valor exclusivo)

    // Calcular total de DOG de todos os holders (base para percentuais)
    const totalDogFromHolders = top100Accumulated + others;

    // Calcular percentuais estratificados (não acumulados)
    const top10OnlyPercentage = totalDogFromHolders > 0 ? (top10Only / totalDogFromHolders) * 100 : 0;
    const top11to50OnlyPercentage = totalDogFromHolders > 0 ? (top11to50Only / totalDogFromHolders) * 100 : 0;
    const top51to100OnlyPercentage = totalDogFromHolders > 0 ? (top51to100Only / totalDogFromHolders) * 100 : 0;
    const othersPercentage = totalDogFromHolders > 0 ? (others / totalDogFromHolders) * 100 : 0;

    // Dados estratificados para exibição (gráfico e tabela usam os mesmos dados)
    const distributionData: DistributionData[] = [
      {
        name: 'Top 1-10',
        value: top10Only, // Valor exclusivo da faixa 1-10
        percentage: top10OnlyPercentage, // Percentual exclusivo
        holders: top10Count,
        color: '#3b82f6', // Blue
      },
      {
        name: 'Top 11-50',
        value: top11to50Only, // Valor exclusivo da faixa 11-50
        percentage: top11to50OnlyPercentage, // Percentual exclusivo
        holders: top50Count - top10Count,
        color: '#06b6d4', // Cyan/Teal
      },
      {
        name: 'Top 51-100',
        value: top51to100Only, // Valor exclusivo da faixa 51-100
        percentage: top51to100OnlyPercentage, // Percentual exclusivo
        holders: top100Count - top50Count,
        color: '#f97316', // Orange
      },
      {
        name: 'Others',
        value: others,
        percentage: othersPercentage,
        holders: othersCount,
        color: '#a855f7', // Purple
      },
    ].filter(item => item.value > 0);

    // Retornar dados estratificados para gráfico e tabela (mesmos dados)
    const result: DistributionResult = {
      displayData: distributionData, // Dados estratificados para tabela
      chartData: distributionData, // Dados estratificados para gráfico
    };
    return result;
  }, [allHolders, totalSupply]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as DistributionData;
      return (
        <div className="bg-black/90 border border-gray-700 rounded-lg p-3 shadow-xl">
          <p className="text-white font-mono font-semibold mb-2">{data.name}</p>
          <p className="text-gray-300 font-mono text-sm">
            <span className="text-blue-400">Holders:</span> {data.holders.toLocaleString('en-US')}
          </p>
          <p className="text-gray-300 font-mono text-sm">
            <span className="text-green-400">DOG:</span> {data.value.toLocaleString('en-US', { 
              minimumFractionDigits: 2, 
              maximumFractionDigits: 2 
            })}
          </p>
          <p className="text-gray-300 font-mono text-sm">
            <span className="text-yellow-400">Percentage:</span> {data.percentage.toFixed(2)}%
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        className="font-mono text-sm font-semibold"
      >
        {`${(percent * 100).toFixed(1)}%`}
      </text>
    );
  };

  if (!distributionData || !distributionData?.chartData || distributionData.chartData.length === 0) {
    console.warn('⚠️ Gráfico: Não renderizando - dados ausentes', {
      hasData: !!distributionData,
      hasChartData: !!distributionData?.chartData,
      chartDataLength: distributionData?.chartData?.length || 0,
      allHoldersLength: allHolders?.length || 0
    })
    return null;
  }
  
  console.log('✅ Gráfico: Renderizando com', distributionData.chartData.length, 'categorias e', allHolders.length, 'holders')

  return (
    <div className="flex flex-col lg:flex-row gap-8 items-center justify-center">
      {/* Gráfico de Pizza (Donut) */}
      <div className="w-full lg:w-1/2 max-w-md relative">
        <ResponsiveContainer width="100%" height={400}>
          <PieChart>
            <Pie
              data={distributionData.chartData.map(item => ({
                name: item.name,
                value: item.value,
                percentage: item.percentage,
                holders: item.holders,
                color: item.color,
              }))}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={CustomLabel}
              outerRadius={120}
              innerRadius={60}
              fill="#8884d8"
              dataKey="value"
            >
              {distributionData.chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legenda com detalhes */}
      <div className="w-full lg:w-1/2 space-y-4">
        <h3 className="text-white font-mono text-lg font-semibold mb-4">Distribution Details</h3>
            {distributionData.displayData.map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-black/30 rounded-lg border border-gray-700/50 hover:border-gray-600 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: item.color }}
                  />
                  <div>
                    <p className="text-white font-mono font-semibold">{item.name}</p>
                    <p className="text-gray-400 font-mono text-xs">
                      {item.holders.toLocaleString('en-US')} holder{item.holders !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-orange-400 font-mono font-bold text-lg">
                    {item.percentage.toFixed(2)}%
                  </p>
                  <p className="text-gray-400 font-mono text-xs">
                    {item.value.toLocaleString('en-US', { 
                      minimumFractionDigits: 2, 
                      maximumFractionDigits: 2 
                    })} DOG
                  </p>
                  <p className="text-gray-500 font-mono text-[10px] mt-0.5">
                    {item.value.toLocaleString('en-US', { 
                      minimumFractionDigits: 0, 
                      maximumFractionDigits: 0,
                      notation: 'compact',
                      compactDisplay: 'short'
                    })} DOG
                  </p>
                </div>
              </div>
            ))}
      </div>
    </div>
  );
}

