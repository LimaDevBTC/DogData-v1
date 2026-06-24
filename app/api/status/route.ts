import { NextResponse } from 'next/server';
import { API_ENDPOINT_COUNT } from '@/lib/api-metadata';

export const dynamic = 'force-dynamic';

export async function GET() {
  const status: any = {
    service: "DOG DATA",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  };

  // Get holder stats via internal API (avoids fs which bloats serverless bundle)
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const res = await fetch(`${baseUrl}/api/dog-rune/holders?limit=1`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      status.stats = {
        total_holders: data.pagination?.total,
        data_timestamp: data.metadata?.updatedAt,
        source: data.metadata?.source,
      };
    }
  } catch {}

  // API endpoints available
  status.endpoints = {
    total: API_ENDPOINT_COUNT,
    categories: ['holders', 'transactions', 'price', 'metrics', 'forensic', 'airdrop', 'bitcoin', 'markets', 'events', 'agent', 'keys']
  };

  return NextResponse.json(status, {
    headers: {
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=10',
      'Access-Control-Allow-Origin': '*',
    }
  });
}
