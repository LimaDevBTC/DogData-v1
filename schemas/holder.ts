import { z } from 'zod';
import { createAgentResponseSchema, PaginationSchema, MetadataSchema } from './common';

// ─── Core holder record ──────────────────────────────────────────
export const HolderSchema = z.object({
  rank: z.number().int().nonnegative(),
  address: z.string().min(1),
  total_amount: z.number().nonnegative(),
  total_dog: z.number().nonnegative(),
  utxo_count: z.number().int().nonnegative().optional(),
});

export type Holder = z.infer<typeof HolderSchema>;

// ─── Detailed holder (address lookup) ────────────────────────────
export const HolderDetailSchema = HolderSchema.extend({
  holder_rank: z.number().int().nullable(),
  percentage_of_supply: z.number().nonnegative().optional(),
  first_seen: z.string().datetime().optional(),
  last_active: z.string().datetime().optional(),
});

export type HolderDetail = z.infer<typeof HolderDetailSchema>;

// ─── List response (paginated) ───────────────────────────────────
export const HolderListResponseSchema = createAgentResponseSchema(
  z.array(HolderSchema),
);

export type HolderListResponse = z.infer<typeof HolderListResponseSchema>;

// ─── Single holder response ──────────────────────────────────────
export const HolderDetailResponseSchema = createAgentResponseSchema(
  HolderDetailSchema,
);

export type HolderDetailResponse = z.infer<typeof HolderDetailResponseSchema>;

// ─── Snapshot response ───────────────────────────────────────────
export const HolderSnapshotSchema = z.object({
  timestamp: z.string(),
  total_holders: z.number().int().nonnegative(),
  snapshot_size: z.number().int().nonnegative(),
  holders: z.array(HolderSchema),
});

export type HolderSnapshot = z.infer<typeof HolderSnapshotSchema>;

export const HolderSnapshotResponseSchema = createAgentResponseSchema(
  HolderSnapshotSchema,
);

export type HolderSnapshotResponse = z.infer<typeof HolderSnapshotResponseSchema>;
