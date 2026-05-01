export type TierKey =
  | 'satoshi_visionary'
  | 'btc_maximalist'
  | 'rune_master'
  | 'ordinal_believer'
  | 'dog_legend'
  | 'diamond_paws'
  | 'hodl_hero'
  | 'steady_holder'
  | 'profit_taker'
  | 'early_exit'
  | 'panic_seller'
  | 'paper_hands'

export type TierCategory = 'Accumulator' | 'Holder' | 'Sold or Moved'

export interface TierDef {
  key: TierKey
  category: TierCategory
  label: string
  threshold: string
  description: string
  diamondScore: number
  // Tailwind background class for the distribution bar segment
  barColor: string
  // Tailwind text color class for tier labels
  textColor: string
}

export const TIERS: TierDef[] = [
  {
    key: 'satoshi_visionary',
    category: 'Accumulator',
    label: 'Satoshi Visionary',
    threshold: '+1000% or more',
    description: 'Bought 10x or more of their original airdrop',
    diamondScore: 95,
    barColor: 'bg-emerald-300',
    textColor: 'text-emerald-300',
  },
  {
    key: 'btc_maximalist',
    category: 'Accumulator',
    label: 'BTC Maximalist',
    threshold: '+500% to +1000%',
    description: 'Bought 5–10x of their original airdrop',
    diamondScore: 90,
    barColor: 'bg-emerald-400',
    textColor: 'text-emerald-400',
  },
  {
    key: 'rune_master',
    category: 'Accumulator',
    label: 'Rune Master',
    threshold: '+200% to +500%',
    description: 'Bought 2–5x of their original airdrop',
    diamondScore: 85,
    barColor: 'bg-emerald-500',
    textColor: 'text-emerald-500',
  },
  {
    key: 'ordinal_believer',
    category: 'Accumulator',
    label: 'Ordinal Believer',
    threshold: '+50% to +200%',
    description: 'Added 50–200% on top of the airdrop',
    diamondScore: 80,
    barColor: 'bg-emerald-600',
    textColor: 'text-emerald-600',
  },
  {
    key: 'dog_legend',
    category: 'Accumulator',
    label: 'DOG Supporter',
    threshold: '+0% to +50%',
    description: 'Added any amount above their airdrop',
    diamondScore: 75,
    barColor: 'bg-emerald-700',
    textColor: 'text-emerald-500',
  },
  {
    key: 'diamond_paws',
    category: 'Holder',
    label: 'Diamond Paws',
    threshold: 'Exactly 100% retained',
    description: 'Holds the exact airdrop amount, never moved a sat',
    diamondScore: 100,
    barColor: 'bg-purple-500',
    textColor: 'text-purple-400',
  },
  {
    key: 'hodl_hero',
    category: 'Sold or Moved',
    label: 'HODL Hero',
    threshold: '90%+ retained',
    description: 'Sold or moved less than 10% of the airdrop',
    diamondScore: 65,
    barColor: 'bg-yellow-400',
    textColor: 'text-yellow-400',
  },
  {
    key: 'steady_holder',
    category: 'Sold or Moved',
    label: 'Steady Holder',
    threshold: '75–90% retained',
    description: 'Sold or moved 10–25% of the airdrop',
    diamondScore: 55,
    barColor: 'bg-amber-500',
    textColor: 'text-amber-500',
  },
  {
    key: 'profit_taker',
    category: 'Sold or Moved',
    label: 'Profit Taker',
    threshold: '50–75% retained',
    description: 'Sold or moved 25–50% of the airdrop',
    diamondScore: 45,
    barColor: 'bg-orange-500',
    textColor: 'text-orange-400',
  },
  {
    key: 'early_exit',
    category: 'Sold or Moved',
    label: 'Early Exit',
    threshold: '25–50% retained',
    description: 'Sold or moved 50–75% of the airdrop',
    diamondScore: 30,
    barColor: 'bg-orange-600',
    textColor: 'text-orange-500',
  },
  {
    key: 'panic_seller',
    category: 'Sold or Moved',
    label: 'Panic Seller',
    threshold: '10–25% retained',
    description: 'Sold or moved 75–90% of the airdrop',
    diamondScore: 15,
    barColor: 'bg-red-600',
    textColor: 'text-red-500',
  },
  {
    key: 'paper_hands',
    category: 'Sold or Moved',
    label: 'Paper Hands',
    threshold: 'Less than 10% retained',
    description: 'Sold or moved 90%+ of the airdrop',
    diamondScore: 5,
    barColor: 'bg-red-700',
    textColor: 'text-red-500',
  },
]

export const TIER_BY_KEY: Record<TierKey, TierDef> = TIERS.reduce(
  (acc, t) => {
    acc[t.key] = t
    return acc
  },
  {} as Record<TierKey, TierDef>,
)

export const ACCUMULATOR_KEYS: TierKey[] = TIERS.filter(
  (t) => t.category === 'Accumulator',
).map((t) => t.key)

export const HOLDER_KEYS: TierKey[] = TIERS.filter(
  (t) => t.category === 'Holder',
).map((t) => t.key)

export const SELLER_KEYS: TierKey[] = TIERS.filter(
  (t) => t.category === 'Sold or Moved',
).map((t) => t.key)

export const CATEGORY_META: {
  key: 'accumulators' | 'holders' | 'sellers'
  label: TierCategory
  short: string
  textColor: string
  borderColor: string
  description: string
  tierKeys: TierKey[]
}[] = [
  {
    key: 'accumulators',
    label: 'Accumulator',
    short: 'Accumulators',
    textColor: 'text-emerald-400',
    borderColor: 'border-emerald-400/30',
    description: 'Bought more DOG after the airdrop',
    tierKeys: ACCUMULATOR_KEYS,
  },
  {
    key: 'holders',
    label: 'Holder',
    short: 'Holders',
    textColor: 'text-purple-400',
    borderColor: 'border-purple-400/30',
    description: 'Holding the exact airdrop amount',
    tierKeys: HOLDER_KEYS,
  },
  {
    key: 'sellers',
    label: 'Sold or Moved',
    short: 'Sold or Moved',
    textColor: 'text-red-400',
    borderColor: 'border-red-400/30',
    description: 'Sold or moved at least part of the airdrop',
    tierKeys: SELLER_KEYS,
  },
]

export function tierLabel(pattern: string | undefined | null): string {
  if (!pattern) return '—'
  const tier = TIER_BY_KEY[pattern as TierKey]
  return tier ? tier.label : pattern
}

export function tierThreshold(pattern: string | undefined | null): string {
  if (!pattern) return ''
  const tier = TIER_BY_KEY[pattern as TierKey]
  return tier ? tier.threshold : ''
}
