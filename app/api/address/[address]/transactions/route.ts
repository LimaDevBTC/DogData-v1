import { NextRequest, NextResponse } from 'next/server';
import { buildPaginated } from '@/lib/pagination';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Convenience endpoint: GET /api/address/{address}/transactions
 *
 * Returns paginated DOG transaction history for a Bitcoin L1 address.
 * Delegates to /api/address/bitcoin/{address}, which holds the heavy
 * indexing logic (Redis-backed) and returns the canonical pagination
 * envelope.
 *
 * Query params:
 *   limit     - default 50, max 500
 *   offset    - default 0
 *   direction - "in" | "out" (omit for both)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number(sp.get('limit') ?? '50') || 50, 1), 500);
  const offset = Math.max(Number(sp.get('offset') ?? '0') || 0, 0);
  const direction = sp.get('direction');
  const page = Math.floor(offset / limit) + 1;

  // Forward to the underlying address endpoint with pagination params
  const upstreamUrl = new URL(`/api/address/bitcoin/${encodeURIComponent(address)}`, req.url);
  upstreamUrl.searchParams.set('limit', String(limit));
  upstreamUrl.searchParams.set('offset', String(offset));
  if (direction === 'in' || direction === 'out') {
    upstreamUrl.searchParams.set('direction', direction);
  }

  try {
    // No `cache: 'no-store'` here, deliberately. The upstream route serves
    // `s-maxage=300` and each call costs a 10.000-row read of `senders` and
    // `receivers` out of Supabase, which on a busy address is megabytes of
    // egress. Opting out of the cache made every page of every pagination walk
    // pay that again — the same mistake the status page was making, where an
    // internal `no-store` quietly defeated the cache in front of the most
    // expensive query in the project.
    const upstream = await fetch(upstreamUrl.toString(), {
      headers: { Accept: 'application/json' },
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: 'Failed to load address transactions' },
        { status: upstream.status }
      );
    }

    const payload = await upstream.json();
    const txs = Array.isArray(payload?.transactions) ? payload.transactions : [];
    const total: number = payload?.tx_count ?? txs.length;

    return NextResponse.json(
      buildPaginated({
        data: txs,
        page,
        limit,
        total,
        last_updated: payload?.last_updated ?? null,
        legacy: {
          address,
          direction: direction ?? 'all',
          transactions: txs,
        },
      }),
      {
        headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
      }
    );
  } catch (error: any) {
    console.error('[address/transactions] error', error);
    return NextResponse.json(
      { error: 'Internal error', message: error?.message ?? 'unknown' },
      { status: 500 }
    );
  }
}
