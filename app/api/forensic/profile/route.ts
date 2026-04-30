import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address')?.trim();

  if (!address) {
    return NextResponse.json(
      { error: 'Missing address parameter' },
      { status: 400 }
    );
  }

  try {
    const filePath = path.join(process.cwd(), 'data', 'forensic_behavioral_analysis.json');

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Forensic data not found' }, { status: 404 });
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const profile = (data.all_profiles as any[])?.find(
      (p) => p.address.toLowerCase() === address.toLowerCase()
    );

    if (!profile) {
      return NextResponse.json(
        { error: 'Address not found in airdrop recipients', address },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { profile, data_timestamp: data.timestamp },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error) {
    console.error('[forensic/profile] Error:', error);
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
  }
}
