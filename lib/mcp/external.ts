/**
 * External market-data fetchers for the /mcp endpoint.
 *
 * These hit third-party APIs directly (Solana DEXes + CoinGecko) and are
 * fully self-contained — no disk, no internal REST. Ported verbatim from the
 * standalone mcp-server's data-loader so the tool output keeps the same shape.
 */

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
    fetch(`https://api.orca.so/v2/solana/tokens/${SOL_MINT}`, {
      signal: AbortSignal.timeout(DEX_TIMEOUT),
    }),
    fetch(`https://api.orca.so/v2/solana/pools/${ORCA_SOL_DOG_POOL}`, {
      signal: AbortSignal.timeout(DEX_TIMEOUT),
    }),
  ]);
  if (!solRes.ok || !poolRes.ok) throw new Error("Orca API error");
  const [solJson, poolJson] = (await Promise.all([
    solRes.json(),
    poolRes.json(),
  ])) as [{ data?: { priceUsdc?: string } }, { data?: { price?: string } }];
  const solPrice = parseFloat(solJson.data?.priceUsdc ?? "");
  const solDogRate = parseFloat(poolJson.data?.price ?? "");
  if (
    isNaN(solPrice) ||
    solPrice <= 0 ||
    isNaN(solDogRate) ||
    solDogRate <= 0
  )
    throw new Error("Invalid Orca price data");
  const price = solPrice / solDogRate;
  return setCache(cacheKey, { source: "orca", price, change24h: null }, 30_000);
}

export async function fetchRaydiumPrice(): Promise<SolanaDexPrice> {
  const cacheKey = "api:raydium";
  const cached = getCached<SolanaDexPrice>(cacheKey);
  if (cached) return cached;

  const res = await fetch(
    `https://api-v3.raydium.io/mint/price?mints=${DOG_MINT}`,
    { signal: AbortSignal.timeout(DEX_TIMEOUT) }
  );
  if (!res.ok) throw new Error(`Raydium API error: ${res.status}`);
  const json = (await res.json()) as {
    success?: boolean;
    data?: Record<string, string>;
  };
  if (!json.success) throw new Error("Raydium returned success=false");
  const price = parseFloat(json.data?.[DOG_MINT] ?? "");
  if (isNaN(price) || price <= 0) throw new Error("Invalid Raydium price");
  return setCache(
    cacheKey,
    { source: "raydium", price, change24h: null },
    30_000
  );
}

export async function fetchJupiterPrice(): Promise<SolanaDexPrice> {
  const cacheKey = "api:jupiter";
  const cached = getCached<SolanaDexPrice>(cacheKey);
  if (cached) return cached;

  const res = await fetch(`https://api.jup.ag/price/v3?ids=${DOG_MINT}`, {
    signal: AbortSignal.timeout(DEX_TIMEOUT),
  });
  if (!res.ok) throw new Error(`Jupiter API error: ${res.status}`);
  const json = (await res.json()) as Record<
    string,
    { usdPrice?: number; priceChange24h?: number; liquidity?: number }
  >;
  const tokenData = json[DOG_MINT];
  if (!tokenData || tokenData.usdPrice == null)
    throw new Error("No Jupiter price data");
  const price = tokenData.usdPrice;
  const change24h = tokenData.priceChange24h ?? null;
  const liquidity = tokenData.liquidity ?? 0;
  return setCache(
    cacheKey,
    { source: "jupiter", price, change24h, extra: { liquidity } },
    30_000
  );
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
  const json = (await res.json()) as {
    data?: Array<{
      pool_name: string;
      pool_token_mints: string[];
      pool_token_amounts: string[];
      pool_token_usd_amounts: string[];
      pool_tvl: string;
    }>;
  };
  const pools = json.data;
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
  return setCache(
    cacheKey,
    {
      source: "meteora",
      price,
      change24h: null,
      extra: { tvl, pool: pool.pool_name },
    },
    30_000
  );
}

// ---------------------------------------------------------------------------
// CoinGecko multi-exchange data
// ---------------------------------------------------------------------------

export interface CoinGeckoTicker {
  base: string;
  target: string;
  market: { name: string; identifier: string };
  last: number;
  volume: number;
  converted_volume: { usd: number };
  trust_score: string;
  trade_url: string;
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
  tickers: CoinGeckoTicker[];
  timestamp: string;
}

export async function fetchCoinGeckoData(): Promise<CoinGeckoData> {
  const cacheKey = "api:coingecko";
  const cached = getCached<CoinGeckoData>(cacheKey);
  if (cached) return cached;

  const resp = await fetch(
    "https://api.coingecko.com/api/v3/coins/dog-go-to-the-moon-rune",
    { signal: AbortSignal.timeout(DEX_TIMEOUT) }
  );
  if (!resp.ok) throw new Error(`CoinGecko API error: ${resp.status}`);
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
    tickers?: CoinGeckoTicker[];
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
    tickers: json.tickers ?? [],
    timestamp: new Date().toISOString(),
  };
  return setCache(cacheKey, data, 120_000);
}
