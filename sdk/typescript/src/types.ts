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

export interface ApiError {
  error: string;
  message: string;
  status: number;
}
