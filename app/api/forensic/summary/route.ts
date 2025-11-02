import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'data', 'forensic_behavioral_analysis.json');
    
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Data file not found' },
        { status: 404 }
      );
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(fileContent);
    
    // Retornar as estatísticas
    return NextResponse.json({
      statistics: data.statistics || {},
      timestamp: data.timestamp
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('Error reading forensic summary:', error);
    return NextResponse.json(
      { error: 'Failed to load forensic summary' },
      { status: 500 }
    );
  }
}



