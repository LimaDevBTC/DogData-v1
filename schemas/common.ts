import { z } from 'zod';

// ─── Pagination ──────────────────────────────────────────────────
export const PaginationSchema = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total_pages: z.number().int().nonnegative(),
  has_next: z.boolean(),
  has_prev: z.boolean(),
});

export type Pagination = z.infer<typeof PaginationSchema>;

// ─── Metadata ────────────────────────────────────────────────────
export const MetadataSchema = z.object({
  source: z.literal("dogdata.xyz"),
  version: z.string(),
  timestamp: z.string().datetime(),
  cached: z.boolean(),
  cache_age_seconds: z.number().nonnegative().optional(),
  data_freshness: z.enum(["real-time", "hourly", "daily"]),
  block_height: z.number().int().nonnegative().optional(),
});

export type Metadata = z.infer<typeof MetadataSchema>;

// ─── Error ───────────────────────────────────────────────────────
export const ErrorDetailSchema = z.object({
  code: z.string(),
  message: z.string(),
  status: z.number().int(),
  retry_after: z.number().int().nonnegative().optional(),
  docs_url: z.string().url().optional(),
});

export const ErrorResponseSchema = z.object({
  error: ErrorDetailSchema,
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// ─── AgentResponse wrapper ───────────────────────────────────────
// Generic wrapper — concrete per-endpoint schemas compose this with
// a specific `data` shape (see individual schema files).
export function createAgentResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    data: dataSchema,
    metadata: MetadataSchema,
    pagination: PaginationSchema.optional(),
  });
}
