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

// ═══════════════════════════════════════════════════════════════════════════
// A ESCADA DE 13 DA DOGCITY (docs §2, decidida em 28/09/2026): os 12 tiers acima
// mais o $DOG Soldier, que só existe na cidade (tem $DOG no snapshot, nunca
// vendeu e tem menos de uma cota do airdrop). A ordem é o degrau publicado:
// TIER 1 OF 13 é o Satoshi Visionary, TIER 13 OF 13 é o Paper Hands.
// Empresa e reserva não estão na escada: "Company" e "Project Reserve".
//
// Os códigos (t1..t6, sol, v1..v6, co, res) são os do registro do jogo e da
// escritura (dogcity-mundo plano/carta/escritura_render.mjs) e de
// data/dogcity_lot_info.json. O NOME vem daqui, sempre: a landing, a busca e a
// galeria das escrituras leem esta tabela e nenhuma outra.
// ═══════════════════════════════════════════════════════════════════════════
export const DOG_SOLDIER_LABEL = '$DOG Soldier'
export const COMPANY_LABEL = 'Company'
export const PROJECT_RESERVE_LABEL = 'Project Reserve'

export type CityTierCode =
  | 't1' | 't2' | 't3' | 't4' | 't5' | 't6' | 'sol'
  | 'v1' | 'v2' | 'v3' | 'v4' | 'v5' | 'v6' | 'co' | 'res'

export interface CityTier {
  code: CityTierCode
  /** degrau de 1 a 13; null para empresa e reserva */
  rung: number | null
  label: string
}

const RUNGS: [CityTierCode, TierKey | null][] = [
  ['t1', 'satoshi_visionary'], ['t2', 'btc_maximalist'], ['t3', 'rune_master'],
  ['t4', 'ordinal_believer'], ['t5', 'dog_legend'], ['t6', 'diamond_paws'],
  ['sol', null],
  ['v1', 'hodl_hero'], ['v2', 'steady_holder'], ['v3', 'profit_taker'],
  ['v4', 'early_exit'], ['v5', 'panic_seller'], ['v6', 'paper_hands'],
]

export const CITY_LADDER: CityTier[] = RUNGS.map(([code, key], i) => ({
  code,
  rung: i + 1,
  label: key ? TIER_BY_KEY[key].label : DOG_SOLDIER_LABEL,
}))

const CITY_TIER_BY_CODE: Record<string, CityTier> = Object.fromEntries([
  ...CITY_LADDER.map((t) => [t.code, t]),
  ['co', { code: 'co', rung: null, label: COMPANY_LABEL }],
  ['res', { code: 'res', rung: null, label: PROJECT_RESERVE_LABEL }],
])

/** o tier da cidade por código do registro; null se o código não existe */
export function cityTier(code: string | null | undefined): CityTier | null {
  return code ? CITY_TIER_BY_CODE[code] ?? null : null
}
