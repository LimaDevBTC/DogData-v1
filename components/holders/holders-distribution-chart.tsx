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
  totalSupply: number; // Circulating supply em DOG (usado apenas como referência)
}

interface DistributionData {
  name: string;
  value: number;
  percentage: number;
  holders: number;
  color: string;
}

export function HoldersDistributionChart({ allHolders, totalSupply }: HoldersDistributionChartProps) {
  const distributionData = useMemo(() => {
    if (!allHolders || allHolders.length === 0) {
      return [];
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

    // Para o gráfico de pizza, precisamos das diferenças (não acumulado)
    // Mas na legenda mostraremos os valores acumulados
    const top10Only = top10Accumulated; // 1-10
    const top11to50Only = top50Accumulated - top10Accumulated; // 11-50 (diferença)
    const top51to100Only = top100Accumulated - top50Accumulated; // 51-100 (diferença)

    // Calcular total de DOG de todos os holders (base para percentuais)
    const totalDogFromHolders = top100Accumulated + others;

    // Calcular percentuais acumulados para exibição
    const top10Percentage = totalDogFromHolders > 0 ? (top10Accumulated / totalDogFromHolders) * 100 : 0;
    const top50Percentage = totalDogFromHolders > 0 ? (top50Accumulated / totalDogFromHolders) * 100 : 0;
    const top100Percentage = totalDogFromHolders > 0 ? (top100Accumulated / totalDogFromHolders) * 100 : 0;
    const othersPercentage = totalDogFromHolders > 0 ? (others / totalDogFromHolders) * 100 : 0;

    // Calcular percentuais para o gráfico (diferenças)
    const top10OnlyPercentage = totalDogFromHolders > 0 ? (top10Only / totalDogFromHolders) * 100 : 0;
    const top11to50OnlyPercentage = totalDogFromHolders > 0 ? (top11to50Only / totalDogFromHolders) * 100 : 0;
    const top51to100OnlyPercentage = totalDogFromHolders > 0 ? (top51to100Only / totalDogFromHolders) * 100 : 0;

    const data: DistributionData[] = [
      {
        name: 'Top 10',
        value: top10Accumulated, // Valor acumulado para exibição
        percentage: top10Percentage, // Percentual acumulado
        holders: top10Count,
        color: '#3b82f6', // Blue
      },
      {
        name: 'Top 50',
        value: top50Accumulated, // Valor acumulado
        percentage: top50Percentage, // Percentual acumulado
        holders: top50Count,
        color: '#06b6d4', // Cyan/Teal
      },
      {
        name: 'Top 100',
        value: top100Accumulated, // Valor acumulado
        percentage: top100Percentage, // Percentual acumulado
        holders: top100Count,
        color: '#f97316', // Orange
      },
      {
        name: 'Others',
        value: others,
        percentage: othersPercentage,
        holders: othersCount,
        color: '#a855f7', // Purple
      },
    ];

    // Dados para o gráfico (usando diferenças para não sobrepor)
    const chartData = [
      {
        name: 'Top 1-10',
        value: top10Only,
        percentage: top10OnlyPercentage,
        holders: top10Count,
        color: '#3b82f6',
      },
      {
        name: 'Top 11-50',
        value: top11to50Only,
        percentage: top11to50OnlyPercentage,
        holders: top50Count - top10Count,
        color: '#06b6d4',
      },
      {
        name: 'Top 51-100',
        value: top51to100Only,
        percentage: top51to100OnlyPercentage,
        holders: top100Count - top50Count,
        color: '#f97316',
      },
      {
        name: 'Others',
        value: others,
        percentage: othersPercentage,
        holders: othersCount,
        color: '#a855f7',
      },
    ].filter(item => item.value > 0);

    // Retornar dados acumulados para exibição na legenda
    // e dados de diferenças para o gráfico
    return {
      displayData: data.filter(item => item.value > 0), // Dados acumulados para legenda
      chartData: chartData, // Dados de diferenças para gráfico
    };
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

  if (!distributionData || !distributionData.chartData || distributionData.chartData.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8 items-center justify-center">
      {/* Gráfico de Pizza (Donut) */}
      <div className="w-full lg:w-1/2 max-w-md">
        <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={distributionData.chartData}
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

