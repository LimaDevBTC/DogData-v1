"use client"

import { useState, useEffect } from "react"
import { Layout } from "@/components/layout"
import { LoadingScreen } from "@/components/loading-screen"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SectionDivider } from "@/components/ui/section-divider"
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Activity,
  Users,
  Coins,
  PieChart,
  LineChart,
  Zap
} from "lucide-react"
import { MetricSparkline } from "@/components/ui/metric-sparkline"
import { HistoricalChartsSection } from "@/components/metrics/historical-charts"
import { 
  LineChart as RechartsLineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
  AreaChart,
  Area,
  Treemap
} from "recharts"


interface UTXOMetrics {
  total_utxos: number
  avg_utxo_size: number
  utxo_distribution: {
    range: string
    count: number
    supply: number
    percentage: number
  }[]
}

interface HolderConcentration {
  gini_coefficient: number
  top10_supply_pct: number
  top100_supply_pct: number
  top1000_supply_pct: number
}

interface UTXOCountHistoryItem {
  date: string
  total_utxos: number
}

type UTXOCountHistory = UTXOCountHistoryItem[]

interface UTXOAgeStats {
  total_utxos: number
  total_supply: number
  avg_age_days: number
  median_age_days: number
  sth_supply: number
  lth_supply: number
  sth_percentage: number
  lth_percentage: number
  hodl_waves: {
    range: string
    supply: number
    percentage: number
  }[]
}

interface RealizedCapMetrics {
  realized_cap: number
  market_cap: number
  mvrv_ratio: number
  current_price: number
  last_updated: string
}

interface SupplyProfitLoss {
  supply_in_profit: number
  supply_in_loss: number
  supply_in_profit_pct: number
  supply_in_loss_pct: number
  current_price: number
  last_updated: string
}

export default function MetricsPage() {
  const [loading, setLoading] = useState(true)
  const [utxoMetrics, setUtxoMetrics] = useState<UTXOMetrics | null>(null)
  const [holderConcentration, setHolderConcentration] = useState<HolderConcentration | null>(null)
  const [utxoCountHistory, setUtxoCountHistory] = useState<UTXOCountHistory>([])
  const [utxoAgeStats, setUtxoAgeStats] = useState<UTXOAgeStats | null>(null)
  const [realizedCapMetrics, setRealizedCapMetrics] = useState<RealizedCapMetrics | null>(null)
  const [supplyProfitLoss, setSupplyProfitLoss] = useState<SupplyProfitLoss | null>(null)
  const [sparklineData, setSparklineData] = useState<any[]>([])

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true)
        
        // Buscar todas as APIs em paralelo para melhor performance
        // Usar no-cache para garantir dados atualizados
        const cacheBuster = `?t=${Date.now()}`
        const [utxoResponse, concentrationResponse, historyResponse, ageResponse, realizedCapResponse, profitLossResponse] = await Promise.all([
          fetch(`/api/metrics/utxo${cacheBuster}`, { cache: 'no-store' }),
          fetch(`/api/metrics/holder-concentration${cacheBuster}`, { cache: 'no-store' }),
          fetch(`/api/metrics/utxo-count-history?range=all${cacheBuster}`, { cache: 'no-store' }),
          fetch(`/api/metrics/utxo-age${cacheBuster}`, { cache: 'no-store' }),
          fetch(`/api/metrics/realized-cap${cacheBuster}`, { cache: 'no-store' }),
          fetch(`/api/metrics/supply-profit-loss${cacheBuster}`, { cache: 'no-store' })
        ])

        // Processar respostas em paralelo
        const [utxoData, concentrationData, historyData, ageData, realizedCapData, profitLossData] = await Promise.all([
          utxoResponse.ok ? utxoResponse.json().catch(() => null) : null,
          concentrationResponse.ok ? concentrationResponse.json().catch(() => null) : null,
          historyResponse.ok ? historyResponse.json().catch(() => null) : null,
          ageResponse.ok ? ageResponse.json().catch(() => null) : (ageResponse.status === 404 ? { error: 'not_found' } : null),
          realizedCapResponse.ok ? realizedCapResponse.json().catch(() => null) : null,
          profitLossResponse.ok ? profitLossResponse.json().catch(() => null) : null
        ])

        // Atualizar estados conforme dados chegam
        if (utxoData) setUtxoMetrics(utxoData)
        if (concentrationData) setHolderConcentration(concentrationData)
        if (historyData) setUtxoCountHistory(historyData.history || [])
        if (ageData && !ageData.error) {
          setUtxoAgeStats(ageData)
        } else if (ageData?.error) {
          console.warn('UTXO age stats not available:', ageData.message || ageData.error)
        } else if (!ageResponse.ok) {
          console.warn('Failed to fetch UTXO age stats:', ageResponse.status, ageResponse.statusText)
        }
        if (realizedCapData && !realizedCapData.error) {
          setRealizedCapMetrics(realizedCapData)
        }
        if (profitLossData && !profitLossData.error) {
          setSupplyProfitLoss(profitLossData)
        }

        // Fetch sparkline data (non-blocking)
        fetch('/api/metrics/history?range=7d', { cache: 'no-store' })
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data?.history?.length > 0) setSparklineData(data.history)
          })
          .catch(err => console.warn('Sparkline data not available:', err))
      } catch (error) {
        console.error('Error fetching metrics:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchMetrics()
  }, [])

  // Remove gray backgrounds created by Recharts on hover and enforce Treemap colors
  useEffect(() => {
    const removeGrayBackgrounds = () => {
      const charts = document.querySelectorAll('.hodl-waves-chart, .holder-concentration-chart, .supply-profit-loss-chart')
      charts.forEach(chart => {
        const svg = chart.querySelector('svg')
        if (svg) {
          // MutationObserver to watch for new elements
          const observer = new MutationObserver(() => {
            const rects = svg.querySelectorAll('rect')
            rects.forEach(rect => {
              const fill = rect.getAttribute('fill')
              const computedStyle = window.getComputedStyle(rect)
              
              if (fill) {
                // Lista de cores permitidas (nossas cores de gradiente)
                const allowedColors = [
                  '#F97316', '#FB923C', '#EA580C', '#10B981', '#F59E0B', '#C2410C', '#9A3412',
                  '#059669', '#EF4444', '#DC2626'
                ]
                const isAllowedColor = allowedColors.includes(fill) || 
                                       fill.includes('url(#color') ||
                                       fill.includes('10B981') || fill.includes('059669') ||
                                       fill.includes('EF4444') || fill.includes('DC2626') ||
                                       fill === 'none' || fill === 'transparent'
                
                // Se for uma cor branca/cinza/clara, remover IMEDIATAMENTE
                if (!isAllowedColor && (
                  fill === '#f5f5f5' || fill === '#f0f0f0' || fill === '#e5e5e5' ||
                  fill === '#d3d3d3' || fill === '#cccccc' || fill === '#ffffff' ||
                  fill === '#fafafa' || fill === '#f9f9f9' || fill === '#fdfdfd' ||
                  fill.includes('rgb(245') || fill.includes('rgb(240') ||
                  fill.includes('rgb(229') || fill.includes('rgb(211') || fill.includes('rgb(204') ||
                  fill.includes('rgb(255') || fill.includes('rgb(250') ||
                  fill.includes('rgba(245') || fill.includes('rgba(240') ||
                  fill.includes('rgba(229') || fill.includes('rgba(211') || fill.includes('rgba(204') ||
                  fill.includes('rgba(255') || fill.includes('rgba(250') ||
                  fill.includes('rgba(253')
                )) {
                  rect.remove() // Remover completamente do DOM
                }
              }
              
              // Remover qualquer rect que seja filho de um grupo com classe recharts-active
              const parent = rect.parentElement
              if (parent && (
                parent.classList.contains('recharts-active-bar') ||
                parent.classList.contains('recharts-active-shape') ||
                parent.getAttribute('class')?.includes('recharts-active')
              )) {
                rect.remove()
              }
            })
          })
          
          observer.observe(svg, { childList: true, subtree: true, attributes: true, attributeFilter: ['fill'] })
        }
      })
    }
    
    // Wait for charts to render, then set up observer
    const timer = setTimeout(() => {
      removeGrayBackgrounds()
    }, 1000)
    
    // Limpeza contínua a cada 50ms para garantir que backgrounds sejam removidos IMEDIATAMENTE
    const interval = setInterval(() => {
      removeGrayBackgrounds()
      
      // Limpeza específica para supply-profit-loss-chart - ULTRA AGRESSIVA
      const profitLossChart = document.querySelector('.supply-profit-loss-chart')
      if (profitLossChart) {
        const svg = profitLossChart.querySelector('svg')
        if (svg) {
          // Remover TODOS os elementos (não só rects) que possam ser backgrounds
          const allElements = svg.querySelectorAll('*')
          allElements.forEach(el => {
            const tagName = el.tagName.toLowerCase()
            const fill = el.getAttribute('fill')
            const style = window.getComputedStyle(el)
            const bgColor = style.backgroundColor
            
            // Se for qualquer elemento com fill/bg branco/cinza, remover
            if (fill && (fill.includes('rgb(245') || fill.includes('rgb(240') || 
                fill.includes('rgb(229') || fill.includes('rgb(211') ||
                fill.includes('rgb(204') || fill.includes('rgb(255') ||
                fill === '#f5f5f5' || fill === '#f0f0f0' || fill === '#e5e5e5' ||
                fill === '#d3d3d3' || fill === '#cccccc' || fill === '#ffffff' ||
                fill === '#fafafa')) {
              if (!fill.includes('10B981') && !fill.includes('059669') &&
                  !fill.includes('EF4444') && !fill.includes('DC2626') &&
                  !fill.includes('url(#colorProfit') && !fill.includes('url(#colorLoss')) {
                el.remove()
              }
            }
            
            // Verificar também backgroundColor
            if (bgColor && (bgColor.includes('rgb(245') || bgColor.includes('rgb(240') ||
                bgColor.includes('rgb(229') || bgColor.includes('rgb(211') ||
                bgColor.includes('rgb(204') || bgColor.includes('rgb(255'))) {
              if (tagName !== 'rect' || (!fill || (!fill.includes('10B981') && !fill.includes('059669') &&
                  !fill.includes('EF4444') && !fill.includes('DC2626') &&
                  !fill.includes('url(#colorProfit') && !fill.includes('url(#colorLoss')))) {
                if (el instanceof HTMLElement) {
                  el.style.backgroundColor = 'transparent'
                  el.style.background = 'transparent'
                }
              }
            }
          })
          
          // Remover TODOS os rects que não sejam nossas cores
          const allRects = svg.querySelectorAll('rect')
              allRects.forEach(rect => {
                const fill = rect.getAttribute('fill')
                const width = rect.getAttribute('width')
                const height = rect.getAttribute('height')
                const computedFill = window.getComputedStyle(rect).fill
                
                // Se for um rect grande (background), remover imediatamente
                if (width && height && parseFloat(width) > 100 && parseFloat(height) > 50) {
                  const isOurBar = fill && (
                    fill.includes('10B981') || fill.includes('059669') ||
                    fill.includes('EF4444') || fill.includes('DC2626') ||
                    fill.includes('url(#colorProfit') || fill.includes('url(#colorLoss')
                  )
                  if (!isOurBar) {
                    rect.remove()
                    return
                  }
                }
                
                // Se não for verde, vermelho ou gradiente, remover
                if (fill && computedFill && 
                    !fill.includes('10B981') && !fill.includes('059669') &&
                    !fill.includes('EF4444') && !fill.includes('DC2626') &&
                    !fill.includes('url(#colorProfit') && !fill.includes('url(#colorLoss') &&
                    !fill.includes('url(#color') &&
                    (fill.includes('rgb(245') || fill.includes('rgb(240') || 
                     fill.includes('rgb(229') || fill.includes('rgb(211') ||
                     fill.includes('rgb(204') || fill.includes('rgb(255') ||
                     fill.includes('rgba(245') || fill.includes('rgba(240') ||
                     fill.includes('rgba(229') || fill.includes('rgba(211') ||
                     fill.includes('rgba(204') || fill.includes('rgba(255') ||
                     fill === '#f5f5f5' || fill === '#f0f0f0' || fill === '#e5e5e5' ||
                     fill === '#d3d3d3' || fill === '#cccccc' || fill === '#ffffff' ||
                     fill === '#fafafa' ||
                     computedFill.includes('rgb(245') || computedFill.includes('rgb(240') ||
                     computedFill.includes('rgb(229') || computedFill.includes('rgb(211') ||
                     computedFill.includes('rgb(204') || computedFill.includes('rgb(255'))) {
                  rect.remove()
                }
                
                // Remover se for filho de elemento ativo
                const parent = rect.parentElement
                if (parent && (
                  parent.classList.contains('recharts-active-bar') ||
                  parent.classList.contains('recharts-active-shape') ||
                  parent.getAttribute('class')?.includes('recharts-active')
                )) {
                  rect.remove()
                }
              })
              
              // Remover qualquer grupo com classe active
              const activeGroups = svg.querySelectorAll('g[class*="active"], g[class*="hover"]')
              activeGroups.forEach(group => {
                const rects = group.querySelectorAll('rect')
                rects.forEach(rect => {
                  const fill = rect.getAttribute('fill')
                  if (!fill || (!fill.includes('10B981') && !fill.includes('059669') &&
                      !fill.includes('EF4444') && !fill.includes('DC2626') &&
                      !fill.includes('url(#colorProfit') && !fill.includes('url(#colorLoss'))) {
                    rect.remove()
                  }
                })
              })
            }
          }
    }, 50)
    
    return () => {
      clearTimeout(timer)
      clearInterval(interval)
    }
  }, [utxoMetrics, holderConcentration, supplyProfitLoss])

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 2
    }).format(num)
  }

  // Estilo padrão para tooltips - usando o mesmo background das legendas (bg-surface/50)
  const standardTooltipStyle = {
    contentStyle: { 
      backgroundColor: 'rgba(17, 24, 39, 0.5)', // gray-900/50 - mesmo das legendas
      border: '1px solid #374151', // border-lava-dark/15/50
      borderRadius: '0px',
      color: '#F3F4F6',
      fontFamily: 'monospace',
      padding: '12px 16px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.8)'
    },
    itemStyle: { 
      color: '#F3F4F6',
      padding: '6px 0',
      fontSize: '13px'
    },
    labelStyle: { 
      color: '#F97316',
      fontWeight: 'bold',
      marginBottom: '8px',
      fontSize: '14px'
    }
  }

  const formatDOG = (num: number, alreadyInDOG: boolean = false) => {
    // Se alreadyInDOG = true, num já está em DOG (não precisa dividir)
    // Se alreadyInDOG = false, num está em amount (precisa dividir por 100,000)
    const dogAmount = alreadyInDOG ? num : num / 100000
    
    // Para valores muito grandes (bilhões), mostrar de forma mais legível
    if (dogAmount >= 1_000_000_000) {
      const billions = dogAmount / 1_000_000_000
      return `${billions.toFixed(2)}B DOG`
    } else if (dogAmount >= 1_000_000) {
      const millions = dogAmount / 1_000_000
      return `${millions.toFixed(2)}M DOG`
    } else if (dogAmount >= 1_000) {
      const thousands = dogAmount / 1_000
      return `${thousands.toFixed(2)}K DOG`
    }
    
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(dogAmount) + ' DOG'
  }

  if (loading) {
    return <LoadingScreen message="Loading on-chain metrics..." />
  }

  return (
    <Layout currentPage="metrics" setCurrentPage={() => {}}>
      <div className="min-h-screen pt-1 pb-2 md:py-2 space-y-6 md:space-y-8 px-4 md:px-6">
        {/* Hero Section */}
        <div className="text-center space-y-1 md:space-y-2 animate-fade-in px-4 mt-8 md:mt-10">
          <div className="space-y-3 md:space-y-4 max-w-full overflow-hidden">
            <h1 className="text-2xl md:text-4xl font-display font-bold tracking-tight break-words">
              <span className="text-lava-dark font-mono tracking-wider block">
                <span className="inline-block">ON-CHAIN</span>
                <span className="inline-block ml-4 md:ml-6">METRICS</span>
              </span>
            </h1>
            <div className="flex items-center justify-center">
              <span className="text-lava font-mono text-xs md:text-sm">
                UTXO-Based Indicators • Node Exclusive Data
              </span>
            </div>
          </div>
        </div>

        <SectionDivider title="UTXO Metrics" icon={Coins} />

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-6 max-w-7xl mx-auto">
          {/* UTXO Count */}
          <Card variant="glass" className="stagger-item h-full flex flex-col border-lava/20 hover:border-lava/40 transition-all">
            <CardHeader className="pb-3">
              <CardTitle variant="mono" className="text-sm text-dusty flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-lava" />
                  Total UTXOs
                </div>
                {utxoCountHistory.length >= 2 && (() => {
                  const latest = utxoCountHistory[utxoCountHistory.length - 1]
                  const previous = utxoCountHistory[utxoCountHistory.length - 2]
                  const change = latest.total_utxos - previous.total_utxos
                  const changePercent = previous.total_utxos > 0 
                    ? ((change / previous.total_utxos) * 100) 
                    : 0
                  const isPositive = change >= 0
                  
                  return (
                    <div className={`flex items-center gap-1.5 text-xs ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                      {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                      <span>{Math.abs(changePercent).toFixed(3)}%</span>
                    </div>
                  )
                })()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="text-xl md:text-3xl font-bold text-snow font-mono">
                  {utxoMetrics ? utxoMetrics.total_utxos.toLocaleString('en-US') : '—'}
                </div>
                <p className="text-xs text-dusty font-mono uppercase tracking-wide">
                  Unspent Transaction Outputs
                </p>
                {sparklineData.length > 0 && (
                  <MetricSparkline
                    data={sparklineData.map(p => ({ recorded_at: p.recorded_at, value: p.total_utxos }))}
                    color="#F97316"
                    height={40}
                  />
                )}
                {utxoCountHistory.length >= 2 && (() => {
                  const latest = utxoCountHistory[utxoCountHistory.length - 1]
                  const previous = utxoCountHistory[utxoCountHistory.length - 2]
                  const change = latest.total_utxos - previous.total_utxos
                  const isPositive = change >= 0
                  const date = new Date(previous.date)
                  
                  return (
                    <div className="pt-2 border-t border-lava-dark/15/50">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-dusty font-mono">vs {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}:</span>
                        <span className={`font-mono font-semibold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                          {isPositive ? '+' : ''}{change.toLocaleString('en-US')}
                        </span>
                      </div>
                    </div>
                  )
                })()}
              </div>
            </CardContent>
          </Card>

          {/* Average UTXO Size */}
          <Card variant="glass" className="stagger-item h-full flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle variant="mono" className="text-sm text-dusty flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                Average UTXO Size
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-xl md:text-3xl font-bold text-snow font-mono">
                  {utxoMetrics ? formatDOG(utxoMetrics.avg_utxo_size, true) : '—'}
                </div>
                <p className="text-xs text-dusty font-mono uppercase tracking-wide">
                  Mean DOG per UTXO
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Gini Coefficient */}
          <Card variant="glass" className="stagger-item h-full flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle variant="mono" className="text-sm text-dusty flex items-center gap-2">
                <PieChart className="w-4 h-4 text-purple-400" />
                Holder Concentration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-xl md:text-3xl font-bold text-snow font-mono">
                  {holderConcentration 
                    ? holderConcentration.gini_coefficient.toFixed(3)
                    : '—'}
                </div>
                <p className="text-xs text-dusty font-mono uppercase tracking-wide">
                  Gini Coefficient (0 = equal, 1 = concentrated)
                </p>
                {sparklineData.length > 0 && (
                  <MetricSparkline
                    data={sparklineData.map(p => ({ recorded_at: p.recorded_at, value: p.gini_coefficient })).filter(p => p.value > 0)}
                    color="#a855f7"
                    height={40}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Top 10 Supply %} */}
          <Card variant="glass" className="stagger-item h-full flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle variant="mono" className="text-sm text-dusty flex items-center gap-2">
                <Users className="w-4 h-4 text-green-400" />
                Top 10 Holders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-xl md:text-3xl font-bold text-snow font-mono">
                  {holderConcentration 
                    ? `${holderConcentration.top10_supply_pct.toFixed(2)}%`
                    : '—'}
                </div>
                <p className="text-xs text-dusty font-mono uppercase tracking-wide">
                  Of Total Supply
                </p>
                {sparklineData.length > 0 && (
                  <MetricSparkline
                    data={sparklineData.map(p => ({ recorded_at: p.recorded_at, value: p.top10_supply_pct })).filter(p => p.value > 0)}
                    color="#10B981"
                    height={40}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* HODL Waves */}
        {utxoAgeStats && utxoAgeStats.hodl_waves.length > 0 && (
          <>
            <SectionDivider title="HODL Waves" icon={BarChart3} />
            <Card variant="glass" className="max-w-7xl mx-auto border-lava/20">
              <CardHeader>
                <CardTitle className="text-lava text-xl font-display font-mono">
                  Supply Distribution by UTXO Age
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80 w-full hodl-waves-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart 
                      data={utxoAgeStats.hodl_waves.map(wave => ({
                        range: wave.range,
                        percentage: wave.percentage,
                        supply: wave.supply
                      }))}
                      margin={{ top: 10, right: 30, left: 0, bottom: 60 }}
                    >
                      <defs>
                        {/* Gradiente estilo TradingView - usando laranja principal */}
                        <linearGradient id="colorHODLWaves" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#F97316" stopOpacity={0.9}/>
                          <stop offset="95%" stopColor="#F97316" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                      <XAxis 
                        dataKey="range" 
                        stroke="#9CA3AF"
                        style={{ fontSize: '11px', fontFamily: 'monospace' }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis 
                        stroke="#9CA3AF"
                        style={{ fontSize: '12px', fontFamily: 'monospace' }}
                        tickFormatter={(value) => `${value.toFixed(1)}%`}
                      />
                      <Tooltip 
                        {...standardTooltipStyle}
                        labelFormatter={(label) => `Age Range: ${label}`}
                        formatter={(value: number, name: string, props: any) => [
                          `${value.toFixed(2)}% • ${formatDOG(props.payload.supply)}`,
                          'Supply'
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="percentage"
                        stroke="#F97316"
                        strokeWidth={2.5}
                        fill="url(#colorHODLWaves)"
                        fillOpacity={0.75}
                        activeDot={{ r: 6, stroke: '#F97316', strokeWidth: 2, fill: '#fff' }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-6">
                  <h3 className="text-lava font-mono text-sm uppercase tracking-wide mb-3">Legend</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {utxoAgeStats.hodl_waves.map((wave, idx) => {
                      const colors = ['#F97316', '#FB923C', '#EA580C', '#10B981', '#F59E0B', '#C2410C', '#9A3412']
                      return (
                        <div key={idx} className="flex items-center gap-3 p-3 bg-transparent border border-lava-dark/20 hover:border-lava/50 hover:bg-snow/[0.03] transition-all">
                          <div 
                            className="w-4 h-4 flex-shrink-0 shadow-sm" 
                            style={{ backgroundColor: colors[idx % colors.length] }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-snow font-mono text-sm font-medium truncate">{wave.range}</div>
                            <div className="text-lava font-mono text-xs font-bold">
                              {wave.percentage.toFixed(2)}%
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <p className="text-center text-dusty/70 text-xs font-mono mt-4">
                  Average age: {utxoAgeStats.avg_age_days.toFixed(1)} days • 
                  Median age: {utxoAgeStats.median_age_days.toFixed(1)} days
                </p>
              </CardContent>
            </Card>
          </>
        )}

        {/* STH vs LTH Supply */}
        {utxoAgeStats && (
          <>
            <SectionDivider title="STH vs LTH Supply" icon={Zap} />
            <div className="max-w-7xl mx-auto space-y-6">
              {/* Horizontal Stacked Bar - Estilo Dashboard Moderno e Claro */}
              <Card variant="glass" className="border-lava/20">
                <CardHeader>
                  <CardTitle className="text-lava text-xl font-display font-mono">
                    STH vs LTH Supply Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Gráfico de Barras Empilhadas Horizontais - Muito mais claro e moderno */}
                    <div className="relative">
                      <div className="h-32 w-full bg-transparent overflow-hidden relative border border-lava-dark/20">
                        {/* Barra STH (verde) */}
                        <div 
                          className="absolute top-0 left-0 h-full flex items-center justify-center transition-all duration-500"
                          style={{ 
                            width: `${utxoAgeStats.sth_percentage}%`,
                            background: 'linear-gradient(135deg, #10B981, #059669)'
                          }}
                        >
                          {utxoAgeStats.sth_percentage > 15 && (
                            <span className="text-snow font-mono font-bold text-lg px-4">
                              {utxoAgeStats.sth_percentage.toFixed(1)}%
                            </span>
                          )}
                        </div>
                        
                        {/* Barra LTH (laranja) */}
                        <div 
                          className="absolute top-0 right-0 h-full flex items-center justify-center transition-all duration-500"
                          style={{ 
                            width: `${utxoAgeStats.lth_percentage}%`,
                            background: 'linear-gradient(135deg, #F97316, #EA580C)'
                          }}
                        >
                          {utxoAgeStats.lth_percentage > 15 && (
                            <span className="text-snow font-mono font-bold text-lg px-4">
                              {utxoAgeStats.lth_percentage.toFixed(1)}%
                            </span>
                          )}
                        </div>
                        
                        {/* Label para valores pequenos */}
                        {utxoAgeStats.sth_percentage <= 15 && (
                          <div 
                            className="absolute top-1/2 -translate-y-1/2 left-2 text-snow font-mono font-bold text-sm"
                            style={{ left: `${utxoAgeStats.sth_percentage / 2}%` }}
                          >
                            STH: {utxoAgeStats.sth_percentage.toFixed(1)}%
                          </div>
                        )}
                        {utxoAgeStats.lth_percentage <= 15 && (
                          <div 
                            className="absolute top-1/2 -translate-y-1/2 text-snow font-mono font-bold text-sm"
                            style={{ right: `${utxoAgeStats.lth_percentage / 2}%` }}
                          >
                            LTH: {utxoAgeStats.lth_percentage.toFixed(1)}%
                          </div>
                        )}
                      </div>
                      
                      {/* Indicadores de hover/tooltip customizado */}
                      <div className="absolute inset-0 flex items-center pointer-events-none opacity-0 hover:opacity-100 transition-opacity">
                        {/* Tooltips aparecem no hover via CSS */}
                      </div>
                    </div>

                    {/* Legenda - Sem border-radius */}
                    <div className="grid grid-cols-2 md:grid-cols-2 gap-3 md:gap-6">
                      <div className="p-4 bg-transparent border border-lava-dark/20">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-4 h-4" style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}></div>
                          <h3 className="text-snow font-mono font-semibold text-sm">Short-Term Holders (STH)</h3>
                        </div>
                        <div className="space-y-1">
                          <div className="text-2xl font-bold text-green-400 font-mono">
                            {utxoAgeStats.sth_percentage.toFixed(2)}%
                          </div>
                          <div className="text-dusty font-mono text-sm">
                            {formatDOG(utxoAgeStats.sth_supply)}
                          </div>
                          <div className="text-dusty/70 font-mono text-xs">
                            UTXOs &lt; 155 days old
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-transparent border border-lava-dark/20">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-4 h-4" style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)' }}></div>
                          <h3 className="text-snow font-mono font-semibold text-sm">Long-Term Holders (LTH)</h3>
                        </div>
                        <div className="space-y-1">
                          <div className="text-2xl font-bold text-lava font-mono">
                            {utxoAgeStats.lth_percentage.toFixed(2)}%
                          </div>
                          <div className="text-dusty font-mono text-sm">
                            {formatDOG(utxoAgeStats.lth_supply)}
                          </div>
                          <div className="text-dusty/70 font-mono text-xs">
                            UTXOs ≥ 155 days old
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-center text-dusty/70 text-xs font-mono mt-4">
                    Complete data from {(utxoAgeStats.total_utxos || 0).toLocaleString()} tracked UTXOs (100% of supply)
                  </p>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Top Holders Supply Distribution */}
        {holderConcentration && (
          <>
            <SectionDivider title="Holder Concentration" icon={Users} />
            <div className="max-w-7xl mx-auto space-y-6">
              {/* Gráfico de Barras */}
              <Card variant="glass" className="border-lava/20">
                <CardHeader>
                  <CardTitle className="text-lava text-xl font-display font-mono">
                    Supply Distribution by Top Holders
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="h-80 w-full holder-concentration-chart">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart 
                          data={[
                            { name: 'Top 10', value: holderConcentration.top10_supply_pct },
                            { name: 'Top 100', value: holderConcentration.top100_supply_pct },
                            { name: 'Top 1000', value: holderConcentration.top1000_supply_pct }
                          ]}
                          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="colorHolderConcentration" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#F97316" stopOpacity={0.9}/>
                              <stop offset="95%" stopColor="#F97316" stopOpacity={0.1}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                          <XAxis 
                            dataKey="name" 
                            stroke="#9CA3AF"
                            style={{ fontSize: '12px', fontFamily: 'monospace' }}
                          />
                          <YAxis 
                            stroke="#9CA3AF"
                            style={{ fontSize: '12px', fontFamily: 'monospace' }}
                            tickFormatter={(value) => `${value.toFixed(1)}%`}
                          />
                          <Tooltip 
                            {...standardTooltipStyle}
                            formatter={(value: number) => [`${value.toFixed(2)}%`, 'Supply']}
                          />
                          <Area
                            type="monotone"
                            dataKey="value"
                            stroke="#F97316"
                            strokeWidth={2.5}
                            fill="url(#colorHolderConcentration)"
                            fillOpacity={0.75}
                            activeDot={{ r: 6, stroke: '#F97316', strokeWidth: 2, fill: '#fff' }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Legenda - Sem border-radius */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-transparent border border-lava-dark/20">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-4 h-4" style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)' }}></div>
                          <h3 className="text-snow font-mono font-semibold text-sm">Top 10</h3>
                        </div>
                        <div className="space-y-1">
                          <div className="text-2xl font-bold text-lava font-mono">
                            {holderConcentration.top10_supply_pct.toFixed(2)}%
                          </div>
                          <div className="text-dusty/70 font-mono text-xs">
                            of total supply
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-transparent border border-lava-dark/20">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-4 h-4" style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)' }}></div>
                          <h3 className="text-snow font-mono font-semibold text-sm">Top 100</h3>
                        </div>
                        <div className="space-y-1">
                          <div className="text-2xl font-bold text-lava font-mono">
                            {holderConcentration.top100_supply_pct.toFixed(2)}%
                          </div>
                          <div className="text-dusty/70 font-mono text-xs">
                            of total supply
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-transparent border border-lava-dark/20">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-4 h-4" style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)' }}></div>
                          <h3 className="text-snow font-mono font-semibold text-sm">Top 1000</h3>
                        </div>
                        <div className="space-y-1">
                          <div className="text-2xl font-bold text-lava font-mono">
                            {holderConcentration.top1000_supply_pct.toFixed(2)}%
                          </div>
                          <div className="text-dusty/70 font-mono text-xs">
                            of total supply
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* UTXO Distribution */}
        {utxoMetrics && utxoMetrics.utxo_distribution.length > 0 && (
          <>
            <SectionDivider title="UTXO Distribution by Size" icon={PieChart} />
            <Card variant="glass" className="max-w-7xl mx-auto border-lava/20">
              <CardHeader>
                <CardTitle className="text-lava text-xl font-display font-mono">
                  Distribution of UTXOs by Size
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Treemap - Cores Sólidas Laranja */}
                  <div className="h-96 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <Treemap
                        data={(() => {
                          // Ordenar por supply e adicionar cores laranja vibrantes
                          const sorted = [...utxoMetrics.utxo_distribution].sort((a, b) => b.supply - a.supply)
                          const orangeColors = ['#FF6B00', '#FF8C00', '#FF7F00', '#FFA500', '#FF9500', '#FFB340']
                          return sorted.map((dist, index) => ({
                            name: dist.range,
                            size: dist.supply,
                            percentage: dist.percentage,
                            count: dist.count,
                            supply: dist.supply,
                            fill: orangeColors[index % orangeColors.length]
                          }))
                        })()}
                        dataKey="size"
                        aspectRatio={4/3}
                        stroke="#111827"
                        animationDuration={800}
                        nameKey="name"
                      >
                        <Tooltip
                          {...standardTooltipStyle}
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload
                              const name = data.name || data.range || 'Unknown'
                              
                              // Buscar o percentage do objeto original
                              const originalData = utxoMetrics.utxo_distribution.find(d => d.range === name)
                              const percentage = originalData?.percentage || data.percentage || 0
                              const count = data.count || originalData?.count || 0
                              const supply = data.supply || data.size || originalData?.supply || 0
                              
                              return (
                                <div style={standardTooltipStyle.contentStyle}>
                                  <p style={standardTooltipStyle.labelStyle}>{name}</p>
                                  <p style={standardTooltipStyle.itemStyle}>
                                    {percentage.toFixed(2)}% • {formatNumber(count)} UTXOs
                                  </p>
                                  <p style={standardTooltipStyle.itemStyle}>
                                    {formatDOG(supply, true)} Supply
                                  </p>
                                </div>
                              )
                            }
                            return null
                          }}
                        />
                      </Treemap>
                    </ResponsiveContainer>
                  </div>
                  
                  {/* Lista de Dados - Ordenada por volume (supply) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[...utxoMetrics.utxo_distribution]
                      .sort((a, b) => b.supply - a.supply)
                      .map((dist, idx) => {
                        // Cores laranja vibrantes - mesma ordem do Treemap
                        const orangeColors = ['#FF6B00', '#FF8C00', '#FF7F00', '#FFA500', '#FF9500', '#FFB340']
                        const color = orangeColors[idx % orangeColors.length]
                        return (
                          <div key={dist.range} className="flex items-center justify-between p-3 bg-transparent border border-lava-dark/20 hover:border-lava/50 hover:bg-snow/[0.03] transition-all">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div 
                                className="w-4 h-4 flex-shrink-0 rounded-sm" 
                                style={{ backgroundColor: color }}
                              />
                            <div className="flex-1 min-w-0">
                              <div className="text-snow font-mono text-sm truncate">{dist.range}</div>
                              <div className="text-dusty font-mono text-xs truncate">
                                {formatNumber(dist.count)} UTXOs • {formatDOG(dist.supply, true)}
                              </div>
                            </div>
                          </div>
                          <div className="text-lava font-mono font-bold text-sm ml-2">
                            {dist.percentage.toFixed(1)}%
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Realized Cap / MVRV Ratio */}
        {realizedCapMetrics && (
          <>
            <SectionDivider title="Realized Cap / MVRV Ratio" icon={Zap} />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-6 max-w-7xl mx-auto items-start">
              {/* MVRV Ratio - Visual Comparison Card */}
              <Card variant="glass" className="border-lava/20 lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lava text-xl font-display font-mono">
                    MVRV Ratio
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-8">
                    {/* Valor Principal */}
                    <div className="text-center">
                      <div className="text-6xl font-bold bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 bg-clip-text text-transparent font-mono mb-3">
                        {realizedCapMetrics.mvrv_ratio.toFixed(2)}
                      </div>
                      <div className="inline-flex items-center gap-2 px-4 py-2 bg-transparent border border-lava-dark/20">
                        <div className={`w-2 h-2 rounded-full ${realizedCapMetrics.mvrv_ratio < 1.0 ? 'bg-green-400' : realizedCapMetrics.mvrv_ratio > 3.7 ? 'bg-red-400' : 'bg-yellow-400'}`}></div>
                        <p className="text-sm font-mono uppercase tracking-wide text-snow/80">
                          {realizedCapMetrics.mvrv_ratio < 1.0 ? 'Undervalued' : realizedCapMetrics.mvrv_ratio > 3.7 ? 'Overvalued' : 'Fair Value'}
                        </p>
                      </div>
                    </div>

                    {/* Comparação Visual Market Cap vs Realized Cap */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-xs text-dusty font-mono uppercase tracking-wide">
                        <span>Market Cap</span>
                        <span>Realized Cap</span>
                      </div>
                      <div className="relative h-32 w-full bg-transparent border border-lava-dark/20 overflow-hidden">
                        {/* Market Cap Bar */}
                        <div 
                          className="absolute top-0 left-0 h-full flex items-center justify-center transition-all duration-500"
                          style={{ 
                            width: `${(realizedCapMetrics.market_cap / realizedCapMetrics.realized_cap) * 100}%`,
                            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.8), rgba(37, 99, 235, 0.6))'
                          }}
                        >
                          <span className="text-snow font-mono font-bold text-sm px-3">
                            ${(realizedCapMetrics.market_cap / 1_000_000).toFixed(2)}M
                          </span>
                        </div>
                        
                        {/* Realized Cap Background (full width reference) */}
                        <div 
                          className="absolute top-0 right-0 h-full w-full opacity-20"
                          style={{ 
                            background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.3), rgba(234, 88, 12, 0.2))'
                          }}
                        ></div>
                        
                        {/* Label Realized Cap */}
                        <div className="absolute bottom-2 right-4 text-snow font-mono font-semibold text-xs">
                          Realized: ${(realizedCapMetrics.realized_cap / 1_000_000).toFixed(2)}M
                        </div>
                      </div>
                      
                      {/* Interpretação */}
                      <div className="pt-4 border-t border-lava-dark/15/50">
                        <p className="text-xs text-dusty font-mono leading-relaxed">
                          MVRV Ratio compares Market Cap to Realized Cap. 
                          {realizedCapMetrics.mvrv_ratio < 1.0 
                            ? ' Values below 1.0 indicate the asset is trading below its average cost basis (undervalued).'
                            : realizedCapMetrics.mvrv_ratio > 3.7
                            ? ' Values above 3.7 suggest the asset may be overvalued relative to historical cost basis.'
                            : ' Values between 1.0 and 3.7 are considered within a fair valuation range.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Info Cards - Alinhados no topo */}
              <div className="space-y-6 flex flex-col">
                <Card variant="glass" className="border-lava/20 hover:border-lava/40 transition-all">
                  <CardHeader className="pb-3">
                    <CardTitle variant="mono" className="text-sm text-dusty flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-lava" />
                      Realized Cap
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-snow font-mono">
                      ${(realizedCapMetrics.realized_cap / 1_000_000).toFixed(2)}M
                    </div>
                    <p className="text-xs text-dusty font-mono uppercase tracking-wide mt-1">
                      Total Cost Basis
                    </p>
                  </CardContent>
                </Card>

                <Card variant="glass" className="border-blue-500/20 hover:border-blue-500/40 transition-all">
                  <CardHeader className="pb-3">
                    <CardTitle variant="mono" className="text-sm text-dusty flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-blue-400" />
                      Market Cap
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-snow font-mono">
                      ${(realizedCapMetrics.market_cap / 1_000_000).toFixed(2)}M
                    </div>
                    <p className="text-xs text-dusty font-mono uppercase tracking-wide mt-1">
                      Current Valuation
                    </p>
                  </CardContent>
                </Card>

                <Card variant="glass" className="border-purple-500/20 hover:border-purple-500/40 transition-all">
                  <CardHeader className="pb-3">
                    <CardTitle variant="mono" className="text-sm text-dusty flex items-center gap-2">
                      <Coins className="w-4 h-4 text-purple-400" />
                      Current Price
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-snow font-mono">
                      ${realizedCapMetrics.current_price.toFixed(8)}
                    </div>
                    <p className="text-xs text-dusty font-mono uppercase tracking-wide mt-1">
                      USD per DOG
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}

        {/* Supply in Profit/Loss */}
        {supplyProfitLoss && (
          <>
            <SectionDivider title="Supply in Profit/Loss" icon={TrendingUp} />
            <Card variant="glass" className="max-w-7xl mx-auto border-lava/20">
              <CardHeader>
                <CardTitle className="text-lava text-xl font-display font-mono">
                  Supply Distribution by Profit/Loss Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Gráfico de Barras Empilhadas Horizontais - Mesmo estilo do STH vs LTH */}
                  <div className="relative">
                    <div className="h-32 w-full bg-transparent overflow-hidden relative border border-lava-dark/20">
                      {/* Barra Profit (verde) */}
                      <div 
                        className="absolute top-0 left-0 h-full flex items-center justify-center transition-all duration-500"
                        style={{ 
                          width: `${supplyProfitLoss.supply_in_profit_pct}%`,
                          background: 'linear-gradient(135deg, #22C55E, #16A34A)'
                        }}
                      >
                        {supplyProfitLoss.supply_in_profit_pct > 15 && (
                          <span className="text-snow font-mono font-bold text-lg px-4">
                            {supplyProfitLoss.supply_in_profit_pct.toFixed(2)}%
                          </span>
                        )}
                      </div>
                      
                      {/* Barra Loss (vermelho) */}
                      <div 
                        className="absolute top-0 right-0 h-full flex items-center justify-center transition-all duration-500"
                        style={{ 
                          width: `${supplyProfitLoss.supply_in_loss_pct}%`,
                          background: 'linear-gradient(135deg, #DC2626, #B91C1C)'
                        }}
                      >
                        {supplyProfitLoss.supply_in_loss_pct > 15 && (
                          <span className="text-snow font-mono font-bold text-lg px-4">
                            {supplyProfitLoss.supply_in_loss_pct.toFixed(2)}%
                          </span>
                        )}
                      </div>
                      
                      {/* Label para valores pequenos */}
                      {supplyProfitLoss.supply_in_profit_pct <= 15 && (
                        <div 
                          className="absolute top-1/2 -translate-y-1/2 left-2 text-snow font-mono font-bold text-sm"
                          style={{ left: `${supplyProfitLoss.supply_in_profit_pct / 2}%` }}
                        >
                          Profit: {supplyProfitLoss.supply_in_profit_pct.toFixed(2)}%
                        </div>
                      )}
                      {supplyProfitLoss.supply_in_loss_pct <= 15 && (
                        <div 
                          className="absolute top-1/2 -translate-y-1/2 text-snow font-mono font-bold text-sm"
                          style={{ right: `${supplyProfitLoss.supply_in_loss_pct / 2}%` }}
                        >
                          Loss: {supplyProfitLoss.supply_in_loss_pct.toFixed(2)}%
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Legenda - Sem border-radius */}
                  <div className="grid grid-cols-2 md:grid-cols-2 gap-3 md:gap-6">
                    <div className="p-4 bg-transparent border border-lava-dark/20">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-4 h-4" style={{ background: 'linear-gradient(135deg, #22C55E, #16A34A)' }}></div>
                        <h3 className="text-snow font-mono font-semibold text-sm">Supply in Profit</h3>
                      </div>
                      <div className="space-y-1">
                        <div className="text-2xl font-bold text-green-400 font-mono">
                          {supplyProfitLoss.supply_in_profit_pct.toFixed(2)}%
                        </div>
                        <div className="text-dusty font-mono text-sm">
                          {formatDOG(supplyProfitLoss.supply_in_profit, true)}
                        </div>
                        <div className="text-dusty/70 font-mono text-xs">
                          Currently in profit
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-transparent border border-lava-dark/20">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-4 h-4" style={{ background: 'linear-gradient(135deg, #DC2626, #B91C1C)' }}></div>
                        <h3 className="text-snow font-mono font-semibold text-sm">Supply in Loss</h3>
                      </div>
                      <div className="space-y-1">
                        <div className="text-2xl font-bold text-red-400 font-mono">
                          {supplyProfitLoss.supply_in_loss_pct.toFixed(2)}%
                        </div>
                        <div className="text-dusty font-mono text-sm">
                          {formatDOG(supplyProfitLoss.supply_in_loss, true)}
                        </div>
                        <div className="text-dusty/70 font-mono text-xs">
                          Currently in loss
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Historical Trends Section */}
        <HistoricalChartsSection />
      </div>
    </Layout>
  )
}

