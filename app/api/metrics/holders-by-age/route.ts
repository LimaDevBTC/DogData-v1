import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

const META_PATH = path.join(process.cwd(), 'data', 'holders_by_age_meta.json');
const CSV_PATH = path.join(process.cwd(), 'data', 'holders_by_age.csv');

interface Meta {
  generated_at: string;
  threshold_days: number;
  definition: string;
  dominance_rule?: string;
  total_holders: number;
  lth_dominant_wallets?: number;
  sth_dominant_wallets?: number;
  total_dog: number;
  lth_dog: number;
  sth_dog: number;
  lth_pct: number;
  sth_pct: number;
}

// Fallback: derive dominant-wallet counts from the CSV when meta predates them.
function countDominantFromCsv(): { lth: number; sth: number } | null {
  if (!fs.existsSync(CSV_PATH)) return null;
  const content = fs.readFileSync(CSV_PATH, 'utf-8');
  const lines = content.trim().split('\n');
  let lth = 0;
  let sth = 0;
  for (let i = 1; i < lines.length; i++) {
    const lthPct = parseFloat(lines[i].split(',')[5]);
    if (lthPct >= 50) lth++;
    else sth++;
  }
  return { lth, sth };
}

export async function GET() {
  try {
    if (!fs.existsSync(META_PATH)) {
      return NextResponse.json({ error: 'holders_by_age_meta.json not found' }, { status: 404 });
    }

    const meta = JSON.parse(fs.readFileSync(META_PATH, 'utf-8')) as Meta;

    let lthDominant = meta.lth_dominant_wallets;
    let sthDominant = meta.sth_dominant_wallets;
    if (lthDominant === undefined || sthDominant === undefined) {
      const counts = countDominantFromCsv();
      if (counts) {
        lthDominant = counts.lth;
        sthDominant = counts.sth;
      }
    }

    const stalenessHours = Math.floor(
      (Date.now() - new Date(meta.generated_at).getTime()) / 3_600_000
    );

    return NextResponse.json(
      {
        generated_at: meta.generated_at,
        staleness_hours: stalenessHours,
        threshold_days: meta.threshold_days,
        total_holders: meta.total_holders,
        lth_dominant_wallets: lthDominant ?? null,
        sth_dominant_wallets: sthDominant ?? null,
        supply: {
          total_dog: meta.total_dog,
          lth_dog: meta.lth_dog,
          sth_dog: meta.sth_dog,
          lth_pct: meta.lth_pct,
          sth_pct: meta.sth_pct,
        },
        methodology: {
          threshold_days: meta.threshold_days,
          definition: meta.definition,
          dominance_rule:
            meta.dominance_rule ??
            'A wallet is LTH-dominant when >=50% of its DOG sits in UTXOs >=155 days old; otherwise STH-dominant.',
          plain_text:
            'Each wallet is broken down by coin age: DOG sitting in UTXOs older than 155 days counts as Long-Term Holder (LTH) supply, younger than 155 days as Short-Term Holder (STH) supply. A wallet usually holds both — the breakdown is supply-weighted, so the totals reconcile exactly with the aggregate STH/LTH metric published on the metrics page.',
          notes: [
            'Coin age is measured from the block that created each UTXO (last time the coins moved).',
            'An old UTXO means the coins have not been spent in >=155 days — the standard LTH signal.',
            'Per-wallet lth_dog + sth_dog == total_dog. Summed across all wallets it matches the published aggregate.',
            'A small number of UTXOs without a computable age are excluded, identical to the aggregate metric.',
          ],
          source: 'data/holders_by_age.csv',
        },
      },
      {
        headers: {
          'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (error) {
    console.error('Error in /api/metrics/holders-by-age:', error);
    return NextResponse.json({ error: 'Failed to load holders-by-age summary' }, { status: 500 });
  }
}
