import { NextResponse } from 'next/server';
import { buildPriceResponse } from '@/lib/price-normalizer';

const DOGSWAP_ENDPOINT = process.env.DOGSWAP_API_URL || 'https://api.dotswap.app/brc20swap/stat/tick_price';
const DOGSWAP_TICK = process.env.DOGSWAP_TICK || 'DOG•GO•TO•THE•MOON';
const DOGSWAP_COIN_TYPE = process.env.DOGSWAP_COIN_TYPE || 'runes';

const DOGSWAP_META = { exchange: 'dogswap', type: 'dex' as const, chain: 'bitcoin-l1' as const, pair: 'DOG/BTC' };

export async function GET() {
  try {
    const response = await fetch(DOGSWAP_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        tick: DOGSWAP_TICK,
        coin_type: DOGSWAP_COIN_TYPE
      }),
      cache: 'no-cache'
    });

    if (!response.ok) {
      throw new Error(`Dogswap API returned ${response.status}`);
    }

    const payload = await response.json();
    const data = payload?.data ?? payload ?? {};

    const usdPrice = Number(data.usd_price ?? data.price ?? 0) || 0;
    const btcPrice = Number(data.btc_price ?? data.btcPrice ?? 0) || 0;
    const sats = btcPrice ? btcPrice * 100_000_000 : 0;
    const change_24h_pct = Number(data.change24h ?? 0) || 0;
    const fetchedAt = new Date().toISOString();

    return NextResponse.json(
      {
        ...buildPriceResponse({
          ...DOGSWAP_META,
          price_usd: usdPrice,
          price_btc: btcPrice || null,
          price_sats: sats || null,
          change_24h_pct,
          fetched_at: fetchedAt,
          cached: false,
          legacy: {
            price: usdPrice,
            priceBtc: btcPrice,
            priceSats: sats ? sats.toFixed(2) : null,
            change24h: change_24h_pct,
            source: 'Dogswap',
            fetchedAt,
          },
        }),
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=60'
        }
      }
    );
  } catch (error) {
    console.error('❌ Failed to fetch Dogswap price:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Dogswap price' },
      { status: 503 }
    );
  }
}
