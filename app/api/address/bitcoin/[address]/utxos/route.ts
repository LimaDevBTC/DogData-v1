import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

interface Utxo {
  txid: string;
  vout: number;
  dog: number;
  age_days: number;
  ts: number | null;
  lth: boolean;
}

const FILE_PATH = path.join(process.cwd(), 'data', 'dog_utxos_by_address.json');

// In-memory cache of the full {address: Utxo[]} map, refreshed on file change.
let cache: { map: Record<string, Utxo[]>; mtime: number } | null = null;

function loadMap(): Record<string, Utxo[]> {
  const stat = fs.statSync(FILE_PATH);
  if (cache && cache.mtime === stat.mtimeMs) return cache.map;
  const map = JSON.parse(fs.readFileSync(FILE_PATH, 'utf-8')) as Record<string, Utxo[]>;
  cache = { map, mtime: stat.mtimeMs };
  return map;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address: rawAddress } = await params;
    const address = decodeURIComponent(rawAddress);

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));
    const sort = (searchParams.get('sort') || 'age_desc').toLowerCase(); // age_desc | age_asc | dog_desc

    if (!fs.existsSync(FILE_PATH)) {
      return NextResponse.json({ error: 'dog_utxos_by_address.json not found' }, { status: 404 });
    }

    const map = loadMap();
    const utxos = map[address] || [];

    const total = utxos.length;
    const totalDog = utxos.reduce((s, u) => s + u.dog, 0);
    const lthUtxos = utxos.filter((u) => u.lth).length;

    // Sort a shallow copy (stored order is age_desc = oldest first).
    const sorted = [...utxos];
    if (sort === 'dog_desc') sorted.sort((a, b) => b.dog - a.dog);
    else if (sort === 'age_asc') sorted.sort((a, b) => a.age_days - b.age_days);
    else sorted.sort((a, b) => b.age_days - a.age_days); // age_desc default

    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const slice = sorted.slice(offset, offset + limit).map((u) => ({
      ...u,
      pct: totalDog > 0 ? (u.dog / totalDog) * 100 : 0,
    }));

    return NextResponse.json(
      {
        address,
        total,
        total_dog: totalDog,
        lth_utxos: lthUtxos,
        sth_utxos: total - lthUtxos,
        page,
        limit,
        total_pages: totalPages,
        sort,
        utxos: slice,
      },
      {
        headers: {
          'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (error) {
    console.error('Error in /api/address/bitcoin/[address]/utxos:', error);
    return NextResponse.json({ error: 'Failed to load UTXO breakdown' }, { status: 500 });
  }
}
