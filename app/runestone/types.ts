// Shape of /api/runestone/dossier. Built by runestone/scripts/build_dossier.py
// from a local ord enumeration of the 112,384 children of the burned parent,
// with current custody resolved against our own bitcoind UTXO set.

export interface Bucket { label: string; holders: number; stones: number }
export interface AgeBucket { label: string; stones: number; pct: number }
export interface MonthPoint { month: string; stones: number }

export interface TopHolder {
  rank: number
  address: string
  stones: number
  share: number
  veteran: boolean
  stones_at_airdrop: number | null
  dog_now: number | null
  behavior: string | null
  never_moved: number
}

// One row of /api/runestone/holders. Ranked by stones held today, then
// enriched with what that address did in the DOG airdrop. Distinct from
// TopHolder, which is the precomputed top 100 baked into the dossier.
export interface HolderRow {
  rank: number
  address: string
  stones: number
  share: number
  veteran: boolean
  stones_at_airdrop: number | null
  airdrop_dog: number | null
  current_dog: number | null
  behavior: string | null
  diamond_score: number | null
}

export interface Relic {
  address: string
  name: string
  note: string
  stones: number
  ids: string[]
  burned: boolean
}

export interface Dossier {
  generated_at: string
  tip_height: number
  tip_time: number
  collection: {
    parent_id: string
    parent_number: number
    parent_bytes: number
    parent_address: string
    supply: number
    first_block: number
    last_block: number
    blocks_used: number
    first_time: number
    last_time: number
    total_fees_sats: number
    parent_fee_sats: number
  }
  custody: {
    holders: number
    stones: number
    avg: number
    median: number
    max: number
    gini: number
    buckets: Bucket[]
    share_top10: number
    share_top100: number
    share_top1000: number
    singletons: number
  }
  dormancy: {
    never_moved: number
    never_moved_pct: number
    vaults: number
    age_buckets: AgeBucket[]
    by_month: MonthPoint[]
  }
  airdrop_cross: {
    cohort_addresses: number
    cohort_stones: number
    snapshot_block: number
    still_here: number
    left: number
    entered: number
    stones_veteran: number
    stones_new: number
    matrix: {
      stone_and_dog: number
      stone_no_dog: number
      no_stone_dog: number
      no_stone_no_dog: number
    }
    untouched: number
    accumulated: number
    reduced: number
    by_behavior: { pattern: string; addresses: number; stones_today: number }[]
  }
  provenance: {
    sat_epochs: { epoch: number; stones: number; first_block: number }[]
    sat_years: { year: number; stones: number }[]
    relics: Relic[]
    burned_stones: number
    oldest_sats: {
      id: string; number: number; sat: number; sat_block: number
      sat_year: number; address: string; notable: string | null
    }[]
    oldest_sat: { id: string; number: number; sat: number; sat_block: number; sat_year: number; address: string }
    uncommon: { id: string; number: number; sat: number; sat_block: number; address: string } | null
  }
  how_built: {
    delegate_target: string
    delegate_number: number
    delegate_content_type: string
    delegate_bytes: number
    delegate_fee_sats: number
    delegate_address: string
    child_bytes_each: number
    parent_content_type: string
    sampled: number
    note: string
  }
  // opcionais de proposito: o CDN pode servir um dossie de ate 10 minutos atras
  // enquanto o bundle ja e novo. campo novo que falta nao pode derrubar a pagina.
  verification?: {
    unique_outputs: number
    outputs_unspent: number
    outputs_spent: number
    stones_without_height: number
    independent_sample: { n: number; matched: number; errors: number; source: string }
  }
  run?: {
    stones: number
    first_block: number
    last_block: number
    blocks: number
    hours: number
    model_block: number | null
    model_lead_days: number | null
  }
  top_holders: TopHolder[]
  crosses?: {
    city?: {
      totals: { lots: number; lots_with_stones: number; stones: number; stones_pct_of_all_stones?: number; stone_addresses_outside_city?: number }
      districts: { district: string; lots: number; lots_with_stones: number; stones: number; share_pct?: number }[]
      typologies?: { typology: string; lots_with_stones: number; stones: number }[]
      genesis_core?: { total: number; with_stones: number; stones: number; holders?: { address: string; street?: string; number?: number; typology?: string; stones: number }[] }
    }
    two_clocks?: {
      baseline_lth_pct: number
      stone_holders_lth_pct: number
      with_dog?: {
        addresses: number; total_dog: number; lth_dominant: number
        avg_coin_age_days: number; stone_weighted_coin_age_days: number
        stones_held?: number; pct_of_dog_supply_in_snapshot?: number
      }
      matrix: { stone_band: string; coin_band: string; addresses: number; stones: number }[]
      correlation?: { pearson_r: number; n: number }
    }
    cohort_timeseries?: {
      series: { date: string; keepers_dog: number; sellers_dog: number; keeper_share_pct: number; keepers_live: number; sellers_live: number }[]
      summary: { first_date: string; last_date: string; days: number; keepers_change_pct: number; sellers_change_pct: number }
      notes?: string
    }
    price_moves?: {
      monthly: { month: string; stones_moved: number; avg_price: number | null; avg_mvrv: number | null }[]
      price_bands?: { from: number; to: number; stones: number; pct?: number }[]
      vs_realized?: { above: number; below: number; above_pct: number; matched: number }
      busiest_month?: string
      quietest_month?: string
      notes?: string
    }
    diamond_lost?: {
      diamond: { cohort_size: number; still_hold_stone: number; stones_held: number; dog_held: number; kept_dog_sold_stone: number; single_tx_wallets?: number; tx_count_median?: number }
      lost: { cohort_size: number; still_hold_stone: number; stones_held: number; airdrop_dog: number }
      notes?: string
    }
  }
}
