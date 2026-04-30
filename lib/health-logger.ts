/**
 * Passive health logger.
 *
 * Writes one row per observation to `system_health_log` (Supabase). The
 * `/status` page aggregates these rows to compute 30/90-day uptime per
 * component and render the latest state.
 *
 * Two entry points:
 *   - recordHealth(...)  — explicit log, call from cron success/error paths.
 *   - probedFetch(component, url, init) — drop-in `fetch` wrapper that logs
 *     latency + status of a real request. Use to passively observe external
 *     APIs without active probing.
 *
 * Both functions are best-effort: any failure to write to Supabase is
 * swallowed so they never break the calling code path.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Dedicated service-role client. The default `lib/supabase` uses the anon
// key which is blocked by RLS on `system_health_log` (writes only, no
// public policy). Health observations are server-side only, so we use the
// service-role key here. Lazy init keeps cold starts cheap and avoids
// blowing up modules that don't need health logging when SERVICE_ROLE_KEY
// is missing in the environment.
let _client: SupabaseClient | null = null
function getClient(): SupabaseClient | null {
  if (_client) return _client
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  _client = createClient(url, key, { auth: { persistSession: false } })
  return _client
}

export type HealthStatus = 'ok' | 'degraded' | 'down'
export type ComponentType = 'cron' | 'external_api' | 'infra' | 'data_source'

export interface HealthEvent {
  component: string
  component_type: ComponentType
  status: HealthStatus
  latency_ms?: number
  http_status?: number
  error_message?: string
  metadata?: Record<string, any>
}

const TABLE = 'system_health_log'

export async function recordHealth(event: HealthEvent): Promise<void> {
  const client = getClient()
  if (!client) {
    console.warn('[health-logger] SUPABASE_SERVICE_ROLE_KEY not set — observation dropped')
    return
  }
  try {
    const row = {
      component: event.component,
      component_type: event.component_type,
      status: event.status,
      latency_ms: event.latency_ms ?? null,
      http_status: event.http_status ?? null,
      error_message: event.error_message ? truncate(event.error_message, 500) : null,
      metadata: event.metadata ?? null,
    }
    const { error } = await client.from(TABLE).insert(row)
    if (error) {
      console.warn('[health-logger] insert failed:', error.message)
    }
  } catch (e) {
    // best-effort; never throw
    console.warn('[health-logger] unexpected error:', (e as Error).message)
  }
}

/**
 * Wraps `fetch` and logs the result as a passive observation. Behaves
 * identically to `fetch` from the caller's POV (returns the Response,
 * rethrows network errors). The component name should be stable for the
 * upstream being probed (e.g. `external:xverse`, `external:mempool`).
 */
export async function probedFetch(
  component: string,
  url: string | URL,
  init?: RequestInit & { component_type?: ComponentType }
): Promise<Response> {
  const componentType: ComponentType = init?.component_type ?? 'external_api'
  const start = Date.now()
  try {
    const res = await fetch(url, init)
    const latency = Date.now() - start
    const status: HealthStatus = res.ok
      ? (latency > 5000 ? 'degraded' : 'ok')
      : (res.status >= 500 || res.status === 429 ? 'down' : 'degraded')
    // Awaited so that Vercel serverless doesn't freeze the function before
    // the Supabase insert completes. Adds ~50-150ms tail latency to the fetch.
    await recordHealth({
      component,
      component_type: componentType,
      status,
      latency_ms: latency,
      http_status: res.status,
    })
    return res
  } catch (e) {
    const latency = Date.now() - start
    await recordHealth({
      component,
      component_type: componentType,
      status: 'down',
      latency_ms: latency,
      error_message: (e as Error).message,
    })
    throw e
  }
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…'
}
