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
  /** show survivorship coverage note when early data < 90% */
  showCoverage?: boolean
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
  teal: '#14B8A6',
  pink: '#EC4899',
  lime: '#84CC16',
  indigo: '#6366F1',
  rose: '#F43F5E',
  sky: '#38BDF8',
}

// HODL wave age-bucket colors — warm (new) → cool (old)
const HODL_COLORS = ['#EF4444', '#F97316', '#FBBF24', '#84CC16', '#22D3EE', '#3B82F6', '#A78BFA', '#EC4899']
const HODL_LABELS = ['<1d', '1-7d', '7-30d', '30-90d', '90-155d', '155d-1y', '1-2y', '>2y']
const HODL_KEYS = [
  'hodl_wave_lt1d_pct', 'hodl_wave_1_7d_pct', 'hodl_wave_7_30d_pct', 'hodl_wave_30_90d_pct',
  'hodl_wave_90_155d_pct', 'hodl_wave_155d_1y_pct', 'hodl_wave_1_2y_pct', 'hodl_wave_gt2y_pct',
]

export const METRICS: MetricDef[] = [
  // ─── Valuation ──────────────────────────────────────────────────
  {
    slug: 'dog-price',
    title: 'DOG Price (USD)',
    category: 'Valuation',
    description:
      'DOG/USD market price since inception (block 840000, April 2024). Sourced from daily OHLCV aggregates.',
    series: [{ key: 'price', label: 'DOG/USD', color: C.primary, type: 'area', format: fmt.usdPrice }],
    showPrice: false,
    leftAxis: { format: fmt.usdPrice },
  },
  {
    slug: 'mvrv-ratio',
    title: 'MVRV Ratio',
    category: 'Valuation',
    description:
      'Market Value to Realized Value. Above 1 the average holder is in profit; sustained extremes have historically marked tops (high) and bottoms (low).',
    series: [{ key: 'mvrv_ratio', label: 'MVRV', color: C.primary, format: fmt.ratio }],
    showCoverage: true,
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
    showCoverage: true,
    leftAxis: { format: fmt.usd },
  },
  {
    slug: 'realized-price',
    title: 'Realized Price',
    category: 'Valuation',
    description:
      'The aggregate cost basis per DOG: total value paid for all held UTXOs divided by circulating supply. When price crosses realized price from below it signals a market regime shift.',
    series: [
      { key: 'realized_price', label: 'Realized Price', color: C.blue, format: fmt.usdPrice },
    ],
    showCoverage: true,
    leftAxis: { format: fmt.usdPrice },
  },

  // ─── Profit / Loss ──────────────────────────────────────────────
  {
    slug: 'nupl',
    title: 'NUPL — Net Unrealized Profit/Loss',
    category: 'Profit / Loss',
    description:
      'Net Unrealized Profit/Loss = (Market Cap − Realized Cap) / Market Cap. Ranges −1 to 1. Sustained readings above 0.75 (Euphoria) have historically coincided with market tops.',
    series: [{ key: 'nupl', label: 'NUPL', color: C.primary, type: 'area', format: fmt.ratio }],
    showCoverage: true,
    bands: [
      { from: -1, to: 0, color: C.negative, label: 'Capitulation' },
      { from: 0, to: 0.25, color: C.amber, label: 'Hope' },
      { from: 0.75, to: 1, color: C.positive, label: 'Euphoria' },
    ],
    leftAxis: { domain: [-1, 1], format: fmt.ratio },
  },
  {
    slug: 'supply-in-profit',
    title: 'Supply in Profit',
    category: 'Profit / Loss',
    description:
      'Share of circulating DOG whose cost basis is below the current price. Near 100% signals euphoria/risk; near 0% signals capitulation.',
    series: [
      { key: 'supply_in_profit_pct', label: 'In Profit', color: C.positive, type: 'area', format: fmt.percent },
    ],
    showCoverage: true,
    leftAxis: { domain: [0, 100], format: fmt.percent },
  },
  {
    slug: 'supply-in-loss',
    title: 'Supply in Loss',
    category: 'Profit / Loss',
    description:
      'Share of circulating DOG whose cost basis is above the current price. Spikes in supply-in-loss during price recoveries often mark long-term capitulation bottoms.',
    series: [
      { key: 'supply_in_loss_pct', label: 'In Loss', color: C.negative, type: 'area', format: fmt.percent },
    ],
    showCoverage: true,
    leftAxis: { domain: [0, 100], format: fmt.percent },
  },
  {
    slug: 'supply-profit-loss',
    title: 'Supply in Profit vs Loss',
    category: 'Profit / Loss',
    description:
      'Combined view: supply in profit (green) vs supply in loss (red). Together they always sum to 100% of held supply. Cross-overs mark critical market inflection points.',
    series: [
      { key: 'supply_in_profit_pct', label: 'In Profit', color: C.positive, format: fmt.percent },
      { key: 'supply_in_loss_pct', label: 'In Loss', color: C.negative, format: fmt.percent },
    ],
    showCoverage: true,
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
    showCoverage: true,
    leftAxis: { domain: [0, 100], format: fmt.percent },
  },
  {
    slug: 'sth-lth-realized-cap',
    title: 'STH vs LTH Realized Cap',
    category: 'Holder Cohorts',
    description:
      'Aggregate cost basis of Short-Term Holders vs Long-Term Holders. When LTH realized cap rises, old coins are accumulating value; when STH realized cap spikes, new buyers are entering.',
    series: [
      { key: 'lth_realized_cap', label: 'LTH Realized Cap', color: C.primary, format: fmt.usd },
      { key: 'sth_realized_cap', label: 'STH Realized Cap', color: C.cyan, format: fmt.usd },
    ],
    showCoverage: true,
    showPrice: false,
    leftAxis: { format: fmt.usd },
  },
  {
    slug: 'sth-lth-cost-basis',
    title: 'STH vs LTH Cost Basis',
    category: 'Holder Cohorts',
    description:
      'Average acquisition price for Short-Term vs Long-Term Holders. When price falls below LTH cost basis the long-term cohort is underwater — historically a rare and significant event.',
    series: [
      { key: 'lth_cost_basis', label: 'LTH Cost Basis', color: C.primary, format: fmt.usdPrice },
      { key: 'sth_cost_basis', label: 'STH Cost Basis', color: C.cyan, dashed: true, format: fmt.usdPrice },
    ],
    showCoverage: true,
    leftAxis: { format: fmt.usdPrice },
  },
  {
    slug: 'sth-lth-mvrv',
    title: 'STH vs LTH MVRV',
    category: 'Holder Cohorts',
    description:
      'MVRV split by cohort: Short-Term MVRV above 1.5 signals overheated speculative activity; LTH MVRV extremes mark macro tops and bottoms.',
    series: [
      { key: 'lth_mvrv', label: 'LTH MVRV', color: C.primary, format: fmt.ratio },
      { key: 'sth_mvrv', label: 'STH MVRV', color: C.cyan, dashed: true, format: fmt.ratio },
    ],
    showCoverage: true,
    bands: [{ from: 0, to: 1, color: C.positive, label: 'Undervalued' }],
    leftAxis: { format: fmt.ratio },
  },
  {
    slug: 'utxo-age',
    title: 'Average UTXO Age',
    category: 'Holder Cohorts',
    description:
      'Supply-weighted mean age of unspent DOG outputs in days. Rising age means coins are sitting still (HODLing); sharp drops signal old coins moving.',
    series: [
      { key: 'avg_age_days', label: 'Avg Age (weighted)', color: C.primary, format: fmt.days },
      { key: 'median_age_days', label: 'Median Age', color: C.amber, dashed: true, format: fmt.days },
    ],
    showCoverage: true,
    leftAxis: { format: fmt.days },
  },

  // ─── Supply Dynamics ────────────────────────────────────────────
  {
    slug: 'hodl-waves',
    title: 'HODL Waves',
    category: 'Supply Dynamics',
    description:
      'Supply broken into age cohorts as a share of total, stacked to show 100%. Younger cohorts (warm colors) dominate after price spikes as old coins move; older cohorts (cool) grow during accumulation.',
    series: HODL_KEYS.map((k, i) => ({
      key: k,
      label: HODL_LABELS[i],
      color: HODL_COLORS[i],
      type: 'area' as const,
      stackId: 'hodl',
      format: fmt.percent,
    })),
    showCoverage: true,
    showPrice: false,
    defaultRange: 'ALL',
    leftAxis: { domain: [0, 100], format: fmt.percent },
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
