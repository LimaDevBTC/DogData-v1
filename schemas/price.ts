import { z } from 'zod';
import { createAgentResponseSchema } from './common';

// ─── Single-exchange price (Kraken-style) ────────────────────────
export const PriceSchema = z.object({
  price_usd: z.number().nonnegative(),
  change_24h: z.number(),
  volume_24h: z.number().nonnegative(),
  high_24h: z.number().nonnegative(),
  low_24h: z.number().nonnegative(),
  source: z.string(),
  timestamp: z.string(),
});

export type Price = z.infer<typeof PriceSchema>;

export const PriceResponseSchema = createAgentResponseSchema(PriceSchema);

export type PriceResponse = z.infer<typeof PriceResponseSchema>;

// ─── Exchange price (per-exchange ticker) ────────────────────────
export const ExchangePriceSchema = z.object({
  exchange: z.string(),
  pair: z.string(),
  price: z.number().nonnegative(),
  volume_usd: z.number().nonnegative(),
  spread: z.number(),
  trust_score: z.enum(["green", "yellow", "red"]).optional(),
  trade_url: z.string().url().optional(),
});

export type ExchangePrice = z.infer<typeof ExchangePriceSchema>;

// ─── Multi-exchange aggregated price response ────────────────────
export const MultiPriceSchema = z.object({
  prices: z.array(ExchangePriceSchema),
  average_price_usd: z.number().nonnegative(),
  total_volume_usd: z.number().nonnegative(),
  exchanges_reporting: z.number().int().nonnegative(),
});

export type MultiPrice = z.infer<typeof MultiPriceSchema>;

export const MultiPriceResponseSchema = createAgentResponseSchema(MultiPriceSchema);

export type MultiPriceResponse = z.infer<typeof MultiPriceResponseSchema>;
