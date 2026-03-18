import type { Pagination, Metadata } from '@/schemas/common';

interface AgentResponseOptions {
  cached?: boolean;
  cacheAgeSeconds?: number;
  dataFreshness?: 'real-time' | 'hourly' | 'daily';
  blockHeight?: number;
  pagination?: {
    total: number;
    page: number;
    limit: number;
  };
}

interface AgentResponse<T> {
  data: T;
  metadata: Metadata;
  pagination?: Pagination;
}

/**
 * Wraps any payload in a consistent AgentResponse envelope.
 *
 * Usage:
 * ```ts
 * return NextResponse.json(
 *   createAgentResponse(holders, {
 *     cached: true,
 *     cacheAgeSeconds: 42,
 *     dataFreshness: 'hourly',
 *     pagination: { total: 89042, page: 1, limit: 25 },
 *   })
 * );
 * ```
 */
export function createAgentResponse<T>(
  data: T,
  options: AgentResponseOptions = {},
): AgentResponse<T> {
  const response: AgentResponse<T> = {
    data,
    metadata: {
      source: "dogdata.xyz",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      cached: options.cached ?? false,
      ...(options.cacheAgeSeconds !== undefined && {
        cache_age_seconds: options.cacheAgeSeconds,
      }),
      data_freshness: options.dataFreshness ?? "real-time",
      ...(options.blockHeight !== undefined && {
        block_height: options.blockHeight,
      }),
    },
  };

  if (options.pagination) {
    const { total, page, limit } = options.pagination;
    const totalPages = Math.ceil(total / limit);
    response.pagination = {
      total,
      page,
      limit,
      total_pages: totalPages,
      has_next: page < totalPages,
      has_prev: page > 1,
    };
  }

  return response;
}
