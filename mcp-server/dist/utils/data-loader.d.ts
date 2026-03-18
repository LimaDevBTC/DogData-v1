export interface Holder {
    address: string;
    total_amount: number;
    total_dog: number;
    utxo_count: number;
    rank: number;
}
export interface HoldersData {
    timestamp: string;
    total_holders: number;
    total_utxos: number;
    holders: Holder[];
    utxo_age_stats?: UtxoAgeStats;
}
export interface UtxoAgeStats {
    total_utxos: number;
    total_supply: number;
    avg_age_days: number;
    median_age_days: number;
    sth_supply: number;
    lth_supply: number;
    sth_percentage: number;
    lth_percentage: number;
    age_distribution: Record<string, number>;
    size_distribution: Record<string, {
        count: number;
        supply: number;
        percentage: number;
    }>;
    realized_cap: number;
    market_cap: number;
    mvrv_ratio: number;
    supply_in_profit: number;
    supply_in_loss: number;
}
export interface ForensicProfile {
    address: string;
    airdrop_rank: number;
    airdrop_amount: number;
    receive_count: number;
    first_receive_block: number;
    first_receive_time: string;
    current_balance: number;
    current_rank: number;
    absolute_change: number;
    percentage_change: number;
    retention_rate: number;
    rank_change: number;
    behavior_pattern: string;
    behavior_category: string;
    accumulation_rate: number;
    is_dumping: boolean;
    diamond_score: number;
    insights: string[];
    behavior_detail: string;
}
export interface ForensicData {
    timestamp: string;
    analysis_type: string;
    statistics: {
        total_analyzed: number;
        still_holding: number;
        sold_everything: number;
        accumulated: number;
        dumping: number;
        diamond_hands: number;
        by_pattern: Record<string, number>;
        retention_rate: number;
        accumulator_rate: number;
        dumper_rate: number;
    };
    top_performers: {
        diamond_hands: ForensicProfile[];
    };
    all_profiles: ForensicProfile[];
}
export interface AirdropRecipient {
    address: string;
    airdrop_amount: number;
    receive_count: number;
    current_balance: number;
    status: string;
    rank: number;
}
export interface AirdropData {
    timestamp: string;
    data_source: string;
    analytics: {
        summary: {
            total_recipients: number;
            still_holding: number;
            sold_everything: number;
            retention_rate: number;
            total_current_balance: number;
            recipients_with_multiple: number;
            total_airdrops: number;
        };
        by_category: Record<string, number>;
        recipients: AirdropRecipient[];
    };
}
export declare function loadHolders(): Promise<HoldersData>;
export declare function loadHoldersWithUtxoStats(): Promise<HoldersData>;
export declare function loadForensicData(): Promise<ForensicData>;
export declare function loadAirdropData(): Promise<AirdropData>;
export declare function loadUtxoSet(): Promise<Record<string, number>>;
export interface Transaction {
    txid: string;
    type: string;
    amount: number;
    from?: string;
    to?: string;
    block_height?: number;
    timestamp?: string;
    fee?: number;
    [key: string]: unknown;
}
export declare function loadTransactions(): Promise<Transaction[]>;
export interface KrakenPrice {
    price: number;
    ask: number;
    bid: number;
    volume_24h: number;
    vwap: number;
    high_24h: number;
    low_24h: number;
    open_24h: number;
    trades_24h: number;
    timestamp: string;
}
export declare function fetchKrakenPrice(): Promise<KrakenPrice>;
export interface CoinGeckoData {
    market_cap: number;
    market_cap_rank: number | null;
    fully_diluted_valuation: number;
    total_volume: number;
    price_change_24h: number;
    price_change_percentage_24h: number;
    price_change_percentage_7d: number;
    price_change_percentage_30d: number;
    circulating_supply: number;
    total_supply: number;
    ath: number;
    ath_date: string;
    atl: number;
    atl_date: string;
    tickers: Array<{
        base: string;
        target: string;
        market: {
            name: string;
            identifier: string;
        };
        last: number;
        volume: number;
        converted_volume: {
            usd: number;
        };
        trust_score: string;
        trade_url: string;
    }>;
    timestamp: string;
}
export declare function fetchCoinGeckoData(): Promise<CoinGeckoData>;
export interface MempoolData {
    block_height: number;
    block_hash: string;
    difficulty: number;
    hashrate: number;
    mempool_size: number;
    mempool_bytes: number;
    fee_estimates: {
        fastest: number;
        half_hour: number;
        hour: number;
        economy: number;
        minimum: number;
    };
    timestamp: string;
}
export declare function fetchBitcoinNetwork(): Promise<MempoolData>;
export declare const DOG_TOTAL_SUPPLY = 100000000000;
