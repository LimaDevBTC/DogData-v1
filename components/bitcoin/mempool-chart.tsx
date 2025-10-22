"use client"

import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BitcoinNetworkData } from '@/types/bitcoin';
import { Activity } from 'lucide-react';

interface MempoolChartProps {
  data: BitcoinNetworkData;
}

export function MempoolChart({ data }: MempoolChartProps) {
  // Agrupar fee histogram em faixas maiores para melhor visualização
  const processedData = (data.feeHistogram || [])
    .sort((a, b) => a[0] - b[0]) // Ordenar por taxa crescente
    .reduce((acc, [fee, count]) => {
      // Agrupar em faixas de taxa
      let range: string;
      let order: number;
      if (fee < 0.5) { range = '0-0.5'; order = 1; }
      else if (fee < 1) { range = '0.5-1'; order = 2; }
      else if (fee < 2) { range = '1-2'; order = 3; }
      else if (fee < 3) { range = '2-3'; order = 4; }
      else if (fee < 4) { range = '3-4'; order = 5; }
      else if (fee < 5) { range = '4-5'; order = 6; }
      else if (fee < 7) { range = '5-7'; order = 7; }
      else if (fee < 10) { range = '7-10'; order = 8; }
      else { range = '10+'; order = 9; }

      const existing = acc.find(item => item.range === range);
      if (existing) {
        existing.count += count;
      } else {
        acc.push({ range, count, order });
      }
      return acc;
    }, [] as Array<{ range: string; count: number; order: number }>);

  // Ordenar por order para manter ordem correta
  const chartData = processedData.sort((a, b) => a.order - b.order);

  // Se não há dados, mostrar mensagem
  if (chartData.length === 0) {
    return (
      <Card variant="glass" className="border-blue-500/20 hover:border-blue-500/40 transition-all">
        <CardHeader>
          <CardTitle className="text-blue-400 text-xl flex items-center">
            <Activity className="w-6 h-6 mr-3 text-blue-500" />
            Mempool Fee Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 w-full flex items-center justify-center">
            <div className="text-gray-400 font-mono text-center">
              <div className="text-lg mb-2">No fee data available</div>
              <div className="text-sm">Mempool data is being loaded...</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800/90 border border-gray-700 rounded-lg p-3 shadow-lg">
          <p className="text-gray-300 font-mono text-sm">
            Fee Range: {label} sat/vB
          </p>
          <p className="text-blue-400 font-mono font-bold">
            {payload[0].value.toLocaleString()} vbytes
          </p>
          <p className="text-cyan-400 font-mono text-xs mt-1">
            {((payload[0].value / data.mempoolVsize) * 100).toFixed(1)}% of mempool size
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card variant="glass" className="border-blue-500/20 hover:border-blue-500/40 transition-all">
      <CardHeader>
        <CardTitle className="text-blue-400 text-xl flex items-center">
          <Activity className="w-6 h-6 mr-3 text-blue-500" />
          Mempool Fee Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <defs>
                <linearGradient id="colorMempool" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.2}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
              <XAxis
                dataKey="range"
                stroke="#666"
                fontSize={12}
                fontFamily="JetBrains Mono"
                label={{ value: 'Fee Range (sat/vB)', position: 'insideBottom', offset: -5, fill: '#999', fontFamily: 'JetBrains Mono' }}
              />
              <YAxis
                stroke="#666"
                fontSize={12}
                fontFamily="JetBrains Mono"
                tickFormatter={(value) => {
                  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                  return value.toString();
                }}
                domain={[0, 'auto']}
                label={{ value: 'vbytes', angle: -90, position: 'insideLeft', fill: '#999', fontFamily: 'JetBrains Mono' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#3b82f6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorMempool)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400 font-mono">
              {data.mempoolSize.toLocaleString()}
            </div>
            <div className="text-gray-400 text-sm font-mono">Pending Transactions</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white font-mono">
              {(data.mempoolVsize / 1024 / 1024).toFixed(1)} MB
            </div>
            <div className="text-gray-400 text-sm font-mono">Mempool Size</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400 font-mono">
              {data.fees.fastest} sat/vB
            </div>
            <div className="text-gray-400 text-sm font-mono">Fastest Fee</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
