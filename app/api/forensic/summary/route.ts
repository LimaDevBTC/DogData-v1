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
    
    const timestamp = data.timestamp ?? null;
    const staleness_hours = timestamp
      ? Math.floor((Date.now() - new Date(timestamp).getTime()) / 3_600_000)
      : null;

    return NextResponse.json({
      statistics: data.statistics || {},
      timestamp,
      staleness_hours,
      field_definitions: {
        still_holding: 'Current state: wallet has any non-zero DOG balance now. Partitions total_analyzed with sold_everything (still_holding + sold_everything = total_analyzed).',
        sold_everything: 'Current state: wallet has zero DOG balance now. Partitions total_analyzed with still_holding.',
        accumulated: 'Current state: wallet now holds more DOG than it received in airdrops (bought additional supply).',
        dumping: 'Behavioral label, NOT a current state. Sum of by_pattern.paper_hands + panic_seller + early_exit. A wallet labeled "dumping" may still appear in still_holding if it retained a small balance, so dumping > still_holding is expected and not a contradiction.',
        accumulator_patterns: 'List of by_pattern keys whose count rolls up into the accumulated total.',
      },
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



