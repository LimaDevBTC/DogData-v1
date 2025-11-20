import { NextRequest, NextResponse } from 'next/server';
import { redisClient } from '@/lib/upstash';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DOG_RUNE_ID = '840000:3';
const DOG_DIVISIBILITY = 5;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 25;

interface HolderDTO {
  rank: number;
  address: string;
  total_amount: number;
  total_dog: number;
  utxo_count?: number;
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
    source: 'local';
    updatedAt: string;
  };
}

interface HolderSearchResponse {
  holder: HolderDTO & {
    holder_rank: number | null;
  };
  metadata: {
    runeId: string;
    divisibility: number;
    source: 'local';
    updatedAt: string;
  };
}

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

function clampPage(page: number) {
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function clampLimit(limit: number) {
  if (!Number.isFinite(limit) || limit <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(limit), MAX_LIMIT);
}

async function loadLocalHolders(): Promise<LocalHoldersData | null> {
  // Tentar múltiplos caminhos possíveis
  const possiblePaths = [
    path.join(process.cwd(), 'public', 'data', 'dog_holders_by_address.json'),
    path.join(process.cwd(), 'data', 'dog_holders_by_address.json'),
    path.join(process.cwd(), '..', 'DogData-v1', 'public', 'data', 'dog_holders_by_address.json'),
    path.join(process.cwd(), '..', 'DogData-v1', 'data', 'dog_holders_by_address.json'),
  ];

  // Primeiro tentar via filesystem (local development)
  for (const filePath of possiblePaths) {
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(raw) as LocalHoldersData;
      console.log(`✅ Local holders loaded from: ${filePath}`);
      return data;
    } catch (err) {
      // Continuar tentando outros caminhos
    }
  }

  // Se filesystem falhar, tentar via HTTP (Vercel/produção)
  try {
    let baseUrl: string;
    if (process.env.NEXT_PUBLIC_APP_URL) {
      baseUrl = process.env.NEXT_PUBLIC_APP_URL;
    } else if (process.env.VERCEL_URL) {
      baseUrl = `https://${process.env.VERCEL_URL}`;
    } else {
      baseUrl = 'http://localhost:3000';
    }
    
    baseUrl = baseUrl.replace(/\/$/, '');
    const url = `${baseUrl}/data/dog_holders_by_address.json`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    try {
      const response = await fetch(url, {
        headers: {
          'Cache-Control': 'no-cache',
          'Accept': 'application/json'
        },
        next: { revalidate: 0 },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json() as LocalHoldersData;
          console.log(`✅ Local holders loaded via HTTP from: ${url}`);
          return data;
        }
      }
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError?.name !== 'AbortError') {
        throw fetchError;
      }
    }
  } catch (httpError) {
    console.warn('⚠️ HTTP fetch failed:', httpError);
  }

  console.error('❌ Failed to load local holders from all possible paths');
  return null;
}

function processHoldersData(data: LocalHoldersData): {
  total: number;
  holders: HolderDTO[];
  timestamp: string;
} {
  if (!Array.isArray(data?.holders)) {
    throw new Error('Invalid local holders file: holders is not an array');
  }

  const holders: HolderDTO[] = data.holders.map((holder: any) => {
    const rank = typeof holder?.rank === 'number' ? holder.rank : 0;
    const address = holder?.address || '';
    const total_amount = typeof holder?.total_amount === 'number' 
      ? holder.total_amount 
      : (typeof holder?.total_amount === 'string' ? Number(holder.total_amount) : 0);
    const total_dog = typeof holder?.total_dog === 'number' 
      ? holder.total_dog 
      : (typeof holder?.total_dog === 'string' ? Number(holder.total_dog) : 0);
    const utxo_count = typeof holder?.utxo_count === 'number' ? holder.utxo_count : undefined;
    
    return {
      rank,
      address,
      total_amount: Number.isFinite(total_amount) ? total_amount : 0,
      total_dog: Number.isFinite(total_dog) ? total_dog : 0,
      ...(utxo_count !== undefined ? { utxo_count } : {}),
    };
  }).filter((holder: HolderDTO) => Boolean(holder.address) && holder.address.length > 0);

  return {
    total: data.total_holders || holders.length,
    holders,
    timestamp: data.timestamp || new Date().toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl;
    const searchParams = url.searchParams;

    // Busca por endereço específico
    const addressQuery = searchParams.get('address');
    if (addressQuery) {
      const data = await loadLocalHolders();
      if (!data) {
        return NextResponse.json(
          { error: 'Holders data not available' },
          { status: 503 }
        );
      }

      const { holders } = processHoldersData(data);
      const holder = holders.find(h => 
        h.address.toLowerCase() === addressQuery.trim().toLowerCase()
      );

      if (!holder) {
        return NextResponse.json(
          { error: 'Holder not found', address: addressQuery },
          { status: 404 }
        );
      }

      const response: HolderSearchResponse = {
        holder: {
          ...holder,
          holder_rank: holder.rank,
        },
        metadata: {
          runeId: DOG_RUNE_ID,
          divisibility: DOG_DIVISIBILITY,
          source: 'local',
          updatedAt: data.timestamp,
        },
      };

      return NextResponse.json(response, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
        },
      });
    }

    // Snapshot endpoint (para compatibilidade)
    const snapshotQuery = searchParams.get('snapshot');
    if (snapshotQuery) {
      const data = await loadLocalHolders();
      if (!data) {
        return NextResponse.json(
          { error: 'Holders data not available' },
          { status: 503 }
        );
      }

      const { holders, total, timestamp } = processHoldersData(data);
      
      return NextResponse.json({
        timestamp,
        total_holders: total,
        snapshot_size: holders.length,
        holders: holders.slice(0, 500), // Limitar snapshot a top 500
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
        },
      });
    }

    // Paginação
    const pageParam = Number(searchParams.get('page'));
    const limitParam = Number(searchParams.get('limit'));

    // Se limit for muito grande (>= 100000), retornar todos os holders
    const page = clampPage(pageParam);
    const limit = limitParam >= 100000 ? 1000000 : clampLimit(limitParam);

    const data = await loadLocalHolders();
    if (!data) {
      return NextResponse.json(
        { error: 'Holders data not available' },
        { status: 503 }
      );
    }

    const { holders, total, timestamp } = processHoldersData(data);
    const start = (page - 1) * limit;
    const end = start + limit;
    const pageHolders = holders.slice(start, end);

    const response: CachedHoldersPage = {
      holders: pageHolders,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      metadata: {
        runeId: DOG_RUNE_ID,
        divisibility: DOG_DIVISIBILITY,
        source: 'local',
        updatedAt: timestamp,
      },
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    console.error('❌ Error loading holders:', error);
    
    // Retornar página vazia válida ao invés de erro 500
    const emptyPage: CachedHoldersPage = {
      holders: [],
      pagination: {
        total: 0,
        page: 1,
        limit: 25,
        totalPages: 1,
      },
      metadata: {
        runeId: DOG_RUNE_ID,
        divisibility: DOG_DIVISIBILITY,
        source: 'local',
        updatedAt: new Date().toISOString(),
      },
    };
    
    return NextResponse.json(emptyPage, {
      headers: {
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=5',
      },
    });
  }
}
