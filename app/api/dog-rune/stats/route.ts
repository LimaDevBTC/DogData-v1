import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getLiveSnapshot } from '@/lib/snapshot-redis';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DOG_RUNE_ID = '840000:3';
const DOG_DIVISIBILITY = 5;
const DOG_TOTAL_SUPPLY = 100_000_000_000;

interface LocalHoldersData {
  timestamp: string;
  total_holders: number;
  total_utxos: number;
  holders: Array<{
    rank: number;
    address: string;
    total_amount: number;
    total_dog: number;
    utxo_count?: number;
  }>;
}

async function loadLocalHolders(): Promise<LocalHoldersData | null> {
  const possiblePaths = [
    path.join(process.cwd(), 'public', 'data', 'dog_holders_by_address.json'),
    path.join(process.cwd(), 'data', 'dog_holders_by_address.json'),
    path.join(process.cwd(), '..', 'DogData-v1', 'public', 'data', 'dog_holders_by_address.json'),
    path.join(process.cwd(), '..', 'DogData-v1', 'data', 'dog_holders_by_address.json'),
  ];

  for (const filePath of possiblePaths) {
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(raw) as LocalHoldersData;
    } catch {
      // try next
    }
  }

  // Last-resort: HTTP fallback (Vercel runtime)
  try {
    let baseUrl: string;
    if (process.env.NEXT_PUBLIC_APP_URL) baseUrl = process.env.NEXT_PUBLIC_APP_URL;
    else if (process.env.VERCEL_URL) baseUrl = `https://${process.env.VERCEL_URL}`;
    else baseUrl = 'http://localhost:3000';
    baseUrl = baseUrl.replace(/\/$/, '');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(`${baseUrl}/data/dog_holders_by_address.json`, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 0 },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
      return await response.json() as LocalHoldersData;
    }
  } catch {
    // fall through
  }
  return null;
}

export async function GET() {
  // 1) Source of truth: Upstash live snapshot — pre-computed top10 + agregados
  try {
    const snap = await getLiveSnapshot();
    if (snap && snap.top10_holders) {
      return NextResponse.json({
        total_holders: snap.total_holders,
        total_utxos: snap.total_utxos,
        total_supply: DOG_TOTAL_SUPPLY,
        circulating_supply: snap.circulating_supply,
        burned: snap.burned,
        burned_pct: snap.burned_pct,
        top10_holders: snap.top10_holders,
        rune_id: DOG_RUNE_ID,
        divisibility: DOG_DIVISIBILITY,
        source: 'redis',
        last_updated: snap.timestamp,
      }, {
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
      });
    }
  } catch (e) {
    console.error('[dog-rune/stats] Redis fetch failed, falling back to file:', e);
  }

  // 2) Fallback: bundled file
  try {
    const data = await loadLocalHolders();
    if (!data || !Array.isArray(data.holders)) {
      return NextResponse.json({ error: 'Stats data not available — scanner data not found' }, { status: 503 });
    }

    const totalHolders = data.total_holders || data.holders.length;
    const circulatingSupply = data.holders.reduce((sum, h) => sum + (h.total_dog || 0), 0);
    const top10Holders = data.holders.slice(0, 10).map((h, i) => ({
      rank: h.rank || i + 1,
      address: h.address,
      total_amount: h.total_amount,
      total_dog: h.total_dog,
      utxo_count: h.utxo_count,
    }));

    const circulating = Math.round(circulatingSupply * 100) / 100;
    const burned = Math.max(0, DOG_TOTAL_SUPPLY - circulating);
    const burned_pct = parseFloat(((burned / DOG_TOTAL_SUPPLY) * 100).toFixed(4));

    return NextResponse.json({
      total_holders: totalHolders,
      total_utxos: data.total_utxos || 0,
      total_supply: DOG_TOTAL_SUPPLY,
      circulating_supply: circulating,
      burned,
      burned_pct,
      top10_holders: top10Holders,
      rune_id: DOG_RUNE_ID,
      divisibility: DOG_DIVISIBILITY,
      source: 'file',
      last_updated: data.timestamp || new Date().toISOString(),
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300', 'X-Source': 'file' },
    });
  } catch (error) {
    console.error('Error loading DOG stats:', error);
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 });
  }
}
