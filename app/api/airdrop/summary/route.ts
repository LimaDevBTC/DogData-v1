import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Load airdrop data (distribution, amounts, category breakdown)
    const airdropPath = path.join(process.cwd(), 'data', 'airdrop_analytics.json');
    if (!fs.existsSync(airdropPath)) {
      return NextResponse.json({ error: 'Data file not found' }, { status: 404 });
    }
    const airdropData = JSON.parse(fs.readFileSync(airdropPath, 'utf-8'));
    const summary = { ...(airdropData.analytics?.summary || {}) };

    // Use forensic analysis as canonical source for retention metrics
    // (forensic and airdrop use different counting methods — forensic is authoritative)
    const forensicPath = path.join(process.cwd(), 'data', 'forensic_behavioral_analysis.json');
    if (fs.existsSync(forensicPath)) {
      const forensicData = JSON.parse(fs.readFileSync(forensicPath, 'utf-8'));
      const stats = forensicData.statistics || {};

      summary.still_holding    = stats.still_holding    ?? summary.still_holding;
      summary.sold_everything  = stats.sold_everything  ?? summary.sold_everything;
      summary.retention_rate   = stats.retention_rate   ?? summary.retention_rate;
      summary.accumulated      = stats.accumulated      ?? summary.accumulated;
      summary.accumulator_breakdown = stats.by_pattern  ?? null;
      summary.last_updated     = forensicData.timestamp ?? null;
      summary.staleness_hours  = forensicData.timestamp
        ? Math.floor((Date.now() - new Date(forensicData.timestamp).getTime()) / 3_600_000)
        : null;
    } else {
      summary.last_updated = airdropData.timestamp ?? null;
    }

    return NextResponse.json(summary, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    console.error('Error reading airdrop summary:', error);
    return NextResponse.json({ error: 'Failed to load airdrop summary' }, { status: 500 });
  }
}
