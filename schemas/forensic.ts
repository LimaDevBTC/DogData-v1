import { z } from 'zod';
import { createAgentResponseSchema } from './common';

// ─── Forensic behavioral profile ────────────────────────────────
export const ForensicProfileSchema = z.object({
  address: z.string().min(1),
  behavior_pattern: z.string(),
  receive_count: z.number().int().nonnegative(),
  send_count: z.number().int().nonnegative().optional(),
  airdrop_amount: z.number().nonnegative(),
  current_balance: z.number().nonnegative().optional(),
  retention_pct: z.number().min(0).max(100).optional(),
  diamond_score: z.number().min(0).max(100).optional(),
  first_activity: z.string().optional(),
  last_activity: z.string().optional(),
  total_received: z.number().nonnegative().optional(),
  total_sent: z.number().nonnegative().optional(),
});

export type ForensicProfile = z.infer<typeof ForensicProfileSchema>;

// ─── Forensic profiles list response ─────────────────────────────
export const ForensicProfileListResponseSchema = createAgentResponseSchema(
  z.array(ForensicProfileSchema),
);

export type ForensicProfileListResponse = z.infer<typeof ForensicProfileListResponseSchema>;

// ─── Forensic summary / statistics ───────────────────────────────
export const ForensicCategoryBreakdownSchema = z.object({
  pattern: z.string(),
  count: z.number().int().nonnegative(),
  percentage: z.number().nonnegative(),
  avg_retention: z.number().optional(),
});

export type ForensicCategoryBreakdown = z.infer<typeof ForensicCategoryBreakdownSchema>;

export const ForensicSummarySchema = z.object({
  total_profiles: z.number().int().nonnegative(),
  categories: z.array(ForensicCategoryBreakdownSchema).optional(),
  avg_diamond_score: z.number().optional(),
  diamond_hands_pct: z.number().optional(),
  paper_hands_pct: z.number().optional(),
  statistics: z.record(z.any()).optional(),
  timestamp: z.string().optional(),
});

export type ForensicSummary = z.infer<typeof ForensicSummarySchema>;

export const ForensicSummaryResponseSchema = createAgentResponseSchema(ForensicSummarySchema);

export type ForensicSummaryResponse = z.infer<typeof ForensicSummaryResponseSchema>;
