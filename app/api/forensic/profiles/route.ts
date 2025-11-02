import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const pattern = searchParams.get('pattern');

    const filePath = path.join(process.cwd(), 'data', 'forensic_behavioral_analysis.json');
    
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Data file not found' },
        { status: 404 }
      );
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(fileContent);
    
    let profiles = data.all_profiles || [];

    // Filtrar por padrão se especificado
    if (pattern && pattern !== 'all') {
      profiles = profiles.filter((p: any) => p.behavior_pattern === pattern);
    }

    // Ordenar por receive_count (maior primeiro), depois por airdrop_amount
    profiles.sort((a: any, b: any) => {
      if (b.receive_count !== a.receive_count) {
        return b.receive_count - a.receive_count;
      }
      return b.airdrop_amount - a.airdrop_amount;
    });

    // Paginar
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedProfiles = profiles.slice(startIndex, endIndex);

    return NextResponse.json({
      profiles: paginatedProfiles,
      total: profiles.length,
      page,
      limit,
      totalPages: Math.ceil(profiles.length / limit)
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('Error reading forensic profiles:', error);
    return NextResponse.json(
      { error: 'Failed to load forensic profiles' },
      { status: 500 }
    );
  }
}



