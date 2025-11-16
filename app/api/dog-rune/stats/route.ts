import { NextResponse } from 'next/server';
import { redisClient } from '@/lib/upstash';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DOG_RUNE_ID = '840000:3';
const CACHE_PREFIX = 'dog:holders';
const CACHE_TTL_SECONDS = 60 * 5; // 5 minutos
const XVERSE_API_BASE = process.env.XVERSE_API_BASE || 'https://api.secretkeylabs.io';
const XVERSE_API_KEY = process.env.XVERSE_API_KEY || '';

interface RuneMetadataResponse {
  divisibility?: string | number;
  holders?: string | number;
  supply?: string;
  premine?: string;
  marketCap?: {
    valueInSats?: string;
    valueInUsd?: string;
  };
  volume24h?: {
    valueInSats?: string;
    valueInUsd?: string;
  };
}

interface CachedMetadata {
  runeId: string;
  divisibility: number;
  total: number;
  updatedAt: string;
  supply?: string;
  premine?: string;
}

function runesToDog(amount: string | number | undefined, divisibility: number) {
  if (!amount) return 0;
  const value = typeof amount === 'string' ? Number(amount) : Number(amount ?? 0);
  if (!Number.isFinite(value)) {
    return 0;
  }
  return value / 10 ** divisibility;
}

async function loadFallbackStats() {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const statsPath = path.join(process.cwd(), 'data', 'dog_stats_fallback.json');
    const statsRaw = await fs.readFile(statsPath, 'utf-8');
    const stats = JSON.parse(statsRaw) as {
      totalHolders?: number;
      circulatingSupply?: number;
      totalSupply?: number;
      lastUpdated?: string;
    };

    let top10Holders: Array<{ rank: number; address: string; total_amount: number; total_dog: number }> = [];
    try {
      const holdersPath = path.join(process.cwd(), 'public', 'data', 'dog_holders_by_address.json');
      const holdersRaw = await fs.readFile(holdersPath, 'utf-8');
      const holdersJson = JSON.parse(holdersRaw) as {
        holders?: Array<{ address: string; total_amount: number; total_dog: number }>;
      };
      if (Array.isArray(holdersJson?.holders)) {
        top10Holders = holdersJson.holders.slice(0, 10).map((holder, index) => ({
          rank: index + 1,
          address: holder.address,
          total_amount: holder.total_amount,
          total_dog: holder.total_dog,
        }));
      }
    } catch (holderError) {
      console.warn('⚠️ Failed to load fallback holders snapshot:', holderError);
    }

    return {
      totalHolders: stats.totalHolders ?? 0,
      totalSupply: stats.totalSupply ?? stats.circulatingSupply ?? 0,
      circulatingSupply: stats.circulatingSupply ?? stats.totalSupply ?? 0,
      top10Holders,
      metadata: {
        runeId: DOG_RUNE_ID,
        divisibility: 5,
        source: 'fallback',
        lastUpdated: stats.lastUpdated ?? new Date().toISOString(),
      },
    };
  } catch (error) {
    console.warn('⚠️ Failed to load fallback stats:', error);
    return null;
  }
}

async function fetchRuneMetadata(): Promise<{ metadata: RuneMetadataResponse; divisibility: number; totalHolders: number }> {
  if (!XVERSE_API_KEY) {
    throw new Error('Missing XVERSE_API_KEY environment variable');
  }

  const url = new URL(`/v1/runes/${DOG_RUNE_ID}`, XVERSE_API_BASE);
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'x-api-key': XVERSE_API_KEY,
      accept: 'application/json',
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`Xverse rune metadata request failed (${response.status}): ${errorBody}`);
  }

  const metadata = await response.json() as RuneMetadataResponse;
  const divisibility = typeof metadata.divisibility === 'string'
    ? Number(metadata.divisibility)
    : Number(metadata.divisibility ?? 0);

  const totalHolders = typeof metadata.holders === 'string'
    ? Number(metadata.holders)
    : Number(metadata.holders ?? 0);

  return { metadata, divisibility, totalHolders };
}

async function getCachedMetadata(): Promise<CachedMetadata | null> {
  try {
    const raw = await redisClient.get<string>(`${CACHE_PREFIX}:meta`);
    if (!raw) return null;
    return JSON.parse(raw) as CachedMetadata;
  } catch (error) {
    console.warn('⚠️ Failed to read holders metadata cache:', error);
    return null;
  }
}

async function setCachedMetadata(payload: CachedMetadata) {
  try {
    await redisClient.set(`${CACHE_PREFIX}:meta`, JSON.stringify(payload), { ex: CACHE_TTL_SECONDS });
  } catch (error) {
    console.warn('⚠️ Failed to cache rune metadata:', error);
  }
}

async function getTopHoldersFromCache(): Promise<Array<{ rank: number; address: string; total_amount: number; total_dog: number }>> {
  try {
    const cachedPage = await redisClient.get<string>(`${CACHE_PREFIX}:page:1:limit:25`);
    if (!cachedPage) return [];
    const parsed = JSON.parse(cachedPage) as {
      holders?: Array<{ rank: number; address: string; total_amount: number; total_dog: number }>;
    };
    return parsed.holders?.slice(0, 10) ?? [];
  } catch (error) {
    console.warn('⚠️ Failed to read holders page cache for stats:', error);
    return [];
  }
}

async function fetchTopHolders(divisibility: number) {
  if (!XVERSE_API_KEY) {
    throw new Error('Missing XVERSE_API_KEY environment variable');
  }

  const url = new URL(`/v1/runes/${DOG_RUNE_ID}/holders`, XVERSE_API_BASE);
  url.searchParams.set('offset', '0');
  url.searchParams.set('limit', '25');

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'x-api-key': XVERSE_API_KEY,
      accept: 'application/json',
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`Xverse holders request failed (${response.status}): ${errorBody}`);
  }

  const payload = await response.json() as {
    items: Array<{ address: string; amount: string }>;
    total: number;
  };

  const holders = payload.items.map((item, index) => {
    const totalAmount = Number(item.amount);
    return {
      rank: index + 1,
      address: item.address,
      total_amount: totalAmount,
      total_dog: runesToDog(totalAmount, divisibility),
    };
  });

  const cachePayload = {
    holders,
    pagination: {
      total: payload.total,
      page: 1,
      limit: 25,
      totalPages: Math.max(1, Math.ceil(payload.total / 25)),
    },
    metadata: {
      runeId: DOG_RUNE_ID,
      divisibility,
      source: 'xverse',
      updatedAt: new Date().toISOString(),
    },
  };

  try {
    await redisClient.set(`${CACHE_PREFIX}:page:1:limit:25`, JSON.stringify(cachePayload), { ex: CACHE_TTL_SECONDS });
  } catch (error) {
    console.warn('⚠️ Failed to cache holders page from stats:', error);
  }

  return holders.slice(0, 10);
}

export async function GET() {
  try {
    let cachedMeta = await getCachedMetadata();
    let divisibility = cachedMeta?.divisibility ?? 0;
    let totalHolders = cachedMeta?.total ?? 0;

    if (!cachedMeta || !divisibility || !totalHolders) {
      const { metadata, divisibility: freshDiv, totalHolders: freshTotal } = await fetchRuneMetadata();
      divisibility = freshDiv;
      totalHolders = freshTotal;
      cachedMeta = {
        runeId: DOG_RUNE_ID,
        divisibility,
        total: totalHolders,
        updatedAt: new Date().toISOString(),
        supply: metadata.supply,
        premine: metadata.premine,
      };
      await setCachedMetadata(cachedMeta);
    }

    let topHolders = await getTopHoldersFromCache();
    if (!topHolders.length) {
      try {
        topHolders = await fetchTopHolders(divisibility);
      } catch (holderError) {
        console.warn('⚠️ Failed to fetch holders for stats, continuing without top list:', holderError);
        topHolders = [];
      }
    }

    const totalSupplyDog = runesToDog(cachedMeta?.premine, divisibility);
    const circulatingSupplyDog = runesToDog(cachedMeta?.supply, divisibility);

    return NextResponse.json({
      totalHolders,
      totalSupply: totalSupplyDog,
      circulatingSupply: circulatingSupplyDog,
      top10Holders: topHolders.slice(0, 10),
      metadata: {
        runeId: DOG_RUNE_ID,
        divisibility,
        source: 'xverse',
        lastUpdated: cachedMeta?.updatedAt ?? new Date().toISOString(),
      },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    console.error('❌ Error loading DOG stats from Xverse, attempting fallback:', error);
    const fallback = await loadFallbackStats();
    if (fallback) {
      console.warn('⚠️ Serving fallback DOG stats payload');
      return NextResponse.json(fallback, {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
        },
      });
    }
    
    // Último recurso: retornar dados mínimos válidos ao invés de erro 500
    console.error('❌ All fallback methods failed, returning minimal valid response');
    return NextResponse.json({
      totalHolders: 0,
      totalSupply: 0,
      circulatingSupply: 0,
      top10Holders: [],
      metadata: {
        runeId: DOG_RUNE_ID,
        divisibility: 5,
        source: 'fallback',
        lastUpdated: new Date().toISOString(),
      },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=5',
      },
    });
  }
}




