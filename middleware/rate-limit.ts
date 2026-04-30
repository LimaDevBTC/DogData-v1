import { NextRequest, NextResponse } from 'next/server';
import { redisClient } from '@/lib/upstash';

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;  // sliding window in milliseconds
}

const TIER_LIMITS: Record<string, RateLimitConfig> = {
  public:     { maxRequests: 100,   windowMs: 3600000 },  // 100/hour
  free:       { maxRequests: 100,   windowMs: 3600000 },  // 100/hour
  pro:        { maxRequests: 5000,  windowMs: 3600000 },  // 5000/hour
  enterprise: { maxRequests: 50000, windowMs: 3600000 },  // 50000/hour
};

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;  // Unix timestamp when window resets
}

export async function checkRateLimit(
  identifier: string,
  tier: string
): Promise<RateLimitResult> {
  const config = TIER_LIMITS[tier] || TIER_LIMITS.public;
  const now = Date.now();
  const windowStart = now - config.windowMs;
  const key = `ratelimit:${identifier}`;

  try {
    // Use Redis sorted set for sliding window
    // Remove old entries, add current, count
    const pipeline = redisClient.pipeline();
    pipeline.zremrangebyscore(key, 0, windowStart);
    pipeline.zadd(key, { score: now, member: `${now}:${Math.random().toString(36).slice(2)}` });
    pipeline.zcard(key);
    pipeline.expire(key, Math.ceil(config.windowMs / 1000));

    const results = await pipeline.exec();
    const count = (results[2] as number) || 0;

    const reset = Math.ceil((now + config.windowMs) / 1000);
    const remaining = Math.max(0, config.maxRequests - count);

    return {
      allowed: count <= config.maxRequests,
      limit: config.maxRequests,
      remaining,
      reset,
    };
  } catch {
    // If Redis fails, allow the request (fail open)
    return {
      allowed: true,
      limit: config.maxRequests,
      remaining: config.maxRequests,
      reset: Math.ceil((now + config.windowMs) / 1000),
    };
  }
}

export function addRateLimitHeaders(response: NextResponse, result: RateLimitResult): NextResponse {
  response.headers.set('X-RateLimit-Limit', String(result.limit));
  response.headers.set('X-RateLimit-Remaining', String(result.remaining));
  response.headers.set('X-RateLimit-Reset', String(result.reset));
  if (!result.allowed) {
    response.headers.set('Retry-After', String(Math.max(1, result.reset - Math.ceil(Date.now() / 1000))));
  }
  return response;
}
