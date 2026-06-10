/**
 * Internal REST proxy helper for the /mcp endpoint.
 *
 * The remote MCP tools do NOT read data files from disk (those 18-32MB JSON
 * snapshots cannot be bundled into a serverless function). Instead they call
 * the app's own public REST endpoints — the same data path that is already
 * proven fresh in production — keeping a single source of truth.
 */

/**
 * Resolve the base URL for server-side internal API calls.
 * Mirrors the pattern used in app/api/route.ts and agent/capabilities.
 */
export function getInternalBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000")
  );
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// Per-instance in-memory cache. Bounded by the small number of internal paths
// and short TTLs; never iterated (es5 target), only get/set.
const cache = new Map<string, CacheEntry<unknown>>();

interface FetchOpts {
  /** Cache TTL in ms. 0 (default) disables caching for this call. */
  ttlMs?: number;
  /** Abort timeout in ms (default 15s). */
  timeoutMs?: number;
}

/**
 * Fetch JSON from an internal REST path (e.g. "/api/dog-rune/stats").
 * Throws on non-2xx so callers can surface a structured tool error.
 */
export async function fetchInternal<T = unknown>(
  path: string,
  opts: FetchOpts = {}
): Promise<T> {
  const { ttlMs = 0, timeoutMs = 15_000 } = opts;
  const url = `${getInternalBaseUrl()}${path}`;

  if (ttlMs > 0) {
    const hit = cache.get(url) as CacheEntry<T> | undefined;
    if (hit && Date.now() < hit.expiresAt) return hit.data;
  }

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Internal request ${path} failed: HTTP ${res.status}`);
  }

  const data = (await res.json()) as T;
  if (ttlMs > 0) cache.set(url, { data, expiresAt: Date.now() + ttlMs });
  return data;
}

/** Unwrap a Promise.allSettled entry, returning null on rejection. */
export function settled<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === "fulfilled" ? result.value : null;
}
