import { NextRequest, NextResponse } from 'next/server';
import { redisClient } from '@/lib/upstash';
import { getRequestTier, ApiKeyInfo } from './auth';
import { checkRateLimit, addRateLimitHeaders, RateLimitResult } from './rate-limit';
import { errorResponse } from '@/lib/error-response';

export interface GatewayContext {
  tier: 'public' | 'free' | 'pro' | 'enterprise';
  keyInfo: ApiKeyInfo | null;
  rateLimit: RateLimitResult;
}

// Endpoints that don't require auth
const PUBLIC_ENDPOINTS = [
  '/api/health',
  '/api/status',
  '/api/agent/capabilities',
  '/api/openapi.json',
  '/api/dog-rune/stats',
  '/api/price/kraken',
];

function isPublicEndpoint(pathname: string): boolean {
  return PUBLIC_ENDPOINTS.some(ep => pathname.startsWith(ep));
}

export async function apiGateway(
  req: NextRequest,
  options?: { requireAuth?: boolean }
): Promise<{ context: GatewayContext } | NextResponse> {
  const pathname = req.nextUrl.pathname;

  // Get tier (public or authenticated)
  const { tier, keyInfo } = await getRequestTier(req);

  // Check if auth is required
  if (options?.requireAuth && !keyInfo) {
    return errorResponse('UNAUTHORIZED', 'API key required. Get one at https://www.dogdata.xyz/api-keys');
  }

  // Determine rate limit identifier
  const identifier = keyInfo
    ? `key:${keyInfo.id}`
    : `ip:${req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'}`;

  // Check rate limit
  const rateLimit = await checkRateLimit(identifier, tier);

  if (!rateLimit.allowed) {
    const errorResp = errorResponse(
      'RATE_LIMIT_EXCEEDED',
      `Rate limit exceeded. ${tier === 'public' ? 'Add an API key for higher limits.' : `Upgrade from ${tier} for higher limits.`} Current: ${rateLimit.limit} requests/hour.`,
      { retryAfter: Math.max(1, rateLimit.reset - Math.ceil(Date.now() / 1000)) }
    );
    return addRateLimitHeaders(errorResp, rateLimit);
  }

  // Log usage asynchronously (non-blocking)
  if (keyInfo) {
    logApiUsage(keyInfo, req, pathname).catch(() => {});
  }

  return {
    context: { tier, keyInfo, rateLimit },
  };
}

async function logApiUsage(keyInfo: ApiKeyInfo, req: NextRequest, endpoint: string) {
  try {
    // Use Redis for fast logging, batch to Supabase periodically
    const logKey = `usage:${keyInfo.id}:${new Date().toISOString().slice(0, 13)}`; // hourly bucket
    await redisClient.hincrby(logKey, endpoint, 1);
    await redisClient.expire(logKey, 86400 * 7); // Keep for 7 days
  } catch {}
}

// Helper to apply rate limit headers to any response
export function withGatewayHeaders(response: NextResponse, context: GatewayContext): NextResponse {
  addRateLimitHeaders(response, context.rateLimit);
  response.headers.set('X-DogData-Tier', context.tier);
  if (context.keyInfo) {
    response.headers.set('X-DogData-Key', context.keyInfo.key_prefix + '...');
  }
  return response;
}
