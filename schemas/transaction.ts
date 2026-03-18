import { z } from 'zod';
import { createAgentResponseSchema } from './common';

// ─── Transaction participant ─────────────────────────────────────
export const TxParticipantSchema = z.object({
  address: z.string().min(1),
  amount: z.number(),
});

export type TxParticipant = z.infer<typeof TxParticipantSchema>;

// ─── Single transaction ──────────────────────────────────────────
export const TransactionSchema = z.object({
  txid: z.string().min(1),
  type: z.string().optional(),
  block_height: z.number().int().nonnegative(),
  timestamp: z.string(),
  senders: z.array(TxParticipantSchema).optional(),
  receivers: z.array(TxParticipantSchema).optional(),
  total_dog_moved: z.number().nonnegative(),
  net_transfer: z.number().optional(),
  fee_sats: z.number().int().nonnegative().optional(),
});

export type Transaction = z.infer<typeof TransactionSchema>;

// ─── Transaction list response ───────────────────────────────────
export const TransactionListResponseSchema = createAgentResponseSchema(
  z.object({
    transactions: z.array(TransactionSchema),
    total_transactions: z.number().int().nonnegative(),
    last_block: z.number().int().nonnegative(),
    last_updated: z.string().nullable(),
  }),
);

export type TransactionListResponse = z.infer<typeof TransactionListResponseSchema>;

// ─── Transaction summary (used by ?summary=true) ─────────────────
export const TransactionSummarySchema = z.object({
  total_transactions: z.number().int().nonnegative(),
  last_block: z.number().int().nonnegative(),
  last_updated: z.string().nullable(),
  metrics: z.record(z.any()).nullable(),
});

export type TransactionSummary = z.infer<typeof TransactionSummarySchema>;

export const TransactionSummaryResponseSchema = createAgentResponseSchema(
  TransactionSummarySchema,
);

export type TransactionSummaryResponse = z.infer<typeof TransactionSummaryResponseSchema>;

// ─── Heatmap bucket ──────────────────────────────────────────────
export const HeatmapBucketSchema = z.object({
  index: z.number().int(),
  row: z.number().int(),
  col: z.number().int(),
  value: z.number(),
  txCount: z.number().int().nonnegative(),
  volume: z.number(),
  avgFee: z.number().nullable(),
  whaleVolume: z.number(),
  hasWhale: z.boolean(),
  retailVolume: z.number(),
  mediumVolume: z.number(),
  largeVolume: z.number(),
  netFlow: z.number(),
  label: z.string(),
  startTime: z.string(),
});

export type HeatmapBucket = z.infer<typeof HeatmapBucketSchema>;

export const HeatmapResponseSchema = createAgentResponseSchema(
  z.object({
    buckets: z.array(HeatmapBucketSchema),
    meta: z.object({
      timeframe: z.string(),
      layer: z.string(),
      gridConfig: z.object({
        rows: z.number().int(),
        cols: z.number().int(),
        rowLabel: z.string(),
        colLabel: z.string(),
      }),
      totalTx: z.number().int(),
      totalVolume: z.number(),
      peakBucket: z.object({
        index: z.number().int(),
        value: z.number(),
        label: z.string(),
      }),
      whaleCount: z.number().int(),
      activeSlots: z.number().int(),
    }),
  }),
);

export type HeatmapResponse = z.infer<typeof HeatmapResponseSchema>;
