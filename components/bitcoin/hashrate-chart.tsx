"use client"

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BitcoinNetworkData } from '@/types/bitcoin';
import { BitcoinApiService } from '@/lib/bitcoin-api';
import { Zap } from 'lucide-react';

interface HashrateChartProps {
  data: BitcoinNetworkData;
}

export function HashrateChart({ data }: HashrateChartProps) {
  const chartData = data.hashrateHistory.map(point => ({
    timestamp: point.timestamp,
    hashrate: point.avgHashrate / 1e18, // Convert to EH/s
    formatted: BitcoinApiService.formatHashRate(point.avgHashrate),
    date: new Date(point.timestamp).toLocaleDateString('pt-BR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit'
    }),
    // Adicionar timestamp em milissegundos para o tooltip
    time: point.timestamp
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      return (
        <div className="bg-gray-800/90 border border-gray-700 rounded-lg p-3 shadow-lg">
          <p className="text-gray-300 font-mono text-sm">
            {new Date(dataPoint.time).toLocaleString('pt-BR')}
          </p>
          <p className="text-green-400 font-mono font-bold">
            {payload[0].value.toFixed(2)} EH/s
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card variant="glass" className="border-green-500/20 hover:border-green-500/40 transition-all">
      <CardHeader>
        <CardTitle className="text-green-400 text-xl flex items-center">
          <Zap className="w-6 h-6 mr-3 text-green-500" />
          Hash Rate History (7 Days)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
              <XAxis 
                dataKey="date"
                stroke="#666"
                fontSize={12}
                fontFamily="JetBrains Mono"
              />
              <YAxis 
                stroke="#666"
                fontSize={12}
                fontFamily="JetBrains Mono"
                tickFormatter={(value) => `${value.toFixed(1)} EH/s`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey="hashrate" 
                stroke="#26a69a" 
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6, fill: '#26a69a' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400 font-mono">
              {BitcoinApiService.formatHashRate(data.hashrate)}
            </div>
            <div className="text-gray-400 text-sm font-mono">Current Hash Rate</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400 font-mono">
              {BitcoinApiService.formatHashRate(Math.max(...data.hashrateHistory.map(h => h.avgHashrate)))}
            </div>
            <div className="text-gray-400 text-sm font-mono">ATH Hash Rate</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white font-mono">
              {data.miningPools.length}
            </div>
            <div className="text-gray-400 text-sm font-mono">Active Mining Pools</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
