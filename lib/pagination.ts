/**
 * Canonical pagination envelope used across paginated DogData API endpoints.
 *
 * Documented at /api/openapi.json. All list endpoints returning >25 items
 * should adopt this shape so consumers can rely on a single pagination
 * contract.
 */

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_more: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
  last_updated: string | null;
}

interface BuildArgs<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  last_updated?: string | null;
  /** Extra legacy fields preserved for backward compatibility. */
  legacy?: Record<string, unknown>;
}

export function buildPaginated<T>(args: BuildArgs<T>) {
  const total_pages = args.limit > 0 ? Math.ceil(args.total / args.limit) : 0;
  const has_more = args.page * args.limit < args.total;

  const canonical: PaginatedResponse<T> = {
    data: args.data,
    pagination: {
      page: args.page,
      limit: args.limit,
      total: args.total,
      total_pages,
      has_more,
    },
    last_updated: args.last_updated ?? null,
  };

  return { ...canonical, ...(args.legacy ?? {}) };
}

/**
 * Parses page/limit query params with sensible defaults and bounds.
 */
export function parsePageParams(url: URL, defaults: { limit?: number; max?: number } = {}) {
  const defaultLimit = defaults.limit ?? 50;
  const maxLimit = defaults.max ?? 200;
  const pageRaw = Number(url.searchParams.get('page') ?? '1');
  const limitRaw = Number(url.searchParams.get('limit') ?? defaultLimit);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const limit = Number.isFinite(limitRaw) && limitRaw > 0
    ? Math.min(Math.floor(limitRaw), maxLimit)
    : defaultLimit;
  return { page, limit };
}
