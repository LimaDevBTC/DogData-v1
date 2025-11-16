import { NextRequest, NextResponse } from 'next/server';
import { redisClient } from '@/lib/upstash';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DOG_RUNE_ID = '840000:3';
const CACHE_PREFIX = 'dog:holders';
const HOLDER_RANK_HASH = `${CACHE_PREFIX}:ranks`;
const HOLDER_SNAPSHOT_KEY = `${CACHE_PREFIX}:snapshot`;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 25;
const SNAPSHOT_LIMIT = 500;
const CHUNK_LIMIT = 100;
const CACHE_TTL_SECONDS = Number(process.env.HOLDERS_CACHE_TTL_SECONDS || 60 * 60); // padrão 1 hora
const XVERSE_HOLDERS_LIMIT_PER_REQUEST = Number(process.env.XVERSE_HOLDERS_LIMIT || 100);
const XVERSE_HOLDERS_DELAY_MS = Number(process.env.XVERSE_HOLDERS_DELAY_MS || 1200);
const XVERSE_HOLDERS_BACKOFF_BASE_MS = Number(process.env.XVERSE_HOLDERS_BACKOFF_BASE_MS || 1200);
const XVERSE_HOLDERS_RETRY_MAX = Number(process.env.XVERSE_HOLDERS_RETRY_MAX || 6);
const XVERSE_SNAPSHOT_CHUNK_DELAY_MS = Number(process.env.XVERSE_SNAPSHOT_CHUNK_DELAY_MS || 1500);
const XVERSE_API_BASE = process.env.XVERSE_API_BASE || 'https://api.secretkeylabs.io';
const XVERSE_API_KEY = process.env.XVERSE_API_KEY || '';

interface XverseHolderResponse {
  offset: number;
  limit: number;
  total: number;
  items: Array<{ address: string; amount: string }>;
}

interface CachedHoldersPage {
  holders: HolderDTO[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  metadata: {
    runeId: string;
    divisibility: number;
    source: 'xverse' | 'fallback';
    updatedAt: string;
  };
}

interface HolderDTO {
  rank: number;
  address: string;
  total_amount: number;
  total_dog: number;
}

interface HolderSearchResponse {
  holder: HolderDTO & {
    available_amount: number;
    available_dog: number;
    projected_amount: number;
    projected_dog: number;
    pending_incoming: number;
    pending_outgoing: number;
    pending_net: number;
    holder_rank?: number | null;
  };
  metadata: {
    runeId: string;
    divisibility: number;
    indexerHeight: number | null;
    source: 'xverse' | 'fallback';
    updatedAt: string;
  };
}

function clampPage(page: number) {
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function clampLimit(limit: number) {
  if (!Number.isFinite(limit) || limit <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(limit), MAX_LIMIT);
}

function runesToDog(amount: number, divisibility: number) {
  return amount / 10 ** divisibility;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchHoldersPage(offset: number, limit: number) {
  if (!XVERSE_API_KEY) {
    throw new Error('Missing XVERSE_API_KEY environment variable');
  }

  const cappedLimit = Math.min(limit, XVERSE_HOLDERS_LIMIT_PER_REQUEST);
  let attempt = 0;

  while (attempt < XVERSE_HOLDERS_RETRY_MAX) {
    const url = new URL(`/v1/runes/${DOG_RUNE_ID}/holders`, XVERSE_API_BASE);
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('limit', String(cappedLimit));

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'x-api-key': XVERSE_API_KEY,
        accept: 'application/json',
      },
      next: { revalidate: 0 },
    });

    if (response.ok) {
      const payload = (await response.json()) as XverseHolderResponse;
      if (!payload || !Array.isArray(payload.items)) {
        throw new Error('Invalid holders payload from Xverse');
      }
      return payload;
    }

    const errorBody = await response.text().catch(() => '');
    const message = `Xverse holders request failed (${response.status}): ${errorBody}`;

    if (response.status === 429 || response.status === 503) {
      attempt += 1;
      const backoffMs = XVERSE_HOLDERS_BACKOFF_BASE_MS * Math.min(2 ** (attempt - 1), 8);
      console.warn(`⚠️ [HOLDERS] Rate limit (${response.status}). Tentativa ${attempt}/${XVERSE_HOLDERS_RETRY_MAX}. Aguardando ${backoffMs}ms.`);
      await sleep(backoffMs);
      continue;
    }

    throw new Error(message);
  }

  throw new Error('Exceeded maximum retries while fetching holders from Xverse');
}

async function loadLocalSnapshot(): Promise<{
  total: number;
  holders: HolderDTO[];
  timestamp?: string;
}> {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const filePath = path.join(process.cwd(), 'public', 'data', 'dog_holders_by_address.json');
    const raw = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data?.holders)) {
      throw new Error('Invalid local holders file');
    }
    const holders: HolderDTO[] = data.holders.slice(0, SNAPSHOT_LIMIT).map((holder: any, index: number) => ({
      rank: holder?.rank ?? index + 1,
      address: holder?.address || '',
      total_amount: holder?.total_amount || 0,
      total_dog: holder?.total_dog || 0,
    })).filter((holder: HolderDTO) => Boolean(holder.address));

    return {
      total: data?.total_holders || holders.length,
      holders,
      timestamp: data?.timestamp,
    };
  } catch (error) {
    console.warn('⚠️ Failed to load local holders snapshot:', error);
    throw error;
  }
}

async function fetchRuneMetadata() {
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

  return response.json() as Promise<{
    divisibility?: string | number;
    holders?: string | number;
    supply?: string;
    premine?: string;
  }>;
}

async function getDivisibility(): Promise<number> {
  const metaKey = `${CACHE_PREFIX}:meta`;

  try {
    const cachedMetaRaw = await redisClient.get<string>(metaKey);
    if (cachedMetaRaw) {
      const cachedMeta = JSON.parse(cachedMetaRaw) as { divisibility?: number };
      if (typeof cachedMeta.divisibility === 'number') {
        return cachedMeta.divisibility;
      }
    }
  } catch (error) {
    console.warn('⚠️ Failed to read divisibility from cache:', error);
  }

  try {
    const runeMeta = await fetchRuneMetadata();
    const divisibility = typeof runeMeta.divisibility === 'string'
      ? Number(runeMeta.divisibility)
      : Number(runeMeta.divisibility ?? 0);

    const metaPayload = {
      divisibility,
      updatedAt: new Date().toISOString(),
    };

    try {
      await redisClient.set(metaKey, JSON.stringify(metaPayload), { ex: CACHE_TTL_SECONDS });
    } catch (cacheError) {
      console.warn('⚠️ Failed to cache rune metadata:', cacheError);
    }

    return divisibility;
  } catch (fetchError) {
    console.warn('⚠️ Failed to fetch rune metadata, defaulting divisibility to 5:', fetchError);
    return 5;
  }
}

async function getCachedPage(page: number, limit: number): Promise<CachedHoldersPage | null> {
  const key = `${CACHE_PREFIX}:page:${page}:limit:${limit}`;
  try {
    const cached = await redisClient.get<string>(key);
    if (!cached) return null;
    return JSON.parse(cached) as CachedHoldersPage;
  } catch (error) {
    console.warn('⚠️ Failed to load cached holders page:', error);
    return null;
  }
}

async function setCachedPage(page: number, limit: number, payload: CachedHoldersPage) {
  const key = `${CACHE_PREFIX}:page:${page}:limit:${limit}`;
  try {
    await redisClient.set(key, JSON.stringify(payload), { ex: CACHE_TTL_SECONDS });
  } catch (error) {
    console.warn('⚠️ Failed to cache holders page:', error);
  }
}

async function fetchAndCachePage(page: number, limit: number, divisibility: number): Promise<CachedHoldersPage> {
  const offset = (page - 1) * limit;
  const holders = await fetchHoldersPage(offset, limit);

  const dto: CachedHoldersPage = {
    holders: holders.items.map((item, index) => {
      const totalAmount = Number(item.amount);
      return {
        rank: offset + index + 1,
        address: item.address,
        total_amount: totalAmount,
        total_dog: runesToDog(totalAmount, divisibility),
      };
    }),
    pagination: {
      total: holders.total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(holders.total / limit)),
    },
    metadata: {
      runeId: DOG_RUNE_ID,
      divisibility,
      source: 'xverse',
      updatedAt: new Date().toISOString(),
    },
  };

  await setCachedPage(page, limit, dto);

  const ranksPayload: Record<string, number> = {};
  for (const holder of dto.holders) {
    ranksPayload[holder.address] = holder.rank;
  }
  try {
    if (Object.keys(ranksPayload).length > 0) {
      await redisClient.hset(HOLDER_RANK_HASH, ranksPayload);
    }
  } catch (rankCacheError) {
    console.warn('⚠️ Failed to cache holder ranks:', rankCacheError);
  }

  if (page === 1) {
    ensureSnapshot(divisibility).catch((err) => {
      console.warn('⚠️ Failed to refresh holders snapshot:', err);
    });
  }

  const metaKey = `${CACHE_PREFIX}:meta`;
  try {
    const currentMetaRaw = await redisClient.get<string>(metaKey);
    const newMeta = {
      runeId: DOG_RUNE_ID,
      divisibility,
      total: holders.total,
      updatedAt: dto.metadata.updatedAt,
    };

    if (!currentMetaRaw) {
      await redisClient.set(metaKey, JSON.stringify(newMeta), { ex: CACHE_TTL_SECONDS });
    } else {
      const currentMeta = JSON.parse(currentMetaRaw);
      await redisClient.set(metaKey, JSON.stringify({ ...currentMeta, ...newMeta }), { ex: CACHE_TTL_SECONDS });
    }
  } catch (error) {
    console.warn('⚠️ Failed to update holders metadata cache:', error);
  }

  return dto;
}

async function fetchHolderByAddress(address: string): Promise<HolderSearchResponse | null> {
  if (!XVERSE_API_KEY) {
    throw new Error('Missing XVERSE_API_KEY environment variable');
  }

  const url = new URL(`/v2/runes/address/${address}/balance`, XVERSE_API_BASE);
  url.searchParams.set('runeId', DOG_RUNE_ID);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'x-api-key': XVERSE_API_KEY,
      accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`Xverse rune balance request failed (${response.status}): ${errorBody}`);
  }

  const payload = await response.json() as {
    balances: Array<{
      runeId: string;
      confirmedBalance: string;
      availableBalance: string;
      projectedBalance: string;
      pendingBalance: {
        incomingAmount: string;
        outgoingAmount: string;
        netAmount: string;
      };
      divisibility?: number;
    }>;
    indexerHeight?: number;
  };

  if (!Array.isArray(payload.balances) || payload.balances.length === 0) {
    return null;
  }

  const entry = payload.balances.find((b) => b.runeId === DOG_RUNE_ID) ?? payload.balances[0];
  const divisibility = typeof entry.divisibility === 'number' ? entry.divisibility : await getDivisibility();

  const holderRankRaw = await redisClient.hget<number | string>(`${CACHE_PREFIX}:ranks`, address).catch((err) => {
    console.warn('⚠️ Failed to fetch holder rank from cache:', err);
    return null;
  });
  const holderRank = holderRankRaw !== null && holderRankRaw !== undefined ? Number(holderRankRaw) : null;

  const confirmedAmount = Number(entry.confirmedBalance);
  const availableAmount = Number(entry.availableBalance);
  const projectedAmount = Number(entry.projectedBalance);
  const pendingIncoming = Number(entry.pendingBalance?.incomingAmount ?? 0);
  const pendingOutgoing = Number(entry.pendingBalance?.outgoingAmount ?? 0);
  const pendingNet = Number(entry.pendingBalance?.netAmount ?? 0);

  return {
    holder: {
      rank: -1,
      address,
      total_amount: confirmedAmount,
      total_dog: runesToDog(confirmedAmount, divisibility),
      available_amount: availableAmount,
      available_dog: runesToDog(availableAmount, divisibility),
      projected_amount: projectedAmount,
      projected_dog: runesToDog(projectedAmount, divisibility),
      pending_incoming: pendingIncoming,
      pending_outgoing: pendingOutgoing,
      pending_net: pendingNet,
      holder_rank: holderRank,
    },
    metadata: {
      runeId: DOG_RUNE_ID,
      divisibility,
      indexerHeight: payload.indexerHeight ?? null,
      source: 'xverse',
      updatedAt: new Date().toISOString(),
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl;
    const searchParams = url.searchParams;

    const snapshotQuery = searchParams.get('snapshot');
    if (snapshotQuery) {
      let divisibility = 5;
      try {
        divisibility = await getDivisibility();
      } catch (divError) {
        console.warn('⚠️ Failed to fetch divisibility for snapshot, defaulting to 5:', divError);
      }

      try {
        const snapshot = await (snapshotQuery === 'refresh'
          ? generateSnapshot(divisibility)
          : ensureSnapshot(divisibility));
        return NextResponse.json(snapshot, {
          headers: {
            'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
          },
        });
      } catch (snapshotError) {
        console.error('❌ Failed to serve holders snapshot:', snapshotError);
        return NextResponse.json(
          {
            error: 'Failed to load holders snapshot',
            message: snapshotError instanceof Error ? snapshotError.message : 'Unknown error',
          },
          { status: 503 },
        );
      }
    }

    const addressQuery = searchParams.get('address');
    if (addressQuery) {
      const result = await fetchHolderByAddress(addressQuery.trim());
      if (!result) {
        return NextResponse.json(
          { error: 'Holder not found', address: addressQuery },
          { status: 404 },
        );
      }
      return NextResponse.json(result, {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
        },
      });
    }

    const pageParam = Number(searchParams.get('page'));
    const limitParam = Number(searchParams.get('limit'));

    const page = clampPage(pageParam);
    const limit = clampLimit(limitParam);

    const cachedPage = await getCachedPage(page, limit);
    if (cachedPage) {
      return NextResponse.json(cachedPage, {
        headers: {
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=60',
        },
      });
    }

    let divisibility = 5;
    try {
      divisibility = await getDivisibility();
    } catch (divError) {
      console.warn('⚠️ Falling back to default divisibility 5:', divError);
      divisibility = 5;
    }

    try {
      const freshPage = await fetchAndCachePage(page, limit, divisibility);

      if (page === 1) {
        ensureSnapshot(divisibility).catch((err) => {
          console.warn('⚠️ Failed to refresh holders snapshot after page fetch:', err);
        });
      }

      return NextResponse.json(freshPage, {
        headers: {
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=60',
        },
      });
    } catch (fetchError) {
      console.error('❌ Failed to fetch fresh holders page, attempting fallback cache:', fetchError);
      const fallbackCached = await getCachedPage(page, limit);
      if (fallbackCached) {
        return NextResponse.json(fallbackCached, {
          headers: {
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
          },
        });
      }

      try {
        const snapshot = await loadLocalSnapshot();
        const start = (page - 1) * limit;
        const slice = snapshot.holders.slice(start, start + limit);
        if (slice.length > 0) {
          const fallbackPage: CachedHoldersPage = {
            holders: slice,
            pagination: {
              total: snapshot.total,
              page,
              limit,
              totalPages: Math.max(1, Math.ceil(snapshot.total / limit)),
            },
            metadata: {
              runeId: DOG_RUNE_ID,
              divisibility,
              source: 'fallback',
              updatedAt: snapshot.timestamp ?? new Date().toISOString(),
            },
          };

          console.warn('⚠️ Serving holders data from local snapshot fallback');
          return NextResponse.json(fallbackPage, {
            headers: {
              'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=15',
            },
          });
        }
      } catch (snapshotError) {
        console.error('❌ Failed to load local holders snapshot fallback:', snapshotError);
      }

      console.error('❌ No cached holders data available as fallback');
      return NextResponse.json(
        {
          error: 'Failed to fetch holders data',
          message: fetchError instanceof Error ? fetchError.message : 'Unknown error',
        },
        { status: 503 },
      );
    }
  } catch (error) {
    console.error('❌ Error loading holders from Xverse:', error);
    return NextResponse.json(
      {
        error: 'Failed to load holders data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

async function ensureSnapshot(divisibility: number) {
  try {
    const cached = await redisClient.get<string>(HOLDER_SNAPSHOT_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    console.warn('⚠️ Failed to read holders snapshot from cache:', error);
  }

  return generateSnapshot(divisibility);
}

async function generateSnapshot(divisibility: number) {
  const holders: HolderDTO[] = [];
  const ranksPayload: Record<string, number> = {};
  let total = 0;

  const fetchChunk = async (offset: number, chunkLimit: number) => {
    const page = await fetchHoldersPage(offset, chunkLimit);
    const baseRank = offset;
    page.items.forEach((item, index) => {
      const totalAmount = Number(item.amount);
      const rank = baseRank + index + 1;
      const holder: HolderDTO = {
        rank,
        address: item.address,
        total_amount: totalAmount,
        total_dog: runesToDog(totalAmount, divisibility),
      };
      if (holders.length < SNAPSHOT_LIMIT) {
        holders.push(holder);
      }
      ranksPayload[holder.address] = rank;
    });
    return page;
  };

  const RK_WINDOW = [500, 200, 100, 50, 25];
  let offset = 0;
  let rkIndex = 0;

  while (holders.length < SNAPSHOT_LIMIT) {
    const limit = rkIndex < RK_WINDOW.length ? RK_WINDOW[rkIndex] : DEFAULT_LIMIT;
    try {
      const page = await fetchChunk(offset, limit);
      total = page.total;
      offset += page.items.length;
      if (page.items.length < limit || offset >= total) {
        break;
      }
      if (XVERSE_SNAPSHOT_CHUNK_DELAY_MS > 0) {
        await sleep(XVERSE_SNAPSHOT_CHUNK_DELAY_MS);
      }
    } catch (err) {
      rkIndex += 1;
      if (rkIndex >= RK_WINDOW.length) {
        console.warn('⚠️ Falling back to local holders snapshot due to repeated rate limits');
        const fallback = await loadLocalSnapshot();
        holders.splice(0, holders.length, ...fallback.holders);
        total = fallback.total;
        break;
      }
      console.warn(`⚠️ Snapshot chunk failed, retrying with smaller window (${RK_WINDOW[rkIndex]})`, err);
      await sleep(Math.max(XVERSE_HOLDERS_DELAY_MS, 500));
    }
  }

  if (holders.length === 0) {
    throw new Error('Snapshot returned no holders');
  }

  try {
    if (Object.keys(ranksPayload).length > 0) {
      await redisClient.hset(HOLDER_RANK_HASH, ranksPayload);
    }
  } catch (error) {
    console.warn('⚠️ Failed to cache snapshot ranks:', error);
  }

  const snapshot = {
    timestamp: new Date().toISOString(),
    total_holders: total,
    snapshot_size: holders.length,
    holders,
  };

  try {
    await redisClient.set(HOLDER_SNAPSHOT_KEY, JSON.stringify(snapshot), { ex: CACHE_TTL_SECONDS });
  } catch (error) {
    console.warn('⚠️ Failed to cache holders snapshot:', error);
  }

  return snapshot;
}





