import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { Redis } from "@upstash/redis";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, "..", "..", "data");

// ---------------------------------------------------------------------------
// In-memory cache with TTL
// ---------------------------------------------------------------------------
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache<T>(key: string, data: T, ttlMs: number): T {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
  return data;
}

// ---------------------------------------------------------------------------
// JSON file loaders
// ---------------------------------------------------------------------------
async function loadJsonFile<T>(filename: string, ttlMs = 60_000): Promise<T> {
  const cacheKey = `file:${filename}`;
  const cached = getCached<T>(cacheKey);
  if (cached) return cached;

  const filePath = path.join(DATA_DIR, filename);
  const raw = await readFile(filePath, "utf-8");
  const data = JSON.parse(raw) as T;
  return setCache(cacheKey, data, ttlMs);
}

// --- Typed data shapes ---------------------------------------------------

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
  size_distribution: Record<string, { count: number; supply: number; percentage: number }>;
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

// --- Public loaders -------------------------------------------------------

export async function loadHolders(): Promise<HoldersData> {
  return loadJsonFile<HoldersData>("dog_holders_by_address.json", 120_000);
}

export async function loadHoldersWithUtxoStats(): Promise<HoldersData> {
  return loadJsonFile<HoldersData>("dog_holders.json", 120_000);
}

export async function loadForensicData(): Promise<ForensicData> {
  return loadJsonFile<ForensicData>("forensic_behavioral_analysis.json", 300_000);
}

export async function loadAirdropData(): Promise<AirdropData> {
  return loadJsonFile<AirdropData>("airdrop_analytics.json", 300_000);
}

export async function loadUtxoSet(): Promise<Record<string, number>> {
  return loadJsonFile<Record<string, number>>("dog_utxo_set.json", 120_000);
}

// ---------------------------------------------------------------------------
// Redis (Upstash) — lazy singleton
// ---------------------------------------------------------------------------
let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_KV_REST_API_URL;
  const token = process.env.UPSTASH_KV_REST_API_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

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

export async function loadTransactions(): Promise<Transaction[]> {
  const cacheKey = "redis:transactions";
  const cached = getCached<Transaction[]>(cacheKey);
  if (cached) return cached;

  const r = getRedis();
  if (!r) return [];

  try {
    const data = await r.get<Transaction[]>("dog:transactions");
    if (!data) return [];
    const txs = Array.isArray(data) ? data : [];
    return setCache(cacheKey, txs, 30_000);
  } catch (err) {
    console.error("[data-loader] Redis error:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// External API fetchers
// ---------------------------------------------------------------------------

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

export async function fetchKrakenPrice(): Promise<KrakenPrice> {
  const cacheKey = "api:kraken";
  const cached = getCached<KrakenPrice>(cacheKey);
  if (cached) return cached;

  const resp = await fetch("https://api.kraken.com/0/public/Ticker?pair=DOGUSD");
  const json = (await resp.json()) as {
    result?: Record<string, {
      c: [string, string];
      a: [string, string, string];
      b: [string, string, string];
      v: [string, string];
      p: [string, string];
      h: [string, string];
      l: [string, string];
      o: string;
      t: [number, number];
    }>;
    error?: string[];
  };

  const pair = Object.values(json.result ?? {})[0];
  if (!pair) throw new Error("Kraken returned no data");

  const data: KrakenPrice = {
    price: parseFloat(pair.c[0]),
    ask: parseFloat(pair.a[0]),
    bid: parseFloat(pair.b[0]),
    volume_24h: parseFloat(pair.v[1]),
    vwap: parseFloat(pair.p[1]),
    high_24h: parseFloat(pair.h[1]),
    low_24h: parseFloat(pair.l[1]),
    open_24h: parseFloat(pair.o),
    trades_24h: pair.t[1],
    timestamp: new Date().toISOString(),
  };
  return setCache(cacheKey, data, 30_000);
}

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
    market: { name: string; identifier: string };
    last: number;
    volume: number;
    converted_volume: { usd: number };
    trust_score: string;
    trade_url: string;
  }>;
  timestamp: string;
}

export async function fetchCoinGeckoData(): Promise<CoinGeckoData> {
  const cacheKey = "api:coingecko";
  const cached = getCached<CoinGeckoData>(cacheKey);
  if (cached) return cached;

  const resp = await fetch(
    "https://api.coingecko.com/api/v3/coins/dog-go-to-the-moon-rune"
  );
  const json = (await resp.json()) as {
    market_data?: {
      market_cap?: { usd: number };
      market_cap_rank?: number | null;
      fully_diluted_valuation?: { usd: number };
      total_volume?: { usd: number };
      price_change_24h?: number;
      price_change_percentage_24h?: number;
      price_change_percentage_7d?: number;
      price_change_percentage_30d?: number;
      circulating_supply?: number;
      total_supply?: number;
      ath?: { usd: number };
      ath_date?: { usd: string };
      atl?: { usd: number };
      atl_date?: { usd: string };
    };
    tickers?: Array<{
      base: string;
      target: string;
      market: { name: string; identifier: string };
      last: number;
      volume: number;
      converted_volume: { usd: number };
      trust_score: string;
      trade_url: string;
    }>;
  };

  const md = json.market_data ?? {};
  const data: CoinGeckoData = {
    market_cap: md.market_cap?.usd ?? 0,
    market_cap_rank: md.market_cap_rank ?? null,
    fully_diluted_valuation: md.fully_diluted_valuation?.usd ?? 0,
    total_volume: md.total_volume?.usd ?? 0,
    price_change_24h: md.price_change_24h ?? 0,
    price_change_percentage_24h: md.price_change_percentage_24h ?? 0,
    price_change_percentage_7d: md.price_change_percentage_7d ?? 0,
    price_change_percentage_30d: md.price_change_percentage_30d ?? 0,
    circulating_supply: md.circulating_supply ?? 0,
    total_supply: md.total_supply ?? 0,
    ath: md.ath?.usd ?? 0,
    ath_date: md.ath_date?.usd ?? "",
    atl: md.atl?.usd ?? 0,
    atl_date: md.atl_date?.usd ?? "",
    tickers: (json.tickers ?? []).map((t) => ({
      base: t.base,
      target: t.target,
      market: t.market,
      last: t.last,
      volume: t.volume,
      converted_volume: t.converted_volume,
      trust_score: t.trust_score,
      trade_url: t.trade_url,
    })),
    timestamp: new Date().toISOString(),
  };
  return setCache(cacheKey, data, 120_000);
}

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

export async function fetchBitcoinNetwork(): Promise<MempoolData> {
  const cacheKey = "api:mempool";
  const cached = getCached<MempoolData>(cacheKey);
  if (cached) return cached;

  const [tipHash, tipHeight, fees, mempoolInfo] = await Promise.all([
    fetch("https://mempool.space/api/blocks/tip/hash").then((r) => r.text()),
    fetch("https://mempool.space/api/blocks/tip/height").then((r) => r.text()),
    fetch("https://mempool.space/api/v1/fees/recommended").then((r) =>
      r.json()
    ) as Promise<{
      fastestFee: number;
      halfHourFee: number;
      hourFee: number;
      economyFee: number;
      minimumFee: number;
    }>,
    fetch("https://mempool.space/api/mempool").then((r) => r.json()) as Promise<{
      count: number;
      vsize: number;
    }>,
  ]);

  const hashRateResp = await fetch("https://mempool.space/api/v1/mining/hashrate/1d");
  const hashRateJson = (await hashRateResp.json()) as {
    hashrates?: Array<{ avgHashrate: number }>;
    difficulty?: Array<{ difficulty: number }>;
  };

  const data: MempoolData = {
    block_height: parseInt(tipHeight, 10),
    block_hash: tipHash,
    difficulty: hashRateJson.difficulty?.[0]?.difficulty ?? 0,
    hashrate: hashRateJson.hashrates?.[0]?.avgHashrate ?? 0,
    mempool_size: mempoolInfo.count,
    mempool_bytes: mempoolInfo.vsize,
    fee_estimates: {
      fastest: fees.fastestFee,
      half_hour: fees.halfHourFee,
      hour: fees.hourFee,
      economy: fees.economyFee,
      minimum: fees.minimumFee,
    },
    timestamp: new Date().toISOString(),
  };
  return setCache(cacheKey, data, 60_000);
}

// ---------------------------------------------------------------------------
// Solana DEX price fetchers
// ---------------------------------------------------------------------------

const DOG_MINT = "dog1viwbb2vWDpER5FrJ4YFG6gq6XuyFohUe9TXN65u";
const SOL_MINT = "So11111111111111111111111111111111111111112";
const ORCA_SOL_DOG_POOL = "96P9KSNysfTADDzfxgsSrfyfgy47omctoCZPgJsj93ML";
const DEX_TIMEOUT = 8_000;

export interface SolanaDexPrice {
  source: string;
  price: number;
  change24h: number | null;
  extra?: Record<string, unknown>;
}

export async function fetchOrcaPrice(): Promise<SolanaDexPrice> {
  const cacheKey = "api:orca";
  const cached = getCached<SolanaDexPrice>(cacheKey);
  if (cached) return cached;

  const [solRes, poolRes] = await Promise.all([
    fetch(`https://api.orca.so/v2/solana/tokens/${SOL_MINT}`, { signal: AbortSignal.timeout(DEX_TIMEOUT) }),
    fetch(`https://api.orca.so/v2/solana/pools/${ORCA_SOL_DOG_POOL}`, { signal: AbortSignal.timeout(DEX_TIMEOUT) }),
  ]);
  if (!solRes.ok || !poolRes.ok) throw new Error("Orca API error");
  const [solJson, poolJson] = await Promise.all([solRes.json(), poolRes.json()]);
  const solPrice = parseFloat(solJson.data?.priceUsdc);
  const solDogRate = parseFloat(poolJson.data?.price);
  if (isNaN(solPrice) || solPrice <= 0 || isNaN(solDogRate) || solDogRate <= 0)
    throw new Error("Invalid Orca price data");
  const price = solPrice / solDogRate;
  const data: SolanaDexPrice = { source: "orca", price, change24h: null };
  return setCache(cacheKey, data, 30_000);
}

export async function fetchRaydiumPrice(): Promise<SolanaDexPrice> {
  const cacheKey = "api:raydium";
  const cached = getCached<SolanaDexPrice>(cacheKey);
  if (cached) return cached;

  const res = await fetch(`https://api-v3.raydium.io/mint/price?mints=${DOG_MINT}`, {
    signal: AbortSignal.timeout(DEX_TIMEOUT),
  });
  if (!res.ok) throw new Error(`Raydium API error: ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error("Raydium returned success=false");
  const price = parseFloat(json.data?.[DOG_MINT]);
  if (isNaN(price) || price <= 0) throw new Error("Invalid Raydium price");
  const data: SolanaDexPrice = { source: "raydium", price, change24h: null };
  return setCache(cacheKey, data, 30_000);
}

export async function fetchJupiterPrice(): Promise<SolanaDexPrice> {
  const cacheKey = "api:jupiter";
  const cached = getCached<SolanaDexPrice>(cacheKey);
  if (cached) return cached;

  const res = await fetch(`https://api.jup.ag/price/v3?ids=${DOG_MINT}`, {
    signal: AbortSignal.timeout(DEX_TIMEOUT),
  });
  if (!res.ok) throw new Error(`Jupiter API error: ${res.status}`);
  const json = await res.json();
  const tokenData = json[DOG_MINT];
  if (!tokenData || tokenData.usdPrice == null) throw new Error("No Jupiter price data");
  const price = tokenData.usdPrice as number;
  const change24h = tokenData.priceChange24h as number ?? null;
  const liquidity = tokenData.liquidity as number ?? 0;
  const data: SolanaDexPrice = { source: "jupiter", price, change24h, extra: { liquidity } };
  return setCache(cacheKey, data, 30_000);
}

export async function fetchMeteoraPrice(): Promise<SolanaDexPrice> {
  const cacheKey = "api:meteora";
  const cached = getCached<SolanaDexPrice>(cacheKey);
  if (cached) return cached;

  const res = await fetch(
    `https://damm-api.meteora.ag/pools/search?page=0&size=5&include_token_mints=${DOG_MINT}`,
    { signal: AbortSignal.timeout(DEX_TIMEOUT) }
  );
  if (!res.ok) throw new Error(`Meteora API error: ${res.status}`);
  const json = await res.json();
  const pools = json.data as Array<{
    pool_name: string;
    pool_token_mints: string[];
    pool_token_amounts: string[];
    pool_token_usd_amounts: string[];
    pool_tvl: string;
  }>;
  if (!pools || pools.length === 0) throw new Error("No DOG pools on Meteora");
  const pool = pools.reduce((best, p) =>
    parseFloat(p.pool_tvl) > parseFloat(best.pool_tvl) ? p : best
  );
  const dogIdx = pool.pool_token_mints.indexOf(DOG_MINT);
  if (dogIdx === -1) throw new Error("DOG mint not in Meteora pool");
  const dogUsd = parseFloat(pool.pool_token_usd_amounts[dogIdx]);
  const dogAmt = parseFloat(pool.pool_token_amounts[dogIdx]);
  if (dogAmt <= 0) throw new Error("Invalid Meteora DOG amount");
  const price = dogUsd / dogAmt;
  if (isNaN(price) || price <= 0) throw new Error("Invalid Meteora price");
  const tvl = parseFloat(pool.pool_tvl);
  const data: SolanaDexPrice = { source: "meteora", price, change24h: null, extra: { tvl, pool: pool.pool_name } };
  return setCache(cacheKey, data, 30_000);
}

// ---------------------------------------------------------------------------
// DOG supply constant
// ---------------------------------------------------------------------------
export const DOG_TOTAL_SUPPLY = 100_000_000_000; // 100 billion DOG
