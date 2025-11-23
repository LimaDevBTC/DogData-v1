import { NextResponse } from 'next/server';

const DOGSWAP_ENDPOINT = process.env.DOGSWAP_API_URL || 'https://api.dotswap.app/brc20swap/stat/tick_price';
const DOGSWAP_TICK = process.env.DOGSWAP_TICK || 'DOG•GO•TO•THE•MOON';
const DOGSWAP_COIN_TYPE = process.env.DOGSWAP_COIN_TYPE || 'runes';

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

    return NextResponse.json(
      {
        price: usdPrice,
        priceBtc: btcPrice,
        priceSats: sats ? sats.toFixed(2) : null,
        source: 'Dogswap',
        change24h: Number(data.change24h ?? 0) || 0,
        fetchedAt: new Date().toISOString()
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


