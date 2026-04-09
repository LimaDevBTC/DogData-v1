export type Chain = 'bitcoin' | 'solana' | 'stacks'

export interface ChainTokenInfo {
  chain: Chain
  address: string
  symbol: string
  name: string
  decimals: number
  price_usd: number
  price_change_24h: number
  market_cap_usd: number
  volume_24h_usd: number
  liquidity_usd: number | null
  holder_count: number
  total_supply: number
  circulating_supply: number
  last_updated: string
}

export interface ChainHolder {
  chain: Chain
  address: string
  balance: number
  balance_usd: number | null
  percentage_of_supply: number
  rank: number
  last_active: string | null
}

export interface ChainTransfer {
  from: string
  to: string
  amount: number
}

export interface ChainTransaction {
  chain: Chain
  tx_id: string
  type: 'transfer' | 'trade' | 'swap' | 'bridge'
  from_address: string
  to_address: string
  amount: number
  amount_usd: number | null
  timestamp: string
  block_height: number | null
  // Enrichment fields (optional — populated when available)
  protocol?: string           // DEX / platform name (e.g. Jupiter, Raydium, ALEX, Velar)
  description?: string        // Human-readable description (e.g. from Helius)
  fee?: number                // Transaction fee (SOL in lamports→SOL, STX in µSTX→STX)
  fee_token?: 'SOL' | 'STX'  // Which token the fee is denominated in
  all_transfers?: ChainTransfer[] // All DOG transfers in the tx (multi-hop / multi-output)
}

export interface MultiChainStats {
  total_holders: number
  total_market_cap_usd: number
  total_volume_24h_usd: number
  total_supply_all_chains: number
  chains: ChainTokenInfo[]
  last_updated: string
}

export interface MultiChainHolders {
  chain: Chain
  holders: ChainHolder[]
  total_count: number
  top_10_percentage: number | null
}

export interface MultiChainTransactions {
  chain: Chain
  transactions: ChainTransaction[]
  total_count: number
}

// Token addresses
export const DOG_TOKENS = {
  bitcoin: { address: 'rune:840000:3', name: 'DOG•GO•TO•THE•MOON', decimals: 5 },
  solana: { address: 'dog1viwbb2vWDpER5FrJ4YFG6gq6XuyFohUe9TXN65u', name: 'Dog (Bitcoin)', decimals: 5 },
  stacks: { address: 'SP14NS8MVBRHXMM96BQY0727AJ59SWPV7RMHC0NCG.pontis-bridge-DOG', name: 'DOG.GO.TO.THE.MOON', decimals: 5 },
} as const
