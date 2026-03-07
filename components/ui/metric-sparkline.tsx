'use client'

import { ResponsiveContainer, AreaChart, Area, Tooltip } from 'recharts'

interface MetricSparklineProps {
  data: { recorded_at: string; value: number }[]
  color?: string
  height?: number
  showTooltip?: boolean
  formatValue?: (v: number) => string
}

export function MetricSparkline({
  data,
  color = '#F97316',
  height = 48,
  showTooltip = false,
  formatValue = (v) => v.toFixed(2)
}: MetricSparklineProps) {
  if (!data || data.length < 2) return null

  const gradientId = `sparkGrad-${color.replace('#', '')}`

  return (
    <div style={{ width: '100%', height }} className="mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          {showTooltip && (
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(0, 0, 0, 0.85)',
                border: '1px solid rgba(245, 110, 15, 0.3)',
                borderRadius: '0px',
                color: '#FBFBFB',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '11px',
                padding: '4px 8px',
              }}
              labelFormatter={(label) => {
                const d = new Date(label)
                return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit' })
              }}
              formatter={(value: number) => [formatValue(value), '']}
            />
          )}
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={showTooltip ? { r: 3, stroke: color, fill: '#000' } : false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
