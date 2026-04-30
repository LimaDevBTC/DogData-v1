import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { buildPaginated, parsePageParams } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const filePath = path.join(process.cwd(), 'data', 'airdrop_analytics.json');

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Data file not found' }, { status: 404 });
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(fileContent);

    const allRecipients = data.analytics?.recipients || [];
    const total = data.analytics?.summary?.total_recipients || allRecipients.length;
    const last_updated = data.timestamp ?? null;

    const url = new URL(request.url);
    const hasPagination = url.searchParams.has('page') || url.searchParams.has('limit');

    if (!hasPagination) {
      // Backward-compat: no pagination params returns full list (existing consumers)
      return NextResponse.json({
        data: allRecipients,
        pagination: {
          page: 1,
          limit: allRecipients.length,
          total,
          total_pages: 1,
          has_more: false,
        },
        last_updated,
        recipients: allRecipients,
        total,
        timestamp: last_updated,
      }, {
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      });
    }

    const { page, limit } = parsePageParams(url, { limit: 100, max: 1000 });
    const startIndex = (page - 1) * limit;
    const paginated = allRecipients.slice(startIndex, startIndex + limit);

    return NextResponse.json(
      buildPaginated({
        data: paginated,
        page,
        limit,
        total,
        last_updated,
        legacy: {
          recipients: paginated,
          total,
          timestamp: last_updated,
        },
      }),
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error) {
    console.error('Error reading airdrop recipients:', error);
    return NextResponse.json(
      { error: 'Failed to load airdrop recipients' },
      { status: 500 }
    );
  }
}
