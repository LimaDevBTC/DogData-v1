import { z } from 'zod';
import { createAgentResponseSchema } from './common';

// ─── Market ticker (per-exchange) ────────────────────────────────
export const MarketTickerSchema = z.object({
  market: z.string(),
  pair: z.string(),
  price: z.number().nonnegative(),
  volumeUsd: z.number().nonnegative(),
  volume: z.number().nonnegative(),
  spread: z.number(),
  trustScore: z.enum(["green", "yellow", "red"]),
  tradeUrl: z.string().url(),
});

export type MarketTicker = z.infer<typeof MarketTickerSchema>;

// ─── Aggregated market data ──────────────────────────────────────
export const MarketDataSchema = z.object({
  price: z.number().nonnegative(),
  totalVolume: z.number().nonnegative(),
  marketCap: z.number().nonnegative(),
  priceChange24h: z.number(),
});

export type MarketData = z.infer<typeof MarketDataSchema>;

// ─── Full markets response ───────────────────────────────────────
export const MarketsSchema = z.object({
  tickers: z.array(MarketTickerSchema),
  marketData: MarketDataSchema,
  timestamp: z.number(),
});

export type Markets = z.infer<typeof MarketsSchema>;

export const MarketsResponseSchema = createAgentResponseSchema(MarketsSchema);

export type MarketsResponse = z.infer<typeof MarketsResponseSchema>;
