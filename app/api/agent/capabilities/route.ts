import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  let totalHolders = 89287;
  let totalUtxos = 250002;
  let lastScan = new Date().toISOString();

  // Fetch live stats via internal API (avoids fs which bloats serverless bundle)
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const res = await fetch(`${baseUrl}/api/dog-rune/holders?limit=1`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      totalHolders = data.pagination?.total || totalHolders;
      lastScan = data.metadata?.updatedAt || lastScan;
    }
  } catch {}

  const capabilities = {
    service: "DOG DATA",
    version: "1.0.0",
    description: "World's most comprehensive DOG\u2022GO\u2022TO\u2022THE\u2022MOON data platform on Bitcoin L1",
    protocols: {
      rest: {
        base_url: "https://www.dogdata.xyz/api",
        openapi_spec: "https://www.dogdata.xyz/api/openapi.json",
        auth: "bearer_token",
        docs: "https://www.dogdata.xyz/docs"
      },
      mcp: {
        npm_package: "@dogdata/mcp-server",
        http_endpoint: "https://www.dogdata.xyz/mcp",
        transport: ["stdio", "streamable-http"],
        tools_count: 12,
        resources_count: 8
      },
      sse: {
        endpoint: "https://www.dogdata.xyz/api/events",
        events: ["new_transaction", "price_update", "whale_alert", "new_block"]
      }
    },
    datasets: {
      holders: {
        description: "Complete DOG holder list with rankings and UTXO counts",
        total_records: totalHolders,
        update_frequency: "hourly",
        endpoints: ["/api/dog-rune/holders"]
      },
      transactions: {
        description: "Real-time DOG transactions from Bitcoin L1",
        update_frequency: "real-time (~30s)",
        endpoints: ["/api/dog-rune/transactions-kv"]
      },
      forensic: {
        description: "Behavioral analysis of 75,490+ airdrop recipients with Diamond Score",
        total_profiles: 75490,
        categories: 14,
        endpoints: ["/api/forensic/profiles", "/api/forensic/summary"]
      },
      pricing: {
        description: "Multi-exchange DOG pricing from 8+ sources",
        exchanges: ["kraken", "gateio", "mexc", "bitget", "pionex", "magiceden", "bitflow", "dogswap"],
        update_frequency: "30s",
        endpoints: ["/api/price/kraken", "/api/price/gateio", "/api/price/mexc", "/api/price/bitget", "/api/price/pionex", "/api/price/magiceden", "/api/price/bitflow", "/api/price/dogswap"]
      },
      metrics: {
        description: "On-chain analytics: UTXO distribution, concentration, realized cap",
        endpoints: ["/api/metrics/utxo", "/api/metrics/holder-concentration", "/api/metrics/realized-cap"]
      },
      airdrop: {
        description: "Airdrop distribution and recipient analysis",
        endpoints: ["/api/airdrop/summary", "/api/airdrop/recipients"]
      },
      bitcoin: {
        description: "Bitcoin network status — blocks, hashrate, mempool, fees",
        endpoints: ["/api/bitcoin"]
      },
      markets: {
        description: "Aggregated market data across 20+ exchanges",
        endpoints: ["/api/markets"]
      }
    },
    data_quality: {
      source: "Bitcoin Core + Ord (local full node)",
      indexing_method: "direct block scanning (no third-party APIs)",
      total_holders_indexed: totalHolders,
      total_utxos_tracked: totalUtxos,
      last_scan: lastScan
    },
    rate_limits: {
      public: { requests_per_hour: 20, description: "No API key required" },
      free: { requests_per_hour: 100, description: "For testing and evaluation" },
      pro: { requests_per_hour: 5000, description: "For production agents" },
      enterprise: { requests_per_hour: 50000, description: "For high-volume agents" }
    },
    links: {
      website: "https://www.dogdata.xyz",
      api_docs: "https://www.dogdata.xyz/docs",
      github: "https://github.com/dogdata",
      mcp_npm: "https://www.npmjs.com/package/@dogdata/mcp-server"
    }
  };

  return NextResponse.json(capabilities, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
      'Access-Control-Allow-Origin': '*',
    }
  });
}
