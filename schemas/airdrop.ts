import { z } from 'zod';
import { createAgentResponseSchema } from './common';

// ─── Airdrop recipient ──────────────────────────────────────────
export const AirdropRecipientSchema = z.object({
  address: z.string().min(1),
  amount: z.number().nonnegative(),
  category: z.string().optional(),
  claimed: z.boolean().optional(),
  retained_pct: z.number().min(0).max(100).optional(),
});

export type AirdropRecipient = z.infer<typeof AirdropRecipientSchema>;

// ─── Airdrop recipients list response ────────────────────────────
export const AirdropRecipientListSchema = z.object({
  recipients: z.array(AirdropRecipientSchema),
  total: z.number().int().nonnegative(),
  timestamp: z.string().optional(),
});

export type AirdropRecipientList = z.infer<typeof AirdropRecipientListSchema>;

export const AirdropRecipientListResponseSchema = createAgentResponseSchema(
  AirdropRecipientListSchema,
);

export type AirdropRecipientListResponse = z.infer<typeof AirdropRecipientListResponseSchema>;

// ─── Airdrop summary ────────────────────────────────────────────
export const AirdropCategoryBreakdownSchema = z.object({
  category: z.string(),
  count: z.number().int().nonnegative(),
  total_amount: z.number().nonnegative(),
  percentage: z.number().nonnegative(),
});

export type AirdropCategoryBreakdown = z.infer<typeof AirdropCategoryBreakdownSchema>;

export const AirdropSummarySchema = z.object({
  total_recipients: z.number().int().nonnegative(),
  total_amount: z.number().nonnegative(),
  retention_rate: z.number().min(0).max(100).optional(),
  avg_amount: z.number().nonnegative().optional(),
  median_amount: z.number().nonnegative().optional(),
  category_breakdown: z.array(AirdropCategoryBreakdownSchema).optional(),
  timestamp: z.string().optional(),
});

export type AirdropSummary = z.infer<typeof AirdropSummarySchema>;

export const AirdropSummaryResponseSchema = createAgentResponseSchema(AirdropSummarySchema);

export type AirdropSummaryResponse = z.infer<typeof AirdropSummaryResponseSchema>;
