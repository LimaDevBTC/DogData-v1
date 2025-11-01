import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'data', 'airdrop_analytics.json');
    
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Data file not found' },
        { status: 404 }
      );
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(fileContent);
    
    // Retornar a lista de recipients
    return NextResponse.json({
      recipients: data.analytics?.recipients || [],
      total: data.analytics?.summary?.total_recipients || 0,
      timestamp: data.timestamp
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('Error reading airdrop recipients:', error);
    return NextResponse.json(
      { error: 'Failed to load airdrop recipients' },
      { status: 500 }
    );
  }
}

