export interface DogDataConfig {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface Holder {
  address: string;
  balance: number;
  rank: number;
  utxo_count: number;
  percentage: number;
  last_updated: string;
}

export interface HolderDetail extends Holder {
  utxos: Utxo[];
  first_seen: string;
  category?: string;
}

export interface Utxo {
  txid: string;
  vout: number;
  amount: number;
  block_height: number;
  timestamp: string;
}

export interface Transaction {
  txid: string;
  block_height: number;
  timestamp: string;
  from: string;
  to: string;
  amount: number;
  fee: number;
  type: string;
}

export interface PriceData {
  exchange: string;
  price_usd: number;
  price_btc: number;
  volume_24h: number;
  change_24h: number;
  timestamp: string;
}

export interface AggregatedPrice {
  price_usd: number;
  price_btc: number;
  volume_24h_usd: number;
  change_24h: number;
  sources: PriceData[];
  timestamp: string;
}

export interface MetricsUtxo {
  total_utxos: number;
  distribution: Record<string, number>;
  average_utxo_size: number;
  median_utxo_size: number;
  timestamp: string;
}

export interface HolderConcentration {
  top_10: { holders: number; percentage: number };
  top_50: { holders: number; percentage: number };
  top_100: { holders: number; percentage: number };
  gini_coefficient: number;
  timestamp: string;
}

export interface RealizedCap {
  realized_cap_usd: number;
  realized_cap_btc: number;
  timestamp: string;
}

export interface ForensicProfile {
  address: string;
  diamond_score: number;
  category: string;
  airdrop_amount: number;
  current_balance: number;
  sold_percentage: number;
  first_sell_date: string | null;
  transaction_count: number;
  tags: string[];
}

export interface ForensicSummary {
  total_profiles: number;
  categories: Record<string, number>;
  average_diamond_score: number;
  diamond_hands_count: number;
  paper_hands_count: number;
  timestamp: string;
}

export interface AirdropSummary {
  total_recipients: number;
  total_distributed: number;
  claimed_percentage: number;
  timestamp: string;
}

export interface AirdropRecipient {
  address: string;
  amount: number;
  claimed: boolean;
  claim_date: string | null;
  current_balance: number;
}

export interface BitcoinStatus {
  block_height: number;
  hashrate: string;
  difficulty: number;
  mempool_size: number;
  fee_rate: {
    fast: number;
    medium: number;
    slow: number;
  };
  timestamp: string;
}

export interface MarketData {
  exchange: string;
  pair: string;
  price_usd: number;
  volume_24h: number;
  bid: number;
  ask: number;
  spread: number;
  timestamp: string;
}

export type Chain = 'stacks' | 'solana';

export interface MultichainHoldersResponse {
  stacks?: {
    holders: Array<{ address: string; balance: number; rank: number; percentage: number; balance_usd?: number | null }>;
    stats: { whale_count: number; active_traders: number; fresh_holders: number };
    concentration: { top_10: number; top_25: number; top_50: number };
  };
  solana?: {
    holders: Array<{ address: string; balance: number; rank: number; balance_usd?: number | null }>;
    total_count: number;
    bridgeSupply: number;
    circulatingOnChain: number | null;
    stats: { holder_count: number; volume_24h_usd: number };
  };
}

export interface MultichainTransactionsResponse {
  stacks?: {
    transactions: Array<{ txid: string; type: string; amount: number; timestamp: string; from?: string; to?: string }>;
    total_count: number;
  };
  solana?: {
    transactions: Array<{ txid: string; type: string; amount: number; timestamp: string; from?: string; to?: string }>;
    total_count: number;
  };
}

export interface MultichainStatsResponse {
  total_holders: number;
  total_market_cap_usd: number;
  total_volume_24h_usd: number;
  total_supply_all_chains: number;
  chains: Array<{
    chain: string;
    holder_count: number;
    market_cap_usd: number;
    volume_24h_usd: number;
    price_usd: number;
    circulating_supply: number;
  }>;
  last_updated: string;
}

export interface ApiError {
  error: string;
  message: string;
  status: number;
}
