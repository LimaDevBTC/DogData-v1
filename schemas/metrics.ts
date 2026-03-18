import { z } from 'zod';
import { createAgentResponseSchema } from './common';

// ─── UTXO Distribution ──────────────────────────────────────────
export const UtxoDistributionSchema = z.object({
  range: z.string(),
  count: z.number().int().nonnegative(),
  supply: z.number().nonnegative(),
  percentage: z.number().nonnegative(),
});

export type UtxoDistribution = z.infer<typeof UtxoDistributionSchema>;

export const UtxoMetricsSchema = z.object({
  total_utxos: z.number().int().nonnegative(),
  avg_utxo_size: z.number().nonnegative(),
  utxo_distribution: z.array(UtxoDistributionSchema),
  last_updated: z.string(),
});

export type UtxoMetrics = z.infer<typeof UtxoMetricsSchema>;

export const UtxoMetricsResponseSchema = createAgentResponseSchema(UtxoMetricsSchema);

export type UtxoMetricsResponse = z.infer<typeof UtxoMetricsResponseSchema>;

// ─── UTXO Age (HODL Waves) ──────────────────────────────────────
export const HodlWaveSchema = z.object({
  range: z.string(),
  supply: z.number().nonnegative(),
  percentage: z.number().nonnegative(),
});

export type HodlWave = z.infer<typeof HodlWaveSchema>;

export const UtxoAgeSchema = z.object({
  total_utxos: z.number().int().nonnegative(),
  total_supply: z.number().nonnegative(),
  avg_age_days: z.number().nonnegative().optional(),
  median_age_days: z.number().nonnegative().optional(),
  sth_percentage: z.number().nonnegative().optional(),
  lth_percentage: z.number().nonnegative().optional(),
  hodl_waves: z.array(HodlWaveSchema),
  last_updated: z.string(),
});

export type UtxoAge = z.infer<typeof UtxoAgeSchema>;

export const UtxoAgeResponseSchema = createAgentResponseSchema(UtxoAgeSchema);

export type UtxoAgeResponse = z.infer<typeof UtxoAgeResponseSchema>;

// ─── Concentration ──────────────────────────────────────────────
export const ConcentrationSchema = z.object({
  gini_coefficient: z.number().min(0).max(1),
  top10_supply_pct: z.number().nonnegative(),
  top100_supply_pct: z.number().nonnegative(),
  top1000_supply_pct: z.number().nonnegative(),
  total_holders: z.number().int().nonnegative(),
  total_supply: z.number().nonnegative(),
  last_updated: z.string(),
});

export type Concentration = z.infer<typeof ConcentrationSchema>;

export const ConcentrationResponseSchema = createAgentResponseSchema(ConcentrationSchema);

export type ConcentrationResponse = z.infer<typeof ConcentrationResponseSchema>;

// ─── Realized Cap ───────────────────────────────────────────────
export const RealizedCapSchema = z.object({
  realized_cap: z.number().nonnegative(),
  market_cap: z.number().nonnegative(),
  mvrv_ratio: z.number(),
  current_price: z.number().nonnegative(),
  last_updated: z.string(),
});

export type RealizedCap = z.infer<typeof RealizedCapSchema>;

export const RealizedCapResponseSchema = createAgentResponseSchema(RealizedCapSchema);

export type RealizedCapResponse = z.infer<typeof RealizedCapResponseSchema>;

// ─── Supply Profit / Loss ───────────────────────────────────────
export const SupplyProfitLossSchema = z.object({
  supply_in_profit_pct: z.number(),
  supply_in_loss_pct: z.number(),
  current_price: z.number().nonnegative(),
  last_updated: z.string(),
});

export type SupplyProfitLoss = z.infer<typeof SupplyProfitLossSchema>;

export const SupplyProfitLossResponseSchema = createAgentResponseSchema(SupplyProfitLossSchema);

export type SupplyProfitLossResponse = z.infer<typeof SupplyProfitLossResponseSchema>;

// ─── Metrics History (time-series) ──────────────────────────────
export const MetricsHistoryPointSchema = z.object({
  recorded_at: z.string(),
  total_utxos: z.number().optional(),
  total_holders: z.number().optional(),
  gini_coefficient: z.number().optional(),
  top10_supply_pct: z.number().optional(),
  top100_supply_pct: z.number().optional(),
  top1000_supply_pct: z.number().optional(),
  avg_age_days: z.number().optional(),
  median_age_days: z.number().optional(),
  sth_percentage: z.number().optional(),
  lth_percentage: z.number().optional(),
  realized_cap: z.number().optional(),
  market_cap: z.number().optional(),
  mvrv_ratio: z.number().optional(),
  supply_in_profit_pct: z.number().optional(),
  supply_in_loss_pct: z.number().optional(),
  current_price: z.number().optional(),
});

export type MetricsHistoryPoint = z.infer<typeof MetricsHistoryPointSchema>;

export const MetricsHistorySchema = z.object({
  history: z.array(MetricsHistoryPointSchema),
  total_points: z.number().int().nonnegative(),
  raw_points: z.number().int().nonnegative(),
  range: z.string(),
  last_updated: z.string().nullable(),
});

export type MetricsHistory = z.infer<typeof MetricsHistorySchema>;

export const MetricsHistoryResponseSchema = createAgentResponseSchema(MetricsHistorySchema);

export type MetricsHistoryResponse = z.infer<typeof MetricsHistoryResponseSchema>;

// ─── Aggregated On-chain Metrics ────────────────────────────────
export const OnchainMetricsSchema = z.object({
  utxo: UtxoMetricsSchema,
  concentration: ConcentrationSchema,
  realized_cap: RealizedCapSchema,
  utxo_age: UtxoAgeSchema.optional(),
});

export type OnchainMetrics = z.infer<typeof OnchainMetricsSchema>;

export const OnchainMetricsResponseSchema = createAgentResponseSchema(OnchainMetricsSchema);

export type OnchainMetricsResponse = z.infer<typeof OnchainMetricsResponseSchema>;
