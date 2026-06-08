/**
 * Metric registry — the single source of truth for every on-chain chart.
 *
 * Each entry is a pure config object consumed by <OnChainChart>. Adding a new
 * chart = adding an entry here (+ ensuring the data row carries its keys). This
 * is what lets the catalog scale to ChartInspect parity without new components.
 *
 * `series[].key` references a numeric field on the time-series rows returned by
 * the chart's data source (currently /api/metrics/history rows, remapped so
 * `date` = recorded_at and `price` = current_price).
 */

import type { ChartSeries, ChartBand, AxisConfig } from './onchain-chart'
import { fmt } from './format'

export type MetricCategory =
  | 'Valuation'
  | 'Profit / Loss'
  | 'Supply Dynamics'
  | 'Holder Cohorts'
  | 'Concentration'
  | 'Network Activity'

export interface MetricDef {
  /** url-safe unique slug */
  slug: string
  title: string
  category: MetricCategory
  description: string
  series: ChartSeries[]
  showPrice?: boolean
  bands?: ChartBand[]
  leftAxis?: AxisConfig
  defaultRange?: import('./onchain-chart').TimeRange
}

// Palette aligned with tailwind tokens
const C = {
  primary: '#F7931A',
  data: '#E8820E',
  amber: '#FFAD42',
  positive: '#2ECC71',
  negative: '#E74C3C',
  blue: '#3B82F6',
  violet: '#A78BFA',
  cyan: '#22D3EE',
}

export const METRICS: MetricDef[] = [
  // ─── Valuation ──────────────────────────────────────────────────
  {
    slug: 'mvrv-ratio',
    title: 'MVRV Ratio',
    category: 'Valuation',
    description:
      'Market Value to Realized Value. Above 1 the average holder is in profit; sustained extremes have historically marked tops (high) and bottoms (low).',
    series: [{ key: 'mvrv_ratio', label: 'MVRV', color: C.primary, format: fmt.ratio }],
    bands: [
      { from: 0, to: 1, color: C.positive, label: 'Undervalued' },
      { from: 3, to: 99, color: C.negative, label: 'Overvalued' },
    ],
    leftAxis: { format: fmt.ratio },
  },
  {
    slug: 'realized-cap',
    title: 'Market Cap vs Realized Cap',
    category: 'Valuation',
    description:
      'Realized Cap values each UTXO at the price when it last moved (aggregate cost basis), versus Market Cap at the current price. Their gap is unrealized profit/loss.',
    series: [
      { key: 'market_cap', label: 'Market Cap', color: C.primary, type: 'area', format: fmt.usd },
      { key: 'realized_cap', label: 'Realized Cap', color: C.blue, format: fmt.usd },
    ],
    showPrice: false,
    leftAxis: { format: fmt.usd },
  },

  // ─── Profit / Loss ──────────────────────────────────────────────
  {
    slug: 'supply-in-profit',
    title: 'Supply in Profit',
    category: 'Profit / Loss',
    description:
      'Share of circulating DOG whose cost basis is below the current price. Near 100% signals euphoria/risk; near 0% signals capitulation.',
    series: [
      { key: 'supply_in_profit_pct', label: 'Supply in Profit', color: C.positive, type: 'area', format: fmt.percent },
    ],
    leftAxis: { domain: [0, 100], format: fmt.percent },
  },

  // ─── Holder Cohorts ─────────────────────────────────────────────
  {
    slug: 'sth-lth-supply',
    title: 'STH vs LTH Supply',
    category: 'Holder Cohorts',
    description:
      "Short-Term Holders (<155d) vs Long-Term Holders (≥155d) share of supply — DOG DATA's signature cohort split. Rising LTH = accumulation/conviction.",
    series: [
      { key: 'lth_percentage', label: 'LTH %', color: C.primary, format: fmt.percent },
      { key: 'sth_percentage', label: 'STH %', color: C.cyan, format: fmt.percent },
    ],
    leftAxis: { domain: [0, 100], format: fmt.percent },
  },
  {
    slug: 'utxo-age',
    title: 'Average UTXO Age',
    category: 'Holder Cohorts',
    description:
      'Mean and median age of unspent DOG outputs. Rising age means coins are sitting still (HODLing); sharp drops mean old coins are moving.',
    series: [
      { key: 'avg_age_days', label: 'Avg Age', color: C.primary, format: fmt.days },
      { key: 'median_age_days', label: 'Median Age', color: C.amber, dashed: true, format: fmt.days },
    ],
    leftAxis: { format: fmt.days },
  },

  // ─── Concentration ──────────────────────────────────────────────
  {
    slug: 'gini',
    title: 'Gini Coefficient',
    category: 'Concentration',
    description:
      'Wealth inequality across holders, 0 (perfectly equal) to 1 (one holder owns everything). Tracks whether supply is concentrating or distributing.',
    series: [{ key: 'gini_coefficient', label: 'Gini', color: C.violet, format: fmt.ratio }],
    leftAxis: { domain: [0, 1], format: fmt.ratio },
  },
  {
    slug: 'top-holders-supply',
    title: 'Top Holder Concentration',
    category: 'Concentration',
    description:
      'Share of supply held by the largest 10 / 100 / 1000 addresses. Whale accumulation or distribution shows up here first.',
    series: [
      { key: 'top10_supply_pct', label: 'Top 10', color: C.negative, format: fmt.percent },
      { key: 'top100_supply_pct', label: 'Top 100', color: C.amber, format: fmt.percent },
      { key: 'top1000_supply_pct', label: 'Top 1000', color: C.positive, format: fmt.percent },
    ],
    leftAxis: { format: fmt.percent },
  },

  // ─── Network Activity ───────────────────────────────────────────
  {
    slug: 'total-holders',
    title: 'Total Holders',
    category: 'Network Activity',
    description:
      'Count of distinct addresses holding a non-zero DOG balance. Organic growth in holders is a core adoption signal.',
    series: [{ key: 'total_holders', label: 'Holders', color: C.primary, type: 'area', format: fmt.integer }],
    leftAxis: { format: fmt.number },
  },
  {
    slug: 'total-utxos',
    title: 'Total UTXOs',
    category: 'Network Activity',
    description:
      'Number of unspent DOG outputs. Reflects fragmentation of holdings and on-chain activity intensity.',
    series: [{ key: 'total_utxos', label: 'UTXOs', color: C.data, type: 'area', format: fmt.integer }],
    leftAxis: { format: fmt.number },
  },
]

export const CATEGORY_ORDER: MetricCategory[] = [
  'Valuation',
  'Profit / Loss',
  'Holder Cohorts',
  'Concentration',
  'Network Activity',
  'Supply Dynamics',
]

export function metricsByCategory(): Record<string, MetricDef[]> {
  const out: Record<string, MetricDef[]> = {}
  for (const cat of CATEGORY_ORDER) {
    const items = METRICS.filter((m) => m.category === cat)
    if (items.length) out[cat] = items
  }
  return out
}
