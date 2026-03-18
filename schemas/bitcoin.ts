import { z } from 'zod';
import { createAgentResponseSchema } from './common';

// ─── Fees ────────────────────────────────────────────────────────
export const BitcoinFeesSchema = z.object({
  fastestFee: z.number().nonnegative(),
  halfHourFee: z.number().nonnegative(),
  hourFee: z.number().nonnegative(),
  economyFee: z.number().nonnegative(),
  minimumFee: z.number().nonnegative(),
});

export type BitcoinFees = z.infer<typeof BitcoinFeesSchema>;

// ─── Mempool ─────────────────────────────────────────────────────
export const BitcoinMempoolSchema = z.object({
  count: z.number().int().nonnegative(),
  vsize: z.number().nonnegative(),
  total_fee: z.number().nonnegative(),
  fee_histogram: z.array(z.tuple([z.number(), z.number()])).optional(),
});

export type BitcoinMempool = z.infer<typeof BitcoinMempoolSchema>;

// ─── Block ───────────────────────────────────────────────────────
export const BitcoinBlockSchema = z.object({
  id: z.string(),
  height: z.number().int().nonnegative(),
  timestamp: z.number(),
  tx_count: z.number().int().nonnegative(),
  size: z.number().int().nonnegative(),
  weight: z.number().int().nonnegative(),
  difficulty: z.number().nonnegative(),
  extras: z.object({
    reward: z.number().int().nonnegative(),
  }).optional(),
});

export type BitcoinBlock = z.infer<typeof BitcoinBlockSchema>;

// ─── Difficulty Adjustment ───────────────────────────────────────
export const DifficultyAdjustmentSchema = z.object({
  progressPercent: z.number(),
  difficultyChange: z.number(),
  estimatedRetargetDate: z.number(),
  remainingBlocks: z.number().int().nonnegative(),
  remainingTime: z.number().nonnegative(),
  nextRetargetHeight: z.number().int().nonnegative(),
});

export type DifficultyAdjustment = z.infer<typeof DifficultyAdjustmentSchema>;

// ─── Hashrate point ──────────────────────────────────────────────
export const HashratePointSchema = z.object({
  timestamp: z.number(),
  avgHashrate: z.number().nonnegative(),
});

export type HashratePoint = z.infer<typeof HashratePointSchema>;

// ─── Mining Pool ─────────────────────────────────────────────────
export const MiningPoolSchema = z.object({
  poolId: z.number().int(),
  name: z.string(),
  blockCount: z.number().int().nonnegative(),
  rank: z.number().int().nonnegative(),
  emptyBlocks: z.number().int().nonnegative(),
  avgMatchRate: z.number(),
  avgFeeDelta: z.string(),
  link: z.string().url().optional(),
});

export type MiningPool = z.infer<typeof MiningPoolSchema>;

// ─── Bitcoin Price ───────────────────────────────────────────────
export const BitcoinPriceSchema = z.object({
  bitcoin: z.object({
    usd: z.number().nonnegative(),
    usd_24h_change: z.number().optional(),
  }),
});

export type BitcoinPrice = z.infer<typeof BitcoinPriceSchema>;

// ─── Full Bitcoin network data response ──────────────────────────
export const BitcoinNetworkSchema = z.object({
  difficultyAdjustment: DifficultyAdjustmentSchema,
  hashrate: z.object({
    hashrates: z.array(HashratePointSchema),
  }),
  mempool: BitcoinMempoolSchema,
  fees: BitcoinFeesSchema,
  blocks: z.array(BitcoinBlockSchema),
  pools: z.object({
    pools: z.array(MiningPoolSchema),
  }),
  price: BitcoinPriceSchema,
});

export type BitcoinNetwork = z.infer<typeof BitcoinNetworkSchema>;

export const BitcoinNetworkResponseSchema = createAgentResponseSchema(BitcoinNetworkSchema);

export type BitcoinNetworkResponse = z.infer<typeof BitcoinNetworkResponseSchema>;
