import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

interface HolderByAge {
  rank: number;
  address: string;
  total_dog: number;
  lth_dog: number;
  sth_dog: number;
  lth_pct: number;
  sth_pct: number;
  utxo_count: number;
  lth_utxos: number;
  sth_utxos: number;
  weighted_avg_age_days: number;
  oldest_age_days: number;
  newest_age_days: number;
}

const CSV_PATH = path.join(process.cwd(), 'data', 'holders_by_age.csv');

let cache: { holders: HolderByAge[]; mtime: number } | null = null;

function loadHolders(): HolderByAge[] {
  const stat = fs.statSync(CSV_PATH);
  if (cache && cache.mtime === stat.mtimeMs) return cache.holders;

  const content = fs.readFileSync(CSV_PATH, 'utf-8');
  const lines = content.trim().split('\n');
  // header: rank,address,total_dog,lth_dog,sth_dog,lth_pct,sth_pct,utxo_count,lth_utxos,sth_utxos,weighted_avg_age_days,oldest_age_days,newest_age_days
  const holders: HolderByAge[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    holders.push({
      rank: parseInt(c[0], 10) || 0,
      address: c[1],
      total_dog: parseFloat(c[2]),
      lth_dog: parseFloat(c[3]),
      sth_dog: parseFloat(c[4]),
      lth_pct: parseFloat(c[5]),
      sth_pct: parseFloat(c[6]),
      utxo_count: parseInt(c[7], 10) || 0,
      lth_utxos: parseInt(c[8], 10) || 0,
      sth_utxos: parseInt(c[9], 10) || 0,
      weighted_avg_age_days: parseFloat(c[10]),
      oldest_age_days: parseFloat(c[11]),
      newest_age_days: parseFloat(c[12]),
    });
  }
  // CSV is already sorted by total_dog desc; no re-sort needed.
  cache = { holders, mtime: stat.mtimeMs };
  return holders;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const filter = (searchParams.get('filter') || 'all').toLowerCase(); // all | lth | sth
    const q = (searchParams.get('q') || '').trim().toLowerCase(); // address search

    if (!fs.existsSync(CSV_PATH)) {
      return NextResponse.json({ error: 'holders_by_age.csv not found' }, { status: 404 });
    }

    let holders = loadHolders();

    // Predominance filter: LTH-dominant if >=50% of balance is in old UTXOs.
    if (filter === 'lth') {
      holders = holders.filter((h) => h.lth_pct >= 50);
    } else if (filter === 'sth') {
      holders = holders.filter((h) => h.lth_pct < 50);
    }

    // Address search (substring, case-insensitive).
    if (q) {
      holders = holders.filter((h) => h.address.toLowerCase().includes(q));
    }

    const total = holders.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const slice = holders.slice(offset, offset + limit);

    return NextResponse.json(
      {
        page,
        limit,
        total,
        total_pages: totalPages,
        filter,
        q: q || null,
        wallets: slice,
      },
      {
        headers: {
          'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (error) {
    console.error('Error in /api/metrics/holders-by-age/wallets:', error);
    return NextResponse.json({ error: 'Failed to load holders-by-age list' }, { status: 500 });
  }
}
