import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

interface LostAnalysis {
  generated_at: string;
  constants: { dog_total_supply: number };
  totals: {
    diamond_paws_with_stats: number;
    total_airdrop_dog: number;
  };
  lost_relaxed: {
    count: number;
    pct_of_diamond_paws: number;
    dog_locked: number;
    pct_of_supply: number;
    pct_of_diamond_paws_dog: number;
  };
  active_after_airdrop: {
    count: number;
    dog_held: number;
  };
}

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'data', 'diamond_paws_analysis', 'lost_analysis.json');

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'lost_analysis.json not found' }, { status: 404 });
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content) as LostAnalysis;

    const stalenessHours = Math.floor(
      (Date.now() - new Date(data.generated_at).getTime()) / 3_600_000
    );

    return NextResponse.json(
      {
        generated_at: data.generated_at,
        staleness_hours: stalenessHours,
        diamond_paws_total: data.totals.diamond_paws_with_stats,
        diamond_paws_dog: data.totals.total_airdrop_dog,
        dog_total_supply: data.constants.dog_total_supply,
        lost: {
          wallets: data.lost_relaxed.count,
          dog_locked: data.lost_relaxed.dog_locked,
          pct_of_supply: data.lost_relaxed.pct_of_supply,
          pct_of_diamond_paws: data.lost_relaxed.pct_of_diamond_paws,
          pct_of_diamond_paws_dog: data.lost_relaxed.pct_of_diamond_paws_dog,
        },
        active: {
          wallets: data.active_after_airdrop.count,
          dog_held: data.active_after_airdrop.dog_held,
        },
        methodology: {
          criterion: 'spent_txo_count == 0',
          plain_text:
            "Wallets that have NEVER signed a transaction (no UTXO ever spent — in DOG, BTC, other runes, or inscriptions) since the original airdrop in April 2024.",
          notes: [
            'The DOG airdrop happened in just 7 unique blocks (840,647 → 840,658, late April 2024).',
            "By definition diamond paws hold their exact airdrop balance (retention 100%) — so any later UTXOs they hold contain non-DOG dust drops, not more DOG.",
            "Receiving deposits proves nothing — anyone can send sats to a published address. Only an outgoing transaction proves the owner controls the keys.",
            "Probable wallet profile: throwaway addresses (P2TR, mostly) created in 2023-2024 for inscription/rare-sat hunting and forgotten.",
          ],
          source: 'data/diamond_paws_analysis/lost_analysis.json',
          ceiling_disclaimer:
            "This is an UPPER BOUND. Some wallets may belong to extreme HODLers who set up an address only to receive — they're indistinguishable on-chain from genuinely lost wallets.",
        },
      },
      {
        headers: {
          'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (error) {
    console.error('Error in /api/airdrop/lost:', error);
    return NextResponse.json(
      { error: 'Failed to load lost-DOG analysis' },
      { status: 500 }
    );
  }
}
