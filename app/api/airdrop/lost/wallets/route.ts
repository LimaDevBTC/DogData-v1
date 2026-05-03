import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

interface Wallet {
  address: string;
  airdrop_dog: number;
  addr_type: string;
  funded_txo_count: number;
  receive_count: number;
}

let cache: { wallets: Wallet[]; mtime: number } | null = null;

function loadWallets(): Wallet[] {
  const filePath = path.join(
    process.cwd(),
    'data',
    'diamond_paws_analysis',
    'lost_addresses_relaxed.csv'
  );

  const stat = fs.statSync(filePath);
  if (cache && cache.mtime === stat.mtimeMs) return cache.wallets;

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  // header: address,airdrop_dog,addr_type,funded_txo_count,receive_count
  const wallets: Wallet[] = [];
  for (let i = 1; i < lines.length; i++) {
    const [address, airdrop_dog, addr_type, funded_txo_count, receive_count] = lines[i].split(',');
    wallets.push({
      address,
      airdrop_dog: parseFloat(airdrop_dog),
      addr_type,
      funded_txo_count: parseInt(funded_txo_count, 10) || 0,
      receive_count: parseInt(receive_count, 10) || 0,
    });
  }
  // CSV is already sorted by airdrop_dog desc; no re-sort needed.
  cache = { wallets, mtime: stat.mtimeMs };
  return wallets;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const addrType = searchParams.get('addr_type'); // optional filter

    const filePath = path.join(
      process.cwd(),
      'data',
      'diamond_paws_analysis',
      'lost_addresses_relaxed.csv'
    );
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'lost_addresses_relaxed.csv not found' }, { status: 404 });
    }

    let wallets = loadWallets();
    if (addrType) {
      wallets = wallets.filter((w) => w.addr_type === addrType);
    }

    const total = wallets.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const slice = wallets.slice(offset, offset + limit);

    return NextResponse.json(
      {
        page,
        limit,
        total,
        total_pages: totalPages,
        addr_type_filter: addrType,
        wallets: slice.map((w, i) => ({ ...w, rank: offset + i + 1 })),
      },
      {
        headers: {
          'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (error) {
    console.error('Error in /api/airdrop/lost/wallets:', error);
    return NextResponse.json({ error: 'Failed to load wallet list' }, { status: 500 });
  }
}
