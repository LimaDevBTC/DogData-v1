import { NextResponse } from 'next/server';
import { redisClient } from '@/lib/upstash';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, { status: 'ok' | 'degraded' | 'down'; latency_ms?: number; details?: string }> = {};
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  // Check 1: Data files availability
  const dataStart = Date.now();
  try {
    const holdersPath = path.join(process.cwd(), 'data', 'dog_holders_by_address.json');
    if (fs.existsSync(holdersPath)) {
      const stats = fs.statSync(holdersPath);
      const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
      checks.data_files = {
        status: ageHours < 24 ? 'ok' : 'degraded',
        latency_ms: Date.now() - dataStart,
        details: `Holders file age: ${ageHours.toFixed(1)}h`
      };
      if (ageHours >= 24) overallStatus = 'degraded';
    } else {
      checks.data_files = { status: 'down', details: 'Holders file not found' };
      overallStatus = 'unhealthy';
    }
  } catch (e: any) {
    checks.data_files = { status: 'down', details: e.message };
    overallStatus = 'unhealthy';
  }

  // Check 2: Redis connectivity
  const redisStart = Date.now();
  try {
    await redisClient.ping();
    checks.redis = { status: 'ok', latency_ms: Date.now() - redisStart };
  } catch (e: any) {
    checks.redis = { status: 'down', latency_ms: Date.now() - redisStart, details: e.message };
    overallStatus = overallStatus === 'healthy' ? 'degraded' : overallStatus;
  }

  // Check 3: Scanner status
  try {
    const scannerPath = path.join(process.cwd(), 'data', 'scanner_state.json');
    if (fs.existsSync(scannerPath)) {
      const state = JSON.parse(fs.readFileSync(scannerPath, 'utf-8'));
      const lastScanTime = new Date(state.timestamp || state.last_updated || 0).getTime();
      const scannerLagMinutes = (Date.now() - lastScanTime) / (1000 * 60);
      checks.scanner = {
        status: scannerLagMinutes < 10 ? 'ok' : scannerLagMinutes < 60 ? 'degraded' : 'down',
        details: `Last scan: ${scannerLagMinutes.toFixed(1)}min ago, block: ${state.last_block || state.block_height || 'unknown'}`
      };
      if (scannerLagMinutes >= 60) overallStatus = overallStatus === 'healthy' ? 'degraded' : overallStatus;
    } else {
      checks.scanner = { status: 'degraded', details: 'Scanner state file not found' };
    }
  } catch (e: any) {
    checks.scanner = { status: 'degraded', details: e.message };
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
