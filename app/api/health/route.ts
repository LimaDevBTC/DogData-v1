import { NextResponse } from 'next/server';
import { redisClient } from '@/lib/upstash';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, { status: 'ok' | 'degraded' | 'down'; latency_ms?: number; details?: string }> = {};
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  // Check 1: Redis connectivity
  const redisStart = Date.now();
  try {
    await redisClient.ping();
    checks.redis = { status: 'ok', latency_ms: Date.now() - redisStart };
  } catch (e: any) {
    checks.redis = { status: 'down', latency_ms: Date.now() - redisStart, details: e.message };
    overallStatus = 'degraded';
  }

  // Check 2: Holders data availability (via internal API, avoids fs bloat)
  const holdersStart = Date.now();
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const res = await fetch(`${baseUrl}/api/dog-rune/holders?limit=1`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = await res.json();
      const total = data.pagination?.total || 0;
      checks.holders_data = {
        status: total > 0 ? 'ok' : 'down',
        latency_ms: Date.now() - holdersStart,
        details: `${total} holders, updated: ${data.metadata?.updatedAt || 'unknown'}`,
      };
      if (total === 0) overallStatus = 'unhealthy';
    } else {
      checks.holders_data = { status: 'down', latency_ms: Date.now() - holdersStart, details: `HTTP ${res.status}` };
      overallStatus = 'unhealthy';
    }
  } catch (e: any) {
    checks.holders_data = { status: 'down', latency_ms: Date.now() - holdersStart, details: e.message };
    overallStatus = 'unhealthy';
  }

  // Check 3: Transactions in Redis
  try {
    const txData = await redisClient.get('dog:transactions');
    if (txData) {
      checks.transactions = { status: 'ok', details: 'Cached in Redis' };
    } else {
      checks.transactions = { status: 'degraded', details: 'No cached transactions' };
      if (overallStatus === 'healthy') overallStatus = 'degraded';
    }
  } catch (e: any) {
    checks.transactions = { status: 'degraded', details: e.message };
  }

  const statusCode = overallStatus === 'unhealthy' ? 503 : 200;

  return NextResponse.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    checks,
    uptime_seconds: Math.floor(process.uptime()),
  }, {
    status: statusCode,
    headers: {
      'Cache-Control': 'no-cache, no-store',
      'Access-Control-Allow-Origin': '*',
    }
  });
}
