'use client'

/**
 * OnChainChart — the single standardized chart template used by EVERY on-chain
 * metric in DOG DATA (Glassnode / ChartInspect style). Fully config-driven so a
 * new chart is just a config object, never a new component.
 *
 * Signature features of the model:
 *  - asset price overlaid on a secondary (right) y-axis, log-scale by default
 *  - one or more metric series on the left y-axis (line / area / bar)
 *  - optional colored threshold zones (e.g. MVRV >1 green, <1 red)
 *  - time-range selector + crosshair tooltip listing every series at a timestamp
 *  - header with title, methodology tooltip, latest value and Δ-change
 *
 * Theme tokens mirror tailwind.config.ts (accent #F7931A, JetBrains Mono, etc.).
 */

import { useMemo, useState } from 'react'
import {
  ComposedChart,
  Line,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceArea,
  ResponsiveContainer,
} from 'recharts'
import { Card } from '@/components/ui/card'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { cn } from '@/lib/utils'
import type { ValueFormatter } from './format'
import { fmt } from './format'

export type TimeRange = '1M' | '3M' | '6M' | '1Y' | 'YTD' | 'ALL'

export interface ChartSeries {
  /** key into each data row */
  key: string
  /** legend / tooltip label */
  label: string
  color: string
  type?: 'line' | 'area' | 'bar'
  /** which axis this series binds to (default 'left') */
  axis?: 'left' | 'right'
  strokeWidth?: number
  /** dashed line */
  dashed?: boolean
  format?: ValueFormatter
}

export interface ChartBand {
  /** lower bound on the left axis */
  from: number
  /** upper bound on the left axis */
  to: number
  color: string
  label?: string
}

export interface AxisConfig {
  label?: string
  format?: ValueFormatter
  /** fixed [min, max]; omit for auto with 5% padding */
  domain?: [number, number]
  scale?: 'linear' | 'log'
}

export interface OnChainChartProps {
  title: string
  /** methodology / what the metric means — shown in the (i) tooltip */
  description?: string
  /** time-series rows, each keyed by series.key + xKey (+ priceKey) */
  data: Array<Record<string, any>>
  series: ChartSeries[]
  /** row key holding the ISO timestamp/date (default 'date') */
  xKey?: string
  /** overlay DOG price on the right axis */
  showPrice?: boolean
  priceKey?: string
  leftAxis?: AxisConfig
  rightAxis?: AxisConfig
  /** colored horizontal threshold zones on the left axis */
  bands?: ChartBand[]
  ranges?: TimeRange[]
  defaultRange?: TimeRange
  /** data source label shown in the footer */
  source?: string
  /** chart body height in px (default 320) */
  height?: number
  className?: string
  /** loading skeleton */
  loading?: boolean
}

const PRICE_COLOR = '#878787'
const GRID = '#161616'
const AXIS = '#3A3A3A'

const RANGE_DAYS: Record<TimeRange, number | null> = {
  '1M': 30,
  '3M': 90,
  '6M': 180,
  '1Y': 365,
  YTD: null, // handled specially
  ALL: null,
}

function filterByRange<T extends Record<string, any>>(
  rows: T[],
  xKey: string,
  range: TimeRange,
): T[] {
  if (range === 'ALL' || rows.length === 0) return rows
  const last = new Date(rows[rows.length - 1][xKey]).getTime()
  let cutoff: number
  if (range === 'YTD') {
    cutoff = new Date(new Date(last).getUTCFullYear(), 0, 1).getTime()
  } else {
    cutoff = last - (RANGE_DAYS[range] as number) * 86400_000
  }
  return rows.filter((r) => new Date(r[xKey]).getTime() >= cutoff)
}

function formatAxisDate(value: string, range: TimeRange): string {
  const d = new Date(value)
  if (range === '1M' || range === '3M') {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  if (range === 'ALL' || range === '1Y') {
    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function ChartTooltip({
  active,
  payload,
  label,
  series,
  priceFmt,
}: any) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-md border px-3 py-2 font-mono text-xs"
      style={{
        backgroundColor: 'rgba(0,0,0,0.95)',
        borderColor: 'rgba(247,147,26,0.3)',
        color: '#EDEDED',
      }}
    >
      <div className="mb-1.5 text-text-secondary">
        {new Date(label).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })}
      </div>
      {payload.map((p: any) => {
        const cfg = series.find((s: ChartSeries) => s.key === p.dataKey)
        const f =
          p.dataKey === '__price'
            ? priceFmt
            : cfg?.format ?? fmt.number
        return (
          <div key={p.dataKey} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: p.color }}
              />
              {p.dataKey === '__price' ? 'DOG Price' : cfg?.label ?? p.dataKey}
            </span>
            <span className="tabular-nums">{f(p.value)}</span>
          </div>
        )
      })}
    </div>
  )
}

export function OnChainChart({
  title,
  description,
  data,
  series,
  xKey = 'date',
  showPrice = true,
  priceKey = 'price',
  leftAxis,
  rightAxis,
  bands,
  ranges = ['1M', '3M', '1Y', 'ALL'],
  defaultRange = '1Y',
  source = 'DOG DATA on-chain',
  height = 320,
  className,
  loading = false,
}: OnChainChartProps) {
  const [range, setRange] = useState<TimeRange>(defaultRange)
  // price axis log/linear toggle — the signature Glassnode control
  const [priceLog, setPriceLog] = useState(rightAxis?.scale !== 'linear')

  const hasPrice = showPrice && data.some((d) => d[priceKey] != null)

  const chartData = useMemo(() => {
    const filtered = filterByRange(data, xKey, range)
    return filtered.map((row) => {
      const out: Record<string, any> = { __x: row[xKey] }
      for (const s of series) out[s.key] = row[s.key]
      if (hasPrice) out.__price = row[priceKey]
      return out
    })
  }, [data, xKey, range, series, hasPrice, priceKey])

  const latest = chartData[chartData.length - 1]
  const first = chartData[0]
  const primary = series[0]
  const latestVal = latest?.[primary.key]
  const firstVal = first?.[primary.key]
  const delta =
    typeof latestVal === 'number' && typeof firstVal === 'number' && firstVal !== 0
      ? ((latestVal - firstVal) / Math.abs(firstVal)) * 100
      : null

  const leftFmt = leftAxis?.format ?? primary.format ?? fmt.number
  const priceFmt = rightAxis?.format ?? fmt.usdPrice

  const leftDomain =
    leftAxis?.domain ??
    ([
      (min: number) => (min > 0 ? min * 0.95 : min * 1.05),
      (max: number) => max * 1.05,
    ] as any)

  return (
    <Card variant="glass" className={cn('flex flex-col', className)}>
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate font-display text-sm font-semibold text-text-primary md:text-base">
              {title}
            </h3>
            {description && (
              <InfoTooltip>
                <p className="font-sans text-xs leading-relaxed text-text-secondary">
                  {description}
                </p>
              </InfoTooltip>
            )}
          </div>
          {latestVal != null && (
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-lg font-semibold tabular-nums text-text-primary">
                {leftFmt(latestVal)}
              </span>
              {delta != null && (
                <span
                  className={cn(
                    'font-mono text-xs tabular-nums',
                    delta >= 0 ? 'text-accent-positive' : 'text-accent-negative',
                  )}
                >
                  {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          {/* Range selector */}
          <div className="flex gap-1">
            {ranges.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  'rounded px-2 py-1 font-mono text-[10px] uppercase tracking-wide transition-colors',
                  range === r
                    ? 'bg-accent-primary-dim text-text-accent'
                    : 'text-text-secondary hover:text-text-primary',
                )}
              >
                {r}
              </button>
            ))}
          </div>
          {hasPrice && (
            <button
              onClick={() => setPriceLog((v) => !v)}
              className="rounded border border-border-subtle px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-text-secondary transition-colors hover:text-text-primary"
              title="Toggle price axis scale"
            >
              {priceLog ? 'LOG' : 'LIN'}
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ height }} className="w-full">
        {loading ? (
          <div className="flex h-full items-center justify-center font-mono text-sm text-text-secondary">
            Loading…
          </div>
        ) : chartData.length < 2 ? (
          <div className="flex h-full items-center justify-center font-mono text-sm text-text-secondary">
            No data for this range yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 8, right: hasPrice ? 8 : 12, left: 4, bottom: 4 }}
            >
              <defs>
                {series
                  .filter((s) => (s.type ?? 'line') === 'area')
                  .map((s) => (
                    <linearGradient
                      key={s.key}
                      id={`fill-${s.key}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor={s.color} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={s.color} stopOpacity={0.02} />
                    </linearGradient>
                  ))}
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />

              <XAxis
                dataKey="__x"
                stroke={AXIS}
                tick={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fill: PRICE_COLOR }}
                tickFormatter={(v) => formatAxisDate(v, range)}
                minTickGap={40}
              />

              {/* Left axis — metric */}
              <YAxis
                yAxisId="left"
                stroke={AXIS}
                tick={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fill: PRICE_COLOR }}
                tickFormatter={leftFmt}
                width={56}
                scale={leftAxis?.scale === 'log' ? 'log' : 'auto'}
                domain={leftDomain}
                allowDataOverflow={leftAxis?.scale === 'log'}
              />

              {/* Right axis — price overlay */}
              {hasPrice && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke={AXIS}
                  tick={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fill: PRICE_COLOR }}
                  tickFormatter={priceFmt}
                  width={56}
                  scale={priceLog ? 'log' : 'auto'}
                  domain={priceLog ? ['auto', 'auto'] : [0, 'auto']}
                  allowDataOverflow={priceLog}
                />
              )}

              {/* Threshold zones */}
              {bands?.map((b, i) => (
                <ReferenceArea
                  key={i}
                  yAxisId="left"
                  y1={b.from}
                  y2={b.to}
                  fill={b.color}
                  fillOpacity={0.08}
                  stroke="none"
                />
              ))}

              {/* Price line first so metric draws on top */}
              {hasPrice && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="__price"
                  name="DOG Price"
                  stroke={PRICE_COLOR}
                  strokeWidth={1.25}
                  strokeOpacity={0.6}
                  dot={false}
                  activeDot={false}
                />
              )}

              {/* Metric series */}
              {series.map((s) => {
                const axisId = s.axis === 'right' ? 'right' : 'left'
                const common = {
                  yAxisId: axisId,
                  dataKey: s.key,
                  name: s.label,
                }
                if ((s.type ?? 'line') === 'bar') {
                  return <Bar key={s.key} {...common} fill={s.color} />
                }
                if (s.type === 'area') {
                  return (
                    <Area
                      key={s.key}
                      {...common}
                      type="monotone"
                      stroke={s.color}
                      strokeWidth={s.strokeWidth ?? 2}
                      fill={`url(#fill-${s.key})`}
                      dot={false}
                      activeDot={{ r: 4, fill: '#000', stroke: s.color, strokeWidth: 2 }}
                    />
                  )
                }
                return (
                  <Line
                    key={s.key}
                    {...common}
                    type="monotone"
                    stroke={s.color}
                    strokeWidth={s.strokeWidth ?? 2}
                    strokeDasharray={s.dashed ? '4 3' : undefined}
                    dot={false}
                    activeDot={{ r: 4, fill: '#000', stroke: s.color, strokeWidth: 2 }}
                  />
                )
              })}

              <Tooltip
                content={<ChartTooltip series={series} priceFmt={priceFmt} />}
                cursor={{ stroke: AXIS, strokeDasharray: '3 3' }}
              />

              {(series.length > 1 || hasPrice) && (
                <Legend
                  verticalAlign="bottom"
                  height={24}
                  iconType="plainline"
                  wrapperStyle={{
                    fontSize: 10,
                    fontFamily: 'JetBrains Mono, monospace',
                    color: PRICE_COLOR,
                  }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between font-mono text-[10px] text-text-tertiary">
        <span>{source}</span>
        {latest?.__x && (
          <span>
            updated {new Date(latest.__x).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        )}
      </div>
    </Card>
  )
}
