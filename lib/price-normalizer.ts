/**
 * Canonical price response schema for /api/price/* endpoints.
 *
 * All 10 price routes return this shape (in addition to legacy fields kept
 * for backward compatibility with existing UI consumers).
 *
 * Documented at /api/agent/capabilities and /api/openapi.json.
 */

export type ExchangeType = 'cex' | 'dex' | 'aggregator';
export type ExchangeChain = 'bitcoin-l1' | 'stacks' | 'solana' | null;

export interface NormalizedPriceResponse {
  exchange: string;
  type: ExchangeType;
  chain: ExchangeChain;
  pair: string;

  price_usd: number;
  price_btc: number | null;
  price_sats: number | null;

  change_24h_pct: number | null;
  volume_24h_usd: number | null;
  high_24h: number | null;
  low_24h: number | null;
  liquidity_usd: number | null;

  fetched_at: string;          // ISO 8601 UTC with Z
  cached: boolean;
  stale?: boolean;
  cache_age_s?: number;
}

interface BuildPriceArgs {
  exchange: string;
  type: ExchangeType;
  chain: ExchangeChain;
  pair: string;
  price_usd: number;
  price_btc?: number | null;
  price_sats?: number | null;
  change_24h_pct?: number | null;
  volume_24h_usd?: number | null;
  high_24h?: number | null;
  low_24h?: number | null;
  liquidity_usd?: number | null;
  fetched_at?: string;
  cached?: boolean;
  stale?: boolean;
  cache_age_s?: number;
  /** Extra legacy fields preserved for backward compatibility with existing UI. */
  legacy?: Record<string, unknown>;
}

const round2 = (n: number | null | undefined): number | null => {
  if (n === null || n === undefined || Number.isNaN(n)) return null;
  return Math.round(n * 100) / 100;
};

/**
 * Builds the canonical response payload. Adds legacy fields when supplied so
 * consumers reading the old shape (price, change24h, volume24h, priceSats…)
 * keep working until they migrate.
 */
export function buildPriceResponse(args: BuildPriceArgs) {
  const fetched_at = args.fetched_at ?? new Date().toISOString();
  const change_24h_pct = round2(args.change_24h_pct ?? null);

  const canonical: NormalizedPriceResponse = {
    exchange: args.exchange,
    type: args.type,
    chain: args.chain,
    pair: args.pair,
    price_usd: args.price_usd,
    price_btc: args.price_btc ?? null,
    price_sats: args.price_sats ?? null,
    change_24h_pct,
    volume_24h_usd: args.volume_24h_usd ?? null,
    high_24h: args.high_24h ?? null,
    low_24h: args.low_24h ?? null,
    liquidity_usd: args.liquidity_usd ?? null,
    fetched_at,
    cached: args.cached ?? false,
  };

  if (args.stale !== undefined) canonical.stale = args.stale;
  if (args.cache_age_s !== undefined) canonical.cache_age_s = args.cache_age_s;

  return { ...canonical, ...(args.legacy ?? {}) };
}
