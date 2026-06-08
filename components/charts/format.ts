/**
 * Shared value formatters for on-chain charts.
 * Registry entries reference these by name so every chart formats consistently.
 */

export type ValueFormatter = (v: number) => string

const compact = (v: number, digits = 2): string => {
  const abs = Math.abs(v)
  if (abs >= 1e12) return `${(v / 1e12).toFixed(digits)}T`
  if (abs >= 1e9) return `${(v / 1e9).toFixed(digits)}B`
  if (abs >= 1e6) return `${(v / 1e6).toFixed(digits)}M`
  if (abs >= 1e3) return `${(v / 1e3).toFixed(digits)}K`
  return v.toFixed(abs < 1 ? digits : 0)
}

export const fmt = {
  /** Compact number: 1.2K, 3.4M, 5.6B */
  number: (v: number) => compact(v, 1),
  /** Plain integer with thousands separators */
  integer: (v: number) => Math.round(v).toLocaleString('en-US'),
  /** Ratio / index, 3 decimals: 1.234 */
  ratio: (v: number) => v.toFixed(3),
  /** Percentage: 42.50% */
  percent: (v: number) => `${v.toFixed(2)}%`,
  /** USD compact: $1.2M */
  usd: (v: number) => `$${compact(v, 2)}`,
  /** USD price with fine precision: $0.001234 */
  usdPrice: (v: number) => `$${v < 0.01 ? v.toPrecision(4) : v.toFixed(4)}`,
  /** DOG amount compact: 1.2B DOG */
  dog: (v: number) => `${compact(v, 2)} DOG`,
  /** Days: 155d */
  days: (v: number) => `${v.toFixed(0)}d`,
} satisfies Record<string, ValueFormatter>
